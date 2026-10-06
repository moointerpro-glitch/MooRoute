import "dotenv/config";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import { testDatabaseConfiguration } from "../src/server/config/environment";
import { createDatabase } from "../src/server/persistence/database";
import { installRoles } from "../src/server/auth/permissions";
import { provisionAccount } from "../src/server/auth/provision";
import { searchTrips } from "../src/server/services/trip-search";
import { parseSearchInput } from "../src/server/domain/search";
import { runtimeGrants } from "./runtime-grants";

// Local-lab load test of trip search. It creates a NEW disposable schema with synthetic data only,
// starts the production build against it and reports measured latencies. Nothing is dropped or deployed.
const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const DAYS = arg("days", 1000), TRIPS_PER_DAY = arg("trips", 100), STOPS = 5, BRANCHES = 60, VEHICLES = 40, USERS = arg("users", 50), SECONDS = arg("seconds", 60), PORT = 3012;
const client = resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe"), defaults = resolve(".local/mysql/root-client.ini");
const origin = `http://127.0.0.1:${PORT}`;
function random(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pad = (n: number, width: number) => String(n).padStart(width, "0");
const dateOf = (day: number) => new Date(Date.UTC(2027, 0, 1) + day * 86_400_000).toISOString().slice(0, 10);
const quantile = (sorted: number[], q: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] : 0;
const summary = (ms: number[]) => { const s = [...ms].sort((a, b) => a - b); return { count: s.length, p50: Math.round(quantile(s, 0.5)), p90: Math.round(quantile(s, 0.9)), p95: Math.round(quantile(s, 0.95)), p99: Math.round(quantile(s, 0.99)), max: Math.round(s[s.length - 1] ?? 0), mean: Math.round(s.reduce((a, b) => a + b, 0) / (s.length || 1)) }; };

async function seed(db: ReturnType<typeof createDatabase>) {
  const rnd = random(20261006), started = Date.now();
  await installRoles(db);
  const operator = await db.user.create({ data: { id: "load-operator", subject: "synthetic:load", displayName: "ผู้สร้างข้อมูลทดสอบโหลด (สังเคราะห์)" } });
  await db.department.create({ data: { id: "load-department", code: "LOAD", name: "แผนกทดสอบโหลด (สังเคราะห์)" } });
  await db.branch.createMany({ data: Array.from({ length: BRANCHES }, (_, i) => ({ id: `load-b-${pad(i, 3)}`, code: `LB${pad(i, 3)}`, name: `สาขาทดสอบโหลด ${i + 1} (สังเคราะห์)`, addressLine: "ที่อยู่สังเคราะห์", subdistrict: "ตำบลสังเคราะห์", district: "อำเภอสังเคราะห์", province: "จังหวัดสังเคราะห์", postalCode: "50000", activeFrom: new Date("2026-01-01T00:00:00Z") })) });
  await db.branchAlias.createMany({ data: Array.from({ length: BRANCHES }, (_, i) => ({ branchId: `load-b-${pad(i, 3)}`, name: `ชื่อเรียกโหลด ${i + 1}` })) });
  await db.productCategory.createMany({ data: [{ id: "load-pork", code: "PORK", name: "หมู" }, { id: "load-chicken", code: "CHICKEN", name: "ไก่" }] });
  await db.vehicleType.create({ data: { id: "load-type", code: "LOAD", name: "รถทดสอบโหลด (สังเคราะห์)", wheelCount: 6 } });
  await db.storageCondition.create({ data: { id: "load-chilled", code: "CHILLED", name: "แช่เย็น" } });
  await db.vehicle.createMany({ data: Array.from({ length: VEHICLES }, (_, i) => ({ id: `load-v-${pad(i, 2)}`, plateNormalized: `LOAD${pad(i, 2)}`, province: "ข้อมูลสังเคราะห์", typeId: "load-type", storageConditionId: "load-chilled" })) });
  const chunk = <T,>(rows: T[], size = 4000) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
  for (let from = 0; from < DAYS; from += 25) {
    const plans = [], revisions = [], trips = [], tripRevisions = [], stops = [], categories = [];
    for (let day = from; day < Math.min(DAYS, from + 25); day++) {
      const date = dateOf(day), planId = `p-${pad(day, 4)}`, revisionId = `r-${pad(day, 4)}`, midnight = Date.parse(`${date}T00:00:00+07:00`);
      plans.push({ id: planId, serviceDate: new Date(`${date}T00:00:00Z`) });
      revisions.push({ id: revisionId, planId, number: 1, createdById: operator.id });
      for (let n = 0; n < TRIPS_PER_DAY; n++) {
        const tripId = `t-${pad(day, 4)}-${pad(n, 3)}`, id = `tr-${pad(day, 4)}-${pad(n, 3)}`, departure = 300 + Math.floor(rnd() * 53) * 15, kindRoll = rnd();
        const kind = kindRoll < 0.92 ? "BRANCH_DELIVERY" as const : kindRoll < 0.96 ? "INBOUND_DC" as const : "VAN_SALES" as const;
        trips.push({ id: tripId, planId, code: tripId });
        tripRevisions.push({ id, tripId, planId, planRevisionId: revisionId, kind, roundNo: kind === "BRANCH_DELIVERY" ? 1 + (n % 3) : null, vehicleId: `load-v-${pad(n % VEHICLES, 2)}`,
          loadingAt: rnd() < 0.1 ? null : new Date(midnight + (departure - 60) * 60_000), departureAt: new Date(midnight + departure * 60_000), arrivalAt: new Date(midnight + (departure + 180) * 60_000) });
        const first = Math.floor(rnd() * BRANCHES);
        for (let k = 0; k < STOPS; k++) {
          const branch = (first + k * 7) % BRANCHES, stopId = `s-${pad(day, 4)}-${pad(n, 3)}-${k}`;
          stops.push({ id: stopId, tripRevisionId: id, branchId: `load-b-${pad(branch, 3)}`, sequence: k + 1, nameSnapshot: `สาขาทดสอบโหลด ${branch + 1} (สังเคราะห์)` });
          const roll = rnd();
          if (roll < 0.85) categories.push({ stopId, categoryId: "load-pork" });
          if (roll > 0.15) categories.push({ stopId, categoryId: "load-chicken" });
        }
      }
    }
    await db.dailyPlan.createMany({ data: plans }); await db.planRevision.createMany({ data: revisions }); await db.trip.createMany({ data: trips });
    for (const rows of chunk(tripRevisions)) await db.tripRevision.createMany({ data: rows });
    for (const rows of chunk(stops)) await db.tripStop.createMany({ data: rows });
    for (const rows of chunk(categories)) await db.tripStopCategory.createMany({ data: rows });
    if ((from / 25) % 8 === 0) console.log(`seeded ${Math.min(DAYS, from + 25)}/${DAYS} days (${Math.round((Date.now() - started) / 1000)} s)`);
  }
  // Privileged fixture step: mark every synthetic revision published and point each day at it.
  await db.planRevision.updateMany({ data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: operator.id } });
  await db.$executeRawUnsafe("UPDATE DailyPlan p JOIN PlanRevision r ON r.planId=p.id SET p.publishedRevisionId=r.id");
  for (const table of ["TripRevision", "TripStop", "TripStopCategory", "DailyPlan", "PlanRevision", "Trip"]) await db.$executeRawUnsafe(`ANALYZE TABLE \`${table}\``);
  const password = randomBytes(24).toString("base64url"), accounts = [["supervisor", "SUPERVISOR", "GLOBAL", undefined], ["requester", "REQUESTER", "DEPARTMENT", "load-department"], ["branch", "BRANCH_RECEIVER", "BRANCH", "load-b-007"]] as const;
  for (const [name, role, scope, scopeId] of accounts) await provisionAccount(db, { email: `${name}@load.synthetic.test`, name: `ผู้ใช้ทดสอบโหลด ${name}`, password, role, scope, scopeId });
  const [counts] = await db.$queryRawUnsafe<Array<Record<string, bigint>>>("SELECT (SELECT COUNT(*) FROM TripRevision) trips, (SELECT COUNT(*) FROM TripStop) stops, (SELECT COUNT(*) FROM TripStopCategory) stopCategories, (SELECT COUNT(*) FROM DailyPlan) days");
  return { password, accounts: accounts.map(([name]) => `${name}@load.synthetic.test`), seedSeconds: Math.round((Date.now() - started) / 1000), counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])) };
}

function requestUrl(rnd: () => number) {
  const date = dateOf(Math.floor(rnd() * DAYS)), branch = `load-b-${pad(Math.floor(rnd() * BRANCHES), 3)}`, roll = rnd(), t = () => 300 + Math.floor(rnd() * 53) * 15;
  const clock = (m: number) => `${pad(Math.floor(m / 60), 2)}:${pad(m % 60, 2)}`;
  if (roll < 0.35) return ["branch", `/api/search?date=${date}&mode=branch&branch=${branch}`];
  if (roll < 0.55) return ["branch+category", `/api/search?date=${date}&mode=branch&branch=${branch}&categories=load-chicken&rounds=1,2`];
  if (roll < 0.72) return ["times", `/api/search?date=${date}&mode=time&times=${t()},${t()}`];
  if (roll < 0.87) { const from = t(); return ["range", `/api/search?date=${date}&mode=range&from=${clock(from)}&to=${clock(Math.min(1439, from + 120))}&basis=loading`]; }
  if (roll < 0.94) return ["alias text", `/api/search?date=${date}&mode=branch&q=${encodeURIComponent(`ชื่อเรียกโหลด ${1 + Math.floor(rnd() * BRANCHES)}`)}`];
  return ["autocomplete", `/api/search/branches?q=${encodeURIComponent(`โหลด ${1 + Math.floor(rnd() * 9)}`)}`];
}

async function startServer(databaseUrl: string, pool: number): Promise<ChildProcess> {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)], { env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_POOL_SIZE: String(pool), APP_ENV: "local", BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), NODE_ENV: "production" }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${origin}/api/health/live`)).ok) return server; } catch { /* not ready */ } await new Promise((r) => setTimeout(r, 500)); }
  server.kill(); throw new Error("SERVER_START_FAILED");
}
async function signIn(email: string, password: string) {
  const response = await fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ email, password, rememberMe: false }) });
  if (!response.ok) throw new Error("SIGN_IN_FAILED");
  return response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}
async function scenario(cookies: string[], users: number, seconds: number, thinkMs: number) {
  const until = Date.now() + seconds * 1000, latencies: number[] = [], byKind: Record<string, number[]> = {}, statuses: Record<string, number> = {}; let withRows = 0;
  await Promise.all(Array.from({ length: users }, async (_, user) => {
    const rnd = random(1000 + user);
    while (Date.now() < until) {
      const [kind, path] = requestUrl(rnd), accountRoll = rnd(), cookie = cookies[accountRoll < 0.7 ? 0 : accountRoll < 0.9 ? 1 : 2], started = performance.now();
      let status = "network";
      try { const response = await fetch(origin + path, { headers: { cookie } }); status = String(response.status); const body = await response.json(); if (response.ok && (body.total > 0 || body.candidates?.length)) withRows++; } catch { /* counted as network */ }
      const elapsed = performance.now() - started;
      statuses[status] = (statuses[status] ?? 0) + 1;
      if (status === "200") { latencies.push(elapsed); (byKind[kind] ??= []).push(elapsed); }
      if (thinkMs) await new Promise((r) => setTimeout(r, thinkMs * (0.5 + rnd())));
    }
  }));
  const total = Object.values(statuses).reduce((a, b) => a + b, 0);
  return { users, seconds, thinkMs, requests: total, throughputPerSecond: Math.round((total / seconds) * 10) / 10, statuses, successWithResults: withRows, latencyMs: summary(latencies), byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, summary(v)])) };
}

try {
  const config = testDatabaseConfiguration(process.env);
  if (config.host !== "127.0.0.1" || config.port !== 3307 || !existsSync(client) || !existsSync(defaults) || !existsSync(".next")) throw new Error("NATIVE_SETUP_AND_BUILD_REQUIRED");
  const name = `moointer_test_run_load${randomBytes(5).toString("hex")}`, root = (input: string) => { if (spawnSync(client, [`--defaults-file=${defaults}`, "--batch"], { input, encoding: "utf8" }).status !== 0) throw new Error("PROVISION_FAILED"); };
  // Binary logging is on, so a non-SUPER migration account may only create the guard triggers with this server-wide flag.
  console.log("Notice: setting the lab server's global log_bin_trust_function_creators=1 so the scoped test account can create triggers (see OPERATIONS.md §5).");
  root(`SET GLOBAL log_bin_trust_function_creators=1; CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; GRANT ALL PRIVILEGES ON \`${name}\`.* TO 'moointer_test'@'127.0.0.1';`);
  const url = new URL(process.env.TEST_DATABASE_URL!); url.pathname = `/${name}`;
  if (spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, TEST_DATABASE_URL: url.toString(), MIGRATION_DATABASE_URL: url.toString() }, encoding: "utf8" }).status !== 0) throw new Error("MIGRATION_FAILED");
  console.log(`Disposable load database ${name}: migrations deployed. Seeding ${DAYS * TRIPS_PER_DAY} synthetic trips…`);
  const db = createDatabase({ ...config, database: name });
  const seeded = await seed(db);
  console.log(`Seeded in ${seeded.seedSeconds} s: ${JSON.stringify(seeded.counts)}`);

  // Query plans for the representative search statements (same shape as trip-search.ts).
  const date = dateOf(Math.floor(DAYS / 2));
  const base = `FROM DailyPlan p JOIN PlanRevision r ON r.id=p.publishedRevisionId JOIN TripRevision t ON t.planRevisionId=r.id WHERE p.serviceDate='${date}' AND r.status='PUBLISHED' AND t.cancelled=0 AND t.kind IN ('BRANCH_DELIVERY')`;
  const plans: Record<string, unknown> = {};
  for (const [label, statement] of [
    ["branch + category (same stop)", `SELECT t.id ${base} AND EXISTS (SELECT 1 FROM TripStop s WHERE s.tripRevisionId=t.id AND s.branchId IN ('load-b-010') AND EXISTS (SELECT 1 FROM TripStopCategory sc WHERE sc.stopId=s.id AND sc.categoryId IN ('load-chicken'))) ORDER BY (t.departureAt IS NULL), t.departureAt, t.tripId LIMIT 20`],
    ["departure range", `SELECT t.id ${base} AND t.departureAt >= '${date} 01:00:00' AND t.departureAt < '${date} 03:01:00' ORDER BY (t.departureAt IS NULL), t.departureAt, t.tripId LIMIT 20`],
    ["count", `SELECT COUNT(*) ${base}`],
    ["facets", `SELECT t.departureAt, COUNT(*) ${base} GROUP BY t.departureAt`],
  ] as const) plans[label] = (await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`EXPLAIN ${statement}`)).map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])));

  // Service-level timing without HTTP or session overhead.
  const supervisor = await db.user.findFirstOrThrow({ where: { email: "supervisor@load.synthetic.test" } }), direct: number[] = [], rndDirect = random(7);
  for (let i = 0; i < 300; i++) {
    const [, path] = requestUrl(rndDirect); if (!path.startsWith("/api/search?")) continue;
    const started = performance.now(); await searchTrips(db, supervisor.id, parseSearchInput(new URL(origin + path).searchParams, date)); direct.push(performance.now() - started);
  }
  await db.$disconnect();

  // HTTP runs use the least-privilege runtime account, as a deployed application would.
  const runtimePassword = randomBytes(24).toString("hex");
  root([`CREATE USER IF NOT EXISTS 'moointer_stage'@'127.0.0.1' IDENTIFIED BY '${runtimePassword}';`, `ALTER USER 'moointer_stage'@'127.0.0.1' IDENTIFIED BY '${runtimePassword}';`, ...runtimeGrants(name, "moointer_stage")].join(" "));
  const runtimeUrl = new URL(url.toString()); runtimeUrl.username = "moointer_stage"; runtimeUrl.password = runtimePassword;
  const runs = [];
  for (const pool of [5, 20]) {
    const server = await startServer(runtimeUrl.toString(), pool);
    try {
      const cookies = []; for (const email of seeded.accounts) cookies.push(await signIn(email, seeded.password));
      await scenario(cookies, 5, 5, 0); // warm-up, discarded
      console.log(`pool ${pool}: closed-loop run, ${USERS} users, ${SECONDS} s`);
      const closed = await scenario(cookies, USERS, SECONDS, 0);
      console.log(`pool ${pool}: paced run (about 1 s think time), ${USERS} users, ${SECONDS} s`);
      const paced = await scenario(cookies, USERS, SECONDS, 1000);
      runs.push({ poolSize: pool, closedLoop: closed, paced });
    } finally { server.kill(); await new Promise((r) => setTimeout(r, 1500)); }
  }
  const result = {
    measuredAt: new Date().toISOString(), database: name,
    hardware: { cpu: os.cpus()[0]?.model.trim(), logicalCores: os.cpus().length, memoryGb: Math.round(os.totalmem() / 2 ** 30), platform: `${os.type()} ${os.release()}`, node: process.version, note: "Load generator, Next.js server and MySQL all ran on this one machine." },
    dataset: { ...seeded.counts, branches: BRANCHES, tripsPerDay: TRIPS_PER_DAY, stopsPerTrip: STOPS, seedSeconds: seeded.seedSeconds },
    workload: "35% branch, 20% branch+category+rounds, 17% exact times, 15% loading range, 7% alias text, 6% autocomplete; 70% global supervisor, 20% department requester, 10% branch receiver; random service date over the whole dataset",
    serviceLevelMs: summary(direct), queryPlans: plans, runs,
  };
  mkdirSync("docs/evidence/phase-8", { recursive: true });
  writeFileSync("docs/evidence/phase-8/load-test.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ serviceLevelMs: result.serviceLevelMs, runs: runs.map((r) => ({ pool: r.poolSize, closed: { rps: r.closedLoop.throughputPerSecond, ...r.closedLoop.latencyMs, statuses: r.closedLoop.statuses }, paced: { rps: r.paced.throughputPerSecond, ...r.paced.latencyMs, statuses: r.paced.statuses } })) }, null, 1));
  console.log("PASS: load test finished; results written to docs/evidence/phase-8/load-test.json. The disposable database is retained.");
} catch (error) { console.error(`LOAD_TEST_FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`); process.exitCode = 1; }
