import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDraft, requireTransition, submissionProblems, transitionMatrix, type DraftInput } from "../../src/server/domain/consignment";
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

test("draft normalization keeps item quantity and package count independent and validates units", () => {
  const d = normalizeDraft(base);
  assert.equal(d.senderName, "ผู้ฝาก"); assert.equal(d.recipientName, null);
  assert.deepEqual([d.items[0].quantity, d.items[0].unit, d.packageCount], ["30", "SHEET", 3]);
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...base.items[0], unit: "LITRE" }] }), code("INVALID_UNIT"));
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...base.items[0], quantity: "-1" }] }), code("INVALID_QUANTITY"));
  assert.throws(() => normalizeDraft({ ...base, items: [{ ...base.items[0], quantity: "1.2345" }] }), code("INVALID_QUANTITY"));
  assert.throws(() => normalizeDraft({ ...base, packageWeight: "5", packageWeightUnit: null }), code("INVALID_WEIGHT"));
  assert.throws(() => normalizeDraft({ ...base, packageCount: 501 }), code("INVALID_PACKAGES"));
  assert.throws(() => normalizeDraft({ ...base, senderPhone: "call me" }), code("INVALID_PHONE"));
  assert.throws(() => normalizeDraft({ ...base, requestedServiceDate: "2028-02-30" }), code("INVALID_DATE"));
});

test("submission completeness messages are Thai and explicit", () => {
  assert.deepEqual(submissionProblems({ items: base.items, packageCount: 3, senderName: "ก", senderPhone: "1", requestedServiceDate: "2028-03-01" }, "2026-10-06", true), []);
  const problems = submissionProblems({ items: [], packageCount: 0, senderName: null, senderPhone: null, requestedServiceDate: "2026-10-05" }, "2026-10-06", false);
  assert.equal(problems.length, 5); assert.ok(problems.includes("วันที่ต้องการส่งต้องไม่ย้อนหลัง"));
});

test("history filters accept Buddhist-era dates and drop unsafe IDs", () => {
  const f = parseHistoryFilter(new URLSearchParams({ date: "01/03/2571", branch: "../x", status: "CLOSED,ISSUE", mine: "1", page: "0" }));
  assert.deepEqual([f.date, f.branchId, f.status, f.mine, f.page], ["2028-03-01", null, ["CLOSED", "ISSUE"], true, 1]);
});
