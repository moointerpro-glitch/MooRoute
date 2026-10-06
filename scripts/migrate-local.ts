import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDatabaseUrl } from "../src/server/config/environment";

// Operator-only native development migration. It never seeds or resets development data.
try {
  const app=parseDatabaseUrl(process.env.DATABASE_URL);
  if(app.database!=="moointer_dev" || app.host!=="127.0.0.1" || app.port!==3307) throw new Error("NATIVE_DEVELOPMENT_DATABASE_REQUIRED");
  const client=resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe"), defaults=resolve(".local/mysql/root-client.ini");
  if(!existsSync(client)||!existsSync(defaults)) throw new Error("NATIVE_SETUP_REQUIRED");
  let migrationUrl=process.env.MIGRATION_DATABASE_URL;
  if(!migrationUrl) {
    // Refuse duplicate/conflicting environment entries; never rotate an existing secret silently.
    if(/^MIGRATION_DATABASE_URL=/m.test(readFileSync(".env","utf8"))) throw new Error("MIGRATION_CONFIGURATION_CONFLICT");
    const password=randomBytes(32).toString("hex");
    const provision=spawnSync(client,[`--defaults-file=${defaults}`,"--batch"],{encoding:"utf8",input:
      `CREATE USER 'moointer_migrate'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON moointer_dev.* TO 'moointer_migrate'@'127.0.0.1';`});
    if(provision.status!==0) throw new Error("MIGRATION_ACCOUNT_SETUP_FAILED");
    migrationUrl=`mysql://moointer_migrate:${password}@127.0.0.1:3307/moointer_dev`;
    appendFileSync(".env",`\nMIGRATION_DATABASE_URL="${migrationUrl}"\n`,"utf8");
  }
  const migration=parseDatabaseUrl(migrationUrl);
  if(migration.database!==app.database || migration.host!==app.host || migration.port!==app.port || migration.user!=="moointer_migrate") throw new Error("MIGRATION_CONFIGURATION_INVALID");
  // Binary logging is on, so the non-SUPER migrator may only create the guard triggers with this server-wide flag (D206).
  console.log("Notice: setting the lab server's global log_bin_trust_function_creators=1 so the migration account can create triggers (see OPERATIONS.md §5).");
  const configure=spawnSync(client,[`--defaults-file=${defaults}`,"--batch"],{input:"SET GLOBAL log_bin_trust_function_creators=1;",encoding:"utf8"});
  if(configure.status!==0) throw new Error("MIGRATION_TRIGGER_SETUP_FAILED");
  const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:{...process.env,MIGRATION_DATABASE_URL:migrationUrl},encoding:"utf8"});
  if(result.status!==0) throw new Error("LOCAL_MIGRATION_FAILED");
  console.log("PASS: reviewed migrations deployed to local moointer_dev using a dedicated migrator; no reset or synthetic data. Runtime grants were not changed by this command.");
} catch { console.error("LOCAL_MIGRATION_FAILED (existing data retained)"); process.exitCode=1; }
