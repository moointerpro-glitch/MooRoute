import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { checkDatabaseReadiness } from "../../src/server/services/database-readiness";
import { DomainError } from "../../src/server/domain/errors";
import { bangkokInstant, matchesStop, missingCoverage } from "../../src/server/domain/planning";
import { candidateCoverage, changeBranchEligibility, publishPlan, saveDraft } from "../../src/server/services/plans";
import { receiveConsignment, type ReceiptInput } from "../../src/server/services/receipts";
import { findPublishedTripIds } from "../../src/server/services/stop-match";
import { guardedWrite, replay } from "../../src/server/services/transaction";
import { completeDraft, invalidFixtures, receiptFixture, seedSynthetic, synthetic } from "../fixtures/synthetic";

const db = createDatabase(testDatabaseConfiguration(process.env));
const other = createDatabase(testDatabaseConfiguration(process.env));
const actor = synthetic.actorId;
const errorCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;
before(async () => { await checkDatabaseReadiness(db); await seedSynthetic(db); });
after(async () => { await Promise.all([db.$disconnect(), other.$disconnect()]); });

test("T01: clean MySQL migration, repeatable synthetic seed, 18 cells and published reservations", async () => {
  const beforeCounts = [await db.trip.count(), await db.planRevision.count(), await db.vehicleReservation.count(), await db.auditLog.count()];
  await seedSynthetic(db);
  assert.deepEqual([await db.trip.count(), await db.planRevision.count(), await db.vehicleReservation.count(), await db.auditLog.count()], beforeCounts);
  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(synthetic.serviceDate) } });
  const coverage = await db.$transaction((tx) => candidateCoverage(tx, plan.publishedRevisionId!));
  assert.equal(coverage.branches.length * 6, 18); assert.equal(coverage.missing.length, 0);
  assert.equal(await db.planBranch.count(), 3); assert.equal(await db.vehicleReservation.count({ where: { active: true } }), 3);
  const tables = await db.$queryRaw<Array<{ ENGINE: string; TABLE_COLLATION: string }>>`SELECT ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME <> '_prisma_migrations'`;
  assert.ok(tables.length >= 40); assert.ok(tables.every(t => t.ENGINE === "InnoDB" && t.TABLE_COLLATION.startsWith("utf8mb4")));
});

test("T02/T03: missing cell, wrong same-stop category, inbound and cancelled trips cannot publish", async () => {
  const fixtures = [invalidFixtures.missingCoverage("2026-10-07"), invalidFixtures.wrongStopCategories("2026-10-08")];
  const inbound = completeDraft("2026-10-09", "inbound"); inbound.trips[0].kind = "INBOUND_DC"; fixtures.push(inbound);
  const cancelled = completeDraft("2026-10-10", "cancelled"); cancelled.trips[0].cancelled = true; fixtures.push(cancelled);
  for (const [index,input] of fixtures.entries()) {
    const draft = await saveDraft(db, actor, `invalid-draft-${index}`, input);
    await assert.rejects(publishPlan(db, actor, `invalid-publish-${index}`, { revisionId: draft.revisionId, expectedVersion: draft.version }), (error: unknown) => {
      assert.ok(errorCode("COVERAGE_MISSING")(error));
      if(index === 0) assert.deepEqual((error as DomainError).details, [{ branchId: synthetic.branchIds[2], roundNo: 3, categoryCode: "CHICKEN" }]);
      return true;
    });
    assert.equal((await db.dailyPlan.findUniqueOrThrow({ where: { id: draft.planId } })).publishedRevisionId, null);
    assert.equal(await db.vehicleReservation.count({ where: { tripRevision: { planRevisionId: draft.revisionId } } }), 0);
  }
  await assert.rejects(saveDraft(db,actor,"inactive-rejected",invalidFixtures.inactiveBranch("2026-10-11")),errorCode("INVALID_BRANCH"));
  const draft=await saveDraft(db,actor,"inactive-draft",completeDraft("2026-10-11","inactive-valid"));
  await publishPlan(db,actor,"inactive-publish",{revisionId:draft.revisionId,expectedVersion:draft.version});
  assert.equal(await db.planBranch.count({where:{planRevisionId:draft.revisionId}}),3);
});

test("T04 subset: same stop predicate cannot combine pork at A with chicken at B; authorized published date only", async () => {
  assert.equal(matchesStop([{branchId:"A",categoryCodes:["PORK"]},{branchId:"B",categoryCodes:["CHICKEN"]}],"A",["CHICKEN"]),false);
  assert.equal(missingCoverage(["A"],[{kind:"BRANCH_DELIVERY",roundNo:1,cancelled:false,stops:[{branchId:"B",categoryCodes:["PORK","CHICKEN"]}]}]).length,6);
  assert.equal((await findPublishedTripIds(db,actor,{serviceDate:synthetic.serviceDate,branchId:synthetic.branchIds[0],categoryCode:"CHICKEN"})).length,3);
  assert.equal((await findPublishedTripIds(db,actor,{serviceDate:"2026-10-08",branchId:synthetic.branchIds[0],categoryCode:"CHICKEN"})).length,0);
});

test("T06: unknown departure stays null and blocks publish; Thai/emoji, decimal and Bangkok date roundtrip", async () => {
  const draft=await saveDraft(db,actor,"unknown-draft",invalidFixtures.unknownDeparture("2026-10-12"));
  const trip=await db.tripRevision.findFirstOrThrow({where:{planRevisionId:draft.revisionId,roundNo:1}});
  assert.equal(trip.departureAt,null); assert.ok(trip.loadingAt);
  await assert.rejects(publishPlan(db,actor,"unknown-publish",{revisionId:draft.revisionId,expectedVersion:draft.version}),errorCode("UNKNOWN_OCCUPANCY"));
  assert.equal(bangkokInstant("2026-10-06",0).toISOString(),"2026-10-05T17:00:00.000Z");
  assert.equal(bangkokInstant("2026-10-06",1439).toISOString(),"2026-10-06T16:59:00.000Z");
  const branch=await db.branch.findUniqueOrThrow({where:{id:synthetic.branchIds[0]}}); assert.equal(branch.name,"สาขาสังเคราะห์ 1 📦");
  const f=await receiptFixture(db,"decimal");
  const updated=await db.consignmentPackage.update({where:{id:f.packages[0].id},data:{custody:"VEHICLE"}}); assert.equal(updated.total,3);
  const values=await db.$queryRaw<Array<{quantity:string;day:string}>>`SELECT CAST(CAST('30.125' AS DECIMAL(14,3)) AS CHAR) AS quantity, DATE_FORMAT(serviceDate,'%Y-%m-%d') AS day FROM DailyPlan WHERE id=${draft.planId}`;
  assert.deepEqual(values[0],{quantity:"30.125",day:"2026-10-12"});
});

test("T07: concurrent publications across separate days cannot reserve the same vehicle intervals", async () => {
  const a=completeDraft("2026-10-13","race-a"), b=completeDraft("2026-10-14","race-b");
  for(const trip of a.trips) trip.occupancyEnd=bangkokInstant("2026-10-14",1200).toISOString();
  const da=await saveDraft(db,actor,"race-draft-a",a), dbb=await saveDraft(db,actor,"race-draft-b",b);
  const results=await Promise.allSettled([
    publishPlan(db,actor,"race-publish-a",{revisionId:da.revisionId,expectedVersion:da.version}),
    publishPlan(other,actor,"race-publish-b",{revisionId:dbb.revisionId,expectedVersion:dbb.version}),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const rejected=results.find(r=>r.status==="rejected") as PromiseRejectedResult; assert.ok(errorCode("VEHICLE_OVERLAP")(rejected.reason));
  const collisions=await db.$queryRaw<Array<{id:string}>>`SELECT a.id FROM VehicleReservation a JOIN VehicleReservation b ON a.vehicleId=b.vehicleId AND a.id<b.id WHERE a.active=1 AND b.active=1 AND a.startAt<b.endAt AND b.startAt<a.endAt`;
  assert.equal(collisions.length,0);
});

test("T07/T12: half-open boundary is valid, buffer overlap rolls back and keeps published revision", async () => {
  const input=completeDraft("2026-10-15","boundary");
  input.trips[1].vehicleId=input.trips[0].vehicleId;
  input.trips[1].occupancyStart=input.trips[0].occupancyEnd;
  input.trips[1].loadingAt=input.trips[0].occupancyEnd;
  const draft=await saveDraft(db,actor,"boundary-draft",input);
  const published=await publishPlan(db,actor,"boundary-publish",{revisionId:draft.revisionId,expectedVersion:draft.version});
  input.expectedVersion=published.version; input.trips[0].bufferMinutes=1;
  const replacement=await saveDraft(db,actor,"buffer-draft",input);
  await assert.rejects(publishPlan(db,actor,"buffer-publish",{revisionId:replacement.revisionId,expectedVersion:replacement.version}),errorCode("VEHICLE_OVERLAP"));
  assert.equal((await db.dailyPlan.findUniqueOrThrow({where:{id:draft.planId}})).publishedRevisionId,draft.revisionId);
  assert.equal(await db.vehicleReservation.count({where:{active:true,tripRevision:{planRevisionId:draft.revisionId}}}),3);
  const overlap=await saveDraft(db,actor,"overlap-draft",invalidFixtures.overlappingReservations("2026-10-16"));
  await assert.rejects(publishPlan(db,actor,"overlap-publish",{revisionId:overlap.revisionId,expectedVersion:overlap.version}),errorCode("VEHICLE_OVERLAP"));
});

test("T09/T10: concurrent receipts enforce optimistic version and cumulative decimal bounds; replay is exact", async () => {
  const f=await receiptFixture(db,"receipt-race");
  const input:ReceiptInput={consignmentId:f.consignment.id,expectedVersion:1,lines:[{itemId:f.item.id,quantity:"20.125",unit:"PIECE"}]};
  const results=await Promise.allSettled([receiveConsignment(db,actor,"receipt-race-a",input),receiveConsignment(other,actor,"receipt-race-b",input)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.ok(errorCode("VERSION_CONFLICT")((results.find(r=>r.status==="rejected") as PromiseRejectedResult).reason));
  const fulfilled=results.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<{eventId:string;status:string;version:number}>;
  const key=results[0].status==="fulfilled"?"receipt-race-a":"receipt-race-b";
  assert.deepEqual(await receiveConsignment(db,actor,key,input),fulfilled.value);
  await assert.rejects(receiveConsignment(db,actor,key,{...input,lines:[{itemId:f.item.id,quantity:"1",unit:"PIECE"}]}),errorCode("IDEMPOTENCY_CONFLICT"));
  await assert.rejects(receiveConsignment(db,actor,"receipt-exceed",{...input,expectedVersion:2}),errorCode("RECEIPT_EXCEEDS_SENT"));
  assert.equal(await db.consignmentEvent.count({where:{consignmentId:f.consignment.id,kind:"RECEIPT"}}),1);
  assert.equal((await db.receiptLine.findFirstOrThrow({where:{consignmentId:f.consignment.id}})).quantity.toFixed(3),"20.125");
});

test("T09/T10 partial fixture: 30 pieces and three packages are separate; same-key concurrent retry writes once", async () => {
  const f=await receiptFixture(db,"partial");
  const input:ReceiptInput={consignmentId:f.consignment.id,expectedVersion:1,lines:[{itemId:f.item.id,quantity:"10",unit:"PIECE"},{packageId:f.packages[0].id,quantity:"1",unit:"PACKAGE"}]};
  const results=await Promise.all([receiveConsignment(db,actor,"partial-first",input),receiveConsignment(other,actor,"partial-first",input)]);
  assert.deepEqual(results[0],results[1]); assert.equal(results[0].status,"PARTIALLY_RECEIVED");
  assert.equal(await db.receiptLine.count({where:{consignmentId:f.consignment.id}}),2);
  await assert.rejects(receiveConsignment(db,actor,"wrong-unit",{...input,expectedVersion:2,lines:[{itemId:f.item.id,quantity:"1",unit:"KG"}]}),errorCode("RECEIPT_UNIT"));
  const result=await receiveConsignment(db,actor,"partial-finish",{...input,expectedVersion:2,lines:[{itemId:f.item.id,quantity:"20",unit:"PIECE"},...f.packages.slice(1).map(p=>({packageId:p.id,quantity:"1",unit:"PACKAGE"}))]});
  assert.equal(result.status,"RECEIVED"); assert.equal(result.version,3);
  const early=await receiptFixture(db,"early",false);
  await assert.rejects(receiveConsignment(db,actor,"early-receipt",{consignmentId:early.consignment.id,expectedVersion:1,lines:[{packageId:early.packages[0].id,quantity:"1",unit:"PACKAGE"}]}),errorCode("RECEIPT_STATE"));
});

test("T11: database uniqueness, FK ownership, deletion restrictions and append-only history", async () => {
  const branch=await db.branch.findUniqueOrThrow({where:{id:synthetic.branchIds[0]}});
  await assert.rejects(db.branch.create({data:{...branch,id:"duplicate-branch"}}));
  const vehicle=await db.vehicle.findUniqueOrThrow({where:{id:synthetic.vehicleIds[0]}});
  await assert.rejects(db.vehicle.create({data:{...vehicle,id:"duplicate-vehicle"}}));
  await assert.rejects(db.branch.delete({where:{id:branch.id}}));
  const receipt=await db.receiptLine.findFirstOrThrow();
  await assert.rejects(db.receiptLine.update({where:{id:receipt.id},data:{quantity:"1"}}));
  await assert.rejects(db.receiptLine.delete({where:{id:receipt.id}}));
  const wrong=await receiptFixture(db,"ownership");
  await assert.rejects(db.receiptLine.create({data:{consignmentId:wrong.consignment.id,eventId:receipt.eventId,itemId:wrong.item.id,quantity:"1",unit:"PIECE"}}));
  const trip=await db.tripRevision.findFirstOrThrow({where:{planRevision:{status:"PUBLISHED"}}});
  await assert.rejects(db.tripRevision.update({where:{id:trip.id},data:{cancelled:true}}));
  await assert.rejects(db.tripStop.create({data:{tripRevisionId:trip.id,branchId:branch.id,sequence:99,nameSnapshot:"ข้อมูลทดสอบ"}}));
  await assert.rejects(db.vehicleReservation.create({data:{vehicleId:vehicle.id,tripRevisionId:trip.id,startAt:new Date(),endAt:new Date("2000-01-01"),bufferMinutes:0}}));
});

test("T12: concurrent stale edits and publications preserve one valid revision; immutable template history", async () => {
  const input=completeDraft("2026-10-17","versions");
  const edits=await Promise.allSettled([saveDraft(db,actor,"version-a",input),saveDraft(other,actor,"version-b",input)]);
  assert.equal(edits.filter(r=>r.status==="fulfilled").length,1);
  assert.ok(errorCode("VERSION_CONFLICT")((edits.find(r=>r.status==="rejected") as PromiseRejectedResult).reason));
  const draft=(edits.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<{planId:string;revisionId:string;version:number}>).value;
  const pubs=await Promise.allSettled([publishPlan(db,actor,"version-publish-a",{revisionId:draft.revisionId,expectedVersion:draft.version}),publishPlan(other,actor,"version-publish-b",{revisionId:draft.revisionId,expectedVersion:draft.version})]);
  assert.equal(pubs.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await db.dailyPlan.findUniqueOrThrow({where:{id:draft.planId}})).publishedRevisionId,draft.revisionId);
  const template=await db.templateRevision.findUniqueOrThrow({where:{id:"synthetic-template-v1"}});
  await db.templateRevision.create({data:{...template,id:"synthetic-template-v2",number:2,departureMinute:510}});
  assert.equal((await db.templateRevision.findUniqueOrThrow({where:{id:template.id}})).departureMinute,480);
  await assert.rejects(db.templateRevision.update({where:{id:template.id},data:{departureMinute:540}}));
  await assert.rejects(changeBranchEligibility(db,actor,"eligibility-change",{branchId:synthetic.branchIds[0],expectedVersion:1,activeFrom:"2026-11-01",activeTo:null,archived:false}),errorCode("PUBLISHED_ELIGIBILITY_CHANGE"));
});

test("T08 subset: published replacement with assigned consignment is blocked atomically, snapshots and labels retained", async () => {
  const plan=await db.dailyPlan.findUniqueOrThrow({where:{serviceDate:new Date(synthetic.serviceDate)}});
  const trip=await db.tripRevision.findFirstOrThrow({where:{planRevisionId:plan.publishedRevisionId!,roundNo:1}});
  const stop=await db.tripStop.findFirstOrThrow({where:{tripRevisionId:trip.id,branchId:synthetic.branchIds[0]}});
  const f=await receiptFixture(db,"assigned");
  const snapshot=await db.addressSnapshot.create({data:{branchId:synthetic.branchIds[0],createdById:actor,payload:{schemaVersion:1,synthetic:true,name:"ที่อยู่สังเคราะห์เดิม",address:"ที่อยู่ทดสอบ"}}});
  const assignment=await db.consignmentAssignment.create({data:{consignmentId:f.consignment.id,tripId:trip.tripId,tripRevisionId:trip.id,stopId:stop.id,senderSnapshotId:snapshot.id,recipientSnapshotId:snapshot.id,transportSnapshot:{schemaVersion:1,synthetic:true,vehicleId:trip.vehicleId},reason:"ข้อมูลทดสอบ",approvedById:actor,approvedAt:new Date()}});
  await db.consignment.update({where:{id:f.consignment.id},data:{currentAssignmentId:assignment.id}});
  const label=await db.labelVersion.create({data:{assignmentId:assignment.id,number:1,lookupToken:"synthetic-opaque-token",payload:{schemaVersion:1,synthetic:true}}});
  await db.labelPackage.create({data:{labelVersionId:label.id,packageId:f.packages[0].id}});
  await db.printEvent.create({data:{labelVersionId:label.id,actorId:actor,format:"A4",copies:1}});
  const replacement=await saveDraft(db,actor,"assigned-replacement",completeDraft(synthetic.serviceDate,"synthetic",plan.version));
  await assert.rejects(publishPlan(db,actor,"assigned-republish",{revisionId:replacement.revisionId,expectedVersion:replacement.version}),errorCode("REASSIGNMENT_REQUIRED"));
  assert.equal((await db.dailyPlan.findUniqueOrThrow({where:{id:plan.id}})).publishedRevisionId,plan.publishedRevisionId);
  assert.equal((await db.consignment.findUniqueOrThrow({where:{id:f.consignment.id}})).currentAssignmentId,assignment.id);
  assert.equal(await db.labelVersion.count({where:{assignmentId:assignment.id}}),1);
  assert.deepEqual((await db.addressSnapshot.findUniqueOrThrow({where:{id:snapshot.id}})).payload,snapshot.payload);
});

test("Authorization: inactive/unprivileged users and wrong branch scopes cannot call core services or replay", async () => {
  const user=await db.user.create({data:{subject:"synthetic:unprivileged",displayName:"ผู้ทดสอบไม่มีสิทธิ์"}});
  await assert.rejects(saveDraft(db,user.id,"forbidden",completeDraft("2026-10-18","forbidden")),errorCode("FORBIDDEN"));
  await db.userRole.create({data:{userId:user.id,roleId:"synthetic-role"}});
  await db.userScope.create({data:{userId:user.id,kind:"BRANCH",branchId:synthetic.branchIds[1]}});
  const f=await receiptFixture(db,"scope");
  await assert.rejects(receiveConsignment(db,user.id,"forbidden-receipt",{consignmentId:f.consignment.id,expectedVersion:1,lines:[{itemId:f.item.id,quantity:"1",unit:"PIECE"}]}),errorCode("FORBIDDEN"));
  await assert.rejects(findPublishedTripIds(db,user.id,{serviceDate:synthetic.serviceDate,branchId:synthetic.branchIds[0],categoryCode:"PORK"}),errorCode("FORBIDDEN"));
  assert.equal(await db.idempotencyRecord.count({where:{actorId:user.id}}),0);
});

test("T10: a real InnoDB deadlock retries the entire idempotent transaction without duplicate effects", async () => {
  // Deliberately reverse lock order in this test only, to exercise the retry path.
  let arrivals=0;
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const attempts=[0,0];
  const before=await db.vehicle.findMany({where:{id:{in:synthetic.vehicleIds.slice(0,2)}},orderBy:{id:"asc"}});
  const run=(index:number,client:typeof db)=>guardedWrite(client,actor,"test.deadlock",`deadlock-${index}`,{index},async(tx,idem)=>{
    const prior=await replay<{done:boolean}>(tx,idem); if(prior)return prior;
    attempts[index]++;
    const first=synthetic.vehicleIds[index], second=synthetic.vehicleIds[1-index];
    await tx.$executeRaw`UPDATE Vehicle SET version=version+1 WHERE id=${first}`;
    if(attempts[index]===1){arrivals++;if(arrivals===2)release();await gate;}
    await tx.$executeRaw`UPDATE Vehicle SET version=version+1 WHERE id=${second}`;
    return {done:true};
  });
  await Promise.all([run(0,db),run(1,other)]);
  assert.ok(attempts.some(n=>n>1));
  const after=await db.vehicle.findMany({where:{id:{in:synthetic.vehicleIds.slice(0,2)}},orderBy:{id:"asc"}});
  assert.deepEqual(after.map(v=>v.version),before.map(v=>v.version+2));
  assert.equal(await db.idempotencyRecord.count({where:{operation:"test.deadlock"}}),2);
});
