import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { DomainError, requireCondition, versionMatches } from "../domain/errors";
import { idPattern, reasonText } from "../domain/consignment";
import { safeDisplayName } from "../domain/files";
import { autoMapping, importKinds, isImportKind, parseRow, validateMapping, type ImportKind, type ParsedValue } from "../domain/imports";
import type { Table } from "../domain/tabular";
import { principal, type Principal } from "../auth/permissions";
import { guardedWrite, lockEligibility, replay, type Transaction } from "./transaction";
import { mutateMasterTransaction, validateMasterValues } from "./masters";
import { saveRouteTransaction, saveTemplateTransaction, validateRouteInput, validateTemplateInput, type TemplateInput } from "./planning-catalog";

type Values = Record<string, ParsedValue>;
type Duplicate = { type: "EXISTING" | "MERGED"; entityId?: string; info: string };
type Action = "CREATE" | "UPDATE" | "SKIP" | "MERGED" | "BLOCKED" | "UNDECIDED";
export interface RowEvaluation { rowNumber: number; values: Values; errors: string[]; notes: string[]; duplicate: Duplicate | null; action: Action; group: string | null }
type StagedRow = { rowNumber: number; cells: Record<string, string>; decision: string | null };
type Summary = { rows: number; create: number; update: number; skip: number; merged: number; errors: number; undecided: number; groups: number | null };

/** Staged imports need import.manage, GLOBAL scope and the write capability of the target data. */
function requireImportActor(p: Principal, kind: ImportKind | null) {
  const caps = kind ? importKinds[kind].capabilities : [];
  requireCondition(p.global && p.permissions.has("import.manage") && caps.every((c) => p.permissions.has(c)), "FORBIDDEN", "คุณไม่มีสิทธิ์นำเข้าข้อมูลประเภทนี้");
}
const text = (v: ParsedValue) => typeof v === "string" ? v : null;
const upper = (v: ParsedValue) => typeof v === "string" ? v.toUpperCase() : null;
const plateOf = (v: ParsedValue) => typeof v === "string" ? v.replace(/[\s-]/g, "").toUpperCase() : null;
const clock = (m: number | null) => m === null ? null : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const localDateTime = (d: Date | null) => d ? new Date(d.valueOf() + 7 * 3_600_000).toISOString().slice(0, 16) : null;
const destinationTypes: Record<string, string> = { "สาขา": "BRANCH", BRANCH: "BRANCH", "ศูนย์กระจายสินค้า": "DC", DC: "DC", "โรงงาน": "FACTORY", FACTORY: "FACTORY" };
const messageOf = (e: unknown) => e instanceof DomainError ? e.message : null;

function resolve(e: RowEvaluation, decision: string | null) {
  if (decision === "SKIP") { e.action = "SKIP"; return e; }
  if (e.errors.length) { e.action = "BLOCKED"; return e; }
  if (e.duplicate?.type === "MERGED") { e.action = "MERGED"; return e; }
  if (e.duplicate?.type === "EXISTING") { e.action = decision === "UPDATE" ? "UPDATE" : "UNDECIDED"; return e; }
  e.action = "CREATE"; return e;
}

// ---------------------------------------------------------------- evaluation per kind (reads only)

async function evaluateBranches(tx: Transaction, rows: StagedRow[], mapping: Record<string, string | null>) {
  const parsed = rows.map((r) => ({ r, ...parseRow("branches", mapping, r.cells) }));
  const codes = parsed.flatMap((x) => upper(x.values.code) ?? []);
  const existing = new Map((await tx.branch.findMany({ where: { code: { in: codes } } })).map((b) => [b.code.toUpperCase(), b]));
  const seen = new Map<string, number>(), out: Array<RowEvaluation & { master: Record<string, unknown> | null }> = [];
  for (const { r, values, errors } of parsed) {
    const code = upper(values.code), notes: string[] = [], current = code ? existing.get(code) ?? null : null;
    let master: Record<string, unknown> | null = null;
    if (code && seen.has(code)) errors.push(`รหัสสาขาซ้ำกับแถว ${seen.get(code)} ในไฟล์เดียวกัน`); else if (code) seen.set(code, r.rowNumber);
    const typeText = text(values.destinationType), type = typeText ? destinationTypes[typeText.toUpperCase()] ?? destinationTypes[typeText] : current?.destinationType ?? "BRANCH";
    if (!type) errors.push(`“ประเภทปลายทาง” ต้องเป็น สาขา, ศูนย์กระจายสินค้า หรือ โรงงาน — พบ “${typeText}”`);
    if (!errors.length) {
      // Blank optional cells keep the existing value on update; they never erase data.
      const keep = (name: string, fallback: unknown) => values[name] ?? fallback ?? null;
      master = { code, name: values.name, destinationType: type, addressLine: values.addressLine, subdistrict: values.subdistrict, district: values.district, province: values.province, postalCode: values.postalCode,
        contactName: keep("contactName", current?.contactName), contactPhone: keep("contactPhone", current?.contactPhone),
        receivingFromMinute: clock(current?.receivingFromMinute ?? null), receivingToMinute: clock(current?.receivingToMinute ?? null),
        activeFrom: values.activeFrom, activeTo: keep("activeTo", current?.activeTo?.toISOString().slice(0, 10)),
        aliases: Array.isArray(values.aliases) ? (values.aliases as string[]).join("\n") : current ? (await tx.branchAlias.findMany({ where: { branchId: current.id, active: true } })).map((a) => a.name).join("\n") : "", active: true };
      try { validateMasterValues("branches", master); } catch (e) { const m = messageOf(e); if (!m) throw e; errors.push(m); }
      if (current?.archived) notes.push("สาขานี้ถูกเก็บเข้าคลังอยู่ การปรับปรุงจะเปิดใช้งานอีกครั้ง");
    }
    out.push({ ...resolve({ rowNumber: r.rowNumber, values, errors, notes, duplicate: current ? { type: "EXISTING", entityId: current.id, info: `มีสาขารหัส ${current.code} อยู่แล้ว: ${current.name}` } : null, action: "CREATE", group: null }, r.decision), master });
  }
  return out;
}

async function evaluateVehicles(tx: Transaction, rows: StagedRow[], mapping: Record<string, string | null>) {
  const parsed = rows.map((r) => ({ r, ...parseRow("vehicles", mapping, r.cells) }));
  const [types, storages, vehicles] = await Promise.all([tx.vehicleType.findMany({ where: { active: true } }), tx.storageCondition.findMany({ where: { active: true } }),
    tx.vehicle.findMany({ where: { plateNormalized: { in: parsed.flatMap((x) => plateOf(x.values.plate) ?? []) } } })]);
  const seen = new Map<string, number>(), out: Array<RowEvaluation & { master: Record<string, unknown> | null }> = [];
  for (const { r, values, errors } of parsed) {
    const plate = plateOf(values.plate), province = text(values.province), key = plate && province ? `${plate}|${province}` : null;
    const current = key ? vehicles.find((v) => v.plateNormalized === plate && v.province === province) ?? null : null;
    if (key && seen.has(key)) errors.push(`ทะเบียนและจังหวัดซ้ำกับแถว ${seen.get(key)} ในไฟล์เดียวกัน`); else if (key) seen.set(key, r.rowNumber);
    const type = types.find((t) => t.code.toUpperCase() === upper(values.typeCode)), storage = storages.find((s) => s.code.toUpperCase() === upper(values.storageCode));
    if (values.typeCode && !type) errors.push(`ไม่พบประเภทรถรหัส “${values.typeCode}” ที่ใช้งานอยู่`);
    if (values.storageCode && !storage) errors.push(`ไม่พบสภาพการเก็บรักษารหัส “${values.storageCode}” ที่ใช้งานอยู่`);
    const unit = upper(values.capacityUnit);
    if (unit && !["KG", "BOX", "M3"].includes(unit)) errors.push(`“หน่วยความจุ” ต้องเป็น KG, BOX หรือ M3 — พบ “${values.capacityUnit}”`);
    let master: Record<string, unknown> | null = null;
    if (!errors.length) {
      const keep = (name: string, fallback: unknown) => values[name] ?? fallback ?? null;
      master = { plateNormalized: plate, province, brand: keep("brand", current?.brand), model: keep("model", current?.model), color: keep("color", current?.color), typeId: type!.id, wheelCount: values.wheelCount,
        bodyDescription: current?.bodyDescription ?? null, storageConditionId: storage!.id, capacity: values.capacity ?? current?.capacity?.toString() ?? null, capacityUnit: unit ?? current?.capacityUnit ?? null,
        ownerName: current?.ownerName ?? null, availableFrom: localDateTime(current?.availableFrom ?? null), availableTo: localDateTime(current?.availableTo ?? null), active: true };
      try { validateMasterValues("vehicles", master); } catch (e) { const m = messageOf(e); if (!m) throw e; errors.push(m); }
    }
    out.push({ ...resolve({ rowNumber: r.rowNumber, values, errors, notes: [], duplicate: current ? { type: "EXISTING", entityId: current.id, info: `มีรถทะเบียน ${current.plateNormalized} ${current.province} อยู่แล้ว` } : null, action: "CREATE", group: null }, r.decision), master });
  }
  return out;
}

const HEADER_FIELDS = ["routeCode", "routeName", "roundNo", "weekdays", "loadingTime", "departureTime", "arrivalTime", "vehiclePlate", "vehicleProvince", "effectiveFrom"] as const;
interface TemplateGroup { code: string; rows: number[]; routeCode: string; routeName: string; roundNo: number; weekdays: number[]; loadingMinute: number | null; departureMinute: number | null; arrivalMinute: number | null; vehicleId: string | null; effectiveFrom: string; stops: { branchId: string; categoryIds: string[] }[]; existingId: string | null; existingVersion: number; skip: boolean }

async function evaluateSchedule(tx: Transaction, rows: StagedRow[], mapping: Record<string, string | null>) {
  const parsed = rows.map((r) => ({ r, ...parseRow("schedule", mapping, r.cells), notes: [] as string[], duplicate: null as Duplicate | null }));
  const label = (name: string) => importKinds.schedule.fields.find((f) => f.name === name)!.label;
  const [branches, aliases, categories, vehicles, templates] = await Promise.all([
    tx.branch.findMany({ where: { archived: false } }), tx.branchAlias.findMany({ where: { active: true }, include: { branch: { select: { code: true } } } }), tx.productCategory.findMany({ where: { active: true } }),
    tx.vehicle.findMany({ where: { active: true } }), tx.scheduleTemplate.findMany({ where: { code: { in: parsed.flatMap((x) => upper(x.values.templateCode) ?? []) } } }),
  ]);
  for (const x of parsed) {
    const v = x.values, branchCode = upper(v.branchCode), branch = branches.find((b) => b.code.toUpperCase() === branchCode);
    if (typeof v.roundNo === "number" && ![1, 2, 3].includes(v.roundNo)) x.errors.push("“รอบ” ต้องเป็น 1, 2 หรือ 3");
    if (typeof v.stopSequence === "number" && (v.stopSequence < 1 || v.stopSequence > 100)) x.errors.push("“ลำดับจุดส่ง” ต้องอยู่ระหว่าง 1 ถึง 100");
    if (branchCode && !branch) {
      // Aliases are reported for review but never resolved automatically.
      const alias = aliases.find((a) => a.name === v.branchCode);
      x.errors.push(alias ? `“${v.branchCode}” เป็นชื่อเรียกอื่นของสาขา ${alias.branch.code} กรุณาใช้รหัสสาขา` : `ไม่พบสาขารหัส “${v.branchCode}” ที่ใช้งานอยู่`);
    } else if (branch && typeof v.effectiveFrom === "string") {
      const from = new Date(`${v.effectiveFrom}T00:00:00Z`);
      if (branch.activeFrom > from || (branch.activeTo && branch.activeTo < from)) x.errors.push(`สาขา ${branch.code} ไม่เปิดให้บริการในวันที่เริ่มใช้แม่แบบ`);
    }
    for (const c of (Array.isArray(v.categories) ? v.categories as string[] : [])) if (!categories.some((k) => k.code.toUpperCase() === c.toUpperCase())) x.errors.push(`ไม่พบหมวดสินค้ารหัส “${c}” ที่ใช้งานอยู่`);
    const plate = plateOf(v.vehiclePlate), province = text(v.vehicleProvince);
    if (plate) {
      const matches = vehicles.filter((k) => k.plateNormalized === plate && (!province || k.province === province));
      if (!matches.length) x.errors.push(`ไม่พบรถทะเบียน “${v.vehiclePlate}”${province ? ` ${province}` : ""} ที่ใช้งานอยู่`);
      else if (matches.length > 1) x.errors.push(`ทะเบียน “${v.vehiclePlate}” ตรงกับรถหลายคัน กรุณาระบุจังหวัดทะเบียน`);
    } else if (province) x.errors.push("ระบุจังหวัดทะเบียนโดยไม่มีทะเบียนรถ");
    const [l, d, a] = [v.loadingTime, v.departureTime, v.arrivalTime] as Array<number | null>;
    if ((l !== null && d !== null && l > d) || (d !== null && a !== null && d > a)) x.errors.push("ลำดับเวลาไม่ถูกต้อง (เริ่มขึ้นของ ≤ ออกรถ ≤ ถึงปลายทาง)");
    if (v.departureTime === null) x.notes.push("ไม่ทราบเวลาออกรถ ระบบจะเก็บเป็นค่าว่าง ไม่เดาจากเวลาเริ่มขึ้นของ");
  }
  const groups = new Map<string, typeof parsed>();
  for (const x of parsed) { const code = upper(x.values.templateCode); if (code) groups.set(code, [...(groups.get(code) ?? []), x]); }
  const built: TemplateGroup[] = [], routeStops = new Map<string, { signature: string; row: number }>();
  for (const [code, members] of groups) {
    const first = members[0], header = (x: typeof first) => JSON.stringify(HEADER_FIELDS.map((f) => f === "routeCode" || f === "vehiclePlate" ? upper(x.values[f]) : x.values[f]));
    for (const x of members.slice(1)) if (header(x) !== header(first)) {
      const fields = HEADER_FIELDS.filter((f) => JSON.stringify(x.values[f]) !== JSON.stringify(first.values[f])).map(label);
      x.errors.push(`ข้อมูลแม่แบบ ${code} ไม่ตรงกับแถว ${first.r.rowNumber}: ${fields.join(", ")}`);
    }
    const bySequence = new Map<number, typeof parsed>();
    for (const x of members) if (typeof x.values.stopSequence === "number") bySequence.set(x.values.stopSequence, [...(bySequence.get(x.values.stopSequence) ?? []), x]);
    const sequences = [...bySequence.keys()].sort((a, b) => a - b);
    const missing = sequences.length ? Array.from({ length: sequences[sequences.length - 1] }, (_, i) => i + 1).filter((n) => !bySequence.has(n)) : [];
    if (missing.length) first.errors.push(`ลำดับจุดส่งของแม่แบบ ${code} ไม่ต่อเนื่อง ขาดลำดับ ${missing.join(", ")}`);
    for (const [sequence, same] of bySequence) {
      const primary = same[0];
      for (const x of same.slice(1)) {
        if (upper(x.values.branchCode) !== upper(primary.values.branchCode)) { x.errors.push(`ลำดับจุดส่ง ${sequence} ของแม่แบบ ${code} มีสาขาไม่ตรงกับแถว ${primary.r.rowNumber}`); continue; }
        // Repeated category pages of the same sheet: categories are merged into one stop, never a new trip.
        x.duplicate = { type: "MERGED", info: `รวมหมวดสินค้าเข้ากับแถว ${primary.r.rowNumber}${x.values.sourcePage ? ` (หน้าเอกสาร ${x.values.sourcePage})` : ""} ไม่สร้างแม่แบบซ้ำ` };
      }
    }
    const existing = templates.find((t) => t.code.toUpperCase() === code) ?? null;
    if (existing) for (const x of members) if (!x.duplicate) x.duplicate = { type: "EXISTING", entityId: existing.id, info: `มีแม่แบบรหัส ${existing.code} อยู่แล้ว การปรับปรุงจะสร้างฉบับใหม่ที่มีผลกับการสร้างเที่ยวในอนาคตเท่านั้น` };
    const decisions = new Set(members.map((x) => x.r.decision ?? ""));
    // A template is skipped or updated as a whole; dropping single stops would silently change the route.
    if (decisions.size > 1) for (const x of members) x.errors.push(`ต้องเลือกการตัดสินใจเดียวกันทั้งแม่แบบ ${code}`);
    const clean = members.every((x) => !x.errors.length), v = first.values;
    const stops = sequences.map((n) => { const same = bySequence.get(n)!; return { branchId: branches.find((b) => b.code.toUpperCase() === upper(same[0].values.branchCode))?.id ?? "",
      categoryIds: [...new Set(same.flatMap((x) => (Array.isArray(x.values.categories) ? x.values.categories as string[] : []).map((c) => categories.find((k) => k.code.toUpperCase() === c.toUpperCase())?.id ?? "")))] }; });
    const routeCode = upper(v.routeCode) ?? "", signature = JSON.stringify([v.routeName, stops.map((s) => s.branchId)]), known = routeStops.get(routeCode);
    if (clean && known && known.signature !== signature) first.errors.push(`เส้นทาง ${routeCode} มีชื่อหรือจุดส่งไม่ตรงกับแม่แบบที่เริ่มแถว ${known.row}`); else if (clean && !known) routeStops.set(routeCode, { signature, row: first.r.rowNumber });
    const plate = plateOf(v.vehiclePlate), province = text(v.vehicleProvince);
    built.push({ code, rows: members.map((x) => x.r.rowNumber), routeCode, routeName: text(v.routeName) ?? "", roundNo: v.roundNo as number, weekdays: (v.weekdays as number[]) ?? [],
      loadingMinute: v.loadingTime as number | null, departureMinute: v.departureTime as number | null, arrivalMinute: v.arrivalTime as number | null,
      vehicleId: plate ? vehicles.find((k) => k.plateNormalized === plate && (!province || k.province === province))?.id ?? null : null, effectiveFrom: text(v.effectiveFrom) ?? "", stops,
      existingId: existing?.id ?? null, existingVersion: existing?.version ?? 0, skip: members.every((x) => x.r.decision === "SKIP") });
  }
  const evaluations = parsed.map((x) => resolve({ rowNumber: x.r.rowNumber, values: x.values, errors: x.errors, notes: x.notes, duplicate: x.duplicate, action: "CREATE", group: upper(x.values.templateCode) }, x.r.decision));
  // One blocked or undecided row holds back its whole template.
  for (const g of built) {
    const members = evaluations.filter((e) => g.rows.includes(e.rowNumber));
    if (members.some((e) => e.action === "BLOCKED")) for (const e of members) if (e.action !== "BLOCKED" && e.action !== "SKIP") e.action = "BLOCKED";
  }
  return { evaluations, groups: built };
}

async function evaluate(tx: Transaction, kind: ImportKind, mapping: Record<string, string | null>, rows: StagedRow[]) {
  if (kind === "branches") { const e = await evaluateBranches(tx, rows, mapping); return { evaluations: e as RowEvaluation[], masters: e, groups: null }; }
  if (kind === "vehicles") { const e = await evaluateVehicles(tx, rows, mapping); return { evaluations: e as RowEvaluation[], masters: e, groups: null }; }
  const s = await evaluateSchedule(tx, rows, mapping); return { evaluations: s.evaluations, masters: null, groups: s.groups };
}
function summarize(evaluations: RowEvaluation[], groups: TemplateGroup[] | null): Summary {
  const count = (a: Action) => evaluations.filter((e) => e.action === a).length;
  return { rows: evaluations.length, create: count("CREATE"), update: count("UPDATE"), skip: count("SKIP"), merged: count("MERGED"), errors: count("BLOCKED"), undecided: count("UNDECIDED"), groups: groups ? groups.length : null };
}
const resolved = (s: Summary) => s.errors === 0 && s.undecided === 0 && s.create + s.update + s.merged > 0;

async function lockBatch(tx: Transaction, id: string) {
  requireCondition(typeof id === "string" && idPattern.test(id), "NOT_FOUND", "ไม่พบชุดนำเข้า");
  await tx.$queryRaw`SELECT id FROM ImportBatch WHERE id=${id} FOR UPDATE`;
  const batch = await tx.importBatch.findUnique({ where: { id } });
  requireCondition(batch && isImportKind(batch.kind), "NOT_FOUND", "ไม่พบชุดนำเข้า");
  return batch as typeof batch & { kind: ImportKind };
}
async function stagedRows(tx: Transaction, batchId: string): Promise<StagedRow[]> {
  return (await tx.importRow.findMany({ where: { batchId }, orderBy: { rowNumber: "asc" } })).map((r) => ({ rowNumber: r.rowNumber, cells: (r.raw as { cells: Record<string, string> }).cells, decision: r.decision }));
}
/** Re-validates every row against current data and stores the result; source rows are never changed. */
async function revalidate(tx: Transaction, batch: { id: string; kind: ImportKind; mapping: unknown }) {
  const rows = await stagedRows(tx, batch.id), result = await evaluate(tx, batch.kind, batch.mapping as Record<string, string | null>, rows);
  for (const e of result.evaluations) await tx.importRow.update({ where: { batchId_rowNumber: { batchId: batch.id, rowNumber: e.rowNumber } }, data: { validation: { values: e.values, errors: e.errors, notes: e.notes, duplicate: e.duplicate, action: e.action, group: e.group } as unknown as Prisma.InputJsonObject } });
  const summary = summarize(result.evaluations, result.groups);
  const updated = await tx.importBatch.update({ where: { id: batch.id }, data: { summary, status: resolved(summary) ? "VALIDATED" : "STAGED", version: { increment: 1 } } });
  return { ...result, summary, batch: updated };
}
const outcome = (b: { id: string; status: string; version: number }, summary: Summary) => ({ batchId: b.id, status: b.status, version: b.version, summary });

// ---------------------------------------------------------------- mutations

export async function stageImport(db: PrismaClient, actorId: string, key: string, input: { kind: string; sourceName: string; sourceEdition: string; bytes: Uint8Array; table: Table }) {
  requireCondition(isImportKind(input.kind), "INVALID_INPUT", "กรุณาเลือกประเภทข้อมูลที่นำเข้า");
  const kind = input.kind, edition = (input.sourceEdition ?? "").normalize("NFC").trim();
  requireCondition(edition.length >= 3 && edition.length <= 100, "INVALID_INPUT", "กรุณาระบุชื่อชุดหรือวันที่ของเอกสารอ้างอิง (๓–๑๐๐ ตัวอักษร)");
  const sourceHash = createHash("sha256").update(input.bytes).digest("hex"), sourceName = safeDisplayName(input.sourceName);
  return guardedWrite(db, actorId, "import.stage", key, { kind, edition, sourceHash }, async (tx, idem) => {
    const p = await principal(tx, actorId); requireImportActor(p, kind);
    const prior = await replay<ReturnType<typeof outcome> & { existing: boolean }>(tx, idem); if (prior) return prior;
    // The same file for the same reference edition is one batch: re-uploading never duplicates records.
    const same = await tx.importBatch.findUnique({ where: { sourceHash_sourceEdition: { sourceHash, sourceEdition: edition } } });
    if (same) {
      requireCondition(same.kind === kind, "IMPORT_KIND_MISMATCH", "ไฟล์นี้เคยนำเข้าเป็นข้อมูลประเภทอื่นในชุดเดียวกัน");
      return { ...outcome(same, same.summary as unknown as Summary), existing: true };
    }
    const batch = await tx.importBatch.create({ data: { id: randomUUID(), sourceHash, sourceName, sourceEdition: edition, kind, createdById: actorId, headers: input.table.headers, mapping: autoMapping(kind, input.table.headers), rowCount: input.table.rows.length } });
    await tx.importRow.createMany({ data: input.table.rows.map((cells, i) => ({ batchId: batch.id, rowNumber: i + 2, raw: { schemaVersion: 1, cells }, validation: {} })) });
    const result = await revalidate(tx, { id: batch.id, kind, mapping: batch.mapping });
    await tx.auditLog.create({ data: { actorId, action: "IMPORT_STAGED", entityType: "ImportBatch", entityId: batch.id, idempotencyId: idem, after: { kind, sourceName, sourceEdition: edition, sourceHash, ...result.summary } } });
    return { ...outcome(result.batch, result.summary), existing: false };
  });
}

async function editable(tx: Transaction, actorId: string, input: { batchId: string; expectedVersion: number }) {
  const p = await principal(tx, actorId), batch = await lockBatch(tx, input.batchId);
  requireImportActor(p, batch.kind);
  return { p, batch };
}
function requireOpen(batch: { status: string; version: number }, expectedVersion: number) {
  versionMatches(batch.version, expectedVersion);
  requireCondition(["STAGED", "VALIDATED"].includes(batch.status), "IMPORT_CLOSED", "ชุดนำเข้านี้ปิดแล้ว แก้ไขไม่ได้");
}

export async function remapImport(db: PrismaClient, actorId: string, key: string, input: { batchId: string; expectedVersion: number; mapping: unknown }) {
  requireCondition(input && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, "import.remap", key, input, async (tx, idem) => {
    const { batch } = await editable(tx, actorId, input);
    const prior = await replay<ReturnType<typeof outcome>>(tx, idem); if (prior) return prior;
    requireOpen(batch, input.expectedVersion);
    const mapping = validateMapping(batch.kind, batch.headers as string[], input.mapping);
    requireCondition(mapping, "INVALID_MAPPING", "การจับคู่คอลัมน์ไม่ถูกต้อง หนึ่งคอลัมน์ใช้ได้กับช่องข้อมูลเดียว");
    await tx.importBatch.update({ where: { id: batch.id }, data: { mapping } });
    const result = await revalidate(tx, { id: batch.id, kind: batch.kind, mapping });
    return outcome(result.batch, result.summary);
  });
}

export async function decideImportRows(db: PrismaClient, actorId: string, key: string, input: { batchId: string; expectedVersion: number; rowNumbers: number[]; decision: string | null }) {
  requireCondition(input && Number.isInteger(input.expectedVersion) && Array.isArray(input.rowNumbers) && input.rowNumbers.length > 0 && input.rowNumbers.length <= 500 && input.rowNumbers.every((n) => Number.isInteger(n) && n >= 2) && [null, "UPDATE", "SKIP"].includes(input.decision), "INVALID_INPUT", "การตัดสินใจไม่ถูกต้อง");
  return guardedWrite(db, actorId, "import.decide", key, input, async (tx, idem) => {
    const { batch } = await editable(tx, actorId, input);
    const prior = await replay<ReturnType<typeof outcome>>(tx, idem); if (prior) return prior;
    requireOpen(batch, input.expectedVersion);
    const changed = await tx.importRow.updateMany({ where: { batchId: batch.id, rowNumber: { in: input.rowNumbers } }, data: { decision: input.decision } });
    requireCondition(changed.count === new Set(input.rowNumbers).size, "NOT_FOUND", "ไม่พบแถวที่เลือก");
    const result = await revalidate(tx, batch);
    return outcome(result.batch, result.summary);
  });
}

export async function rejectImport(db: PrismaClient, actorId: string, key: string, input: { batchId: string; expectedVersion: number; reason: string }) {
  const reason = reasonText(input?.reason);
  return guardedWrite(db, actorId, "import.reject", key, input, async (tx, idem) => {
    const { batch } = await editable(tx, actorId, input);
    const prior = await replay<ReturnType<typeof outcome>>(tx, idem); if (prior) return prior;
    requireOpen(batch, input.expectedVersion);
    const updated = await tx.importBatch.update({ where: { id: batch.id }, data: { status: "REJECTED", rejectionReason: reason, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId, action: "IMPORT_REJECTED", entityType: "ImportBatch", entityId: batch.id, idempotencyId: idem, reason, after: { status: "REJECTED" } } });
    return outcome(updated, batch.summary as unknown as Summary);
  });
}

/** Applies a fully resolved batch in one transaction. Any failure rolls back every row. */
export async function commitImport(db: PrismaClient, actorId: string, key: string, input: { batchId: string; expectedVersion: number }) {
  requireCondition(input && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, "import.commit", key, input, async (tx, idem) => {
    await lockEligibility(tx);
    const { p, batch } = await editable(tx, actorId, input);
    const prior = await replay<ReturnType<typeof outcome> & { already: boolean }>(tx, idem); if (prior) return prior;
    // Committing an already committed batch is a no-op, so the same batch can never apply twice.
    if (batch.status === "COMMITTED") return { ...outcome(batch, batch.summary as unknown as Summary), already: true };
    versionMatches(batch.version, input.expectedVersion);
    requireCondition(batch.status !== "REJECTED", "IMPORT_CLOSED", "ชุดนำเข้านี้ถูกยกเลิกแล้ว");
    const rows = await stagedRows(tx, batch.id), result = await evaluate(tx, batch.kind, batch.mapping as Record<string, string | null>, rows), summary = summarize(result.evaluations, result.groups);
    if (!resolved(summary)) throw new DomainError("IMPORT_HAS_ERRORS", `ยังนำเข้าไม่ได้: มีแถวที่ผิดพลาด ${summary.errors} แถว และแถวซ้ำที่ยังไม่ตัดสินใจ ${summary.undecided} แถว กรุณาแก้ไขหรือเลือกข้ามให้ครบก่อน`, summary);
    const reason = `นำเข้าจากชุด ${batch.sourceEdition} (${batch.sourceName})`, entity = new Map<number, string>();
    const fail = (rowNumber: number, e: unknown): never => { const m = messageOf(e); if (!m) throw e; throw new DomainError("IMPORT_ROW_FAILED", `แถว ${rowNumber}: ${m} ไม่มีข้อมูลใดถูกนำเข้า`); };
    if (result.masters) for (const row of result.masters) {
      if (row.action !== "CREATE" && row.action !== "UPDATE") continue;
      try {
        const parsed = validateMasterValues(batch.kind, row.master), id = row.action === "UPDATE" ? row.duplicate!.entityId! : undefined;
        const version = id ? (batch.kind === "branches" ? (await tx.branch.findUniqueOrThrow({ where: { id } })).version : (await tx.vehicle.findUniqueOrThrow({ where: { id } })).version) : 0;
        entity.set(row.rowNumber, (await mutateMasterTransaction(tx, p, actorId, idem, batch.kind, { id, expectedVersion: version, reason, action: "save" }, parsed)).id);
      } catch (e) { fail(row.rowNumber, e); }
    }
    if (result.groups) {
      const routes = new Map<string, string>();
      for (const g of result.groups.filter((x) => !x.skip)) {
        try {
          let routeRevisionId = routes.get(g.routeCode);
          if (!routeRevisionId) {
            const route = await tx.route.findFirst({ where: { code: g.routeCode }, include: { routeRevision_routeId: { orderBy: { number: "desc" }, take: 1, include: { routeStop_routeRevisionId: { orderBy: { sequence: "asc" } } } } } });
            const latest = route?.routeRevision_routeId[0], from = new Date(`${g.effectiveFrom}T00:00:00Z`);
            const reusable = route?.active && latest && latest.name === g.routeName && !latest.effectiveTo && latest.effectiveFrom <= from && JSON.stringify(latest.routeStop_routeRevisionId.map((s) => s.branchId)) === JSON.stringify(g.stops.map((s) => s.branchId));
            if (reusable) routeRevisionId = latest.id;
            else {
              const routeInput = { id: route?.id ?? randomUUID(), code: g.routeCode, expectedVersion: route?.version ?? 0, active: true, effectiveFrom: g.effectiveFrom, effectiveTo: null, reason, name: g.routeName, branchIds: g.stops.map((s) => s.branchId) };
              validateRouteInput(routeInput); routeRevisionId = (await saveRouteTransaction(tx, actorId, idem, routeInput)).revisionId;
            }
            routes.set(g.routeCode, routeRevisionId);
          }
          const stops = await tx.routeStop.findMany({ where: { routeRevisionId }, orderBy: { sequence: "asc" } });
          const template: TemplateInput = { id: g.existingId ?? randomUUID(), code: g.code, expectedVersion: g.existingVersion, active: true, effectiveFrom: g.effectiveFrom, effectiveTo: null, reason, routeRevisionId, kind: "BRANCH_DELIVERY", roundNo: g.roundNo,
            vehicleId: g.vehicleId, driverId: null, loadingMinute: g.loadingMinute, departureMinute: g.departureMinute, arrivalMinute: g.arrivalMinute, arrivalDayOffset: 0, occupancyStartMinute: null, occupancyEndMinute: null, bufferMinutes: 0,
            notes: `${reason} — เวลาและรถที่ไม่ทราบถูกเก็บเป็นค่าว่าง`, weekdays: g.weekdays, categories: stops.map((s, i) => ({ routeStopId: s.id, categoryIds: g.stops[i].categoryIds })) };
          validateTemplateInput(template);
          const saved = await saveTemplateTransaction(tx, actorId, idem, template);
          for (const n of g.rows) entity.set(n, saved.id);
        } catch (e) { fail(g.rows[0], e); }
      }
    }
    for (const e of result.evaluations) await tx.importRow.update({ where: { batchId_rowNumber: { batchId: batch.id, rowNumber: e.rowNumber } }, data: { resolvedEntityId: entity.get(e.rowNumber) ?? null, validation: { values: e.values, errors: e.errors, notes: e.notes, duplicate: e.duplicate, action: e.action, group: e.group } as unknown as Prisma.InputJsonObject } });
    const updated = await tx.importBatch.update({ where: { id: batch.id }, data: { status: "COMMITTED", committedAt: new Date(), summary, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId, action: "IMPORT_COMMITTED", entityType: "ImportBatch", entityId: batch.id, idempotencyId: idem, reason, after: { ...summary, kind: batch.kind } } });
    return { ...outcome(updated, summary), already: false };
  });
}

// ---------------------------------------------------------------- reads

export async function listImportBatches(db: PrismaClient, actorId: string, page: number) {
  requireCondition(Number.isInteger(page) && page >= 1 && page <= 10_000, "INVALID_INPUT", "หมายเลขหน้าไม่ถูกต้อง");
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId); requireImportActor(p, null);
    const kinds = (Object.keys(importKinds) as ImportKind[]).filter((k) => importKinds[k].capabilities.every((c) => p.permissions.has(c)));
    const where = { kind: { in: kinds } }, total = await tx.importBatch.count({ where });
    const rows = await tx.importBatch.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20, include: { createdBy: { select: { displayName: true } } } });
    return { kinds, total, page, pageCount: Math.max(1, Math.ceil(total / 20)), rows: rows.map((b) => ({ id: b.id, kind: b.kind as ImportKind, status: b.status, sourceName: b.sourceName, sourceEdition: b.sourceEdition, rowCount: b.rowCount, createdBy: b.createdBy.displayName, createdAt: b.createdAt.toISOString(), committedAt: b.committedAt?.toISOString() ?? null, summary: b.summary as unknown as Summary | null })) };
  }, { isolationLevel: "RepeatableRead" });
}

export async function importBatchDetail(db: PrismaClient, actorId: string, batchId: string) {
  requireCondition(typeof batchId === "string" && idPattern.test(batchId), "NOT_FOUND", "ไม่พบชุดนำเข้า");
  return db.$transaction(async (tx) => {
    const p = await principal(tx, actorId), batch = await tx.importBatch.findUnique({ where: { id: batchId }, include: { createdBy: { select: { displayName: true } } } });
    requireCondition(batch && isImportKind(batch.kind), "NOT_FOUND", "ไม่พบชุดนำเข้า");
    requireImportActor(p, batch.kind);
    const rows = await tx.importRow.findMany({ where: { batchId }, orderBy: { rowNumber: "asc" } });
    return {
      id: batch.id, kind: batch.kind, status: batch.status, version: batch.version, sourceName: batch.sourceName, sourceEdition: batch.sourceEdition, sourceHash: batch.sourceHash, rowCount: batch.rowCount,
      createdBy: batch.createdBy.displayName, createdAt: batch.createdAt.toISOString(), committedAt: batch.committedAt?.toISOString() ?? null, rejectionReason: batch.rejectionReason,
      headers: batch.headers as string[], mapping: batch.mapping as Record<string, string | null>, summary: batch.summary as unknown as Summary,
      rows: rows.map((r) => ({ rowNumber: r.rowNumber, cells: (r.raw as { cells: Record<string, string> }).cells, decision: r.decision, resolvedEntityId: r.resolvedEntityId, ...(r.validation as unknown as Omit<RowEvaluation, "rowNumber">) })),
    };
  }, { isolationLevel: "RepeatableRead", timeout: 20_000 });
}
export type ImportDetail = Awaited<ReturnType<typeof importBatchDetail>>;
