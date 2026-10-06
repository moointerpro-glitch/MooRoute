import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { masterDefinitions } from "../../lib/master-definitions";
import { DomainError, requireCondition, versionMatches } from "../domain/errors";
import { serviceDate } from "../domain/planning";
import { principal, requireCapability, type Principal } from "../auth/permissions";
import { guardedWrite, lockEligibility, lockVehicles, replay, type Transaction } from "./transaction";

export type MasterRow=Record<string,string|number|boolean|null> & {id:string;version:number};
const definition=(kind:string)=>{const d=Object.hasOwn(masterDefinitions,kind)?masterDefinitions[kind]:null;requireCondition(d,"NOT_FOUND","ไม่พบประเภทข้อมูล");return d;};
const identifier=(value:string)=>Prisma.raw(`\`${value.replaceAll("`","``")}\``);
function serialize(row:Record<string,unknown>):MasterRow { return JSON.parse(JSON.stringify(row,(_,v)=>typeof v==="bigint"?Number(v):v)); }
function rowScope(p:Principal,kind:string) {
  if(p.global)return Prisma.sql`1=1`;
  if(kind==="branches") {const ids=p.scopes.flatMap(s=>s.branchId?[s.branchId]:[]);return ids.length?Prisma.sql`id IN (${Prisma.join(ids)})`:Prisma.sql`1=0`;}
  if(kind==="drivers") {const ids=p.scopes.flatMap(s=>s.driverId?[s.driverId]:[]);return ids.length?Prisma.sql`id IN (${Prisma.join(ids)})`:Prisma.sql`1=0`;}
  if(kind==="warehouses") {const ids=p.scopes.flatMap(s=>s.warehouseId?[s.warehouseId]:[]);return ids.length?Prisma.sql`id IN (${Prisma.join(ids)})`:Prisma.sql`1=0`;}
  if(kind==="departments") {const ids=p.scopes.flatMap(s=>s.departmentId?[s.departmentId]:[]);return ids.length?Prisma.sql`id IN (${Prisma.join(ids)})`:Prisma.sql`1=0`;}
  if(["product-categories","storage-conditions","consignment-categories","vehicle-types"].includes(kind)&&p.scopes.length)return Prisma.sql`1=1`;
  return Prisma.sql`1=0`;
}
async function scopedRecord(tx:Transaction,p:Principal,kind:string,id:string){
  const d=definition(kind);const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT * FROM ${identifier(d.table)} WHERE id=${id} AND ${rowScope(p,kind)}`);
  requireCondition(rows.length,"NOT_FOUND","ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์เข้าถึง");return serialize(rows[0]);
}
export async function listMasters(db:PrismaClient,actorId:string,kind:string,input:{q?:string;status?:string;page?:number;export?:boolean}={}) {
  const d=definition(kind);const page=input.page??1,q=input.q?.trim()??"",status=input.status??"active";
  requireCondition(Number.isInteger(page)&&page>0&&page<=100000&&q.length<=100&&["all","active","archived"].includes(status),"INVALID_INPUT","ตัวกรองข้อมูลไม่ถูกต้อง");
  return db.$transaction(async tx=>{
    const p=await principal(tx,actorId);requireCapability(p,`master.${kind}.${input.export?"export":"read"}`);
    const search=q?Prisma.sql`(${Prisma.join(d.search.map(f=>Prisma.sql`LOCATE(${q},${identifier(f)})>0`)," OR ")}${kind==="branches"?Prisma.sql` OR id IN (SELECT branchId FROM BranchAlias WHERE active=1 AND LOCATE(${q},name)>0)`:Prisma.empty})`:Prisma.sql`1=1`;
    const active=status==="all"?Prisma.sql`1=1`:Prisma.sql`${identifier(d.active)}=${(status==="active")!==(d.active==="archived")?1:0}`;
    const where=Prisma.sql`${rowScope(p,kind)} AND ${search} AND ${active}`;
    const counts=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(*) total FROM ${identifier(d.table)} WHERE ${where}`);
    const total=Number(counts[0].total);requireCondition(!input.export||total<=1000,"EXPORT_LIMIT","ข้อมูลเกิน ๑,๐๐๐ รายการ กรุณาระบุคำค้นให้แคบลง");
    const rows=await tx.$queryRaw<Record<string,unknown>[]>(Prisma.sql`SELECT * FROM ${identifier(d.table)} WHERE ${where} ORDER BY ${identifier(d.search[0])},id LIMIT ${input.export?1000:20} OFFSET ${input.export?0:(page-1)*20}`);
    return {rows:rows.map(serialize),total,page,pageSize:20,canWrite:p.permissions.has(`master.${kind}.write`),canDelete:p.permissions.has(`master.${kind}.delete`),canExport:p.permissions.has(`master.${kind}.export`)};
  },{isolationLevel:"RepeatableRead"});
}
export async function getMaster(db:PrismaClient,actorId:string,kind:string,id:string){
  return db.$transaction(async tx=>{const p=await principal(tx,actorId);requireCapability(p,`master.${kind}.read`);const row=await scopedRecord(tx,p,kind,id);
    if(kind==="branches")row.aliases=(await tx.branchAlias.findMany({where:{branchId:id,active:true},orderBy:{name:"asc"}})).map(a=>a.name).join("\n");
    return row;
  });
}
function validate(kind:string,raw:unknown){
  const d=definition(kind);requireCondition(raw&&typeof raw==="object"&&!Array.isArray(raw),"INVALID_INPUT","ข้อมูลไม่ถูกต้อง");
  const values=raw as Record<string,unknown>;const data:Record<string,string|number|Date|boolean|null>={};
  requireCondition(Object.keys(values).every(k=>d.fields.some(f=>f.name===k)||k==="active"),"INVALID_INPUT","พบช่องข้อมูลที่ไม่รองรับ");
  for(const field of d.fields){
    const value=values[field.name];requireCondition(value==null||typeof value==="string"||typeof value==="number","INVALID_INPUT",`${field.label}ไม่ถูกต้อง`);
    const text=value==null?"":String(value).trim().normalize("NFC");
    requireCondition(!field.required||text.length>0,"REQUIRED",`กรุณาระบุ${field.label}`);
    requireCondition(text.length<=(field.max??191),"INVALID_INPUT",`${field.label}ยาวเกินกำหนด`);
    if(field.name==="aliases"){data.aliases=text;continue;}
    if(!text){data[field.name]=null;continue;}
    if(field.type==="date")data[field.name]=serviceDate(text);
    else if(field.type==="datetime-local"){
      requireCondition(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(text),"INVALID_DATE","วันและเวลาไม่ถูกต้อง");serviceDate(text.slice(0,10));
      requireCondition(Number(text.slice(11,13))<24&&Number(text.slice(14))<60,"INVALID_DATE","เวลาไม่ถูกต้อง");data[field.name]=new Date(`${text}:00+07:00`);
    }else if(field.type==="time"){
      requireCondition(/^([01]\d|2[0-3]):[0-5]\d$/.test(text),"INVALID_TIME","เวลารับสินค้าไม่ถูกต้อง");data[field.name]=Number(text.slice(0,2))*60+Number(text.slice(3));
    }else if(field.type==="number"){
      requireCondition(/^\d{1,11}(\.\d{1,3})?$/.test(text)&&Number(text)>0,"INVALID_QUANTITY",`${field.label}ต้องมากกว่าศูนย์`);
      if(field.name==="wheelCount"){requireCondition(Number.isInteger(Number(text))&&Number(text)>=2&&Number(text)<=30,"INVALID_WHEELS","จำนวนล้อต้องเป็นจำนวนเต็มระหว่าง ๒ ถึง ๓๐");data[field.name]=Number(text);}else data[field.name]=text;
    }else{if(field.options)requireCondition(field.options.some(o=>o.value===text),"INVALID_OPTION",`${field.label}ไม่ถูกต้อง`);data[field.name]=text;}
  }
  requireCondition(typeof values.active==="boolean","INVALID_INPUT","กรุณาระบุสถานะใช้งาน");data[d.active]=d.active==="archived"?!values.active:values.active;
  if(data.plateNormalized){data.plateNormalized=String(data.plateNormalized).replace(/[\s-]/g,"").toUpperCase();requireCondition(String(data.plateNormalized).length>0,"INVALID_PLATE","ทะเบียนรถไม่ถูกต้อง");}
  if(data.code)data.code=String(data.code).toUpperCase();
  for(const [start,end] of [["activeFrom","activeTo"],["availableFrom","availableTo"],["receivingFromMinute","receivingToMinute"]]) if(data[start]!=null&&data[end]!=null)requireCondition(data[end]!>=data[start]!,"INVALID_DATE","วันหรือเวลาสิ้นสุดต้องไม่ก่อนวันหรือเวลาเริ่มต้น");
  if(kind==="vehicles")requireCondition(!!data.capacity===!!data.capacityUnit,"INVALID_UNIT","กรุณาระบุความจุและหน่วยให้ครบคู่");
  if(kind==="branches")requireCondition(/^\d{5}$/.test(String(data.postalCode)),"INVALID_POSTCODE","รหัสไปรษณีย์ต้องเป็นตัวเลข ๕ หลัก");
  for(const field of ["phone","contactPhone"])if(data[field])requireCondition(/^[+\d ()-]{7,32}$/.test(String(data[field])),"INVALID_PHONE","เบอร์ติดต่อไม่ถูกต้อง");
  return data;
}
async function protectReferences(tx:Transaction,kind:string,id:string|null,before:MasterRow|null,data:Record<string,unknown>){
  if(kind==="vehicles"){
    const duplicate=await tx.$queryRaw<{id:string}[]>`SELECT id FROM Vehicle WHERE REPLACE(REPLACE(plateNormalized,'-',''),' ','')=${String(data.plateNormalized)} AND province=${String(data.province)} AND (${id} IS NULL OR id<>${id})`;
    requireCondition(!duplicate.length,"DUPLICATE_MASTER","ทะเบียนรถและจังหวัดนี้มีอยู่แล้ว กรุณาตรวจสอบรายการเดิม");
  }
  if(kind==="branches"){
    const published=await tx.dailyPlan.findMany({where:{publishedRevisionId:{not:null}}});
    const eligible=(r:Record<string,unknown>|null,date:Date)=>r&&r.destinationType==="BRANCH"&&!r.archived&&new Date(String(r.activeFrom))<=date&&(!r.activeTo||new Date(String(r.activeTo))>=date);
    requireCondition(!published.some(p=>!!eligible(before,p.serviceDate)!==!!eligible(data,p.serviceDate)),"PUBLISHED_ELIGIBILITY_CHANGE","การเปลี่ยนสถานะหรือวันที่สาขากระทบแผนที่เผยแพร่แล้ว กรุณาปรับแผนก่อน");
  }
  if(kind==="vehicles"&&id){
    await lockVehicles(tx,[id]);const reservations=await tx.vehicleReservation.findMany({where:{vehicleId:id,active:true,endAt:{gt:new Date()}}});
    requireCondition(!reservations.some(r=>!data.active||(data.availableFrom&&new Date(String(data.availableFrom))>r.startAt)||(data.availableTo&&new Date(String(data.availableTo))<r.endAt)),"VEHICLE_RESERVED","รถมีการจองใช้งาน กรุณาปรับแผนก่อนเปลี่ยนช่วงพร้อมใช้งานหรือเก็บเข้าคลัง");
  }
  if(kind==="product-categories"&&before&&["PORK","CHICKEN"].includes(String(before.code)))requireCondition(data.active&&data.code===before.code,"REQUIRED_CATEGORY","หมูและไก่เป็นหมวดที่ต้องมีในทุกแผน จึงปิดใช้งานหรือเปลี่ยนรหัสไม่ได้");
  for(const f of definition(kind).fields.filter(f=>f.lookup))if(data[f.name]){
    const lookup=definition(f.lookup!);const rows=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM ${identifier(lookup.table)} WHERE id=${String(data[f.name])} AND active=1`);
    requireCondition(rows.length,"INACTIVE_REFERENCE",`${f.label}ไม่พร้อมใช้งาน กรุณาเลือกข้อมูลที่ใช้งานอยู่`);
  }
  if(kind==="product-categories"&&data.parentId){
    let parent=String(data.parentId);const visited=new Set<string>();
    while(parent){requireCondition(parent!==id&&!visited.has(parent),"CATEGORY_CYCLE","หมวดแม่ต้องไม่อ้างอิงวนกลับมาที่หมวดนี้");visited.add(parent);const row=await tx.productCategory.findUnique({where:{id:parent}});parent=row?.parentId??"";}
  }
  if(id&&before&&data.active===false&&["drivers","vehicle-types","storage-conditions","product-categories"].includes(kind)){
    const refs=kind==="drivers"?await tx.tripRevision.count({where:{driverId:id,cancelled:false,planRevision:{status:"PUBLISHED"},occupancyEnd:{gt:new Date()}}}):
      kind==="vehicle-types"?await tx.vehicle.count({where:{typeId:id,active:true}}):kind==="storage-conditions"?await tx.vehicle.count({where:{storageConditionId:id,active:true}}):await tx.tripStopCategory.count({where:{categoryId:id,stop:{tripRevision:{cancelled:false,planRevision:{status:"PUBLISHED"},occupancyEnd:{gt:new Date()}}}}});
    requireCondition(refs===0,"ACTIVE_DEPENDENCY","ข้อมูลยังถูกใช้งานอยู่ กรุณาปรับรายการที่เกี่ยวข้องก่อนเก็บเข้าคลัง");
  }
}
async function aliases(tx:Transaction,branchId:string,text:string){
  const names=[...new Set(text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];requireCondition(names.length<=30&&names.every(n=>n.length<=191),"INVALID_ALIAS","ระบุชื่อเรียกอื่นได้ไม่เกิน ๓๐ ชื่อ ชื่อละไม่เกิน ๑๙๑ ตัวอักษร");
  const old=await tx.branchAlias.findMany({where:{branchId}});
  for(const a of old)if(a.active&&!names.includes(a.name))await tx.branchAlias.update({where:{id:a.id},data:{active:false,version:{increment:1}}});
  for(const name of names){const a=old.find(a=>a.name===name);if(!a)await tx.branchAlias.create({data:{branchId,name}});else if(!a.active)await tx.branchAlias.update({where:{id:a.id},data:{active:true,version:{increment:1}}});}
}
/** Transaction-level master mutation shared by the HTTP adapter and staged imports. Caller authorizes and handles replay. */
export async function mutateMasterTransaction(tx:Transaction,p:Principal,actorId:string,idem:string,kind:string,input:{id?:string;expectedVersion:number;reason:string;action:"save"|"delete"},parsed:Record<string,string|number|Date|boolean|null>|null){
    const d=definition(kind);
    await lockEligibility(tx);
    const before=input.id?await scopedRecord(tx,p,kind,input.id):null;
    if(before)versionMatches(Number(before.version),input.expectedVersion);else versionMatches(0,input.expectedVersion);
    const id=before?.id??randomUUID();
    if(before&&kind==="branches")before.aliases=(await tx.branchAlias.findMany({where:{branchId:id,active:true}})).map(a=>a.name).join("\n");
    let data:Record<string,unknown>=parsed?{...parsed}:{...before,[d.active]:d.active==="archived"};
    await protectReferences(tx,kind,before?.id??null,before,data);
    let outcome="saved",version=(before?.version??0)+1;
    if(input.action==="delete"){
      requireCondition(before,"NOT_FOUND","ไม่พบข้อมูล");
      try{await tx.$executeRaw(Prisma.sql`DELETE FROM ${identifier(d.table)} WHERE id=${id}`);outcome="deleted";}
      catch(error){if(!(error instanceof Prisma.PrismaClientKnownRequestError&&JSON.stringify(error.meta).includes("1451")))throw error;
        await tx.$executeRaw(Prisma.sql`UPDATE ${identifier(d.table)} SET ${identifier(d.active)}=${d.active==="archived"?1:0},version=version+1,updatedAt=UTC_TIMESTAMP(3) WHERE id=${id}`);outcome="archived";}
      data=outcome==="deleted"?{}:{...before,[d.active]:d.active==="archived",version};
    }else{
      const aliasText=String(data.aliases??"");delete data.aliases;
      const entries=Object.entries(data);
      if(before)await tx.$executeRaw(Prisma.sql`UPDATE ${identifier(d.table)} SET ${Prisma.join(entries.map(([k,v])=>Prisma.sql`${identifier(k)}=${v}`))},version=version+1,updatedAt=UTC_TIMESTAMP(3) WHERE id=${id}`);
      else{version=1;await tx.$executeRaw(Prisma.sql`INSERT INTO ${identifier(d.table)} (id,${Prisma.join(entries.map(([k])=>identifier(k)))},version,createdAt,updatedAt) VALUES (${id},${Prisma.join(entries.map(([,v])=>v))},1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`);}
      if(kind==="branches")await aliases(tx,id,aliasText);
      data={...data,id,version,...(kind==="branches"?{aliases:aliasText}:{})};
    }
    await tx.auditLog.create({data:{actorId,action:`MASTER_${outcome.toUpperCase()}`,entityType:d.table,entityId:id,idempotencyId:idem,reason:input.reason.trim(),before:before?serialize(before):Prisma.JsonNull,after:serialize(data)}});
    if(kind==="branches")await tx.eligibilityGuard.update({where:{key:"GLOBAL"},data:{version:{increment:1}}});
    return {id,version,outcome};
}
export const validateMasterValues=(kind:string,raw:unknown)=>validate(kind,raw);
export async function mutateMaster(db:PrismaClient,actorId:string,kind:string,key:string,input:{id?:string;expectedVersion:number;reason:string;action:"save"|"delete";values?:unknown}){
  definition(kind);requireCondition(input&&["save","delete"].includes(input.action)&&Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0&&typeof input.reason==="string"&&input.reason.trim().length>=3&&input.reason.length<=500,"INVALID_INPUT","กรุณาระบุเหตุผลอย่างน้อย ๓ ตัวอักษรและข้อมูลรุ่นให้ถูกต้อง");
  const parsed=input.action==="save"?validate(kind,input.values):null;
  try{return await guardedWrite(db,actorId,`master.${kind}`,key,input,async(tx,idem)=>{
    const p=await principal(tx,actorId);requireCapability(p,`master.${kind}.${input.action==="delete"?"delete":"write"}`);
    requireCondition(p.global||!!input.id,"FORBIDDEN","ต้องมีสิทธิ์ส่วนกลางในการเพิ่มข้อมูล");
    const previous=await replay<{id:string;version:number;outcome:string}>(tx,idem);if(previous)return previous;
    return mutateMasterTransaction(tx,p,actorId,idem,kind,input,parsed);
  });}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&(error.code==="P2002"||JSON.stringify(error.meta).includes("1062")))throw new DomainError("DUPLICATE_MASTER","รหัส หรือทะเบียนรถและจังหวัดนี้มีอยู่แล้ว กรุณาตรวจสอบรายการเดิม");throw error;}
}
