# Operations guide

Written 2026-10-06 for operators of the Moointer transport application. Everything marked **Verified** was run on the local Windows lab described in [Phase 8 evidence](evidence/phase-8/VERIFICATION.md). Nothing has been deployed. Items marked **Not verified** or **Decision needed** must be completed before a production release; see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## 1. Components

| Component | Local lab (verified) | Notes |
| --- | --- | --- |
| Web application | Next.js 16 production build, one Node 24 process, `127.0.0.1:3010` | Server-rendered Thai UI and JSON APIs in one process |
| Database | Oracle MySQL 8.4.11, InnoDB, utf8mb4, `127.0.0.1:3307` | Project-owned process under `.local/`; XAMPP MariaDB on 3306 is not used |
| Private files | Folder `UPLOAD_DIR` (default `.local/uploads`) | Consignment attachments only; never inside `public/` |
| Reverse proxy / TLS | None locally | **Not verified.** Required for any non-loopback use |

The application keeps no state in memory that matters across restarts. Sessions, rate limits and idempotency records are in MySQL. Attachments are on the local file system, so a second application instance needs shared private storage.

## 2. Environment variables

Values live only in the ignored `.env` file or the host's secret store. Never commit or log them.

| Variable | Purpose | Rules enforced by the application |
| --- | --- | --- |
| `DATABASE_URL` | Runtime account of the web process | `mysql://` URL; dedicated user (not root); remote hosts must use `?ssl=true` (certificate verified) |
| `MIGRATION_DATABASE_URL` | Operator-only account for `prisma migrate deploy` | Never used by web requests |
| `TEST_DATABASE_URL` | Disposable test databases | Must be a loopback `moointer_test` or `moointer_test_run_*` schema, different from `DATABASE_URL` |
| `APP_ENV` | Authentication mode | Only `local` is implemented; any other value stops authentication (see section 9) |
| `BETTER_AUTH_URL` | Public origin of the application | Exact origin; used for CSRF origin checks and for QR links on labels |
| `BETTER_AUTH_SECRET` | Session signing secret | At least 32 characters, not a placeholder |
| `UPLOAD_DIR` | Private attachment folder | Refused if inside `public`, `.next`, `src` or `app` |
| `DATABASE_POOL_SIZE` | Connections per application process | 1–50, default 5 (see section 8) |
| `CONSIGNMENT_CUTOFF_LEAD_MINUTES` | Minutes before loading start (or departure) when consignments close | 0–1440, default 0; proposed value pending owner decision |

## 3. Local startup (verified)

```powershell
npm ci
npm run db:setup:windows      # first time only: creates the isolated MySQL instance and local credentials
npm run db:start:windows      # later sessions
npm run db:migrate:local      # applies all reviewed migrations with the migration account
npm run auth:setup:local      # roles, capabilities, least-privilege runtime grants, local admin/dispatcher/supervisor
npm run db:check              # MySQL version, engine, charset, collation and Thai round trip
npm run build
npm start                     # http://127.0.0.1:3010
```

Check `GET /api/health/live` returns `{"status":"ok"}`. Stop MySQL with `npm run db:stop:windows`.

## 4. Users, roles and master data

1. `npm run auth:setup:local` creates the seven roles and one administrator, dispatcher and supervisor. Passwords are written once to ignored `.local/auth/*-credentials.txt`.
2. Sign in as the administrator and create master data in this order: ประเภทรถ, สภาพการเก็บรักษา, ข้อมูลรถ, ข้อมูลสาขา (with printable address and contact), หมวดสินค้า (PORK and CHICKEN are required), คลังต้นทาง, แผนก, พนักงานขับรถ. Branches and vehicles can also be imported under นำเข้าข้อมูล.
3. Create further accounts with a request file in `.local/auth/` and `npm run auth:account:local -- .local/auth/account-request.json`:
   - `{"action":"create","email":"...","name":"...","role":"REQUESTER","scope":"DEPARTMENT","scopeId":"<department id>"}`
   - Roles and scopes: DISPATCHER and SUPERVISOR use `GLOBAL`; WAREHOUSE uses `WAREHOUSE`; BRANCH_RECEIVER uses `BRANCH`; DRIVER uses `DRIVER`; REQUESTER uses `DEPARTMENT`.
   - `{"action":"reset-password","email":"..."}` and `{"action":"disable","email":"..."}` revoke all sessions of that account.
4. The exact capability matrix is in [PERMISSIONS.md](PERMISSIONS.md). The administrator can do and see everything, including other users' consignment drafts (read-only), by owner decision D215. Give this role to as few people as possible: one administrator account can prepare and publish its own plan.

There is no web screen for creating users or editing roles. This CLI works only against the local development database.

## 5. Migrations

Migrations are forward-only SQL files in `prisma/migrations` (eight as of this guide). There are no down migrations.

**Prerequisite: trigger creation.** Five migrations (001, 002, 005, 006, 007) create history-guard triggers. When the MySQL server has binary logging enabled (the default in MySQL 8.4), an account without the SUPER privilege can create triggers only if `log_bin_trust_function_creators` is ON; otherwise the migration stops with MySQL error 1419. Check with `SELECT @@log_bin, @@log_bin_trust_function_creators;`. For a deployed server the database administrator must choose one, record it, and set it in the server configuration rather than at run time:

- set `log_bin_trust_function_creators=ON` in the server configuration (the triggers only raise errors, so they are deterministic and safe to replicate), or
- run migrations with an account that holds SUPER (deprecated in MySQL 8.4; not recommended).

In the local lab, `npm run db:migrate:local`, `npm run test:integration` (and the browser test scripts) and `npm run test:load` set the flag on the lab server at run time (decision D206); the migration and load-test scripts print a notice when they do. `npm run db:backup:verify` does not need or change it.

The account that runs a migration becomes the **DEFINER** of the triggers it creates, and MySQL runs each trigger with that account's privileges. Keep the migration account (`moointer_migrate` locally) and its privileges on the application database: if it is dropped or loses TRIGGER or SELECT there, every write that fires a guard fails with MySQL 1449 or 1142.

1. Take and verify a backup (section 6).
2. Stop the web process, or accept a short maintenance window. Migration 007 drops and recreates 42 history-guard triggers one at a time; each guard is absent only between its DROP and CREATE, so no writes should run during it.
3. Run the migration with the migration account: `npm run db:migrate:local` locally, or `npx prisma migrate deploy` with `MIGRATION_DATABASE_URL` set for another environment.
4. Apply the runtime grants from `scripts/runtime-grants.ts` to the web account (`npm run auth:setup:local` does this locally). The web account has no DDL rights and no DELETE on history tables.
5. Start the web process and check liveness, sign-in and one read page.

Never run a reset or `migrate dev` against a database that holds real data, and never edit an applied migration.

**Rollback limitations.** A failed migration must be fixed forward or the database restored from the backup taken in step 1; restoring loses every change made after that backup. Application rollback to an older build is only safe if no newer migration has been applied; this was not rehearsed.

## 6. Backup and restore

**Verified locally:** `npm run db:backup:verify` (optionally `-- --database=<name>`) writes a consistent dump to ignored `.local/backups/`, restores it into a new disposable schema and checks that the copy is identical **and usable**: tables, trigger definitions, constraints, row counts and `CHECKSUM TABLE` per table, that each trigger definer account exists with TRIGGER and SELECT on the copy, and that a rolled-back no-op update on every guarded table behaves exactly as on the source. For the disposable copy the tool first grants the definer the same schema privileges it holds on the source, as a real restore procedure must. It never drops or overwrites anything. Before migration 007 the dump could not be restored at all; until the Phase 8 review the tool also missed copies whose guarded writes failed.

To check a restore done by hand, run `npm run db:backup:verify -- --database=<source> --check-restored=<restored schema>` (the restored schema must be a `moointer_test_run_*` name locally). It changes nothing. On a live source, session and rate-limit tables may legitimately differ by the time of the check.

Equivalent manual commands for another MySQL 8.4 server:

```text
mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces --result-file=<file> <database>
mysql <new empty database> < <file>
```

Before restoring on another server:

1. Create the migration account (the trigger DEFINER recorded in the dump) and grant it its privileges on the target database, including TRIGGER and SELECT. Without it the restore succeeds but every guarded write fails afterwards.
2. Create the runtime account and apply the grants from `scripts/runtime-grants.ts`.
3. Restore with an account that may create objects for another definer (SET_ANY_DEFINER, or the server's administrative account).
4. Check one allowed and one forbidden write before opening the application, for example inside a transaction that is rolled back: `UPDATE Trip SET id=id ORDER BY id LIMIT 1` must succeed and `UPDATE TripStop SET id=id ORDER BY id LIMIT 1` must fail with `IMMUTABLE_HISTORY` (on a database that has trips).

What a complete backup must contain:

- the MySQL database (all application data, sessions, audit, label versions, import history);
- the `UPLOAD_DIR` folder (attachment files are **not** in the database; only their metadata and SHA-256 are);
- the environment configuration from the secret store;
- the database accounts and their grants (migration account as trigger definer, runtime account), which are not part of the dump.

Restoring the database without the matching upload folder leaves attachment rows whose files are missing; downloads then fail with a generic error.

**Not set up:** scheduled backups, off-machine copies, retention, and a restore drill on the real environment. The proposed targets (RPO 24 hours, RTO 4 hours) need a daily scheduled dump plus file copy and a timed restore on the real hardware before they can be accepted.

## 7. Monitoring and logs

| Signal | How | Meaning |
| --- | --- | --- |
| Liveness | `GET /api/health/live` → 200 `{"status":"ok"}` | The web process answers. It does not check the database |
| Database readiness | `npm run db:check` on the host (exit code 0/1) | MySQL reachable with expected version, engine, charset and collation |
| Unexpected API errors | One JSON line on stderr: `{"level":"error","time":"...","event":"api.unexpected_error","name":"...","code":"...","driverCode":"...","at":"file:line"}` | Something failed outside the expected business rules; users saw the generic Thai 503 message |
| Sign-in backend failure | Same line format with `"event":"auth.unavailable"` | Sign-in or sign-out could not reach the database or the authentication library failed; users saw the Thai 503 message, not a wrong-password message |
| Session check failure on a page | Same line format with `"event":"page.session_unavailable"` | A page could not verify the session (usually the database); the visitor was treated as signed out |
| Page render errors | Next.js writes the error and a digest to stderr | Users saw the Thai error page |

The application log lines contain no messages, SQL, parameters, cookies or personal data. Collect the process's stdout and stderr with the host's log tooling. There is no metrics endpoint, no request log and no alerting; these are **Not verified** items for a real environment. Suggested alerts: liveness failing, any of the three events above, database connection errors (`code` or `driverCode` values), and disk usage of the database and upload folders.

**Database outage, as observed in the lab:** liveness stays 200, public pages render, sign-in answers 503 in Thai, signed-in requests answer 503 or fall back to the sign-in page, and each affected request waits about 5 seconds for a connection first. Run `npm run db:check` to confirm and restore the database service. The connection pool is expected to reconnect by itself; recovery without an application restart was not tested, so check sign-in afterwards and restart the web process if it still fails.

Business-level checks an operator can do in the UI: the daily plan for tomorrow is published with no missing coverage cells; no consignment has stayed in พบปัญหา for long; import batches are either committed or rejected.

## 8. Capacity

Measured on 2026-10-06 with 100,000 synthetic trips and 50 simulated users searching for 60 seconds (details in [Phase 8 evidence](evidence/phase-8/VERIFICATION.md) and `evidence/phase-8/load-test.json`):

| Load | Throughput | p50 | p95 | p99 | Errors |
| --- | --- | --- | --- | --- | --- |
| 50 users, about 1 s between requests | 49 req/s | 18 ms | 40 ms | 195 ms | 0 |
| 50 users, no pause between requests | 138 req/s | 361 ms | 413 ms | 484 ms | 0 |

These come from one machine running the load generator, the web process and MySQL together with a 128 MB InnoDB buffer pool, so they are a baseline and not a capacity promise. Only search was load-tested; planning, receipts and label issue were not. Re-run `npm run test:load` on the real hardware before accepting any performance target.

In the lab the single Node process was the limit (about 135 requests per second); `DATABASE_POOL_SIZE` 5 and 20 gave the same result, so the default of 5 is kept. MySQL `max_connections` (151 in the lab) must exceed pool size × number of application processes plus operator connections.

**Lab housekeeping.** Test runs keep their disposable `moointer_test_run_*` schemas for inspection, and `npm run db:backup:verify` keeps its dump and restored copy. On 2026-10-06 there were 152 such schemas (about 1.3 GB) and 181 MB of dumps under `.local/backups/`. They can be dropped at any time; never drop `moointer_dev`.

## 9. Security configuration

- **Authentication.** Only local password accounts on a loopback origin are implemented (`APP_ENV=local`). Any other `APP_ENV` makes authentication refuse to start rather than fall back. **Decision needed:** the company identity provider or an approved deployed account mode. This blocks a production release.
- **Sessions.** Database-backed, 8 hours, refreshed every 30 minutes of use, HttpOnly, SameSite=Lax, Secure when the origin is HTTPS. IP address and user agent are not stored. Sign-in is limited to 5 attempts per minute, counted in one shared bucket because no trusted proxy header is configured.
- **Request protection.** Every mutation checks the exact Origin, a JSON or multipart body limit, an idempotency key and the session actor's capability and row scope inside the transaction.
- **Headers.** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and in production builds a Content-Security-Policy restricting sources to the application itself. HSTS must be added by the TLS proxy.
- **Private files.** Signature-checked JPG/PNG/PDF up to 10 MB, stored under opaque names outside the web root and served only through an authorized route as downloads. There is no malware scanning.
- **Secrets.** `.env*` and `.local/` are ignored by Git; the repository scan for current secret values found none. Rotating `BETTER_AUTH_SECRET` signs every user out.
- **Database account.** The web account can read the schema, insert into history tables and update lifecycle tables; it cannot delete history or change the schema. Changes to frozen columns are rejected by database triggers.

## 10. Routine operation

- **Daily plan.** A dispatcher prepares the plan for a service date; a supervisor publishes it. Publication is blocked until every active branch has pork and chicken in rounds 1–3 and vehicles do not overlap. A replacement plan must state where every linked consignment moves.
- **Consignments.** Requester submits → dispatcher assigns → warehouse receives and loads → departure → branch receives → close. Labels are issued after assignment and are revoked automatically by reassignment, cancellation, vehicle change or address correction.
- **Printing.** Print at actual size (100%) with no margins. Check alignment on the real printer before first use.
- **Imports.** Stage, review, then commit. A batch either applies completely or not at all.

## 11. Known limitations

- No deployed authentication mode, TLS termination, scheduled backup, monitoring stack or alerting exists yet.
- History tables (audit log, idempotency records, events, label versions, import rows) and expired rate-limit rows grow without a retention or archive job. Database guards forbid deleting most of them, so a retention policy needs a designed migration.
- One application instance is assumed: attachments are local files, and the sign-in limit is one shared bucket.
- Consignments already in motion cannot be moved by re-planning; a published day with loaded or completed consignments cannot be replaced until an operational change workflow exists.
- Operational values are proposals awaiting the owner: round time windows, consignment cutoff, capacity units, turnaround buffers, visibility rules (D209–D211), and label formats on the real printer.
- XLSX import reads the first worksheet's text and numbers only. Uploads are not malware-scanned. The source PDF of the transport sheet was never supplied, so no real schedule was transcribed or imported.
- Availability 99.5%, RPO 24 hours and RTO 4 hours are proposed planning targets only. They are not measured and not accepted.
