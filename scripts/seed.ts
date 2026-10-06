import "dotenv/config";
import { createDatabase } from "../src/server/persistence/database";
import { testDatabaseConfiguration } from "../src/server/config/environment";
import { seedSynthetic } from "../tests/fixtures/synthetic";

let db: ReturnType<typeof createDatabase> | undefined;
try {
  db=createDatabase(testDatabaseConfiguration(process.env));
  await seedSynthetic(db);
  console.log("PASS: synthetic Phase 2 seed; 3 active branches, 18 coverage cells; no operational source data.");
} catch { console.error("SYNTHETIC_SEED_FAILED"); process.exitCode=1; }
finally { await db?.$disconnect(); }
