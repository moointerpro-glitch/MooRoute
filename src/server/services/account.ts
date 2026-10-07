import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { principal } from "../auth/permissions";
import { requireCondition, versionMatches } from "../domain/errors";
import { phonePattern } from "../domain/consignment";
import { ROLE_NAMES, accountTypeOf, initialOf } from "../../lib/account-display";
import { audit, guardedWrite, replay, type Transaction } from "./transaction";

// Where the account works comes first; the sender department (needed to consign) comes last.
const scopeOrder = { GLOBAL: 0, BRANCH: 1, WAREHOUSE: 1, DRIVER: 1, DEPARTMENT: 2 } as const;

/** Who is signed in, in plain Thai: name, one account type and the data they act on (header, back office, account page). */
export async function accountSummary(tx: Transaction, actorId: string) {
  const p = await principal(tx, actorId);
  const codes = (await tx.userRole.findMany({ where: { userId: actorId }, include: { role: true } })).map((r) => r.role.code);
  const type = accountTypeOf(codes);
  const scopes = [...new Set(await Promise.all([...p.scopes].sort((a, b) => scopeOrder[a.kind] - scopeOrder[b.kind]).map(async (s) => s.kind === "GLOBAL" ? "ทั้งบริษัท"
    : s.kind === "BRANCH" && s.branchId ? `สาขา ${(await tx.branch.findUnique({ where: { id: s.branchId } }))?.name ?? "-"}`
    : s.kind === "WAREHOUSE" && s.warehouseId ? `คลัง ${(await tx.warehouse.findUnique({ where: { id: s.warehouseId } }))?.name ?? "-"}`
    : s.kind === "DEPARTMENT" && s.departmentId ? `แผนก ${(await tx.department.findUnique({ where: { id: s.departmentId } }))?.name ?? "-"}`
    : s.kind === "DRIVER" && s.driverId ? `รถที่ขับ: ${(await tx.driver.findUnique({ where: { id: s.driverId } }))?.name ?? "-"}` : "-")))];
  return { p, name: p.user.displayName, email: p.user.email ?? "", initial: initialOf(p.user.displayName),
    typeName: type?.name ?? "ผู้ใช้งาน", typeDoes: type?.does ?? "", roles: [...new Set(codes.map((c) => ROLE_NAMES[c] ?? c))], scopes };
}
export type AccountSummary = Omit<Awaited<ReturnType<typeof accountSummary>>, "p">;

export async function myAccount(db: PrismaClient, actorId: string) {
  return db.$transaction(async (tx) => {
    const { p: _p, ...summary } = await accountSummary(tx, actorId);
    void _p;
    const profile = await tx.userProfile.findUnique({ where: { userId: actorId } });
    const warehouses = await tx.warehouse.findMany({ where: { OR: [{ active: true }, ...(profile?.defaultWarehouseId ? [{ id: profile.defaultWarehouseId }] : [])] }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, active: true } });
    return { ...summary, phone: profile?.phone ?? "", defaultWarehouseId: profile?.defaultWarehouseId ?? "", version: profile?.version ?? 0, warehouses };
  }, { isolationLevel: "RepeatableRead" });
}
export type MyAccount = Awaited<ReturnType<typeof myAccount>>;

export interface ProfileInput { phone: string; defaultWarehouseId: string; expectedVersion: number }
/** Self-service contact details used as defaults when creating consignments. Role and scope are never editable here. */
export async function updateMyProfile(db: PrismaClient, actorId: string, key: string, input: ProfileInput) {
  requireCondition(input && typeof input.phone === "string" && typeof input.defaultWarehouseId === "string" && Number.isInteger(input.expectedVersion) && input.expectedVersion >= 0, "INVALID_INPUT", "ข้อมูลโปรไฟล์ไม่ถูกต้อง");
  const phone = input.phone.trim() || null, warehouseId = input.defaultWarehouseId.trim() || null;
  requireCondition(phone === null || phonePattern.test(phone), "INVALID_PHONE", "เบอร์ติดต่อไม่ถูกต้อง ใช้ตัวเลข 7–32 ตัว เช่น 081-234-5678");
  return guardedWrite(db, actorId, "account.profile", key, { phone, warehouseId, expectedVersion: input.expectedVersion }, async (tx, idem) => {
    await principal(tx, actorId);
    const prior = await replay<{ version: number }>(tx, idem); if (prior) return prior;
    if (warehouseId) requireCondition((await tx.warehouse.findUnique({ where: { id: warehouseId } }))?.active, "INACTIVE_REFERENCE", "คลังที่เลือกไม่พร้อมใช้งาน");
    await tx.$queryRaw`SELECT userId FROM UserProfile WHERE userId=${actorId} FOR UPDATE`;
    const before = await tx.userProfile.findUnique({ where: { userId: actorId } });
    versionMatches(before?.version ?? 0, input.expectedVersion);
    const saved = before
      ? await tx.userProfile.update({ where: { userId: actorId }, data: { phone, defaultWarehouseId: warehouseId, version: { increment: 1 } } })
      : await tx.userProfile.create({ data: { userId: actorId, phone, defaultWarehouseId: warehouseId } });
    await audit(tx, actorId, "PROFILE_UPDATED", "User", actorId, idem, { phoneSet: !!phone, defaultWarehouseId: warehouseId, version: saved.version });
    return { version: saved.version };
  });
}
