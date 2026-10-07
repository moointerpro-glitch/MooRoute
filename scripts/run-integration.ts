import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { testDatabaseConfiguration } from "../src/server/config/environment";
import { runtimeGrants } from "./runtime-grants";

// No DROP/RESET: each native test run creates and retains a fresh scoped database.
try {
  const config=testDatabaseConfiguration(process.env);
  if (config.host!=="127.0.0.1" || config.port!==3307 || config.user!=="moointer_test") throw new Error("NATIVE_TEST_SETUP_REQUIRED");
  const client=resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe");
  const defaults=resolve(".local/mysql/root-client.ini");
  if(!existsSync(client)||!existsSync(defaults)) throw new Error("NATIVE_TEST_SETUP_REQUIRED");
  const name=`moointer_test_run_${randomBytes(8).toString("hex")}`;
  // This project-owned lab server has no replication consumers. Permit its scoped
  // migration account to create immutable-history triggers without global SUPER.
  const provision=spawnSync(client,[`--defaults-file=${defaults}`,"--batch"],{input:`SET GLOBAL log_bin_trust_function_creators=1; CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; GRANT ALL PRIVILEGES ON \`${name}\`.* TO 'moointer_test'@'127.0.0.1';`,encoding:"utf8"});
  if(provision.status!==0) throw new Error("TEST_PROVISION_FAILED");
  const url=new URL(process.env.TEST_DATABASE_URL!); url.pathname=`/${name}`;
  const env={...process.env,TEST_DATABASE_URL:url.toString(),MIGRATION_DATABASE_URL:url.toString()};
  const migrate=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env,encoding:"utf8"});
  if(migrate.status!==0){
    // MySQL error number is safe to report; connection strings and full CLI errors are not.
    const code=(migrate.stderr+migrate.stdout).match(/Error code: (P\d+)|Database error code: (\d+)/g);
    console.error(code?.join("; ") ?? "MIGRATION_FAILED"); throw new Error("MIGRATION_FAILED");
  }
  console.log(`Fresh disposable MySQL database: ${name}; migration deploy passed. Retained for inspection.`);
  if((process.argv.includes("--browser")||process.argv.includes("--planning-browser")||process.argv.includes("--search-browser")||process.argv.includes("--consignment-browser")||process.argv.includes("--labels-browser")||process.argv.includes("--users-browser"))){
    const labels=process.argv.includes("--labels-browser"),consignment=process.argv.includes("--consignment-browser"),search=process.argv.includes("--search-browser")||consignment;
    const prepare=spawnSync(process.execPath,["--conditions=react-server","--import","tsx",labels?"scripts/prepare-labels-e2e.ts":search?"scripts/prepare-search-e2e.ts":"scripts/prepare-auth-e2e.ts"],{env,stdio:"inherit"});if(prepare.status!==0)throw new Error("BROWSER_FIXTURE_FAILED");
    // Staging rehearsal: the web server connects with the same least-privilege grants as a deployed runtime account.
    let appUrl=url.toString();
    if(process.argv.includes("--scoped-runtime")){
      const password=randomBytes(24).toString("hex"),scoped=new URL(url.toString());
      const grant=spawnSync(client,[`--defaults-file=${defaults}`,"--batch"],{input:[`CREATE USER IF NOT EXISTS 'moointer_stage'@'127.0.0.1' IDENTIFIED BY '${password}';`,`ALTER USER 'moointer_stage'@'127.0.0.1' IDENTIFIED BY '${password}';`,...runtimeGrants(name,"moointer_stage")].join(" "),encoding:"utf8"});
      if(grant.status!==0)throw new Error("SCOPED_RUNTIME_FAILED");
      scoped.username="moointer_stage";scoped.password=password;appUrl=scoped.toString();
      console.log("Staging rehearsal: web server uses the least-privilege runtime account (no DDL, no DELETE on history).");
    }
    const browser=spawnSync(process.execPath,["node_modules/@playwright/test/cli.js","test","--config",labels?"playwright.labels.config.ts":consignment?"playwright.consignment.config.ts":search?"playwright.search.config.ts":process.argv.includes("--planning-browser")?"playwright.planning.config.ts":process.argv.includes("--users-browser")?"playwright.users.config.ts":"playwright.auth.config.ts"],{env:{...env,DATABASE_URL:appUrl,APP_ENV:"local",UPLOAD_DIR:".local/uploads-e2e",BETTER_AUTH_URL:"http://127.0.0.1:3011",BETTER_AUTH_SECRET:randomBytes(32).toString("hex")},stdio:"inherit"});process.exitCode=browser.status??1;
  }else{
    const test=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","--test","--test-concurrency=1",...(process.argv.includes("--access") ? ["tests/integration/access.test.ts","tests/integration/users.test.ts","tests/integration/planning-range.test.ts"] : ["tests/integration/phase2.test.ts","tests/integration/phase3.test.ts","tests/integration/phase4.test.ts","tests/integration/phase5.test.ts","tests/integration/phase6.test.ts","tests/integration/phase7.test.ts","tests/integration/backoffice.test.ts"])],{env,stdio:"inherit"});
    process.exitCode=test.status ?? 1;
  }
} catch { console.error("INTEGRATION_RUN_FAILED (no existing database reset)"); process.exitCode=1; }
