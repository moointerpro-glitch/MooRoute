import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient, ScopeKind } from "../../generated/prisma/client";
import { requireCondition } from "../domain/errors";
import { rolePermissions } from "./permissions";

/** Operator-only provisioning. Never imported by a request handler. */
export async function provisionAccount(db:PrismaClient,input:{email:string;name:string;password:string;role:string;scope:ScopeKind;scopeId?:string}){
  requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)&&input.password.length>=12&&input.password.length<=128&&!!rolePermissions[input.role],"INVALID_ACCOUNT","ข้อมูลบัญชีไม่ถูกต้อง");
  const password=await hashPassword(input.password);
  return db.$transaction(async tx=>{
    const role=await tx.role.findUniqueOrThrow({where:{code:input.role}});
    const user=await tx.user.create({data:{id:randomUUID(),email:input.email.toLowerCase(),displayName:input.name,subject:`local:${input.email.toLowerCase()}`,emailVerified:true}});
    await tx.authAccount.create({data:{id:randomUUID(),userId:user.id,accountId:user.id,providerId:"credential",password}});
    await tx.userRole.create({data:{userId:user.id,roleId:role.id}});
    await tx.userScope.create({data:{userId:user.id,kind:input.scope,...(input.scope==="BRANCH"?{branchId:input.scopeId}:input.scope==="WAREHOUSE"?{warehouseId:input.scopeId}:input.scope==="DEPARTMENT"?{departmentId:input.scopeId}:input.scope==="DRIVER"?{driverId:input.scopeId}:{})}});
    await tx.auditLog.create({data:{actorId:user.id,action:"LOCAL_ACCOUNT_PROVISIONED",entityType:"User",entityId:user.id,reason:"Local operator provisioning",after:{email:input.email,role:input.role,scope:input.scope,scopeId:input.scopeId??null}}});
    return user;
  });
}
