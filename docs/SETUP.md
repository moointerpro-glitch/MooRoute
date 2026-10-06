# Local setup

## Phase 3 local authentication and masters

After installing dependencies and starting native MySQL, run:

```powershell
npm run db:migrate:local
npm run auth:setup:local
npm run build
npm start
```

Open http://127.0.0.1:3010/login. The bootstrap account is `local.admin@moointer.test`; its randomly generated password is stored only in ignored `.local/auth/admin-credentials.txt`. Read that file locally; do not copy it into chat, Git, screenshots or shared logs. Repeating setup preserves the existing account/password. No public signup exists. This administrator can manage masters but does not automatically publish plans or receive consignments.

The setup writes a random BETTER_AUTH_SECRET, APP_ENV=local and the exact loopback BETTER_AUTH_URL only when absent. Unknown/deployed APP_ENV or a nonloopback auth origin fails closed. Next production build/start is supported for **local preview**, with real authentication; this is not a production deployment configuration. No company IdP was configured in the workspace. Before deployment, explicitly integrate the company's IdP or a reviewed production account policy, TLS, trusted proxy/rate limiting and recovery. Do not silently reuse local setup as a deployment bypass.

Runtime grants: existing SELECT plus INSERT/UPDATE/DELETE only for master tables and auth ephemeral tables; UPDATE AuthAccount; INSERT AuditLog; INSERT/UPDATE IdempotencyRecord; UPDATE EligibilityGuard. The web account cannot create schemas/triggers, grant roles, provision users or mutate planning/receipt tables. Dedicated migration credentials remain operator-only.

Additional local accounts: create an ignored `.local/auth/account-request.json`, then run `npm run auth:account:local -- .local/auth/account-request.json`. Example nonsecret input:

```json
{"action":"create","email":"operator@example.test","name":"ผู้ใช้งานพัฒนา","role":"DISPATCHER","scope":"GLOBAL"}
```

Use BRANCH/WAREHOUSE/DEPARTMENT/DRIVER with an existing corresponding `scopeId` for constrained users. Valid role names and exact capabilities are in PERMISSIONS.md. For password recovery use `{"action":"reset-password","email":"operator@example.test"}`; to disable use `{"action":"disable","email":"operator@example.test"}`. Reset/disable revoke sessions. Generated credential files are `.local/auth/credentials-<id>.txt`; no passwords are printed. The CLI is restricted to the native development database and files inside .local/auth. No extra personal identifiers are collected.

Checks: `npm run test:integration` creates a fresh MySQL schema and runs Phase 2/3 tests; `npm run test:auth:e2e` creates another disposable schema/accounts, starts its own 3011 server and runs real login/master browser tests against the latest build. `npm run test:e2e` retains the foundation browser checks. Never run two browser commands simultaneously because both own 3011. Disposable schemas are retained, not reset; local test credentials stay in ignored .local/auth/e2e.json. Rebuild before browser checks after changing source.

Verified environment: Windows, Node 24.14.0, npm 11.9.0 and Oracle MySQL Community 8.4.11. Run commands from `C:\xampp\htdocs\MooRoute`. Direct dependencies and the npm lockfile are pinned. This is a Next.js application: use its Node server, not `http://localhost/MooRoute` through Apache. `.htaccess` denies Apache access to this repository, including sources and credentials.

## Install

```powershell
node --version
npm --version
npm ci
```

The postinstall hook generates Prisma Client. Generation and the web build do not need a database connection. `.env.example` contains placeholders; never commit a populated `.env`.

## Native Windows MySQL

```powershell
npm run db:setup:windows
npm run db:check
```

The setup downloads Oracle's pinned 8.4.11 Windows archive over HTTPS, verifies its published checksum, and extracts it beneath ignored `.local/`. It initializes a new data directory only when none exists, binds to `127.0.0.1:3307`, and creates separate `moointer_dev` and `moointer_test` databases with randomly generated account passwords. Root is secured using an initialization file before the server becomes ready. The bootstrap SQL is removed after use. Nothing is printed with credential values.

The local `.env` is written only on a fresh successful setup. Subsequent setup calls reuse the existing instance and preserve data and credentials. Existing `.env` or data without a complete local setup causes a safe refusal; investigate rather than deleting or resetting directories. If an occupied port belongs to another process, setup stops without modifying it. Project processes launch with hidden windows, are not registered as Windows services, and have no automatic startup on reboot.

```powershell
npm run db:start:windows
npm run db:stop:windows
```

Start and stop validate the recorded process identity and executable path. Stop requests a clean MySQL shutdown and retains data. Existing XAMPP MariaDB on 3306 is independent. Do not use it as a silent substitute for the required MySQL.

Local files that must remain private:

- `.env`: application/test and optional operator migration connection URLs.
- `.local/mysql/root-client.ini`: operator account configuration.
- `.local/mysql/data/`: database data, certificates and keys.
- `.local/mysql/server.err`: local server diagnostics; inspect locally before sharing, redact sensitive content.

If downloading fails, the remainder of the application can still be built. Record the actual failure and leave database acceptance incomplete. The provided script is a local development option, not a production installation or backup procedure.

## Existing Oracle MySQL option

An existing MySQL 8.4 instance can be used after an administrator creates separate development and disposable test databases, both InnoDB/utf8mb4 with `utf8mb4_0900_ai_ci`, and dedicated scoped users. Copy `.env.example` to `.env` only if `.env` is absent and replace placeholders locally. Encode reserved characters in URL credentials. Root URLs, missing passwords, unsupported URL options and non-MySQL schemes are rejected.

Remote URLs must include `?ssl=true`; the server certificate must validate against the machine's trust configuration. Additional connection query options are deliberately rejected rather than silently ignored. Integration smoke tests accept only a loopback database named `moointer_test` and reject a database name shared with `DATABASE_URL`.

## Phase 2 migrations, synthetic seed and real concurrency tests

With the native MySQL instance running:

```powershell
npm run db:migrate:local
npm run db:migrate:test
npm run db:seed
npm run db:seed
npm run test:integration
```

`db:migrate:local` checks the exact project loopback host/port/database, creates a dedicated development migration account once, saves its generated URL only in ignored `.env`, and runs Prisma `migrate deploy`. It preserves all development data and loads no sample rows. The web account remains SELECT only. A conflicting account/configuration causes safe refusal. The native operator enables `log_bin_trust_function_creators=1` for the project lab's history triggers; no global SUPER grant is given to the migration account. This setting is reapplied after a server restart by `db:migrate:local` or `test:integration`. External MySQL installations need equivalent operator-approved trigger migration privileges.

`db:migrate:test` targets only the validated `TEST_DATABASE_URL` and overrides any development `MIGRATION_DATABASE_URL` in the child process. `db:seed` has the same disposable-only guard. The fixed synthetic namespace creates three active branches plus one inactive fixture branch, pork/chicken, three rounds, three explicitly synthetic vehicles and a published 18-cell plan. Stable source IDs, fixed date/times and a seed manifest make reruns safe; no existing published content is overwritten. Receipt and invalid scenarios are separate integration fixtures. Test-only seeded operator permissions are not production identities.

`test:integration` uses the native operator file to CREATE a new randomly suffixed `moointer_test_run_*` database, grant the disposable test user access only to that schema, apply both migrations, then run the 13 MySQL tests with two independent Prisma clients. It never DROP/RESETs a database. It prints the safe schema name and retains it for inspection. Failed-attempt schemas are retained too. Operators may later remove explicitly inspected disposable schemas; no automated cleanup/reset command is provided.

For an already provisioned external **loopback disposable** database named `moointer_test`, run `db:migrate:test` then `db:seed`. The automatically provisioned fresh-schema concurrency runner specifically requires the documented native Windows setup. Do not point tests at operational databases. Migrate externally managed development/production environments only through their normal reviewed deployment process; no deployment occurred in Phase 2.

Installed Prisma 7 migration generation command used before applying the initial migration:

```powershell
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

The resulting SQL was reviewed and augmented with InnoDB/utf8mb4, CHECK constraints and history triggers. The second migration adds ownership and immutable-history guards. The committed SQL is authoritative: do not regenerate or rewrite applied migrations, and do not use `db push` to bypass them. Prisma configuration reads `MIGRATION_DATABASE_URL` for CLI migrations, falling back to `DATABASE_URL`; web persistence reads only `DATABASE_URL`. Do not print populated URLs or CLI connection errors into shared logs.

## Run the web application

```powershell
npm run dev
```

Open `http://127.0.0.1:3010`. Port 3010 was selected because another application already uses 3000. For a production-mode local preview, stop the development server first:

```powershell
npm run build
npm start
```

Both scripts bind to loopback. The shell exposes no business records and makes no database writes. Authentication and operational flows are later phases. No deployment is included.

## Checks

```powershell
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run db:check
npm run test:db
npm run build
npm run test:install-browser
npm run test:e2e
npm audit --omit=dev
```

Unit tests cover safe configuration, test-database isolation, Bangkok midnight, Buddhist-era formatting and error redaction. The MySQL smoke test creates a connection-local temporary table only in the disposable test database and checks Thai/emoji, DECIMAL and DATE persistence. It does not reset a database or implement the Phase 2 race tests.

Playwright starts the built application on loopback port 3011, requires that port to be free, and closes its own server afterwards. It checks navigation, keyboard tabs, unavailable controls, public-health output and 404 behavior. Screenshots for 1440, 768 and 390 px in all three tab modes are saved to `docs/evidence/phase-1/`; reports/traces are ignored by Git.

No operational tables, seed or applied migrations exist in Phase 1. Schema design and migration commands must be established in Phase 2 after field/relationship review. See [architecture](ARCHITECTURE.md), [API contracts](API_CONTRACTS.md) and [progress](PROGRESS.md).
