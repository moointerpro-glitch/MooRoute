import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient, ScopeKind } from "../../generated/prisma/client";
import { requireCondition } from "../domain/errors";
import { retiredRoles, rolePermissions } from "./permissions";

/** Operator-only provisioning. Never imported by a request handler. A retired role code is given as the D221 type that absorbed it. */
export async function provisionAccount(db:PrismaClient,input:{email:string;name:string;password:string;role:string;scope:ScopeKind;scopeId?:string;departmentId?:string}){
  requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)&&input.password.length>=12&&input.password.length<=128&&!!rolePermissions[input.role],"INVALID_ACCOUNT","ข้อมูลบัญชีไม่ถูกต้อง");
  const password=await hashPassword(input.password), roleCode=retiredRoles[input.role]??input.role;
  return db.$transaction(async tx=>{
    if (input.departmentId) requireCondition((await tx.department.findUnique({where:{id:input.departmentId}}))?.active,"INACTIVE_REFERENCE","แผนกไม่พร้อมใช้งาน");
    const role=await tx.role.findUniqueOrThrow({where:{code:roleCode}});
    const user=await tx.user.create({data:{id:randomUUID(),email:input.email.toLowerCase(),displayName:input.name,subject:`local:${input.email.toLowerCase()}`,emailVerified:true}});
    await tx.authAccount.create({data:{id:randomUUID(),userId:user.id,accountId:user.id,providerId:"credential",password}});
    await tx.userRole.create({data:{userId:user.id,roleId:role.id}});
    await tx.userScope.create({data:{userId:user.id,kind:input.scope,...(input.scope==="BRANCH"?{branchId:input.scopeId}:input.scope==="WAREHOUSE"?{warehouseId:input.scopeId}:input.scope==="DEPARTMENT"?{departmentId:input.scopeId}:input.scope==="DRIVER"?{driverId:input.scopeId}:{})}});
    if(input.departmentId && !(input.scope==="DEPARTMENT" && input.scopeId===input.departmentId)) await tx.userScope.create({data:{userId:user.id,kind:"DEPARTMENT",departmentId:input.departmentId}});
    await tx.auditLog.create({data:{actorId:user.id,action:"LOCAL_ACCOUNT_PROVISIONED",entityType:"User",entityId:user.id,reason:"Local operator provisioning",after:{email:input.email,role:roleCode,...(roleCode!==input.role?{requestedRole:input.role}:{}),scope:input.scope,scopeId:input.scopeId??null,departmentId:input.departmentId??(input.scope==="DEPARTMENT"?input.scopeId:null)}}});
    return user;
  });
}

/** Explicit operator assignment; adding a sender department grants no movement or receipt capability. */
export async function assignAccountDepartment(db: PrismaClient, email: string, departmentId: string, reason: string) {
  requireCondition(typeof email === "string" && typeof departmentId === "string" && typeof reason === "string" && reason.trim().length >= 3,
    "INVALID_ACCOUNT", "กรุณาระบุบัญชี แผนก และเหตุผลให้ครบ");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email: email.toLowerCase() } });
    requireCondition(user?.active, "INVALID_ACCOUNT", "บัญชีไม่พร้อมใช้งาน");
    await tx.$queryRaw`SELECT id FROM User WHERE id=${user.id} FOR UPDATE`;
    requireCondition((await tx.department.findUnique({ where: { id: departmentId } }))?.active, "INACTIVE_REFERENCE", "แผนกไม่พร้อมใช้งาน");
    if (await tx.userScope.findFirst({ where: { userId: user.id, kind: "DEPARTMENT", departmentId } })) return user.id;
    await tx.userScope.create({ data: { userId: user.id, kind: "DEPARTMENT", departmentId } });
    await tx.user.update({ where: { id: user.id }, data: { version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "LOCAL_OPERATOR_DEPARTMENT_ASSIGNED", entityType: "User", entityId: user.id,
      reason, after: { departmentId, operatorTooling: true } } });
    return user.id;
  });
}

/**
 * D221 operator step: an account holding a retired role code is moved to the type that absorbed it.
 * Capabilities are identical before and after; the audit log keeps the previous assignment.
 */
export async function consolidateRetiredRoles(db: PrismaClient, reason: string) {
  requireCondition(typeof reason === "string" && reason.trim().length >= 3, "INVALID_ACCOUNT", "กรุณาระบุเหตุผล");
  const moved: string[] = [];
  for (const [retired, into] of Object.entries(retiredRoles)) {
    const holders = await db.userRole.findMany({ where: { role: { code: retired } }, select: { userId: true } });
    for (const { userId } of holders) await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM User WHERE id=${userId} FOR UPDATE`;
      const [from, to] = await Promise.all([tx.role.findUniqueOrThrow({ where: { code: retired } }), tx.role.findUniqueOrThrow({ where: { code: into } })]);
      const held = await tx.userRole.findUnique({ where: { userId_roleId: { userId, roleId: from.id } } });
      if (!held) return;
      await tx.userRole.upsert({ where: { userId_roleId: { userId, roleId: to.id } }, create: { userId, roleId: to.id }, update: {} });
      await tx.userRole.delete({ where: { id: held.id } });
      await tx.user.update({ where: { id: userId }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: userId, action: "LOCAL_OPERATOR_ACCOUNT_TYPE_CONSOLIDATED", entityType: "User", entityId: userId, reason,
        before: { role: retired }, after: { role: into, operatorTooling: true } } });
      moved.push(userId);
    });
  }
  return moved.length;
}
