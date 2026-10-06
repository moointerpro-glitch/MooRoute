import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchInput, offsetInstant, instantOffset, offsetLabel, clockMinute, normalizeQuery, stopMatches } from "../../src/server/domain/search";
import { DomainError } from "../../src/server/domain/errors";
import { isoFromBe, beDate, safeNext } from "../../src/lib/trip-format";

const parse = (values: Record<string, string>) => parseSearchInput(new URLSearchParams(values), "2028-03-01");
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;

test("search defaults: today, branch mode, departure basis, published outbound branch trips", () => {
  const input = parse({});
  assert.deepEqual([input.serviceDate, input.mode, input.basis, input.kinds, input.sort, input.page, input.pageSize], ["2028-03-01", "branch", "departure", ["BRANCH_DELIVERY"], "time_asc", 1, 20]);
});

test("Bangkok minute offsets: local midnight and neighbouring days", () => {
  assert.equal(offsetInstant("2028-03-01", 0).toISOString(), "2028-02-29T17:00:00.000Z");
  assert.equal(offsetInstant("2028-03-01", 1439).toISOString(), "2028-03-01T16:59:00.000Z");
  assert.equal(instantOffset("2028-03-01", new Date("2028-03-01T16:59:59.999Z")), 1439, "seconds truncate, never round into the next day");
  assert.equal(instantOffset("2028-03-01", new Date("2028-03-01T17:00:00.000Z")), 1440);
  assert.deepEqual([offsetLabel(-15), offsetLabel(0), offsetLabel(1500)], ["23:45 (วันก่อนหน้า)", "00:00", "01:00 (วันถัดไป)"]);
});

test("time and query validation in Thai, including Thai digits", () => {
  assert.equal(clockMinute("๐๗:๓๐"), 450);
  assert.equal(normalizeQuery("  สาขา   ๑ "), "สาขา 1");
  assert.deepEqual(parse({ times: "540,480,540" }).times, [480, 540]);
  assert.throws(() => parse({ mode: "range", from: "16:00", to: "15:59" }), code("INVALID_RANGE"));
  assert.throws(() => parse({ mode: "range", from: "16:00" }), code("INVALID_RANGE"));
  assert.equal(parse({ mode: "range", from: "15:30", to: "15:30" }).to, 930, "a single-minute inclusive range is valid");
  assert.throws(() => parse({ from: "24:00", to: "24:10", mode: "range" }), code("INVALID_SEARCH"));
  assert.throws(() => parse({ rounds: "4" }), code("INVALID_SEARCH"));
  assert.throws(() => parse({ kinds: "BRANCH_DELIVERY,DROP TABLE" }), code("INVALID_SEARCH"));
  assert.throws(() => parse({ date: "2028-02-30" }), code("INVALID_SEARCH"));
  assert.throws(() => parse({ q: "ก".repeat(101) }), code("INVALID_SEARCH"));
  assert.throws(() => parse({ times: "3000" }), code("INVALID_SEARCH"));
});

test("same-stop predicate mirrors the SQL rule", () => {
  const stop = { branchId: "a", categoryIds: ["pork"] };
  assert.equal(stopMatches(stop, ["a"], ["chicken"]), false);
  assert.equal(stopMatches(stop, ["a"], ["pork", "chicken"]), true);
  assert.equal(stopMatches(stop, [], []), false);
});

test("Buddhist-era date input and safe post-login redirects", () => {
  assert.equal(isoFromBe("๐๑/๐๓/๒๕๗๑"), "2028-03-01");
  assert.equal(isoFromBe("29/02/2571"), "2028-02-29");
  assert.equal(isoFromBe("30/02/2571"), null);
  assert.equal(isoFromBe("01/03/2028"), null, "Gregorian years are rejected to avoid mixing calendars");
  assert.equal(beDate("2028-03-01"), "01/03/2571");
  assert.deepEqual(["/", "/trips?date=2028-03-01", "//evil.example", "https://evil.example", "/\\evil"].map(safeNext), ["/", "/trips?date=2028-03-01", null, null, null]);
});
