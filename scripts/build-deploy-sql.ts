import { createHash, randomInt, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "better-auth/crypto";
import { rolePermissions } from "../src/server/auth/permissions";
import { ROLE_NAMES } from "../src/lib/account-display";

/**
 * D227 installation files for a hosted database that is loaded through phpMyAdmin instead of `prisma migrate deploy`.
 * Output (ignored by Git): .local/deploy/sql/
 *   1_schema_mysql8.sql    every reviewed migration in order, exactly as written, for MySQL 8.x
 *   1_schema_mariadb.sql   the same statements with the MySQL-8-only collation replaced, for MariaDB
 *   2_first_administrator.sql  one administrator account with a random temporary password (see first-administrator.txt)
 * The schema files are built from prisma/migrations, not from a dump: migration files carry the exact table-name
 * case that the application uses, which matters on Linux hosts where table names are case-sensitive.
 * Trigger bodies are wrapped in DELIMITER blocks so phpMyAdmin and the mysql client run them as single statements.
 * Each file also records the migrations as applied and installs the account types and their capabilities.
 */
const OUT = ".local/deploy/sql", MIGRATIONS = "prisma/migrations";

/** Splits a migration into statements; a trigger with BEGIN ... END stays one statement. */
function statements(sql: string) {
  const out: string[] = [];
  let current: string[] = [];
  for (const raw of sql.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!current.length && (line.trim() === "" || line.trim().startsWith("--"))) continue;
    current.push(line);
    const text = current.join("\n"), block = /^\s*CREATE\s+TRIGGER[\s\S]*?FOR\s+EACH\s+ROW\s+BEGIN\b/i.test(text);
    const waitingForBegin = /^\s*CREATE\s+TRIGGER/i.test(text) && /FOR\s+EACH\s+ROW\s*$/i.test(text.trim());
    if (waitingForBegin) continue;
    if (block ? /\bEND;\s*$/.test(line) && !/\bEND\s+(IF|CASE|LOOP|WHILE|REPEAT);\s*$/i.test(line) : line.endsWith(";")) { out.push(text); current = []; }
  }
  if (current.join("").trim()) throw new Error("UNTERMINATED_STATEMENT");
  return out;
}
const isBlock = (statement: string) => /FOR\s+EACH\s+ROW\s+BEGIN\b/i.test(statement);
const render = (statement: string) => isBlock(statement) ? `DELIMITER $$\n${statement.replace(/;\s*$/, "")}$$\nDELIMITER ;` : statement;
const quote = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;

const migrations = readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const body: string[] = [];
let triggers = 0, tables = 0;
for (const name of migrations) {
  const sql = readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"), list = statements(sql);
  triggers += list.filter((s) => /^\s*CREATE\s+TRIGGER/i.test(s)).length - list.filter((s) => /^\s*DROP\s+TRIGGER/i.test(s)).length;
  tables += list.filter((s) => /^\s*CREATE\s+TABLE/i.test(s)).length;
  body.push(`-- ---------------------------------------------------------------- migration ${name}`, ...list.map(render), "");
}

// The migrations are recorded as applied with the checksums Prisma computes (SHA-256 of each file), so a later
// `prisma migrate deploy` from a proper deployment pipeline continues from here instead of starting again.
const migrationRows = migrations.map((name, index) => {
  const checksum = createHash("sha256").update(readFileSync(join(MIGRATIONS, name, "migration.sql"))).digest("hex");
  return `(${quote(createHash("sha256").update(`moointer:${name}`).digest("hex").slice(0, 36))}, ${quote(checksum)}, UTC_TIMESTAMP(3), ${quote(name)}, NULL, NULL, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${index} SECOND), 1)`;
});
const migrationTable = [
  "-- ---------------------------------------------------------------- migration history",
  "CREATE TABLE `_prisma_migrations` (\n  `id` VARCHAR(36) NOT NULL,\n  `checksum` VARCHAR(64) NOT NULL,\n  `finished_at` DATETIME(3) NULL,\n  `migration_name` VARCHAR(255) NOT NULL,\n  `logs` TEXT NULL,\n  `rolled_back_at` DATETIME(3) NULL,\n  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n  `applied_steps_count` INT UNSIGNED NOT NULL DEFAULT 0,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
  `INSERT INTO \`_prisma_migrations\` (\`id\`, \`checksum\`, \`finished_at\`, \`migration_name\`, \`logs\`, \`rolled_back_at\`, \`started_at\`, \`applied_steps_count\`) VALUES\n  ${migrationRows.join(",\n  ")};`, "",
];

// Account types and capabilities (the same set installRoles() writes). Stable ids keep the file repeatable.
const id = (kind: string, code: string) => createHash("sha256").update(`moointer:${kind}:${code}`).digest("hex").slice(0, 36);
const permissionCodes = [...new Set(Object.values(rolePermissions).flat())].sort();
const access = [
  "-- ---------------------------------------------------------------- account types and capabilities",
  `INSERT INTO \`Role\` (\`id\`, \`code\`, \`name\`) VALUES\n  ${Object.keys(rolePermissions).sort().map((code) => `(${quote(id("role", code))}, ${quote(code)}, ${quote(ROLE_NAMES[code])})`).join(",\n  ")};`,
  `INSERT INTO \`Permission\` (\`id\`, \`code\`) VALUES\n  ${permissionCodes.map((code) => `(${quote(id("permission", code))}, ${quote(code)})`).join(",\n  ")};`,
  `INSERT INTO \`RolePermission\` (\`id\`, \`roleId\`, \`permissionId\`) VALUES\n  ${Object.entries(rolePermissions).sort(([a], [b]) => a.localeCompare(b)).flatMap(([role, codes]) => [...new Set(codes)].sort().map((code) => `(${quote(id("grant", `${role}:${code}`))}, ${quote(id("role", role))}, ${quote(id("permission", code))})`)).join(",\n  ")};`, "",
];

const header = (engine: string) => [
  `-- ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์ (MooRoute) — โครงสร้างฐานข้อมูลสำหรับ ${engine}`,
  `-- สร้างจาก prisma/migrations ${migrations.length} ชุด: ${tables} ตาราง, ${triggers} trigger, พร้อมประเภทบัญชีและสิทธิ์`,
  "-- นำเข้าผ่าน phpMyAdmin ลงในฐานข้อมูลว่างที่เป็น utf8mb4 เท่านั้น ห้ามนำเข้าซ้ำในฐานข้อมูลที่มีตารางแล้ว",
  "-- ไม่มีบัญชีผู้ใช้และไม่มีข้อมูลทดสอบในไฟล์นี้ ให้นำเข้า 2_first_administrator.sql ต่อจากไฟล์นี้",
  "SET NAMES utf8mb4;", "SET time_zone = '+00:00';", "",
].join("\n");
const schema = [...body, ...migrationTable, ...access].join("\n");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "1_schema_mysql8.sql"), `${header("MySQL 8.x")}\n${schema}`, "utf8");
// MariaDB differences from MySQL 8, each found by importing into a real MariaDB server: MySQL 8's default
// collation is unknown before MariaDB 11.4, and a check constraint is dropped with DROP CONSTRAINT.
const mariadb = (sql: string) => sql.replace(/utf8mb4_0900_ai_ci/g, "utf8mb4_unicode_ci").replace(/\bDROP\s+CHECK\b/gi, "DROP CONSTRAINT");
writeFileSync(join(OUT, "1_schema_mariadb.sql"), `${header("MariaDB")}\n${mariadb(schema)}`, "utf8");

// First administrator: a random temporary password, stored only as its hash in the SQL file.
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const password = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("")).join("-");
const email = (process.argv.find((a) => a.startsWith("--admin-email="))?.slice(14) ?? "admin@moointer.local").toLowerCase();
if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)) throw new Error("ADMIN_EMAIL_INVALID");
const userId = randomUUID(), hash = await hashPassword(password);
writeFileSync(join(OUT, "2_first_administrator.sql"), [
  "-- บัญชีผู้ดูแลระบบคนแรก นำเข้าหลังไฟล์โครงสร้าง 1 ครั้งเท่านั้น รหัสผ่านชั่วคราวอยู่ในไฟล์ first-administrator.txt",
  "-- เข้าสู่ระบบแล้วเปลี่ยนรหัสผ่านที่ “บัญชีของฉัน” ทันที จากนั้นสร้างแผนกและบัญชีอื่นที่ จัดการหลังบ้าน › ผู้ใช้งาน",
  "SET NAMES utf8mb4;",
  `INSERT INTO \`User\` (\`id\`, \`subject\`, \`displayName\`, \`active\`, \`version\`, \`updatedAt\`, \`email\`, \`emailVerified\`) VALUES (${quote(userId)}, ${quote(`local:${email}`)}, 'ผู้ดูแลระบบ', 1, 1, UTC_TIMESTAMP(3), ${quote(email)}, 1);`,
  `INSERT INTO \`AuthAccount\` (\`id\`, \`userId\`, \`accountId\`, \`providerId\`, \`password\`, \`createdAt\`, \`updatedAt\`) VALUES (${quote(randomUUID())}, ${quote(userId)}, ${quote(userId)}, 'credential', ${quote(hash)}, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3));`,
  `INSERT INTO \`UserRole\` (\`id\`, \`userId\`, \`roleId\`) VALUES (${quote(randomUUID())}, ${quote(userId)}, ${quote(id("role", "ADMINISTRATOR"))});`,
  `INSERT INTO \`UserScope\` (\`id\`, \`userId\`, \`kind\`) VALUES (${quote(randomUUID())}, ${quote(userId)}, 'GLOBAL');`,
  `INSERT INTO \`AuditLog\` (\`id\`, \`actorId\`, \`action\`, \`entityType\`, \`entityId\`, \`reason\`, \`after\`) VALUES (${quote(randomUUID())}, ${quote(userId)}, 'FIRST_ADMINISTRATOR_INSTALLED', 'User', ${quote(userId)}, 'Installation file 2_first_administrator.sql', '{"typeCode":"ADMINISTRATOR","global":true}');`, "",
].join("\n"), "utf8");
writeFileSync(join(OUT, "first-administrator.txt"), `บัญชีผู้ดูแลระบบคนแรก (ใช้กับไฟล์ 2_first_administrator.sql ชุดนี้เท่านั้น)\nอีเมล: ${email}\nรหัสผ่านชั่วคราว: ${password}\nเปลี่ยนรหัสผ่านทันทีหลังเข้าสู่ระบบครั้งแรก และลบไฟล์นี้เมื่อจดรหัสแล้ว\n`, { encoding: "utf8", mode: 0o600 });
console.log(`PASS: ${migrations.length} migrations, ${tables} tables, ${triggers} triggers, ${Object.keys(rolePermissions).length} role codes, ${permissionCodes.length} capabilities written to ${OUT}. First administrator ${email}; temporary password is in ${OUT}/first-administrator.txt (not printed).`);
