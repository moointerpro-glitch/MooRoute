import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import type { Transaction } from "../services/transaction";
import { requireCondition } from "../domain/errors";
import { RETIRED_ROLE_TYPES, ROLE_NAMES } from "../../lib/account-display";

export const masterKinds = ["vehicles", "vehicle-types", "drivers", "branches", "product-categories", "storage-conditions", "consignment-categories", "warehouses", "departments"] as const;
/**
 * D221: five account types replace the seven roles people had to choose from. Capability codes stay fine-grained
 * and every action still needs a matching scope (branch, warehouse, driver or company), so merging types never
 * widens whose records an account may touch. Role codes are kept so existing accounts and audit history stay valid:
 * WAREHOUSE absorbs DRIVER (คลังและรถขนส่ง) and DISPATCHER absorbs SUPERVISOR (ผู้วางแผนขนส่ง).
 */
const accountTypes: Record<string, string[]> = {
  REQUESTER: ["consignment.read.department", "trip.read", "consignment.create", "consignment.read", "master.branches.read"],
  BRANCH_RECEIVER: ["trip.read", "consignment.read", "consignment.receive", "master.branches.read"],
  WAREHOUSE: ["trip.read", "trip.move", "consignment.read", "consignment.warehouse", "consignment.load", "label.issue", "label.print", "manifest.read", "master.consignment-categories.read", "master.drivers.read"],
  DISPATCHER: ["plan.read", "route.write", "template.write", "trip.read", "plan.write", "plan.publish", "consignment.read", "consignment.assign", "consignment.correct", "label.issue", "label.print", "manifest.read", "import.manage", ...masterKinds.flatMap(k=>[`master.${k}.read`,`master.${k}.export`])],
};
/** Retired role codes (D221) keep the capabilities of the type that absorbed them and are never given to new accounts. */
export const retiredRoles = RETIRED_ROLE_TYPES;
const operationalRoles: Record<string, string[]> = { ...accountTypes, ...Object.fromEntries(Object.entries(retiredRoles).map(([code, into]) => [code, accountTypes[into]])) };
/**
 * Owner decision D215: the administrator can do and see everything — every capability of every other role,
 * full master maintenance, and access to other users' consignment drafts. It is derived from the
 * other roles, so a capability added to any role reaches the administrator automatically.
 * D235 removes the remaining limits: the administrator may also edit, submit or cancel another person's
 * request and may review a request they created themselves (see `principal().admin`).
 */
export const rolePermissions: Record<string, string[]> = {
  ...Object.fromEntries(Object.entries(operationalRoles).map(([role, capabilities]) => [role, [...new Set([...capabilities, "trip.read.company", "trip.read", "consignment.create", "consignment.read"])]])),
  ADMINISTRATOR: [...new Set([...Object.values(operationalRoles).flat(), "trip.read.company", "identity.manage", "consignment.read.drafts",
    ...masterKinds.flatMap(k=>[`master.${k}.read`,`master.${k}.write`,`master.${k}.delete`,`master.${k}.export`])])],
};
/** Additive: creates missing roles and grants; never revokes a grant. Role names follow the D221 account types. */
export async function installRoles(db: PrismaClient) {
  await db.$transaction(async tx=>{
    for(const [code,permissions] of Object.entries(rolePermissions)) {
      const name=ROLE_NAMES[code];
      const role=await tx.role.upsert({where:{code},create:{code,name},update:{name}});
      for(const code of permissions){const p=await tx.permission.upsert({where:{code},create:{code},update:{}});await tx.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:p.id}},create:{roleId:role.id,permissionId:p.id},update:{}});}
    }
  });
}
/** D235: true for an account holding the ADMINISTRATOR type. Shared by every scope check so the rule lives in one place. */
export async function isAdministrator(tx: Transaction, actorId: string) {
  return (await tx.$queryRaw<Array<{id:string}>>`SELECT ur.id FROM UserRole ur JOIN Role r ON r.id=ur.roleId WHERE ur.userId=${actorId} AND r.code='ADMINISTRATOR' LIMIT 1`).length>0;
}
export async function principal(tx: Transaction, actorId: string) {
  const user=await tx.user.findUnique({where:{id:actorId}});
  requireCondition(user?.active,"FORBIDDEN","คุณไม่มีสิทธิ์ดำเนินการนี้");
  const permissions=await tx.$queryRaw<Array<{code:string}>>`SELECT DISTINCT p.code FROM UserRole ur JOIN RolePermission rp ON rp.roleId=ur.roleId JOIN Permission p ON p.id=rp.permissionId WHERE ur.userId=${actorId}`;
  const scopes=await tx.userScope.findMany({where:{userId:actorId}});
  // D235: the administrator is never limited by row scope or by ownership of a request.
  const admin=await isAdministrator(tx,actorId);
  return {user, permissions:new Set(permissions.map(p=>p.code)),scopes,admin,global:admin||scopes.some(s=>s.kind==="GLOBAL")};
}
export type Principal=Awaited<ReturnType<typeof principal>>;
export function requireCapability(p:Principal,code:string) { requireCondition(p.permissions.has(code),"FORBIDDEN","คุณไม่มีสิทธิ์ดำเนินการนี้"); }
