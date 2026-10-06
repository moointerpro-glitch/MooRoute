import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient, TripKind } from "../../generated/prisma/client";
import { requireCondition, versionMatches } from "../domain/errors";
import { bangkokInstant, serviceDate } from "../domain/planning";
import { authorize, guardedWrite, lockEligibility, replay, type Transaction } from "./transaction";
import { saveDraftTransaction, type DraftTrip } from "./plans";

type IdentityInput={id:string;code:string;expectedVersion:number;active:boolean;effectiveFrom:string;effectiveTo:string|null;reason:string};
export type RouteInput=IdentityInput&{name:string;branchIds:string[]};
export type TemplateInput=IdentityInput&{routeRevisionId:string;kind:TripKind;roundNo:number;vehicleId:string|null;driverId:string|null;loadingMinute:number|null;departureMinute:number|null;arrivalMinute:number|null;arrivalDayOffset:number;occupancyStartMinute:number|null;occupancyEndMinute:number|null;bufferMinutes:number;notes:string|null;weekdays:number[];categories:{routeStopId:string;categoryIds:string[]}[]};
function identity(i:IdentityInput){
  requireCondition(i&&typeof i==="object"&&typeof i.id==="string"&&/^[A-Za-z0-9_-]{1,36}$/.test(i.id)&&typeof i.code==="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(i.code)&&Number.isInteger(i.expectedVersion)&&i.expectedVersion>=0&&typeof i.active==="boolean","INVALID_INPUT","รหัสหรือรุ่นข้อมูลไม่ถูกต้อง");
  requireCondition(typeof i.reason==="string"&&i.reason.trim().length>=3&&i.reason.length<=500,"REASON_REQUIRED","กรุณาระบุเหตุผลอย่างน้อย ๓ ตัวอักษร");
  const from=serviceDate(i.effectiveFrom),to=i.effectiveTo===null?null:serviceDate(i.effectiveTo);
  requireCondition(!to||to>=from,"INVALID_DATE","วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");return {from,to};
}
export async function saveRoute(db:PrismaClient,actorId:string,key:string,i:RouteInput){
  const {from,to}=identity(i);
  requireCondition(typeof i.name==="string"&&i.name.trim().length>0&&i.name.length<=191&&Array.isArray(i.branchIds)&&i.branchIds.length>0&&i.branchIds.length<=100&&i.branchIds.every(id=>typeof id==="string"),"INVALID_INPUT","กรุณาระบุชื่อและจุดส่งตามลำดับ");
  return guardedWrite(db,actorId,"route.save",key,i,async(tx,idem)=>{
    await authorize(tx,actorId,"route.write");const prior=await replay<{id:string;revisionId:string;version:number}>(tx,idem);if(prior)return prior;
    await lockEligibility(tx);const old=await tx.route.findUnique({where:{id:i.id}});versionMatches(old?.version??0,i.expectedVersion);
    requireCondition(!old||old.code===i.code,"IMMUTABLE_CODE","รหัสเส้นทางเดิมไม่สามารถเปลี่ยนได้");
    requireCondition(!(await tx.route.findFirst({where:{code:i.code,id:{not:i.id}}})),"DUPLICATE_MASTER","รหัสเส้นทางนี้มีอยู่แล้ว");
    for(const id of i.branchIds){const b=await tx.branch.findUnique({where:{id}});requireCondition(b&&!b.archived&&b.activeFrom<=from&&(!b.activeTo||b.activeTo>=from),"INVALID_BRANCH","จุดส่งไม่พร้อมใช้งานในวันที่เริ่มมีผล");}
    const route=old?await tx.route.update({where:{id:i.id},data:{active:i.active,version:{increment:1}}}):await tx.route.create({data:{id:i.id,code:i.code,active:i.active}});
    const max=await tx.routeRevision.aggregate({where:{routeId:route.id},_max:{number:true}});
    const revision=await tx.routeRevision.create({data:{routeId:route.id,number:(max._max.number??0)+1,name:i.name,effectiveFrom:from,effectiveTo:to,createdById:actorId}});
    for(const [n,branchId]of i.branchIds.entries())await tx.routeStop.create({data:{routeRevisionId:revision.id,branchId,sequence:n+1}});
    const result={id:route.id,revisionId:revision.id,version:route.version};await tx.auditLog.create({data:{actorId,action:"ROUTE_REVISED",entityType:"Route",entityId:route.id,idempotencyId:idem,reason:i.reason,before:{version:old?.version??0},after:{...result,name:i.name,branchIds:i.branchIds,active:i.active}}});return result;
  });
}
export async function saveTemplate(db:PrismaClient,actorId:string,key:string,i:TemplateInput){
  const {from,to}=identity(i);
  requireCondition(typeof i.routeRevisionId==="string"&&(i.vehicleId===null||typeof i.vehicleId==="string")&&(i.driverId===null||typeof i.driverId==="string"),"INVALID_INPUT","รหัสเส้นทาง รถ หรือพนักงานขับรถไม่ถูกต้อง");
  requireCondition(["BRANCH_DELIVERY","INBOUND_DC","VAN_SALES"].includes(i.kind)&&[1,2,3].includes(i.roundNo)&&Array.isArray(i.weekdays)&&i.weekdays.length>0&&i.weekdays.every(d=>Number.isInteger(d)&&d>=1&&d<=7)&&new Set(i.weekdays).size===i.weekdays.length,"INVALID_INPUT","ประเภทเที่ยว รอบ หรือวันประจำสัปดาห์ไม่ถูกต้อง");
  requireCondition([i.loadingMinute,i.departureMinute,i.arrivalMinute].every(n=>n===null||(Number.isInteger(n)&&n>=0&&n<=1439))&&[i.occupancyStartMinute,i.occupancyEndMinute].every(n=>n===null||(Number.isInteger(n)&&n>=0&&n<=4319))&&Number.isInteger(i.arrivalDayOffset)&&i.arrivalDayOffset>=0&&i.arrivalDayOffset<=2&&Number.isInteger(i.bufferMinutes)&&i.bufferMinutes>=0&&i.bufferMinutes<=1440,"INVALID_TIME","เวลาของแม่แบบไม่ถูกต้อง");
  requireCondition((i.loadingMinute===null||i.departureMinute===null||i.loadingMinute<=i.departureMinute)&&(i.departureMinute===null||i.arrivalMinute===null||i.departureMinute<=i.arrivalMinute+i.arrivalDayOffset*1440)&&(i.occupancyStartMinute===null||i.occupancyEndMinute===null||i.occupancyStartMinute<i.occupancyEndMinute),"INVALID_TIME_ORDER","ลำดับเวลาของแม่แบบไม่ถูกต้อง");
  requireCondition((i.notes===null||(typeof i.notes==="string"&&i.notes.length<=2000))&&Array.isArray(i.categories)&&i.categories.length<=100&&i.categories.every(c=>c&&typeof c.routeStopId==="string"&&Array.isArray(c.categoryIds)&&c.categoryIds.length<=100&&c.categoryIds.every(id=>typeof id==="string")&&new Set(c.categoryIds).size===c.categoryIds.length)&&new Set(i.categories.map(c=>c.routeStopId)).size===i.categories.length,"INVALID_INPUT","ข้อมูลหมวดสินค้าหรือหมายเหตุไม่ถูกต้อง");
  return guardedWrite(db,actorId,"template.save",key,i,async(tx,idem)=>{
    await authorize(tx,actorId,"template.write");const prior=await replay<{id:string;revisionId:string;version:number}>(tx,idem);if(prior)return prior;
    await lockEligibility(tx);const old=await tx.scheduleTemplate.findUnique({where:{id:i.id}});versionMatches(old?.version??0,i.expectedVersion);
    requireCondition(!old||old.code===i.code,"IMMUTABLE_CODE","รหัสแม่แบบเดิมไม่สามารถเปลี่ยนได้");
    requireCondition(!(await tx.scheduleTemplate.findFirst({where:{code:i.code,id:{not:i.id}}})),"DUPLICATE_MASTER","รหัสแม่แบบนี้มีอยู่แล้ว");
    const route=await tx.routeRevision.findUnique({where:{id:i.routeRevisionId},include:{route:true,routeStop_routeRevisionId:true}});
    requireCondition(route?.route.active&&route.effectiveFrom<=from&&(!route.effectiveTo||route.effectiveTo>=from)&&(!route.effectiveTo||(to&&to<=route.effectiveTo)),"INVALID_ROUTE","เส้นทางไม่พร้อมใช้ตลอดช่วงวันที่ของแม่แบบ");
    if(i.vehicleId){const v=await tx.vehicle.findUnique({where:{id:i.vehicleId},include:{type:true,storageCondition:true}});requireCondition(v?.active&&v.type.active&&v.storageCondition.active,"INACTIVE_REFERENCE","รถไม่พร้อมใช้งาน");}
    if(i.driverId)requireCondition((await tx.driver.findUnique({where:{id:i.driverId}}))?.active,"INVALID_DRIVER","พนักงานขับรถไม่พร้อมใช้งาน");
    for(const c of i.categories){requireCondition(route.routeStop_routeRevisionId.some(s=>s.id===c.routeStopId),"INVALID_STOPS","จุดส่งไม่ตรงกับเส้นทาง");requireCondition(await tx.productCategory.count({where:{id:{in:c.categoryIds},active:true}})===c.categoryIds.length,"INVALID_CATEGORY","หมวดสินค้าไม่พร้อมใช้งาน");}
    const t=old?await tx.scheduleTemplate.update({where:{id:i.id},data:{active:i.active,version:{increment:1}}}):await tx.scheduleTemplate.create({data:{id:i.id,code:i.code,active:i.active}});
    const max=await tx.templateRevision.aggregate({where:{templateId:t.id},_max:{number:true}});
    const revision=await tx.templateRevision.create({data:{templateId:t.id,number:(max._max.number??0)+1,routeRevisionId:i.routeRevisionId,effectiveFrom:from,effectiveTo:to,kind:i.kind,roundNo:i.roundNo,vehicleId:i.vehicleId,driverId:i.driverId,loadingMinute:i.loadingMinute,departureMinute:i.departureMinute,arrivalMinute:i.arrivalMinute,arrivalDayOffset:i.arrivalDayOffset,occupancyStartMinute:i.occupancyStartMinute,occupancyEndMinute:i.occupancyEndMinute,bufferMinutes:i.bufferMinutes,notes:i.notes,createdById:actorId}});
    for(const weekday of i.weekdays)await tx.templateWeekday.create({data:{templateRevisionId:revision.id,weekday}});
    for(const c of i.categories)for(const categoryId of c.categoryIds)await tx.templateStopCategory.create({data:{templateRevisionId:revision.id,routeStopId:c.routeStopId,categoryId}});
    const result={id:t.id,revisionId:revision.id,version:t.version};await tx.auditLog.create({data:{actorId,action:"TEMPLATE_REVISED",entityType:"ScheduleTemplate",entityId:t.id,idempotencyId:idem,reason:i.reason,before:{version:old?.version??0},after:{...result,active:i.active}}});return result;
  });
}
export async function draftTrips(tx:Transaction,revisionId:string):Promise<DraftTrip[]>{
  const trips=await tx.tripRevision.findMany({where:{planRevisionId:revisionId},include:{trip:true,tripStop_tripRevisionId:{orderBy:{sequence:"asc"},include:{tripStopCategory_stopId:true}}},orderBy:{trip:{code:"asc"}}});
  return trips.map(t=>({tripId:t.tripId,code:t.trip.code,kind:t.kind,roundNo:t.roundNo,cancelled:t.cancelled,vehicleId:t.vehicleId,driverId:t.driverId,templateRevisionId:t.templateRevisionId,routeRevisionId:t.routeRevisionId,loadingAt:t.loadingAt?.toISOString()??null,departureAt:t.departureAt?.toISOString()??null,arrivalAt:t.arrivalAt?.toISOString()??null,occupancyStart:t.occupancyStart?.toISOString()??null,occupancyEnd:t.occupancyEnd?.toISOString()??null,bufferMinutes:t.bufferMinutes,notes:t.notes,plannedLoad:t.plannedLoad?.toString()??null,loadUnit:t.loadUnit,stops:t.tripStop_tripRevisionId.map(s=>({branchId:s.branchId,nameSnapshot:s.nameSnapshot,categoryIds:s.tripStopCategory_stopId.map(c=>c.categoryId)}))}));
}
export async function generateTrips(db:PrismaClient,actorId:string,key:string,i:{serviceDate:string;expectedVersion:number;reason:string}){
  const date=serviceDate(i.serviceDate);requireCondition(Number.isInteger(i.expectedVersion)&&typeof i.reason==="string"&&i.reason.trim().length>=3&&i.reason.length<=500,"INVALID_INPUT","กรุณาระบุรุ่นแผนและเหตุผล");
  return guardedWrite(db,actorId,"plan.generate",key,i,async(tx,idem)=>{
    await authorize(tx,actorId,"plan.write");const prior=await replay<{planId:string;revisionId:string;version:number;generated:number}>(tx,idem);if(prior)return prior;
    await lockEligibility(tx);const plan=await tx.dailyPlan.findUnique({where:{serviceDate:date}});versionMatches(plan?.version??0,i.expectedVersion);
    const latest=plan?await tx.planRevision.findFirst({where:{planId:plan.id},orderBy:{number:"desc"}}):null;
    const trips=latest?await draftTrips(tx,latest.id):[];let generated=0;
    const templates=await tx.scheduleTemplate.findMany({where:{active:true},orderBy:{id:"asc"}});
    for(const template of templates){
      const r=await tx.templateRevision.findFirst({where:{templateId:template.id,effectiveFrom:{lte:date},OR:[{effectiveTo:null},{effectiveTo:{gte:date}}]},orderBy:{number:"desc"},include:{templateWeekday_templateRevisionId:true,templateStopCategory_templateRevisionId:true,routeRevision:{include:{route:true,routeStop_routeRevisionId:{orderBy:{sequence:"asc"}}}}}});
      if(!r||!r.templateWeekday_templateRevisionId.some(w=>w.weekday===(date.getUTCDay()||7)))continue;
      const tripId=createHash("sha256").update(`${template.id}:${i.serviceDate}`).digest("hex").slice(0,36);
      if(await tx.trip.findUnique({where:{id:tripId}}))continue;
      requireCondition(r.routeRevision.route.active&&r.routeRevision.effectiveFrom<=date&&(!r.routeRevision.effectiveTo||r.routeRevision.effectiveTo>=date),"INVALID_ROUTE","เส้นทางของแม่แบบไม่พร้อมใช้ในวันบริการ");
      const at=(m:number|null)=>m===null?null:new Date(bangkokInstant(i.serviceDate,0).valueOf()+m*60_000).toISOString();
      trips.push({tripId,code:`GEN-${tripId}`,kind:r.kind,roundNo:r.kind==="BRANCH_DELIVERY"?r.roundNo:null,cancelled:false,vehicleId:r.vehicleId,driverId:r.driverId,routeRevisionId:r.routeRevisionId,templateRevisionId:r.id,loadingAt:at(r.loadingMinute),departureAt:at(r.departureMinute),arrivalAt:at(r.arrivalMinute===null?null:r.arrivalMinute+r.arrivalDayOffset*1440),occupancyStart:at(r.occupancyStartMinute),occupancyEnd:at(r.occupancyEndMinute),bufferMinutes:r.bufferMinutes,notes:r.notes,stops:r.routeRevision.routeStop_routeRevisionId.map(s=>({branchId:s.branchId,categoryIds:r.templateStopCategory_templateRevisionId.filter(c=>c.routeStopId===s.id).map(c=>c.categoryId)}))});generated++;
    }
    if(!generated&&plan&&latest)return {planId:plan.id,revisionId:latest.id,version:plan.version,generated:0};
    const result=await saveDraftTransaction(tx,actorId,idem,{serviceDate:i.serviceDate,expectedVersion:i.expectedVersion,trips,reason:i.reason});return {...result,generated};
  });
}
