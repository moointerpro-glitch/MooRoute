import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDraft, packagingPieces, packagingSummary, packagingWeightKg, pieceName, requireTransition, storedPackaging, submissionProblems, transitionMatrix, type DraftInput, type PackagingLine } from "../../src/server/domain/consignment";
import { DomainError } from "../../src/server/domain/errors";
import { parseHistoryFilter } from "../../src/lib/consignment-format";

const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const base: DraftInput = { id: null, expectedVersion: 0, departmentId: "d", sourceWarehouseId: "w", destinationBranchId: "b", requestedServiceDate: "2028-03-01", requestedRoundNo: 1, requestedTripId: null,
  senderName: " ผู้ฝาก ", senderPhone: "000-000-0000", recipientName: "", recipientPhone: null, notes: null, receiptMode: "DETAILED", packageCount: 3, packageWeight: null, packageWeightUnit: null,
  items: [{ categoryId: "m", name: "โปสเตอร์", quantity: "30", unit: "SHEET" }] };

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
  assert.deepEqual(d.packaging, [{ kind: "PACKAGE", customName: null, count: 3, description: null, weight: null }], "a request without packaging lines reads as one generic line");
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...base.items[0], unit: "LITRE" }] }), code("INVALID_UNIT"));
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...base.items[0], quantity: "-1" }] }), code("INVALID_QUANTITY"));
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...base.items[0], quantity: "1.2345" }] }), code("INVALID_QUANTITY"));
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
  assert.deepEqual(d.packaging[3], { kind: "BOX", customName: null, count: 1, description: null, weight: null }, "a custom name is kept only for OTHER; blanks become null");
  const pieces = packagingPieces(lines);
  assert.deepEqual(pieces.map((p) => pieceName(p)), ["ชิ้นที่ 1/6 · กล่อง", "ชิ้นที่ 2/6 · กล่อง", "ชิ้นที่ 3/6 · กล่อง", "ชิ้นที่ 4/6 · ถุง", "ชิ้นที่ 5/6 · ถุง", "ชิ้นที่ 6/6 · ถัง"]);
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
  assert.deepEqual(storedPackaging({ schemaVersion: 2, items: [], packaging: lines }, { packageCount: 6 }), lines);
  assert.deepEqual(storedPackaging({ schemaVersion: 1, items: [] }, { packageCount: 2, packageWeight: "4", packageWeightUnit: "KG" }), [{ kind: "PACKAGE", customName: null, count: 2, description: null, weight: "4" }]);
  assert.deepEqual(storedPackaging(null, { packageCount: 0 }), []);
  assert.deepEqual(packagingPieces(storedPackaging(null, { packageCount: 2 })).map((p) => pieceName(p)), ["ชิ้นที่ 1/2 · หีบห่อ", "ชิ้นที่ 2/2 · หีบห่อ"]);
});

test("submission completeness messages are Thai and explicit", () => {
  const ready = { items: [], packaging: lines, receiptMode: "PACKAGES", senderName: "ก", senderPhone: "1", requestedServiceDate: "2028-03-01" };
  assert.deepEqual(submissionProblems(ready, "2026-10-06", true), [], "the item list is optional (D234)");
  assert.deepEqual(submissionProblems({ ...ready, receiptMode: "DETAILED", items: base.items }, "2026-10-06", true), []);
  assert.ok(submissionProblems({ ...ready, receiptMode: "DETAILED" }, "2026-10-06", true)[0].includes("นับสิ่งของข้างใน"), "detailed receipt needs an item list");
  assert.ok(submissionProblems({ ...ready, packaging: [{ count: 2, description: null }] }, "2026-10-06", true)[0].includes("รายละเอียด"), "without an item list every line says what is inside");
  assert.deepEqual(submissionProblems({ ...ready, packaging: [{ count: 2, description: null }], items: base.items }, "2026-10-06", true), [], "an item list describes the contents");
  const problems = submissionProblems({ items: [], packaging: [], receiptMode: "PACKAGES", senderName: null, senderPhone: null, requestedServiceDate: "2026-10-05" }, "2026-10-06", false);
  assert.equal(problems.length, 4); assert.ok(problems.includes("วันที่ต้องการส่งต้องไม่ย้อนหลัง")); assert.ok(problems[0].includes("สิ่งที่ฝากส่ง"));
});

test("history filters accept Buddhist-era dates and drop unsafe IDs", () => {
  const f = parseHistoryFilter(new URLSearchParams({ date: "01/03/2571", branch: "../x", status: "CLOSED,ISSUE", mine: "1", page: "0" }));
  assert.deepEqual([f.date, f.branchId, f.status, f.mine, f.page], ["2028-03-01", null, ["CLOSED", "ISSUE"], true, 1]);
});
