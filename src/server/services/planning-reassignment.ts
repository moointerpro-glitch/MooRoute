import "server-only";
import type { Prisma, TripRevision } from "../../generated/prisma/client";
import { requireCondition, versionMatches } from "../domain/errors";
import type { Transaction } from "./transaction";

export interface Reassignment { consignmentId: string; expectedVersion: number; tripId: string; stopSequence: number }
/**
 * Consignments a replacement plan must move: current assignment on the replaced revision, excluding
 * terminal records that never moved. A cancelled consignment keeps its assignment only as history.
 * Shared by publication and the planner read so both list exactly the same records.
 */
export const requiresMove = (assignment: Prisma.ConsignmentAssignmentWhereInput): Prisma.ConsignmentWhereInput =>
  ({ currentAssignment: assignment, status: { notIn: ["CANCELLED", "REJECTED"] } });
export async function reassignForPublication(tx: Transaction, actorId: string, idempotencyId: string, oldIds: string[], trips: TripRevision[], moves: Reassignment[], reason?: string) {
  requireCondition(Array.isArray(moves)&&moves.length<=500&&moves.every(m=>m&&typeof m.consignmentId==="string"&&typeof m.tripId==="string"&&Number.isInteger(m.expectedVersion)&&Number.isInteger(m.stopSequence)),"INVALID_INPUT","ข้อมูลย้ายพัสดุไม่ถูกต้อง");
  const linked = await tx.consignment.findMany({where:requiresMove({tripRevisionId:{in:oldIds}}),orderBy:{id:"asc"}});
  requireCondition(moves.length===linked.length && new Set(moves.map(m=>m.consignmentId)).size===moves.length && linked.every(c=>moves.some(m=>m.consignmentId===c.id)),"REASSIGNMENT_REQUIRED","กรุณาระบุเที่ยวและจุดส่งใหม่ให้พัสดุที่ผูกกับแผนเดิมครบทุกใบ");
  if(!linked.length)return;
  requireCondition(typeof reason==="string"&&reason.trim().length>=3&&reason.length<=500,"REASON_REQUIRED","กรุณาระบุเหตุผลการย้ายพัสดุ");
  for(const row of linked){
    await tx.$queryRaw`SELECT id FROM Consignment WHERE id=${row.id} FOR UPDATE`;
    const c=await tx.consignment.findUniqueOrThrow({where:{id:row.id},include:{currentAssignment:true,consignmentPackage_consignmentId:true}});
    requireCondition(c.requesterId!==actorId,"SELF_REVIEW","คำขอที่คุณสร้างต้องให้ผู้วางแผนขนส่งอีกคนอนุมัติการย้ายผ่านแผน");
    const move=moves.find(m=>m.consignmentId===c.id)!;
    versionMatches(c.version,move.expectedVersion);
    requireCondition(c.currentAssignment&&oldIds.includes(c.currentAssignment.tripRevisionId),"VERSION_CONFLICT","พัสดุถูกเปลี่ยนแปลงแล้ว กรุณาโหลดแผนใหม่");
    requireCondition(["ASSIGNED","WAREHOUSE_RECEIVED"].includes(c.status)&&c.consignmentPackage_consignmentId.every(p=>["SENDER","WAREHOUSE"].includes(p.custody))&&!(await tx.consignmentEvent.count({where:{consignmentId:c.id,kind:{in:["LOADED","DEPARTED","RECEIPT"]}}})),"CONSIGNMENT_IN_MOTION","พัสดุขึ้นรถหรือมีการรับแล้ว ไม่สามารถย้ายด้วยการปรับแผนได้");
    const trip=trips.find(t=>t.tripId===move.tripId&&!t.cancelled&&t.kind==="BRANCH_DELIVERY");
    requireCondition(trip,"INVALID_ASSIGNMENT","เที่ยวปลายทางต้องเป็นเที่ยวส่งสาขาที่ยังไม่ยกเลิก");
    const plan=await tx.dailyPlan.findUniqueOrThrow({where:{id:trip.planId}});
    const stop=await tx.tripStop.findUnique({where:{tripRevisionId_sequence:{tripRevisionId:trip.id,sequence:move.stopSequence}}});
    requireCondition(stop?.branchId===c.destinationBranchId,"INVALID_ASSIGNMENT","จุดส่งใหม่ไม่ตรงกับสาขาปลายทางของพัสดุ");
    const previous=c.currentAssignment;
    const vehicle=trip.vehicleId?await tx.vehicle.findUnique({where:{id:trip.vehicleId}}):null;
    const assignment=await tx.consignmentAssignment.create({data:{consignmentId:c.id,tripId:trip.tripId,tripRevisionId:trip.id,stopId:stop.id,senderSnapshotId:previous.senderSnapshotId,recipientSnapshotId:previous.recipientSnapshotId,previousAssignmentId:previous.id,reason,approvedById:actorId,approvedAt:new Date(),transportSnapshot:{schemaVersion:1,tripId:trip.tripId,tripRevisionId:trip.id,serviceDate:plan.serviceDate.toISOString().slice(0,10),roundNo:trip.roundNo,vehicleId:trip.vehicleId,plate:vehicle?.plateNormalized??null,province:vehicle?.province??null,driverId:trip.driverId,loadingAt:trip.loadingAt?.toISOString()??null,departureAt:trip.departureAt?.toISOString()??null,stopSequence:stop.sequence}}});
    await tx.labelVersion.updateMany({where:{assignmentId:previous.id,revokedAt:null},data:{revokedAt:new Date(),revocationReason:reason}});
    await tx.consignment.update({where:{id:c.id},data:{currentAssignmentId:assignment.id,version:{increment:1}}});
    await tx.consignmentEvent.create({data:{consignmentId:c.id,actorId,kind:"ASSIGNED",occurredAt:new Date(),idempotencyId,payload:{previousAssignmentId:previous.id,assignmentId:assignment.id,reason}}});
    await tx.auditLog.create({data:{actorId,action:"CONSIGNMENT_REASSIGNED",entityType:"Consignment",entityId:c.id,idempotencyId,reason,before:{assignmentId:previous.id,version:c.version},after:{assignmentId:assignment.id,version:c.version+1}}});
  }
}
