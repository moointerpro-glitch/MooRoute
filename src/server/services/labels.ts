import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { DomainError, requireCondition, versionMatches } from "../domain/errors";
import { idPattern, reasonText } from "../domain/consignment";
import { LABEL_FORMATS, labelProblems, lookupPath, type LabelPayload } from "../domain/labels";
import { principal, type Principal } from "../auth/permissions";
import { requireConsignmentAccess } from "../auth/resource-policy";
import { guardedWrite, replay, type Transaction } from "./transaction";

const ISSUABLE = ["ASSIGNED", "WAREHOUSE_RECEIVED", "LOADED"];
type Snapshot = { branch?: Record<string, string | null>; warehouse?: Record<string, string | null>; department?: Record<string, string | null>; contact?: { name: string | null; phone: string | null } };
type Transport = { serviceDate?: string | null; roundNo?: number | null; plate?: string | null; province?: string | null; departureAt?: string | null };

/** Label operations: capability plus GLOBAL or the consignment's source warehouse. */
function requireLabelActor(p: Principal, capability: string, c: { sourceWarehouseId: string }) {
  requireCondition(p.permissions.has(capability) && (p.global || p.scopes.some((s) => s.kind === "WAREHOUSE" && s.warehouseId === c.sourceWarehouseId)), "FORBIDDEN", "คุณไม่มีสิทธิ์จัดการฉลากของรายการนี้");
}
async function loadForLabel(tx: Transaction, consignmentId: string, lock: boolean) {
  requireCondition(typeof consignmentId === "string" && idPattern.test(consignmentId), "NOT_FOUND", "ไม่พบรายการฝากส่ง");
  if (lock) await tx.$queryRaw`SELECT id FROM Consignment WHERE id=${consignmentId} FOR UPDATE`;
  const c = await tx.consignment.findUnique({ where: { id: consignmentId }, include: {
    destinationBranch: true, consignmentPackage_consignmentId: { orderBy: { sequence: "asc" } },
    currentAssignment: { include: { senderSnapshot: true, recipientSnapshot: true, trip: { select: { code: true, plan: { select: { serviceDate: true } } } }, tripRevision: { select: { planId: true, planRevisionId: true, cancelled: true } } } },
  } });
  requireCondition(c, "NOT_FOUND", "ไม่พบรายการฝากส่ง");
  return c;
}
type Loaded = Awaited<ReturnType<typeof loadForLabel>>;

/** Builds the printable content only from the frozen assignment snapshots, never from live master data. */
function buildPayload(c: Loaded, number: number, token: string, issuedBy: string, issuedAt: Date): LabelPayload {
  const a = c.currentAssignment!, recipient = a.recipientSnapshot.payload as Snapshot, sender = a.senderSnapshot.payload as Snapshot, t = a.transportSnapshot as Transport;
  return {
    schemaVersion: 1, consignmentCode: c.code, number, issuedAt: issuedAt.toISOString(), issuedBy,
    packages: c.consignmentPackage_consignmentId.map((x) => ({ id: x.id, sequence: x.sequence, total: x.total, label: `${c.code}-${x.sequence}/${x.total}` })),
    recipient: { branchCode: recipient.branch?.code ?? null, branchName: recipient.branch?.name ?? null, addressLine: recipient.branch?.addressLine ?? null, subdistrict: recipient.branch?.subdistrict ?? null, district: recipient.branch?.district ?? null, province: recipient.branch?.province ?? null, postalCode: recipient.branch?.postalCode ?? null, contactName: recipient.contact?.name ?? null, contactPhone: recipient.contact?.phone ?? null },
    sender: { warehouseName: sender.warehouse?.name ?? null, warehouseCode: sender.warehouse?.code ?? null, department: sender.department?.name ?? null, contactName: sender.contact?.name ?? null, contactPhone: sender.contact?.phone ?? null },
    transport: { tripCode: a.trip.code, serviceDate: t.serviceDate ?? a.trip.plan.serviceDate.toISOString().slice(0, 10), roundNo: t.roundNo ?? null, plate: t.plate ?? null, province: t.province ?? null, departureAt: t.departureAt ?? null },
    lookupPath: lookupPath(token),
  };
}
/** True when the branch master address or contact differs from what was frozen at assignment. */
function masterChanged(c: Loaded) {
  const s = (c.currentAssignment?.recipientSnapshot.payload ?? {}) as Snapshot, b = c.destinationBranch;
  if (!s.branch) return false;
  const usesBranchContact = !c.recipientName && !c.recipientPhone;
  return (["code", "name", "addressLine", "subdistrict", "district", "province", "postalCode"] as const).some((k) => (s.branch?.[k] ?? null) !== (b[k] ?? null)) ||
    (usesBranchContact && ((s.contact?.name ?? null) !== (b.contactName ?? null) || (s.contact?.phone ?? null) !== (b.contactPhone ?? null)));
}
async function versionsOf(tx: Transaction, consignmentId: string) {
  return tx.labelVersion.findMany({ where: { assignment: { consignmentId } }, orderBy: { number: "asc" }, include: { printEvent_labelVersionId: { orderBy: { createdAt: "asc" }, include: { actor: { select: { displayName: true } } } } } });
}

export async function issueLabel(db: PrismaClient, actorId: string, key: string, input: { consignmentId: string; expectedVersion: number }) {
  requireCondition(input && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, "label.issue", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await loadForLabel(tx, input.consignmentId, true);
    requireLabelActor(p, "label.issue", c);
    const prior = await replay<{ labelVersionId: string; number: number; version: number }>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion);
    requireCondition(ISSUABLE.includes(c.status) && c.currentAssignment, "INVALID_TRANSITION", "ออกฉลากได้หลังจัดรถและก่อนรถออกเท่านั้น");
    const plan = await tx.dailyPlan.findUnique({ where: { id: c.currentAssignment.tripRevision.planId } });
    requireCondition(plan?.publishedRevisionId === c.currentAssignment.tripRevision.planRevisionId && !c.currentAssignment.tripRevision.cancelled, "ASSIGNMENT_STALE", "รอบรถที่จัดไว้เปลี่ยนแปลงหรือถูกยกเลิกแล้ว กรุณาให้ผู้วางแผนขนส่งย้ายรอบก่อนออกฉลาก");
    const existing = await versionsOf(tx, c.id);
    // One current version per consignment: the same version is reprinted, never re-issued.
    requireCondition(!existing.some((v) => !v.revokedAt), "LABEL_EXISTS", "รายการนี้มีฉลากฉบับปัจจุบันแล้ว ให้ใช้การพิมพ์ซ้ำ");
    requireCondition(!masterChanged(c), "ADDRESS_CHANGED", "ที่อยู่หรือผู้ติดต่อของสาขาถูกแก้ไขหลังจัดรถ กรุณาให้ผู้วางแผนขนส่งกด “แก้ไขที่อยู่บนฉลาก” ก่อนออกฉลาก");
    const number = (existing.at(-1)?.number ?? 0) + 1, token = randomBytes(24).toString("base64url"), now = new Date();
    const payload = buildPayload(c, number, token, p.user.displayName, now);
    const problems = labelProblems(payload);
    if (problems.length) throw new DomainError("LABEL_INCOMPLETE", `ออกฉลากจริงไม่ได้: ${problems.join(" · ")}`, problems);
    const label = await tx.labelVersion.create({ data: { assignmentId: c.currentAssignment.id, number, lookupToken: token, payload: payload as unknown as Prisma.InputJsonObject } });
    for (const x of c.consignmentPackage_consignmentId) await tx.labelPackage.create({ data: { labelVersionId: label.id, packageId: x.id } });
    const updated = await tx.consignment.update({ where: { id: c.id }, data: { version: { increment: 1 } } });
    const result = { labelVersionId: label.id, number, version: updated.version };
    await tx.auditLog.create({ data: { actorId, action: "LABEL_ISSUED", entityType: "LabelVersion", entityId: label.id, idempotencyId: idem, after: { consignmentId: c.id, number, packages: c.consignmentPackage_consignmentId.length, replaces: existing.at(-1)?.number ?? null } } });
    return result;
  });
}

async function replacementOf(tx: Transaction, consignmentId: string) {
  const current = await tx.labelVersion.findFirst({ where: { assignment: { consignmentId }, revokedAt: null }, orderBy: { number: "desc" } });
  return current ? { labelVersionId: current.id, number: current.number } : null;
}

/** A print or reprint only appends a PrintEvent. It never creates a consignment, package or label version. */
export async function recordPrint(db: PrismaClient, actorId: string, key: string, input: { labelVersionId: string; format: string; copies: number; reason?: string }) {
  requireCondition(input && typeof input.labelVersionId === "string" && idPattern.test(input.labelVersionId) && Object.hasOwn(LABEL_FORMATS, input.format) && Number.isInteger(input.copies) && input.copies >= 1 && input.copies <= 20, "INVALID_INPUT", "รูปแบบฉลากหรือจำนวนชุดไม่ถูกต้อง");
  return guardedWrite(db, actorId, "label.print", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId);
    const label = await tx.labelVersion.findUnique({ where: { id: input.labelVersionId }, include: { assignment: { include: { consignment: true } } } });
    requireCondition(label, "NOT_FOUND", "ไม่พบฉลาก");
    requireLabelActor(p, "label.print", label.assignment.consignment);
    const prior = await replay<{ printEventId: string; reprint: boolean }>(tx, idem); if (prior) return prior;
    await tx.$queryRaw`SELECT id FROM LabelVersion WHERE id=${label.id} FOR UPDATE`;
    const fresh = await tx.labelVersion.findUniqueOrThrow({ where: { id: label.id } });
    if (fresh.revokedAt) {
      const replacement = await replacementOf(tx, label.assignment.consignmentId);
      throw new DomainError("LABEL_REVOKED", `ฉลากฉบับที่ ${fresh.number} ถูกยกเลิกแล้ว${replacement ? ` กรุณาพิมพ์ฉบับที่ ${replacement.number}` : " กรุณาออกฉลากใหม่"}`, { replacement });
    }
    const reprint = (await tx.printEvent.count({ where: { labelVersionId: label.id } })) > 0;
    const reason = reprint ? reasonText(input.reason) : input.reason?.trim() || null;
    const print = await tx.printEvent.create({ data: { labelVersionId: label.id, actorId, format: input.format, copies: input.copies, reason } });
    await tx.auditLog.create({ data: { actorId, action: reprint ? "LABEL_REPRINTED" : "LABEL_PRINTED", entityType: "LabelVersion", entityId: label.id, idempotencyId: idem, reason, after: { format: input.format, copies: input.copies, number: fresh.number } } });
    return { printEventId: print.id, reprint };
  });
}

function presentVersion(v: Awaited<ReturnType<typeof versionsOf>>[number]) {
  const payload = v.payload as unknown as LabelPayload;
  return { id: v.id, number: v.number, issuedAt: v.createdAt.toISOString(), issuedBy: payload.issuedBy ?? null, revokedAt: v.revokedAt?.toISOString() ?? null, revocationReason: v.revocationReason,
    prints: v.printEvent_labelVersionId.map((e) => ({ at: e.createdAt.toISOString(), actor: e.actor.displayName, format: e.format, copies: e.copies, reason: e.reason })) };
}

/** Label overview for a consignment: versions, print history, blockers and a sample payload. */
export async function labelOverview(db: PrismaClient, actorId: string, consignmentId: string) {
  return db.$transaction(async (tx) => {
    await requireConsignmentAccess(tx, actorId, consignmentId);
    const p = await principal(tx, actorId), c = await loadForLabel(tx, consignmentId, false);
    const allowed = (capability: string) => p.permissions.has(capability) && (p.global || p.scopes.some((s) => s.kind === "WAREHOUSE" && s.warehouseId === c.sourceWarehouseId));
    const versions = (await versionsOf(tx, c.id)).map(presentVersion), current = versions.find((v) => !v.revokedAt) ?? null;
    const sample = c.currentAssignment ? buildPayload(c, (versions.at(-1)?.number ?? 0) + 1, "sample", p.user.displayName, new Date()) : null;
    const changed = c.currentAssignment ? masterChanged(c) : false;
    return {
      consignment: { id: c.id, code: c.code, status: c.status, version: c.version, branch: `${c.destinationBranch.name} (${c.destinationBranch.code})` },
      assigned: !!c.currentAssignment, issuable: ISSUABLE.includes(c.status), masterChanged: changed, problems: sample ? labelProblems(sample) : ["ยังไม่จัดรอบรถ"], sample,
      versions, current, canIssue: allowed("label.issue"), canPrint: allowed("label.print"),
      canCorrect: p.permissions.has("consignment.assign") && p.global && ISSUABLE.includes(c.status),
    };
  }, { isolationLevel: "RepeatableRead" });
}

/** Data for the print page. Revoked versions are returned without printable content. */
export async function labelSheet(db: PrismaClient, actorId: string, labelVersionId: string) {
  requireCondition(typeof labelVersionId === "string" && idPattern.test(labelVersionId), "NOT_FOUND", "ไม่พบฉลาก");
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId);
    const label = await tx.labelVersion.findUnique({ where: { id: labelVersionId }, include: { assignment: { include: { consignment: true } }, printEvent_labelVersionId: true } });
    requireCondition(label, "NOT_FOUND", "ไม่พบฉลาก");
    requireLabelActor(p, "label.print", label.assignment.consignment);
    const revoked = !!label.revokedAt;
    return { id: label.id, number: label.number, consignmentId: label.assignment.consignmentId, consignmentCode: label.assignment.consignment.code, revoked, revocationReason: label.revocationReason,
      replacement: revoked ? await replacementOf(tx, label.assignment.consignmentId) : null, printed: label.printEvent_labelVersionId.length,
      payload: revoked ? null : label.payload as unknown as LabelPayload };
  }, { isolationLevel: "RepeatableRead" });
}

/**
 * QR lookup. The token is opaque; the viewer must be signed in and pass the consignment row policy.
 * A revoked version is rejected and the current replacement is offered to authorized users.
 */
export async function lookupLabel(db: PrismaClient, actorId: string, token: string, sequence: number | null) {
  requireCondition(typeof token === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(token), "NOT_FOUND", "ไม่พบฉลากนี้ในระบบ");
  return db.$transaction(async (tx) => {
    const label = await tx.labelVersion.findUnique({ where: { lookupToken: token }, include: { assignment: { select: { consignmentId: true } }, labelPackage_labelVersionId: { include: { package: true } } } });
    requireCondition(label, "NOT_FOUND", "ไม่พบฉลากนี้ในระบบ");
    const c = await requireConsignmentAccess(tx, actorId, label.assignment.consignmentId);
    const item = sequence ? label.labelPackage_labelVersionId.find((x) => x.package.sequence === sequence)?.package ?? null : null;
    requireCondition(!sequence || item, "NOT_FOUND", "ไม่พบหีบห่อนี้บนฉลาก");
    const revoked = !!label.revokedAt, replacement = revoked ? await replacementOf(tx, c.id) : null;
    return {
      state: revoked ? "REVOKED" as const : "CURRENT" as const, number: label.number, revokedAt: label.revokedAt?.toISOString() ?? null, revocationReason: label.revocationReason,
      replacement, consignment: { id: c.id, code: c.code, status: c.status },
      package: item ? { id: item.id, sequence: item.sequence, total: item.total, label: `${c.code}-${item.sequence}/${item.total}`, custody: item.custody } : null,
    };
  }, { isolationLevel: "RepeatableRead" });
}

/** Per-trip manifest grouped by destination stop. Quantities are totalled per unit, never across units. */
export async function tripManifest(db: PrismaClient, actorId: string, tripId: string) {
  requireCondition(typeof tripId === "string" && idPattern.test(tripId), "NOT_FOUND", "ไม่พบรอบรถ");
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId);
    requireCondition(p.permissions.has("manifest.read"), "FORBIDDEN", "คุณไม่มีสิทธิ์ดูใบคุมรถ");
    const trip = await tx.trip.findUnique({ where: { id: tripId }, include: { plan: true } });
    const revision = trip?.plan.publishedRevisionId ? await tx.tripRevision.findUnique({ where: { planRevisionId_tripId: { planRevisionId: trip.plan.publishedRevisionId, tripId } }, include: { vehicle: { include: { type: true } }, driver: true, routeRevision: { select: { name: true } }, tripStop_tripRevisionId: { orderBy: { sequence: "asc" }, include: { branch: { select: { code: true } } } } } }) : null;
    requireCondition(trip && revision, "NOT_FOUND", "ไม่พบรอบรถในแผนที่เผยแพร่");
    const warehouseIds = p.scopes.flatMap((s) => s.kind === "WAREHOUSE" && s.warehouseId ? [s.warehouseId] : []);
    const drives = !!revision.driverId && p.scopes.some((s) => s.kind === "DRIVER" && s.driverId === revision.driverId);
    // GLOBAL and the trip's driver see the whole manifest; a warehouse sees only its own consignments.
    requireCondition(p.global || drives || warehouseIds.length > 0, "NOT_FOUND", "ไม่พบรอบรถในแผนที่เผยแพร่");
    const rows = await tx.consignment.findMany({
      where: { status: { notIn: ["DRAFT", "PENDING_REVIEW", "REJECTED", "CANCELLED", "RETURNED"] }, currentAssignment: { tripId }, ...(p.global || drives ? {} : { sourceWarehouseId: { in: warehouseIds } }) },
      include: { sourceWarehouse: { select: { name: true } }, consignmentItem_consignmentId: true, consignmentPackage_consignmentId: true, currentAssignment: { include: { stop: true, recipientSnapshot: true, labelVersion_assignmentId: { where: { revokedAt: null }, select: { number: true } } } } },
      orderBy: { code: "asc" },
    });
    const groups = revision.tripStop_tripRevisionId.map((stop) => {
      const consignments = rows.filter((c) => c.currentAssignment!.stop.sequence === stop.sequence).map((c) => {
        const snapshot = c.currentAssignment!.recipientSnapshot.payload as Snapshot;
        return { id: c.id, code: c.code, status: c.status, warehouse: c.sourceWarehouse.name, packages: c.consignmentPackage_consignmentId.length, labelNumber: c.currentAssignment!.labelVersion_assignmentId[0]?.number ?? null,
          recipient: snapshot.contact?.name ?? null, items: c.consignmentItem_consignmentId.map((i) => ({ name: i.name, quantity: i.sentQuantity.toString(), unit: i.unit })) };
      });
      const unitTotals = new Map<string, Prisma.Decimal>();
      for (const c of rows.filter((r) => r.currentAssignment!.stop.sequence === stop.sequence)) for (const i of c.consignmentItem_consignmentId) unitTotals.set(i.unit, (unitTotals.get(i.unit) ?? new Prisma.Decimal(0)).plus(i.sentQuantity));
      return { sequence: stop.sequence, branchCode: stop.branch.code, name: stop.nameSnapshot, consignments, packageTotal: consignments.reduce((n, c) => n + c.packages, 0), unitTotals: [...unitTotals].map(([unit, quantity]) => ({ unit, quantity: quantity.toString() })) };
    }).filter((g) => g.consignments.length > 0);
    return {
      tripId, code: trip.code, routeName: revision.routeRevision?.name ?? null, serviceDate: trip.plan.serviceDate.toISOString().slice(0, 10), roundNo: revision.roundNo, cancelled: revision.cancelled,
      loadingAt: revision.loadingAt?.toISOString() ?? null, departureAt: revision.departureAt?.toISOString() ?? null,
      vehicle: revision.vehicle ? { plate: revision.vehicle.plateNormalized, province: revision.vehicle.province, typeName: revision.vehicle.type.name } : null,
      driverName: p.global || drives ? revision.driver?.name ?? null : null, partial: !(p.global || drives),
      groups, packageTotal: groups.reduce((n, g) => n + g.packageTotal, 0), consignmentTotal: rows.length, generatedBy: p.user.displayName,
    };
  }, { isolationLevel: "RepeatableRead", timeout: 20_000 });
}
export type Manifest = Awaited<ReturnType<typeof tripManifest>>;
export type LabelOverview = Awaited<ReturnType<typeof labelOverview>>;
