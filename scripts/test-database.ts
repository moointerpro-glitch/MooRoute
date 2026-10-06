import "dotenv/config";
import assert from "node:assert/strict";
import { createDatabase } from "../src/server/persistence/database";
import { ConfigurationError, testDatabaseConfiguration } from "../src/server/config/environment";
import { checkDatabaseReadiness, DatabaseReadinessError } from "../src/server/services/database-readiness";

let database: ReturnType<typeof createDatabase> | undefined;
try {
  database = createDatabase(testDatabaseConfiguration(process.env));
  await checkDatabaseReadiness(database);
  // A connection-local temporary table cannot overwrite any application table.
  await database.$transaction(async (tx) => {
    await tx.$executeRaw`CREATE TEMPORARY TABLE foundation_probe (
      id INTEGER PRIMARY KEY, label VARCHAR(100) NOT NULL,
      quantity DECIMAL(12,3) NOT NULL, service_date DATE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;
    try {
      const label = "สาขาตัวอย่าง หมู ไก่ 📦";
      await tx.$executeRaw`INSERT INTO foundation_probe (id, label, quantity, service_date)
        VALUES (1, ${label}, ${"30.125"}, ${"2026-10-06"})`;
      const rows = await tx.$queryRaw<Array<{label: string; quantity: string; serviceDate: string}>>`
        SELECT label, CAST(quantity AS CHAR) AS quantity, DATE_FORMAT(service_date, '%Y-%m-%d') AS serviceDate
        FROM foundation_probe WHERE id = ${1}`;
      assert.deepEqual(rows[0], { label, quantity: "30.125", serviceDate: "2026-10-06" });
    } finally { await tx.$executeRaw`DROP TEMPORARY TABLE foundation_probe`; }
  });
  console.log("PASS: real MySQL, InnoDB, utf8mb4, Thai/emoji persistence, exact decimal and DATE; dedicated disposable database.");
} catch (error) {
  const code = error instanceof ConfigurationError || error instanceof DatabaseReadinessError
    ? error.code : "DATABASE_SMOKE_TEST_FAILED";
  console.error(code);
  process.exitCode = 1;
} finally { await database?.$disconnect(); }
