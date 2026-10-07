import assert from "node:assert/strict";
import { test } from "node:test";
import { departureStatus } from "../../src/lib/departure-status";
import { addDays, daysBetween, weekStart } from "../../src/lib/planning-horizon";

const at = (iso: string) => new Date(iso);
// 06:00 Bangkok on 7 Oct 2026 is 23:00 UTC the day before.
const trip = { cancelled: false, departureAt: "2026-10-06T23:00:00.000Z", departedAt: null as string | null };

test("D225: without a recorded departure the status is worded as the plan, never as a fact", () => {
  const before = departureStatus(trip, at("2026-10-06T22:59:00Z")), after = departureStatus(trip, at("2026-10-06T23:00:00Z"));
  assert.deepEqual([before.code, before.text, before.detail], ["WAITING", "ยังไม่ถึงเวลาออก", "ออกตามแผน 06:00 น."]);
  assert.deepEqual([after.code, after.text], ["DUE", "ถึงเวลาออกตามแผนแล้ว"]);
  assert.match(after.detail, /ยังไม่มีการบันทึกรถออก/);
  assert.ok(![before.text, after.text].includes("รถออกแล้ว"));
});

test("D225: a recorded departure says so with its time; cancelled and unknown times are stated plainly", () => {
  const departed = departureStatus({ ...trip, departedAt: "2026-10-06T23:07:00.000Z" }, at("2026-10-06T22:00:00Z"));
  assert.deepEqual([departed.code, departed.text, departed.detail], ["DEPARTED", "รถออกแล้ว", "บันทึกรถออกเมื่อ 06:07 น."]);
  assert.equal(departureStatus({ ...trip, cancelled: true, departedAt: "2026-10-06T23:07:00.000Z" }, at("2026-10-07T00:00:00Z")).code, "CANCELLED");
  assert.equal(departureStatus({ ...trip, departureAt: null }, at("2026-10-07T00:00:00Z")).text, "ยังไม่ระบุเวลาออก");
});

test("D225: planning date helpers", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(daysBetween("2026-10-07", "2026-10-21"), 14);
  assert.equal(weekStart("2026-10-07"), "2026-10-05", "Wednesday belongs to the week starting Monday");
  assert.equal(weekStart("2026-10-11"), "2026-10-05", "Sunday closes the week");
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
});
