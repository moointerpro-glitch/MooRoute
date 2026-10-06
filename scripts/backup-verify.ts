import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, openSync, closeSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Operator-only tool for the project-owned local MySQL lab. It dumps one database, restores the dump
// into a NEW disposable schema and checks that the copy is identical AND usable. It never drops or resets anything.
//   npm run db:backup:verify [-- --database=<name>]                       dump, restore, check
//   npm run db:backup:verify -- --check-restored=<schema> [--database=..]  check an existing restored copy only
const client = resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe"), dumper = resolve(".local/tools/mysql-8.4.11-winx64/bin/mysqldump.exe"), defaults = resolve(".local/mysql/root-client.ini");
const option = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = option("database") ?? "moointer_dev", checkOnly = option("check-restored");

function sql(statement: string) {
  const r = spawnSync(client, [`--defaults-file=${defaults}`, "--batch", "-N", "--raw", "--default-character-set=utf8mb4", "-e", statement], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("QUERY_FAILED");
  return r.stdout.trim().split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));
}
/** Runs a statement and returns "ok", the SIGNAL text of a guard, or the MySQL error number. */
function attempt(statement: string) {
  const r = spawnSync(client, [`--defaults-file=${defaults}`, "--batch", "-N", "-e", statement], { encoding: "utf8" });
  if (r.status === 0) return "ok";
  const m = (r.stderr ?? "").match(/ERROR (\d+) \([0-9A-Z]+\)[^:]*: (.*)/);
  return !m ? "error" : m[1] === "1644" ? m[2].trim() : `MySQL ${m[1]}`;
}
const quoteAccount = (definer: string) => { const [user, host] = definer.split("@"); return `'${user.replace(/'/g, "")}'@'${host.replace(/'/g, "")}'`; };

function describe(schema: string) {
  const tables = sql(`SELECT table_name FROM information_schema.tables WHERE table_schema='${schema}' AND table_type='BASE TABLE' ORDER BY table_name`).map((r) => r[0]);
  const counts = sql(tables.map((t) => `SELECT '${t}', COUNT(*) FROM \`${schema}\`.\`${t}\``).join("; "));
  const sums = sql(`CHECKSUM TABLE ${tables.map((t) => `\`${schema}\`.\`${t}\``).join(", ")}`);
  const triggers = sql(`SELECT trigger_name, MD5(CONCAT(event_object_table, action_timing, event_manipulation, action_statement)) FROM information_schema.triggers WHERE trigger_schema='${schema}' ORDER BY trigger_name`);
  const constraints = sql(`SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema='${schema}' AND constraint_type IN ('CHECK','FOREIGN KEY','UNIQUE','PRIMARY KEY')`)[0][0];
  return { tables, triggers: triggers.map((r) => r.join(":")).join(","), triggerCount: triggers.length, constraints: Number(constraints),
    rows: Object.fromEntries(counts.map(([t, n]) => [t, Number(n)])), checksums: Object.fromEntries(sums.map(([t, s]) => [t.split(".").pop()!, s])) };
}

/**
 * Triggers run with the privileges of their DEFINER. A restored copy whose definer account is missing or lacks
 * rights on the copy rejects every guarded write (MySQL 1449 / 1142) even though its contents are identical.
 */
function usability(target: string, sourceSchema: string) {
  const problems: string[] = [];
  const definers = sql(`SELECT DISTINCT definer FROM information_schema.triggers WHERE trigger_schema='${target}'`).map((r) => r[0]);
  for (const definer of definers) {
    const [user, host] = definer.split("@");
    if (sql(`SELECT COUNT(*) FROM mysql.user WHERE user='${user}' AND host='${host}'`)[0][0] === "0") { problems.push(`trigger definer ${definer} does not exist`); continue; }
    const grantee = quoteAccount(definer).replace(/'/g, "''");
    for (const privilege of ["TRIGGER", "SELECT"]) {
      const held = sql(`SELECT (SELECT COUNT(*) FROM information_schema.USER_PRIVILEGES WHERE GRANTEE='${grantee}' AND PRIVILEGE_TYPE='${privilege}') + (SELECT COUNT(*) FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE='${grantee}' AND PRIVILEGE_TYPE='${privilege}' AND '${target}' LIKE TABLE_SCHEMA)`)[0][0];
      if (held === "0") problems.push(`trigger definer ${definer} lacks ${privilege} on the restored schema`);
    }
  }
  // Same harmless no-op UPDATE on the first row of every guarded table, rolled back, on source and copy.
  const guarded = sql(`SELECT DISTINCT event_object_table FROM information_schema.triggers WHERE trigger_schema='${target}' AND event_manipulation='UPDATE' ORDER BY 1`).map((r) => r[0]);
  let probed = 0;
  for (const table of guarded) {
    if (sql(`SELECT COUNT(*) FROM \`${target}\`.\`${table}\``)[0][0] === "0") continue;
    probed++;
    const probe = (schema: string) => attempt(`START TRANSACTION; UPDATE \`${schema}\`.\`${table}\` SET id=id ORDER BY id LIMIT 1; ROLLBACK;`);
    const expected = probe(sourceSchema), actual = probe(target);
    if (expected !== actual) problems.push(`guarded write on ${table}: source "${expected}", restored copy "${actual}"`);
  }
  return { definers, guardedTables: guarded.length, probedTables: probed, problems };
}

/** Rehearsal only: give each definer the same schema privileges on the disposable copy that it holds on the source. */
function replayDefinerGrants(target: string, sourceSchema: string) {
  const replayed: string[] = [];
  for (const [definer] of sql(`SELECT DISTINCT definer FROM information_schema.triggers WHERE trigger_schema='${target}'`)) {
    const account = quoteAccount(definer), grantee = account.replace(/'/g, "''");
    const privileges = sql(`SELECT PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE='${grantee}' AND '${sourceSchema}' LIKE TABLE_SCHEMA`).map((r) => r[0]);
    if (!privileges.length) continue;
    sql(`GRANT ${privileges.join(", ")} ON \`${target}\`.* TO ${account}`);
    replayed.push(definer);
  }
  return replayed;
}

try {
  if (!/^moointer_(dev|test|test_run_[a-z0-9]+|stage_[a-z0-9]+)$/.test(source)) throw new Error("UNSUPPORTED_DATABASE");
  if (checkOnly !== undefined && (!/^moointer_test_run_[a-z0-9]+$/.test(checkOnly) || checkOnly === source)) throw new Error("UNSUPPORTED_RESTORED_SCHEMA");
  if (!existsSync(client) || !existsSync(dumper) || !existsSync(defaults)) throw new Error("NATIVE_SETUP_REQUIRED");
  let target = checkOnly ?? "", backup: Record<string, unknown> = { mode: "check-restored" }, grantsReplayed: string[] = [];
  if (!checkOnly) {
    mkdirSync(".local/backups", { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14), file = resolve(`.local/backups/${source}-${stamp}.sql`);
    const dumpStarted = Date.now();
    // --result-file avoids CRLF conversion on Windows; --single-transaction gives a consistent InnoDB snapshot.
    const dump = spawnSync(dumper, [`--defaults-file=${defaults}`, "--single-transaction", "--routines", "--triggers", "--set-gtid-purged=OFF", "--no-tablespaces", `--result-file=${file}`, source], { encoding: "utf8" });
    if (dump.status !== 0 || !existsSync(file) || statSync(file).size === 0) throw new Error("DUMP_FAILED");
    const dumpSeconds = Math.round((Date.now() - dumpStarted) / 100) / 10, restoreStarted = Date.now();
    target = `moointer_test_run_restore${randomBytes(6).toString("hex")}`;
    sql(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    // Restored as the lab's root account, which may create triggers for another DEFINER (SET_ANY_DEFINER).
    const input = openSync(file, "r");
    const restore = spawnSync(client, [`--defaults-file=${defaults}`, "--default-character-set=utf8mb4", target], { stdio: [input, "ignore", "pipe"], encoding: "utf8" });
    closeSync(input);
    if (restore.status !== 0) { console.error(`RESTORE_FAILED: ${(restore.stderr ?? "").split(/\r?\n/)[0].replace(/'[^']*'/g, "'…'")}`); throw new Error("RESTORE_FAILED"); }
    grantsReplayed = replayDefinerGrants(target, source);
    backup = { backupFile: file.replace(resolve("."), "."), backupBytes: statSync(file).size, dumpSeconds, restoreSeconds: Math.round((Date.now() - restoreStarted) / 100) / 10 };
  }
  if (sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${target}'`)[0][0] === "0") throw new Error("RESTORED_SCHEMA_NOT_FOUND");
  const a = describe(source), b = describe(target);
  const differences = [...(a.tables.join() !== b.tables.join() ? ["tables"] : []), ...(a.triggers !== b.triggers ? ["trigger definitions"] : []), ...(a.constraints !== b.constraints ? ["constraints"] : []),
    ...a.tables.filter((t) => a.rows[t] !== b.rows[t]).map((t) => `rows:${t}`), ...a.tables.filter((t) => a.rows[t] === b.rows[t] && a.checksums[t] !== b.checksums[t]).map((t) => `content:${t}`)];
  const usable = usability(target, source);
  const totalRows = Object.values(a.rows).reduce((n, v) => n + v, 0);
  console.log(JSON.stringify({ source, restoredInto: target, ...backup, tables: a.tables.length, triggers: a.triggerCount, constraints: a.constraints, totalRows,
    triggerDefiners: usable.definers, definerGrantsReplayed: grantsReplayed, guardedTables: usable.guardedTables, guardedTablesProbed: usable.probedTables, differences, usabilityProblems: usable.problems }));
  if (differences.length) throw new Error("RESTORE_MISMATCH");
  if (usable.problems.length) throw new Error("RESTORED_COPY_NOT_USABLE");
  console.log("PASS: the restored copy has identical tables, triggers, constraints, row counts and table checksums, its trigger definers exist with the needed privileges, and guarded writes behave as on the source. Nothing was dropped or reset.");
} catch (error) { console.error(`BACKUP_VERIFY_FAILED (${error instanceof Error ? error.message : "UNKNOWN"})`); process.exitCode = 1; }
