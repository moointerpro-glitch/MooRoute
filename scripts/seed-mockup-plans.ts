import "dotenv/config";
import { createHash } from "node:crypto";
import { createDatabase } from "../src/server/persistence/database";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { saveRoute, saveTemplate } from "../src/server/services/planning-catalog";
import { publishPlan, saveDraft, type DraftTrip } from "../src/server/services/plans";
import { bangkokInstant } from "../src/server/domain/planning";
import { bangkokServiceDate } from "../src/lib/bangkok-date";
import { MOCK_ACCOUNTS } from "./mock-accounts";

/**
 * MOCK-UP published plans so consignments can be tried immediately (owner request, D219).
 * Needs the mock masters and accounts first (`npm run db:seed:mockup`, or the masters kept by `npm run db:reset:dev-operations`).
 * Creates 3 routes covering all 8 mock branches, 9 templates (3 routes x rounds 1-3) and, for each of the next
 * --days service dates (default 14, starting today), a plan drafted and published by the mock planner through the
 * normal services (D222: the planner manages plans end to end), so coverage, vehicle and time rules all apply. Re-running only adds
 * missing dates. Nothing here is real data.
 */
const KEY = "mockup-plans-v1", FROM = bangkokServiceDate();
const days = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7) ?? 14);
const REASON = "ข้อมูล mock up สำหรับทดสอบฝากของ (ไม่ใช่แผนจริง)";
// Round times in Bangkok minutes: loading, departure, arrival; the vehicle is occupied from loading to arrival.
const rounds = [{ round: 1, load: 300, depart: 360, arrive: 660, extra: "PROCESSED" }, { round: 2, load: 690, depart: 750, arrive: 960, extra: "DRY" }, { round: 3, load: 990, depart: 1050, arrive: 1290, extra: null }];
const routes = [
  { id: "mock-route-cmn", code: "CMN", name: "สายเชียงใหม่เหนือ (ทดสอบ)", branches: ["BR-T01", "BR-T04", "BR-T05"], plate: "ทดสอบ2001", driver: "DRV-T01" },
  { id: "mock-route-cms", code: "CMS", name: "สายเชียงใหม่ใต้ (ทดสอบ)", branches: ["BR-T02", "BR-T03"], plate: "ทดสอบ1001", driver: "DRV-T02" },
  { id: "mock-route-upc", code: "UPC", name: "สายต่างจังหวัด ลำพูน–ลำปาง–เชียงราย (ทดสอบ)", branches: ["BR-T06", "BR-T07", "BR-T08"], plate: "ทดสอบ3002", driver: "DRV-T03" },
];
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const at = (date: string, minute: number) => new Date(bangkokInstant(date, 0).valueOf() + minute * 60_000).toISOString();
const beCode = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${String(Number(iso.slice(0, 4)) + 543).slice(2)}`;

let db: ReturnType<typeof createDatabase> | undefined;
try {
  if (process.env.APP_ENV !== "local") throw new Error("LOCAL_ONLY");
  const config = parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (config.host !== "127.0.0.1" || config.port !== 3307 || config.database !== "moointer_dev") throw new Error("LOCAL_DEV_DATABASE_ONLY");
  if (!Number.isInteger(days) || days < 1 || days > 60) throw new Error("DAYS_1_TO_60");
  db = createDatabase(config);
  const user = async (email: string) => (await db!.user.findUniqueOrThrow({ where: { email } })).id;
  const planner = await user(MOCK_ACCOUNTS.find((a) => a.key === "planner1")!.email);
  const branchId = async (code: string) => (await db!.branch.findUniqueOrThrow({ where: { code } })).id;
  const category = async (code: string) => (await db!.productCategory.findUniqueOrThrow({ where: { code } })).id;
  const cats = { PORK: await category("PORK"), CHICKEN: await category("CHICKEN"), PROCESSED: await category("PROCESSED"), DRY: await category("DRY") };

  // Routes and templates through the audited catalog services (replayed on re-run).
  const templates: Array<{ id: string; revisionId: string; routeRevisionId: string; round: (typeof rounds)[number]; route: (typeof routes)[number]; vehicleId: string; driverId: string; stops: { branchId: string; categoryIds: string[] }[] }> = [];
  for (const r of routes) {
    const branchIds = await Promise.all(r.branches.map(branchId));
    const saved = await saveRoute(db, planner, `${KEY}:route:${r.code}`, { id: r.id, code: `MOCK-${r.code}`, expectedVersion: 0, active: true, effectiveFrom: FROM, effectiveTo: null, reason: REASON, name: r.name, branchIds });
    const stops = await db.routeStop.findMany({ where: { routeRevisionId: saved.revisionId }, orderBy: { sequence: "asc" } });
    const vehicleId = (await db.vehicle.findFirstOrThrow({ where: { plateNormalized: r.plate } })).id, driverId = (await db.driver.findUniqueOrThrow({ where: { code: r.driver } })).id;
    for (const round of rounds) {
      const categoryIds = [cats.PORK, cats.CHICKEN, ...(round.extra ? [cats[round.extra as "PROCESSED" | "DRY"]] : [])];
      const id = `mock-tpl-${r.code.toLowerCase()}-r${round.round}`;
      const t = await saveTemplate(db, planner, `${KEY}:template:${id}`, { id, code: `MOCK-${r.code}-R${round.round}`, expectedVersion: 0, active: true, effectiveFrom: FROM, effectiveTo: null, reason: REASON,
        routeRevisionId: saved.revisionId, kind: "BRANCH_DELIVERY", roundNo: round.round, vehicleId, driverId, loadingMinute: round.load, departureMinute: round.depart, arrivalMinute: round.arrive, arrivalDayOffset: 0,
        occupancyStartMinute: round.load, occupancyEndMinute: round.arrive, bufferMinutes: 15, notes: null, weekdays: [1, 2, 3, 4, 5, 6, 7], categories: stops.map((s) => ({ routeStopId: s.id, categoryIds })) });
      templates.push({ id, revisionId: t.revisionId, routeRevisionId: saved.revisionId, round, route: r, vehicleId, driverId, stops: stops.map((s) => ({ branchId: s.branchId, categoryIds })) });
    }
  }

  // One published plan per date, drafted and published by the same planner (D222).
  const summary: string[] = [];
  for (let n = 0; n < days; n++) {
    const date = addDays(FROM, n);
    const existing = await db.dailyPlan.findUnique({ where: { serviceDate: new Date(`${date}T00:00:00Z`) } });
    if (existing?.publishedRevisionId) { summary.push(`${date}: already published`); continue; }
    const trips: DraftTrip[] = templates.map((t) => ({
      // Same trip identity as "สร้างเที่ยวจากแม่แบบ", so generating later never duplicates these trips.
      tripId: createHash("sha256").update(`${t.id}:${date}`).digest("hex").slice(0, 36), code: `${t.route.code}-R${t.round.round}-${beCode(date)}`,
      kind: "BRANCH_DELIVERY", roundNo: t.round.round, cancelled: false, vehicleId: t.vehicleId, driverId: t.driverId, templateRevisionId: t.revisionId, routeRevisionId: t.routeRevisionId,
      loadingAt: at(date, t.round.load), departureAt: at(date, t.round.depart), arrivalAt: at(date, t.round.arrive), occupancyStart: at(date, t.round.load), occupancyEnd: at(date, t.round.arrive),
      bufferMinutes: 15, notes: null, plannedLoad: null, loadUnit: null, stops: t.stops,
    }));
    const draft = await saveDraft(db, planner, `${KEY}:draft:${date}`, { serviceDate: date, expectedVersion: existing?.version ?? 0, trips, reason: REASON });
    await publishPlan(db, planner, `${KEY}:publish:${date}`, { revisionId: draft.revisionId, expectedVersion: draft.version, reason: REASON });
    summary.push(`${date}: published ${trips.length} trips`);
  }
  console.log(`PASS: ${routes.length} mock routes, ${templates.length} templates; plans: ${summary.join("; ")}. No consignment was created.`);
} catch (error) {
  const e = error as Error & { code?: string; details?: unknown };
  console.error(`MOCKUP_PLANS_FAILED (${e?.name === "DomainError" ? `${e.code}: ${e.message}` : `${e?.name ?? "UNKNOWN"} ${e?.code ?? ""}`.trim()})`);
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
