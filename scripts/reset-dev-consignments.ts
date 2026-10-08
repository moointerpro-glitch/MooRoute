import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { createDatabase } from "../src/server/persistence/database";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { uploadDirectory } from "../src/server/domain/files";

/**
 * Operator tool for the LOCAL DEVELOPMENT database only: clears every consignment and what hangs off it
 * (items, pieces, assignments, snapshots, events, receipts, returns, labels, print history, attachments) so the
 * owner can test the consignment flow again from an empty list. Owner-requested on 2026-10-08.
 * Accounts, master data, routes, templates, daily plans, the audit log and replay records are kept.
 *
 * Safety: same guards as reset-dev-operations.ts (local environment, moointer_dev on 127.0.0.1:3307,
 * `--confirm=moointer_dev`, verified backup first, guard triggers compared before and after, orphan check).
 * Attachment files are moved to .local/uploads-retired, not deleted. Never use this against shared, staging or
 * production data.
 */
const DATABASE = "moointer_dev";
const CONSIGNMENT_TABLES = [
  "Attachment", "PrintEvent", "LabelPackage", "LabelVersion", "ReceiptLine", "ReturnLine", "ConsignmentEvent",
  "ConsignmentAssignment", "AddressSnapshot", "ConsignmentPackage", "ConsignmentItem", "Consignment",
];

const client = resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe"), defaults = resolve(".local/mysql/root-client.ini");
function sql(statements: string) {
  const r = spawnSync(client, [`--defaults-file=${defaults}`, "--batch", "--skip-column-names", DATABASE], { input: statements, encoding: "utf8" });
  if (r.status !== 0) throw new Error("MYSQL_STATEMENT_FAILED");
  return r.stdout;
}
const triggerFingerprint = () => createHash("sha256").update(sql(
  `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT, DEFINER FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='${DATABASE}' ORDER BY TRIGGER_NAME;`)).digest("hex");
const counts = () => Object.fromEntries(sql(CONSIGNMENT_TABLES.map((t) => `SELECT '${t}', COUNT(*) FROM \`${t}\`;`).join("\n")).trim().split(/\r?\n/).map((line) => { const [t, n] = line.split("\t"); return [t, Number(n)]; }));

let db: ReturnType<typeof createDatabase> | undefined, changed = false;
try {
  if (process.env.APP_ENV !== "local") throw new Error("LOCAL_ONLY");
  const config = parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (config.host !== "127.0.0.1" || config.port !== 3307 || config.database !== DATABASE) throw new Error("LOCAL_DEV_DATABASE_ONLY");
  if (!process.argv.includes(`--confirm=${DATABASE}`)) throw new Error(`CONFIRMATION_REQUIRED: add --confirm=${DATABASE}`);
  if (!existsSync(client) || !existsSync(defaults)) throw new Error("NATIVE_SETUP_REQUIRED");

  const cleared = counts();
  const files = sql("SELECT storageKey FROM Attachment;").trim().split(/\r?\n/).filter((key) => /^[A-Za-z0-9_-]{1,64}$/.test(key));
  const actor = sql("SELECT u.id FROM User u JOIN UserRole ur ON ur.userId=u.id JOIN Role r ON r.id=ur.roleId WHERE r.code='ADMINISTRATOR' AND u.active=1 ORDER BY u.createdAt LIMIT 1;").trim();
  if (!actor) throw new Error("NO_ACTIVE_ADMINISTRATOR (nothing was changed)");

  // 1. Verified backup first.
  const backup = spawnSync(process.execPath, ["--import", "tsx", "scripts/backup-verify.ts"], { encoding: "utf8" });
  const backupFile = (backup.stdout.match(/"backupFile":"([^"]+)"/)?.[1] ?? "").replace(/\\\\/g, "\\");
  if (backup.status !== 0 || !backupFile) throw new Error("BACKUP_NOT_VERIFIED (nothing was changed)");
  console.log(`Backup verified: ${backupFile}`);

  // 2. Clear consignment data only. TRUNCATE leaves the guard triggers in place and does not fire them.
  const before = triggerFingerprint();
  changed = true;
  sql(["SET FOREIGN_KEY_CHECKS=0;", ...CONSIGNMENT_TABLES.map((t) => `TRUNCATE TABLE \`${t}\`;`), "SET FOREIGN_KEY_CHECKS=1;"].join("\n"));
  if (triggerFingerprint() !== before) throw new Error("TRIGGERS_CHANGED");
  if (Object.values(counts()).some((n) => n !== 0)) throw new Error("TABLES_NOT_EMPTY");

  // 3. Every foreign key must still resolve (kept tables reference only kept tables).
  const keys = sql(`SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='${DATABASE}' AND REFERENCED_TABLE_NAME IS NOT NULL;`)
    .trim().split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"));
  const orphans = keys.map(([t, c, rt, rc]) => [`${t}.${c}`, Number(sql(`SELECT COUNT(*) FROM \`${t}\` x LEFT JOIN \`${rt}\` y ON x.\`${c}\`=y.\`${rc}\` WHERE x.\`${c}\` IS NOT NULL AND y.\`${rc}\` IS NULL;`).trim())] as const).filter(([, n]) => n > 0);
  if (orphans.length) throw new Error(`ORPHANS ${orphans.map(([k, n]) => `${k}=${n}`).join(", ")}`);

  // 4. Attachment files no longer have a record: move them aside rather than delete them.
  const uploads = uploadDirectory(), retired = resolve(`.local/uploads-retired/${new Date().toISOString().replace(/[:.]/g, "-")}`);
  let moved = 0;
  for (const key of files) {
    const path = resolve(uploads, key);
    if (existsSync(path)) { mkdirSync(retired, { recursive: true }); renameSync(path, resolve(retired, key)); moved++; }
  }

  db = createDatabase(config);
  await db.auditLog.create({ data: { actorId: actor, action: "DEV_CONSIGNMENTS_RESET", entityType: "Database", entityId: DATABASE, reason: "Owner request 2026-10-08: delete all consignment data and start testing again",
    after: { cleared, backupFile, attachmentFilesMoved: moved, triggersUnchanged: true, orphanForeignKeys: 0 } } });
  console.log(`PASS: consignment data cleared (${Object.entries(cleared).map(([t, n]) => `${t} ${n}`).join(", ")}); accounts, master data and plans kept; guard triggers unchanged; no orphan keys; ${moved} attachment file(s) moved to .local/uploads-retired.`);
} catch (error) {
  console.error(`DEV_CONSIGNMENT_RESET_FAILED: ${(error as Error).message}. ${changed ? "The database was changed: restore the verified backup from .local/backups." : "Nothing was changed."}`);
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
