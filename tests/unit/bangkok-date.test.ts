import test from "node:test";
import assert from "node:assert/strict";
import { bangkokServiceDate, thaiServiceDate } from "../../src/lib/bangkok-date";

test("service date changes at Bangkok midnight, independently of machine timezone", () => {
  assert.equal(bangkokServiceDate(new Date("2026-10-05T16:59:59.999Z")), "2026-10-05");
  assert.equal(bangkokServiceDate(new Date("2026-10-05T17:00:00.000Z")), "2026-10-06");
});
test("Thai display uses Buddhist era and rejects impossible dates", () => {
  assert.equal(thaiServiceDate("2026-10-06"), "6 ตุลาคม 2569");
  assert.throws(() => thaiServiceDate("2026-02-30"));
  assert.throws(() => thaiServiceDate("06/10/2026"));
});
