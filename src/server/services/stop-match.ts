import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { serviceDate } from "../domain/planning";
import { authorize } from "./transaction";

/** Minimal Phase 2 predicate, not the Phase 4 public search/pagination API. */
export async function findPublishedTripIds(db: PrismaClient, actorId: string, input: { serviceDate: string; branchId: string; categoryCode: string }) {
  return db.$transaction(async (tx) => {
    await authorize(tx, actorId, "trip.read", { branchId: input.branchId });
    return tx.$queryRaw<Array<{ tripId: string }>>`
      SELECT t.tripId FROM DailyPlan p JOIN PlanRevision r ON r.id=p.publishedRevisionId
      JOIN TripRevision t ON t.planRevisionId=r.id
      WHERE p.serviceDate=${serviceDate(input.serviceDate)} AND r.status='PUBLISHED' AND t.cancelled=0
      AND EXISTS (SELECT 1 FROM TripStop s JOIN TripStopCategory sc ON sc.stopId=s.id
        JOIN ProductCategory c ON c.id=sc.categoryId
        WHERE s.tripRevisionId=t.id AND s.branchId=${input.branchId} AND c.code=${input.categoryCode})
      ORDER BY t.departureAt, t.tripId`;
  }, { isolationLevel: "RepeatableRead" });
}
