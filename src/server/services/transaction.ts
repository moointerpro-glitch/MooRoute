import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { DomainError, requireCondition } from "../domain/errors";

export type Transaction = Prisma.TransactionClient;
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}
export const fingerprint = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

export async function authorize(tx: Transaction, actorId: string, permission: string, scope?: { branchId?: string; warehouseId?: string; departmentId?: string; driverId?:string }) {
  const users = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT u.id FROM User u JOIN UserRole ur ON ur.userId=u.id
    JOIN RolePermission rp ON rp.roleId=ur.roleId JOIN Permission p ON p.id=rp.permissionId
    WHERE u.id=${actorId} AND u.active=1 AND p.code=${permission} LIMIT 1`;
  requireCondition(users.length, "FORBIDDEN", "คุณไม่มีสิทธิ์ดำเนินการนี้");
  // D235: the administrator is not limited by row scope.
  const admin = await tx.$queryRaw<Array<{ id: string }>>`SELECT ur.id FROM UserRole ur JOIN Role r ON r.id=ur.roleId WHERE ur.userId=${actorId} AND r.code='ADMINISTRATOR' LIMIT 1`;
  if (admin.length) return;
  const scopes = await tx.userScope.findMany({ where: { userId: actorId } });
  requireCondition(scopes.some((s) => s.kind === "GLOBAL" || (scope && (
    (s.kind === "BRANCH" && !!scope.branchId && s.branchId === scope.branchId) ||
    (s.kind === "WAREHOUSE" && !!scope.warehouseId && s.warehouseId === scope.warehouseId) ||
    (s.kind === "DEPARTMENT" && !!scope.departmentId && s.departmentId === scope.departmentId) ||
    (s.kind === "DRIVER" && !!scope.driverId && s.driverId === scope.driverId)
  ))), "FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้");
}
export async function guardedWrite<T extends Prisma.InputJsonObject>(
  db: PrismaClient, actorId: string, operation: string, key: string, payload: unknown,
  run: (tx: Transaction, idempotencyId: string) => Promise<T>,
): Promise<T> {
  requireCondition(typeof key === "string" && /^[A-Za-z0-9:_-]{1,100}$/.test(key), "INVALID_KEY", "รหัสคำขอไม่ถูกต้อง");
  const hash = fingerprint(payload);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // Authorization still runs on replay; revoked users cannot recover protected results.
        const user = await tx.user.findUnique({ where: { id: actorId } });
        requireCondition(user?.active, "FORBIDDEN", "คุณไม่มีสิทธิ์ดำเนินการนี้");
        await tx.$executeRaw`INSERT INTO IdempotencyRecord (id, actorId, operation, \`key\`, requestHash)
          VALUES (${randomUUID()}, ${actorId}, ${operation}, ${key}, ${hash})
          ON DUPLICATE KEY UPDATE id=id`;
        const rows = await tx.$queryRaw<Array<{ id: string; requestHash: string }>>`
          SELECT id, requestHash FROM IdempotencyRecord WHERE actorId=${actorId} AND operation=${operation} AND \`key\`=${key} FOR UPDATE`;
        const record = await tx.idempotencyRecord.findUniqueOrThrow({ where: { id: rows[0].id } });
        requireCondition(record.requestHash === hash, "IDEMPOTENCY_CONFLICT", "รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว");
        // Each callback resolves permission before returning the prior response.
        return await runWithReplay(tx, record, () => run(tx, record.id));
      }, { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 20_000 });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      const retry = error instanceof Prisma.PrismaClientKnownRequestError &&
        (["P2034", "P2002"].includes(error.code) ||
          (error.code === "P2010" && /\b(1213|40001|deadlock)\b/i.test(JSON.stringify(error.meta))));
      if (!retry || attempt === 2) throw error;
    }
  }
  throw new DomainError("RETRY_REQUIRED", "กรุณาลองอีกครั้ง");
}

// Replay is checked explicitly by the service after authorization, using this transaction-local record.
async function runWithReplay<T extends Prisma.InputJsonObject>(tx: Transaction, record: { id: string }, run: () => Promise<T>) {
  const result = await run();
  await tx.idempotencyRecord.update({ where: { id: record.id }, data: { response: result } });
  return result;
}
export async function replay<T>(tx: Transaction, id: string): Promise<T | null> {
  const row = await tx.idempotencyRecord.findUniqueOrThrow({ where: { id } });
  return row.response as T | null;
}
export async function audit(tx: Transaction, actorId: string, action: string, entityType: string, entityId: string, idempotencyId: string, after: Prisma.InputJsonObject) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, idempotencyId, after } });
}
export async function lockEligibility(tx: Transaction) {
  await tx.$queryRaw`SELECT id FROM EligibilityGuard WHERE \`key\`='GLOBAL' FOR UPDATE`;
  return tx.eligibilityGuard.findUniqueOrThrow({ where: { key: "GLOBAL" } });
}
export async function lockPlan(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM DailyPlan WHERE id=${id} FOR UPDATE`;
  const plan = await tx.dailyPlan.findUnique({ where: { id } });
  requireCondition(plan, "NOT_FOUND", "ไม่พบแผนที่ต้องการ");
  return plan;
}
export async function lockVehicles(tx: Transaction, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM Vehicle WHERE id=${id} FOR UPDATE`;
}
