import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { installRoles } from "../../src/server/auth/permissions";
import { provisionAccount } from "../../src/server/auth/provision";
import { DomainError } from "../../src/server/domain/errors";
import { parseSearchInput, type SearchInput } from "../../src/server/domain/search";
import { searchTrips, suggestBranches, tripDetail, branchDirectory, searchOptions } from "../../src/server/services/trip-search";
import { synthetic } from "../fixtures/synthetic";
import { seedSearchFixture, searchFixture } from "../fixtures/search";

const db = createDatabase(testDatabaseConfiguration(process.env));
const accounts: Record<string, string> = {};
const [A, B, C] = synthetic.branchIds, [PORK, CHICKEN] = synthetic.categoryIds;
const { date, nextDate, unknownDate } = searchFixture;
const id = (suffix: string, day = date) => `s5-${day}-${suffix}`;
const rejected = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const input = (values: Record<string, string>) => parseSearchInput(new URLSearchParams({ date, ...values }), date);
const search = async (values: Record<string, string>, actor = accounts.SUPERVISOR, pageSize?: number) => {
  const parsed: SearchInput = input(values);
  return searchTrips(db, actor, pageSize ? { ...parsed, pageSize } : parsed);
};
const tripIds = (result: Awaited<ReturnType<typeof search>>) => result.rows.map((r) => r.tripId);

before(async () => {
  await seedSearchFixture(db);
  await installRoles(db);
  const password = randomBytes(24).toString("base64url");
  const plan: Array<[string, "GLOBAL" | "BRANCH" | "DEPARTMENT" | "DRIVER", string | undefined]> = [
    ["SUPERVISOR", "GLOBAL", undefined], ["BRANCH_RECEIVER", "BRANCH", A], ["REQUESTER", "DEPARTMENT", "synthetic-department"],
    ["DRIVER", "DRIVER", searchFixture.driverId], ["ADMINISTRATOR", "GLOBAL", undefined],
  ];
  for (const [role, scope, scopeId] of plan) {
    accounts[role] = (await provisionAccount(db, { email: `p5-${role.toLowerCase()}@synthetic.test`, name: `ผู้ทดสอบค้นหา ${role}`, password, role, scope, scopeId })).id;
  }
});
after(async () => { await db.$disconnect(); });

test("T04: branch and category must match at the same stop; aliases, Thai input and ambiguity", async () => {
  const chickenAtA = await search({ mode: "branch", branch: A, categories: CHICKEN });
  assert.ok(!tripIds(chickenAtA).includes(id("split")), "pork at A plus chicken at B must not satisfy A + chicken");
  assert.ok(tripIds(chickenAtA).includes(id("dup")));
  assert.deepEqual(chickenAtA.rows.find((r) => r.tripId === id("dup"))!.matchedSequences, [3]);
  const porkAtA = await search({ mode: "branch", branch: A, categories: PORK });
  assert.ok(tripIds(porkAtA).includes(id("split")));
  const chickenAnywhere = await search({ mode: "time", categories: CHICKEN });
  assert.ok(tripIds(chickenAnywhere).includes(id("split")) && !tripIds(chickenAnywhere).includes(id("late")));

  const alias = await search({ mode: "branch", q: searchFixture.aliasA });
  assert.equal(alias.resolution.status, "RESOLVED"); assert.equal(alias.resolution.branch?.id, A);
  assert.deepEqual(tripIds(alias).sort(), tripIds(await search({ mode: "branch", branch: A })).sort());
  const thaiDigits = await search({ mode: "branch", q: "  สาขาสังเคราะห์  ๒ " });
  assert.equal(thaiDigits.resolution.branch?.id, B);
  const code = await search({ mode: "branch", q: "synthetic-3" });
  assert.equal(code.resolution.branch?.id, C, "branch code matching is case-insensitive");
  const shared = await search({ mode: "branch", q: searchFixture.sharedAlias });
  assert.equal(shared.resolution.status, "AMBIGUOUS"); assert.equal(shared.total, 0);
  assert.deepEqual(shared.resolution.candidates.map((c) => c.id).sort(), [B, C].sort());
  const missing = await search({ mode: "branch", q: "ไม่มีสาขานี้แน่นอน" });
  assert.equal(missing.resolution.status, "NOT_FOUND"); assert.equal(missing.total, 0);
  const wildcard = await search({ mode: "branch", q: "%" });
  assert.equal(wildcard.resolution.status, "NOT_FOUND", "LIKE wildcards are literal text");
  const suggestions = await suggestBranches(db, accounts.REQUESTER, "แจ้ห่ม");
  assert.deepEqual(suggestions.candidates.map((c) => [c.id, c.alias]), [[A, searchFixture.aliasA]]);
});

test("T05: exact times use OR, ranges include both endpoints and duplicate stops return one trip", async () => {
  const times = await search({ mode: "time", times: "480,540" });
  assert.deepEqual(tripIds(times), [id("trip-1"), id("dup"), id("split")]);
  assert.equal(times.total, 3);
  const range = await search({ mode: "range", from: "08:00", to: "09:00" });
  assert.deepEqual(tripIds(range), tripIds(times));
  assert.equal((await search({ mode: "range", from: "08:01", to: "08:59" })).total, 0);
  assert.deepEqual(tripIds(await search({ mode: "range", from: "15:30", to: "16:00" })), [id("1530"), id("trip-3")]);
  await assert.rejects(search({ mode: "range", from: "16:00", to: "15:30" }), rejected("INVALID_RANGE"));
  await assert.rejects(search({ mode: "range", from: "16:00" }), rejected("INVALID_RANGE"));
  const duplicate = await search({ mode: "branch", branch: A });
  assert.equal(tripIds(duplicate).filter((t) => t === id("dup")).length, 1);
  assert.deepEqual(duplicate.rows.find((r) => r.tripId === id("dup"))!.matchedSequences, [1, 3]);
  assert.equal(new Set(tripIds(duplicate)).size, duplicate.rows.length);
});

test("T06: loading is not departure, unknown times never match and Bangkok midnight keeps the service date", async () => {
  assert.equal((await search({ mode: "time", times: "420" })).total, 0, "07:00 is a loading time, not a departure");
  assert.deepEqual(tripIds(await search({ mode: "time", times: "420", basis: "loading" })), [id("trip-1")]);
  const loading = await search({ mode: "range", from: "00:00", to: "23:59", basis: "loading" });
  assert.ok(!tripIds(loading).includes(id("split")), "null loading time never matches");
  assert.ok(!tripIds(loading).includes(id("early")), "loading on the previous local day is outside the selected date");
  assert.equal(loading.facets.unknownCount, 1);
  assert.ok(loading.facets.times.some((t) => t.offset === -15 && t.label === "23:45 (วันก่อนหน้า)"));
  const early = (await search({ mode: "time", times: "-15", basis: "loading" })).rows[0];
  assert.equal(early.tripId, id("early")); assert.equal(early.loading?.label, "23:45 (วันก่อนหน้า)"); assert.equal(early.departure?.label, "00:15");

  assert.deepEqual(tripIds(await search({ mode: "range", from: "23:59", to: "23:59" })), [id("late")]);
  assert.deepEqual(tripIds(await search({ mode: "range", from: "00:00", to: "00:15" })), [id("early")]);
  const late = (await search({ mode: "range", from: "23:59", to: "23:59" })).rows[0];
  assert.equal(late.arrival?.label, "01:00 (วันถัดไป)");
  assert.equal((await search({ mode: "time", times: "1440" })).total, 0, "next-day midnight does not belong to this date");
  const midnight = await search({ date: nextDate, mode: "range", from: "00:00", to: "00:00" });
  assert.deepEqual(tripIds(midnight), [`s5n-${nextDate}-midnight`]);
  assert.equal(midnight.rows[0].departure?.at, "2028-03-01T17:00:00.000Z");

  const unknownAll = await search({ date: unknownDate, mode: "time" });
  const unknown = unknownAll.rows.find((r) => r.tripId === `s5u-${unknownDate}-unknown`);
  assert.ok(unknown && unknown.departure === null, "unknown departure remains unknown and is listed last");
  assert.equal(unknownAll.rows.at(-1)?.tripId, unknown.tripId);
  const unknownRange = await search({ date: unknownDate, mode: "range", from: "00:00", to: "23:59" });
  assert.ok(!tripIds(unknownRange).includes(unknown.tripId)); assert.equal(unknownRange.total, unknownAll.total - 1);
});

test("T20: counts, chips, sorting and pagination follow one predicate", async () => {
  const all = await search({ mode: "time" }, accounts.SUPERVISOR, 50);
  assert.equal(all.total, 8); assert.equal(all.rows.length, 8); assert.equal(all.facets.tripCount, 8);
  assert.ok(!tripIds(all).includes(id("cancel")) && !tripIds(all).includes(id("van")), "cancelled and non-default kinds are excluded");
  assert.deepEqual(all.facets.times.map((t) => t.label), ["00:15", "08:00", "09:00", "12:00", "15:30", "16:00", "23:59"]);
  assert.deepEqual(all.facets.span && [all.facets.span.fromLabel, all.facets.span.toLabel], ["00:15", "23:59"]);
  const pages = [];
  for (let page = 1; page <= 3; page++) {
    const result = await search({ mode: "time", page: String(page) }, accounts.SUPERVISOR, 3);
    assert.equal(result.total, 8); assert.equal(result.pageCount, 3); pages.push(...tripIds(result));
  }
  assert.deepEqual(pages, tripIds(all));
  const desc = await search({ mode: "time", sort: "time_desc" }, accounts.SUPERVISOR, 50);
  assert.deepEqual(tripIds(desc), [id("late"), id("trip-3"), id("1530"), id("trip-2"), id("dup"), id("split"), id("trip-1"), id("early")]);
  const round1 = await search({ mode: "time", rounds: "1" }, accounts.SUPERVISOR, 50);
  assert.ok(round1.rows.every((r) => r.roundNo === 1)); assert.equal(round1.total, round1.facets.tripCount);
  const van = await search({ mode: "time", kinds: "VAN_SALES" });
  assert.deepEqual(tripIds(van), [id("van")]); assert.equal(van.rows[0].roundNo, null);
  assert.equal((await search({ mode: "time", kinds: "VAN_SALES", rounds: "1,2,3" })).total, 0);
  const filtered = await search({ mode: "branch", branch: A, categories: CHICKEN, rounds: "2" });
  assert.equal(filtered.total, filtered.rows.length);
  assert.ok(filtered.rows.every((r) => r.roundNo === 2 && r.stops.some((s) => s.matched && s.branchId === A && s.categories.some((c) => c.id === CHICKEN))));
  assert.equal((await search({ date: "2032-01-01", mode: "time" })).published, null);
});

test("T13: search, detail, directory and contacts are scoped on the server", async () => {
  const branchUser = await search({ mode: "time" }, accounts.BRANCH_RECEIVER, 50);
  assert.ok(branchUser.rows.every((r) => r.stops.some((s) => s.branchId === A)));
  assert.deepEqual(tripIds(branchUser).sort(), [id("dup"), id("split"), id("trip-1"), id("trip-2"), id("trip-3")].sort());
  assert.equal(branchUser.facets.tripCount, 5, "facets use the same row scope");
  const visibleContacts = branchUser.rows.flatMap((r) => r.stops.filter((s) => s.contact.visible).map((s) => s.branchId));
  assert.ok(visibleContacts.length > 0 && visibleContacts.every((b) => b === A));
  await assert.rejects(tripDetail(db, accounts.BRANCH_RECEIVER, id("1530")), rejected("NOT_FOUND"));

  const requester = await search({ mode: "time" }, accounts.REQUESTER, 50);
  assert.equal(requester.total, 8);
  assert.ok(requester.rows.every((r) => r.stops.every((s) => !s.contact.visible && s.contact.phone === null) && !r.driver.visible));
  await assert.rejects(search({ mode: "time", kinds: "VAN_SALES" }, accounts.REQUESTER), rejected("FORBIDDEN"));
  await assert.rejects(tripDetail(db, accounts.REQUESTER, id("van")), rejected("NOT_FOUND"));
  assert.deepEqual((await searchOptions(db, accounts.REQUESTER)).kinds, ["BRANCH_DELIVERY"]);

  assert.equal((await search({ mode: "time" }, accounts.DRIVER)).total, 0);
  const driver = await search({ mode: "time", kinds: "VAN_SALES" }, accounts.DRIVER);
  assert.deepEqual(tripIds(driver), [id("van")]); assert.equal(driver.rows[0].driver.visible, true);

  const supervisor = await tripDetail(db, accounts.SUPERVISOR, id("van"));
  assert.equal(supervisor.driver.name, "พนักงานขับรถสังเคราะห์");
  assert.ok(supervisor.stops.every((s) => s.contact.visible));

  for (const call of [
    () => search({ mode: "time" }, accounts.ADMINISTRATOR), () => suggestBranches(db, accounts.ADMINISTRATOR, "สาขา"),
    () => tripDetail(db, accounts.ADMINISTRATOR, id("trip-1")), () => branchDirectory(db, accounts.ADMINISTRATOR, { query: "", page: 1 }),
  ]) await assert.rejects(call(), rejected("FORBIDDEN"));
  const draftOnly = await db.trip.findFirst({ where: { tripRevision_tripId: { every: { planRevision: { status: "DRAFT" } } } } });
  if (draftOnly) await assert.rejects(tripDetail(db, accounts.SUPERVISOR, draftOnly.id), rejected("NOT_FOUND"));

  const directory = await branchDirectory(db, accounts.BRANCH_RECEIVER, { query: searchFixture.sharedAlias, page: 1 });
  assert.deepEqual(directory.rows.map((r) => r.id).sort(), [B, C].sort());
  assert.ok(directory.rows.every((r) => !r.contact.visible && r.aliases.includes(searchFixture.sharedAlias)));
  assert.equal((await branchDirectory(db, accounts.BRANCH_RECEIVER, { query: searchFixture.aliasA, page: 1 })).rows[0].contact.name, "ผู้ติดต่อสังเคราะห์ 1");
});

test("Eligible-trip pre-check for the upcoming consignment flow never claims submission", async () => {
  const before = new Date("2028-02-29T00:00:00Z"), afterDeparture = new Date("2028-03-01T12:00:00Z");
  const ok = await tripDetail(db, accounts.REQUESTER, id("trip-1"), { branchId: A, now: before });
  assert.deepEqual(ok.eligibility, { eligible: true, reasons: [] });
  assert.equal(ok.stops.find((s) => s.branchId === A)?.matched, true);
  assert.equal((await tripDetail(db, accounts.REQUESTER, id("1530"), { branchId: A, now: before })).eligibility.eligible, false);
  assert.ok((await tripDetail(db, accounts.REQUESTER, id("trip-1"), { branchId: A, now: afterDeparture })).eligibility.reasons.includes("รอบรถนี้ออกรถไปแล้ว"));
  assert.ok((await tripDetail(db, accounts.SUPERVISOR, id("trip-1"), { branchId: A, now: before })).eligibility.reasons.includes("บัญชีนี้ไม่มีสิทธิ์สร้างคำขอฝากส่ง"));
  assert.equal(await db.consignment.count({ where: { requesterId: accounts.REQUESTER } }), 0);
});
