import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabase } from "../src/server/persistence/database";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { installRoles } from "../src/server/auth/permissions";
import { MOCK_ACCOUNTS, MOCK_LOGIN_FILE, ensureMockAccounts } from "./mock-accounts";

/**
 * D224 operator tool for the LOCAL DEVELOPMENT database only: clears every account and all operational history
 * (plans, routes, templates, consignments, labels, imports, sessions, replay records and the audit log), keeps
 * master data, roles and migrations, then creates the mock accounts again. Owner-requested on 2026-10-07.
 *
 * Safety: local environment, moointer_dev on 127.0.0.1:3307 and `--confirm=moointer_dev` are all required; a backup
 * is taken and restore-verified first and the reset stops if that fails; TRUNCATE does not fire the history
 * guard triggers, which are compared before and after and must be unchanged; every foreign key is checked for
 * orphans afterwards. Never use this against shared, staging or production data.
 */
const DATABASE = "moointer_dev";
const CLEARED = [
  "AddressSnapshot", "Attachment", "AuditLog", "AuthAccount", "AuthRateLimit", "AuthSession", "AuthVerification", "Consignment", "ConsignmentAssignment",
  "ConsignmentEvent", "ConsignmentItem", "ConsignmentPackage", "DailyPlan", "IdempotencyRecord", "ImportBatch", "ImportRow", "LabelPackage", "LabelVersion",
  "PlanBranch", "PlanRevision", "PrintEvent", "ReceiptLine", "ReturnLine", "Route", "RouteRevision", "RouteStop", "ScheduleTemplate", "TemplateRevision",
  "TemplateStopCategory", "TemplateWeekday", "Trip", "TripRevision", "TripStop", "TripStopCategory", "User", "UserProfile", "UserRole", "UserScope", "VehicleReservation",
];

const client = resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe"), defaults = resolve(".local/mysql/root-client.ini");
function sql(statements: string) {
  const r = spawnSync(client, [`--defaults-file=${defaults}`, "--batch", "--skip-column-names", DATABASE], { input: statements, encoding: "utf8" });
  if (r.status !== 0) throw new Error("MYSQL_STATEMENT_FAILED");
  return r.stdout;
}
const triggerFingerprint = () => createHash("sha256").update(sql(
  `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT, DEFINER FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='${DATABASE}' ORDER BY TRIGGER_NAME;`)).digest("hex");

let db: ReturnType<typeof createDatabase> | undefined, changed = false;
try {
  if (process.env.APP_ENV !== "local") throw new Error("LOCAL_ONLY");
  const config = parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (config.host !== "127.0.0.1" || config.port !== 3307 || config.database !== DATABASE) throw new Error("LOCAL_DEV_DATABASE_ONLY");
  if (!process.argv.includes(`--confirm=${DATABASE}`)) throw new Error(`CONFIRMATION_REQUIRED: add --confirm=${DATABASE}`);
  if (!existsSync(client) || !existsSync(defaults)) throw new Error("NATIVE_SETUP_REQUIRED");

  // 1. Verified backup first.
  const backup = spawnSync(process.execPath, ["--import", "tsx", "scripts/backup-verify.ts"], { encoding: "utf8" });
  const backupFile = (backup.stdout.match(/"backupFile":"([^"]+)"/)?.[1] ?? "").replace(/\\\\/g, "\\");
  if (backup.status !== 0 || !backupFile) throw new Error("BACKUP_NOT_VERIFIED (nothing was changed)");
  console.log(`Backup verified: ${backupFile}`);

  // 2. Clear operational history and accounts. TRUNCATE leaves the guard triggers in place and does not fire them.
  const before = triggerFingerprint();
  changed = true;
  sql(["SET FOREIGN_KEY_CHECKS=0;", ...CLEARED.map((t) => `TRUNCATE TABLE \`${t}\`;`), "SET FOREIGN_KEY_CHECKS=1;"].join("\n"));
  if (triggerFingerprint() !== before) throw new Error("TRIGGERS_CHANGED");

  // 3. Every foreign key must still resolve (kept masters reference only kept tables).
  const keys = sql(`SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='${DATABASE}' AND REFERENCED_TABLE_NAME IS NOT NULL;`)
    .trim().split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"));
  const orphans = keys.map(([t, c, rt, rc]) => [`${t}.${c}`, Number(sql(`SELECT COUNT(*) FROM \`${t}\` x LEFT JOIN \`${rt}\` y ON x.\`${c}\`=y.\`${rc}\` WHERE x.\`${c}\` IS NOT NULL AND y.\`${rc}\` IS NULL;`).trim())] as const).filter(([, n]) => n > 0);
  if (orphans.length) throw new Error(`ORPHANS ${orphans.map(([k, n]) => `${k}=${n}`).join(", ")}`);

  // 4. Fresh mock accounts. Old local credential files describe deleted accounts and are moved aside, not deleted.
  db = createDatabase(config);
  await installRoles(db);
  const retired = resolve(`.local/auth/retired-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  for (const file of ["admin-credentials.txt", "dispatcher-credentials.txt", "supervisor-credentials.txt", "mockup-logins.txt"]) {
    const path = resolve(".local/auth", file);
    if (existsSync(path)) { mkdirSync(retired, { recursive: true }); renameSync(path, resolve(retired, file)); }
  }
  const ids = await ensureMockAccounts(db);
  await db.auditLog.create({ data: { actorId: ids.admin, action: "DEV_OPERATIONS_RESET", entityType: "Database", entityId: DATABASE, reason: "Owner request 2026-10-07: delete all old accounts and start the development data again (D224)",
    after: { clearedTables: CLEARED, backupFile, mockAccounts: MOCK_ACCOUNTS.map((a) => a.email), triggersUnchanged: true, orphanForeignKeys: 0 } } });
  console.log(`PASS: ${CLEARED.length} operational and account tables cleared, masters kept, guard triggers unchanged, no orphan keys; ${MOCK_ACCOUNTS.length} mock accounts created (logins in ignored ${MOCK_LOGIN_FILE}; values not printed). Next: npm run db:seed:mockup:plans`);
} catch (error) {
  console.error(`DEV_RESET_FAILED: ${(error as Error).message}. ${changed ? "The database was changed: restore the verified backup from .local/backups." : "Nothing was changed."}`);
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
