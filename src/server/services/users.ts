import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma, type PrismaClient, type ScopeKind } from "../../generated/prisma/client";
import { principal, requireCapability } from "../auth/permissions";
import { DomainError, requireCondition, versionMatches } from "../domain/errors";
import { ACCOUNT_TYPES, ROLE_NAMES, accountTypeOf } from "../../lib/account-display";
import { bangkokServiceDate } from "../../lib/bangkok-date";
import { audit, guardedWrite, replay, type Transaction } from "./transaction";

/**
 * D223 web user management for the administrator: create accounts, set one account type with its scope,
 * disable or re-enable, and issue temporary passwords. Accounts are never deleted here because plans,
 * consignments and audit history refer to them; disabling blocks sign-in and ends every session.
 */
const PAGE = 20, idPattern = /^[A-Za-z0-9-]{1,36}$/, emailPattern = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/;
const TYPE_CODES = ACCOUNT_TYPES.map((t) => t.code);
const GLOBAL_TYPES = ["DISPATCHER", "ADMINISTRATOR"];

export interface AccessInput { typeCode: string; departmentId: string; branchId?: string | null; warehouseId?: string | null; driverId?: string | null }
export interface CreateUserInput extends AccessInput { name: string; email: string }
export interface UpdateUserInput extends AccessInput { id: string; expectedVersion: number; name: string; reason: string }
export interface UserStateInput { id: string; expectedVersion: number; reason: string }

async function requireAdmin(tx: Transaction, actorId: string) {
  const p = await principal(tx, actorId);
  requireCapability(p, "identity.manage");
  requireCondition(p.global, "FORBIDDEN", "การจัดการผู้ใช้ต้องมีขอบเขตทั้งบริษัท");
  return p;
}

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max + 1) : "";
const optionalId = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  requireCondition(typeof value === "string" && idPattern.test(value), "INVALID_INPUT", "ข้อมูลขอบเขตไม่ถูกต้อง");
  return value;
};
function reasonOf(input: { reason?: unknown }) {
  const reason = text(input?.reason, 300);
  requireCondition(reason.length >= 3 && reason.length <= 300, "REASON_REQUIRED", "กรุณาระบุเหตุผลอย่างน้อย ๓ ตัวอักษร");
  return reason;
}
function nameOf(input: { name?: unknown }) {
  const name = text(input?.name, 120);
  requireCondition(name.length >= 2 && name.length <= 120, "INVALID_NAME", "ชื่อที่แสดงต้องยาว ๒–๑๒๐ ตัวอักษร");
  return name;
}

/** Normalized scope plan for one account type. Every account needs a sender department (D216). */
function accessOf(input: AccessInput) {
  requireCondition(input && TYPE_CODES.includes(input.typeCode), "INVALID_TYPE", "กรุณาเลือกประเภทบัญชี");
  const departmentId = optionalId(input.departmentId), branchId = optionalId(input.branchId), warehouseId = optionalId(input.warehouseId), driverId = optionalId(input.driverId);
  requireCondition(departmentId, "SCOPE_REQUIRED", "กรุณาเลือกแผนกต้นสังกัด");
  const type = input.typeCode;
  if (type === "BRANCH_RECEIVER") requireCondition(branchId, "SCOPE_REQUIRED", "พนักงานสาขาต้องเลือกสาขาที่ประจำ");
  if (type === "WAREHOUSE") requireCondition(warehouseId || driverId, "SCOPE_REQUIRED", "คลังและรถขนส่งต้องเลือกคลังที่ประจำ หรือคนขับ หรือทั้งสองอย่าง");
  return {
    type, departmentId,
    branchId: type === "BRANCH_RECEIVER" ? branchId : null,
    warehouseId: type === "WAREHOUSE" ? warehouseId : null,
    driverId: type === "WAREHOUSE" ? driverId : null,
    global: GLOBAL_TYPES.includes(type),
  };
}
type Access = ReturnType<typeof accessOf>;

/** A branch people can still be assigned to: a delivery branch, not archived and not past its end date. */
const openBranch = () => ({ archived: false, destinationType: "BRANCH" as const, OR: [{ activeTo: null }, { activeTo: { gte: new Date(`${bangkokServiceDate()}T00:00:00Z`) } }] });

async function requireActiveReferences(tx: Transaction, a: Access) {
  requireCondition((await tx.department.findUnique({ where: { id: a.departmentId } }))?.active, "INACTIVE_REFERENCE", "แผนกที่เลือกไม่พร้อมใช้งาน");
  if (a.branchId) requireCondition(await tx.branch.findFirst({ where: { id: a.branchId, ...openBranch() } }), "INACTIVE_REFERENCE", "สาขาที่เลือกปิดแล้วหรือไม่พร้อมใช้งาน");
  if (a.warehouseId) requireCondition((await tx.warehouse.findUnique({ where: { id: a.warehouseId } }))?.active, "INACTIVE_REFERENCE", "คลังที่เลือกไม่พร้อมใช้งาน");
  if (a.driverId) requireCondition((await tx.driver.findUnique({ where: { id: a.driverId } }))?.active, "INACTIVE_REFERENCE", "คนขับที่เลือกไม่พร้อมใช้งาน");
}

function scopeRows(userId: string, a: Access): Array<{ userId: string; kind: ScopeKind; branchId?: string; warehouseId?: string; driverId?: string; departmentId?: string }> {
  return [
    ...(a.global ? [{ userId, kind: "GLOBAL" as const }] : []),
    ...(a.branchId ? [{ userId, kind: "BRANCH" as const, branchId: a.branchId }] : []),
    ...(a.warehouseId ? [{ userId, kind: "WAREHOUSE" as const, warehouseId: a.warehouseId }] : []),
    ...(a.driverId ? [{ userId, kind: "DRIVER" as const, driverId: a.driverId }] : []),
    { userId, kind: "DEPARTMENT" as const, departmentId: a.departmentId },
  ];
}

/** Current access of one account in the same shape as the input, for forms, audit before/after and comparisons. */
async function accessSnapshot(tx: Transaction, userId: string) {
  const [roles, scopes] = await Promise.all([tx.userRole.findMany({ where: { userId }, include: { role: true } }), tx.userScope.findMany({ where: { userId } })]);
  const codes = roles.map((r) => r.role.code);
  return {
    typeCode: accountTypeOf(codes)?.code ?? "", roleCodes: codes.sort(),
    departmentId: scopes.find((s) => s.kind === "DEPARTMENT")?.departmentId ?? "",
    branchId: scopes.find((s) => s.kind === "BRANCH")?.branchId ?? "",
    warehouseId: scopes.find((s) => s.kind === "WAREHOUSE")?.warehouseId ?? "",
    driverId: scopes.find((s) => s.kind === "DRIVER")?.driverId ?? "",
    global: scopes.some((s) => s.kind === "GLOBAL"),
  };
}

async function writeAccess(tx: Transaction, userId: string, a: Access) {
  const role = await tx.role.findUniqueOrThrow({ where: { code: a.type } });
  await tx.userRole.deleteMany({ where: { userId } });
  await tx.userRole.create({ data: { userId, roleId: role.id } });
  await tx.userScope.deleteMany({ where: { userId } });
  await tx.userScope.createMany({ data: scopeRows(userId, a) });
}

/**
 * Every identity change first locks the User rows of all active administrators in id order and re-reads who is an
 * administrator under those locks, so an administrator demoted or disabled a moment ago cannot finish a change, and
 * two administrators cannot remove each other at the same time. The lock statement names only User: it runs on
 * MySQL and MariaDB alike and needs no lock privilege on Role for the runtime database account.
 */
async function lockAdministrators(tx: Transaction, actorId: string) {
  const administrators = async () => (await tx.$queryRaw<Array<{ id: string }>>`
    SELECT u.id FROM User u JOIN UserRole ur ON ur.userId=u.id JOIN Role r ON r.id=ur.roleId
    WHERE r.code='ADMINISTRATOR' AND u.active=1 ORDER BY u.id`).map((a) => a.id);
  const candidates = await administrators();
  requireCondition(candidates.includes(actorId), "FORBIDDEN", "คุณไม่มีสิทธิ์จัดการผู้ใช้");
  await tx.$queryRaw`SELECT id FROM User WHERE id IN (${Prisma.join(candidates)}) ORDER BY id FOR UPDATE`;
  const admins = await administrators();
  requireCondition(admins.includes(actorId), "FORBIDDEN", "คุณไม่มีสิทธิ์จัดการผู้ใช้");
  return admins;
}
/** Refuses a change that would leave no active administrator. */
function keepAnAdministrator(admins: string[], targetId: string) {
  requireCondition(admins.some((a) => a !== targetId), "LAST_ADMINISTRATOR", "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย ๑ บัญชี");
}

async function lockUser(tx: Transaction, id: string, expectedVersion: number) {
  requireCondition(typeof id === "string" && idPattern.test(id), "NOT_FOUND", "ไม่พบบัญชีผู้ใช้");
  await tx.$queryRaw`SELECT id FROM User WHERE id=${id} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id } });
  requireCondition(user, "NOT_FOUND", "ไม่พบบัญชีผู้ใช้");
  versionMatches(user.version, expectedVersion);
  return user;
}

// Readable, unambiguous temporary passwords: 3 groups of 4 from 31 characters (about 59 bits).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function temporaryPassword() {
  return Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
}

// ------------------------------------------------------------------------------------------------ reads

export async function userFormOptions(db: PrismaClient, actorId: string) {
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, actorId);
    const [departments, branches, warehouses, drivers] = await Promise.all([
      tx.department.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      tx.branch.findMany({ where: openBranch(), orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      tx.warehouse.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      tx.driver.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    ]);
    return { departments, branches, warehouses, drivers };
  }, { isolationLevel: "RepeatableRead" });
}
export type UserFormOptions = Awaited<ReturnType<typeof userFormOptions>>;

export interface UserFilter { q?: string; type?: string; status?: string; page?: number }
export async function listUsers(db: PrismaClient, actorId: string, filter: UserFilter) {
  const q = text(filter.q, 100), status = ["active", "inactive", "all"].includes(filter.status ?? "") ? filter.status! : "active";
  const type = TYPE_CODES.includes(filter.type ?? "") ? filter.type! : "";
  const page = Number.isInteger(filter.page) && filter.page! >= 1 && filter.page! <= 10_000 ? filter.page! : 1;
  requireCondition(q.length <= 100, "INVALID_SEARCH", "คำค้นยาวเกินไป");
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, actorId);
    const users = await tx.user.findMany({
      where: { ...(status === "all" ? {} : { active: status === "active" }), ...(q ? { OR: [{ displayName: { contains: q } }, { email: { contains: q.toLowerCase() } }] } : {}) },
      orderBy: [{ active: "desc" }, { displayName: "asc" }, { id: "asc" }],
      include: { userRole_userId: { include: { role: true } }, userScope_userId: { include: { branch: true, warehouse: true, driver: true, department: true } } },
    });
    // Account types are derived from role codes (retired codes fold in), so the type filter runs here.
    const rows = users.map((u) => {
      const t = accountTypeOf(u.userRole_userId.map((r) => r.role.code)), s = u.userScope_userId;
      const where = s.some((x) => x.kind === "GLOBAL") ? "ทั้งบริษัท" : [
        ...s.filter((x) => x.kind === "BRANCH").map((x) => `สาขา ${x.branch?.name ?? "-"}`),
        ...s.filter((x) => x.kind === "WAREHOUSE").map((x) => `คลัง ${x.warehouse?.name ?? "-"}`),
        ...s.filter((x) => x.kind === "DRIVER").map((x) => `คนขับ ${x.driver?.name ?? "-"}`),
      ].join(", ");
      const department = s.find((x) => x.kind === "DEPARTMENT")?.department?.name ?? "";
      // A department-only account (พนักงานทั่วไป) shows its department as the scope instead of a dash.
      return { id: u.id, name: u.displayName, email: u.email ?? "", active: u.active, typeCode: t?.code ?? "", typeName: t?.name ?? "ยังไม่กำหนดประเภท",
        where: where || (department ? `แผนก ${department}` : "-"), department: where ? department : "" };
    });
    const counts = Object.fromEntries(TYPE_CODES.map((c) => [c, rows.filter((r) => r.typeCode === c).length]));
    const filtered = type ? rows.filter((r) => r.typeCode === type) : rows;
    return { rows: filtered.slice((page - 1) * PAGE, page * PAGE), total: filtered.length, page, pageSize: PAGE, counts, filter: { q, type, status } };
  }, { isolationLevel: "RepeatableRead" });
}

const ACTION_TEXT: Record<string, string> = {
  USER_CREATED: "สร้างบัญชี", USER_ACCESS_CHANGED: "เปลี่ยนชื่อ ประเภท หรือขอบเขต", USER_DEACTIVATED: "ปิดใช้งาน", USER_REACTIVATED: "เปิดใช้งานอีกครั้ง",
  USER_PASSWORD_RESET: "ออกรหัสผ่านชั่วคราวใหม่", PASSWORD_CHANGED: "ผู้ใช้เปลี่ยนรหัสผ่านเอง", PROFILE_UPDATED: "ผู้ใช้แก้ข้อมูลติดต่อ",
  LOCAL_ACCOUNT_PROVISIONED: "สร้างบัญชีโดยเครื่องมือผู้ดูแลเครื่อง", LOCAL_OPERATOR_ACCOUNT_TYPE_CONSOLIDATED: "ย้ายเป็นประเภทบัญชีใหม่ (D221)",
};
export async function userDetail(db: PrismaClient, actorId: string, id: string) {
  requireCondition(typeof id === "string" && idPattern.test(id), "NOT_FOUND", "ไม่พบบัญชีผู้ใช้");
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, actorId);
    const user = await tx.user.findUnique({ where: { id } });
    requireCondition(user, "NOT_FOUND", "ไม่พบบัญชีผู้ใช้");
    const access = await accessSnapshot(tx, id);
    const history = await tx.auditLog.findMany({ where: { entityType: "User", entityId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { displayName: true } } } });
    return {
      id: user.id, name: user.displayName, email: user.email ?? "", active: user.active, version: user.version, createdAt: user.createdAt.toISOString(), self: user.id === actorId,
      access, roleNames: [...new Set(access.roleCodes.map((c) => ROLE_NAMES[c] ?? c))],
      history: history.map((h) => ({ id: h.id, at: h.createdAt.toISOString(), action: ACTION_TEXT[h.action] ?? h.action, by: h.actor?.displayName ?? "-", reason: h.reason ?? "" })),
    };
  }, { isolationLevel: "RepeatableRead" });
}
export type UserDetail = Awaited<ReturnType<typeof userDetail>>;

// ----------------------------------------------------------------------------------------------- writes

/** Creates an account; the temporary password is returned once and never stored outside its hash. */
export async function createUser(db: PrismaClient, actorId: string, key: string, input: CreateUserInput) {
  const name = nameOf(input), email = text(input?.email, 191).toLowerCase(), access = accessOf(input);
  requireCondition(emailPattern.test(email) && email.length <= 191, "INVALID_EMAIL", "อีเมลไม่ถูกต้อง");
  const password = temporaryPassword(), hash = await hashPassword(password);
  let issued = false;
  const result = await guardedWrite(db, actorId, "user.create", key, { name, email, ...access }, async (tx, idem) => {
    await requireAdmin(tx, actorId);
    const prior = await replay<{ id: string; version: number }>(tx, idem); if (prior) return prior;
    await lockAdministrators(tx, actorId);
    requireCondition(!(await tx.user.findUnique({ where: { email } })), "DUPLICATE_ACCOUNT", "อีเมลนี้มีบัญชีอยู่แล้ว ค้นหาบัญชีเดิมแล้วแก้ไขแทน");
    await requireActiveReferences(tx, access);
    const id = randomUUID();
    await tx.user.create({ data: { id, email, displayName: name, subject: `local:${email}`, emailVerified: true } });
    await tx.authAccount.create({ data: { id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: hash } });
    await writeAccess(tx, id, access);
    await audit(tx, actorId, "USER_CREATED", "User", id, idem, { email, typeCode: access.type, ...scopeAudit(access) });
    issued = true;
    return { id, version: 1 };
  }).catch((error) => { throw uniqueEmail(error); });
  return { ...result, temporaryPassword: issued ? password : null };
}

export async function updateUser(db: PrismaClient, actorId: string, key: string, input: UpdateUserInput) {
  const name = nameOf(input), access = accessOf(input), reason = reasonOf(input);
  requireCondition(Number.isInteger(input?.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, "user.update", key, { id: input.id, expectedVersion: input.expectedVersion, name, ...access, reason }, async (tx, idem) => {
    await requireAdmin(tx, actorId);
    const prior = await replay<{ id: string; version: number }>(tx, idem); if (prior) return prior;
    const admins = await lockAdministrators(tx, actorId);
    const user = await lockUser(tx, input.id, input.expectedVersion), before = await accessSnapshot(tx, input.id);
    if (before.typeCode === "ADMINISTRATOR" && access.type !== "ADMINISTRATOR") {
      requireCondition(input.id !== actorId, "SELF_LOCKOUT", "เปลี่ยนประเภทบัญชีของตัวเองออกจากผู้ดูแลระบบไม่ได้ ให้ผู้ดูแลระบบคนอื่นดำเนินการ");
      keepAnAdministrator(admins, input.id);
    }
    await requireActiveReferences(tx, access);
    await writeAccess(tx, user.id, access);
    const saved = await tx.user.update({ where: { id: user.id }, data: { displayName: name, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId, action: "USER_ACCESS_CHANGED", entityType: "User", entityId: user.id, idempotencyId: idem, reason,
      before: { name: user.displayName, typeCode: before.typeCode, roleCodes: before.roleCodes, departmentId: before.departmentId, branchId: before.branchId, warehouseId: before.warehouseId, driverId: before.driverId, global: before.global },
      after: { name, typeCode: access.type, ...scopeAudit(access) } } });
    return { id: user.id, version: saved.version };
  });
}

/** Disabling blocks sign-in (session hook and every request check) and ends all sessions; history is kept. */
export async function setUserActive(db: PrismaClient, actorId: string, key: string, input: UserStateInput & { active: boolean }) {
  const reason = reasonOf(input);
  requireCondition(typeof input?.active === "boolean" && Number.isInteger(input?.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  return guardedWrite(db, actorId, input.active ? "user.reactivate" : "user.deactivate", key, { id: input.id, expectedVersion: input.expectedVersion, active: input.active, reason }, async (tx, idem) => {
    await requireAdmin(tx, actorId);
    const prior = await replay<{ id: string; version: number; active: boolean }>(tx, idem); if (prior) return prior;
    const admins = await lockAdministrators(tx, actorId);
    if (!input.active) {
      requireCondition(input.id !== actorId, "SELF_LOCKOUT", "ปิดใช้งานบัญชีของตัวเองไม่ได้");
      if (admins.includes(input.id)) keepAnAdministrator(admins, input.id);
    }
    const user = await lockUser(tx, input.id, input.expectedVersion);
    requireCondition(user.active !== input.active, "NO_CHANGE", input.active ? "บัญชีนี้ใช้งานอยู่แล้ว" : "บัญชีนี้ปิดใช้งานอยู่แล้ว");
    const saved = await tx.user.update({ where: { id: user.id }, data: { active: input.active, version: { increment: 1 } } });
    const ended = input.active ? 0 : (await tx.authSession.deleteMany({ where: { userId: user.id } })).count;
    await tx.auditLog.create({ data: { actorId, action: input.active ? "USER_REACTIVATED" : "USER_DEACTIVATED", entityType: "User", entityId: user.id, idempotencyId: idem, reason,
      before: { active: user.active }, after: { active: input.active, sessionsEnded: ended } } });
    return { id: user.id, version: saved.version, active: saved.active };
  });
}

/** Issues a new temporary password and ends every session of that account; shown once to the administrator. */
export async function resetUserPassword(db: PrismaClient, actorId: string, key: string, input: UserStateInput) {
  const reason = reasonOf(input);
  requireCondition(Number.isInteger(input?.expectedVersion), "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
  const password = temporaryPassword(), hash = await hashPassword(password);
  let issued = false;
  const result = await guardedWrite(db, actorId, "user.resetPassword", key, { id: input.id, expectedVersion: input.expectedVersion, reason }, async (tx, idem) => {
    await requireAdmin(tx, actorId);
    const prior = await replay<{ id: string; version: number }>(tx, idem); if (prior) return prior;
    requireCondition(input.id !== actorId, "SELF_RESET", "เปลี่ยนรหัสผ่านของตัวเองที่หน้า “บัญชีของฉัน”");
    await lockAdministrators(tx, actorId);
    const user = await lockUser(tx, input.id, input.expectedVersion);
    requireCondition(user.active, "INACTIVE_ACCOUNT", "เปิดใช้งานบัญชีก่อนออกรหัสผ่านใหม่");
    const updated = await tx.authAccount.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password: hash } });
    if (!updated.count) await tx.authAccount.create({ data: { id: randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: hash } });
    const ended = (await tx.authSession.deleteMany({ where: { userId: user.id } })).count;
    const saved = await tx.user.update({ where: { id: user.id }, data: { version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId, action: "USER_PASSWORD_RESET", entityType: "User", entityId: user.id, idempotencyId: idem, reason, after: { sessionsEnded: ended } } });
    issued = true;
    return { id: user.id, version: saved.version };
  });
  return { ...result, temporaryPassword: issued ? password : null };
}

function scopeAudit(a: Access) {
  return { departmentId: a.departmentId, branchId: a.branchId, warehouseId: a.warehouseId, driverId: a.driverId, global: a.global };
}
function uniqueEmail(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? new DomainError("DUPLICATE_ACCOUNT", "อีเมลนี้มีบัญชีอยู่แล้ว ค้นหาบัญชีเดิมแล้วแก้ไขแทน") : error;
}
