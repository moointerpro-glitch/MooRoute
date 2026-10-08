import "dotenv/config";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { installRoles, principal } from "../../src/server/auth/permissions";
import { provisionAccount, assignAccountDepartment, consolidateRetiredRoles } from "../../src/server/auth/provision";
import { authorize } from "../../src/server/services/transaction";
import { accountSummary, updateMyProfile } from "../../src/server/services/account";
import { DomainError } from "../../src/server/domain/errors";
import type { DraftInput } from "../../src/server/domain/consignment";
import { saveConsignmentDraft, submitConsignment, consignmentDetail, listConsignments, consignmentFormOptions,
  assignConsignment, rejectConsignment, reassignConsignment, cancelConsignment, addAttachment, attachmentForDownload } from "../../src/server/services/consignments";
import { saveDraft, publishPlan } from "../../src/server/services/plans";
import { planningData } from "../../src/server/services/planning-read";
import { navigationAccess } from "../../src/lib/navigation";
import { createUser } from "../../src/server/services/users";
import { seedMasters, synthetic, completeDraft } from "../fixtures/synthetic";

const db = createDatabase(testDatabaseConfiguration(process.env)), accounts: Record<string, string> = {};
const date = "2034-06-01", departmentId = "access-department", [A, B] = synthetic.branchIds;
let seq = 0;
const key = () => `access-${++seq}`;
const denied = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const history = { query: "", status: [], branchId: null, categoryId: null, date: null, tripCode: null, mine: false, page: 1 };
const draft = (): DraftInput => ({ expectedVersion: 0, departmentId, sourceWarehouseId: "synthetic-warehouse", destinationBranchId: A,
  requestedServiceDate: date, requestedRoundNo: 1, requestedTripId: null, senderName: "ผู้ฝากทดสอบสิทธิ์", senderPhone: "000-000-1000",
  recipientName: "ผู้รับทดสอบ", recipientPhone: "000-000-2000", notes: null, receiptMode: "PACKAGES", packageCount: 1,
  packageWeight: null, packageWeightUnit: null, items: [{ categoryId: "synthetic-item-category", name: "เอกสารทดสอบ", quantity: "1", unit: "SHEET" }] });

before(async () => {
  await seedMasters(db); await installRoles(db);
  await db.department.create({ data: { id: departmentId, code: "ACCESS-TEST", name: "แผนกทดสอบสิทธิ์ (สังเคราะห์)" } });
  await db.driver.create({ data: { id: "access-driver", code: "ACCESS-DRIVER", name: "คนขับทดสอบสิทธิ์" } });
  const password = randomBytes(24).toString("base64url");
  for (const [role, scope, scopeId] of [
    ["REQUESTER", "DEPARTMENT", departmentId], ["DISPATCHER", "GLOBAL", undefined], ["SUPERVISOR", "GLOBAL", undefined],
    ["WAREHOUSE", "WAREHOUSE", "synthetic-warehouse"], ["DRIVER", "DRIVER", "access-driver"],
    ["BRANCH_RECEIVER", "BRANCH", B], ["ADMINISTRATOR", "GLOBAL", undefined],
  ] as const) accounts[role] = (await provisionAccount(db, { email: `access-${role}@synthetic.test`, name: `ทดสอบ ${role}`, password, role, scope, scopeId, departmentId })).id;
  accounts.UNCONFIGURED = (await provisionAccount(db, { email: "access-unconfigured@synthetic.test", name: "ยังไม่กำหนดแผนก", password, role: "DISPATCHER", scope: "GLOBAL" })).id;
  const plan = completeDraft(date, "access");
  const d = await saveDraft(db, accounts.DISPATCHER, key(), plan);
  await publishPlan(db, accounts.SUPERVISOR, key(), { revisionId: d.revisionId, expectedVersion: d.version });
});
after(async () => { await db.$disconnect(); });

test("D216: every role creates/submits/cancels its own request without expanding other people's access", async () => {
  for (const role of ["REQUESTER", "DISPATCHER", "SUPERVISOR", "WAREHOUSE", "DRIVER", "BRANCH_RECEIVER", "ADMINISTRATOR"]) {
    const actor = accounts[role], d = await saveConsignmentDraft(db, actor, key(), draft());
    assert.equal((await consignmentDetail(db, actor, d.id)).mine, true);
    await assert.rejects(consignmentDetail(db, accounts.UNCONFIGURED, d.id), denied("NOT_FOUND"));
    assert.equal((await consignmentDetail(db, accounts.ADMINISTRATOR, d.id)).status, "DRAFT", "D215 retained");
    const file = await addAttachment(db, actor, key(), { consignmentId: d.id, displayName: "ทดสอบ.pdf", contentType: "application/pdf", sizeBytes: 10, sha256: "a".repeat(64), storageKey: `access-file-${seq}` });
    assert.equal((await attachmentForDownload(db, actor, file.id)).contentType, "application/pdf");
    const submitted = await submitConsignment(db, actor, key(), { id: d.id, expectedVersion: d.version });
    assert.ok((await listConsignments(db, actor, { ...history, query: d.code })).rows.some((r) => r.id === d.id));
    if (role !== "BRANCH_RECEIVER") {
      await assert.rejects(consignmentDetail(db, accounts.BRANCH_RECEIVER, d.id), denied("FORBIDDEN"), "sender department is not department-history access");
      await assert.rejects(attachmentForDownload(db, accounts.BRANCH_RECEIVER, file.id), denied("FORBIDDEN"));
    }
    assert.equal((await cancelConsignment(db, actor, key(), { id: d.id, expectedVersion: submitted.version, reason: "ยกเลิกคำขอทดสอบ" })).status, "CANCELLED");
  }
});

test("D233: bootstrap administrator chooses a sender department without account membership", async () => {
  const account = await provisionAccount(db, { email: "access-bootstrap-admin@synthetic.test", name: "ผู้ดูแลแรกทดสอบ", password: randomBytes(24).toString("base64url"), role: "ADMINISTRATOR", scope: "GLOBAL" });
  const actor=account.id;
  assert.equal(await db.userScope.count({where:{userId:actor,kind:"DEPARTMENT"}}),0);
  assert.ok((await consignmentFormOptions(db,actor)).departments.some(d=>d.id===departmentId));
  const saved=await saveConsignmentDraft(db,actor,key(),draft());
  const submitted=await submitConsignment(db,actor,key(),{id:saved.id,expectedVersion:saved.version});
  assert.equal(submitted.status,"PENDING_REVIEW");
  // D235: the administrator reviews a request they created themselves.
  assert.equal((await assignConsignment(db,actor,key(),{id:saved.id,expectedVersion:submitted.version,tripId:"access-trip-1",stopSequence:1,reason:"ทดสอบการจัดรถให้ตัวเอง"})).status,"ASSIGNED");
  await cancelConsignment(db,actor,key(),{id:saved.id,expectedVersion:submitted.version+1,reason:"ปิดรายการทดสอบ"});
});

test("D233: every sender can select active departments while contact and history access stay scoped",async()=>{
  for(const role of ["DRIVER","WAREHOUSE","BRANCH_RECEIVER","REQUESTER"]){
    const options=await consignmentFormOptions(db,accounts[role]);
    assert.deepEqual(options.departments.map(d=>d.id).sort(),[departmentId,"synthetic-department"].sort());
    assert.equal(options.branches.find(b=>b.id===A)!.contactPhone,null);
    const p=await db.$transaction(tx=>principal(tx,accounts[role])),menu=navigationAccess(p.permissions,p.global);
    assert.ok(menu.canSearch&&menu.canConsign&&menu.canHistory);assert.equal(menu.canOpenBackend,false);
    await assert.rejects(planningData(db,accounts[role],date),denied("FORBIDDEN"));
    const selected=await saveConsignmentDraft(db,accounts[role],key(),{...draft(),departmentId:"synthetic-department"});
    assert.equal((await consignmentDetail(db,accounts[role],selected.id)).mine,true);
  }
  const noScope=await createUser(db,accounts.ADMINISTRATOR,key(),{name:"ผู้ฝากไม่มีแผนก (สังเคราะห์)",email:"no-scope@synthetic.test",typeCode:"REQUESTER"});
  const actor=noScope.id,input={...draft(),departmentId:"synthetic-department"},draftKey=key();
  const saved=await saveConsignmentDraft(db,actor,draftKey,input);
  const changed=await saveConsignmentDraft(db,actor,key(),{...input,id:saved.id,expectedVersion:saved.version,departmentId});
  assert.equal((await db.consignment.findUniqueOrThrow({where:{id:saved.id}})).departmentId,departmentId);
  const log=await db.auditLog.findFirstOrThrow({where:{entityId:saved.id,action:"CONSIGNMENT_DRAFT_SAVED"}});
  assert.deepEqual([(log.after as Record<string,unknown>).previousDepartmentId,(log.after as Record<string,unknown>).departmentId],["synthetic-department",departmentId]);
  const submitted=await submitConsignment(db,actor,key(),{id:saved.id,expectedVersion:changed.version});
  assert.equal(submitted.status,"PENDING_REVIEW");
  assert.equal(await db.userScope.count({where:{userId:actor}}),0,"selection never grants scopes");
  assert.equal((await consignmentDetail(db,accounts.REQUESTER,saved.id)).mine,false,"existing department readers see submitted requests");
  const other=await saveConsignmentDraft(db,accounts.REQUESTER,key(),draft());
  await submitConsignment(db,accounts.REQUESTER,key(),{id:other.id,expectedVersion:other.version});
  await assert.rejects(consignmentDetail(db,actor,other.id),denied("FORBIDDEN"));
  assert.equal((await listConsignments(db,actor,{...history,query:other.code})).rows.length,0);
  const file=await addAttachment(db,accounts.REQUESTER,key(),{consignmentId:other.id,displayName:"ทดสอบ.pdf",contentType:"application/pdf",sizeBytes:10,sha256:"a".repeat(64),storageKey:"department-scope-file"});
  await assert.rejects(attachmentForDownload(db,actor,file.id),denied("FORBIDDEN"));
  await assert.rejects(saveConsignmentDraft(db,actor,key(),{...input,id:saved.id,expectedVersion:submitted.version}),denied("INVALID_TRANSITION"));
});

test("D233: missing, fabricated and inactive departments are rejected, including submit and replay",async()=>{
  const closed="access-closed-dept";
  await db.department.create({data:{id:closed,code:"ACCESS-CLOSED",name:"แผนกปิด (สังเคราะห์)",active:false}});
  const actor=accounts.UNCONFIGURED;
  assert.ok(!(await consignmentFormOptions(db,actor)).departments.some(d=>d.id===closed));
  await assert.rejects(saveConsignmentDraft(db,actor,key(),{...draft(),departmentId:""}),denied("REQUIRED"));
  for(const id of [closed,"missing-department"])await assert.rejects(saveConsignmentDraft(db,actor,key(),{...draft(),departmentId:id}),denied("INACTIVE_REFERENCE"));
  // Provisioning remains available for read membership, but it is not a prerequisite for creation.
  await assignAccountDepartment(db,"access-unconfigured@synthetic.test",departmentId,"กำหนดขอบเขตทดสอบ");
  const input=draft(),draftKey=key(),saved=await saveConsignmentDraft(db,actor,draftKey,input),submitKey=key(),submitInput={id:saved.id,expectedVersion:saved.version};
  await db.userScope.deleteMany({where:{userId:actor,kind:"DEPARTMENT"}});
  assert.equal((await saveConsignmentDraft(db,actor,draftKey,input)).id,saved.id);
  await db.department.update({where:{id:departmentId},data:{active:false}});
  try{await assert.rejects(submitConsignment(db,actor,submitKey,submitInput),denied("INACTIVE_REFERENCE"));}finally{await db.department.update({where:{id:departmentId},data:{active:true}});}
  await submitConsignment(db,actor,submitKey,submitInput);
  await db.department.update({where:{id:departmentId},data:{active:false}});
  try{
    await assert.rejects(saveConsignmentDraft(db,actor,draftKey,input),denied("INACTIVE_REFERENCE"));
    await assert.rejects(submitConsignment(db,actor,submitKey,submitInput),denied("INACTIVE_REFERENCE"));
  }finally{await db.department.update({where:{id:departmentId},data:{active:true}});}
});

test("D216/D235: a planner cannot review their own request, including replays and plan publication; the administrator can", async () => {
  {
    const actor = accounts.DISPATCHER, d = await saveConsignmentDraft(db, actor, key(), draft());
    const s = await submitConsignment(db, actor, key(), { id: d.id, expectedVersion: d.version });
    const assign = { id: d.id, expectedVersion: s.version, tripId: "access-trip-1" };
    const idem = key();
    await assert.rejects(assignConsignment(db, actor, idem, assign), denied("SELF_REVIEW"));
    await assert.rejects(assignConsignment(db, actor, idem, assign), denied("SELF_REVIEW"));
    await assert.rejects(rejectConsignment(db, actor, key(), { id: d.id, expectedVersion: s.version, reason: "ตรวจคำขอตนเอง" }), denied("SELF_REVIEW"));
    const detail = await consignmentDetail(db, actor, d.id);
    assert.ok(!detail.actions.includes("assign"));
    assert.ok(detail.blockedActions.some((a) => a.action === "assign" && a.reason.includes("อีกคน")));
    const a = await assignConsignment(db, accounts.ADMINISTRATOR, key(), assign);
    await assert.rejects(reassignConsignment(db, actor, key(), { id: d.id, expectedVersion: a.version, tripId: "access-trip-2", reason: "ย้ายคำขอตนเอง" }), denied("SELF_REVIEW"));
  }
  {
    // D235: nothing is reserved from the administrator, including their own request.
    const actor = accounts.ADMINISTRATOR, d = await saveConsignmentDraft(db, actor, key(), draft());
    const s = await submitConsignment(db, actor, key(), { id: d.id, expectedVersion: d.version });
    const detail = await consignmentDetail(db, actor, d.id);
    assert.ok(detail.actions.includes("assign") && detail.actions.includes("reject"));
    assert.ok(!detail.blockedActions.some((a) => a.reason.includes("อีกคน")));
    const a = await assignConsignment(db, actor, key(), { id: d.id, expectedVersion: s.version, tripId: "access-trip-1" });
    const moved = await reassignConsignment(db, actor, key(), { id: d.id, expectedVersion: a.version, tripId: "access-trip-2", reason: "ผู้ดูแลระบบย้ายคำขอของตนเอง" });
    assert.equal(moved.status, "ASSIGNED");
    assert.equal((await db.auditLog.findFirstOrThrow({ where: { entityId: d.id, action: "CONSIGNMENT_REASSIGNED" } })).actorId, actor, "the audit log still records who acted");
  }
  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(date) } });
  const d = await saveDraft(db, accounts.DISPATCHER, key(), completeDraft(date, "access", plan.version));
  const rows = await db.consignment.findMany({ where: { status: "ASSIGNED", code: { startsWith: "FS-" }, requestedServiceDate: new Date(date) } });
  const publish = (actor: string) => publishPlan(db, actor, key(), { revisionId: d.revisionId, expectedVersion: d.version, reason: "ย้ายผ่านแผนทดสอบ", reassignments: rows.map((c) => ({ consignmentId: c.id, expectedVersion: c.version, tripId: "access-trip-1", stopSequence: 1 })) });
  assert.ok(rows.some((c) => c.requesterId === accounts.DISPATCHER) && rows.some((c) => c.requesterId === accounts.ADMINISTRATOR));
  await assert.rejects(publish(accounts.DISPATCHER), denied("SELF_REVIEW"));
  assert.equal((await db.dailyPlan.findUniqueOrThrow({ where: { id: plan.id } })).publishedRevisionId, plan.publishedRevisionId, "a refused publication leaves the published plan in place");
  await publish(accounts.ADMINISTRATOR);
  assert.equal((await db.dailyPlan.findUniqueOrThrow({ where: { id: plan.id } })).publishedRevisionId, d.revisionId, "the administrator may move their own request through a plan");
});

test("D235: the administrator is not limited by scope rows or by who created a request", async () => {
  const actor = accounts.ADMINISTRATOR, own = accounts.REQUESTER;
  const p = await db.$transaction((tx) => principal(tx, actor));
  assert.deepEqual([p.admin, p.global], [true, true]);
  assert.equal((await db.$transaction((tx) => principal(tx, accounts.DISPATCHER))).admin, false);
  // Scope rows no longer decide what the administrator may touch.
  const scopes = await db.userScope.findMany({ where: { userId: actor } });
  await db.userScope.deleteMany({ where: { userId: actor } });
  try {
    assert.equal((await db.$transaction((tx) => principal(tx, actor))).global, true);
    for (const [capability, scope] of [["consignment.receive", { branchId: B }], ["consignment.warehouse", { warehouseId: "synthetic-warehouse" }], ["trip.move", { driverId: "access-driver" }], ["plan.read", undefined]] as const) await db.$transaction((tx) => authorize(tx, actor, capability, scope));
    assert.equal((await planningData(db, actor, date)).serviceDate, date);
    const d = await saveConsignmentDraft(db, own, key(), draft());
    const edited = await saveConsignmentDraft(db, actor, key(), { ...draft(), id: d.id, expectedVersion: d.version, senderName: "แก้โดยผู้ดูแลระบบ (สังเคราะห์)" });
    const s = await submitConsignment(db, actor, key(), { id: d.id, expectedVersion: edited.version });
    assert.equal((await db.consignment.findUniqueOrThrow({ where: { id: d.id } })).requesterId, own, "the request keeps its requester");
    assert.equal((await cancelConsignment(db, actor, key(), { id: d.id, expectedVersion: s.version, reason: "ผู้ดูแลระบบยกเลิกแทน" })).status, "CANCELLED");
  } finally { await db.userScope.createMany({ data: scopes }); }
  // Other account types gain nothing: a planner still cannot touch another person's draft.
  const other = await saveConsignmentDraft(db, own, key(), draft());
  await assert.rejects(saveConsignmentDraft(db, accounts.DISPATCHER, key(), { ...draft(), id: other.id, expectedVersion: other.version }), denied("NOT_FOUND"));
  await assert.rejects(db.$transaction((tx) => authorize(tx, accounts.WAREHOUSE, "consignment.receive", { branchId: B })), denied("FORBIDDEN"));
});

test("D221: retired codes become the absorbing type with audit; scope still decides whose records an account may touch", async () => {
  const roleOf = async (userId: string) => (await db.userRole.findMany({ where: { userId }, include: { role: true } })).map((r) => r.role.code).sort();
  // Provisioning with a retired code stores the absorbing type and records what was asked for.
  assert.deepEqual(await roleOf(accounts.SUPERVISOR), ["DISPATCHER"]);
  assert.deepEqual(await roleOf(accounts.DRIVER), ["WAREHOUSE"]);
  const provisioned = await db.auditLog.findFirstOrThrow({ where: { action: "LOCAL_ACCOUNT_PROVISIONED", entityId: accounts.DRIVER } });
  assert.deepEqual([(provisioned.after as Record<string, unknown>).role, (provisioned.after as Record<string, unknown>).requestedRole], ["WAREHOUSE", "DRIVER"]);

  // An account created before D221 still holds the retired code directly; the operator step moves it once.
  const legacy = (await provisionAccount(db, { email: "access-legacy-driver@synthetic.test", name: "คนขับบัญชีเดิม", password: randomBytes(24).toString("base64url"), role: "WAREHOUSE", scope: "DRIVER", scopeId: "access-driver" })).id;
  const [driverRole, warehouseRole] = await Promise.all([db.role.findUniqueOrThrow({ where: { code: "DRIVER" } }), db.role.findUniqueOrThrow({ where: { code: "WAREHOUSE" } })]);
  await db.userRole.deleteMany({ where: { userId: legacy, roleId: warehouseRole.id } });
  await db.userRole.create({ data: { userId: legacy, roleId: driverRole.id } });
  const before = await db.$transaction((tx) => principal(tx, legacy));
  assert.ok(await consolidateRetiredRoles(db, "ทดสอบรวมประเภทบัญชี") >= 1);
  assert.deepEqual(await roleOf(legacy), ["WAREHOUSE"]);
  assert.deepEqual([...(await db.$transaction((tx) => principal(tx, legacy))).permissions].sort(), [...before.permissions].sort(), "capabilities unchanged");
  const moved = await db.auditLog.findFirstOrThrow({ where: { action: "LOCAL_OPERATOR_ACCOUNT_TYPE_CONSOLIDATED", entityId: legacy } });
  assert.deepEqual([(moved.before as Record<string, unknown>).role, (moved.after as Record<string, unknown>).role], ["DRIVER", "WAREHOUSE"]);
  assert.equal(await consolidateRetiredRoles(db, "ทดสอบรวมประเภทบัญชีซ้ำ"), 0, "idempotent");

  // A driver now holds warehouse capabilities but not the warehouse scope, so warehouse work is still refused.
  await assert.rejects(db.$transaction((tx) => authorize(tx, accounts.DRIVER, "consignment.warehouse", { warehouseId: "synthetic-warehouse" })), denied("FORBIDDEN"));
  await db.$transaction((tx) => authorize(tx, accounts.WAREHOUSE, "consignment.warehouse", { warehouseId: "synthetic-warehouse" }));
  await db.$transaction((tx) => authorize(tx, accounts.DRIVER, "trip.move", { driverId: "access-driver" }));
  await assert.rejects(db.$transaction((tx) => authorize(tx, accounts.WAREHOUSE, "trip.move", { driverId: "access-driver" })), denied("FORBIDDEN"));
  await assert.rejects(db.$transaction((tx) => authorize(tx, accounts.WAREHOUSE, "consignment.receive", { branchId: B })), denied("FORBIDDEN"));

  // The header shows one type and the working scope first.
  const driver = await db.$transaction((tx) => accountSummary(tx, accounts.DRIVER));
  assert.equal(driver.typeName, "คลังและรถขนส่ง");
  assert.equal(driver.scopes[0], "รถที่ขับ: คนขับทดสอบสิทธิ์");
  assert.equal((await db.$transaction((tx) => accountSummary(tx, accounts.SUPERVISOR))).typeName, "ผู้วางแผนขนส่ง");
});

test("D220/D221: saved contact details pre-fill a new request; versions are checked", async () => {
  const actor = accounts.REQUESTER;
  const saved = await updateMyProfile(db, actor, key(), { phone: "081-234-5678", defaultWarehouseId: "synthetic-warehouse", expectedVersion: 0 });
  await assert.rejects(updateMyProfile(db, actor, key(), { phone: "081-000-0000", defaultWarehouseId: "", expectedVersion: 0 }), denied("VERSION_CONFLICT"));
  await assert.rejects(updateMyProfile(db, actor, key(), { phone: "โทรหาฉัน", defaultWarehouseId: "", expectedVersion: saved.version }), denied("INVALID_PHONE"));
  const options = await consignmentFormOptions(db, actor);
  assert.deepEqual([options.senderPhone, options.defaultWarehouseId], ["081-234-5678", "synthetic-warehouse"]);
  assert.deepEqual([(await consignmentFormOptions(db, accounts.BRANCH_RECEIVER)).senderPhone], [""], "only the owner's profile is used");
});
