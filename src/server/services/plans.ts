import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type TripKind } from "../../generated/prisma/client";
import { DomainError, requireCondition, versionMatches } from "../domain/errors";
import { reassignForPublication, type Reassignment } from "./planning-reassignment";
import { missingCoverage, serviceDate } from "../domain/planning";
import { audit, authorize, guardedWrite, lockEligibility, lockPlan, lockVehicles, replay, type Transaction } from "./transaction";

export interface DraftTrip {
  notes?: string | null; plannedLoad?: string | null; loadUnit?: string | null;
  tripId: string; code: string; kind: TripKind; roundNo: number | null; cancelled: boolean;
  vehicleId: string | null; driverId?: string | null;
  templateRevisionId?: string | null; routeRevisionId?: string | null;
  loadingAt: string | null; departureAt: string | null; arrivalAt: string | null;
  occupancyStart: string | null; occupancyEnd: string | null; bufferMinutes: number;
  stops: { branchId: string; categoryIds: string[]; nameSnapshot?:string }[];
}
export interface DraftInput { serviceDate: string; expectedVersion: number; trips: DraftTrip[]; reason?: string }
type DraftResult = { planId: string; revisionId: string; version: number };
function instant(value: string | null) {
  if (value === null) return null;
  requireCondition(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
    "INVALID_TIME", "วันและเวลาไม่ถูกต้อง");
  return new Date(value);
}
function validateDraft(input: DraftInput) {
  requireCondition(input && typeof input === "object", "INVALID_INPUT", "ข้อมูลแผนไม่ถูกต้อง");
  serviceDate(input.serviceDate);
  requireCondition(Number.isInteger(input.expectedVersion) && input.expectedVersion >= 0 && Array.isArray(input.trips) && input.trips.length <= 500, "INVALID_INPUT", "ข้อมูลแผนไม่ถูกต้อง");
  const ids = new Set<string>();
  for (const trip of input.trips) {
    requireCondition(trip && typeof trip === "object" && (trip.vehicleId===null||typeof trip.vehicleId==="string") && (trip.driverId==null||typeof trip.driverId==="string") && (trip.routeRevisionId==null||typeof trip.routeRevisionId==="string") && (trip.templateRevisionId==null||typeof trip.templateRevisionId==="string"),"INVALID_TRIP","ข้อมูลเที่ยวรถไม่ถูกต้อง");
    requireCondition(typeof trip.tripId === "string" && /^[A-Za-z0-9_-]{1,36}$/.test(trip.tripId) && !ids.has(trip.tripId), "INVALID_TRIP", "รหัสเที่ยวรถซ้ำหรือไม่ถูกต้อง");
    ids.add(trip.tripId);
    requireCondition(trip.notes == null || (typeof trip.notes === "string" && trip.notes.length <= 2000), "INVALID_INPUT", "หมายเหตุยาวเกินกำหนด");
    requireCondition((trip.plannedLoad == null && trip.loadUnit == null) || (typeof trip.plannedLoad === "string" && /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/.test(trip.plannedLoad) && Number(trip.plannedLoad)>0 && typeof trip.loadUnit === "string" && /^[A-Z_]{1,32}$/.test(trip.loadUnit)), "INVALID_LOAD", "ปริมาณบรรทุกและหน่วยไม่ถูกต้อง");
    requireCondition(typeof trip.code === "string" && trip.code.length > 0 && trip.code.length <= 64 && typeof trip.cancelled === "boolean" && ["BRANCH_DELIVERY", "INBOUND_DC", "VAN_SALES", "OTHER"].includes(trip.kind), "INVALID_TRIP", "ข้อมูลเที่ยวรถไม่ถูกต้อง");
    requireCondition((trip.roundNo === null && trip.kind !== "BRANCH_DELIVERY") || [1, 2, 3].includes(trip.roundNo!), "INVALID_ROUND", "รอบขนส่งต้องเป็นรอบที่ ๑ ถึง ๓");
    requireCondition(Number.isInteger(trip.bufferMinutes) && trip.bufferMinutes >= 0 && trip.bufferMinutes <= 1440, "INVALID_BUFFER", "เวลาเผื่อรถไม่ถูกต้อง");
    const [loading, departure, arrival, start, end] = [trip.loadingAt, trip.departureAt, trip.arrivalAt, trip.occupancyStart, trip.occupancyEnd].map(instant);
    requireCondition((!loading || !departure || loading <= departure) && (!departure || !arrival || departure <= arrival) && (!start || !end || start < end), "INVALID_TIME_ORDER", "ลำดับเวลาไม่ถูกต้อง");
    requireCondition(Array.isArray(trip.stops) && trip.stops.length <= 500, "INVALID_STOPS", "ข้อมูลจุดส่งไม่ถูกต้อง");
    for (const stop of trip.stops) requireCondition(stop && typeof stop.branchId === "string" && Array.isArray(stop.categoryIds) && stop.categoryIds.every(id=>typeof id==="string") && stop.categoryIds.length <= 100 && new Set(stop.categoryIds).size === stop.categoryIds.length, "INVALID_STOPS", "ข้อมูลหมวดสินค้าประจำจุดส่งไม่ถูกต้อง");
  }
}

export async function saveDraft(db: PrismaClient, actorId: string, key: string, input: DraftInput): Promise<DraftResult> {
  validateDraft(input);
  return guardedWrite(db, actorId, "plan.draft", key, input, async (tx, idempotencyId) => {
    await authorize(tx, actorId, "plan.write");
    const prior = await replay<DraftResult>(tx, idempotencyId); if (prior) return prior;
    return saveDraftTransaction(tx, actorId, idempotencyId, input);
  });
}

export async function saveDraftTransaction(tx: Transaction, actorId: string, idempotencyId: string, input: DraftInput): Promise<DraftResult> {
    validateDraft(input);
    await lockEligibility(tx);
    const date = serviceDate(input.serviceDate);
    let plan = await tx.dailyPlan.findUnique({ where: { serviceDate: date } });
    if (!plan) { versionMatches(0, input.expectedVersion); plan = await tx.dailyPlan.create({ data: { id: randomUUID(), serviceDate: date, version: 0 } }); }
    plan = await lockPlan(tx, plan.id);
    versionMatches(plan.version, input.expectedVersion);
    const omitted = await tx.trip.findMany({where:{planId:plan.id,id:{notIn:input.trips.map(t=>t.tripId)},OR:[{tripRevision_tripId:{some:{planRevision:{status:{in:["PUBLISHED","SUPERSEDED"]}}}}},{consignmentAssignment_tripId:{some:{}}}]}});
    requireCondition(!omitted.length,"TRIP_DELETE_FORBIDDEN","เที่ยวที่เคยเผยแพร่หรือมีพัสดุต้องเก็บไว้และใช้การยกเลิกแทนการลบ");
    const previous = await tx.planRevision.findFirst({where:{planId:plan.id},orderBy:{number:"desc"}});
    const max = await tx.planRevision.aggregate({ where: { planId: plan.id }, _max: { number: true } });
    const revision = await tx.planRevision.create({ data: { planId: plan.id, number: (max._max.number ?? 0) + 1, createdById: actorId } });
    for (const data of input.trips) {
      const existing = await tx.trip.findUnique({ where: { id: data.tripId } });
      const validateActive=!data.cancelled||!existing;
      if(data.vehicleId&&validateActive){const vehicle=await tx.vehicle.findUnique({where:{id:data.vehicleId},include:{type:true,storageCondition:true}});requireCondition(vehicle?.active&&vehicle.type.active&&vehicle.storageCondition.active,"INACTIVE_REFERENCE","รถหรือข้อมูลประเภทรถไม่พร้อมใช้งาน");}

      requireCondition(!existing || (existing.planId === plan.id && existing.code === data.code), "TRIP_OWNERSHIP", "เที่ยวรถนี้อยู่ในแผนอื่น");
      requireCondition(!await tx.trip.findFirst({where:{code:data.code,id:{not:data.tripId}}}),"DUPLICATE_TRIP","รหัสเที่ยวนี้มีอยู่แล้ว กรุณาใช้รหัสใหม่");
      if (!existing) await tx.trip.create({ data: { id: data.tripId, planId: plan.id, code: data.code } });
      if (data.driverId&&validateActive) requireCondition((await tx.driver.findUnique({ where: { id: data.driverId } }))?.active, "INVALID_DRIVER", "ไม่พบพนักงานขับรถที่พร้อมใช้งาน");
      if(data.routeRevisionId&&validateActive){const route=await tx.routeRevision.findUnique({where:{id:data.routeRevisionId},include:{route:true}});requireCondition(route&&route.route.active&&route.effectiveFrom<=date&&(!route.effectiveTo||route.effectiveTo>=date),"INVALID_ROUTE","เส้นทางไม่พร้อมใช้งานในวันบริการ");}
      if(data.templateRevisionId&&validateActive){const template=await tx.templateRevision.findUnique({where:{id:data.templateRevisionId},include:{template:true}});requireCondition(template&&template.template.active&&template.effectiveFrom<=date&&(!template.effectiveTo||template.effectiveTo>=date),"INVALID_TEMPLATE","แม่แบบไม่พร้อมใช้งานในวันบริการ");}
      if (data.templateRevisionId && data.routeRevisionId) {
        const template = await tx.templateRevision.findUnique({ where: { id: data.templateRevisionId } });
        requireCondition(template?.routeRevisionId === data.routeRevisionId, "INVALID_TEMPLATE", "แม่แบบไม่ตรงกับเส้นทาง");
      }
      const trip = await tx.tripRevision.create({ data: {
        notes:data.notes, plannedLoad:data.plannedLoad, loadUnit:data.loadUnit,
        tripId: data.tripId, planId: plan.id, planRevisionId: revision.id, kind: data.kind, roundNo: data.roundNo,
        cancelled: data.cancelled, vehicleId: data.vehicleId, driverId: data.driverId,
        templateRevisionId: data.templateRevisionId, routeRevisionId: data.routeRevisionId,
        loadingAt: instant(data.loadingAt), departureAt: instant(data.departureAt), arrivalAt: instant(data.arrivalAt),
        occupancyStart: instant(data.occupancyStart), occupancyEnd: instant(data.occupancyEnd), bufferMinutes: data.bufferMinutes,
      } });
      for (const [index, stop] of data.stops.entries()) {
        const branch = await tx.branch.findUnique({ where: { id: stop.branchId } });
        requireCondition(branch&&(!validateActive||(!branch.archived&&branch.activeFrom<=date&&(!branch.activeTo||branch.activeTo>=date))), "INVALID_BRANCH", "สาขาไม่พร้อมใช้งานในวันที่ให้บริการ");
        const categories = await tx.productCategory.count({ where: { id: { in: stop.categoryIds }, ...(validateActive?{active:true}:{}) } });
        requireCondition(categories === stop.categoryIds.length, "INVALID_CATEGORY", "หมวดสินค้าไม่พร้อมใช้งาน");
        const created = await tx.tripStop.create({ data: { tripRevisionId: trip.id, branchId: stop.branchId, sequence: index + 1, nameSnapshot: branch.name } });
        for (const categoryId of stop.categoryIds) await tx.tripStopCategory.create({ data: { stopId: created.id, categoryId } });
      }
    }
    const updated = await tx.dailyPlan.update({ where: { id: plan.id }, data: { version: { increment: 1 } } });
    const result = { planId: plan.id, revisionId: revision.id, version: updated.version };
    await tx.auditLog.create({data:{actorId,action:"PLAN_DRAFT_CREATED",entityType:"PlanRevision",entityId:revision.id,idempotencyId,reason:input.reason ?? "สร้างฉบับร่าง",before:{revisionId:previous?.id??null},after:result}});
    return result;
}

export async function candidateCoverage(tx: Transaction, revisionId: string) {
  const revision = await tx.planRevision.findUniqueOrThrow({ where: { id: revisionId } });
  const plan = await tx.dailyPlan.findUniqueOrThrow({ where: { id: revision.planId } });
  const branches = await tx.branch.findMany({ where: { destinationType: "BRANCH", archived: false, activeFrom: { lte: plan.serviceDate }, OR: [{ activeTo: null }, { activeTo: { gte: plan.serviceDate } }] }, orderBy: { id: "asc" } });
  const trips = await tx.tripRevision.findMany({ where: { planRevisionId: revisionId } });
  const coverage = [];
  for (const trip of trips) {
    const stops = await tx.tripStop.findMany({ where: { tripRevisionId: trip.id }, include: { tripStopCategory_stopId: { include: { category: true } } } });
    coverage.push({ ...trip, stops: stops.map((s) => ({ branchId: s.branchId, categoryCodes: s.tripStopCategory_stopId.filter((c) => c.category.active).map((c) => c.category.code) })) });
  }
  return { revision, plan, branches, trips, missing: missingCoverage(branches.map((b) => b.id), coverage) };
}

export async function publishPlan(db: PrismaClient, actorId: string, key: string, input: { revisionId: string; expectedVersion: number; reason?: string; reassignments?: Reassignment[] }) {
  requireCondition(input && typeof input.revisionId === "string" && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลแผนไม่ถูกต้อง");
  return guardedWrite(db, actorId, "plan.publish", key, input, async (tx, idempotencyId) => {
    await authorize(tx, actorId, "plan.publish");
    const prior = await replay<{ revisionId: string; version: number }>(tx, idempotencyId); if (prior) return prior;
    const eligibility = await lockEligibility(tx);
    const revision = await tx.planRevision.findUnique({ where: { id: input.revisionId } });
    requireCondition(revision, "NOT_FOUND", "ไม่พบฉบับแผนที่ต้องการ");
    const plan = await lockPlan(tx, revision.planId);
    versionMatches(plan.version, input.expectedVersion);
    requireCondition(revision.status === "DRAFT", "IMMUTABLE_REVISION", "แผนที่เผยแพร่แล้วแก้ไขไม่ได้");
    const candidate = await candidateCoverage(tx, revision.id);
    if (candidate.missing.length) throw new DomainError("COVERAGE_MISSING", "แผนยังส่งหมูและไก่ไม่ครบทุกสาขาในทั้งสามรอบ", candidate.missing);
    const oldTrips = plan.publishedRevisionId ? await tx.tripRevision.findMany({ where: { planRevisionId: plan.publishedRevisionId } }) : [];
    const activeTrips = candidate.trips.filter((t) => !t.cancelled);
    await lockVehicles(tx, [...oldTrips, ...activeTrips].flatMap((t) => t.vehicleId ? [t.vehicleId] : []));
    await reassignForPublication(tx, actorId, idempotencyId, oldTrips.map(t=>t.id), candidate.trips, input.reassignments ?? [], input.reason);
    await tx.vehicleReservation.updateMany({ where: { tripRevisionId: { in: oldTrips.map((t) => t.id) }, active: true }, data: { active: false, releasedAt: new Date() } });
    for (const trip of activeTrips) {
      if(trip.routeRevisionId){const route=await tx.routeRevision.findUniqueOrThrow({where:{id:trip.routeRevisionId},include:{route:true}});requireCondition(route.route.active&&route.effectiveFrom<=plan.serviceDate&&(!route.effectiveTo||route.effectiveTo>=plan.serviceDate),"INVALID_ROUTE","เส้นทางไม่พร้อมใช้งาน กรุณาปรับฉบับร่างก่อนเผยแพร่");}
      if(trip.templateRevisionId){const template=await tx.templateRevision.findUniqueOrThrow({where:{id:trip.templateRevisionId},include:{template:true}});requireCondition(template.template.active&&template.effectiveFrom<=plan.serviceDate&&(!template.effectiveTo||template.effectiveTo>=plan.serviceDate),"INVALID_TEMPLATE","แม่แบบไม่พร้อมใช้งาน กรุณาปรับฉบับร่างก่อนเผยแพร่");}
      const stops=await tx.tripStop.findMany({where:{tripRevisionId:trip.id},include:{branch:true,tripStopCategory_stopId:{include:{category:true}}}});
      requireCondition(stops.every(s=>!s.branch.archived&&s.branch.activeFrom<=plan.serviceDate&&(!s.branch.activeTo||s.branch.activeTo>=plan.serviceDate)&&s.tripStopCategory_stopId.every(c=>c.category.active)),"INACTIVE_REFERENCE","จุดส่งหรือหมวดสินค้าไม่พร้อมใช้งาน กรุณาปรับฉบับร่างก่อนเผยแพร่");
      requireCondition(trip.vehicleId && trip.departureAt && trip.occupancyStart && trip.occupancyEnd, "UNKNOWN_OCCUPANCY", "กรุณาระบุรถ เวลาออก และช่วงใช้รถก่อนเผยแพร่");
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: trip.vehicleId } });
      if(trip.driverId)requireCondition((await tx.driver.findUnique({where:{id:trip.driverId}}))?.active,"INVALID_DRIVER","พนักงานขับรถไม่พร้อมใช้งาน");
      requireCondition((await tx.vehicleType.findUnique({where:{id:vehicle.typeId}}))?.active&&(await tx.storageCondition.findUnique({where:{id:vehicle.storageConditionId}}))?.active,"INACTIVE_REFERENCE","ประเภทรถหรือสภาพการเก็บรักษาไม่พร้อมใช้งาน");
      if(trip.plannedLoad!==null && vehicle.capacity!==null) requireCondition(trip.loadUnit===vehicle.capacityUnit && new Prisma.Decimal(trip.plannedLoad).lte(vehicle.capacity),"CAPACITY_EXCEEDED","ปริมาณบรรทุกเกินความจุรถหรือหน่วยไม่ตรงกัน");
      const end = new Date(trip.occupancyEnd.valueOf() + trip.bufferMinutes * 60_000);
      requireCondition(vehicle.active && (!vehicle.availableFrom || vehicle.availableFrom <= trip.occupancyStart) && (!vehicle.availableTo || vehicle.availableTo >= end), "VEHICLE_UNAVAILABLE", "รถไม่พร้อมใช้งานในช่วงเวลานี้");
      requireCondition(trip.occupancyStart <= trip.departureAt && trip.departureAt < trip.occupancyEnd && (!trip.loadingAt || trip.occupancyStart <= trip.loadingAt) && (!trip.arrivalAt || trip.arrivalAt <= trip.occupancyEnd), "INVALID_OCCUPANCY", "ช่วงใช้รถไม่ครอบคลุมเวลาปฏิบัติงาน");
      requireCondition(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(trip.departureAt) === plan.serviceDate.toISOString().slice(0, 10), "SERVICE_DATE_MISMATCH", "เวลาออกไม่ตรงกับวันที่ให้บริการ");
      const conflicts = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM VehicleReservation WHERE vehicleId=${trip.vehicleId} AND active=1 AND startAt < ${end} AND endAt > ${trip.occupancyStart} FOR UPDATE`;
      requireCondition(!conflicts.length, "VEHICLE_OVERLAP", "รถถูกจองในช่วงเวลานี้แล้ว");
      await tx.vehicleReservation.create({ data: { vehicleId: trip.vehicleId, tripRevisionId: trip.id, startAt: trip.occupancyStart, endAt: end, bufferMinutes: trip.bufferMinutes } });
    }
    for (const branch of candidate.branches) await tx.planBranch.create({ data: { planRevisionId: revision.id, branchId: branch.id } });
    if (plan.publishedRevisionId) await tx.planRevision.update({ where: { id: plan.publishedRevisionId }, data: { status: "SUPERSEDED" } });
    await tx.planRevision.update({ where: { id: revision.id }, data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: actorId, eligibilityVersion: eligibility.version } });
    const updated = await tx.dailyPlan.update({ where: { id: plan.id }, data: { publishedRevisionId: revision.id, version: { increment: 1 } } });
    const result = { revisionId: revision.id, version: updated.version };
    await tx.auditLog.create({data:{actorId,action:"PLAN_PUBLISHED",entityType:"DailyPlan",entityId:plan.id,idempotencyId,reason:input.reason??"เผยแพร่แผน",before:{revisionId:plan.publishedRevisionId},after:result}});
    return result;
  });
}

export async function changeBranchEligibility(db: PrismaClient, actorId: string, key: string, input: { branchId: string; expectedVersion: number; activeFrom: string; activeTo: string | null; archived: boolean }) {
  requireCondition(input && typeof input.branchId === "string" && Number.isInteger(input.expectedVersion), "INVALID_INPUT", "ข้อมูลสาขาไม่ถูกต้อง");
  const from = serviceDate(input.activeFrom), to = input.activeTo === null ? null : serviceDate(input.activeTo);
  requireCondition((!to || to >= from) && typeof input.archived === "boolean", "INVALID_DATE", "ช่วงวันที่ไม่ถูกต้อง");
  return guardedWrite(db, actorId, "branch.eligibility", key, input, async (tx, idem) => {
    await authorize(tx, actorId, "master.write");
    const prior = await replay<{ version: number }>(tx, idem); if (prior) return prior;
    await lockEligibility(tx);
    const branch = await tx.branch.findUnique({ where: { id: input.branchId } });
    requireCondition(branch, "NOT_FOUND", "ไม่พบสาขา"); versionMatches(branch.version, input.expectedVersion);
    const published = await tx.dailyPlan.findMany({ where: { publishedRevisionId: { not: null } } });
    const eligible = (date: Date, start: Date, end: Date | null, archived: boolean) => !archived && date >= start && (!end || date <= end);
    requireCondition(!published.some((p) => eligible(p.serviceDate, branch.activeFrom, branch.activeTo, branch.archived) !== eligible(p.serviceDate, from, to, input.archived)), "PUBLISHED_ELIGIBILITY_CHANGE", "การเปลี่ยนสาขากระทบแผนที่เผยแพร่แล้ว กรุณาจัดทำแผนปรับปรุงก่อน");
    const updated = await tx.branch.update({ where: { id: branch.id }, data: { activeFrom: from, activeTo: to, archived: input.archived, version: { increment: 1 } } });
    await tx.eligibilityGuard.update({ where: { key: "GLOBAL" }, data: { version: { increment: 1 } } });
    await audit(tx, actorId, "BRANCH_ELIGIBILITY_CHANGED", "Branch", branch.id, idem, { activeFrom: input.activeFrom, activeTo: input.activeTo, archived: input.archived, version: updated.version });
    return { version: updated.version };
  });
}
