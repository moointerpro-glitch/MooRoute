import "dotenv/config";
import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {randomBytes} from "node:crypto";
import {createDatabase} from "../../src/server/persistence/database";
import {testDatabaseConfiguration} from "../../src/server/config/environment";
import {installRoles} from "../../src/server/auth/permissions";
import {provisionAccount} from "../../src/server/auth/provision";
import {createAuth} from "../../src/server/auth/auth";
import {mutateMaster,listMasters,getMaster} from "../../src/server/services/masters";
import {DomainError} from "../../src/server/domain/errors";
import {requireConsignmentAccess,requireTripAccess} from "../../src/server/auth/resource-policy";
import {synthetic,completeDraft} from "../fixtures/synthetic";
import {saveDraft,publishPlan} from "../../src/server/services/plans";

const db=createDatabase(testDatabaseConfiguration(process.env)),other=createDatabase(testDatabaseConfiguration(process.env));
const password=randomBytes(24).toString("base64url"),secret=randomBytes(32).toString("hex");
const accounts:Record<string,string>={};
const config={baseURL:"http://127.0.0.1:3011",secret};
const auth=createAuth(db,config);
const errorCode=(code:string)=>(error:unknown)=>error instanceof DomainError&&error.code===code;
let counter=0;
const save=(kind:string,values:unknown,id?:string,version=0,actor=accounts.ADMINISTRATOR)=>mutateMaster(db,actor,kind,`master-test-${++counter}`,{action:"save",values,id,expectedVersion:version,reason:"ตรวจสอบด้วยข้อมูลสังเคราะห์"});
const basics=(code:string)=>({code,name:`ตัวอย่างสังเคราะห์ ${code}`,active:true});
before(async()=>{
  await installRoles(db);
  await db.driver.create({data:{id:"phase3-driver",code:"PHASE3",name:"พนักงานสังเคราะห์"}});
  for(const role of ["ADMINISTRATOR","REQUESTER","DISPATCHER","WAREHOUSE","DRIVER","BRANCH_RECEIVER","SUPERVISOR"]){
    const scope=role==="DRIVER"?"DRIVER":role==="BRANCH_RECEIVER"?"BRANCH":role==="WAREHOUSE"?"WAREHOUSE":role==="REQUESTER"?"DEPARTMENT":"GLOBAL";
    const scopeId=scope==="DRIVER"?"phase3-driver":scope==="BRANCH"?synthetic.branchIds[1]:scope==="WAREHOUSE"?"synthetic-warehouse":scope==="DEPARTMENT"?"synthetic-department":undefined;
    const user=await provisionAccount(db,{email:`${role.toLowerCase()}@synthetic.test`,name:`ผู้ทดสอบ ${role}`,password,role,scope,scopeId});accounts[role]=user.id;
  }
});
after(async()=>{await db.$disconnect();await other.$disconnect();});

test("T13 auth: password/session cookie, logout, invalid credentials, disabled signup and inactive account",async()=>{
  const request=(path:string,body:unknown,cookie="")=>new Request(`${config.baseURL}/api/auth${path}`,{method:"POST",headers:{"content-type":"application/json",origin:config.baseURL,"x-moointer-peer":"127.0.0.1",cookie},body:JSON.stringify(body)});
  const signIn=await auth.handler(request("/sign-in/email",{email:"administrator@synthetic.test",password}));
  assert.equal(signIn.status,200,await signIn.clone().text());
  const cookies=signIn.headers.getSetCookie();assert.ok(cookies.some(c=>/httponly/i.test(c)&&/samesite=lax/i.test(c)));
  const cookie=cookies.map(c=>c.split(";")[0]).join("; ");
  const session=await auth.api.getSession({headers:new Headers({cookie})});assert.equal(session?.user.id,accounts.ADMINISTRATOR);
  await auth.handler(request("/sign-out",{},cookie));assert.equal(await auth.api.getSession({headers:new Headers({cookie})}),null);
  assert.notEqual((await auth.handler(request("/sign-in/email",{email:"administrator@synthetic.test",password:"incorrect-password"}))).status,200);
  assert.notEqual((await auth.handler(request("/sign-up/email",{email:"stranger@synthetic.test",password,name:"ผู้ใช้ไม่ได้รับอนุญาต"}))).status,200);
  await db.user.update({where:{id:accounts.REQUESTER},data:{active:false}});
  assert.notEqual((await auth.handler(request("/sign-in/email",{email:"requester@synthetic.test",password}))).status,200);
  await db.user.update({where:{id:accounts.REQUESTER},data:{active:true}});
  const account=await db.authAccount.findFirstOrThrow({where:{userId:accounts.ADMINISTRATOR}});assert.notEqual(account.password,password);assert.ok(account.password!.length>64);
});

test("T11: all seven masters create/update, full vehicle fields, aliases, optimistic version and audit",async()=>{
  const type=await save("vehicle-types",{...basics("TYPE3"),wheelCount:"6"});
  const storage=await save("storage-conditions",basics("STORAGE3"));
  const driver=await save("drivers",{...basics("DRIVER3"),phone:"0800000000"});
  const product=await save("product-categories",{...basics("PRODUCT3"),parentId:""});
  const category=await save("consignment-categories",basics("ITEM3"));
  const vehicleValues={plateNormalized:"ทด-999",province:"จังหวัดสังเคราะห์",brand:"ยี่ห้อทดสอบ",model:"รุ่นทดสอบ",color:"แดง",typeId:type.id,wheelCount:"6",storageConditionId:storage.id,bodyDescription:"ตู้ทดสอบ",ownerName:"เจ้าของทดสอบ",capacity:"1500.125",capacityUnit:"KG",availableFrom:"2030-01-01T00:00",availableTo:"2031-01-01T00:00",active:true};
  const vehicle=await save("vehicles",vehicleValues);const found=await getMaster(db,accounts.ADMINISTRATOR,"vehicles",vehicle.id);
  assert.equal(found.plateNormalized,"ทด999");assert.equal(found.capacity,"1500.125");assert.equal(found.availableFrom,"2029-12-31T17:00:00.000Z");
  const updated=await save("vehicles",{...vehicleValues,color:"ขาว"},vehicle.id,1);assert.equal(updated.version,2);
  await assert.rejects(save("vehicles",vehicleValues,vehicle.id,1),errorCode("VERSION_CONFLICT"));
  await assert.rejects(save("vehicles",{...vehicleValues,plateNormalized:"ทด 999"}),errorCode("DUPLICATE_MASTER"));
  const values={...basics("BRANCH3"),destinationType:"BRANCH",aliases:"ชื่อเรียกทดสอบ\nชื่อสำรอง",addressLine:"ที่อยู่สังเคราะห์",subdistrict:"ตำบลทดสอบ",district:"อำเภอทดสอบ",province:"จังหวัดทดสอบ",postalCode:"50000",contactName:"ผู้รับสังเคราะห์",contactPhone:"0800000000",receivingFromMinute:"08:00",receivingToMinute:"17:00",activeFrom:"2030-01-01",activeTo:""};
  const branch=await save("branches",values);assert.equal((await getMaster(db,accounts.ADMINISTRATOR,"branches",branch.id)).receivingFromMinute,480);
  assert.equal((await listMasters(db,accounts.ADMINISTRATOR,"branches",{q:"ชื่อเรียกทดสอบ"})).total,1);
  await save("branches",{...values,aliases:"ชื่อสำรอง"},branch.id,1);assert.equal(await db.branchAlias.count({where:{branchId:branch.id,active:false}}),1);
  await assert.rejects(save("branches",values),errorCode("DUPLICATE_MASTER"));
  // Same postal-code rule as label issue: five digits, never starting with 0 (Phase 8 review R7).
  await assert.rejects(save("branches",{...values,code:"BRANCH3-ZIP",postalCode:"01000"}),errorCode("INVALID_POSTCODE"));
  for(const [kind,result,values] of [["vehicle-types",type,{...basics("TYPE3"),wheelCount:"8"}],["storage-conditions",storage,{...basics("STORAGE3"),name:"แก้ไขสภาพเก็บ"}],["drivers",driver,{...basics("DRIVER3"),phone:"0811111111"}],["product-categories",product,{...basics("PRODUCT3"),parentId:"",name:"แก้ไขหมวด"}],["consignment-categories",category,{...basics("ITEM3"),name:"แก้ไขสิ่งของ"}]] as const)await save(kind,values,result.id,1);
  const audit=await db.auditLog.findFirstOrThrow({where:{entityId:vehicle.id,action:"MASTER_SAVED"},orderBy:{createdAt:"desc"}});assert.equal(audit.actorId,accounts.ADMINISTRATOR);assert.ok(audit.before&&audit.after&&audit.reason);
});

test("T11: invalid quantities/dates, required category and inactive references denied; dependent deletion archives",async()=>{
  await assert.rejects(save("vehicle-types",{...basics("BADWHEEL"),wheelCount:"-1"}),errorCode("INVALID_QUANTITY"));
  await assert.rejects(save("vehicle-types",{...basics("BADWHEEL"),wheelCount:"3.5"}),errorCode("INVALID_WHEELS"));
  const vehicleData={plateNormalized:"INVALID3",province:"สังเคราะห์",typeId:"synthetic-type",wheelCount:"4",storageConditionId:"synthetic-chilled",active:true};
  await assert.rejects(save("vehicles",{...vehicleData,capacity:"1",capacityUnit:""}),errorCode("INVALID_UNIT"));
  await assert.rejects(save("vehicles",{...vehicleData,availableFrom:"2030-01-02T08:00",availableTo:"2030-01-01T08:00"}),errorCode("INVALID_DATE"));
  await assert.rejects(save("vehicles",{...vehicleData,availableFrom:"2030-02-30T08:00"}),errorCode("INVALID_DATE"));
  const type=await save("vehicle-types",{...basics("ARCHIVE"),wheelCount:"4"});
  const vehicle=await save("vehicles",{plateNormalized:"ARCHIVE1",province:"สังเคราะห์",typeId:type.id,wheelCount:"4",storageConditionId:"synthetic-chilled",active:false});
  const archived=await mutateMaster(db,accounts.ADMINISTRATOR,"vehicle-types","archive-type",{action:"delete",id:type.id,expectedVersion:1,reason:"เก็บประวัติสังเคราะห์"});assert.equal(archived.outcome,"archived");
  assert.equal((await getMaster(db,accounts.ADMINISTRATOR,"vehicle-types",type.id)).active,0);
  assert.equal((await getMaster(db,accounts.ADMINISTRATOR,"vehicles",vehicle.id)).typeId,type.id);
  await assert.rejects(save("vehicles",{plateNormalized:"ARCHIVE2",province:"สังเคราะห์",typeId:type.id,wheelCount:"4",storageConditionId:"synthetic-chilled",active:true}),errorCode("INACTIVE_REFERENCE"));
  await assert.rejects(save("product-categories",{...basics("PORK"),active:false,parentId:""},synthetic.categoryIds[0],1),errorCode("REQUIRED_CATEGORY"));
  const unused=await save("drivers",basics("DELETE"));assert.equal((await mutateMaster(db,accounts.ADMINISTRATOR,"drivers","delete-unused",{action:"delete",id:unused.id,expectedVersion:1,reason:"ลบข้อมูลทดสอบที่ไม่อ้างอิง"})).outcome,"deleted");
  const d=completeDraft("2027-01-01","inactive3");d.trips[0].vehicleId=vehicle.id;await assert.rejects(saveDraft(db,synthetic.actorId,"inactive3",d),errorCode("INACTIVE_REFERENCE"));
  const category=await save("product-categories",{...basics("EXTRA3"),parentId:""});
  const candidate=completeDraft("2027-01-03","inactive-publish3");candidate.trips[0].stops[0].categoryIds.push(category.id);
  const draft=await saveDraft(db,synthetic.actorId,"inactive-category-draft",candidate);
  await save("product-categories",{...basics("EXTRA3"),active:false,parentId:""},category.id,1);
  await assert.rejects(publishPlan(db,synthetic.actorId,"inactive-category-publish",{revisionId:draft.revisionId,expectedVersion:draft.version}),errorCode("INACTIVE_REFERENCE"));
});

test("T13: persisted roles and branch/driver scopes apply equally to lists/details/export/mutations",async()=>{
  for(const role of ["REQUESTER","DISPATCHER","WAREHOUSE","DRIVER","BRANCH_RECEIVER","SUPERVISOR"])await assert.rejects(save("drivers",basics(`DENIED-${role}`),undefined,0,accounts[role]),errorCode("FORBIDDEN"));
  const list=await listMasters(db,accounts.BRANCH_RECEIVER,"branches",{status:"all"});assert.deepEqual(list.rows.map(r=>r.id),[synthetic.branchIds[1]]);
  await assert.rejects(getMaster(db,accounts.BRANCH_RECEIVER,"branches",synthetic.branchIds[0]),errorCode("NOT_FOUND"));
  await assert.rejects(listMasters(db,accounts.BRANCH_RECEIVER,"branches",{export:true}),errorCode("FORBIDDEN"));
  assert.equal((await listMasters(db,accounts.DRIVER,"drivers")).rows[0].id,"phase3-driver");
  await assert.rejects(getMaster(db,accounts.DRIVER,"drivers","synthetic-driver"),errorCode("NOT_FOUND"));
  const c=await db.consignment.findFirstOrThrow({where:{destinationBranchId:synthetic.branchIds[0]}});
  for(const surface of ["detail","export","file","print"]) {
    await assert.rejects(db.$transaction(tx=>requireConsignmentAccess(tx,accounts.BRANCH_RECEIVER,c.id)),errorCode("FORBIDDEN"),surface);
    assert.equal((await db.$transaction(tx=>requireConsignmentAccess(tx,accounts.ADMINISTRATOR,c.id))).id,c.id,"the administrator sees everything (D215)");
    assert.equal((await db.$transaction(tx=>requireConsignmentAccess(tx,accounts.WAREHOUSE,c.id))).id,c.id);
  }
  const draft=completeDraft("2027-01-02","driver3");draft.trips[0].driverId="phase3-driver";
  const plan=await saveDraft(db,synthetic.actorId,"driver3",draft),trips=await db.tripRevision.findMany({where:{planRevisionId:plan.revisionId},orderBy:{roundNo:"asc"}});
  assert.equal((await db.$transaction(tx=>requireTripAccess(tx,accounts.DRIVER,trips[0].id))).id,trips[0].id);
  await assert.rejects(db.$transaction(tx=>requireTripAccess(tx,accounts.DRIVER,trips[1].id)),errorCode("FORBIDDEN"));
});

test("T11: concurrent master edits produce one audit change, stale update rejects, pagination is server bounded",async()=>{
  const result=await save("drivers",basics("RACE3"));
  const input={id:result.id,expectedVersion:1,reason:"ทดสอบแก้ไขพร้อมกัน",action:"save" as const,values:{...basics("RACE3"),name:"เปลี่ยนชื่อ"}};
  const outcomes=await Promise.allSettled([mutateMaster(db,accounts.ADMINISTRATOR,"drivers","master-race-a",input),mutateMaster(other,accounts.ADMINISTRATOR,"drivers","master-race-b",input)]);
  assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);assert.ok(errorCode("VERSION_CONFLICT")((outcomes.find(o=>o.status==="rejected") as PromiseRejectedResult).reason));
  assert.equal(await db.auditLog.count({where:{entityId:result.id}}),2);
  for(let i=0;i<22;i++)await save("drivers",basics(`PAGED${i}`));
  const first=await listMasters(db,accounts.ADMINISTRATOR,"drivers",{q:"PAGED",page:1}),second=await listMasters(db,accounts.ADMINISTRATOR,"drivers",{q:"PAGED",page:2});
  assert.equal(first.total,22);assert.equal(first.rows.length,20);assert.equal(second.rows.length,2);
});
