import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { installRoles } from "../../src/server/auth/permissions";
import { provisionAccount } from "../../src/server/auth/provision";
import { DomainError } from "../../src/server/domain/errors";
import type { DraftInput } from "../../src/server/domain/consignment";
import type { LabelPayload } from "../../src/server/domain/labels";
import { importKinds, type ImportKind } from "../../src/server/domain/imports";
import { parseTabular, toCsv, writeXlsx } from "../../src/server/domain/tabular";
import { saveDraft, publishPlan } from "../../src/server/services/plans";
import { saveConsignmentDraft, submitConsignment, assignConsignment, reassignConsignment, correctAssignmentAddress } from "../../src/server/services/consignments";
import { issueLabel, recordPrint, labelOverview, labelSheet, lookupLabel, tripManifest } from "../../src/server/services/labels";
import { stageImport, remapImport, decideImportRows, commitImport, rejectImport, importBatchDetail, listImportBatches } from "../../src/server/services/imports";
import { seedMasters, synthetic, completeDraft } from "../fixtures/synthetic";

// Synthetic test data only: no real branch, plate, contact or schedule.
const db = createDatabase(testDatabaseConfiguration(process.env));
const D8 = "2028-07-01", [A, B] = synthetic.branchIds, accounts: Record<string, string> = {};
let MARKETING = "", DOCUMENT = "", counter = 0;
const key = () => `p7-${++counter}`;
const rejected = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const trip = (round: number) => `p7-${D8}-trip-${round}`;
const version = async (id: string) => (await db.consignment.findUniqueOrThrow({ where: { id } })).version;

function draft(over: Partial<DraftInput> = {}): DraftInput {
  return { id: null, expectedVersion: 0, departmentId: "synthetic-department", sourceWarehouseId: "synthetic-warehouse", destinationBranchId: A, requestedServiceDate: D8, requestedRoundNo: 1, requestedTripId: null,
    senderName: "ผู้ฝากสังเคราะห์", senderPhone: "000-000-1000", recipientName: "ผู้รับสังเคราะห์", recipientPhone: "000-000-2000", notes: null, receiptMode: "PACKAGES", packageCount: 3, packageWeight: null, packageWeightUnit: null,
    items: [{ categoryId: MARKETING, name: "โปสเตอร์ (ข้อมูลสังเคราะห์)", quantity: "30", unit: "SHEET" }], ...over };
}
async function assigned(over: Partial<DraftInput>, round: number) {
  const d = await saveConsignmentDraft(db, accounts.REQUESTER, key(), draft(over));
  const s = await submitConsignment(db, accounts.REQUESTER, key(), { id: d.id, expectedVersion: d.version });
  return assignConsignment(db, accounts.DISPATCHER, key(), { id: s.id, expectedVersion: s.version, tripId: trip(round) });
}
function csv(kind: ImportKind, rows: Record<string, string>[], headers?: Record<string, string>) {
  const fields = importKinds[kind].fields, name = `${kind}.csv`;
  const bytes = new TextEncoder().encode(toCsv([fields.map((f) => headers?.[f.name] ?? f.label), ...rows.map((r) => fields.map((f) => r[f.name] ?? ""))]));
  return { bytes, table: parseTabular(bytes, name), sourceName: name };
}

before(async () => {
  await seedMasters(db); await installRoles(db);
  MARKETING = (await db.consignmentCategory.findUniqueOrThrow({ where: { code: "MARKETING" } })).id;
  DOCUMENT = (await db.consignmentCategory.findUniqueOrThrow({ where: { code: "DOCUMENT" } })).id;
  await db.driver.upsert({ where: { id: "p7-driver" }, create: { id: "p7-driver", code: "P7-DRIVER", name: "พนักงานขับรถสังเคราะห์ P7" }, update: {} });
  await db.vehicle.upsert({ where: { id: "p7-vehicle" }, create: { id: "p7-vehicle", plateNormalized: "P7SWAP", province: "ข้อมูลสังเคราะห์", typeId: "synthetic-type", storageConditionId: "synthetic-chilled" }, update: {} });
  for (const [n, province] of ["จังหวัดสังเคราะห์ ก", "จังหวัดสังเคราะห์ ข"].entries()) await db.vehicle.upsert({ where: { id: `p7-ambiguous-${n}` }, create: { id: `p7-ambiguous-${n}`, plateNormalized: "P7AMB", province, typeId: "synthetic-type", storageConditionId: "synthetic-chilled" }, update: {} });
  const password = randomBytes(24).toString("base64url");
  const plan: Array<[string, string, "GLOBAL" | "BRANCH" | "DEPARTMENT" | "DRIVER" | "WAREHOUSE", string | undefined]> = [
    ["REQUESTER", "REQUESTER", "DEPARTMENT", "synthetic-department"], ["DISPATCHER", "DISPATCHER", "GLOBAL", undefined], ["WAREHOUSE", "WAREHOUSE", "WAREHOUSE", "synthetic-warehouse"], ["DRIVER", "DRIVER", "DRIVER", "p7-driver"],
    ["BRANCH_A", "BRANCH_RECEIVER", "BRANCH", A], ["BRANCH_B", "BRANCH_RECEIVER", "BRANCH", B], ["SUPERVISOR", "SUPERVISOR", "GLOBAL", undefined], ["ADMINISTRATOR", "ADMINISTRATOR", "GLOBAL", undefined],
  ];
  for (const [name, role, scope, scopeId] of plan) accounts[name] = (await provisionAccount(db, { email: `p7-${name.toLowerCase()}@synthetic.test`, name: `ผู้ทดสอบฉลาก ${name}`, password, role, scope, scopeId })).id;
  const input = completeDraft(D8, `p7-${D8}`); input.trips[0].driverId = "p7-driver"; input.reason = "แผนสังเคราะห์สำหรับทดสอบฉลาก";
  const d = await saveDraft(db, synthetic.actorId, "p7-plan", input);
  await publishPlan(db, synthetic.actorId, "p7-publish", { revisionId: d.revisionId, expectedVersion: d.version });
  await db.branch.update({ where: { id: A }, data: { postalCode: "00000", addressLine: "ที่อยู่ทดสอบ ไม่ใช่สถานที่จริง" } });
});
after(async () => { await db.$disconnect(); });

test("T16/T17/T18: incomplete address blocked, immutable versions 1/3–3/3, reprint adds no records, revocation and QR lookup", async () => {
  const a = await assigned({}, 1), id = a.id; let v = a.version;
  await assert.rejects(issueLabel(db, accounts.WAREHOUSE, key(), { consignmentId: id, expectedVersion: v }), (e: unknown) => rejected("LABEL_INCOMPLETE")(e) && String((e as Error).message).includes("รหัสไปรษณีย์"), "incomplete address blocks a production label");
  const sample = await labelOverview(db, accounts.DISPATCHER, id);
  assert.ok(sample.sample && sample.problems.length > 0 && sample.versions.length === 0, "only a sample preview exists");
  await db.branch.update({ where: { id: A }, data: { postalCode: "50000" } });
  await assert.rejects(issueLabel(db, accounts.WAREHOUSE, key(), { consignmentId: id, expectedVersion: v }), rejected("ADDRESS_CHANGED"), "frozen snapshot is not silently replaced by master data");
  await assert.rejects(correctAssignmentAddress(db, accounts.WAREHOUSE, key(), { id, expectedVersion: v, reason: "ไม่มีสิทธิ์" }), rejected("FORBIDDEN"));
  v = (await correctAssignmentAddress(db, accounts.DISPATCHER, key(), { id, expectedVersion: v, reason: "แก้ไขรหัสไปรษณีย์ของสาขา" })).version;
  await assert.rejects(issueLabel(db, accounts.REQUESTER, key(), { consignmentId: id, expectedVersion: v }), rejected("FORBIDDEN"));

  const l1 = await issueLabel(db, accounts.WAREHOUSE, key(), { consignmentId: id, expectedVersion: v });
  assert.equal(l1.number, 1);
  const row1 = await db.labelVersion.findUniqueOrThrow({ where: { id: l1.labelVersionId } }), p1 = row1.payload as unknown as LabelPayload;
  assert.deepEqual(p1.packages.map((x) => `${x.sequence}/${x.total}`), ["1/3", "2/3", "3/3"]);
  assert.equal(p1.recipient.postalCode, "50000"); assert.equal(p1.transport.plate, "SYNTHETIC-1");
  assert.match(p1.lookupPath, /^\/l\/[A-Za-z0-9_-]{32}$/); assert.ok(!p1.lookupPath.includes("000-000"), "QR path carries no personal data");
  assert.equal(await db.labelPackage.count({ where: { labelVersionId: l1.labelVersionId } }), 3);
  await assert.rejects(issueLabel(db, accounts.WAREHOUSE, key(), { consignmentId: id, expectedVersion: l1.version }), rejected("LABEL_EXISTS"));
  await assert.rejects(db.labelVersion.update({ where: { id: l1.labelVersionId }, data: { payload: {} } }), "label payload is immutable");

  const counts = async () => ({ consignments: await db.consignment.count(), packages: await db.consignmentPackage.count(), labels: await db.labelVersion.count(), prints: await db.printEvent.count({ where: { labelVersionId: l1.labelVersionId } }) });
  const start = await counts(), printKey = key();
  const first = await recordPrint(db, accounts.WAREHOUSE, printKey, { labelVersionId: l1.labelVersionId, format: "A4_4UP", copies: 1 });
  assert.equal(first.reprint, false);
  assert.deepEqual(await recordPrint(db, accounts.WAREHOUSE, printKey, { labelVersionId: l1.labelVersionId, format: "A4_4UP", copies: 1 }), first, "same key replays");
  await assert.rejects(recordPrint(db, accounts.DISPATCHER, key(), { labelVersionId: l1.labelVersionId, format: "STICKER_100X150", copies: 2 }), rejected("REASON_REQUIRED"));
  assert.equal((await recordPrint(db, accounts.DISPATCHER, key(), { labelVersionId: l1.labelVersionId, format: "STICKER_100X150", copies: 2, reason: "ฉลากเดิมเปื้อน" })).reprint, true);
  await assert.rejects(recordPrint(db, accounts.BRANCH_A, key(), { labelVersionId: l1.labelVersionId, format: "A4_4UP", copies: 1, reason: "ไม่มีสิทธิ์" }), rejected("FORBIDDEN"));
  await assert.rejects(recordPrint(db, accounts.WAREHOUSE, key(), { labelVersionId: l1.labelVersionId, format: "A3", copies: 1 }), rejected("INVALID_INPUT"));
  assert.deepEqual(await counts(), { ...start, prints: 2 }, "a reprint creates no consignment, package or label version");

  const token = p1.lookupPath.slice(3);
  const found = await lookupLabel(db, accounts.BRANCH_A, token, 2);
  assert.equal(found.state, "CURRENT"); assert.ok(found.package?.label.endsWith("-2/3"));
  await assert.rejects(lookupLabel(db, accounts.BRANCH_B, token, 2), rejected("FORBIDDEN"), "QR lookup obeys the consignment scope");
  await assert.rejects(lookupLabel(db, accounts.BRANCH_A, randomBytes(24).toString("base64url"), null), rejected("NOT_FOUND"));
  await assert.rejects(lookupLabel(db, accounts.BRANCH_A, token, 9), rejected("NOT_FOUND"));

  // Reassignment revokes version 1.
  const moved = await reassignConsignment(db, accounts.DISPATCHER, key(), { id, expectedVersion: await version(id), tripId: trip(2), reason: "ย้ายไปรอบ ๒" });
  const revoked = await lookupLabel(db, accounts.BRANCH_A, token, 1);
  assert.equal(revoked.state, "REVOKED"); assert.equal(revoked.replacement, null);
  await assert.rejects(recordPrint(db, accounts.WAREHOUSE, key(), { labelVersionId: l1.labelVersionId, format: "A4_4UP", copies: 1, reason: "พิมพ์ฉบับเก่า" }), rejected("LABEL_REVOKED"));
  const oldSheet = await labelSheet(db, accounts.WAREHOUSE, l1.labelVersionId);
  assert.equal(oldSheet.revoked, true); assert.equal(oldSheet.payload, null, "a revoked version is never printable");
  const l2 = await issueLabel(db, accounts.WAREHOUSE, key(), { consignmentId: id, expectedVersion: moved.version });
  assert.equal(l2.number, 2);
  assert.deepEqual((await lookupLabel(db, accounts.BRANCH_A, token, 1)).replacement, { labelVersionId: l2.labelVersionId, number: 2 }, "revoked QR points authorized users to the replacement");

  // Vehicle change within the same trip (plan replacement) revokes version 2.
  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(`${D8}T00:00:00Z`) } });
  const candidate = completeDraft(D8, `p7-${D8}`, plan.version); candidate.trips[0].driverId = "p7-driver"; candidate.trips[1].vehicleId = "p7-vehicle"; candidate.reason = "เปลี่ยนรถรอบ ๒";
  const revision = await saveDraft(db, accounts.DISPATCHER, key(), candidate);
  await publishPlan(db, accounts.SUPERVISOR, key(), { revisionId: revision.revisionId, expectedVersion: revision.version, reason: "เปลี่ยนรถของรอบ ๒", reassignments: [{ consignmentId: id, expectedVersion: l2.version, tripId: trip(2), stopSequence: 1 }] });
  const v2 = await db.labelVersion.findUniqueOrThrow({ where: { id: l2.labelVersionId } });
  assert.ok(v2.revokedAt && v2.revocationReason === "เปลี่ยนรถของรอบ ๒"); assert.equal((v2.payload as unknown as LabelPayload).transport.plate, "SYNTHETIC-2", "old payload keeps the old vehicle");
  const l3 = await issueLabel(db, accounts.DISPATCHER, key(), { consignmentId: id, expectedVersion: await version(id) });
  assert.equal(l3.number, 3);
  assert.equal(((await db.labelVersion.findUniqueOrThrow({ where: { id: l3.labelVersionId } })).payload as unknown as LabelPayload).transport.plate, "P7SWAP");
  const overview = await labelOverview(db, accounts.WAREHOUSE, id);
  assert.deepEqual(overview.versions.map((x) => [x.number, !!x.revokedAt, x.prints.length]), [[1, true, 2], [2, true, 0], [3, false, 0]]);
  assert.equal(overview.current?.number, 3); assert.equal(await db.consignmentPackage.count({ where: { consignmentId: id } }), 3);

  // Per-trip manifest grouped by destination, totals per unit.
  const second = await assigned({ destinationBranchId: B, packageCount: 2, items: [{ categoryId: DOCUMENT, name: "เอกสาร (สังเคราะห์)", quantity: "2", unit: "SET" }, { categoryId: MARKETING, name: "ป้าย (สังเคราะห์)", quantity: "5", unit: "PIECE" }] }, 2);
  const manifest = await tripManifest(db, accounts.DISPATCHER, trip(2));
  assert.deepEqual(manifest.groups.map((g) => [g.sequence, g.consignments.length, g.packageTotal]), [[1, 1, 3], [2, 1, 2]]);
  assert.deepEqual(manifest.groups[0].unitTotals, [{ unit: "SHEET", quantity: "30" }]); assert.equal(manifest.groups[0].consignments[0].labelNumber, 3);
  assert.deepEqual(manifest.groups[1].unitTotals.map((u) => u.unit).sort(), ["PIECE", "SET"], "different units are never summed"); assert.equal(manifest.groups[1].consignments[0].id, second.id);
  assert.equal(manifest.packageTotal, 5); assert.equal(manifest.vehicle?.plate, "P7SWAP");
  assert.equal((await tripManifest(db, accounts.WAREHOUSE, trip(2))).partial, true);
  assert.equal((await tripManifest(db, accounts.DRIVER, trip(1))).groups.length, 0);
  await assert.rejects(tripManifest(db, accounts.DRIVER, trip(2)), rejected("NOT_FOUND"), "a driver sees only own trips");
  await assert.rejects(tripManifest(db, accounts.BRANCH_A, trip(2)), rejected("FORBIDDEN"));
});

test("T22: mixed-validity import stays uncommitted, duplicates need a decision, commit is transactional and never repeats", async () => {
  const good = { code: "P7-B01", name: "สาขานำเข้าสังเคราะห์ ๑", destinationType: "สาขา", addressLine: "๙๙ ถนนสังเคราะห์", subdistrict: "ตำบลสังเคราะห์", district: "อำเภอสังเคราะห์", province: "จังหวัดสังเคราะห์", postalCode: "50000", contactName: "ผู้รับนำเข้า", contactPhone: "000-000-7001", activeFrom: "01/01/2578", aliases: "นำเข้า๑|P7 หนึ่ง" };
  const file = csv("branches", [
    { ...good, code: "synthetic-2", name: "สาขาสังเคราะห์ 2 (ปรับปรุงจากการนำเข้า)", activeFrom: "01/01/2569", aliases: "" },
    good,
    { ...good, code: "P7-B02", name: "สาขานำเข้าสังเคราะห์ ๒", province: "", postalCode: "5000", aliases: "" },
    { ...good, name: "แถวซ้ำในไฟล์" },
    // Valid on its own, but a branch opening in the past would retroactively break published coverage.
    { ...good, code: "P7-B03", name: "สาขาย้อนหลังสังเคราะห์", activeFrom: "01/01/2569", aliases: "" },
  ], { code: "รหัส", name: "ชื่อ" });
  const edition = "ชุดทดสอบสาขา 01/10/2569";
  await assert.rejects(stageImport(db, accounts.DISPATCHER, key(), { kind: "branches", sourceEdition: edition, ...file }), rejected("FORBIDDEN"), "needs the target write capability");
  await assert.rejects(stageImport(db, accounts.REQUESTER, key(), { kind: "branches", sourceEdition: edition, ...file }), rejected("FORBIDDEN"));
  const staged = await stageImport(db, accounts.ADMINISTRATOR, key(), { kind: "branches", sourceEdition: edition, ...file });
  assert.equal(staged.existing, false); assert.equal(staged.status, "STAGED");
  assert.equal(staged.summary.errors, 5, "unmapped required columns are reported on every row");
  let d = await importBatchDetail(db, accounts.ADMINISTRATOR, staged.batchId);
  assert.ok(d.rows[0].errors.includes("ยังไม่ได้จับคู่คอลัมน์สำหรับ “รหัสสาขา”"));
  await assert.rejects(importBatchDetail(db, accounts.DISPATCHER, staged.batchId), rejected("FORBIDDEN"));
  await assert.rejects(remapImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: d.version, mapping: { ...d.mapping, code: "รหัส", name: "รหัส" } }), rejected("INVALID_MAPPING"));
  let state = await remapImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: d.version, mapping: { ...d.mapping, code: "รหัส", name: "ชื่อ" } });
  assert.deepEqual([state.summary.create, state.summary.errors, state.summary.undecided, state.status], [2, 2, 1, "STAGED"]);
  d = await importBatchDetail(db, accounts.ADMINISTRATOR, staged.batchId);
  assert.ok(d.rows[2].errors.some((e) => e.includes("จังหวัด")), "row-specific Thai errors");
  assert.ok(d.rows[3].errors.some((e) => e.includes("ซ้ำกับแถว 3")));
  assert.equal(d.rows[0].duplicate?.type, "EXISTING"); assert.equal(d.rows[0].action, "UNDECIDED");

  await assert.rejects(commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version }), rejected("IMPORT_HAS_ERRORS"));
  assert.equal(await db.branch.count({ where: { code: { startsWith: "P7-B" } } }), 0, "nothing is committed while any row is unresolved");
  const again = await stageImport(db, accounts.ADMINISTRATOR, key(), { kind: "branches", sourceEdition: edition, ...file });
  assert.equal(again.existing, true); assert.equal(again.batchId, staged.batchId, "same file and edition is the same batch");
  await assert.rejects(stageImport(db, accounts.ADMINISTRATOR, key(), { kind: "vehicles", sourceEdition: edition, ...file }), rejected("IMPORT_KIND_MISMATCH"));

  state = await decideImportRows(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version, rowNumbers: [4, 5], decision: "SKIP" });
  assert.deepEqual([state.summary.errors, state.summary.skip, state.summary.undecided, state.status], [0, 2, 1, "STAGED"]);
  await assert.rejects(commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version }), rejected("IMPORT_HAS_ERRORS"), "an undecided duplicate still blocks");
  state = await decideImportRows(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version, rowNumbers: [2], decision: "UPDATE" });
  assert.equal(state.status, "VALIDATED");
  await assert.rejects(commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version - 1 }), rejected("VERSION_CONFLICT"));
  const beforeB = await db.branch.findUniqueOrThrow({ where: { id: B } });
  // Row 2 is applied first and row 6 then fails: the whole transaction, including row 2, is rolled back.
  await assert.rejects(commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version }), (e: unknown) => rejected("IMPORT_ROW_FAILED")(e) && String((e as Error).message).startsWith("แถว 6:"));
  assert.equal((await db.branch.findUniqueOrThrow({ where: { id: B } })).name, beforeB.name, "no partial commit");
  assert.equal(await db.branch.count({ where: { code: { startsWith: "P7-B" } } }), 0);
  assert.equal((await db.importBatch.findUniqueOrThrow({ where: { id: staged.batchId } })).status, "VALIDATED");
  state = await decideImportRows(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version, rowNumbers: [6], decision: "SKIP" });
  const committed = await commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: state.version });
  assert.equal(committed.status, "COMMITTED"); assert.equal(committed.already, false);
  const created = await db.branch.findUniqueOrThrow({ where: { code: "P7-B01" }, include: { branchAlias_branchId: true } });
  assert.equal(created.activeFrom.toISOString().slice(0, 10), "2035-01-01"); assert.deepEqual(created.branchAlias_branchId.map((x) => x.name).sort(), ["P7 หนึ่ง", "นำเข้า๑"].sort());
  const afterB = await db.branch.findUniqueOrThrow({ where: { id: B } });
  assert.equal(afterB.name, "สาขาสังเคราะห์ 2 (ปรับปรุงจากการนำเข้า)"); assert.equal(afterB.version, beforeB.version + 1);
  assert.equal(await db.branch.count({ where: { code: { in: ["P7-B02", "P7-B03"] } } }), 0, "skipped rows are not imported");
  assert.ok(await db.auditLog.count({ where: { entityType: "Branch", entityId: created.id } }) >= 1, "each record keeps its own audit entry");

  const branchCount = await db.branch.count();
  const repeat = await commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: 1 });
  assert.equal(repeat.already, true); assert.equal(await db.branch.count(), branchCount, "the same batch cannot apply twice");
  assert.equal((await stageImport(db, accounts.ADMINISTRATOR, key(), { kind: "branches", sourceEdition: edition, ...file })).status, "COMMITTED");
  d = await importBatchDetail(db, accounts.ADMINISTRATOR, staged.batchId);
  assert.equal(d.rows[1].resolvedEntityId, created.id); assert.equal(d.rows[2].cells["จังหวัด"], "", "source rows are preserved exactly");
  await assert.rejects(db.importRow.updateMany({ where: { batchId: staged.batchId }, data: { raw: {} } }), "source data is immutable");
  await assert.rejects(db.importBatch.update({ where: { id: staged.batchId }, data: { status: "STAGED" } }), "committed batch history is immutable");
  await assert.rejects(rejectImport(db, accounts.ADMINISTRATOR, key(), { batchId: staged.batchId, expectedVersion: repeat.version, reason: "ยกเลิกย้อนหลัง" }), rejected("IMPORT_CLOSED"));

  // XLSX path with a rejected batch; a failing row during commit rolls the whole batch back.
  const fields = importKinds.vehicles.fields, vehicleRow = (over: Record<string, string>) => fields.map((f) => ({ plate: "P7-IMP 1", province: "จังหวัดสังเคราะห์", typeCode: "synthetic", storageCode: "chilled", color: "ขาว", wheelCount: "6", capacity: "1,500", capacityUnit: "kg", ...over } as Record<string, string>)[f.name] ?? "");
  const xlsx = writeXlsx([fields.map((f) => f.label), vehicleRow({}), vehicleRow({ plate: "P7-IMP 2", typeCode: "NOPE" }), vehicleRow({ plate: "P7-IMP 3", capacityUnit: "" })]);
  const v = await stageImport(db, accounts.ADMINISTRATOR, key(), { kind: "vehicles", sourceEdition: "ชุดทดสอบรถ", sourceName: "รถ.xlsx", bytes: xlsx, table: parseTabular(xlsx, "รถ.xlsx") });
  assert.deepEqual([v.summary.create, v.summary.errors], [1, 2]);
  const vd = await importBatchDetail(db, accounts.ADMINISTRATOR, v.batchId);
  assert.ok(vd.rows[1].errors[0].includes("ไม่พบประเภทรถรหัส “NOPE”")); assert.ok(vd.rows[2].errors[0].includes("ความจุและหน่วย"));
  const skipped = await decideImportRows(db, accounts.ADMINISTRATOR, key(), { batchId: v.batchId, expectedVersion: v.version, rowNumbers: [3, 4], decision: "SKIP" });
  await db.vehicle.create({ data: { id: "p7-race", plateNormalized: "P7IMP1", province: "จังหวัดสังเคราะห์", typeId: "synthetic-type", storageConditionId: "synthetic-chilled" } });
  await assert.rejects(commitImport(db, accounts.ADMINISTRATOR, key(), { batchId: v.batchId, expectedVersion: skipped.version }), rejected("IMPORT_HAS_ERRORS"), "commit re-validates against current data");
  assert.equal((await db.importBatch.findUniqueOrThrow({ where: { id: v.batchId } })).status, "VALIDATED", "a failed commit changes nothing");
  const rejectedBatch = await rejectImport(db, accounts.ADMINISTRATOR, key(), { batchId: v.batchId, expectedVersion: skipped.version, reason: "ไฟล์ต้นทางต้องแก้ไข" });
  assert.equal(rejectedBatch.status, "REJECTED");
  assert.ok((await listImportBatches(db, accounts.ADMINISTRATOR, 1)).rows.some((b) => b.id === v.batchId && b.status === "REJECTED"), "batch history is retained");
  assert.throws(() => parseTabular(new TextEncoder().encode("%PDF-1.7 synthetic"), "sheet.pdf"), rejected("REFERENCE_ONLY"), "PDFs are reference material, never OCR input");
});

test("T23: repeated category pages become one template per code; reference dates stay separate; ambiguity is preserved", async () => {
  const pages: Array<[string, string]> = [["1", "PORK"], ["2", "CHICKEN"], ["3", ""]], stops = ["SYNTHETIC-1", "SYNTHETIC-2", "SYNTHETIC-3"], rows: Record<string, string>[] = [];
  for (const [sourcePage, categories] of pages) for (const [templateCode, roundNo, departureTime] of [["P7-T1", "1", "08:00"], ["P7-T2", "2", ""]]) for (const [i, branchCode] of stops.entries()) {
    rows.push({ templateCode, routeCode: "P7-RT-A", routeName: "เส้นทางนำเข้าสังเคราะห์", roundNo, weekdays: "1-7", loadingTime: roundNo === "1" ? "07:00" : "11:00", departureTime, arrivalTime: "", vehiclePlate: "", vehicleProvince: "", stopSequence: String(i + 1), branchCode, categories, effectiveFrom: "01/10/2569", sourcePage });
  }
  const file = csv("schedule", rows);
  // A role without import.manage is refused (the administrator now holds every capability, D215).
  await assert.rejects(stageImport(db, accounts.SUPERVISOR, key(), { kind: "schedule", sourceEdition: "ใบจัดรถสังเคราะห์ 18/09/2569", ...file }), rejected("FORBIDDEN"));
  const staged = await stageImport(db, accounts.DISPATCHER, key(), { kind: "schedule", sourceEdition: "ใบจัดรถสังเคราะห์ 18/09/2569", ...file });
  assert.deepEqual([staged.summary.rows, staged.summary.groups, staged.summary.create, staged.summary.merged, staged.summary.errors, staged.status], [18, 2, 6, 12, 0, "VALIDATED"]);
  const detail = await importBatchDetail(db, accounts.DISPATCHER, staged.batchId);
  assert.ok(detail.rows[6].duplicate?.info.includes("ไม่สร้างแม่แบบซ้ำ") && detail.rows[6].duplicate?.info.includes("หน้าเอกสาร 2"));
  assert.ok(detail.rows[3].notes.some((n) => n.includes("ไม่ทราบเวลาออกรถ")));
  await commitImport(db, accounts.DISPATCHER, key(), { batchId: staged.batchId, expectedVersion: staged.version });
  const templates = await db.scheduleTemplate.findMany({ where: { code: { in: ["P7-T1", "P7-T2"] } }, include: { templateRevision_templateId: { include: { templateStopCategory_templateRevisionId: true } } }, orderBy: { code: "asc" } });
  assert.equal(templates.length, 2, "18 source rows over three category pages are two templates, not 18");
  assert.equal(await db.routeRevision.count({ where: { route: { code: "P7-RT-A" } } }), 1);
  assert.equal(templates[0].templateRevision_templateId[0].templateStopCategory_templateRevisionId.length, 6, "pork and chicken merged onto each of three stops");
  const t2 = templates[1].templateRevision_templateId[0];
  assert.equal(t2.departureMinute, null, "unknown departure stays null"); assert.equal(t2.loadingMinute, 660); assert.equal(t2.vehicleId, null);

  // The same sheet under another reference date is a separate batch whose rows need an explicit decision.
  const other = await stageImport(db, accounts.DISPATCHER, key(), { kind: "schedule", sourceEdition: "ใบจัดรถสังเคราะห์ 02/10/2569", ...file });
  assert.notEqual(other.batchId, staged.batchId); assert.equal(other.existing, false);
  assert.deepEqual([other.summary.undecided, other.summary.merged, other.status], [6, 12, "STAGED"]);
  await assert.rejects(commitImport(db, accounts.DISPATCHER, key(), { batchId: other.batchId, expectedVersion: other.version }), rejected("IMPORT_HAS_ERRORS"));
  const mixed = await decideImportRows(db, accounts.DISPATCHER, key(), { batchId: other.batchId, expectedVersion: other.version, rowNumbers: [2], decision: "UPDATE" });
  assert.ok(mixed.summary.errors > 0, "a template is decided as a whole");
  const all = await decideImportRows(db, accounts.DISPATCHER, key(), { batchId: other.batchId, expectedVersion: mixed.version, rowNumbers: rows.map((_, i) => i + 2), decision: "UPDATE" });
  assert.equal(all.status, "VALIDATED");
  await commitImport(db, accounts.DISPATCHER, key(), { batchId: other.batchId, expectedVersion: all.version });
  assert.equal(await db.scheduleTemplate.count({ where: { code: { in: ["P7-T1", "P7-T2"] } } }), 2);
  assert.equal(await db.templateRevision.count({ where: { template: { code: "P7-T1" } } }), 2, "update appends a revision; history is kept");
  assert.equal(await db.routeRevision.count({ where: { route: { code: "P7-RT-A" } } }), 1, "unchanged route is reused");

  // Ambiguous or unknown references are reported, never guessed.
  const base = { templateCode: "P7-T9", routeCode: "P7-RT-B", routeName: "เส้นทางกำกวม", roundNo: "3", weekdays: "ทุกวัน", loadingTime: "15:00", departureTime: "14:00", stopSequence: "1", branchCode: "SYNTHETIC-1", categories: "PORK", effectiveFrom: "2026-10-01" };
  const bad = csv("schedule", [{ ...base, vehiclePlate: "P7-AMB" }, { ...base, stopSequence: "3", branchCode: "แจ้ห่มสังเคราะห์", categories: "BEEF" }, { ...base, templateCode: "P7-T8", roundNo: "4", weekdays: "8", effectiveFrom: "01/10/2026" }]);
  const ambiguous = await stageImport(db, accounts.DISPATCHER, key(), { kind: "schedule", sourceEdition: "ใบจัดรถกำกวม", ...bad });
  const bd = await importBatchDetail(db, accounts.DISPATCHER, ambiguous.batchId), errors = bd.rows.map((r) => r.errors.join(" | "));
  assert.ok(errors[0].includes("ตรงกับรถหลายคัน") && errors[0].includes("ลำดับเวลาไม่ถูกต้อง") && errors[0].includes("ไม่ต่อเนื่อง"));
  assert.ok(errors[1].includes("ไม่พบหมวดสินค้ารหัส “BEEF”") && (errors[1].includes("ชื่อเรียกอื่น") || errors[1].includes("ไม่พบสาขารหัส")));
  assert.ok(errors[2].includes("“รอบ” ต้องเป็น 1, 2 หรือ 3") && errors[2].includes("1-7") && errors[2].includes("พ.ศ."));
  assert.equal(ambiguous.status, "STAGED"); assert.equal(await db.scheduleTemplate.count({ where: { code: { in: ["P7-T8", "P7-T9"] } } }), 0);
});
