import { requireCondition } from "./errors";

export type CoverageStop = { branchId: string; categoryCodes: string[] };
export type CoverageTrip = { kind: string; roundNo: number | null; cancelled: boolean; stops: CoverageStop[] };
export type CoverageCell = { branchId: string; roundNo: number; categoryCode: string };

export function missingCoverage(branchIds: string[], trips: CoverageTrip[]): CoverageCell[] {
  const covered = new Set<string>();
  for (const trip of trips) {
    if (trip.cancelled || trip.kind !== "BRANCH_DELIVERY") continue;
    for (const stop of trip.stops) for (const category of stop.categoryCodes) {
      covered.add(JSON.stringify([stop.branchId, trip.roundNo, category]));
    }
  }
  return branchIds.flatMap((branchId) => [1, 2, 3].flatMap((roundNo) => ["PORK", "CHICKEN"]
    .filter((categoryCode) => !covered.has(JSON.stringify([branchId, roundNo, categoryCode])))
    .map((categoryCode) => ({ branchId, roundNo, categoryCode }))));
}
export function matchesStop(stops: CoverageStop[], branchId: string, categoryCodes: string[]) {
  return stops.some((stop) => stop.branchId === branchId && (!categoryCodes.length || categoryCodes.some((code) => stop.categoryCodes.includes(code))));
}
export function serviceDate(value: string): Date {
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(value), "INVALID_DATE", "วันที่ไม่ถูกต้อง");
  const date = new Date(`${value}T00:00:00.000Z`);
  requireCondition(Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value, "INVALID_DATE", "วันที่ไม่ถูกต้อง");
  return date;
}
export function bangkokInstant(date: string, minute: number): Date {
  const day = serviceDate(date);
  requireCondition(Number.isInteger(minute) && minute >= 0 && minute < 1440, "INVALID_TIME", "เวลาไม่ถูกต้อง");
  return new Date(day.valueOf() + (minute - 420) * 60_000);
}
export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && b.start < a.end;
}
