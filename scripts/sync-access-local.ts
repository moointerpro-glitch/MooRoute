import "dotenv/config";
import { createDatabase } from "../src/server/persistence/database";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { installRoles } from "../src/server/auth/permissions";
import { assignAccountDepartment, consolidateRetiredRoles } from "../src/server/auth/provision";
import { MOCK_ACCOUNTS } from "./mock-accounts";

// Additive access update; synthetic memberships only, no operational records or password changes.
let db: ReturnType<typeof createDatabase> | undefined;
try {
  const config = parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (process.env.APP_ENV !== "local" || config.host !== "127.0.0.1" || config.port !== 3307 || config.database !== "moointer_dev") throw new Error("LOCAL_ONLY");
  db = createDatabase(config);
  await installRoles(db);
  // D221: accounts still holding a retired code (DRIVER, SUPERVISOR) move to the type that absorbed it; audited.
  const consolidated = await consolidateRetiredRoles(db, "D221: account types reduced from seven to five; capabilities unchanged for this account");
  // Mock accounts that exist get their synthetic sender department (D216); nothing is created here.
  let assigned = 0;
  for (const a of MOCK_ACCOUNTS) {
    const [user, department] = await Promise.all([db.user.findFirst({ where: { email: a.email, active: true } }), db.department.findUnique({ where: { code: a.department } })]);
    if (user && department) { await assignAccountDepartment(db, a.email, department.id, "D216: explicit synthetic sender department for local testing"); assigned++; }
  }
  console.log(`PASS: D221 account-type capabilities and Thai names synchronized; ${consolidated} account(s) moved off retired role codes; ${assigned} mock accounts have their synthetic sender department; passwords preserved.`);
} catch { console.error("ACCESS_SYNC_FAILED (existing data and credentials retained)"); process.exitCode = 1; }
finally { await db?.$disconnect(); }
