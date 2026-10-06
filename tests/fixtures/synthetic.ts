import type { PrismaClient } from "../../src/generated/prisma/client";
import { bangkokInstant } from "../../src/server/domain/planning";
import { saveDraft, publishPlan, type DraftInput } from "../../src/server/services/plans";
import { fingerprint } from "../../src/server/services/transaction";
import { requireCondition } from "../../src/server/domain/errors";

export const synthetic = {
  actorId: "synthetic-operator", branchIds: ["synthetic-branch-a", "synthetic-branch-b", "synthetic-branch-c"],
  inactiveBranchId: "synthetic-branch-inactive", categoryIds: ["synthetic-pork", "synthetic-chicken"],
  vehicleIds: ["synthetic-vehicle-1", "synthetic-vehicle-2", "synthetic-vehicle-3"],
  serviceDate: "2026-10-06", manifest: "synthetic-phase2-v1",
};

export async function seedMasters(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    const actor = await tx.user.upsert({ where: { id: synthetic.actorId }, create: { id: synthetic.actorId, subject: "synthetic:operator", displayName: "ผู้ทดสอบ (ข้อมูลสังเคราะห์)" }, update: {} });
    const role = await tx.role.upsert({ where: { code: "SYNTHETIC_OPERATOR" }, create: { id: "synthetic-role", code: "SYNTHETIC_OPERATOR", name: "บทบาททดสอบ (ข้อมูลสังเคราะห์)" }, update: {} });
    await tx.userRole.upsert({ where: { userId_roleId: { userId: actor.id, roleId: role.id } }, create: { userId: actor.id, roleId: role.id }, update: {} });
    for (const code of ["plan.write", "plan.publish", "master.write", "consignment.receive", "trip.read"]) {
      const permission = await tx.permission.upsert({ where: { code }, create: { code }, update: {} });
      await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
    }
    if (!await tx.userScope.findFirst({ where: { userId: actor.id, kind: "GLOBAL" } })) await tx.userScope.create({ data: { userId: actor.id, kind: "GLOBAL" } });
    await tx.department.upsert({ where: { id: "synthetic-department" }, create: { id: "synthetic-department", code: "SYNTHETIC", name: "แผนกทดสอบ (ข้อมูลสังเคราะห์)" }, update: {} });
    await tx.warehouse.upsert({ where: { id: "synthetic-warehouse" }, create: { id: "synthetic-warehouse", code: "SYNTHETIC", name: "คลังทดสอบ (ข้อมูลสังเคราะห์)", address: "ที่อยู่ทดสอบ ไม่ใช่สถานที่จริง" }, update: {} });
    for (const [index, id] of [...synthetic.branchIds, synthetic.inactiveBranchId].entries()) {
      await tx.branch.upsert({ where: { id }, create: { id, code: `SYNTHETIC-${index + 1}`, name: `สาขาสังเคราะห์ ${index + 1} 📦`, addressLine: "ที่อยู่ทดสอบ ไม่ใช่สถานที่จริง", subdistrict: "ตำบลตัวอย่าง", district: "อำเภอตัวอย่าง", province: "จังหวัดตัวอย่าง", postalCode: "00000", activeFrom: new Date("2026-01-01T00:00:00Z"), activeTo: index === 3 ? new Date("2026-01-31T00:00:00Z") : null }, update: {} });
    }
    for (const [index, code] of ["PORK", "CHICKEN"].entries()) await tx.productCategory.upsert({ where: { code }, create: { id: synthetic.categoryIds[index], code, name: index ? "ไก่" : "หมู" }, update: {} });
    await tx.consignmentCategory.upsert({ where: { id: "synthetic-item-category" }, create: { id: "synthetic-item-category", code: "SYNTHETIC", name: "สินค้าทดสอบ (ข้อมูลสังเคราะห์)" }, update: {} });
    await tx.vehicleType.upsert({ where: { id: "synthetic-type" }, create: { id: "synthetic-type", code: "SYNTHETIC", name: "รถทดสอบ (ข้อมูลสังเคราะห์)", wheelCount: 4 }, update: {} });
    await tx.storageCondition.upsert({ where: { id: "synthetic-chilled" }, create: { id: "synthetic-chilled", code: "CHILLED", name: "แช่เย็น" }, update: {} });
    for (const [index, id] of synthetic.vehicleIds.entries()) await tx.vehicle.upsert({ where: { id }, create: { id, plateNormalized: `SYNTHETIC-${index + 1}`, province: "ข้อมูลสังเคราะห์", typeId: "synthetic-type", storageConditionId: "synthetic-chilled", capacity: "1000", capacityUnit: "KG" }, update: {} });
    await tx.route.upsert({ where: { id: "synthetic-route" }, create: { id: "synthetic-route", code: "SYNTHETIC" }, update: {} });
    if (!await tx.routeRevision.findUnique({ where: { id: "synthetic-route-v1" } })) {
      await tx.routeRevision.create({ data: { id: "synthetic-route-v1", routeId: "synthetic-route", number: 1, name: "เส้นทางทดสอบ (ข้อมูลสังเคราะห์)", effectiveFrom: new Date("2026-01-01"), createdById: actor.id } });
      for (const [index, branchId] of synthetic.branchIds.entries()) await tx.routeStop.create({ data: { id: `synthetic-route-stop-${index}`, routeRevisionId: "synthetic-route-v1", branchId, sequence: index + 1 } });
    }
    await tx.scheduleTemplate.upsert({ where: { id: "synthetic-template" }, create: { id: "synthetic-template", code: "SYNTHETIC" }, update: {} });
    if (!await tx.templateRevision.findUnique({ where: { id: "synthetic-template-v1" } })) {
      await tx.templateRevision.create({ data: { id: "synthetic-template-v1", templateId: "synthetic-template", number: 1, routeRevisionId: "synthetic-route-v1", effectiveFrom: new Date("2026-01-01"), roundNo: 1, loadingMinute: 420, departureMinute: 480, arrivalMinute: 600, createdById: actor.id } });
      for (let weekday=1; weekday<=7; weekday++) await tx.templateWeekday.create({ data: { templateRevisionId: "synthetic-template-v1", weekday } });
      for (let i=0; i<3; i++) for (const categoryId of synthetic.categoryIds) await tx.templateStopCategory.create({ data: { templateRevisionId: "synthetic-template-v1", routeStopId: `synthetic-route-stop-${i}`, categoryId } });
    }
  }, { timeout: 20_000 });
}

export function completeDraft(date: string, prefix: string, expectedVersion=0): DraftInput {
  return { serviceDate: date, expectedVersion, trips: [1, 2, 3].map((round, i) => ({
    tripId: `${prefix}-trip-${round}`, code: `${prefix}-trip-${round}`, kind: "BRANCH_DELIVERY", roundNo: round, cancelled: false,
    vehicleId: synthetic.vehicleIds[i], routeRevisionId: "synthetic-route-v1", templateRevisionId: i === 0 ? "synthetic-template-v1" : null,
    loadingAt: bangkokInstant(date, 420 + i * 240).toISOString(), departureAt: bangkokInstant(date, 480 + i * 240).toISOString(),
    arrivalAt: bangkokInstant(date, 600 + i * 240).toISOString(), occupancyStart: bangkokInstant(date, 420 + i * 240).toISOString(), occupancyEnd: bangkokInstant(date, 600 + i * 240).toISOString(), bufferMinutes: 0,
    stops: synthetic.branchIds.map((branchId) => ({ branchId, categoryIds: [...synthetic.categoryIds] })),
  })) };
}
export const invalidFixtures = {
  missingCoverage: (date: string) => { const d=completeDraft(date,"missing"); d.trips[2].stops[2].categoryIds=[synthetic.categoryIds[0]]; return d; },
  inactiveBranch: (date: string) => { const d=completeDraft(date,"inactive"); d.trips[0].stops.push({branchId:synthetic.inactiveBranchId,categoryIds:[]}); return d; },
  unknownDeparture: (date: string) => { const d=completeDraft(date,"unknown"); d.trips[0].departureAt=null; return d; },
  wrongStopCategories: (date: string) => { const d=completeDraft(date,"wrong"); d.trips[0].stops[0].categoryIds=[synthetic.categoryIds[0]]; d.trips[0].stops[1].categoryIds=[synthetic.categoryIds[1]]; return d; },
  overlappingReservations: (date: string) => { const d=completeDraft(date,"overlap"); d.trips[1].vehicleId=d.trips[0].vehicleId; d.trips[1].occupancyStart=d.trips[0].occupancyStart; d.trips[1].occupancyEnd=d.trips[1].arrivalAt; return d; },
};

/** Test-only custody bootstrap; application endpoints must use the later lifecycle services. */
export async function receiptFixture(db: PrismaClient, prefix: string, departed=true) {
  return db.$transaction(async tx => {
    const consignment=await tx.consignment.create({data:{id:`${prefix}-consignment`,code:`SYNTHETIC-${prefix}`,requesterId:synthetic.actorId,departmentId:"synthetic-department",sourceWarehouseId:"synthetic-warehouse",destinationBranchId:synthetic.branchIds[0],receiptMode:"DETAILED"}});
    const item=await tx.consignmentItem.create({data:{id:`${prefix}-item`,consignmentId:consignment.id,categoryId:"synthetic-item-category",name:"สินค้าสังเคราะห์ ๓๐ ชิ้น",sentQuantity:"30",unit:"PIECE"}});
    const packages=[];
    for(let sequence=1;sequence<=3;sequence++) packages.push(await tx.consignmentPackage.create({data:{id:`${prefix}-package-${sequence}`,consignmentId:consignment.id,sequence,total:3,custody:"VEHICLE"}}));
    await tx.consignment.update({where:{id:consignment.id},data:{status:departed?"IN_TRANSIT":"LOADED"}});
    if(departed) await tx.consignmentEvent.create({data:{consignmentId:consignment.id,actorId:synthetic.actorId,kind:"DEPARTED",occurredAt:new Date(),payload:{schemaVersion:1,synthetic:true}}});
    return {consignment,item,packages};
  });
}

export async function seedSynthetic(db: PrismaClient) {
  const input=completeDraft(synthetic.serviceDate,"synthetic");
  const checksum=fingerprint(input);
  const manifest=await db.seedManifest.findUnique({where:{key:synthetic.manifest}});
  if(manifest){
    requireCondition(manifest.checksum===checksum,"SEED_VERSION_CONFLICT","ข้อมูลสังเคราะห์มีรุ่นไม่ตรงกัน");
    const plan=await db.dailyPlan.findUnique({where:{serviceDate:new Date(synthetic.serviceDate)}});
    requireCondition(plan?.publishedRevisionId,"SEED_INCOMPLETE","ข้อมูลสังเคราะห์ไม่ครบถ้วน");
    return manifest.payload;
  }
  await seedMasters(db);
  const draft=await saveDraft(db,synthetic.actorId,"synthetic-draft-v1",input);
  const published=await publishPlan(db,synthetic.actorId,"synthetic-publish-v1",{revisionId:draft.revisionId,expectedVersion:draft.version});
  const payload={synthetic:true,serviceDate:synthetic.serviceDate,revisionId:published.revisionId,branches:3,cells:18};
  await db.seedManifest.create({data:{key:synthetic.manifest,version:1,checksum,payload}});
  return payload;
}
