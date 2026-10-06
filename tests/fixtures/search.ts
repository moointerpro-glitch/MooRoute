import type { PrismaClient } from "../../src/generated/prisma/client";
import { bangkokInstant } from "../../src/server/domain/planning";
import { saveDraft, publishPlan, type DraftTrip } from "../../src/server/services/plans";
import { seedMasters, synthetic, completeDraft } from "./synthetic";

/** Synthetic Phase 5 search scenario. Nothing here is a real branch, plate, contact or schedule. */
export const searchFixture = {
  date: "2028-03-01", nextDate: "2028-03-02", unknownDate: "2028-03-03",
  driverId: "synthetic-search-driver", vehicleIds: [4, 5, 6, 7, 8, 9, 10, 11].map((n) => `synthetic-vehicle-${n}`),
  aliasA: "แจ้ห่มสังเคราะห์", sharedAlias: "สาขาร่วมสังเคราะห์",
};
const [A, B, C] = synthetic.branchIds, [PORK, CHICKEN] = synthetic.categoryIds;
const at = (date: string, minute: number) => bangkokInstant(date, minute).toISOString();
const previousDay = (date: string, minute: number) => new Date(bangkokInstant(date, 0).valueOf() - (1440 - minute) * 60_000).toISOString();
const nextDay = (date: string, minute: number) => new Date(bangkokInstant(date, 0).valueOf() + (1440 + minute) * 60_000).toISOString();

function trip(date: string, id: string, vehicle: number, roundNo: number | null, times: { loading: string | null; departure: string | null; start: string; end: string; arrival?: string | null }, stops: DraftTrip["stops"], extra: Partial<DraftTrip> = {}): DraftTrip {
  return { tripId: id, code: id, kind: "BRANCH_DELIVERY", roundNo, cancelled: false, vehicleId: searchFixture.vehicleIds[vehicle], driverId: null,
    loadingAt: times.loading, departureAt: times.departure, arrivalAt: times.arrival ?? null, occupancyStart: times.start, occupancyEnd: times.end, bufferMinutes: 0, stops, ...extra };
}

async function seedSearchMasters(db: PrismaClient) {
  await seedMasters(db);
  await db.$transaction(async (tx) => {
    for (const id of searchFixture.vehicleIds) await tx.vehicle.upsert({ where: { id }, create: { id, plateNormalized: `SYN-${id.slice(-2).replace("-", "")}`, province: "ข้อมูลสังเคราะห์", typeId: "synthetic-type", storageConditionId: "synthetic-chilled", brand: "ยี่ห้อทดสอบ", color: "ขาว" }, update: {} });
    await tx.driver.upsert({ where: { id: searchFixture.driverId }, create: { id: searchFixture.driverId, code: "SYN-SEARCH-DRIVER", name: "พนักงานขับรถสังเคราะห์", phone: "000-000-0009" }, update: {} });
    await tx.branchAlias.upsert({ where: { branchId_name: { branchId: A, name: searchFixture.aliasA } }, create: { branchId: A, name: searchFixture.aliasA }, update: {} });
    for (const id of [B, C]) await tx.branchAlias.upsert({ where: { branchId_name: { branchId: id, name: searchFixture.sharedAlias } }, create: { branchId: id, name: searchFixture.sharedAlias }, update: {} });
    for (const [index, id] of [A, B, C].entries()) await tx.branch.update({ where: { id }, data: { contactName: `ผู้ติดต่อสังเคราะห์ ${index + 1}`, contactPhone: `000-000-000${index + 1}` } });
  });
}

/** Coverage-complete base plus extra trips that exercise same-stop, duplicate-stop, midnight and kind rules. */
export function searchDraft(date: string) {
  const base = completeDraft(date, `s5-${date}`);
  const p = `s5-${date}`;
  base.trips.push(
    trip(date, `${p}-split`, 0, 1, { loading: null, departure: at(date, 540), start: at(date, 510), end: at(date, 660) }, [{ branchId: A, categoryIds: [PORK] }, { branchId: B, categoryIds: [CHICKEN] }]),
    trip(date, `${p}-dup`, 1, 2, { loading: at(date, 510), departure: at(date, 540), start: at(date, 510), end: at(date, 660) }, [{ branchId: A, categoryIds: [PORK] }, { branchId: B, categoryIds: [] }, { branchId: A, categoryIds: [CHICKEN] }]),
    trip(date, `${p}-late`, 2, 3, { loading: at(date, 1410), departure: at(date, 1439), arrival: nextDay(date, 60), start: at(date, 1410), end: nextDay(date, 90) }, [{ branchId: C, categoryIds: [PORK] }]),
    trip(date, `${p}-early`, 3, 1, { loading: previousDay(date, 1425), departure: at(date, 15), start: previousDay(date, 1425), end: at(date, 120) }, [{ branchId: B, categoryIds: [CHICKEN] }]),
    trip(date, `${p}-van`, 4, null, { loading: at(date, 750), departure: at(date, 780), start: at(date, 750), end: at(date, 900) }, [{ branchId: C, categoryIds: [] }], { kind: "VAN_SALES", driverId: searchFixture.driverId }),
    trip(date, `${p}-cancel`, 5, 2, { loading: at(date, 570), departure: at(date, 600), start: at(date, 570), end: at(date, 700) }, [{ branchId: A, categoryIds: [PORK, CHICKEN] }], { cancelled: true }),
    trip(date, `${p}-1530`, 6, 3, { loading: at(date, 900), departure: at(date, 930), start: at(date, 900), end: at(date, 1000) }, [{ branchId: C, categoryIds: [PORK] }]),
  );
  return base;
}

async function publish(db: PrismaClient, key: string, input: ReturnType<typeof completeDraft>) {
  const plan = await db.dailyPlan.findUnique({ where: { serviceDate: new Date(`${input.serviceDate}T00:00:00Z`) } });
  if (plan?.publishedRevisionId) return plan.publishedRevisionId;
  const draft = await saveDraft(db, synthetic.actorId, `${key}-draft`, { ...input, expectedVersion: plan?.version ?? 0, reason: "ข้อมูลสังเคราะห์สำหรับทดสอบการค้นหา" });
  return (await publishPlan(db, synthetic.actorId, `${key}-publish`, { revisionId: draft.revisionId, expectedVersion: draft.version })).revisionId;
}

export async function seedSearchFixture(db: PrismaClient) {
  await seedSearchMasters(db);
  const { date, nextDate, unknownDate } = searchFixture;
  await publish(db, "s5-day", searchDraft(date));
  const next = completeDraft(nextDate, `s5n-${nextDate}`);
  next.trips.push(trip(nextDate, `s5n-${nextDate}-midnight`, 7, 1, { loading: previousDay(nextDate, 1430), departure: at(nextDate, 0), start: previousDay(nextDate, 1430), end: at(nextDate, 60) }, [{ branchId: A, categoryIds: [PORK] }]));
  await publish(db, "s5-next", next);
  await seedUnknownDeparture(db, unknownDate);
}

/**
 * Privileged test-only setup. Publication correctly rejects an active trip without departure, so this
 * simulates a legacy/imported published row to prove the search predicate itself never treats NULL as a time.
 */
async function seedUnknownDeparture(db: PrismaClient, date: string) {
  const existing = await db.dailyPlan.findUnique({ where: { serviceDate: new Date(`${date}T00:00:00Z`) } });
  if (existing?.publishedRevisionId) return;
  const input = completeDraft(date, `s5u-${date}`);
  input.trips.push(trip(date, `s5u-${date}-unknown`, 0, 2, { loading: at(date, 600), departure: null, start: at(date, 600), end: at(date, 700) }, [{ branchId: A, categoryIds: [PORK, CHICKEN] }]));
  const draft = await saveDraft(db, synthetic.actorId, "s5-unknown-draft", { ...input, reason: "ข้อมูลสังเคราะห์: เวลาออกรถไม่ทราบ" });
  await db.$transaction(async (tx) => {
    await tx.planRevision.update({ where: { id: draft.revisionId }, data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: synthetic.actorId } });
    await tx.dailyPlan.update({ where: { id: draft.planId }, data: { publishedRevisionId: draft.revisionId } });
  });
}
