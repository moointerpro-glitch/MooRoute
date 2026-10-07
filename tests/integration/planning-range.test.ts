import "dotenv/config";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { installRoles } from "../../src/server/auth/permissions";
import { provisionAccount } from "../../src/server/auth/provision";
import { DomainError } from "../../src/server/domain/errors";
import { saveTemplate } from "../../src/server/services/planning-catalog";
import { saveDraft } from "../../src/server/services/plans";
import { planningData } from "../../src/server/services/planning-read";
import { generatePlans, planningOverview, publishPlans } from "../../src/server/services/planning-range";
import { bangkokServiceDate } from "../../src/lib/bangkok-date";
import { DRAFT_AHEAD_DAYS, PUBLISH_AHEAD_DAYS, addDays } from "../../src/lib/planning-horizon";
import { seedMasters, synthetic } from "../fixtures/synthetic";

// D225: multi-day planning tools against real MySQL. Dates are relative to today because the limits are.
const db = createDatabase(testDatabaseConfiguration(process.env)), accounts: Record<string, string> = {};
const today = bangkokServiceDate(), day = (n: number) => addDays(today, n);
let seq = 0;
const key = () => `range-${++seq}`;
const rejected = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const outcomes = (r: { results: { outcome: string }[] }) => r.results.map((x) => x.outcome);

before(async () => {
  await seedMasters(db); await installRoles(db);
  const password = randomBytes(24).toString("base64url");
  accounts.PLANNER = (await provisionAccount(db, { email: "range-planner@synthetic.test", name: "ผู้วางแผนทดสอบหลายวัน", password, role: "DISPATCHER", scope: "GLOBAL", departmentId: "synthetic-department" })).id;
  accounts.BRANCH = (await provisionAccount(db, { email: "range-branch@synthetic.test", name: "สาขาทดสอบหลายวัน", password, role: "BRANCH_RECEIVER", scope: "BRANCH", scopeId: synthetic.branchIds[0], departmentId: "synthetic-department" })).id;
  // The fixture template has no vehicle and could never be published; these tests use their own complete set.
  await db.scheduleTemplate.update({ where: { id: "synthetic-template" }, data: { active: false } });
});
after(async () => { await db.$disconnect(); });

test("D225: a range with no template in effect creates nothing, not empty plans", async () => {
  const made = await generatePlans(db, accounts.PLANNER, key(), { from: day(1), to: day(2), reason: "ยังไม่มีแม่แบบ" });
  assert.deepEqual(outcomes(made), ["skipped", "skipped"]);
  assert.ok(made.results.every((r) => r.message.includes("ไม่มีแม่แบบ")));
  assert.equal(await db.dailyPlan.count({ where: { serviceDate: { in: [day(1), day(2)].map((d) => new Date(`${d}T00:00:00Z`)) } } }), 0);
});

test("D225: drafts for several dates come from the templates; existing plans are never touched; the overview reports each date", async () => {
  for (const [n, load, depart, arrive] of [[1, 300, 360, 600], [2, 660, 720, 900], [3, 960, 1020, 1200]]) {
    await saveTemplate(db, accounts.PLANNER, key(), { id: `range-template-${n}`, code: `RANGE-R${n}`, expectedVersion: 0, active: true, effectiveFrom: "2026-01-01", effectiveTo: null, reason: "แม่แบบทดสอบหลายวัน",
      routeRevisionId: "synthetic-route-v1", kind: "BRANCH_DELIVERY", roundNo: n, vehicleId: synthetic.vehicleIds[n - 1], driverId: null, loadingMinute: load, departureMinute: depart, arrivalMinute: arrive, arrivalDayOffset: 0,
      occupancyStartMinute: load, occupancyEndMinute: arrive, bufferMinutes: 15, notes: null, weekdays: [1, 2, 3, 4, 5, 6, 7],
      categories: [0, 1, 2].map((i) => ({ routeStopId: `synthetic-route-stop-${i}`, categoryIds: [...synthetic.categoryIds] })) });
  }
  const before = await planningOverview(db, accounts.PLANNER, today, 7);
  assert.deepEqual(before.upcomingMissing, Array.from({ length: 7 }, (_, n) => day(n)), "nothing is published yet");
  assert.deepEqual(before.days.map((d) => d.status), Array(7).fill("NONE"));
  assert.equal(before.days[0].required, 18, "three open branches x three rounds x pork and chicken");

  const made = await generatePlans(db, accounts.PLANNER, key(), { from: day(1), to: day(5), reason: "สร้างร่างล่วงหน้าทดสอบ" });
  assert.deepEqual(outcomes(made), Array(5).fill("done"));
  assert.ok(made.results.every((r) => r.message === "สร้างร่าง 3 เที่ยว"));
  assert.deepEqual(outcomes(await generatePlans(db, accounts.PLANNER, key(), { from: day(1), to: day(5), reason: "สร้างซ้ำ" })), Array(5).fill("skipped"));
  assert.equal(await db.planRevision.count({ where: { plan: { serviceDate: new Date(`${day(1)}T00:00:00Z`) } } }), 1, "a second run adds no revision");

  const overview = await planningOverview(db, accounts.PLANNER, today, 7);
  assert.deepEqual(overview.days.slice(1, 6).map((d) => [d.status, d.covered, d.required, d.trips, d.bulkPublishable]), Array(5).fill(["DRAFT", 18, 18, 3, true]));
  assert.deepEqual([overview.days[0].status, overview.days[0].bulkPublishable, overview.days[0].bulkBlocker], ["NONE", false, "ยังไม่มีแผน"]);
});

test("D225: only untouched template drafts are published together; a hand-edited date must be opened and confirmed", async () => {
  // Saving day 2 again, even unchanged, makes it a hand-made revision.
  const data = await planningData(db, accounts.PLANNER, day(2));
  await saveDraft(db, accounts.PLANNER, key(), { serviceDate: day(2), expectedVersion: data.version, trips: data.trips, reason: "แก้ไขด้วยมือ" });
  const edited = (await planningOverview(db, accounts.PLANNER, day(2), 1)).days[0];
  assert.deepEqual([edited.status, edited.bulkPublishable], ["DRAFT", false]);
  assert.match(edited.bulkBlocker, /แก้ไขด้วยมือ/);

  const published = await publishPlans(db, accounts.PLANNER, key(), { from: today, to: day(5), reason: "เผยแพร่หลายวันทดสอบ" });
  assert.deepEqual(outcomes(published), ["skipped", "done", "skipped", "done", "done", "done"]);
  assert.equal(published.results[0].message, "ยังไม่มีแผน");
  assert.match(published.results[2].message, /แก้ไขด้วยมือ/);
  const after = await planningOverview(db, accounts.PLANNER, today, 7);
  assert.deepEqual(after.days.map((d) => d.status), ["NONE", "PUBLISHED", "DRAFT", "PUBLISHED", "PUBLISHED", "PUBLISHED", "NONE"]);
  assert.deepEqual(after.upcomingMissing, [day(0), day(2), day(6)]);
  // Each date went through the normal publication: reservations and the required-branch snapshot exist.
  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(`${day(1)}T00:00:00Z`) } });
  assert.equal(await db.vehicleReservation.count({ where: { active: true, tripRevision: { planRevisionId: plan.publishedRevisionId! } } }), 3);
  assert.equal(await db.planBranch.count({ where: { planRevisionId: plan.publishedRevisionId! } }), 3);
  assert.ok(await db.auditLog.findFirst({ where: { action: "PLAN_PUBLISHED", entityId: plan.id, actorId: accounts.PLANNER } }));
  const again = await publishPlans(db, accounts.PLANNER, key(), { from: day(1), to: day(1), reason: "เผยแพร่ซ้ำ" });
  assert.deepEqual([again.results[0].outcome, again.results[0].message], ["skipped", "เผยแพร่แล้ว"]);
});

test("D225: limits and permissions are enforced on the server", async () => {
  const reason = "ทดสอบขอบเขต";
  await assert.rejects(generatePlans(db, accounts.PLANNER, key(), { from: day(-1), to: day(1), reason }), rejected("PAST_DATE"));
  await assert.rejects(generatePlans(db, accounts.PLANNER, key(), { from: day(DRAFT_AHEAD_DAYS), to: day(DRAFT_AHEAD_DAYS + 1), reason }), rejected("BEYOND_HORIZON"));
  await assert.rejects(publishPlans(db, accounts.PLANNER, key(), { from: day(PUBLISH_AHEAD_DAYS), to: day(PUBLISH_AHEAD_DAYS + 1), reason }), rejected("BEYOND_HORIZON"));
  await assert.rejects(generatePlans(db, accounts.PLANNER, key(), { from: day(0), to: day(40), reason }), rejected("INVALID_RANGE"));
  await assert.rejects(generatePlans(db, accounts.PLANNER, key(), { from: day(3), to: day(2), reason }), rejected("INVALID_RANGE"));
  await assert.rejects(generatePlans(db, accounts.PLANNER, key(), { from: day(1), to: day(2), reason: "" }), rejected("REASON_REQUIRED"));
  await assert.rejects(planningOverview(db, accounts.BRANCH, today, 7), rejected("FORBIDDEN"));
  await assert.rejects(generatePlans(db, accounts.BRANCH, key(), { from: day(7), to: day(8), reason }), rejected("FORBIDDEN"));
  await assert.rejects(publishPlans(db, accounts.BRANCH, key(), { from: day(2), to: day(2), reason }), rejected("FORBIDDEN"));
  assert.equal(await db.dailyPlan.count({ where: { serviceDate: { in: [day(7), day(8)].map((d) => new Date(`${d}T00:00:00Z`)) } } }), 0);
});
