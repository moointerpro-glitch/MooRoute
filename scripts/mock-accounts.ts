import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient, ScopeKind } from "../src/generated/prisma/client";
import { assignAccountDepartment, provisionAccount } from "../src/server/auth/provision";
import { ROLE_NAMES } from "../src/lib/account-display";

/**
 * MOCK-UP accounts for moointer_dev, one source for seeding, the development reset and access sync (D224).
 * Every name is fictitious and marked ทดสอบ. Two planners exist so a planner's own consignment request can be
 * reviewed by the other (D216); the warehouse-and-vehicle type has one warehouse worker and one driver.
 * Passwords are written only to the ignored login file below and never printed.
 */
export const MOCK_LOGIN_FILE = ".local/auth/mockup-logins.txt";
type MasterKind = "warehouses" | "drivers" | "branches" | "departments";
export interface MockAccount { key: string; email: string; name: string; role: string; scope: ScopeKind; scopeCode?: string; department: string; note?: string }

export const MOCK_ACCOUNTS: readonly MockAccount[] = [
  { key: "admin", email: "demo.admin@moointer.test", name: "อรทัย ใจดี (ทดสอบ)", role: "ADMINISTRATOR", scope: "GLOBAL", department: "DEP-OPS" },
  { key: "planner1", email: "demo.planner1@moointer.test", name: "ปกรณ์ วางแผน (ทดสอบ)", role: "DISPATCHER", scope: "GLOBAL", department: "DEP-OPS" },
  { key: "planner2", email: "demo.planner2@moointer.test", name: "นภา จัดรถ (ทดสอบ)", role: "DISPATCHER", scope: "GLOBAL", department: "DEP-OPS", note: "คนที่สอง ใช้ตรวจคำขอที่ผู้วางแผนคนแรกสร้าง" },
  { key: "warehouse", email: "demo.warehouse@moointer.test", name: "วิชัย คลังกลาง (ทดสอบ)", role: "WAREHOUSE", scope: "WAREHOUSE", scopeCode: "WH-T01", department: "DEP-OPS" },
  { key: "driver", email: "demo.driver@moointer.test", name: "สมชาย ขับดี (ทดสอบ)", role: "WAREHOUSE", scope: "DRIVER", scopeCode: "DRV-T01", department: "DEP-OPS", note: "คนขับ" },
  { key: "branch", email: "demo.branch@moointer.test", name: "มาลี สันทราย (ทดสอบ)", role: "BRANCH_RECEIVER", scope: "BRANCH", scopeCode: "BR-T01", department: "DEP-OPS" },
  { key: "staff", email: "demo.staff@moointer.test", name: "กมล การตลาด (ทดสอบ)", role: "REQUESTER", scope: "DEPARTMENT", scopeCode: "DEP-MKT", department: "DEP-MKT" },
];
const scopeKind: Partial<Record<ScopeKind, MasterKind>> = { WAREHOUSE: "warehouses", DRIVER: "drivers", BRANCH: "branches", DEPARTMENT: "departments" };

async function masterByCode(db: PrismaClient, kind: MasterKind, code: string) {
  const where = { where: { code }, select: { id: true, name: true } } as const;
  return kind === "warehouses" ? db.warehouse.findUnique(where) : kind === "drivers" ? db.driver.findUnique(where) : kind === "branches" ? db.branch.findUnique(where) : db.department.findUnique(where);
}

function readLogins() {
  const logins = new Map<string, string>();
  if (existsSync(MOCK_LOGIN_FILE)) for (const line of readFileSync(MOCK_LOGIN_FILE, "utf8").split(/\r?\n/)) { const m = line.match(/^(\S+@\S+)\t(\S+)$/); if (m) logins.set(m[1], m[2]); }
  return logins;
}
function writeLogins(logins: Map<string, string>, places: Map<string, string>) {
  mkdirSync(".local/auth", { recursive: true });
  writeFileSync(MOCK_LOGIN_FILE, [
    "LOCAL DEVELOPMENT ONLY — บัญชีทดสอบ mock up ของ moointer_dev (ห้ามใช้กับระบบจริง)", "เข้าสู่ระบบที่ http://127.0.0.1:3010/login · จำกัด 5 ครั้งต่อนาทีรวมทุกบัญชี", "",
    ...MOCK_ACCOUNTS.flatMap((a) => [`# ${ROLE_NAMES[a.role]}${a.note ? ` (${a.note})` : ""} — ${a.name} — ขอบเขต: ${places.get(a.key) ?? "-"}`,
      logins.has(a.email) ? `${a.email}\t${logins.get(a.email)}` : `${a.email}\t(ยังไม่ได้สร้าง)`, ""]),
  ].join("\n"), { mode: 0o600 });
}

/**
 * Creates missing mock accounts (or only the given keys) and assigns their departments when those exist.
 * An existing account keeps its recorded password; one without a recorded password gets a new one (audited).
 */
export async function ensureMockAccounts(db: PrismaClient, keys?: string[]) {
  const logins = readLogins(), places = new Map<string, string>(), ids: Record<string, string> = {};
  for (const a of MOCK_ACCOUNTS.filter((x) => !keys || keys.includes(x.key))) {
    const kind = scopeKind[a.scope], master = kind && a.scopeCode ? await masterByCode(db, kind, a.scopeCode) : null;
    if (kind && !master) throw new Error(`MOCK_MASTER_MISSING ${a.scopeCode}`);
    const department = await masterByCode(db, "departments", a.department);
    places.set(a.key, [a.scope === "GLOBAL" ? "ทั้งบริษัท" : `${master!.name} (${a.scopeCode})`, a.scope !== "DEPARTMENT" && department ? `แผนก ${department.name}` : ""].filter(Boolean).join(" · "));
    const existing = await db.user.findUnique({ where: { email: a.email } });
    if (existing && logins.has(a.email)) ids[a.key] = existing.id;
    else {
      const password = randomBytes(12).toString("base64url");
      if (existing) {
        const hash = await hashPassword(password);
        await db.$transaction(async (tx) => {
          await tx.authSession.deleteMany({ where: { userId: existing.id } });
          await tx.authAccount.updateMany({ where: { userId: existing.id, providerId: "credential" }, data: { password: hash } });
          await tx.auditLog.create({ data: { actorId: existing.id, action: "LOCAL_OPERATOR_PASSWORD_RESET", entityType: "User", entityId: existing.id, reason: "Mock-up seed: password not recorded", after: { sessionsRevoked: true } } });
        });
        ids[a.key] = existing.id;
      } else ids[a.key] = (await provisionAccount(db, { email: a.email, name: a.name, password, role: a.role, scope: a.scope, scopeId: master?.id, departmentId: department?.id })).id;
      // Written after every new password so an interrupted run never loses one.
      logins.set(a.email, password); writeLogins(logins, places);
    }
    if (department) await assignAccountDepartment(db, a.email, department.id, "D224: synthetic sender department for a mock account");
  }
  writeLogins(logins, places);
  return ids;
}
