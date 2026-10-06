import "dotenv/config";
import { getDatabase } from "../src/server/persistence/database";
import { ConfigurationError } from "../src/server/config/environment";
import { checkDatabaseReadiness, DatabaseReadinessError } from "../src/server/services/database-readiness";

let database: ReturnType<typeof getDatabase> | undefined;
try {
  database = getDatabase();
  console.log(JSON.stringify(await checkDatabaseReadiness(database)));
} catch (error) {
  const code = error instanceof ConfigurationError || error instanceof DatabaseReadinessError
    ? error.code : "DATABASE_CONNECTION_FAILED";
  console.error(JSON.stringify({ status: "error", code }));
  process.exitCode = 1;
} finally {
  await database?.$disconnect();
}
