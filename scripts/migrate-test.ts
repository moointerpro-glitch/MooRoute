import "dotenv/config";
import { spawnSync } from "node:child_process";
import { testDatabaseConfiguration } from "../src/server/config/environment";

try {
  testDatabaseConfiguration(process.env);
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, MIGRATION_DATABASE_URL: process.env.TEST_DATABASE_URL }, encoding: "utf8",
  });
  // Never echo CLI error output, which may include connection details.
  if (result.status !== 0) throw new Error("TEST_MIGRATION_FAILED");
  console.log("PASS: Prisma migrations deployed to the validated disposable database.");
} catch { console.error("TEST_MIGRATION_FAILED"); process.exitCode = 1; }
