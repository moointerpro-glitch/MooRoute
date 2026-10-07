import "server-only";
import { Prisma } from "../../generated/prisma/client";
import type { Transaction } from "../services/transaction";
import { principal, requireCapability, type Principal } from "./permissions";
import { requireCondition } from "../domain/errors";

type ConsignmentRow = { requesterId: string; status: string; destinationBranchId: string; sourceWarehouseId: string; departmentId: string };

/**
 * Single consignment row policy for list, detail, export, file, print and mutation adapters.
 * Drafts are private to their requester; every other row needs a matching scope.
 */
export async function consignmentScope(tx: Transaction, p: Principal, actorId: string) {
  const requester = p.permissions.has("consignment.create");
  const ids = (kind: string, key: "branchId" | "warehouseId" | "departmentId" | "driverId") => p.scopes.flatMap((s) => s.kind === kind && s[key] ? [s[key]!] : []);
  // Drafts are private to their requester; only the administrator capability may read other users' drafts (D215).
  const readsDrafts = p.permissions.has("consignment.read.drafts");
  const branchIds = ids("BRANCH", "branchId"), warehouseIds = ids("WAREHOUSE", "warehouseId"), departmentIds = p.permissions.has("consignment.read.department") ? ids("DEPARTMENT", "departmentId") : [], driverIds = ids("DRIVER", "driverId");
  return {
    allows(c: ConsignmentRow, currentDriverId: string | null) {
      if (c.status === "DRAFT") return c.requesterId === actorId || readsDrafts;
      return p.global || branchIds.includes(c.destinationBranchId) || warehouseIds.includes(c.sourceWarehouseId) || departmentIds.includes(c.departmentId) ||
        (!!currentDriverId && driverIds.includes(currentDriverId)) || (requester && c.requesterId === actorId);
    },
    sql() {
      const parts: Prisma.Sql[] = [];
      if (p.global) parts.push(Prisma.sql`1=1`);
      if (branchIds.length) parts.push(Prisma.sql`c.destinationBranchId IN (${Prisma.join(branchIds)})`);
      if (warehouseIds.length) parts.push(Prisma.sql`c.sourceWarehouseId IN (${Prisma.join(warehouseIds)})`);
      if (departmentIds.length) parts.push(Prisma.sql`c.departmentId IN (${Prisma.join(departmentIds)})`);
      if (driverIds.length) parts.push(Prisma.sql`EXISTS (SELECT 1 FROM ConsignmentAssignment sa JOIN TripRevision st ON st.id=sa.tripRevisionId WHERE sa.id=c.currentAssignmentId AND st.driverId IN (${Prisma.join(driverIds)}))`);
      if (requester) parts.push(Prisma.sql`c.requesterId=${actorId}`);
      const any = parts.length ? Prisma.join(parts, " OR ") : Prisma.sql`1=0`;
      return readsDrafts ? Prisma.sql`(${any})` : Prisma.sql`(${any}) AND (c.status<>'DRAFT' OR c.requesterId=${actorId})`;
    },
  };
}

/** Use the same predicate for detail, export, file, print and later mutation adapters. */
export async function requireConsignmentAccess(tx:Transaction,actorId:string,id:string,capability="consignment.read") {
  const p=await principal(tx,actorId);requireCapability(p,capability);
  const c=await tx.consignment.findUnique({where:{id},include:{currentAssignment:{include:{tripRevision:true}}}});
  requireCondition(c,"NOT_FOUND","ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");
  // Someone else's draft is indistinguishable from a missing record.
  requireCondition(c.status!=="DRAFT"||c.requesterId===actorId||p.permissions.has("consignment.read.drafts"),"NOT_FOUND","ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");
  const scope=await consignmentScope(tx,p,actorId);
  requireCondition(scope.allows(c,c.currentAssignment?.tripRevision.driverId??null),"FORBIDDEN","คุณไม่มีสิทธิ์เข้าถึงพัสดุนี้");return c;
}
export async function requireTripAccess(tx:Transaction,actorId:string,tripRevisionId:string,capability="trip.read"){
  const p=await principal(tx,actorId);requireCapability(p,capability);
  const trip=await tx.tripRevision.findUnique({where:{id:tripRevisionId},include:{tripStop_tripRevisionId:true}});
  requireCondition(trip,"NOT_FOUND","ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");
  requireCondition(p.global||p.scopes.some(s=>(s.kind==="DRIVER"&&s.driverId===trip.driverId)||(s.kind==="BRANCH"&&trip.tripStop_tripRevisionId.some(stop=>stop.branchId===s.branchId))),"FORBIDDEN","คุณไม่มีสิทธิ์เข้าถึงเที่ยวรถนี้");return trip;
}
