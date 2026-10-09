import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDraft, packagingContents, packagingCountText, packagingPieces, packagingSummary, packagingWeightKg, pieceName, requireTransition, storedCategory, storedPackaging, submissionProblems, transitionMatrix, type DraftInput, type DraftItemInput, type PackagingLine } from "../../src/server/domain/consignment";
import { consignmentProgress, nextStepText, statusDisplay } from "../../src/lib/consignment-progress";
import { DomainError } from "../../src/server/domain/errors";
import { parseHistoryFilter } from "../../src/lib/consignment-format";

const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const base: DraftInput = { id: null, expectedVersion: 0, departmentId: "d", sourceWarehouseId: "w", destinationBranchId: "b", requestedServiceDate: "2028-03-01", requestedRoundNo: 1, requestedTripId: null,
  senderName: " ผู้ฝาก ", senderPhone: "000-000-0000", recipientName: "", recipientPhone: null, notes: null, receiptMode: "DETAILED", packageCount: 3, packageWeight: null, packageWeightUnit: null,
  items: [{ categoryId: "m", name: "โปสเตอร์", quantity: "30", unit: "SHEET" }] };
const item: DraftItemInput = base.items![0];
const full = (l: Partial<PackagingLine>): PackagingLine => ({ kind: "BOX", customName: null, count: 1, name: null, quantity: null, unit: null, description: null, weight: null, itemId: null, ...l });

test("transition matrix: every state is reachable only through declared actions and terminal states have no exit", () => {
  const states = new Set(Object.values(transitionMatrix).flatMap((t) => t.from));
  for (const terminal of ["CLOSED", "CANCELLED", "REJECTED", "RETURNED"]) assert.ok(!states.has(terminal as never), `${terminal} has no outgoing transition`);
  assert.ok(Object.values(transitionMatrix).every((t) => t.actors.length > 0 && t.prerequisites.length > 0));
  assert.throws(() => requireTransition("load", "ASSIGNED"), code("INVALID_TRANSITION"));
  assert.doesNotThrow(() => requireTransition("receive", "IN_TRANSIT"));
  assert.throws(() => requireTransition("close", "ISSUE"), code("INVALID_TRANSITION"));
});

test("draft normalization keeps item quantity and piece count independent and validates units", () => {
  const d = normalizeDraft(base);
  assert.equal(d.senderName, "ผู้ฝาก"); assert.equal(d.recipientName, null);
  assert.deepEqual([d.items[0].quantity, d.items[0].unit, d.packageCount], ["30", "SHEET", 3]);
  assert.deepEqual(d.packaging, [full({ kind: "PACKAGE", count: 3 })], "a request without packaging lines reads as one generic line");
  assert.deepEqual([d.looseItems, d.categoryId], [d.items, null], "a separate item list from before D236 is kept as given");
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...item, unit: "LITRE" }] }), code("INVALID_UNIT"));
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...item, quantity: "-1" }] }), code("INVALID_QUANTITY"));
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...item, quantity: "1.2345" }] }), code("INVALID_QUANTITY"));
  assert.throws(() => normalizeDraft({ ...base, packageWeight: "5", packageWeightUnit: null }), code("INVALID_WEIGHT"));
  assert.throws(() => normalizeDraft({ ...base, packageCount: 501 }), code("INVALID_PACKAGES"));
  assert.throws(() => normalizeDraft({ ...base, senderPhone: "call me" }), code("INVALID_PHONE"));
  assert.throws(() => normalizeDraft({ ...base, requestedServiceDate: "2028-02-30" }), code("INVALID_DATE"));
});

const lines: PackagingLine[] = [
  { kind: "BOX", customName: null, count: 3, description: "โปสเตอร์โปรโมชัน", weight: "2.5" },
  { kind: "BAG", customName: null, count: 2, description: "ชุดพนักงาน", weight: null },
  { kind: "OTHER", customName: "ถัง", count: 1, description: "น้ำยาล้างพื้น", weight: "0.125" },
];

test("D234: packaging lines are validated, totalled and expanded into numbered pieces", () => {
  const d = normalizeDraft({ ...base, packageCount: undefined, packaging: [...lines, { kind: "BOX", customName: " ไม่ใช้ ", count: 1, description: " ", weight: "" }] });
  assert.equal(d.packageCount, 7, "the piece count is always the total of the lines");
  assert.deepEqual(d.packaging[3], full({}), "a custom name is kept only for OTHER; blanks become null");
  const pieces = packagingPieces(lines);
  assert.deepEqual(pieces.map((p) => pieceName(p)), ["กล่อง 1/6", "กล่อง 2/6", "กล่อง 3/6", "ถุง 4/6", "ถุง 5/6", "ถัง 6/6"], "the packaging is the unit; no generic counter word (D237)");
  assert.deepEqual([packagingCountText(lines), packagingCountText([lines[0]]), packagingCountText([lines[0], lines[0]])], ["กล่อง 3 · ถุง 2 · ถัง 1 (รวม 6)", "กล่อง 3", "กล่อง 6"]);
  assert.deepEqual(pieces.map((p) => [p.line, p.weight]), [[0, "2.5"], [0, "2.5"], [0, "2.5"], [1, null], [1, null], [2, "0.125"]]);
  assert.equal(packagingSummary([...lines, { kind: "BOX", customName: null, count: 2, description: "แก้วน้ำ", weight: null }]), "กล่อง 5 · ถุง 2 · ถัง 1");
  assert.equal(packagingWeightKg(lines), "7.625", "only stated weights are added, without floating-point drift");
  assert.equal(packagingWeightKg([lines[1]]), null, "no stated weight means unknown, not zero");
  for (const bad of [
    [{ ...lines[0], kind: "" }], [{ ...lines[0], kind: "BARREL" }], [{ ...lines[2], customName: " " }], [{ ...lines[0], count: 0 }], [{ ...lines[0], count: 1.5 }],
    [{ ...lines[0], count: 300 }, { ...lines[1], count: 201 }], Array.from({ length: 21 }, () => lines[0]),
  ]) assert.throws(() => normalizeDraft({ ...base, packaging: bad as PackagingLine[] }), code("INVALID_PACKAGES"));
  assert.throws(() => normalizeDraft({ ...base, packaging: [{ ...lines[0], weight: "0" }] }), code("INVALID_WEIGHT"));
  assert.throws(() => normalizeDraft({ ...base, packaging: [{ ...lines[0], weight: "หนักมาก" }] }), code("INVALID_WEIGHT"));
});

test("D234: stored requests read the same way whether saved before or after packaging lines", () => {
  assert.deepEqual(storedPackaging({ schemaVersion: 2, items: [], packaging: lines }, { packageCount: 6 }), lines.map(full));
  assert.deepEqual(storedPackaging({ schemaVersion: 1, items: [] }, { packageCount: 2, packageWeight: "4", packageWeightUnit: "KG" }), [full({ kind: "PACKAGE", count: 2, weight: "4" })]);
  assert.deepEqual([storedCategory({ categoryId: "cat-1" }), storedCategory({ categoryId: "../x" }), storedCategory(null)], ["cat-1", null, null]);
  assert.deepEqual(storedPackaging(null, { packageCount: 0 }), []);
  assert.deepEqual(packagingPieces(storedPackaging(null, { packageCount: 2 })).map((p) => pieceName(p)), ["หีบห่อ 1/2", "หีบห่อ 2/2"]);
});

test("D236: one merged row carries packaging, pieces, contents and an optional inner quantity", () => {
  const rows = [
    { kind: "BOX", customName: null, count: 3, name: " โปสเตอร์โปรโมชัน ", quantity: "30", unit: "SHEET", description: "ระวังพับ", weight: null },
    { kind: "BAG", customName: null, count: 2, name: "ชุดพนักงาน", quantity: "", unit: "", description: "", weight: null },
  ];
  const d = normalizeDraft({ ...base, items: undefined, packageCount: undefined, categoryId: "cat-1", packaging: rows });
  assert.deepEqual(d.packaging[0], full({ count: 3, name: "โปสเตอร์โปรโมชัน", quantity: "30", unit: "SHEET", description: "ระวังพับ" }));
  assert.deepEqual(d.items, [{ categoryId: "cat-1", name: "โปสเตอร์โปรโมชัน", quantity: "30", unit: "SHEET" }], "a row with an inner quantity becomes an item of the request category");
  assert.deepEqual([d.looseItems, d.packageCount], [[], 5]);
  assert.deepEqual(normalizeDraft({ ...base, items: undefined, categoryId: null, packaging: rows }).items, [], "no item balance exists until a category is chosen");
  assert.deepEqual(packagingContents(d.packaging), ["โปสเตอร์โปรโมชัน 30 แผ่น", "ชุดพนักงาน"]);
  assert.deepEqual(packagingPieces(d.packaging).map((p) => p.description), ["โปสเตอร์โปรโมชัน", "โปสเตอร์โปรโมชัน", "โปสเตอร์โปรโมชัน", "ชุดพนักงาน", "ชุดพนักงาน"], "labels print the item name");
  for (const bad of [{ quantity: "30", unit: "" }, { quantity: "", unit: "SHEET" }, { quantity: "30", unit: "LITRE" }]) assert.throws(() => normalizeDraft({ ...base, items: undefined, packaging: [{ ...rows[0], ...bad }] }), code("INVALID_UNIT"));
  assert.throws(() => normalizeDraft({ ...base, items: undefined, packaging: [{ ...rows[0], quantity: "0" }] }), code("INVALID_QUANTITY"));
  assert.throws(() => normalizeDraft({ ...base, items: undefined, packaging: [{ ...rows[0], name: " " }] }), code("INVALID_ITEMS"), "an inner quantity needs an item name");
  assert.throws(() => normalizeDraft({ ...base, packaging: rows }), code("INVALID_ITEMS"), "a separate item list cannot be combined with inner quantities");
  assert.throws(() => normalizeDraft({ ...base, items: undefined, categoryId: "../x", packaging: rows }), code("INVALID_INPUT"));
});

test("submission completeness messages are Thai and explicit", () => {
  const rows = [{ count: 3, name: "โปสเตอร์", description: null, quantity: "30" }, { count: 2, name: "ชุดพนักงาน", description: null, quantity: null }];
  const ready = { items: [item], packaging: rows, receiptMode: "PACKAGES", categoryId: "cat-1", senderName: "ก", senderPhone: "1", requestedServiceDate: "2028-03-01" };
  assert.deepEqual(submissionProblems(ready, "2026-10-06", true), []);
  assert.deepEqual(submissionProblems({ ...ready, receiptMode: "DETAILED" }, "2026-10-06", true), []);
  assert.deepEqual(submissionProblems({ ...ready, items: [], packaging: [rows[1]] }, "2026-10-06", true), [], "the inner quantity is optional");
  assert.ok(submissionProblems({ ...ready, items: [], packaging: [rows[1]], receiptMode: "DETAILED" }, "2026-10-06", true)[0].includes("จำนวนข้างใน"), "counting the contents needs an inner quantity");
  assert.ok(submissionProblems({ ...ready, packaging: [rows[0], { count: 2, name: null, description: null, quantity: null }] }, "2026-10-06", true)[0].includes("ชื่อรายการ"), "every row says what is inside");
  assert.deepEqual(submissionProblems({ ...ready, categoryId: null, items: [] }, "2026-10-06", true), ["กรุณาเลือกหมวดสิ่งของ"]);
  // Requests saved before D236: a separate item list, or a description instead of a name, is still complete.
  assert.deepEqual(submissionProblems({ ...ready, categoryId: null, items: [item], packaging: [{ count: 3, name: null, description: null, quantity: null }] }, "2026-10-06", true), []);
  assert.deepEqual(submissionProblems({ ...ready, items: [], packaging: [{ count: 3, name: null, description: "โปสเตอร์", quantity: null }] }, "2026-10-06", true), []);
  const problems = submissionProblems({ items: [], packaging: [], receiptMode: "PACKAGES", senderName: null, senderPhone: null, requestedServiceDate: "2026-10-05" }, "2026-10-06", false);
  assert.equal(problems.length, 5); assert.ok(problems.includes("วันที่ต้องการส่งต้องไม่ย้อนหลัง")); assert.ok(problems[0].includes("สิ่งที่ฝากส่ง"));
});

test("D236: no reject action; a reviewer cancels a pending request, never a draft", () => {
  assert.equal(transitionMatrix.reject, undefined);
  assert.deepEqual(transitionMatrix.cancelPending.from, ["PENDING_REVIEW"]);
  assert.deepEqual(transitionMatrix.cancelPending.actors, [{ capability: "consignment.assign", scope: "GLOBAL" }]);
  assert.deepEqual(transitionMatrix.cancelRequest.actors, [{ capability: "consignment.create", scope: "OWN_REQUESTER" }], "a draft stays with its requester");
});

test("D236: progress shows what is done, where the request is and what remains, from recorded facts only", () => {
  const at = (n: number) => `2028-03-01T0${n}:00:00.000Z`, ev = (kind: string, n: number, payload?: Record<string, unknown>) => ({ kind, at: at(n), actor: `คนที่ ${n}`, payload });
  const states = (p: ReturnType<typeof consignmentProgress>) => p.steps.map((s) => s.state);
  const input = { resumeStatus: null, received: 0, pieces: 3, incomplete: false };
  const draft = consignmentProgress({ ...input, status: "DRAFT", events: [], pieces: 0 });
  assert.deepEqual(states(draft), ["current", "todo", "todo", "todo", "todo", "todo", "todo"]); assert.equal(draft.next, "รอผู้ฝากส่งคำขอ");
  const loaded = consignmentProgress({ ...input, status: "LOADED", events: [ev("SUBMITTED", 1), ev("ASSIGNED", 2), ev("ASSIGNED", 3, { type: "ADDRESS_CORRECTION" }), ev("WAREHOUSE_RECEIVED", 4), ev("LOADED", 5)] });
  assert.deepEqual(states(loaded), ["done", "done", "done", "done", "current", "todo", "todo"]);
  assert.deepEqual([loaded.steps[1].at, loaded.steps[1].actor], [at(2), "คนที่ 2"], "an address correction is not the moment the trip was chosen");
  assert.equal(loaded.next, "รอคลังต้นทางหรือคนขับบันทึกรถออก"); assert.equal(loaded.steps[6].label, "จัดส่งสำเร็จ");
  const partial = consignmentProgress({ ...input, status: "PARTIALLY_RECEIVED", received: 2, events: [ev("SUBMITTED", 1), ev("ASSIGNED", 2), ev("WAREHOUSE_RECEIVED", 3), ev("LOADED", 4), ev("DEPARTED", 5), ev("RECEIPT", 6)] });
  assert.equal(partial.steps[5].state, "current"); assert.ok(partial.next.includes("รับแล้ว 2 จาก 3 รอสาขา"));
  // A receipt corrected before the departure was recorded: the departure is shown as not recorded, never as done.
  const corrected = consignmentProgress({ ...input, status: "CLOSED", received: 3, events: [ev("SUBMITTED", 1), ev("ASSIGNED", 2), ev("WAREHOUSE_RECEIVED", 3), ev("LOADED", 4), ev("RECEIPT", 6), ev("CLOSED", 7)] });
  assert.deepEqual(states(corrected), ["done", "done", "done", "done", "skipped", "done", "done"]); assert.equal(corrected.next, "จัดส่งสำเร็จ");
  const short = consignmentProgress({ ...input, status: "CLOSED", incomplete: true, received: 2, events: [ev("SUBMITTED", 1), ev("ASSIGNED", 2), ev("WAREHOUSE_RECEIVED", 3), ev("LOADED", 4), ev("DEPARTED", 5), ev("RECEIPT", 6), ev("CLOSED", 7)] });
  assert.equal(short.steps[6].label, "ปิดงาน (ส่งไม่ครบ)"); assert.equal(short.next, "ปิดงาน (ส่งไม่ครบ)");
  const cancelled = consignmentProgress({ ...input, status: "CANCELLED", events: [ev("SUBMITTED", 1), ev("ASSIGNED", 2), ev("CANCELLED", 3, { reason: "สาขาแจ้งยกเลิก" })] });
  assert.deepEqual(states(cancelled), ["done", "done", "unreached", "unreached", "unreached", "unreached", "unreached"]);
  assert.deepEqual(cancelled.stopped, { label: "ยกเลิกแล้ว", at: at(3), actor: "คนที่ 3", reason: "สาขาแจ้งยกเลิก" });
  const issue = consignmentProgress({ ...input, status: "ISSUE", resumeStatus: "IN_TRANSIT", events: [ev("SUBMITTED", 1), ev("ASSIGNED", 2), ev("WAREHOUSE_RECEIVED", 3), ev("LOADED", 4), ev("DEPARTED", 5), ev("ISSUE", 6)] });
  assert.equal(issue.steps[5].state, "current"); assert.deepEqual(issue.issue, { at: at(6), actor: "คนที่ 6" }); assert.ok(issue.next.startsWith("พบปัญหา"));
  assert.deepEqual([nextStepText("PENDING_REVIEW"), nextStepText("RECEIVED"), nextStepText("CANCELLED")], ["รอผู้วางแผนขนส่งจัดรถ", "รอสาขาหรือผู้วางแผนขนส่งยืนยันจัดส่งสำเร็จ", "ยกเลิกแล้ว"]);
  assert.deepEqual([statusDisplay("CLOSED"), statusDisplay("CLOSED", true), statusDisplay("IN_TRANSIT")], ["จัดส่งสำเร็จ", "ปิดงาน (ส่งไม่ครบ)", "อยู่ระหว่างขนส่ง"]);
});

test("history filters accept Buddhist-era dates and drop unsafe IDs", () => {
  const f = parseHistoryFilter(new URLSearchParams({ date: "01/03/2571", branch: "../x", status: "CLOSED,ISSUE", mine: "1", page: "0" }));
  assert.deepEqual([f.date, f.branchId, f.status, f.mine, f.page], ["2028-03-01", null, ["CLOSED", "ISSUE"], true, 1]);
});
