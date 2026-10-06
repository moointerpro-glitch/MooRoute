import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, type ConsignmentStatus, type PrismaClient } from "../../generated/prisma/client";
import { DomainError, requireCondition, versionMatches } from "../domain/errors";
import { serviceDate } from "../domain/planning";
import { idPattern, normalizeDraft, reasonText, requireTransition, submissionProblems, issueTypes, quantityPattern, transitionMatrix, type ActorRule, type DraftInput } from "../domain/consignment";
import { principal, requireCapability, type Principal } from "../auth/permissions";
import { consignmentScope, requireConsignmentAccess } from "../auth/resource-policy";
import { bangkokServiceDate } from "../../lib/bangkok-date";
import { ATTACHMENT_LIMITS, safeDisplayName } from "../domain/files";
export { ATTACHMENT_LIMITS, sniffContentType, safeDisplayName } from "../domain/files";
import { audit, guardedWrite, replay, type Transaction } from "./transaction";

type Result = { id: string; status: string; version: number };
const ACTIVE_LOAD = ["ASSIGNED", "WAREHOUSE_RECEIVED", "LOADED", "IN_TRANSIT", "PARTIALLY_RECEIVED", "ISSUE"] as const;

/** Proposed default (D210): consignments close at loading start, or departure when loading is unknown, minus this lead time. */
export function cutoffLeadMinutes(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.CONSIGNMENT_CUTOFF_LEAD_MINUTES ?? "0";
  const value = Number(raw);
  if (!/^\d{1,4}$/.test(raw) || value > 1440) throw new DomainError("CONFIGURATION", "การตั้งค่าเวลาปิดรับฝากส่งไม่ถูกต้อง");
  return value;
}

async function lockConsignment(tx: Transaction, id: string) {
  requireCondition(typeof id === "string" && idPattern.test(id), "NOT_FOUND", "ไม่พบรายการฝากส่ง");
  await tx.$queryRaw`SELECT id FROM Consignment WHERE id=${id} FOR UPDATE`;
  const c = await tx.consignment.findUnique({ where: { id }, include: { currentAssignment: { include: { tripRevision: true } } } });
  requireCondition(c, "NOT_FOUND", "ไม่พบรายการฝากส่ง");
  return c;
}
type Locked = Awaited<ReturnType<typeof lockConsignment>>;

function satisfies(p: Principal, actorId: string, rule: ActorRule, c: Locked) {
  if (rule === "OWN_REQUESTER") return c.requesterId === actorId;
  if (p.global) return true;
  if (rule === "SOURCE_WAREHOUSE") return p.scopes.some((s) => s.kind === "WAREHOUSE" && s.warehouseId === c.sourceWarehouseId);
  if (rule === "DESTINATION_BRANCH") return p.scopes.some((s) => s.kind === "BRANCH" && s.branchId === c.destinationBranchId);
  if (rule === "TRIP_DRIVER") return !!c.currentAssignment?.tripRevision.driverId && p.scopes.some((s) => s.kind === "DRIVER" && s.driverId === c.currentAssignment!.tripRevision.driverId);
  return false;
}
/** Every mutation re-resolves capability and row scope inside its transaction, including idempotent replays. */
function requireActor(p: Principal, actorId: string, action: string, c: Locked) {
  const ok = transitionMatrix[action].actors.some((a) => p.permissions.has(a.capability) && satisfies(p, actorId, a.scope, c));
  // Out-of-scope rows look missing to avoid disclosing their existence.
  if (!ok && c.status === "DRAFT" && c.requesterId !== actorId) throw new DomainError("NOT_FOUND", "ไม่พบรายการฝากส่ง");
  requireCondition(ok, "FORBIDDEN", "คุณไม่มีสิทธิ์ดำเนินการกับรายการฝากส่งนี้");
}
async function bump(tx: Transaction, id: string, data: Prisma.ConsignmentUpdateInput) {
  return tx.consignment.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
}
async function event(tx: Transaction, consignmentId: string, actorId: string, kind: Prisma.ConsignmentEventCreateInput["kind"], idem: string, payload: Prisma.InputJsonObject, compensatesEventId?: string) {
  return tx.consignmentEvent.create({ data: { consignmentId, actorId, kind, occurredAt: new Date(), idempotencyId: idem, compensatesEventId, payload: { schemaVersion: 1, ...payload } } });
}
const ok = (c: { id: string; status: string; version: number }): Result => ({ id: c.id, status: c.status, version: c.version });
const idList = (value: unknown, max = 500) => {
  requireCondition(Array.isArray(value) && value.length <= max && value.every((v) => typeof v === "string" && idPattern.test(v)) && new Set(value).size === value.length, "INVALID_INPUT", "รายการหีบห่อไม่ถูกต้อง");
  return value as string[];
};

// ---------------------------------------------------------------- drafts and submission

function consignmentCode(now = new Date()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", bytes = randomBytes(6);
  // Buddhist-era date keeps the visible identifier consistent with Thai date display.
  const [y, m, d] = bangkokServiceDate(now).split("-");
  return `FS-${Number(y) + 543}${m}${d}-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}
async function validateReferences(tx: Transaction, p: Principal, d: DraftInput) {
  requireCondition(p.global || p.scopes.some((s) => s.kind === "DEPARTMENT" && s.departmentId === d.departmentId), "FORBIDDEN", "คุณสร้างคำขอได้เฉพาะแผนกในขอบเขตของคุณ");
  requireCondition((await tx.department.findUnique({ where: { id: d.departmentId } }))?.active, "INACTIVE_REFERENCE", "แผนกไม่พร้อมใช้งาน");
  requireCondition((await tx.warehouse.findUnique({ where: { id: d.sourceWarehouseId } }))?.active, "INACTIVE_REFERENCE", "คลังต้นทางไม่พร้อมใช้งาน");
  const branch = await tx.branch.findUnique({ where: { id: d.destinationBranchId } });
  requireCondition(branch && !branch.archived && branch.destinationType === "BRANCH", "INACTIVE_REFERENCE", "สาขาปลายทางไม่พร้อมใช้งาน");
  const categories = [...new Set(d.items.map((i) => i.categoryId))];
  requireCondition((await tx.consignmentCategory.count({ where: { id: { in: categories }, active: true } })) === categories.length, "INACTIVE_REFERENCE", "หมวดสิ่งของบางรายการไม่พร้อมใช้งาน");
  return branch;
}
function draftData(d: DraftInput) {
  return {
    departmentId: d.departmentId, sourceWarehouseId: d.sourceWarehouseId, destinationBranchId: d.destinationBranchId, receiptMode: d.receiptMode,
    requestedServiceDate: d.requestedServiceDate ? serviceDate(d.requestedServiceDate) : null, requestedRoundNo: d.requestedRoundNo, requestedTripId: d.requestedTripId,
    senderName: d.senderName, senderPhone: d.senderPhone, recipientName: d.recipientName, recipientPhone: d.recipientPhone, notes: d.notes,
    packageCount: d.packageCount, packageWeight: d.packageWeight, packageWeightUnit: d.packageWeightUnit,
    draftItems: { schemaVersion: 1, items: d.items.map((i) => ({ ...i })) },
  };
}

export async function saveConsignmentDraft(db: PrismaClient, actorId: string, key: string, raw: DraftInput): Promise<Result & { code: string }> {
  const d = normalizeDraft(raw);
  return guardedWrite(db, actorId, "consignment.draft", key, d, async (tx, idem) => {
    const p = await principal(tx, actorId); requireCapability(p, "consignment.create");
    let existing: Locked | null = null;
    if (d.id) { existing = await lockConsignment(tx, d.id); requireActor(p, actorId, "saveDraft", existing); }
    const prior = await replay<Result & { code: string }>(tx, idem); if (prior) return prior;
    await validateReferences(tx, p, d);
    if (existing) {
      versionMatches(existing.version, d.expectedVersion); requireTransition("saveDraft", existing.status);
      const updated = await bump(tx, existing.id, draftData(d));
      await audit(tx, actorId, "CONSIGNMENT_DRAFT_SAVED", "Consignment", existing.id, idem, { version: updated.version });
      return { ...ok(updated), code: updated.code };
    }
    versionMatches(0, d.expectedVersion);
    const created = await tx.consignment.create({ data: { id: randomUUID(), code: consignmentCode(), requesterId: actorId, ...draftData(d) } });
    await audit(tx, actorId, "CONSIGNMENT_DRAFT_CREATED", "Consignment", created.id, idem, { code: created.code });
    return { ...ok(created), code: created.code };
  });
}

type DraftItems = { items: DraftInput["items"] };
export async function submitConsignment(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number }) {
  requireCondition(input && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, "consignment.submit", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "submit", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("submit", c.status);
    const items = ((c.draftItems ?? { items: [] }) as unknown as DraftItems).items ?? [];
    const draft = normalizeDraft({ id: c.id, expectedVersion: c.version, departmentId: c.departmentId, sourceWarehouseId: c.sourceWarehouseId, destinationBranchId: c.destinationBranchId,
      requestedServiceDate: c.requestedServiceDate?.toISOString().slice(0, 10) ?? null, requestedRoundNo: c.requestedRoundNo, requestedTripId: c.requestedTripId,
      senderName: c.senderName, senderPhone: c.senderPhone, recipientName: c.recipientName, recipientPhone: c.recipientPhone, notes: c.notes, receiptMode: c.receiptMode,
      packageCount: c.packageCount, packageWeight: c.packageWeight?.toString() ?? null, packageWeightUnit: c.packageWeightUnit, items });
    const branch = await validateReferences(tx, p, draft);
    const recipientKnown = !!((draft.recipientName || branch.contactName) && (draft.recipientPhone || branch.contactPhone));
    const problems = submissionProblems(draft, bangkokServiceDate(), recipientKnown);
    if (draft.requestedServiceDate) {
      const date = serviceDate(draft.requestedServiceDate);
      if (branch.activeFrom > date || (branch.activeTo && branch.activeTo < date)) problems.push("สาขาปลายทางไม่เปิดให้บริการในวันที่ต้องการส่ง");
    }
    if (draft.requestedTripId) {
      const check = await tripEligibility(tx, c, draft.requestedTripId, null, new Date());
      if (!check.eligible) problems.push(`รอบรถที่เลือกใช้ไม่ได้: ${check.reasons.join(" ")}`);
      else if (draft.requestedServiceDate && check.serviceDate !== draft.requestedServiceDate) problems.push("รอบรถที่เลือกไม่ตรงกับวันที่ต้องการส่ง");
    }
    if (problems.length) throw new DomainError("SUBMISSION_INCOMPLETE", problems.join(" · "), problems);
    // Items and packages are materialized while still DRAFT; database triggers freeze them afterwards.
    for (const item of draft.items) await tx.consignmentItem.create({ data: { consignmentId: c.id, categoryId: item.categoryId, name: item.name, sentQuantity: item.quantity, unit: item.unit } });
    for (let sequence = 1; sequence <= draft.packageCount; sequence++) {
      await tx.consignmentPackage.create({ data: { consignmentId: c.id, sequence, total: draft.packageCount, weight: draft.packageWeight, weightUnit: draft.packageWeightUnit, custody: "SENDER" } });
    }
    const updated = await bump(tx, c.id, { status: "PENDING_REVIEW", submittedAt: new Date() });
    await event(tx, c.id, actorId, "SUBMITTED", idem, { receiptMode: c.receiptMode, items: draft.items.length, packages: draft.packageCount });
    await audit(tx, actorId, "CONSIGNMENT_SUBMITTED", "Consignment", c.id, idem, ok(updated));
    return ok(updated);
  });
}

// ---------------------------------------------------------------- trip eligibility and assignment

export async function tripEligibility(tx: Transaction, c: { id: string; destinationBranchId: string; packageCount: number; packageWeight: Prisma.Decimal | null; packageWeightUnit: string | null }, tripId: string, stopSequence: number | null, now: Date) {
  const reasons: string[] = [];
  const trip = idPattern.test(tripId) ? await tx.trip.findUnique({ where: { id: tripId }, include: { plan: true } }) : null;
  const revision = trip?.plan.publishedRevisionId ? await tx.tripRevision.findUnique({ where: { planRevisionId_tripId: { planRevisionId: trip.plan.publishedRevisionId, tripId } }, include: { vehicle: true, tripStop_tripRevisionId: { orderBy: { sequence: "asc" } } } }) : null;
  if (!trip || !revision) return { eligible: false, reasons: ["ไม่พบรอบรถในแผนที่เผยแพร่"], revision: null, stop: null, serviceDate: null, capacity: null, cutoff: null };
  if (revision.cancelled) reasons.push("รอบรถนี้ถูกยกเลิกแล้ว");
  if (revision.kind !== "BRANCH_DELIVERY") reasons.push("ฝากของได้เฉพาะรอบส่งสินค้าสาขา");
  const stop = revision.tripStop_tripRevisionId.find((s) => s.branchId === c.destinationBranchId && (stopSequence === null || s.sequence === stopSequence)) ?? null;
  if (!stop) reasons.push("รอบรถนี้ไม่ได้แวะส่งสาขาปลายทาง");
  const base = revision.loadingAt ?? revision.departureAt;
  const cutoff = base ? new Date(base.valueOf() - cutoffLeadMinutes() * 60_000) : null;
  if (!cutoff) reasons.push("รอบรถนี้ยังไม่ระบุเวลาขึ้นของหรือเวลาออกรถ");
  else if (now >= cutoff) reasons.push("เลยเวลาปิดรับฝากของสำหรับรอบนี้แล้ว");
  // Capacity is enforced only with a known capacity and the same unit; otherwise it is reported as unknown.
  let capacity: { known: boolean; capacity: string | null; unit: string | null; used: string | null } = { known: false, capacity: null, unit: null, used: null };
  const v = revision.vehicle;
  if (v?.capacity && v.capacityUnit && c.packageWeight && c.packageWeightUnit) {
    if (c.packageWeightUnit !== v.capacityUnit) reasons.push("หน่วยน้ำหนักหีบห่อไม่ตรงกับหน่วยความจุรถ");
    else {
      const others = await tx.consignment.findMany({ where: { id: { not: c.id }, status: { in: [...ACTIVE_LOAD] }, currentAssignment: { tripId }, packageWeightUnit: v.capacityUnit } });
      let used = revision.plannedLoad && revision.loadUnit === v.capacityUnit ? new Prisma.Decimal(revision.plannedLoad) : new Prisma.Decimal(0);
      for (const o of others) used = used.plus(new Prisma.Decimal(o.packageWeight!).times(o.packageCount));
      const total = used.plus(new Prisma.Decimal(c.packageWeight).times(c.packageCount));
      capacity = { known: true, capacity: v.capacity.toString(), unit: v.capacityUnit, used: total.toString() };
      if (total.gt(v.capacity)) reasons.push("น้ำหนักรวมเกินความจุรถ");
    }
  }
  return { eligible: reasons.length === 0, reasons, revision, stop, serviceDate: trip.plan.serviceDate.toISOString().slice(0, 10), capacity, cutoff: cutoff?.toISOString() ?? null };
}

async function lockPlansForTrips(tx: Transaction, tripIds: string[]) {
  // Lock order shared with publication: daily plan(s) before consignments.
  const plans = await tx.trip.findMany({ where: { id: { in: tripIds } }, select: { planId: true } });
  for (const id of [...new Set(plans.map((p) => p.planId))].sort()) await tx.$queryRaw`SELECT id FROM DailyPlan WHERE id=${id} FOR UPDATE`;
}
async function snapshots(tx: Transaction, actorId: string, c: Locked) {
  const [warehouse, department, requester, branch] = await Promise.all([
    tx.warehouse.findUniqueOrThrow({ where: { id: c.sourceWarehouseId } }), tx.department.findUniqueOrThrow({ where: { id: c.departmentId } }),
    tx.user.findUniqueOrThrow({ where: { id: c.requesterId } }), tx.branch.findUniqueOrThrow({ where: { id: c.destinationBranchId } }),
  ]);
  const sender = await tx.addressSnapshot.create({ data: { createdById: actorId, payload: { schemaVersion: 1, kind: "SENDER", warehouse: { code: warehouse.code, name: warehouse.name, address: warehouse.address }, department: { code: department.code, name: department.name }, requester: requester.displayName, contact: { name: c.senderName, phone: c.senderPhone } } } });
  const recipient = await tx.addressSnapshot.create({ data: { createdById: actorId, branchId: branch.id, payload: { schemaVersion: 1, kind: "RECIPIENT", branch: { code: branch.code, name: branch.name, addressLine: branch.addressLine, subdistrict: branch.subdistrict, district: branch.district, province: branch.province, postalCode: branch.postalCode }, contact: { name: c.recipientName ?? branch.contactName, phone: c.recipientPhone ?? branch.contactPhone } } } });
  return { sender, recipient };
}
function transportSnapshot(revision: NonNullable<Awaited<ReturnType<typeof tripEligibility>>["revision"]>, stop: { sequence: number }, date: string | null) {
  return { schemaVersion: 1, tripId: revision.tripId, tripRevisionId: revision.id, serviceDate: date, roundNo: revision.roundNo, vehicleId: revision.vehicleId, plate: revision.vehicle?.plateNormalized ?? null, province: revision.vehicle?.province ?? null, driverId: revision.driverId, loadingAt: revision.loadingAt?.toISOString() ?? null, departureAt: revision.departureAt?.toISOString() ?? null, stopSequence: stop.sequence };
}

type AssignInput = { id: string; expectedVersion: number; tripId: string; stopSequence?: number | null; reason?: string };
function assignInput(input: AssignInput) {
  requireCondition(input && Number.isInteger(input.expectedVersion) && typeof input.tripId === "string" && idPattern.test(input.tripId) && (input.stopSequence == null || (Number.isInteger(input.stopSequence) && input.stopSequence > 0)), "INVALID_INPUT", "กรุณาเลือกรอบรถให้ถูกต้อง");
}
export async function assignConsignment(db: PrismaClient, actorId: string, key: string, input: AssignInput) {
  assignInput(input);
  return guardedWrite(db, actorId, "consignment.assign", key, input, async (tx, idem) => {
    await lockPlansForTrips(tx, [input.tripId]);
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "assign", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("assign", c.status);
    const check = await tripEligibility(tx, c, input.tripId, input.stopSequence ?? null, new Date());
    if (!check.eligible) throw new DomainError("INELIGIBLE_TRIP", check.reasons.join(" · "), check.reasons);
    const { sender, recipient } = await snapshots(tx, actorId, c);
    const assignment = await tx.consignmentAssignment.create({ data: { consignmentId: c.id, tripId: input.tripId, tripRevisionId: check.revision!.id, stopId: check.stop!.id, senderSnapshotId: sender.id, recipientSnapshotId: recipient.id, transportSnapshot: transportSnapshot(check.revision!, check.stop!, check.serviceDate), reason: input.reason?.trim() || "จัดรถตามคำขอ", approvedById: actorId, approvedAt: new Date() } });
    const updated = await bump(tx, c.id, { status: "ASSIGNED", currentAssignment: { connect: { id_consignmentId: { id: assignment.id, consignmentId: c.id } } } });
    await event(tx, c.id, actorId, "ASSIGNED", idem, { assignmentId: assignment.id, tripId: input.tripId, stopSequence: check.stop!.sequence, capacity: check.capacity });
    await audit(tx, actorId, "CONSIGNMENT_ASSIGNED", "Consignment", c.id, idem, { ...ok(updated), assignmentId: assignment.id });
    return ok(updated);
  });
}

/** Pre-loading evidence check shared with plan publication: nothing loaded, departed or received. */
async function requireNotInMotion(tx: Transaction, c: Locked) {
  const packages = await tx.consignmentPackage.findMany({ where: { consignmentId: c.id } });
  const moved = await tx.consignmentEvent.count({ where: { consignmentId: c.id, kind: { in: ["LOADED", "DEPARTED", "RECEIPT"] } } });
  requireCondition(packages.every((x) => ["SENDER", "WAREHOUSE"].includes(x.custody)) && moved === 0, "CONSIGNMENT_IN_MOTION", "ของขึ้นรถหรือมีการรับแล้ว ไม่สามารถย้ายหรือยกเลิกได้ กรุณาใช้การแจ้งปัญหาและส่งคืน");
}
export async function reassignConsignment(db: PrismaClient, actorId: string, key: string, input: AssignInput) {
  assignInput(input); const reason = reasonText(input.reason);
  return guardedWrite(db, actorId, "consignment.reassign", key, input, async (tx, idem) => {
    const current = await tx.consignment.findUnique({ where: { id: input.id }, include: { currentAssignment: true } });
    await lockPlansForTrips(tx, [input.tripId, ...(current?.currentAssignment ? [current.currentAssignment.tripId] : [])]);
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "reassign", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("reassign", c.status);
    await requireNotInMotion(tx, c);
    const previous = c.currentAssignment!;
    requireCondition(previous.tripId !== input.tripId || (input.stopSequence != null), "INVALID_ASSIGNMENT", "กรุณาเลือกรอบรถใหม่ที่ต่างจากเดิม");
    const check = await tripEligibility(tx, c, input.tripId, input.stopSequence ?? null, new Date());
    if (!check.eligible) throw new DomainError("INELIGIBLE_TRIP", check.reasons.join(" · "), check.reasons);
    // Address/contact snapshots are re-frozen so a new label version would reflect current master data.
    const { sender, recipient } = await snapshots(tx, actorId, c);
    const assignment = await tx.consignmentAssignment.create({ data: { consignmentId: c.id, tripId: input.tripId, tripRevisionId: check.revision!.id, stopId: check.stop!.id, senderSnapshotId: sender.id, recipientSnapshotId: recipient.id, previousAssignmentId: previous.id, transportSnapshot: transportSnapshot(check.revision!, check.stop!, check.serviceDate), reason, approvedById: actorId, approvedAt: new Date() } });
    const revoked = await tx.labelVersion.updateMany({ where: { assignmentId: previous.id, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: reason } });
    const updated = await bump(tx, c.id, { currentAssignment: { connect: { id_consignmentId: { id: assignment.id, consignmentId: c.id } } } });
    await event(tx, c.id, actorId, "ASSIGNED", idem, { previousAssignmentId: previous.id, assignmentId: assignment.id, tripId: input.tripId, reason, labelsRevoked: revoked.count });
    await tx.auditLog.create({ data: { actorId, action: "CONSIGNMENT_REASSIGNED", entityType: "Consignment", entityId: c.id, idempotencyId: idem, reason, before: { assignmentId: previous.id, version: c.version }, after: { assignmentId: assignment.id, version: updated.version } } });
    return ok(updated);
  });
}

export async function rejectConsignment(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; reason: string }) {
  const reason = reasonText(input?.reason);
  return guardedWrite(db, actorId, "consignment.reject", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "reject", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("reject", c.status);
    const updated = await bump(tx, c.id, { status: "REJECTED" });
    await event(tx, c.id, actorId, "REJECTED", idem, { reason });
    await tx.auditLog.create({ data: { actorId, action: "CONSIGNMENT_REJECTED", entityType: "Consignment", entityId: c.id, idempotencyId: idem, reason, after: ok(updated) } });
    return ok(updated);
  });
}

export async function cancelConsignment(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; reason: string }) {
  const reason = reasonText(input?.reason);
  return guardedWrite(db, actorId, "consignment.cancel", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id);
    const action = ["DRAFT", "PENDING_REVIEW"].includes(c.status) ? "cancelRequest" : "cancelAssigned";
    requireActor(p, actorId, action, c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition(action, c.status);
    let labelsRevoked = 0;
    if (action === "cancelAssigned") {
      await requireNotInMotion(tx, c);
      // The assignment chain stays as history; only its labels stop being valid. Package custody is retained.
      labelsRevoked = (await tx.labelVersion.updateMany({ where: { assignmentId: c.currentAssignmentId!, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: reason } })).count;
    }
    const updated = await bump(tx, c.id, { status: "CANCELLED", closedAt: new Date() });
    await event(tx, c.id, actorId, "CANCELLED", idem, { reason, previousStatus: c.status, labelsRevoked });
    await tx.auditLog.create({ data: { actorId, action: "CONSIGNMENT_CANCELLED", entityType: "Consignment", entityId: c.id, idempotencyId: idem, reason, before: { status: c.status, version: c.version }, after: ok(updated) } });
    return ok(updated);
  });
}

// ---------------------------------------------------------------- warehouse, loading and departure

async function packageHandover(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; packageIds: string[] }, action: "warehouseReceive" | "load") {
  const packageIds = idList(input?.packageIds);
  const spec = action === "warehouseReceive" ? { from: "SENDER", to: "WAREHOUSE", status: "WAREHOUSE_RECEIVED", kind: "WAREHOUSE_RECEIVED" } as const : { from: "WAREHOUSE", to: "VEHICLE", status: "LOADED", kind: "LOADED" } as const;
  return guardedWrite(db, actorId, `consignment.${action}`, key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, action, c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition(action, c.status);
    const packages = await tx.consignmentPackage.findMany({ where: { consignmentId: c.id }, orderBy: { sequence: "asc" } });
    // Explicit handover of every stable package ID; a partial handover is reported as an issue instead.
    requireCondition(packages.length === packageIds.length && packages.every((x) => packageIds.includes(x.id) && x.custody === spec.from), "PACKAGE_HANDOVER", `กรุณาตรวจและยืนยันหีบห่อครบทั้ง ${packages.length} หีบห่อ หากขาดให้แจ้งปัญหา`);
    if (action === "load") {
      const plan = await tx.dailyPlan.findUnique({ where: { id: c.currentAssignment!.tripRevision.planId } });
      requireCondition(plan?.publishedRevisionId === c.currentAssignment!.tripRevision.planRevisionId && !c.currentAssignment!.tripRevision.cancelled, "ASSIGNMENT_STALE", "รอบรถที่จัดไว้เปลี่ยนแปลงหรือถูกยกเลิกแล้ว กรุณาให้ผู้จัดรถย้ายรอบก่อนขึ้นรถ");
    }
    for (const x of packages) await tx.consignmentPackage.update({ where: { id: x.id }, data: { custody: spec.to } });
    const updated = await bump(tx, c.id, { status: spec.status });
    await event(tx, c.id, actorId, spec.kind, idem, { packageIds, assignmentId: c.currentAssignmentId });
    await audit(tx, actorId, `CONSIGNMENT_${spec.kind}`, "Consignment", c.id, idem, ok(updated));
    return ok(updated);
  });
}
export const warehouseReceiveConsignment = (db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; packageIds: string[] }) => packageHandover(db, actorId, key, input, "warehouseReceive");
export const loadConsignment = (db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; packageIds: string[] }) => packageHandover(db, actorId, key, input, "load");

/** Records departure for every loaded consignment on the trip that this actor may move. */
export async function departTrip(db: PrismaClient, actorId: string, key: string, input: { tripId: string }) {
  requireCondition(input && typeof input.tripId === "string" && idPattern.test(input.tripId), "INVALID_INPUT", "รอบรถไม่ถูกต้อง");
  return guardedWrite(db, actorId, "consignment.depart", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId);
    requireCondition(p.permissions.has("trip.move") || p.permissions.has("consignment.load"), "FORBIDDEN", "คุณไม่มีสิทธิ์บันทึกรถออก");
    const prior = await replay<{ tripId: string; departed: string[] }>(tx, idem); if (prior) return prior;
    const candidates = await tx.consignment.findMany({ where: { status: "LOADED", currentAssignment: { tripId: input.tripId } }, select: { id: true }, orderBy: { id: "asc" } });
    const departed: string[] = [];
    for (const { id } of candidates) {
      const c = await lockConsignment(tx, id);
      if (c.status !== "LOADED" || c.currentAssignment?.tripId !== input.tripId) continue;
      if (!transitionMatrix.depart.actors.some((a) => p.permissions.has(a.capability) && satisfies(p, actorId, a.scope, c))) continue;
      await bump(tx, c.id, { status: "IN_TRANSIT" });
      await event(tx, c.id, actorId, "DEPARTED", idem, { tripId: input.tripId, tripRevisionId: c.currentAssignment.tripRevisionId });
      departed.push(c.id);
    }
    requireCondition(departed.length, "NOTHING_TO_DEPART", "ไม่มีรายการที่ขึ้นรถแล้วในรอบนี้ซึ่งคุณมีสิทธิ์บันทึกรถออก");
    const result = { tripId: input.tripId, departed };
    await audit(tx, actorId, "TRIP_DEPARTED", "Trip", input.tripId, idem, result);
    return result;
  });
}

// ---------------------------------------------------------------- issues, returns and close

export async function balances(tx: Transaction, consignmentId: string) {
  const [items, packages, receipts, returns] = await Promise.all([
    tx.consignmentItem.findMany({ where: { consignmentId }, orderBy: { createdAt: "asc" } }), tx.consignmentPackage.findMany({ where: { consignmentId }, orderBy: { sequence: "asc" } }),
    tx.receiptLine.findMany({ where: { consignmentId } }), tx.returnLine.findMany({ where: { consignmentId } }),
  ]);
  const sum = (lines: { itemId: string | null; quantity: Prisma.Decimal }[], id: string) => lines.filter((l) => l.itemId === id).reduce((a, l) => a.plus(l.quantity), new Prisma.Decimal(0));
  const receivedPackages = new Set(receipts.flatMap((l) => l.packageId ? [l.packageId] : [])), returnedPackages = new Set(returns.flatMap((l) => l.packageId ? [l.packageId] : []));
  const itemRows = items.map((i) => ({ ...i, received: sum(receipts, i.id), returned: sum(returns, i.id) }));
  return {
    items: itemRows, packages, receivedPackages, returnedPackages, anyReceipt: receipts.length > 0,
    allReceived: packages.length > 0 && packages.every((x) => receivedPackages.has(x.id)),
    itemsReceived: itemRows.every((i) => i.received.eq(i.sentQuantity)),
    accounted: packages.every((x) => receivedPackages.has(x.id) || returnedPackages.has(x.id)) && itemRows.every((i) => i.received.plus(i.returned).eq(i.sentQuantity)),
  };
}
export type Balances = Awaited<ReturnType<typeof balances>>;
/** Movement status implied by receipts; used after issue resolution and returns. */
export function receiptStatus(c: { receiptMode: string }, b: Balances, fallback: string) {
  if (b.allReceived && (c.receiptMode === "PACKAGES" || b.itemsReceived)) return "RECEIVED";
  return b.anyReceipt ? "PARTIALLY_RECEIVED" : fallback;
}

export async function reportIssue(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; type: string; description: string; packageIds?: string[] }) {
  requireCondition(input && typeof input.type === "string" && input.type in issueTypes, "INVALID_INPUT", "กรุณาเลือกประเภทปัญหา");
  const description = reasonText(input.description), packageIds = idList(input.packageIds ?? []);
  return guardedWrite(db, actorId, "consignment.issue", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "reportIssue", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("reportIssue", c.status);
    const packages = await tx.consignmentPackage.findMany({ where: { consignmentId: c.id } });
    requireCondition(packageIds.every((id) => packages.some((x) => x.id === id)), "INVALID_INPUT", "หีบห่อที่ระบุไม่อยู่ในรายการนี้");
    // The movement state is preserved so recovery returns to an unambiguous state.
    const updated = await bump(tx, c.id, { status: "ISSUE", resumeStatus: c.status, hasOpenIssue: true });
    await event(tx, c.id, actorId, "ISSUE", idem, { type: input.type, description, packageIds, resumeStatus: c.status });
    await audit(tx, actorId, "CONSIGNMENT_ISSUE", "Consignment", c.id, idem, ok(updated));
    return ok(updated);
  });
}

export async function resolveIssue(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; reason: string }) {
  const reason = reasonText(input?.reason);
  return guardedWrite(db, actorId, "consignment.resolve", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "resolveIssue", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("resolveIssue", c.status);
    const issue = await tx.consignmentEvent.findFirst({ where: { consignmentId: c.id, kind: "ISSUE" }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }] });
    const b = await balances(tx, c.id);
    const status = receiptStatus(c, b, c.resumeStatus ?? "IN_TRANSIT");
    const updated = await bump(tx, c.id, { status: status as ConsignmentStatus, resumeStatus: null, hasOpenIssue: false });
    await event(tx, c.id, actorId, "ISSUE_RESOLVED", idem, { reason, status }, issue?.id);
    await tx.auditLog.create({ data: { actorId, action: "CONSIGNMENT_ISSUE_RESOLVED", entityType: "Consignment", entityId: c.id, idempotencyId: idem, reason, before: { status: c.status, resumeStatus: c.resumeStatus }, after: ok(updated) } });
    return ok(updated);
  });
}

export async function recordReturn(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number; reason: string; packageIds?: string[]; items?: { itemId: string; quantity: string }[] }) {
  const reason = reasonText(input?.reason), packageIds = idList(input.packageIds ?? []), items = input.items ?? [];
  requireCondition(Array.isArray(items) && items.length <= 50 && items.every((i) => i && idPattern.test(i.itemId) && typeof i.quantity === "string" && quantityPattern.test(i.quantity) && Number(i.quantity) > 0) && new Set(items.map((i) => i.itemId)).size === items.length, "INVALID_QUANTITY", "จำนวนส่งคืนไม่ถูกต้อง");
  requireCondition(packageIds.length + items.length > 0, "INVALID_INPUT", "กรุณาเลือกหีบห่อหรือรายการที่ส่งคืน");
  return guardedWrite(db, actorId, "consignment.return", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "recordReturn", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("recordReturn", c.status);
    const b = await balances(tx, c.id);
    for (const id of packageIds) {
      const x = b.packages.find((pk) => pk.id === id);
      // Only undelivered packages can be returned to the source; received packages stay in the receipt ledger.
      requireCondition(x && ["WAREHOUSE", "VEHICLE", "SENDER"].includes(x.custody) && !b.receivedPackages.has(id) && !b.returnedPackages.has(id), "RETURN_PACKAGE", "ส่งคืนได้เฉพาะหีบห่อที่ยังไม่ได้รับและยังไม่ส่งคืน");
    }
    for (const line of items) {
      const item = b.items.find((i) => i.id === line.itemId);
      requireCondition(item, "RETURN_ITEM", "ไม่พบรายการสิ่งของที่ส่งคืน");
      requireCondition(item.received.plus(item.returned).plus(line.quantity).lte(item.sentQuantity), "RETURN_EXCEEDS_SENT", "จำนวนส่งคืนเกินจำนวนที่ยังไม่ได้รับ");
    }
    const ev = await event(tx, c.id, actorId, "RETURNED", idem, { reason, packageIds, items });
    for (const id of packageIds) {
      await tx.returnLine.create({ data: { eventId: ev.id, consignmentId: c.id, packageId: id, quantity: "1", unit: "PACKAGE", note: reason } });
      await tx.consignmentPackage.update({ where: { id }, data: { custody: "RETURNED" } });
    }
    for (const line of items) await tx.returnLine.create({ data: { eventId: ev.id, consignmentId: c.id, itemId: line.itemId, quantity: line.quantity, unit: b.items.find((i) => i.id === line.itemId)!.unit, note: reason } });
    const after = await balances(tx, c.id);
    const allReturned = after.packages.every((x) => after.returnedPackages.has(x.id));
    const updated = await bump(tx, c.id, allReturned ? { status: "RETURNED", resumeStatus: null, hasOpenIssue: false, closedAt: new Date() } : {});
    await tx.auditLog.create({ data: { actorId, action: "CONSIGNMENT_RETURNED", entityType: "Consignment", entityId: c.id, idempotencyId: idem, reason, after: { ...ok(updated), packageIds, items } } });
    return ok(updated);
  });
}

export async function closeConsignment(db: PrismaClient, actorId: string, key: string, input: { id: string; expectedVersion: number }) {
  requireCondition(input && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, "consignment.close", key, input, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.id); requireActor(p, actorId, "close", c);
    const prior = await replay<Result>(tx, idem); if (prior) return prior;
    versionMatches(c.version, input.expectedVersion); requireTransition("close", c.status);
    const b = await balances(tx, c.id);
    requireCondition(!c.hasOpenIssue, "OPEN_ISSUE", "ยังมีปัญหาที่ไม่ได้ปิด");
    requireCondition(c.receiptMode === "PACKAGES" ? b.packages.every((x) => b.receivedPackages.has(x.id) || b.returnedPackages.has(x.id)) : b.accounted, "RECEIPT_INCOMPLETE", "ยังรับของหรือบันทึกส่งคืนไม่ครบ จึงปิดงานไม่ได้");
    const updated = await bump(tx, c.id, { status: "CLOSED", closedAt: new Date() });
    await event(tx, c.id, actorId, "CLOSED", idem, { returnedPackages: b.returnedPackages.size });
    await audit(tx, actorId, "CONSIGNMENT_CLOSED", "Consignment", c.id, idem, ok(updated));
    return ok(updated);
  });
}

// ---------------------------------------------------------------- reads

export async function consignmentFormOptions(db: PrismaClient, actorId: string) {
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId); requireCapability(p, "consignment.create");
    const departmentIds = p.scopes.flatMap((s) => s.kind === "DEPARTMENT" && s.departmentId ? [s.departmentId] : []);
    return {
      departments: await tx.department.findMany({ where: { active: true, ...(p.global ? {} : { id: { in: departmentIds } }) }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      warehouses: await tx.warehouse.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      categories: await tx.consignmentCategory.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      branches: await tx.branch.findMany({ where: { archived: false, destinationType: "BRANCH" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, contactName: true, contactPhone: true } }),
      senderName: p.user.displayName,
    };
  }, { isolationLevel: "RepeatableRead" });
}

export interface HistoryFilter { query: string; status: string[]; branchId: string | null; categoryId: string | null; date: string | null; tripCode: string | null; mine: boolean; page: number }
export async function listConsignments(db: PrismaClient, actorId: string, f: HistoryFilter, options: { export?: boolean } = {}) {
  requireCondition(typeof f.query === "string" && f.query.length <= 100 && Number.isInteger(f.page) && f.page >= 1 && f.page <= 10_000 && Array.isArray(f.status) && f.status.length <= 13 && f.status.every((s) => s in statusSet) && (f.branchId === null || idPattern.test(f.branchId)) && (f.categoryId === null || idPattern.test(f.categoryId)) && (f.tripCode === null || (typeof f.tripCode === "string" && f.tripCode.length <= 64)), "INVALID_SEARCH", "ตัวกรองไม่ถูกต้อง");
  if (f.date) serviceDate(f.date);
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId); requireCapability(p, "consignment.read");
    const scope = await consignmentScope(tx, p, actorId);
    const parts: Prisma.Sql[] = [scope.sql()];
    if (f.query) { const like = `%${f.query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`; parts.push(Prisma.sql`(c.code LIKE ${like} OR EXISTS (SELECT 1 FROM ConsignmentItem qi WHERE qi.consignmentId=c.id AND qi.name LIKE ${like}))`); }
    if (f.status.length) parts.push(Prisma.sql`c.status IN (${Prisma.join(f.status)})`);
    if (f.branchId) parts.push(Prisma.sql`c.destinationBranchId=${f.branchId}`);
    if (f.categoryId) parts.push(Prisma.sql`EXISTS (SELECT 1 FROM ConsignmentItem ci WHERE ci.consignmentId=c.id AND ci.categoryId=${f.categoryId})`);
    if (f.date) parts.push(Prisma.sql`(c.requestedServiceDate=${serviceDate(f.date)} OR EXISTS (SELECT 1 FROM ConsignmentAssignment da JOIN Trip dt ON dt.id=da.tripId JOIN DailyPlan dp ON dp.id=dt.planId WHERE da.id=c.currentAssignmentId AND dp.serviceDate=${serviceDate(f.date)}))`);
    if (f.tripCode) parts.push(Prisma.sql`EXISTS (SELECT 1 FROM ConsignmentAssignment ta JOIN Trip tt ON tt.id=ta.tripId WHERE ta.consignmentId=c.id AND tt.code=${f.tripCode})`);
    if (f.mine) parts.push(Prisma.sql`c.requesterId=${actorId}`);
    const where = Prisma.join(parts, " AND "), pageSize = options.export ? 1000 : 20;
    const [{ total }] = await tx.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total FROM Consignment c WHERE ${where}`;
    requireCondition(!options.export || Number(total) <= 1000, "EXPORT_LIMIT", "ข้อมูลเกิน ๑,๐๐๐ รายการ กรุณากรองให้แคบลง");
    const ids = await tx.$queryRaw<Array<{ id: string }>>`SELECT c.id FROM Consignment c WHERE ${where} ORDER BY c.createdAt DESC, c.id DESC LIMIT ${pageSize} OFFSET ${options.export ? 0 : (f.page - 1) * pageSize}`;
    const rows = await tx.consignment.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include: {
      destinationBranch: { select: { code: true, name: true } }, sourceWarehouse: { select: { name: true } }, requester: { select: { displayName: true } },
      consignmentItem_consignmentId: { include: { category: { select: { name: true } } } },
      currentAssignment: { select: { transportSnapshot: true, trip: { select: { code: true } } } },
    } });
    return {
      total: Number(total), page: f.page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)),
      rows: ids.map(({ id }) => { const c = rows.find((r) => r.id === id)!; const t = c.currentAssignment?.transportSnapshot as { serviceDate?: string; roundNo?: number; plate?: string } | undefined; return {
        id: c.id, code: c.code, status: c.status, createdAt: c.createdAt.toISOString(), requestedServiceDate: c.requestedServiceDate?.toISOString().slice(0, 10) ?? null,
        branch: c.destinationBranch, warehouse: c.sourceWarehouse.name, requester: c.requester.displayName, packageCount: c.packageCount,
        items: c.consignmentItem_consignmentId.length ? c.consignmentItem_consignmentId.map((i) => ({ name: i.name, quantity: i.sentQuantity.toString(), unit: i.unit, category: i.category.name })) : (((c.draftItems ?? { items: [] }) as unknown as DraftItems).items ?? []).map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, category: "" })),
        trip: c.currentAssignment ? { code: c.currentAssignment.trip.code, serviceDate: t?.serviceDate ?? null, roundNo: t?.roundNo ?? null, plate: t?.plate ?? null } : null,
      }; }),
    };
  }, { isolationLevel: "RepeatableRead" });
}
const statusSet: Record<string, true> = Object.fromEntries(["DRAFT", "PENDING_REVIEW", "REJECTED", "ASSIGNED", "WAREHOUSE_RECEIVED", "LOADED", "IN_TRANSIT", "PARTIALLY_RECEIVED", "ISSUE", "RECEIVED", "CLOSED", "CANCELLED", "RETURNED"].map((s) => [s, true]));

/** Which actions the UI may offer. Purely advisory; every action re-authorizes on the server. */
function availableActions(p: Principal, actorId: string, c: Locked) {
  return Object.entries(transitionMatrix).filter(([action, rule]) => (rule.from as string[]).includes(c.status) &&
    rule.actors.some((a) => p.permissions.has(a.capability) && satisfies(p, actorId, a.scope, c)) &&
    !(action === "receive" && c.status === "ISSUE" && !["IN_TRANSIT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(c.resumeStatus ?? ""))).map(([action]) => action);
}

export async function consignmentDetail(db: PrismaClient, actorId: string, id: string) {
  requireCondition(typeof id === "string" && idPattern.test(id), "NOT_FOUND", "ไม่พบรายการฝากส่ง");
  return db.$transaction(async (tx) => {
    const base = await requireConsignmentAccess(tx, actorId, id), p = await principal(tx, actorId);
    const c = await tx.consignment.findUniqueOrThrow({ where: { id }, include: {
      destinationBranch: true, sourceWarehouse: true, department: true, requester: { select: { displayName: true } }, requestedTrip: { select: { code: true } },
      consignmentAssignment_consignmentId: { orderBy: { approvedAt: "asc" }, include: { trip: { select: { code: true } }, approvedBy: { select: { displayName: true } }, senderSnapshot: true, recipientSnapshot: true, stop: { select: { sequence: true, nameSnapshot: true } }, labelVersion_assignmentId: { select: { number: true, revokedAt: true } } } },
      consignmentEvent_consignmentId: { orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }], include: { actor: { select: { displayName: true } } } },
      attachment_consignmentId: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, include: { uploader: { select: { displayName: true } } } },
    } });
    const b = await balances(tx, id);
    const categories = await tx.consignmentCategory.findMany({ where: { id: { in: b.items.map((i) => i.categoryId) } } });
    const draftItems = ((c.draftItems ?? { items: [] }) as unknown as DraftItems).items ?? [];
    const actions = availableActions(p, actorId, base);
    // Contacts on the request are personal data: shown to parties of this consignment only.
    return {
      id: c.id, code: c.code, status: c.status, resumeStatus: c.resumeStatus, hasOpenIssue: c.hasOpenIssue, version: c.version, receiptMode: c.receiptMode,
      createdAt: c.createdAt.toISOString(), submittedAt: c.submittedAt?.toISOString() ?? null, closedAt: c.closedAt?.toISOString() ?? null,
      requester: c.requester.displayName, mine: c.requesterId === actorId, department: c.department.name, warehouse: { id: c.sourceWarehouseId, name: c.sourceWarehouse.name, address: c.sourceWarehouse.address },
      branch: { id: c.destinationBranchId, code: c.destinationBranch.code, name: c.destinationBranch.name },
      requested: { serviceDate: c.requestedServiceDate?.toISOString().slice(0, 10) ?? null, roundNo: c.requestedRoundNo, tripId: c.requestedTripId, tripCode: c.requestedTrip?.code ?? null },
      contacts: { senderName: c.senderName, senderPhone: c.senderPhone, recipientName: c.recipientName, recipientPhone: c.recipientPhone }, notes: c.notes,
      packageCount: c.packageCount, packageWeight: c.packageWeight?.toString() ?? null, packageWeightUnit: c.packageWeightUnit,
      items: b.items.length ? b.items.map((i) => ({ id: i.id, name: i.name, category: categories.find((x) => x.id === i.categoryId)?.name ?? "", sent: i.sentQuantity.toString(), received: i.received.toString(), returned: i.returned.toString(), unit: i.unit }))
        : draftItems.map((i, n) => ({ id: `draft-${n}`, name: i.name, category: "", sent: i.quantity, received: "0", returned: "0", unit: i.unit, categoryId: i.categoryId })),
      draftItems,
      packages: b.packages.map((x) => ({ id: x.id, label: `${c.code}-${x.sequence}/${x.total}`, sequence: x.sequence, total: x.total, custody: x.custody, received: b.receivedPackages.has(x.id), returned: b.returnedPackages.has(x.id), weight: x.weight?.toString() ?? null, weightUnit: x.weightUnit })),
      assignments: c.consignmentAssignment_consignmentId.map((a) => ({ id: a.id, current: a.id === c.currentAssignmentId, tripId: a.tripId, tripCode: a.trip.code, stop: a.stop, reason: a.reason, approvedBy: a.approvedBy.displayName, approvedAt: a.approvedAt.toISOString(), transport: a.transportSnapshot as Record<string, unknown>, sender: a.senderSnapshot.payload as Record<string, unknown>, recipient: a.recipientSnapshot.payload as Record<string, unknown>, labels: a.labelVersion_assignmentId.map((l) => ({ number: l.number, revoked: !!l.revokedAt })) })),
      events: c.consignmentEvent_consignmentId.map((e) => ({ id: e.id, kind: e.kind, at: e.occurredAt.toISOString(), actor: e.actor.displayName, payload: e.payload as Record<string, unknown>, compensates: e.compensatesEventId })),
      attachments: c.attachment_consignmentId.map((a) => ({ id: a.id, name: a.displayName, contentType: a.contentType, size: a.sizeBytes, uploader: a.uploader.displayName, at: a.createdAt.toISOString() })),
      actions, canUpload: c.requesterId === actorId && ["DRAFT", "PENDING_REVIEW"].includes(c.status) && p.permissions.has("consignment.create"),
    };
  }, { isolationLevel: "RepeatableRead", timeout: 20_000 });
}
export type ConsignmentDetail = Awaited<ReturnType<typeof consignmentDetail>>;

/** Published outbound trips for a date that the dispatcher can choose, with Thai reasons for ineligible ones. */
export async function eligibleTrips(db: PrismaClient, actorId: string, id: string, date: string) {
  serviceDate(date);
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId), c = await tx.consignment.findUnique({ where: { id }, include: { currentAssignment: { include: { tripRevision: true } } } });
    requireCondition(c, "NOT_FOUND", "ไม่พบรายการฝากส่ง");
    requireCondition(p.permissions.has("consignment.assign") && p.global, "FORBIDDEN", "คุณไม่มีสิทธิ์จัดรถ");
    const plan = await tx.dailyPlan.findUnique({ where: { serviceDate: serviceDate(date) } });
    if (!plan?.publishedRevisionId) return { published: false, trips: [] };
    const revisions = await tx.tripRevision.findMany({ where: { planRevisionId: plan.publishedRevisionId, kind: "BRANCH_DELIVERY", cancelled: false, tripStop_tripRevisionId: { some: { branchId: c.destinationBranchId } } }, include: { trip: { select: { code: true } }, routeRevision: { select: { name: true } } }, orderBy: [{ departureAt: "asc" }, { tripId: "asc" }] });
    const now = new Date(), trips = [];
    for (const r of revisions) {
      const check = await tripEligibility(tx, c, r.tripId, null, now);
      trips.push({ tripId: r.tripId, code: r.trip.code, routeName: r.routeRevision?.name ?? null, roundNo: r.roundNo, loadingAt: r.loadingAt?.toISOString() ?? null, departureAt: r.departureAt?.toISOString() ?? null, eligible: check.eligible, reasons: check.reasons, capacity: check.capacity, cutoff: check.cutoff, current: c.currentAssignment?.tripId === r.tripId, stopSequence: check.stop?.sequence ?? null });
    }
    return { published: true, trips };
  }, { isolationLevel: "RepeatableRead", timeout: 20_000 });
}

// ---------------------------------------------------------------- private attachments

export async function addAttachment(db: PrismaClient, actorId: string, key: string, input: { consignmentId: string; displayName: string; contentType: string; sizeBytes: number; sha256: string; storageKey: string }) {
  requireCondition(ATTACHMENT_LIMITS.types.includes(input.contentType as never) && input.sizeBytes > 0 && input.sizeBytes <= ATTACHMENT_LIMITS.maxBytes && /^[a-f0-9]{64}$/.test(input.sha256), "INVALID_FILE", "รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF ขนาดไม่เกิน ๑๐ เมกะไบต์");
  // The storage key is generated per attempt, so it is excluded from the replay fingerprint.
  const fingerprinted = { consignmentId: input.consignmentId, displayName: input.displayName, contentType: input.contentType, sizeBytes: input.sizeBytes, sha256: input.sha256 };
  return guardedWrite(db, actorId, "consignment.attachment", key, fingerprinted, async (tx, idem) => {
    const p = await principal(tx, actorId), c = await lockConsignment(tx, input.consignmentId);
    requireCondition(p.permissions.has("consignment.create") && c.requesterId === actorId, c.status === "DRAFT" ? "NOT_FOUND" : "FORBIDDEN", "แนบไฟล์ได้เฉพาะผู้สร้างคำขอ");
    const prior = await replay<{ id: string; storageKey: string }>(tx, idem); if (prior) return prior;
    requireCondition(["DRAFT", "PENDING_REVIEW"].includes(c.status), "INVALID_TRANSITION", "แนบไฟล์ได้เฉพาะก่อนจัดรถ");
    requireCondition((await tx.attachment.count({ where: { consignmentId: c.id, deletedAt: null } })) < ATTACHMENT_LIMITS.maxFiles, "ATTACHMENT_LIMIT", "แนบไฟล์ได้ไม่เกิน ๕ ไฟล์ต่อคำขอ");
    const row = await tx.attachment.create({ data: { consignmentId: c.id, uploaderId: actorId, storageKey: input.storageKey, displayName: safeDisplayName(input.displayName), contentType: input.contentType, sizeBytes: input.sizeBytes, sha256: input.sha256 } });
    await audit(tx, actorId, "CONSIGNMENT_ATTACHMENT_ADDED", "Attachment", row.id, idem, { consignmentId: c.id, sha256: input.sha256 });
    return { id: row.id, storageKey: row.storageKey };
  });
}
export async function attachmentForDownload(db: PrismaClient, actorId: string, id: string) {
  requireCondition(typeof id === "string" && idPattern.test(id), "NOT_FOUND", "ไม่พบไฟล์");
  return db.$transaction(async (tx) => {
    const a = await tx.attachment.findUnique({ where: { id } });
    requireCondition(a && !a.deletedAt, "NOT_FOUND", "ไม่พบไฟล์");
    await requireConsignmentAccess(tx, actorId, a.consignmentId);
    return { storageKey: a.storageKey, displayName: a.displayName, contentType: a.contentType, sizeBytes: a.sizeBytes, sha256: a.sha256 };
  });
}
