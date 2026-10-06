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
import { saveDraft, publishPlan } from "../../src/server/services/plans";
import {
  saveConsignmentDraft, submitConsignment, assignConsignment, reassignConsignment, rejectConsignment, cancelConsignment, warehouseReceiveConsignment,
  loadConsignment, departTrip, reportIssue, resolveIssue, recordReturn, closeConsignment, listConsignments, consignmentDetail, eligibleTrips, addAttachment, attachmentForDownload,
} from "../../src/server/services/consignments";
import { receiveConsignment } from "../../src/server/services/receipts";
import { planningData } from "../../src/server/services/planning-read";
import { rolePermissions } from "../../src/server/auth/permissions";
import { requireConsignmentAccess } from "../../src/server/auth/resource-policy";
import { seedMasters, synthetic, completeDraft } from "../fixtures/synthetic";

// All rows below are synthetic test data on dedicated future dates.
const db = createDatabase(testDatabaseConfiguration(process.env)), other = createDatabase(testDatabaseConfiguration(process.env));
const D6 = "2028-06-01", D7 = "2028-06-02", PAST = "2026-09-15", [A, B] = synthetic.branchIds;
const accounts: Record<string, string> = {};
let MARKETING = "", DOCUMENT = "", counter = 0;
const key = () => `p6-${++counter}`;
const rejected = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const trip = (date: string, round: number) => `p6-${date}-trip-${round}`;

function draft(over: Partial<DraftInput> = {}): DraftInput {
  return { id: null, expectedVersion: 0, departmentId: "synthetic-department", sourceWarehouseId: "synthetic-warehouse", destinationBranchId: A,
    requestedServiceDate: D6, requestedRoundNo: 1, requestedTripId: null, senderName: "ผู้ฝากสังเคราะห์", senderPhone: "000-000-1000",
    recipientName: "ผู้รับสังเคราะห์", recipientPhone: "000-000-2000", notes: null, receiptMode: "DETAILED", packageCount: 3, packageWeight: null, packageWeightUnit: null,
    items: [{ categoryId: MARKETING, name: "โปสเตอร์โปรโมชัน (ข้อมูลสังเคราะห์)", quantity: "30", unit: "SHEET" }], ...over };
}
async function submitted(over: Partial<DraftInput> = {}) {
  const d = await saveConsignmentDraft(db, accounts.REQUESTER, key(), draft(over));
  return submitConsignment(db, accounts.REQUESTER, key(), { id: d.id, expectedVersion: d.version });
}
const packagesOf = async (id: string) => (await db.consignmentPackage.findMany({ where: { consignmentId: id }, orderBy: { sequence: "asc" } })).map((p) => p.id);
async function loaded(id: string, version: number, tripId: string) {
  let v = (await assignConsignment(db, accounts.DISPATCHER, key(), { id, expectedVersion: version, tripId })).version;
  v = (await warehouseReceiveConsignment(db, accounts.WAREHOUSE, key(), { id, expectedVersion: v, packageIds: await packagesOf(id) })).version;
  return (await loadConsignment(db, accounts.WAREHOUSE, key(), { id, expectedVersion: v, packageIds: await packagesOf(id) })).version;
}
const version = async (id: string) => (await db.consignment.findUniqueOrThrow({ where: { id } })).version;

before(async () => {
  await seedMasters(db); await installRoles(db);
  MARKETING = (await db.consignmentCategory.findUniqueOrThrow({ where: { code: "MARKETING" } })).id;
  DOCUMENT = (await db.consignmentCategory.findUniqueOrThrow({ where: { code: "DOCUMENT" } })).id;
  await db.driver.upsert({ where: { id: "p6-driver" }, create: { id: "p6-driver", code: "P6-DRIVER", name: "พนักงานขับรถสังเคราะห์ P6" }, update: {} });
  const password = randomBytes(24).toString("base64url");
  const plan: Array<[string, string, "GLOBAL" | "BRANCH" | "DEPARTMENT" | "DRIVER" | "WAREHOUSE", string | undefined]> = [
    ["REQUESTER", "REQUESTER", "DEPARTMENT", "synthetic-department"], ["DISPATCHER", "DISPATCHER", "GLOBAL", undefined], ["WAREHOUSE", "WAREHOUSE", "WAREHOUSE", "synthetic-warehouse"],
    ["DRIVER", "DRIVER", "DRIVER", "p6-driver"], ["BRANCH_A", "BRANCH_RECEIVER", "BRANCH", A], ["BRANCH_B", "BRANCH_RECEIVER", "BRANCH", B], ["SUPERVISOR", "SUPERVISOR", "GLOBAL", undefined], ["ADMIN", "ADMINISTRATOR", "GLOBAL", undefined],
  ];
  for (const [name, role, scope, scopeId] of plan) accounts[name] = (await provisionAccount(db, { email: `p6-${name.toLowerCase()}@synthetic.test`, name: `ผู้ทดสอบฝากส่ง ${name}`, password, role, scope, scopeId })).id;
  for (const date of [D6, D7, PAST]) {
    const input = completeDraft(date, `p6-${date}`); input.trips[0].driverId = "p6-driver"; input.reason = "แผนสังเคราะห์สำหรับทดสอบฝากส่ง";
    const d = await saveDraft(db, synthetic.actorId, `p6-plan-${date}`, input);
    await publishPlan(db, synthetic.actorId, `p6-publish-${date}`, { revisionId: d.revisionId, expectedVersion: d.version });
  }
});
after(async () => { await db.$disconnect(); await other.$disconnect(); });

test("T14/T15/T09/T10/T18: 30 posters in 3 boxes from draft to closed, partial receipt, concurrent over-receipt and frozen history", async () => {
  const d = await saveConsignmentDraft(db, accounts.REQUESTER, key(), draft({ senderPhone: null }));
  assert.equal(d.status, "DRAFT"); assert.match(d.code, /^FS-\d{8}-[A-Z2-9]{6}$/);
  await assert.rejects(submitConsignment(db, accounts.REQUESTER, key(), { id: d.id, expectedVersion: d.version }), rejected("SUBMISSION_INCOMPLETE"));
  await assert.rejects(consignmentDetail(db, accounts.DISPATCHER, d.id), rejected("NOT_FOUND"), "drafts are private to the requester");
  const saved = await saveConsignmentDraft(db, accounts.REQUESTER, key(), draft({ id: d.id, expectedVersion: d.version }));
  const submitKey = key();
  const first = await submitConsignment(db, accounts.REQUESTER, submitKey, { id: d.id, expectedVersion: saved.version });
  assert.deepEqual(await submitConsignment(db, accounts.REQUESTER, submitKey, { id: d.id, expectedVersion: saved.version }), first, "same key replays");
  await assert.rejects(submitConsignment(db, accounts.REQUESTER, key(), { id: d.id, expectedVersion: first.version }), rejected("INVALID_TRANSITION"));
  assert.equal(await db.consignmentEvent.count({ where: { consignmentId: d.id, kind: "SUBMITTED" } }), 1);
  const [item] = await db.consignmentItem.findMany({ where: { consignmentId: d.id } });
  assert.equal(item.sentQuantity.toString(), "30"); assert.equal(item.unit, "SHEET");
  assert.deepEqual((await db.consignmentPackage.findMany({ where: { consignmentId: d.id }, orderBy: { sequence: "asc" } })).map((p) => `${p.sequence}/${p.total}`), ["1/3", "2/3", "3/3"]);
  await assert.rejects(saveConsignmentDraft(db, accounts.REQUESTER, key(), draft({ id: d.id, expectedVersion: first.version })), rejected("INVALID_TRANSITION"));
  await assert.rejects(db.consignment.update({ where: { id: d.id }, data: { senderName: "แก้ย้อนหลัง" } }), "trigger freezes the submitted request");

  const options = await eligibleTrips(db, accounts.DISPATCHER, d.id, D6);
  assert.deepEqual(options.trips.map((t) => [t.tripId, t.eligible]), [[trip(D6, 1), true], [trip(D6, 2), true], [trip(D6, 3), true]]);
  await assert.rejects(eligibleTrips(db, accounts.REQUESTER, d.id, D6), rejected("FORBIDDEN"));
  let v = (await assignConsignment(db, accounts.DISPATCHER, key(), { id: d.id, expectedVersion: first.version, tripId: trip(D6, 1) })).version;
  const assignment = await db.consignmentAssignment.findFirstOrThrow({ where: { consignmentId: d.id }, include: { recipientSnapshot: true } });
  const snapshotBefore = JSON.stringify(assignment.recipientSnapshot.payload);
  await db.branch.update({ where: { id: A }, data: { addressLine: "ที่อยู่ทดสอบที่แก้ไขภายหลัง (สังเคราะห์)" } });
  assert.equal(JSON.stringify((await db.addressSnapshot.findUniqueOrThrow({ where: { id: assignment.recipientSnapshotId } })).payload), snapshotBefore, "T18: branch edits never rewrite snapshots");

  await assert.rejects(loadConsignment(db, accounts.WAREHOUSE, key(), { id: d.id, expectedVersion: v, packageIds: await packagesOf(d.id) }), rejected("INVALID_TRANSITION"), "rejected transition");
  await assert.rejects(warehouseReceiveConsignment(db, accounts.WAREHOUSE, key(), { id: d.id, expectedVersion: v, packageIds: (await packagesOf(d.id)).slice(0, 2) }), rejected("PACKAGE_HANDOVER"));
  await assert.rejects(warehouseReceiveConsignment(db, accounts.BRANCH_A, key(), { id: d.id, expectedVersion: v, packageIds: await packagesOf(d.id) }), rejected("FORBIDDEN"));
  v = (await warehouseReceiveConsignment(db, accounts.WAREHOUSE, key(), { id: d.id, expectedVersion: v, packageIds: await packagesOf(d.id) })).version;
  v = (await loadConsignment(db, accounts.WAREHOUSE, key(), { id: d.id, expectedVersion: v, packageIds: await packagesOf(d.id) })).version;
  const [p1, p2, p3] = await packagesOf(d.id);
  await assert.rejects(receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: v, lines: [{ packageId: p1, quantity: "1", unit: "PACKAGE" }] }), rejected("RECEIPT_STATE"), "no ordinary receipt before departure");
  const departed = await departTrip(db, accounts.DRIVER, key(), { tripId: trip(D6, 1) });
  assert.deepEqual(departed.departed, [d.id]); v = await version(d.id);

  await assert.rejects(receiveConsignment(db, accounts.BRANCH_B, key(), { consignmentId: d.id, expectedVersion: v, lines: [{ packageId: p1, quantity: "1", unit: "PACKAGE" }] }), rejected("FORBIDDEN"), "cross-branch receipt denied");
  await assert.rejects(db.$transaction((tx) => requireConsignmentAccess(tx, accounts.BRANCH_B, d.id)), rejected("FORBIDDEN"));
  const partial = await receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: v, lines: [{ packageId: p1, quantity: "1", unit: "PACKAGE" }, { packageId: p2, quantity: "1", unit: "PACKAGE" }, { itemId: item.id, quantity: "20", unit: "SHEET" }] });
  assert.equal(partial.status, "PARTIALLY_RECEIVED");
  await assert.rejects(closeConsignment(db, accounts.BRANCH_A, key(), { id: d.id, expectedVersion: partial.version }), rejected("RECEIPT_INCOMPLETE"));
  await assert.rejects(receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: partial.version, lines: [{ itemId: item.id, quantity: "3", unit: "BOX" }] }), rejected("RECEIPT_UNIT"), "30 sheets and 3 boxes are different balances");

  const race = await Promise.allSettled([
    receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: partial.version, lines: [{ itemId: item.id, quantity: "10", unit: "SHEET" }] }),
    receiveConsignment(other, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: partial.version, lines: [{ itemId: item.id, quantity: "10", unit: "SHEET" }] }),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1, "concurrent over-receipt: exactly one commits");
  await assert.rejects(receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: await version(d.id), lines: [{ itemId: item.id, quantity: "1", unit: "SHEET" }] }), rejected("RECEIPT_EXCEEDS_SENT"));
  const sheets = await db.receiptLine.aggregate({ where: { itemId: item.id }, _sum: { quantity: true } });
  assert.equal(sheets._sum.quantity?.toString(), "30");
  const done = await receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: d.id, expectedVersion: await version(d.id), lines: [{ packageId: p3, quantity: "1", unit: "PACKAGE" }] });
  assert.equal(done.status, "RECEIVED");
  const closed = await closeConsignment(db, accounts.BRANCH_A, key(), { id: d.id, expectedVersion: done.version });
  assert.equal(closed.status, "CLOSED");
  await assert.rejects(db.consignment.update({ where: { id: d.id }, data: { status: "IN_TRANSIT" } }), "closed records cannot be reopened directly");
  const kinds = (await db.consignmentEvent.findMany({ where: { consignmentId: d.id }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] })).map((e) => e.kind);
  assert.deepEqual(kinds, ["SUBMITTED", "ASSIGNED", "WAREHOUSE_RECEIVED", "LOADED", "DEPARTED", "RECEIPT", "RECEIPT", "RECEIPT", "CLOSED"]);
  await db.branch.update({ where: { id: A }, data: { addressLine: "ที่อยู่ทดสอบ ไม่ใช่สถานที่จริง" } });
});

test("T15: shortage issue keeps movement state, supervisor return and resolution, then close; corrective receipt before departure", async () => {
  const s = await submitted({ receiptMode: "PACKAGES", packageCount: 2, items: [{ categoryId: DOCUMENT, name: "เอกสารสัญญา (สังเคราะห์)", quantity: "2", unit: "SET" }] });
  let v = await loaded(s.id, s.version, trip(D6, 2));
  // Trip 2 has no driver: the source warehouse records departure for its own consignments.
  assert.deepEqual((await departTrip(db, accounts.WAREHOUSE, key(), { tripId: trip(D6, 2) })).departed, [s.id]);
  await assert.rejects(departTrip(db, accounts.BRANCH_A, key(), { tripId: trip(D6, 2) }), rejected("FORBIDDEN"));
  const [p1, p2] = await packagesOf(s.id); v = await version(s.id);
  v = (await receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: s.id, expectedVersion: v, lines: [{ packageId: p1, quantity: "1", unit: "PACKAGE" }] })).version;
  const issue = await reportIssue(db, accounts.BRANCH_A, key(), { id: s.id, expectedVersion: v, type: "SHORTAGE", description: "หีบห่อที่ ๒ ไม่มาถึง", packageIds: [p2] });
  assert.equal(issue.status, "ISSUE");
  assert.equal((await db.consignment.findUniqueOrThrow({ where: { id: s.id } })).resumeStatus, "PARTIALLY_RECEIVED");
  await assert.rejects(closeConsignment(db, accounts.BRANCH_A, key(), { id: s.id, expectedVersion: issue.version }), rejected("INVALID_TRANSITION"));
  await assert.rejects(resolveIssue(db, accounts.REQUESTER, key(), { id: s.id, expectedVersion: issue.version, reason: "ไม่มีสิทธิ์" }), rejected("FORBIDDEN"));
  const returned = await recordReturn(db, accounts.SUPERVISOR, key(), { id: s.id, expectedVersion: issue.version, reason: "หีบห่อตกค้างบนรถ ส่งคืนคลัง", packageIds: [p2] });
  assert.equal(returned.status, "ISSUE");
  await assert.rejects(recordReturn(db, accounts.SUPERVISOR, key(), { id: s.id, expectedVersion: returned.version, reason: "ส่งคืนซ้ำ", packageIds: [p1] }), rejected("RETURN_PACKAGE"), "received packages cannot be returned");
  const resolved = await resolveIssue(db, accounts.SUPERVISOR, key(), { id: s.id, expectedVersion: returned.version, reason: "ตรวจสอบแล้ว ส่งคืนหีบห่อที่ ๒" });
  assert.equal(resolved.status, "PARTIALLY_RECEIVED");
  const resolution = await db.consignmentEvent.findFirstOrThrow({ where: { consignmentId: s.id, kind: "ISSUE_RESOLVED" } });
  assert.ok(resolution.compensatesEventId, "resolution compensates the issue event without rewriting it");
  assert.equal((await closeConsignment(db, accounts.BRANCH_A, key(), { id: s.id, expectedVersion: resolved.version })).status, "CLOSED");
  assert.equal((await db.consignmentPackage.findUniqueOrThrow({ where: { id: p2 } })).custody, "RETURNED");

  const c = await submitted({ receiptMode: "PACKAGES", packageCount: 1 });
  const cv = await loaded(c.id, c.version, trip(D6, 3));
  const [only] = await packagesOf(c.id);
  await assert.rejects(receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: c.id, expectedVersion: cv, lines: [{ packageId: only, quantity: "1", unit: "PACKAGE" }] }), rejected("RECEIPT_STATE"));
  await assert.rejects(receiveConsignment(db, accounts.BRANCH_A, key(), { consignmentId: c.id, expectedVersion: cv, correctionReason: "พยายามข้ามขั้นตอน", lines: [{ packageId: only, quantity: "1", unit: "PACKAGE" }] }), rejected("FORBIDDEN"));
  const corrected = await receiveConsignment(db, accounts.SUPERVISOR, key(), { consignmentId: c.id, expectedVersion: cv, correctionReason: "รถออกจริงแต่ลืมบันทึก ตรวจกับคนขับแล้ว", lines: [{ packageId: only, quantity: "1", unit: "PACKAGE" }] });
  assert.equal(corrected.status, "RECEIVED");
  assert.equal(await db.consignmentEvent.count({ where: { consignmentId: c.id, kind: "CORRECTION" } }), 1);
});

test("T08: eligibility, capacity, cutoff, reassignment, cancellation and plan replacement leave no orphan records", async () => {
  const heavy = await submitted({ packageWeight: "400", packageWeightUnit: "KG" });
  await assert.rejects(assignConsignment(db, accounts.DISPATCHER, key(), { id: heavy.id, expectedVersion: heavy.version, tripId: trip(D6, 1) }), (e: unknown) => rejected("INELIGIBLE_TRIP")(e) && String((e as Error).message).includes("เกินความจุรถ"));
  await assert.rejects(assignConsignment(db, accounts.DISPATCHER, key(), { id: heavy.id, expectedVersion: heavy.version, tripId: trip(PAST, 1) }), (e: unknown) => rejected("INELIGIBLE_TRIP")(e) && String((e as Error).message).includes("เลยเวลาปิดรับ"));
  await assert.rejects(assignConsignment(db, accounts.DISPATCHER, key(), { id: heavy.id, expectedVersion: heavy.version, tripId: trip(D6, 1), stopSequence: 2 }), rejected("INELIGIBLE_TRIP"), "stop must be the destination");
  await assert.rejects(assignConsignment(db, accounts.REQUESTER, key(), { id: heavy.id, expectedVersion: heavy.version, tripId: trip(D6, 2) }), rejected("FORBIDDEN"));
  const rejectedRequest = await rejectConsignment(db, accounts.DISPATCHER, key(), { id: heavy.id, expectedVersion: heavy.version, reason: "น้ำหนักเกินความจุทุกรอบ" });
  assert.equal(rejectedRequest.status, "REJECTED");

  const x = await submitted();
  let v = (await assignConsignment(db, accounts.DISPATCHER, key(), { id: x.id, expectedVersion: x.version, tripId: trip(D6, 1) })).version;
  const oldAssignment = (await db.consignment.findUniqueOrThrow({ where: { id: x.id } })).currentAssignmentId!;
  await db.labelVersion.create({ data: { assignmentId: oldAssignment, number: 1, lookupToken: `p6-label-${randomBytes(8).toString("hex")}`, payload: { schemaVersion: 1, synthetic: true } } });
  v = (await warehouseReceiveConsignment(db, accounts.WAREHOUSE, key(), { id: x.id, expectedVersion: v, packageIds: await packagesOf(x.id) })).version;
  await assert.rejects(reassignConsignment(db, accounts.DISPATCHER, key(), { id: x.id, expectedVersion: v, tripId: trip(D6, 2) }), rejected("REASON_REQUIRED"));
  const moved = await reassignConsignment(db, accounts.DISPATCHER, key(), { id: x.id, expectedVersion: v, tripId: trip(D6, 2), reason: "ย้ายไปรอบ ๒ ตามคำขอสาขา" });
  const now = await db.consignment.findUniqueOrThrow({ where: { id: x.id }, include: { currentAssignment: true } });
  assert.equal(now.status, "WAREHOUSE_RECEIVED"); assert.equal(now.currentAssignment!.tripId, trip(D6, 2)); assert.equal(now.currentAssignment!.previousAssignmentId, oldAssignment);
  assert.ok((await db.labelVersion.findFirstOrThrow({ where: { assignmentId: oldAssignment } })).revokedAt, "old label revoked");
  assert.equal(await db.consignmentAssignment.count({ where: { consignmentId: x.id } }), 2, "previous assignment retained as history");
  v = (await loadConsignment(db, accounts.WAREHOUSE, key(), { id: x.id, expectedVersion: moved.version, packageIds: await packagesOf(x.id) })).version;
  await assert.rejects(reassignConsignment(db, accounts.DISPATCHER, key(), { id: x.id, expectedVersion: v, tripId: trip(D6, 3), reason: "ย้ายหลังขึ้นรถ" }), rejected("INVALID_TRANSITION"), "loaded consignments cannot be reassigned");
  await assert.rejects(cancelConsignment(db, accounts.DISPATCHER, key(), { id: x.id, expectedVersion: v, reason: "ยกเลิกหลังขึ้นรถ" }), rejected("INVALID_TRANSITION"));

  const y = await submitted();
  const yv = (await assignConsignment(db, accounts.DISPATCHER, key(), { id: y.id, expectedVersion: y.version, tripId: trip(D6, 3) })).version;
  await assert.rejects(cancelConsignment(db, accounts.REQUESTER, key(), { id: y.id, expectedVersion: yv, reason: "ไม่ต้องการแล้ว" }), rejected("FORBIDDEN"), "requester cannot cancel after assignment");
  assert.equal((await cancelConsignment(db, accounts.DISPATCHER, key(), { id: y.id, expectedVersion: yv, reason: "สาขาแจ้งยกเลิก" })).status, "CANCELLED");
  assert.equal(await db.consignmentAssignment.count({ where: { consignmentId: y.id } }), 1);
  const z = await submitted();
  assert.equal((await cancelConsignment(db, accounts.REQUESTER, key(), { id: z.id, expectedVersion: z.version, reason: "ส่งซ้ำโดยไม่ตั้งใจ" })).status, "CANCELLED");

  // Plan replacement cancels the trip carrying an assigned consignment and moves it atomically (Phase 4 service).
  const w = await submitted({ requestedServiceDate: D7 });
  const wv = (await assignConsignment(db, accounts.DISPATCHER, key(), { id: w.id, expectedVersion: w.version, tripId: trip(D7, 2) })).version;
  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(`${D7}T00:00:00Z`) } });
  const candidate = completeDraft(D7, `p6-${D7}`, plan.version); candidate.trips[0].driverId = "p6-driver";
  const replacement = { ...candidate.trips[1], tripId: `p6-${D7}-trip-2b`, code: `p6-${D7}-trip-2b` };
  candidate.trips[1] = { ...candidate.trips[1], cancelled: true }; candidate.trips.push(replacement); candidate.reason = "ยกเลิกรอบ ๒ และใช้รอบทดแทน";
  const draftRevision = await saveDraft(db, accounts.DISPATCHER, key(), candidate);
  await publishPlan(db, accounts.SUPERVISOR, key(), { revisionId: draftRevision.revisionId, expectedVersion: draftRevision.version, reason: "ย้ายของไปยังรอบทดแทน", reassignments: [{ consignmentId: w.id, expectedVersion: wv, tripId: replacement.tripId, stopSequence: 1 }] });
  const wNow = await db.consignment.findUniqueOrThrow({ where: { id: w.id }, include: { currentAssignment: { include: { tripRevision: true } } } });
  assert.equal(wNow.currentAssignment!.tripId, replacement.tripId); assert.equal(wNow.currentAssignment!.tripRevision.planRevisionId, draftRevision.revisionId);
  const orphans = await db.consignment.count({ where: { status: { in: ["ASSIGNED", "WAREHOUSE_RECEIVED"] }, currentAssignment: { tripRevision: { cancelled: true } } } });
  assert.equal(orphans, 0, "no active consignment points at a cancelled trip");
});

test("T08: a cancelled consignment never blocks re-planning its date; active ones still need an explicit move", async () => {
  // Phase 8 review R1: the same date holds one cancelled and one active consignment.
  const D8 = "2028-06-03";
  const seed = completeDraft(D8, `p6-${D8}`); seed.reason = "แผนสังเคราะห์สำหรับทดสอบการปรับแผน";
  const seeded = await saveDraft(db, synthetic.actorId, `p6-plan-${D8}`, seed);
  await publishPlan(db, synthetic.actorId, `p6-publish-${D8}`, { revisionId: seeded.revisionId, expectedVersion: seeded.version });
  const gone = await submitted({ requestedServiceDate: D8 });
  const goneVersion = (await assignConsignment(db, accounts.DISPATCHER, key(), { id: gone.id, expectedVersion: gone.version, tripId: trip(D8, 1) })).version;
  await cancelConsignment(db, accounts.DISPATCHER, key(), { id: gone.id, expectedVersion: goneVersion, reason: "สาขาแจ้งยกเลิก" });
  const cancelledAssignment = (await db.consignment.findUniqueOrThrow({ where: { id: gone.id } })).currentAssignmentId;
  const active = await submitted({ requestedServiceDate: D8 });
  const activeVersion = (await assignConsignment(db, accounts.DISPATCHER, key(), { id: active.id, expectedVersion: active.version, tripId: trip(D8, 2) })).version;

  // The planner lists only the consignment that really has to move.
  assert.deepEqual((await planningData(db, accounts.DISPATCHER, D8)).linked.map((c) => c.id), [active.id]);

  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(`${D8}T00:00:00Z`) } });
  const candidate = completeDraft(D8, `p6-${D8}`, plan.version); candidate.trips[2].driverId = "p6-driver"; candidate.reason = "เปลี่ยนพนักงานขับรถรอบ ๓";
  const draftRevision = await saveDraft(db, accounts.DISPATCHER, key(), candidate);
  const publish = (reassignments: { consignmentId: string; expectedVersion: number; tripId: string; stopSequence: number }[]) =>
    publishPlan(db, accounts.SUPERVISOR, key(), { revisionId: draftRevision.revisionId, expectedVersion: draftRevision.version, reason: "ปรับแผนหลังมีรายการยกเลิก", reassignments });
  await assert.rejects(publish([]), rejected("REASSIGNMENT_REQUIRED"), "the active consignment still needs an explicit move");
  await assert.rejects(publish([{ consignmentId: active.id, expectedVersion: activeVersion, tripId: trip(D8, 2), stopSequence: 1 }, { consignmentId: gone.id, expectedVersion: goneVersion + 1, tripId: trip(D8, 1), stopSequence: 1 }]), rejected("REASSIGNMENT_REQUIRED"), "a move for a cancelled record is refused, not applied");
  await publish([{ consignmentId: active.id, expectedVersion: activeVersion, tripId: trip(D8, 2), stopSequence: 1 }]);

  const after = await db.consignment.findUniqueOrThrow({ where: { id: gone.id } });
  assert.equal(after.status, "CANCELLED"); assert.equal(after.currentAssignmentId, cancelledAssignment, "cancelled history is left untouched");
  assert.equal(await db.consignmentAssignment.count({ where: { consignmentId: gone.id } }), 1);
  const moved = await db.consignment.findUniqueOrThrow({ where: { id: active.id }, include: { currentAssignment: { include: { tripRevision: true } } } });
  assert.equal(moved.currentAssignment!.tripRevision.planRevisionId, draftRevision.revisionId);
});

test("T13: the eligible-trip lookup hides another user's private draft", async () => {
  // Phase 8 review R4.
  const privateDraft = await saveConsignmentDraft(db, accounts.REQUESTER, key(), draft());
  await assert.rejects(eligibleTrips(db, accounts.DISPATCHER, privateDraft.id, D6), rejected("NOT_FOUND"));
  const submittedRequest = await submitConsignment(db, accounts.REQUESTER, key(), { id: privateDraft.id, expectedVersion: privateDraft.version });
  assert.ok((await eligibleTrips(db, accounts.DISPATCHER, submittedRequest.id, D6)).trips.length > 0, "submitted requests are visible to the dispatcher");
});

test("T13 (D215): the administrator holds every capability, reads private drafts and can run the whole lifecycle", async () => {
  const admin = new Set(rolePermissions.ADMINISTRATOR);
  for (const [role, capabilities] of Object.entries(rolePermissions)) for (const capability of capabilities) assert.ok(admin.has(capability), `${role} capability ${capability} is missing for the administrator`);
  const privateDraft = await saveConsignmentDraft(db, accounts.REQUESTER, key(), draft());
  assert.equal((await consignmentDetail(db, accounts.ADMIN, privateDraft.id)).status, "DRAFT", "the administrator reads other users' drafts");
  assert.ok((await listConsignments(db, accounts.ADMIN, { query: privateDraft.code, status: [], branchId: null, categoryId: null, date: null, tripCode: null, mine: false, page: 1 })).rows.some((r) => r.id === privateDraft.id));
  await assert.rejects(consignmentDetail(db, accounts.DISPATCHER, privateDraft.id), rejected("NOT_FOUND"), "drafts stay private for every other role");
  await assert.rejects(submitConsignment(db, accounts.ADMIN, key(), { id: privateDraft.id, expectedVersion: privateDraft.version }), rejected("FORBIDDEN"), "only the requester submits a request");

  const x = await submitted();
  let v = (await assignConsignment(db, accounts.ADMIN, key(), { id: x.id, expectedVersion: x.version, tripId: trip(D6, 1) })).version;
  v = (await warehouseReceiveConsignment(db, accounts.ADMIN, key(), { id: x.id, expectedVersion: v, packageIds: await packagesOf(x.id) })).version;
  await loadConsignment(db, accounts.ADMIN, key(), { id: x.id, expectedVersion: v, packageIds: await packagesOf(x.id) });
  assert.ok((await departTrip(db, accounts.ADMIN, key(), { tripId: trip(D6, 1) })).departed.includes(x.id));
  const items = await db.consignmentItem.findMany({ where: { consignmentId: x.id } });
  await receiveConsignment(db, accounts.ADMIN, key(), { consignmentId: x.id, expectedVersion: await version(x.id), lines: items.map((i) => ({ itemId: i.id, quantity: i.sentQuantity.toString(), unit: i.unit })) });
  const packages = await packagesOf(x.id);
  await receiveConsignment(db, accounts.ADMIN, key(), { consignmentId: x.id, expectedVersion: await version(x.id), lines: packages.map((packageId) => ({ packageId, quantity: "1", unit: "PACKAGE" })) });
  assert.equal((await closeConsignment(db, accounts.ADMIN, key(), { id: x.id, expectedVersion: await version(x.id) })).status, "CLOSED");
  assert.equal((await planningData(db, accounts.ADMIN, D6)).serviceDate, D6, "planning is open to the administrator");
});

test("T13/T18: scoped history and export, private attachments and invalid uploads", async () => {
  await db.branch.update({ where: { id: B }, data: { contactName: null, contactPhone: null } });
  const s = await submitted({ destinationBranchId: B, recipientName: null, recipientPhone: null }).catch((e) => e);
  assert.ok(rejected("SUBMISSION_INCOMPLETE")(s), "a branch without contacts needs explicit recipient contacts");
  const own = await submitted({ destinationBranchId: B });
  const forA = (await listConsignments(db, accounts.BRANCH_A, { query: "", status: [], branchId: null, categoryId: null, date: null, tripCode: null, mine: false, page: 1 })).rows;
  assert.ok(forA.length > 0 && forA.every((r) => r.branch.code === "SYNTHETIC-1") && !forA.some((r) => r.id === own.id), "branch A sees only its destination");
  const mine = await listConsignments(db, accounts.REQUESTER, { query: "", status: ["PENDING_REVIEW"], branchId: B, categoryId: MARKETING, date: D6, tripCode: null, mine: true, page: 1 });
  assert.deepEqual(mine.rows.map((r) => r.id), [own.id]); assert.equal(mine.total, 1);
  const exported = await listConsignments(db, accounts.DISPATCHER, { query: "", status: [], branchId: null, categoryId: null, date: null, tripCode: null, mine: false, page: 1 }, { export: true });
  assert.ok(exported.rows.every((r) => r.status !== "DRAFT"), "dispatcher export never includes other users' drafts");
  await assert.rejects(listConsignments(db, accounts.REQUESTER, { query: "", status: ["HACKED"], branchId: null, categoryId: null, date: null, tripCode: null, mine: false, page: 1 }), rejected("INVALID_SEARCH"));

  const file = { consignmentId: own.id, displayName: "../ใบเสนอราคา.pdf", contentType: "application/pdf", sizeBytes: 1024, sha256: "a".repeat(64) };
  const attachment = await addAttachment(db, accounts.REQUESTER, key(), { ...file, storageKey: `p6-${randomBytes(8).toString("hex")}` });
  assert.equal((await db.attachment.findUniqueOrThrow({ where: { id: attachment.id } })).displayName, ".._ใบเสนอราคา.pdf", "display names are sanitized");
  await assert.rejects(addAttachment(db, accounts.REQUESTER, key(), { ...file, contentType: "text/html", storageKey: "p6-html" }), rejected("INVALID_FILE"));
  await assert.rejects(addAttachment(db, accounts.REQUESTER, key(), { ...file, sizeBytes: 11 * 1024 * 1024, storageKey: "p6-big" }), rejected("INVALID_FILE"));
  await assert.rejects(addAttachment(db, accounts.DISPATCHER, key(), { ...file, storageKey: "p6-other" }), rejected("FORBIDDEN"));
  for (let n = 0; n < 4; n++) await addAttachment(db, accounts.REQUESTER, key(), { ...file, sha256: String(n).repeat(64), storageKey: `p6-extra-${n}-${randomBytes(4).toString("hex")}` });
  await assert.rejects(addAttachment(db, accounts.REQUESTER, key(), { ...file, sha256: "f".repeat(64), storageKey: "p6-sixth" }), rejected("ATTACHMENT_LIMIT"));
  assert.equal((await attachmentForDownload(db, accounts.BRANCH_B, attachment.id)).contentType, "application/pdf");
  await assert.rejects(attachmentForDownload(db, accounts.BRANCH_A, attachment.id), rejected("FORBIDDEN"), "other branch cannot download");
  await assert.rejects(attachmentForDownload(db, accounts.DRIVER, attachment.id), rejected("FORBIDDEN"));
  const detail = await consignmentDetail(db, accounts.REQUESTER, own.id);
  assert.equal(detail.attachments.length, 5); assert.ok(detail.actions.includes("cancelRequest")); assert.ok(!detail.actions.includes("assign"));
  assert.ok((await consignmentDetail(db, accounts.DISPATCHER, own.id)).actions.includes("assign"));
});
