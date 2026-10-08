import "dotenv/config";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { installRoles, principal } from "../../src/server/auth/permissions";
import { provisionAccount } from "../../src/server/auth/provision";
import { DomainError } from "../../src/server/domain/errors";
import { createUser, listUsers, resetUserPassword, setUserActive, updateUser, userDetail } from "../../src/server/services/users";
import { backofficeAreas } from "../../src/lib/navigation";
import { seedMasters, synthetic } from "../fixtures/synthetic";

// D223: administrator user management against real MySQL.
const db = createDatabase(testDatabaseConfiguration(process.env)), accounts: Record<string, string> = {};
const [A, B] = synthetic.branchIds, department = "synthetic-department", warehouse = "synthetic-warehouse";
let seq = 0;
const key = () => `users-${++seq}`;
const rejected = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const version = async (id: string) => (await db.user.findUniqueOrThrow({ where: { id } })).version;
const roles = async (id: string) => (await db.userRole.findMany({ where: { userId: id }, include: { role: true } })).map((r) => r.role.code);
const scopes = async (id: string) => (await db.userScope.findMany({ where: { userId: id } })).map((s) => s.kind).sort();
const credential = async (id: string) => (await db.authAccount.findFirstOrThrow({ where: { userId: id, providerId: "credential" } })).password!;
const session = (userId: string) => db.authSession.create({ data: { id: randomUUID(), token: randomBytes(24).toString("hex"), userId, expiresAt: new Date(Date.now() + 3_600_000) } });

before(async () => {
  await seedMasters(db); await installRoles(db);
  await db.driver.create({ data: { id: "users-driver", code: "USERS-DRIVER", name: "คนขับทดสอบผู้ใช้" } });
  await db.department.create({ data: { id: "users-closed-department", code: "USERS-CLOSED", name: "แผนกปิดแล้ว (สังเคราะห์)", active: false } });
  const password = randomBytes(24).toString("base64url");
  for (const [name, role] of [["ADMIN_1", "ADMINISTRATOR"], ["ADMIN_2", "ADMINISTRATOR"], ["PLANNER", "DISPATCHER"]] as const)
    accounts[name] = (await provisionAccount(db, { email: `users-${name.toLowerCase()}@synthetic.test`, name: `ทดสอบ ${name}`, password, role, scope: "GLOBAL", departmentId: department })).id;
});
after(async () => { await db.$disconnect(); });

test("D223: only an administrator with company scope manages users; the back office lists the area only for them", async () => {
  await assert.rejects(listUsers(db, accounts.PLANNER, {}), rejected("FORBIDDEN"));
  await assert.rejects(createUser(db, accounts.PLANNER, key(), { name: "ห้ามสร้าง", email: "users-denied@synthetic.test", typeCode: "REQUESTER", departmentId: department }), rejected("FORBIDDEN"));
  const admin = await db.$transaction((tx) => principal(tx, accounts.ADMIN_1)), planner = await db.$transaction((tx) => principal(tx, accounts.PLANNER));
  assert.ok(backofficeAreas(admin.permissions, admin.global).some((a) => a.id === "users"));
  assert.ok(!backofficeAreas(planner.permissions, planner.global).some((a) => a.id === "users"));
});

test("D223: create returns a temporary password once, stores only its hash, and replays without it", async () => {
  const input = { name: "คลังทดสอบผู้ใช้", email: "Users-Warehouse@Synthetic.test", typeCode: "WAREHOUSE", departmentId: department, warehouseId: warehouse, driverId: "users-driver" };
  const k = key(), created = await createUser(db, accounts.ADMIN_1, k, input);
  assert.match(created.temporaryPassword ?? "", /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal(await verifyPassword({ hash: await credential(created.id), password: created.temporaryPassword! }), true);
  const replayed = await createUser(db, accounts.ADMIN_1, k, input);
  assert.deepEqual([replayed.id, replayed.temporaryPassword], [created.id, null], "a retried request never shows a second password");
  const record = await db.idempotencyRecord.findFirstOrThrow({ where: { actorId: accounts.ADMIN_1, key: k } });
  assert.ok(!JSON.stringify(record.response).includes(created.temporaryPassword!), "the password is not kept in the replay record");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: created.id } })).email, "users-warehouse@synthetic.test");
  assert.deepEqual(await roles(created.id), ["WAREHOUSE"]);
  assert.deepEqual(await scopes(created.id), ["DEPARTMENT", "DRIVER", "WAREHOUSE"]);
  assert.ok(await db.auditLog.findFirst({ where: { action: "USER_CREATED", entityId: created.id, actorId: accounts.ADMIN_1 } }));
  accounts.WAREHOUSE = created.id;
});

test("D223: each account type is validated with the scope it needs", async () => {
  const base = { name: "ทดสอบเงื่อนไข", departmentId: department };
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-v1@synthetic.test", typeCode: "BRANCH_RECEIVER" }), rejected("SCOPE_REQUIRED"));
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-v2@synthetic.test", typeCode: "WAREHOUSE" }), rejected("SCOPE_REQUIRED"));
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-v3@synthetic.test", typeCode: "SUPERVISOR" }), rejected("INVALID_TYPE"), "retired codes cannot be chosen");
  const noDepartment=await createUser(db,accounts.ADMIN_1,key(),{...base,email:"users-v4@synthetic.test",typeCode:"REQUESTER",departmentId:""});
  assert.deepEqual(await scopes(noDepartment.id),[]);
  await updateUser(db,accounts.ADMIN_1,key(),{id:noDepartment.id,expectedVersion:await version(noDepartment.id),name:"เลือกแผนกตอนฝาก",reason:"ทดสอบบัญชีไม่มีแผนก",typeCode:"REQUESTER"});
  assert.deepEqual(await scopes(noDepartment.id),[]);
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-v5@synthetic.test", typeCode: "REQUESTER", departmentId: "users-closed-department" }), rejected("INACTIVE_REFERENCE"));
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-v6@synthetic.test", typeCode: "BRANCH_RECEIVER", branchId: synthetic.inactiveBranchId }), rejected("INACTIVE_REFERENCE"));
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-warehouse@synthetic.test", typeCode: "REQUESTER" }), rejected("DUPLICATE_ACCOUNT"));
  await assert.rejects(createUser(db, accounts.ADMIN_1, key(), { ...base, email: "not-an-email", typeCode: "REQUESTER" }), rejected("INVALID_EMAIL"));
  // A planner gets the company scope; a branch or warehouse sent along is ignored.
  const planner = await createUser(db, accounts.ADMIN_1, key(), { ...base, email: "users-planner2@synthetic.test", typeCode: "DISPATCHER", branchId: A, warehouseId: warehouse });
  assert.deepEqual(await scopes(planner.id), ["DEPARTMENT", "GLOBAL"]);
});

test("D223: changing type replaces role and scopes in one audited, version-checked step; access follows immediately", async () => {
  const id = accounts.WAREHOUSE, v = await version(id);
  const changed = await updateUser(db, accounts.ADMIN_1, key(), { id, expectedVersion: v, name: "ย้ายไปสาขา", reason: "ย้ายไปประจำสาขา", typeCode: "BRANCH_RECEIVER", departmentId: department, branchId: B, warehouseId: warehouse });
  assert.equal(changed.version, v + 1);
  assert.deepEqual(await roles(id), ["BRANCH_RECEIVER"]);
  assert.deepEqual(await scopes(id), ["BRANCH", "DEPARTMENT"], "the old warehouse and driver scopes are gone");
  const p = await db.$transaction((tx) => principal(tx, id));
  assert.ok(p.permissions.has("consignment.receive") && !p.permissions.has("consignment.load"));
  await assert.rejects(updateUser(db, accounts.ADMIN_1, key(), { id, expectedVersion: v, name: "ซ้ำ", reason: "ข้อมูลเก่า", typeCode: "REQUESTER", departmentId: department }), rejected("VERSION_CONFLICT"));
  await assert.rejects(updateUser(db, accounts.ADMIN_1, key(), { id, expectedVersion: v + 1, name: "ไม่มีเหตุผล", reason: "", typeCode: "REQUESTER", departmentId: department }), rejected("REASON_REQUIRED"));
  const logged = await db.auditLog.findFirstOrThrow({ where: { action: "USER_ACCESS_CHANGED", entityId: id } });
  assert.deepEqual([(logged.before as Record<string, unknown>).typeCode, (logged.after as Record<string, unknown>).typeCode, logged.reason], ["WAREHOUSE", "BRANCH_RECEIVER", "ย้ายไปประจำสาขา"]);
  const detail = await userDetail(db, accounts.ADMIN_1, id);
  assert.equal(detail.access.branchId, B);
  assert.ok(detail.history.some((h) => h.action === "เปลี่ยนชื่อ ประเภท หรือขอบเขต"));
});

test("D223: disabling ends sessions and blocks every request; re-enabling restores access; history is kept", async () => {
  const id = accounts.WAREHOUSE;
  await session(id); await session(id);
  const off = await setUserActive(db, accounts.ADMIN_1, key(), { id, expectedVersion: await version(id), active: false, reason: "ลาออก" });
  assert.equal(off.active, false);
  assert.equal(await db.authSession.count({ where: { userId: id } }), 0);
  await assert.rejects(db.$transaction((tx) => principal(tx, id)), rejected("FORBIDDEN"));
  await assert.rejects(setUserActive(db, accounts.ADMIN_1, key(), { id, expectedVersion: off.version, active: false, reason: "ซ้ำ" }), rejected("NO_CHANGE"));
  await assert.rejects(resetUserPassword(db, accounts.ADMIN_1, key(), { id, expectedVersion: off.version, reason: "ลืมรหัส" }), rejected("INACTIVE_ACCOUNT"));
  const listed = await listUsers(db, accounts.ADMIN_1, { status: "inactive" });
  assert.ok(listed.rows.some((r) => r.id === id) && !(await listUsers(db, accounts.ADMIN_1, {})).rows.some((r) => r.id === id));
  const on = await setUserActive(db, accounts.ADMIN_1, key(), { id, expectedVersion: off.version, active: true, reason: "กลับมาทำงาน" });
  assert.equal((await db.$transaction((tx) => principal(tx, id))).user.id, id);
  assert.equal(on.active, true);
  assert.equal(await db.auditLog.count({ where: { entityId: id, action: { in: ["USER_DEACTIVATED", "USER_REACTIVATED"] } } }), 2);
});

test("D223: a new temporary password replaces the old one and ends sessions; administrators cannot lock themselves out", async () => {
  const id = accounts.WAREHOUSE, before = await credential(id);
  await session(id);
  const reset = await resetUserPassword(db, accounts.ADMIN_1, key(), { id, expectedVersion: await version(id), reason: "ลืมรหัสผ่าน" });
  assert.ok(reset.temporaryPassword && await verifyPassword({ hash: await credential(id), password: reset.temporaryPassword }));
  assert.notEqual(await credential(id), before);
  assert.equal(await db.authSession.count({ where: { userId: id } }), 0);
  const self = accounts.ADMIN_1, v = await version(self);
  await assert.rejects(setUserActive(db, self, key(), { id: self, expectedVersion: v, active: false, reason: "ทดสอบ" }), rejected("SELF_LOCKOUT"));
  await assert.rejects(updateUser(db, self, key(), { id: self, expectedVersion: v, name: "ลดสิทธิ์ตัวเอง", reason: "ทดสอบ", typeCode: "DISPATCHER", departmentId: department }), rejected("SELF_LOCKOUT"));
  await assert.rejects(resetUserPassword(db, self, key(), { id: self, expectedVersion: v, reason: "ทดสอบ" }), rejected("SELF_RESET"));
});

test("D223 race: two administrators demoting each other at the same moment leave at least one administrator", async () => {
  const [a, b] = [accounts.ADMIN_1, accounts.ADMIN_2];
  const demote = async (actor: string, target: string) => updateUser(db, actor, key(), { id: target, expectedVersion: await version(target), name: "ลดเป็นผู้วางแผน", reason: "ทดสอบพร้อมกัน", typeCode: "DISPATCHER", departmentId: department });
  const results = await Promise.allSettled([demote(a, b), demote(b, a)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "exactly one demotion wins");
  const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.ok(loser.reason instanceof DomainError && ["LAST_ADMINISTRATOR", "FORBIDDEN"].includes(loser.reason.code), String(loser.reason));
  // Other suites in the same database may add administrators, so count only these two.
  assert.deepEqual((await Promise.all([a, b].map(roles))).map((r) => r.join()).sort(), ["ADMINISTRATOR", "DISPATCHER"]);
});
