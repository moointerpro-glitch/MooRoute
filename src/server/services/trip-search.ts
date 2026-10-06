import "server-only";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { requireCondition } from "../domain/errors";
import { serviceDate } from "../domain/planning";
import { instantOffset, offsetInstant, offsetLabel, stopMatches, validateSearchInput, searchTripKinds, type SearchInput, type SearchTripKind } from "../domain/search";
import { principal, requireCapability, type Principal } from "../auth/permissions";
import type { Transaction } from "./transaction";

export const SEARCH_DIRECTORY_PAGE = 20;
const readOptions = { isolationLevel: "RepeatableRead" as const, timeout: 20_000 };

/**
 * Row scope for published trips. GLOBAL sees all; BRANCH sees trips with a stop at that branch;
 * DRIVER sees own trips. DEPARTMENT/WAREHOUSE trip readers (requesters choosing a vehicle) may see
 * company-wide outbound branch deliveries only, never inbound DC or Van Sales (D209).
 */
export function tripVisibility(p: Principal) {
  const branchIds = p.scopes.flatMap((s) => s.kind === "BRANCH" && s.branchId ? [s.branchId] : []);
  const driverIds = p.scopes.flatMap((s) => s.kind === "DRIVER" && s.driverId ? [s.driverId] : []);
  const outboundWide = p.scopes.some((s) => s.kind === "DEPARTMENT" || s.kind === "WAREHOUSE");
  const allKinds = p.global || branchIds.length > 0 || driverIds.length > 0;
  return {
    global: p.global, branchIds, driverIds, outboundWide,
    kinds: (allKinds ? [...searchTripKinds] : outboundWide ? ["BRANCH_DELIVERY"] : []) as SearchTripKind[],
    allows(trip: { kind: string; driverId: string | null; stops: { branchId: string }[] }) {
      return p.global || (!!trip.driverId && driverIds.includes(trip.driverId)) ||
        trip.stops.some((s) => branchIds.includes(s.branchId)) || (outboundWide && trip.kind === "BRANCH_DELIVERY");
    },
    sql() {
      if (p.global) return Prisma.sql`1=1`;
      const parts: Prisma.Sql[] = [];
      if (driverIds.length) parts.push(Prisma.sql`t.driverId IN (${Prisma.join(driverIds)})`);
      if (branchIds.length) parts.push(Prisma.sql`EXISTS (SELECT 1 FROM TripStop vs WHERE vs.tripRevisionId=t.id AND vs.branchId IN (${Prisma.join(branchIds)}))`);
      if (outboundWide) parts.push(Prisma.sql`t.kind='BRANCH_DELIVERY'`);
      return parts.length ? Prisma.sql`(${Prisma.join(parts, " OR ")})` : Prisma.sql`1=0`;
    },
  };
}
/** Contact details follow the branch master read policy, not trip visibility. */
export function contactPolicy(p: Principal) {
  const branchRead = p.permissions.has("master.branches.read"), driverRead = p.permissions.has("master.drivers.read");
  return {
    branch: (branchId: string) => branchRead && (p.global || p.scopes.some((s) => s.kind === "BRANCH" && s.branchId === branchId)),
    driver: (driverId: string | null) => !!driverId && driverRead && (p.global || p.scopes.some((s) => s.kind === "DRIVER" && s.driverId === driverId)),
  };
}

async function searchPrincipal(tx: Transaction, actorId: string) {
  const p = await principal(tx, actorId);
  requireCapability(p, "trip.read");
  return p;
}

type BranchCandidate = { id: string; code: string; name: string; alias: string | null; exact: boolean };
const publicCandidate = (c: BranchCandidate) => ({ id: c.id, code: c.code, name: c.name, alias: c.alias });
const likeValue = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** Official code/name and active reviewed aliases; collation utf8mb4_0900_ai_ci makes this case-insensitive. */
async function branchCandidates(tx: Transaction, query: string, limit: number): Promise<BranchCandidate[]> {
  if (!query) return [];
  const like = likeValue(query);
  const rows = await tx.$queryRaw<Array<{ id: string; code: string; name: string; alias: string | null; exact: bigint | number }>>`
    SELECT b.id, b.code, b.name,
      MIN(CASE WHEN a.name LIKE ${like} AND NOT (b.code LIKE ${like} OR b.name LIKE ${like}) THEN a.name END) AS alias,
      MAX(CASE WHEN b.code=${query} OR b.name=${query} OR a.name=${query} THEN 1 ELSE 0 END) AS exact
    FROM Branch b LEFT JOIN BranchAlias a ON a.branchId=b.id AND a.active=1
    WHERE b.archived=0 AND (b.code LIKE ${like} OR b.name LIKE ${like} OR a.name LIKE ${like})
    GROUP BY b.id, b.code, b.name ORDER BY exact DESC, b.code ASC LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, alias: r.alias, exact: Number(r.exact) === 1 }));
}

export async function suggestBranches(db: PrismaClient, actorId: string, query: string) {
  requireCondition(typeof query === "string" && query.length <= 100, "INVALID_SEARCH", "คำค้นหายาวเกิน ๑๐๐ ตัวอักษร");
  return db.$transaction(async (tx) => {
    await searchPrincipal(tx, actorId);
    return { candidates: (await branchCandidates(tx, query, 10)).map(publicCandidate) };
  }, readOptions);
}

type Resolution = { status: "NONE" | "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND"; branch: { id: string; code: string; name: string } | null; candidates: Omit<BranchCandidate, "exact">[] };
async function resolveBranch(tx: Transaction, input: SearchInput): Promise<Resolution> {
  if (input.mode !== "branch") return { status: "NONE", branch: null, candidates: [] };
  if (input.branchId) {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, archived: false }, select: { id: true, code: true, name: true } });
    return branch ? { status: "RESOLVED", branch, candidates: [] } : { status: "NOT_FOUND", branch: null, candidates: [] };
  }
  if (!input.query) return { status: "NONE", branch: null, candidates: [] };
  const found = await branchCandidates(tx, input.query, 11), exact = found.filter((c) => c.exact);
  const chosen = exact.length === 1 ? exact[0] : found.length === 1 ? found[0] : null;
  if (chosen) return { status: "RESOLVED", branch: { id: chosen.id, code: chosen.code, name: chosen.name }, candidates: [] };
  // Never pick one branch arbitrarily when an alias or partial name matches several branches.
  return { status: found.length ? "AMBIGUOUS" : "NOT_FOUND", branch: null, candidates: found.slice(0, 10).map(publicCandidate) };
}

const tripInclude = {
  trip: { select: { code: true } },
  routeRevision: { select: { name: true } },
  vehicle: { select: { plateNormalized: true, province: true, brand: true, model: true, color: true, wheelCount: true, capacity: true, capacityUnit: true, type: { select: { name: true, wheelCount: true } }, storageCondition: { select: { name: true } } } },
  driver: { select: { id: true, name: true, phone: true } },
  tripStop_tripRevisionId: { orderBy: { sequence: "asc" as const }, include: {
    branch: { select: { id: true, code: true, name: true, contactName: true, contactPhone: true, addressLine: true, subdistrict: true, district: true, province: true, postalCode: true } },
    tripStopCategory_stopId: { include: { category: { select: { id: true, code: true, name: true } } } },
  } },
} satisfies Prisma.TripRevisionInclude;
type LoadedTrip = Prisma.TripRevisionGetPayload<{ include: typeof tripInclude }>;

function presentTrip(date: string, t: LoadedTrip, p: Principal, branchIds: string[], categoryIds: string[]) {
  const contacts = contactPolicy(p);
  const time = (value: Date | null) => value ? { at: value.toISOString(), offset: instantOffset(date, value), label: offsetLabel(instantOffset(date, value)) } : null;
  const stops = t.tripStop_tripRevisionId.map((s) => {
    const categories = s.tripStopCategory_stopId.map((c) => c.category).sort((a, b) => a.code.localeCompare(b.code));
    const visible = contacts.branch(s.branchId);
    return {
      sequence: s.sequence, branchId: s.branchId, branchCode: s.branch.code,
      // Frozen stop name: later branch renames never rewrite published trips.
      name: s.nameSnapshot, categories,
      matched: stopMatches({ branchId: s.branchId, categoryIds: categories.map((c) => c.id) }, branchIds, categoryIds),
      contact: visible ? { visible: true as const, name: s.branch.contactName, phone: s.branch.contactPhone } : { visible: false as const, name: null, phone: null },
    };
  });
  const v = t.vehicle;
  return {
    tripId: t.tripId, revisionId: t.id, code: t.trip.code, kind: t.kind, roundNo: t.roundNo, cancelled: t.cancelled,
    routeName: t.routeRevision?.name ?? null, notes: t.notes,
    loading: time(t.loadingAt), departure: time(t.departureAt), arrival: time(t.arrivalAt),
    vehicle: v ? { plate: v.plateNormalized, province: v.province, brand: v.brand, model: v.model, color: v.color, typeName: v.type.name, wheelCount: v.wheelCount ?? v.type.wheelCount, storage: v.storageCondition.name, capacity: v.capacity?.toString() ?? null, capacityUnit: v.capacityUnit } : null,
    driver: contacts.driver(t.driverId) && t.driver ? { visible: true as const, name: t.driver.name, phone: t.driver.phone } : { visible: false as const, name: null, phone: null },
    stops, matchedSequences: stops.filter((s) => s.matched).map((s) => s.sequence),
  };
}
export type SearchRow = ReturnType<typeof presentTrip>;

export async function searchTrips(db: PrismaClient, actorId: string, rawInput: SearchInput) {
  const input = validateSearchInput(rawInput), date = serviceDate(input.serviceDate);
  return db.$transaction(async (tx) => {
    const p = await searchPrincipal(tx, actorId), visibility = tripVisibility(p);
    requireCondition(input.kinds.every((k) => visibility.kinds.includes(k)), "FORBIDDEN", "คุณไม่มีสิทธิ์ดูรอบรถประเภทนี้");
    const resolution = await resolveBranch(tx, input);
    const plan = await tx.dailyPlan.findUnique({ where: { serviceDate: date }, select: { publishedRevision: { select: { id: true, number: true, publishedAt: true } } } });
    // Whitelisted column identifier; user text never reaches Prisma.raw.
    const column = Prisma.raw(input.basis === "loading" ? "t.loadingAt" : "t.departureAt");
    const common: Prisma.Sql[] = [
      Prisma.sql`p.serviceDate=${date}`, Prisma.sql`r.status='PUBLISHED'`, Prisma.sql`t.cancelled=0`,
      Prisma.sql`t.kind IN (${Prisma.join(input.kinds)})`, visibility.sql(),
    ];
    if (input.rounds.length) common.push(Prisma.sql`t.roundNo IN (${Prisma.join(input.rounds)})`);
    const categoryMatch = (alias: string) => Prisma.sql`EXISTS (SELECT 1 FROM TripStopCategory sc WHERE sc.stopId=${Prisma.raw(alias)}.id AND sc.categoryId IN (${Prisma.join(input.categoryIds)}))`;
    if (input.categoryIds.length) common.push(Prisma.sql`EXISTS (SELECT 1 FROM TripStop cs WHERE cs.tripRevisionId=t.id AND ${categoryMatch("cs")})`);
    const filters = [...common];
    const branchIds = resolution.branch ? [resolution.branch.id] : [];
    if (input.mode === "branch" && resolution.status !== "NONE") {
      // Branch and category must belong to the same TripStop; an unresolved query matches nothing.
      filters.push(branchIds.length ? Prisma.sql`EXISTS (SELECT 1 FROM TripStop s WHERE s.tripRevisionId=t.id AND s.branchId IN (${Prisma.join(branchIds)})${input.categoryIds.length ? Prisma.sql` AND ${categoryMatch("s")}` : Prisma.empty})` : Prisma.sql`1=0`);
    }
    if (input.mode === "time" && input.times.length) {
      // Each exact chip is one Bangkok minute; NULL (unknown) never satisfies the comparison.
      filters.push(Prisma.sql`(${Prisma.join(input.times.map((offset) => Prisma.sql`(${column} >= ${offsetInstant(input.serviceDate, offset)} AND ${column} < ${offsetInstant(input.serviceDate, offset + 1)})`), " OR ")})`);
    }
    if (input.mode === "range" && input.from !== null && input.to !== null) {
      // Inclusive at both ends: the whole end minute is included; range stays within the local service date.
      filters.push(Prisma.sql`${column} >= ${offsetInstant(input.serviceDate, input.from)} AND ${column} < ${offsetInstant(input.serviceDate, input.to + 1)}`);
    }
    const from = Prisma.sql`FROM DailyPlan p JOIN PlanRevision r ON r.id=p.publishedRevisionId JOIN TripRevision t ON t.planRevisionId=r.id`;
    const where = (parts: Prisma.Sql[]) => Prisma.sql`WHERE ${Prisma.join(parts, " AND ")}`;
    const direction = Prisma.raw(input.sort === "time_desc" ? "DESC" : "ASC");
    const [{ total }] = await tx.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total ${from} ${where(filters)}`;
    const ids = await tx.$queryRaw<Array<{ id: string }>>`SELECT t.id ${from} ${where(filters)}
      ORDER BY (${column} IS NULL) ASC, ${column} ${direction}, t.tripId ASC LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}`;
    const facetRows = await tx.$queryRaw<Array<{ at: Date | null; trips: bigint }>>`SELECT ${column} AS at, COUNT(*) AS trips ${from} ${where(common)} GROUP BY ${column}`;
    const loaded = ids.length ? await tx.tripRevision.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include: tripInclude }) : [];
    const rows = ids.map(({ id }) => presentTrip(input.serviceDate, loaded.find((t) => t.id === id)!, p, branchIds, input.categoryIds));
    const offsets = [...new Set(facetRows.flatMap((f) => f.at ? [instantOffset(input.serviceDate, f.at)] : []))].sort((a, b) => a - b);
    const sameDay = offsets.filter((o) => o >= 0 && o < 1440);
    const totalNumber = Number(total), pageCount = Math.max(1, Math.ceil(totalNumber / input.pageSize));
    return {
      serviceDate: input.serviceDate, applied: input, resolution, total: totalNumber, page: input.page, pageSize: input.pageSize, pageCount, rows,
      published: plan?.publishedRevision ? { number: plan.publishedRevision.number, publishedAt: plan.publishedRevision.publishedAt?.toISOString() ?? null } : null,
      facets: {
        tripCount: facetRows.reduce((sum, f) => sum + Number(f.trips), 0),
        unknownCount: facetRows.filter((f) => !f.at).reduce((sum, f) => sum + Number(f.trips), 0),
        times: offsets.map((offset) => ({ offset, label: offsetLabel(offset) })),
        span: sameDay.length ? { from: sameDay[0], to: sameDay[sameDay.length - 1], fromLabel: offsetLabel(sameDay[0]), toLabel: offsetLabel(sameDay[sameDay.length - 1]) } : null,
      },
      allowedKinds: visibility.kinds,
    };
  }, readOptions);
}
export type SearchResult = Awaited<ReturnType<typeof searchTrips>>;

export async function searchOptions(db: PrismaClient, actorId: string) {
  return db.$transaction(async (tx) => {
    const p = await searchPrincipal(tx, actorId);
    const categories = await tx.productCategory.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
    return { categories, kinds: tripVisibility(p).kinds, canConsign: p.permissions.has("consignment.create") };
  }, readOptions);
}

export type Eligibility = { eligible: boolean; reasons: string[] };
/** Pre-check for the future consignment flow; Phase 6 must re-validate cutoff/limits on submission. */
function consignEligibility(p: Principal, trip: SearchRow, branchId: string | null, now: Date): Eligibility {
  const reasons: string[] = [];
  if (!p.permissions.has("consignment.create")) reasons.push("บัญชีนี้ไม่มีสิทธิ์สร้างคำขอฝากส่ง");
  if (trip.cancelled) reasons.push("รอบรถนี้ถูกยกเลิกแล้ว");
  if (trip.kind !== "BRANCH_DELIVERY") reasons.push("ฝากของได้เฉพาะรอบส่งสินค้าสาขา");
  if (!branchId || !trip.stops.some((s) => s.branchId === branchId)) reasons.push("กรุณาเลือกสาขาปลายทางที่รอบรถนี้แวะส่ง");
  if (!trip.departure) reasons.push("รอบรถนี้ยังไม่ระบุเวลาออกรถ");
  else if (new Date(trip.departure.at) <= now) reasons.push("รอบรถนี้ออกรถไปแล้ว");
  return { eligible: reasons.length === 0, reasons };
}

export async function tripDetail(db: PrismaClient, actorId: string, tripId: string, options: { branchId?: string | null; now?: Date } = {}) {
  requireCondition(typeof tripId === "string" && /^[A-Za-z0-9_-]{1,36}$/.test(tripId), "NOT_FOUND", "ไม่พบรอบรถหรือคุณไม่มีสิทธิ์เข้าถึง");
  const branchId = options.branchId && /^[A-Za-z0-9_-]{1,36}$/.test(options.branchId) ? options.branchId : null;
  return db.$transaction(async (tx) => {
    const p = await searchPrincipal(tx, actorId);
    const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { plan: { select: { serviceDate: true, publishedRevisionId: true, publishedRevision: { select: { number: true, publishedAt: true } } } } } });
    // Only the current published revision is searchable; drafts and superseded rows are not exposed here.
    const revision = trip?.plan.publishedRevisionId ? await tx.tripRevision.findUnique({ where: { planRevisionId_tripId: { planRevisionId: trip.plan.publishedRevisionId, tripId } }, include: tripInclude }) : null;
    // Out-of-scope trips look identical to missing ones so their existence is not disclosed.
    requireCondition(trip && revision && tripVisibility(p).allows({ kind: revision.kind, driverId: revision.driverId, stops: revision.tripStop_tripRevisionId }), "NOT_FOUND", "ไม่พบรอบรถหรือคุณไม่มีสิทธิ์เข้าถึง");
    const date = trip.plan.serviceDate.toISOString().slice(0, 10);
    const row = presentTrip(date, revision, p, branchId ? [branchId] : [], []);
    return {
      ...row, serviceDate: date, branchId, published: { number: trip.plan.publishedRevision!.number, publishedAt: trip.plan.publishedRevision!.publishedAt?.toISOString() ?? null },
      stops: row.stops.map((s) => {
        const b = revision.tripStop_tripRevisionId.find((x) => x.sequence === s.sequence)!.branch;
        // Printable business addresses are shown to trip readers; personal contacts follow contactPolicy.
        return { ...s, address: [b.addressLine, b.subdistrict, b.district, b.province, b.postalCode].join(" ") };
      }),
      eligibility: consignEligibility(p, row, branchId, options.now ?? new Date()),
    };
  }, readOptions);
}
export type TripDetail = Awaited<ReturnType<typeof tripDetail>>;

export async function branchDirectory(db: PrismaClient, actorId: string, input: { query: string; page: number }) {
  requireCondition(typeof input.query === "string" && input.query.length <= 100 && Number.isInteger(input.page) && input.page >= 1 && input.page <= 10_000, "INVALID_SEARCH", "เงื่อนไขการค้นหาไม่ถูกต้อง");
  return db.$transaction(async (tx) => {
    const p = await searchPrincipal(tx, actorId), contacts = contactPolicy(p), pageSize = SEARCH_DIRECTORY_PAGE;
    const like = likeValue(input.query);
    const match = input.query ? Prisma.sql`AND (b.code LIKE ${like} OR b.name LIKE ${like} OR EXISTS (SELECT 1 FROM BranchAlias a WHERE a.branchId=b.id AND a.active=1 AND a.name LIKE ${like}))` : Prisma.empty;
    const [{ total }] = await tx.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total FROM Branch b WHERE b.archived=0 ${match}`;
    const ids = await tx.$queryRaw<Array<{ id: string }>>`SELECT b.id FROM Branch b WHERE b.archived=0 ${match} ORDER BY b.code ASC, b.id ASC LIMIT ${pageSize} OFFSET ${(input.page - 1) * pageSize}`;
    const branches = await tx.branch.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include: { branchAlias_branchId: { where: { active: true }, orderBy: { name: "asc" }, select: { name: true } } } });
    const rows = ids.map(({ id }) => {
      const b = branches.find((x) => x.id === id)!, visible = contacts.branch(b.id);
      return {
        id: b.id, code: b.code, name: b.name, destinationType: b.destinationType, aliases: b.branchAlias_branchId.map((a) => a.name),
        address: [b.addressLine, b.subdistrict, b.district, b.province, b.postalCode].join(" "),
        activeFrom: b.activeFrom.toISOString().slice(0, 10), activeTo: b.activeTo?.toISOString().slice(0, 10) ?? null,
        receiving: b.receivingFromMinute !== null && b.receivingToMinute !== null ? `${offsetLabel(b.receivingFromMinute)}–${offsetLabel(b.receivingToMinute)}` : null,
        contact: visible ? { visible: true as const, name: b.contactName, phone: b.contactPhone } : { visible: false as const, name: null, phone: null },
      };
    });
    return { rows, total: Number(total), page: input.page, pageSize, pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)) };
  }, readOptions);
}
export type BranchDirectory = Awaited<ReturnType<typeof branchDirectory>>;
