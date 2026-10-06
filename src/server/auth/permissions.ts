import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import type { Transaction } from "../services/transaction";
import { requireCondition } from "../domain/errors";

export const masterKinds = ["vehicles", "vehicle-types", "drivers", "branches", "product-categories", "storage-conditions", "consignment-categories", "warehouses", "departments"] as const;
export const rolePermissions: Record<string, string[]> = {
  REQUESTER: ["trip.read", "consignment.create", "consignment.read", "master.branches.read"],
  DISPATCHER: ["plan.read", "route.write", "template.write", "trip.read", "plan.write", "consignment.read", "consignment.assign", "label.issue", "label.print", "manifest.read", "import.manage", ...masterKinds.flatMap(k=>[`master.${k}.read`,`master.${k}.export`])],
  WAREHOUSE: ["consignment.read", "consignment.warehouse", "consignment.load", "label.issue", "label.print", "manifest.read", "master.consignment-categories.read"],
  DRIVER: ["trip.read", "trip.move", "consignment.read", "manifest.read", "master.drivers.read"],
  BRANCH_RECEIVER: ["trip.read", "consignment.read", "consignment.receive", "master.branches.read"],
  SUPERVISOR: ["plan.read", "trip.read", "plan.publish", "consignment.read", "consignment.correct", "label.print", "manifest.read", ...masterKinds.flatMap(k=>[`master.${k}.read`,`master.${k}.export`])],
  ADMINISTRATOR: ["identity.manage", "import.manage", ...masterKinds.flatMap(k=>[`master.${k}.read`,`master.${k}.write`,`master.${k}.delete`,`master.${k}.export`])],
};
export async function installRoles(db: PrismaClient) {
  const names:Record<string,string>={REQUESTER:"ผู้ฝากส่ง",DISPATCHER:"ผู้จัดรถ",WAREHOUSE:"เจ้าหน้าที่คลัง",DRIVER:"พนักงานขับรถ",BRANCH_RECEIVER:"ผู้รับประจำสาขา",SUPERVISOR:"หัวหน้างาน",ADMINISTRATOR:"ผู้ดูแลระบบ"};
  await db.$transaction(async tx=>{
    for(const [code,permissions] of Object.entries(rolePermissions)) {
      const role=await tx.role.upsert({where:{code},create:{code,name:names[code]},update:{}});
      for(const code of permissions){const p=await tx.permission.upsert({where:{code},create:{code},update:{}});await tx.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:p.id}},create:{roleId:role.id,permissionId:p.id},update:{}});}
    }
  });
}
export async function principal(tx: Transaction, actorId: string) {
  const user=await tx.user.findUnique({where:{id:actorId}});
  requireCondition(user?.active,"FORBIDDEN","คุณไม่มีสิทธิ์ดำเนินการนี้");
  const permissions=await tx.$queryRaw<Array<{code:string}>>`SELECT DISTINCT p.code FROM UserRole ur JOIN RolePermission rp ON rp.roleId=ur.roleId JOIN Permission p ON p.id=rp.permissionId WHERE ur.userId=${actorId}`;
  const scopes=await tx.userScope.findMany({where:{userId:actorId}});
  return {user, permissions:new Set(permissions.map(p=>p.code)),scopes,global:scopes.some(s=>s.kind==="GLOBAL")};
}
export type Principal=Awaited<ReturnType<typeof principal>>;
export function requireCapability(p:Principal,code:string) { requireCondition(p.permissions.has(code),"FORBIDDEN","คุณไม่มีสิทธิ์ดำเนินการนี้"); }
