import "server-only";
import type { Transaction } from "../services/transaction";
import { principal, requireCapability } from "./permissions";
import { requireCondition } from "../domain/errors";

/** Use the same predicate for detail, export, file, print and later mutation adapters. */
export async function requireConsignmentAccess(tx:Transaction,actorId:string,id:string,capability="consignment.read") {
  const p=await principal(tx,actorId);requireCapability(p,capability);
  const c=await tx.consignment.findUnique({where:{id},include:{currentAssignment:{include:{tripRevision:true}}}});
  requireCondition(c,"NOT_FOUND","ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");
  const roles=await tx.userRole.findMany({where:{userId:actorId},include:{role:true}}),codes=new Set(roles.map(r=>r.role.code));
  const permitted=p.global||p.scopes.some(scope=>
    (scope.kind==="BRANCH"&&scope.branchId===c.destinationBranchId)||
    (scope.kind==="WAREHOUSE"&&scope.warehouseId===c.sourceWarehouseId)||
    (scope.kind==="DEPARTMENT"&&scope.departmentId===c.departmentId)||
    (scope.kind==="DRIVER"&&scope.driverId===c.currentAssignment?.tripRevision.driverId))||
    (codes.has("REQUESTER")&&c.requesterId===actorId);
  requireCondition(permitted,"FORBIDDEN","คุณไม่มีสิทธิ์เข้าถึงพัสดุนี้");return c;
}
export async function requireTripAccess(tx:Transaction,actorId:string,tripRevisionId:string,capability="trip.read"){
  const p=await principal(tx,actorId);requireCapability(p,capability);
  const trip=await tx.tripRevision.findUnique({where:{id:tripRevisionId},include:{tripStop_tripRevisionId:true}});
  requireCondition(trip,"NOT_FOUND","ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");
  requireCondition(p.global||p.scopes.some(s=>(s.kind==="DRIVER"&&s.driverId===trip.driverId)||(s.kind==="BRANCH"&&trip.tripStop_tripRevisionId.some(stop=>stop.branchId===s.branchId))),"FORBIDDEN","คุณไม่มีสิทธิ์เข้าถึงเที่ยวรถนี้");return trip;
}
