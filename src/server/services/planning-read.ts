import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { serviceDate, overlaps } from "../domain/planning";
import { requireCondition } from "../domain/errors";
import { authorize } from "./transaction";
import { principal } from "../auth/permissions";
import { candidateCoverage } from "./plans";
import { draftTrips } from "./planning-catalog";
import { requiresMove } from "./planning-reassignment";

export async function planningData(db:PrismaClient,actorId:string,dateValue:string,revisionId?:string|null){
 const date=serviceDate(dateValue);
 return db.$transaction(async tx=>{
  await authorize(tx,actorId,"plan.read");const p=await principal(tx,actorId);
  const plan=await tx.dailyPlan.findUnique({where:{serviceDate:date}});
  const revisions=plan?await tx.planRevision.findMany({where:{planId:plan.id},orderBy:{number:"desc"},include:{createdBy:{select:{displayName:true}},publishedBy:{select:{displayName:true}}}}):[];
  const selected=revisionId?revisions.find(r=>r.id===revisionId):revisions[0];requireCondition(!revisionId||selected,"NOT_FOUND","ไม่พบฉบับแผนของวันที่เลือก");
  const branches=await tx.branch.findMany({orderBy:{code:"asc"},select:{id:true,code:true,name:true,destinationType:true,archived:true,activeFrom:true,activeTo:true}});
  const eligible=branches.filter(b=>b.destinationType==="BRANCH"&&!b.archived&&b.activeFrom<=date&&(!b.activeTo||b.activeTo>=date));
  const vehicles=await tx.vehicle.findMany({orderBy:{plateNormalized:"asc"},select:{id:true,plateNormalized:true,province:true,active:true,capacity:true,capacityUnit:true}});
  const drivers=await tx.driver.findMany({orderBy:{name:"asc"},select:{id:true,name:true,active:true}});
  const categories=await tx.productCategory.findMany({orderBy:{code:"asc"},select:{id:true,code:true,name:true,active:true}});
  const routes=await tx.route.findMany({orderBy:{code:"asc"},include:{routeRevision_routeId:{orderBy:{number:"desc"},include:{routeStop_routeRevisionId:{orderBy:{sequence:"asc"}}}}}});
  const templates=await tx.scheduleTemplate.findMany({orderBy:{code:"asc"},include:{templateRevision_templateId:{orderBy:{number:"desc"},include:{templateWeekday_templateRevisionId:true,templateStopCategory_templateRevisionId:true}}}});
  const trips=selected?await draftTrips(tx,selected.id):[];
  const coverage=selected?await candidateCoverage(tx,selected.id):null;
  const linked=plan?.publishedRevisionId?await tx.consignment.findMany({where:requiresMove({tripRevision:{planRevisionId:plan.publishedRevisionId}}),select:{id:true,code:true,version:true,status:true,destinationBranchId:true,currentAssignment:{select:{tripId:true,tripRevisionId:true}}},orderBy:{code:"asc"}}):[];
  const issues:string[]=[];
  const reservations=await tx.vehicleReservation.findMany({where:{active:true,tripRevision:{planRevisionId:{not:plan?.publishedRevisionId??""}}}});
  for(const t of trips.filter(t=>!t.cancelled)){
   if(!t.vehicleId||!t.departureAt||!t.occupancyStart||!t.occupancyEnd)issues.push(`${t.code}: ยังไม่ระบุรถ เวลาออก หรือช่วงใช้รถครบ`);
   if(t.occupancyStart&&t.occupancyEnd&&t.vehicleId){
    const interval={start:new Date(t.occupancyStart),end:new Date(Date.parse(t.occupancyEnd)+t.bufferMinutes*60000)};
    if(reservations.some(r=>r.vehicleId===t.vehicleId&&overlaps(interval,{start:r.startAt,end:r.endAt})))issues.push(`${t.code}: รถมีการจองทับซ้อนกับแผนที่เผยแพร่`);
    if(trips.some(o=>o.tripId!==t.tripId&&!o.cancelled&&o.vehicleId===t.vehicleId&&o.occupancyStart&&o.occupancyEnd&&overlaps(interval,{start:new Date(o.occupancyStart),end:new Date(Date.parse(o.occupancyEnd)+o.bufferMinutes*60000)})))issues.push(`${t.code}: รถมีการใช้ซ้ำในฉบับนี้`);
   }
   const vehicle=vehicles.find(v=>v.id===t.vehicleId);if(t.plannedLoad&&vehicle?.capacity&&(t.loadUnit!==vehicle.capacityUnit||vehicle.capacity.lt(t.plannedLoad)))issues.push(`${t.code}: ปริมาณบรรทุกเกินความจุหรือหน่วยไม่ตรงกัน`);
  }
  const oldTrips=plan?.publishedRevisionId?await draftTrips(tx,plan.publishedRevisionId):[];
  const changed=trips.filter(t=>JSON.stringify(t)!==JSON.stringify(oldTrips.find(o=>o.tripId===t.tripId))).map(t=>t.code);
  const entityIds=[...revisions.map(r=>r.id),...(plan?[plan.id]:[]),...routes.map(r=>r.id),...templates.map(t=>t.id)];
  const audit=await tx.auditLog.findMany({where:{entityId:{in:entityIds}},orderBy:{createdAt:"desc"},take:100,include:{actor:{select:{displayName:true}}}});
  return {permissions:[...p.permissions],serviceDate:dateValue,version:plan?.version??0,publishedRevisionId:plan?.publishedRevisionId??null,selectedRevisionId:selected?.id??null,revisions,branches,eligible,vehicles:vehicles.map(v=>({...v,capacity:v.capacity?.toString()??null})),drivers,categories,routes,templates,trips,missing:coverage?.missing??eligible.flatMap(b=>[1,2,3].flatMap(roundNo=>["PORK","CHICKEN"].map(categoryCode=>({branchId:b.id,roundNo,categoryCode})))),linked,issues,changed,audit};
 },{isolationLevel:"RepeatableRead",timeout:20000});
}
type Jsonify<T>=T extends Date?string:T extends Array<infer U>?Jsonify<U>[]:T extends object?{[K in keyof T]:Jsonify<T[K]>}:T;
export type PlanningData=Jsonify<Awaited<ReturnType<typeof planningData>>>;
