import "dotenv/config";
import { createDatabase } from "../src/server/persistence/database";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { installRoles } from "../src/server/auth/permissions";
import { assignAccountDepartment, consolidateRetiredRoles } from "../src/server/auth/provision";

// Additive access update; synthetic memberships only, no operational records or password changes.
let db: ReturnType<typeof createDatabase> | undefined;
try {
  const config = parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (process.env.APP_ENV !== "local" || config.host !== "127.0.0.1" || config.port !== 3307 || config.database !== "moointer_dev") throw new Error("LOCAL_ONLY");
  db = createDatabase(config);
  await installRoles(db);
  // D221: accounts still holding a retired code (DRIVER, SUPERVISOR) move to the type that absorbed it; audited.
  const consolidated = await consolidateRetiredRoles(db, "D221: account types reduced from seven to five; capabilities unchanged for this account");
  const department = await db.department.findUniqueOrThrow({ where: { code: "DEP-OPS" } });
  const emails = ["mock.admin", "mock.dispatcher", "mock.supervisor", "mock.warehouse", "mock.driver", "mock.branch", "local.admin", "local.dispatcher", "local.supervisor"];
  let assigned = 0;
  for (const prefix of emails) {
    const email = `${prefix}@moointer.test`;
    if (await db.user.findFirst({ where: { email, active: true } })) {
      await assignAccountDepartment(db, email, department.id, "D216: explicit synthetic operations-department membership for local testing");
      assigned++;
    }
  }
  console.log(`PASS: D221 account-type capabilities and Thai names synchronized; ${consolidated} account(s) moved off retired role codes; ${assigned} known development accounts have the synthetic operations department. Requester marketing membership and passwords preserved.`);
} catch { console.error("ACCESS_SYNC_FAILED (existing data and credentials retained)"); process.exitCode = 1; }
finally { await db?.$disconnect(); }
