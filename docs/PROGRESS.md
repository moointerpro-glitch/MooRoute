# Project progress

## Development server start — 2026-10-07

Owner requested `npm run dev`. Started the repository script in a hidden background process at http://127.0.0.1:3010; Next.js reported ready. Ignored logs and launcher PID: `.local/dev-server/`.

Checks: `npm run dev` startup PASS; `Invoke-WebRequest -Uri http://127.0.0.1:3010/api/health/live -UseBasicParsing -TimeoutSec 30` and the same command for `/login` both returned HTTP 200; `git diff --check` PASS. No tests rerun, schema/data change, migration, deployment or phase advancement. Next.js automatically appended its guide block to AGENTS.md and updated next-env.d.ts imports to `.next/dev/types/`. Existing untracked account/profile work and migration 009 preserved, not reviewed or applied. Affected tracked paths: AGENTS.md, next-env.d.ts, docs/PROGRESS.md and docs/HANDOFF.md. No startup blocker observed. Next three actions: (1) open the local URL; (2) exercise the intended flow using existing accounts; (3) report a reproducible defect if encountered. Earlier relocation/release limitations remain.
## Creating a daily plan explanation — 2026-10-06

Owner requested instructions for creating a plan. Reviewed the current planning workspace, trip editor/date fields, page authorization and role-based back-office entry. Explained dispatcher/admin manual creation (open service date, add trips/stops/categories/times, apply edits, save a reasoned draft), optional effective-template generation, coverage/conflict review and supervisor/admin publication. The trip editor apply button does not persist the plan; save-draft is required. No real plan was created or published, no application/schema/data change and no tests rerun. Only PROGRESS/HANDOFF notes updated. Next walkthrough actions: (1) verify active master records and choose service date; (2) save a complete draft and resolve missing cells/vehicle conflicts; (3) supervisor reviews and publishes with a reason and confirmation. Existing relocation/release limitations remain.

## Daily-plan deletion explanation — 2026-10-06

Owner asked whether/how the current system deletes a daily plan. Source review confirms no whole-plan DELETE action or UI. Dispatcher/admin may remove never-published, never-assigned trips from a new draft using the draft-trip removal button; saving retains old revisions and Trip identities. Previously published or consignment-linked trips must remain and use cancellation in a replacement revision. Publication still requires complete coverage, audited reassignment of eligible consignments and blocks movement/completed states. Supervisor publishes; administrator also has publication capability.

Checks: repository instructions/status, package scripts/migration inventory, current requirements/decisions, planning UI/API/services and existing Phase 4 regression source reviewed with Get-Content/rg. No tests rerun, no plan/data/application/schema changes or new decisions. Only PROGRESS/HANDOFF notes changed. Next actions if the owner wants to exercise the flow: (1) select the date and verify draft/published state; (2) remove only eligible draft trips or prepare replacement cancellations and reassignment; (3) review coverage and publish only a valid replacement. Existing folder/release limitations remain.

## Shared access, workflow guide and product names — 2026-10-06

Owner asked to implement the discussed menu/read/consignment policy and change product/folder names. D216 implements capability-filtered navigation/login destinations, common company-wide published trip/general branch reads for all seven predefined roles, own consignment creation with explicit department membership, contact-safe form options, scoped history/files, self-review rejection including atomic plan publication, and disabled prerequisite actions with Thai reasons. D215 administrator union/draft reads preserved. Thai guide now contains end-to-end diagrams and the seven duties. D217 updates title/manifest/UI/application/npm names. No migration or operational data reset; role links and nine known synthetic local department memberships updated additively with audit, passwords retained.

Affected paths: auth permissions/resource-policy/provisioning, trip-search/consignments/planning-reassignment/http, session API/navigation/login/header/form/actions, layout/manifest/guide/CSS, operator sync/provision/fixture/rename scripts, package metadata, focused integration/browser tests and current policy/setup documentation. Existing unrelated owner changes/assets preserved; no commit/deployment. Actual Git HEAD b96abc0; work remains uncommitted.

Checks on 2026-10-06: lint/typecheck/build PASS; unit 27/27; existing real-MySQL integration 39/39 and isolated new access suite 3/3; shell 5/5; least-privilege browser auth 4/4 and labels 6/6 passed during staging, then affected planning 2/2, search 7/7 and consignment 7/7 passed after fixing expectations. Audit zero vulnerabilities. Backup restore verified twice; MySQL readiness and restarted preview live. Initial failures and exact commands/schemas are recorded in [access verification](evidence/access-policy/VERIFICATION.md). Earlier screenshot evidence restored; separate new screenshots reviewed. Load, real deployment and physical devices not tested anew.

Folder rename is NOT complete: two Windows sharing violations from open editors/viewers/coding tools. Config restored, MySQL and preview running at C:/xampp/htdocs/MooRoute. Concrete outside-workspace helper C:/xampp/htdocs/rename-moointer-transport.ps1 (source scripts/rename-workspace.ps1) prepared and -CheckOnly/parser passed. Full relocation awaits closing programs holding workspace handles; .env/data remain intact. Next three actions: release handles and execute helper; reopen moointer-transport and verify its completion record/MySQL/preview; exercise the seven mock-account flows for owner acceptance. Existing release limitations remain.

## End-to-end workflow explanation — 2026-10-06

Owner requested easy Thai diagrams of requirements and all seven account workflows. Reviewed AGENTS/HANDOFF/PROGRESS, PROJECT_CONTEXT, DECISIONS (including D213/D214), PROMPTS Phases 4–7, UI_SPEC/TEST_MATRIX, PHASE6_DESIGN, PERMISSIONS, the executable consignment transition matrix, role capabilities and the mock-up seed contract. Explained daily planning/publication, consignment handovers/receipt/closure, exception paths and role-specific entry points. No implementation or account change authorized by this request.

Checks: `git status --short`, `rg --files`, migration directory inventory and `Get-Content -Encoding utf8` / `rg -n` source review completed. No application tests or live database/account audit run. Affected paths: docs/PROGRESS.md and docs/HANDOFF.md only; no schema, migration or database change, no new decision and no deployment. Existing release limitations remain. Next three actions: (1) owner can exercise dispatcher → supervisor publication using mock masters; (2) exercise requester → dispatcher → warehouse → driver → branch receipt/close with matching scopes; (3) exercise partial receipt, issue resolution/return and label replacement, recording any reproducible defects for an explicit fix request.

## Role explanation review — 2026-10-06

The owner requested an explanation of existing user roles, not defect repair or a new phase. Reviewed `src/server/auth/permissions.ts`, `resource-policy.ts`, the consignment transition matrix and services, label/import/planning authorization, `docs/PERMISSIONS.md` and `docs/OPERATIONS.md`. Confirmed seven predefined roles with explicit capabilities and persisted row scopes. Administrator has master/import/identity duties without automatic operational access; account provisioning remains local operator tooling, with no web role editor.

Checks: `git status --short`, repository/migration inventory and `rg -n`/`Get-Content -Encoding utf8` source inspection completed on 2026-10-06. No application tests were run; this was a source review, not a live account authorization audit. Only PROGRESS/HANDOFF notes changed; no application, schema, migration or database change, no new decision, and no repair or deployment attempted. Existing release blockers remain. Next actions: (1) use the explanation to confirm staff role/scope assignments; (2) request any needed role or account-management changes explicitly; (3) continue the existing release actions only when authorized.

Last updated: 2026-10-06
State: Phases 1–8 complete in the local lab. The Phase 8 review findings (R1–R7) were fixed and verified on 2026-10-06.
Active phase: none. PROMPTS.md ends at Phase 8. No deployment or publication is authorized. Phase 8 changes are uncommitted for review.

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 Foundation | Complete | [Verified shell, real MySQL and checks](evidence/phase-1/VERIFICATION.md) |
| 2 Data and invariants | Complete | [48 models, two migrations, real MySQL invariants and 13 integration tests](evidence/phase-2/VERIFICATION.md) |
| 3 Authentication and masters | Complete | [Real local authentication, scoped Thai masters and checks](evidence/phase-3/VERIFICATION.md) |
| 4 Daily planning | Complete | [23 MySQL tests and planning browser evidence](evidence/phase-4/VERIFICATION.md) |
| 5 Thai route search | Complete | [6 MySQL search tests, 6 browser tests and screenshots](evidence/phase-5/VERIFICATION.md) |
| 6 Consignments | Complete | [4 MySQL lifecycle tests, 5 browser tests, transition matrix](evidence/phase-6/VERIFICATION.md) |
| 7 Printing and imports | Complete | [3 MySQL tests, 6 browser/PDF tests, print files](evidence/phase-7/VERIFICATION.md) |
| 8 Release verification | Complete (local lab) | [T01–T24, load test, backup restore, operations guide](evidence/phase-8/VERIFICATION.md); [review and fixes](evidence/phase-8/REVIEW.md) |

Allowed status values: Not started, In progress, Blocked, Complete. Record the reason for Blocked and acceptance evidence for Complete.

## Environment

- Workspace: C:/xampp/htdocs/MooRoute, Git branch master. Commit 3c5411e established placeholder .env.example; 7cd31ae records Phase 2 schema, both reviewed migrations, field dictionary/ER/design and the placeholder migration-account example. Other implementation and pre-existing specification files remain uncommitted/untracked for review. No remote or deployment was created.
- Runtime: Node 24.14.0 / npm 11.9.0. Exact Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Tailwind 4.3.3 and Prisma 7.10.0 dependency pins with package-lock.json. Details in docs/ARCHITECTURE.md.
- Database: independent Oracle MySQL 8.4.11 on 127.0.0.1:3307, InnoDB, utf8mb4, utf8mb4_0900_ai_ci. Separate moointer_dev/moointer_test databases and scoped users. XAMPP MariaDB 10.4.32 on 3306 was not used or modified.
- Application: production-mode local preview running at http://127.0.0.1:3010 at handoff. Port 3000 remains occupied by an unrelated application. Playwright used its own temporary server on 3011.
- Schema: 48 Prisma models and two forward migrations applied to moointer_dev and disposable test databases. Development contains no synthetic operational rows; moointer_test contains the explicitly synthetic complete seed. Per-run disposable schemas retain integration evidence. No existing-data migration or reset occurred.
- References: standalone JPG/PNG originals are now present in the root and copied unchanged to ignored references/. SHA-256 matches were verified. Source PDF still missing. See references/README.md; reference data was not imported or served publicly.

## Verification log

| Date | Phase | Exact command or manual check | Result | Evidence |
| --- | --- | --- | --- | --- |
| 2026-10-05 | All | Application checks | Not run | Specification only |
| 2026-10-06 | None | `rg --files --hidden -g '!.git' -g '!node_modules' -g '!vendor'`; `Get-ChildItem -Force \| Select-Object Mode,Length,Name` | Completed | Specification-only inventory; no nested AGENTS.md or application files found. |
| 2026-10-06 | None | `git status --short` | Failed | Fatal: not a git repository. No Git operations were performed. |
| 2026-10-06 | None | Manual content review: all 12 Markdown files read using PowerShell; DOCX word/document.xml read with .NET ZIP/XML APIs; all eight embedded PNGs inspected with view_image | Completed | DOCX contains 783 body/table paragraphs, 22 tables and eight images. Content review only; no full-page rendering or print-layout verification. Differences recorded in D201. |
| 2026-10-06 | All | Application startup, lint, type checking, tests and MySQL connection | Not run | No application or package scripts exist; user requested study only. Runtime/database availability was not tested. |
| 2026-10-06 | 1 | `npm ci`; `npm run db:validate`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build` | Passed | Reproducible install, valid Prisma configuration, lint/strict types, 7 unit tests and production build. Earlier failures/fixes retained in the detailed verification record. |
| 2026-10-06 | 1 | `npm run db:setup:windows`; `npm run db:stop:windows`; `npm run db:start:windows`; `npm run db:check`; `npm run test:db` | Passed | Real Oracle MySQL, retained data on restart, idempotent setup, Thai/emoji/DECIMAL/DATE persistence in a separate disposable database. |
| 2026-10-06 | 1 | `npm run test:install-browser`; `npm run test:e2e` | Passed | 5 browser tests; screenshots of all three tabs at 1440/768/390 px. Representative manual visual inspection completed. |
| 2026-10-06 | 1 | `npm start`; GET http://127.0.0.1:3010/api/health/live | Passed | Local production preview ready; minimal status JSON returned. |
| 2026-10-06 | 1 | `npm audit --omit=dev`; `npm audit --json`; secret/ignore checks | Passed with documented development finding | Production audit has zero findings. Full audit retains four lint-chain advisory entries. Generated credentials are ignored and absent from Git-visible source/config/docs. |
| 2026-10-06 | 1 recheck | `node --version`; `npm --version`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run db:validate`; `npm run db:check`; `npm run test:db`; `npm run test:e2e`; `npm audit --omit=dev` | Passed | Repeated Phase 1 request verified against existing implementation: 7 unit tests, 5 browser tests, real MySQL persistence, zero production audit findings. No additional application/schema change needed; screenshots refreshed. Existing production build used for browser checks, not rebuilt in this recheck. |

Append meaningful evidence; remove stale summaries only after preserving useful history elsewhere. Do not include secret connection strings, production contact details or authentication tokens.

## Phase 2 completion — 2026-10-06

Implemented: reviewed field dictionary/ER/design, 48 relational models, two migrations with CHECK/FK/history triggers, persisted capability/scope checks, six-cell coverage, guarded immutable revisions/publication, sorted vehicle locks and overlap validation, optimistic updates, exact Decimal receipt balances, append-only events and idempotent deadlock retries. Seed and invalid fixtures contain synthetic data only.

Verified: `npm run db:generate`, `npm run db:validate`, `npm run db:migrate:local`, `npm run db:migrate:test`, `npm run db:seed` twice, `npm run test:integration` (13/13), `npm run lint`, `npm run typecheck`, `npm test` (7/7), `npm run build`, `npm run db:check`, `npm run test:db`, `npm run test:e2e` (5/5). See [exact evidence and corrected failures](evidence/phase-2/VERIFICATION.md).

Not implemented/run: full T08 cancellation/merge/audited reassignment flow; the Phase 2 guard preserves assignments by rejecting affected replacements. Authentication UI/session, master CRUD, operational screens, full search, full consignment lifecycle, printing/private downloads/import commits, production load/restore/deployment remain later phases. T04/T06/T08/T13 have explicitly limited subset evidence. No Phase 2 environment blocker remains; source PDF and real operational settings remain unresolved for later work.

Affected paths: prisma/schema.prisma and migrations; src/server/domain and services; environment validation and Prisma config; scripts/migrate-local.ts, migrate-test.ts, run-integration.ts, seed.ts; tests/fixtures and integration; package scripts, placeholder .env.example; schema/design/API/setup/architecture/test/status/decision documents. Existing specifications and Phase 1 UI were preserved.

Next three actions:
1. On an explicit Phase 3 request, select the authentication provider/session boundary and implement trusted actor resolution with persisted capabilities/scopes.
2. Build master CRUD with archive/effective dates and the common eligibility/vehicle guard protocol; grant narrowly scoped runtime writes only with authenticated mutation endpoints.
3. Extend the T13 authorization matrix and validate master changes against published history; retain the confirmed six-cell rule and unresolved source facts.

## Open defects and blockers

No unresolved critical Phase 1 defect. Full npm audit retains four high entries for one upstream braces advisory in lint-only dependencies using trusted local patterns; production audit reports zero. Track a compatible upstream fix before release hardening. Source PDF remains missing but does not block foundation acceptance. D201 source differences still need phase-specific reconciliation. The phase-specific evidence above supersedes this historical Phase 1 summary. Phase 8 (2026-10-06) re-ran T01–T24 locally; see the Phase 8 section below for the current blockers. Production release acceptance is not claimed.

## Review session scope

The earlier study-only session updated the three status/decision files without implementation. The user subsequently explicitly selected Phase 1; D202 records the expanded authorization. Phase 1 added src/app, src/components, src/lib, src/server, prisma/schema.prisma, prisma.config.ts, package/configuration files, scripts, unit/browser tests, setup/architecture/API documentation and visual evidence. README.md and TEST_MATRIX.md now point to actual foundation evidence while retaining the original requirements. No operational schema migration or seed was performed. See [detailed commands, failures, fixes and screenshots](evidence/phase-1/VERIFICATION.md) and the next three actions in docs/HANDOFF.md.

## Phase 3 completion — 2026-10-06

Implemented: Better Auth 1.7.7 password/database sessions in a secure local-account path, seven persisted role/capability sets, DRIVER scope, Thai master lists/search/pagination/forms, full vehicle/address fields, aliases, optimistic writes, dependency-aware deletion/archive and actor/reason/before/after audit. No production bypass. Migration 003 adds four auth tables and missing lifecycle fields; 52 models total. Applied forward to local development/test databases; runtime grants are limited to implemented auth/master services.

Verified: db:generate, db:validate, db:migrate:local, db:migrate:test, auth:setup:local (safe rerun), lint, typecheck, build, db:check, 8 unit tests, 18 real MySQL integration tests, 4 authenticated browser tests, 5 foundation browser tests, production audit (zero), 101-file secret-value scan and manual desktop/mobile visual inspection. See [exact evidence](evidence/phase-3/VERIFICATION.md). The final integration run also proves an optional category archived after drafting prevents publication.

No Phase 3 local-environment blocker. Not run: company SSO/production deployment configuration, external IdP, MFA/email recovery, production load/restore. Local account CLI create/reset/disable is implemented; automated tests verify its shared provisioning service/session revocation behavior, while the standalone reset/disable CLI commands were not executed against the retained local administrator. Full T13 file/print/QR endpoint tests await those unimplemented later-phase endpoints; common row guards are tested now. Source PDF and uncertain operational source data remain deferred.

Affected paths: src/server/auth, services/masters.ts, prerequisite plan validation, master definitions, Thai login/admin components/pages and authenticated APIs; schema/migration 003; local auth/account/browser-fixture scripts; package/lock/config; permission matrix, schema/API/setup/architecture/decision/status docs; unit/integration/browser tests and six Phase 3 screenshots. Prior source work preserved, no deployment/reset or source import.

Next three actions: (1) On a Phase 4 request, implement the dated planning UI using the existing guarded services. (2) Add audited assignment-aware revision/reassignment workflows without weakening coverage or history. (3) Extend T01–T03/T07–T08/T12/T21 and relevant authenticated UI checks; resolve operational time/buffer data before production use.

## Phase 4 completed — 2026-10-06

Route/ordered-stop and effective-template revision editors, idempotent generation, Thai daily planner and coverage matrix, add/edit/copy/reduce/merge/cancel/permitted draft removal, conflict/capacity/consignment preview, atomic publication/reassignment, label revocation and revision audit implemented. Historical stop names preserved. Migration 004 additive; no dependency changes or source-data invention. Separate local planning roles provisioned without escalating administrator. Latest local preview on 3010.

Verified: lint/typecheck/build/schema/database; 8 unit, 23 real MySQL integration, 2 planning browser, 4 auth/master browser and 5 shell tests. Zero production audit findings; current generated-secret scan passed. Actual limited-runtime account smoke passed for both local roles. See [exact evidence and corrected failures](evidence/phase-4/VERIFICATION.md). No unresolved critical local Phase 4 defect. Not run: production/load/restore/SSO and later phase flows. In-motion reassignment remains blocked deliberately.

Next three actions: review/commit the application checkpoint; implement Phase 5 only on explicit request; later connect consignment/label workflows to the guarded reassignment service and extend their scoped tests.

## Phase 5 completed — 2026-10-06

Implemented the authenticated Thai search page (metric cards, date/round/category/trip-type filters, three keyboard tabs, branch combobox with alias autocomplete and ambiguity choice, data-derived time chips, inclusive range with Thai validation, count badge, sorting, pagination, loading/empty/error/not-published states), trip detail, all-trips list, branch directory and a read-only consignment hand-off. Server queries use same-stop EXISTS, OR within groups and AND between groups, one row per trip, scoped facets and permission-filtered contacts. Public `/` keeps an honest login shell. No schema, migration, grant or dependency change. Decision D209.

Verified on 2026-10-06: lint, typecheck, build, db:validate, 13 unit, 29 real MySQL integration (6 new), 6 search browser, 5 shell, 4 auth and 2 planning browser tests; production audit zero; secret-value scan zero hits. Screenshots at 1440/768/390 for every search mode, detail and directory, manually compared with the reference. See [evidence](evidence/phase-5/VERIFICATION.md), including four corrected failures. Local preview on 3010 restarted on the new build; the development database still has no published plans, so it shows the Thai "not published" state.

Not run: load test of search p95 (D108), assistive-technology screen-reader pass, production deployment. Consignment submission remains Phase 6.

Next three actions: review and commit Phase 5; confirm D209 search scope and contact visibility with the operating owner; on an explicit Phase 6 request, build consignment submission on the eligibility pre-check and re-validate cutoff/limits server-side.

## Phase 6 completed — 2026-10-06

Implemented the Thai ฝากของส่งรถ form (sections per UI_SPEC, draft/submit, attachments), dispatcher review (reject/assign/reassign/cancel with eligible-trip list, cutoff and capacity), warehouse receipt, loading and per-trip departure, branch package-ID/scan and detailed-quantity receipt, issues with preserved movement state, supervisor returns/resolutions/corrective receipt, close, scoped history with CSV export, and private attachment upload/download. Executable transition matrix and design: [PHASE6_DESIGN.md](PHASE6_DESIGN.md); decision D210. Additive migration 005 (53 models, five migrations) applied to moointer_dev after a verified backup and restore rehearsal. Grants extended without DELETE on history. Warehouse and department master screens added.

Verified on 2026-10-06: lint, typecheck, build (no warnings), prisma validate; 19 unit and 33 real MySQL integration tests (4 new); 5 consignment, 6 search, 2 planning, 4 auth and 5 shell browser tests; production audit zero; secret scan zero hits. Screenshots at 1440/768/390 inspected. Ten corrected failures are in the [evidence](evidence/phase-6/VERIFICATION.md). Preview on 3010 restarted on the new build.

Not run: load test, screen-reader pass, malware scanning of uploads, retention policy. Label issue/print/QR/manifests are Phase 7. Backup restore needs a trigger normalization (Phase 8 follow-up).

Next three actions: review and commit Phase 6; confirm D209/D210 operational values (cutoff lead, weights/capacity units, visibility) with the owner; on an explicit Phase 7 request, build label versions, print layouts and QR lookup on the existing snapshots and revocation.

## Phase 7 completed — 2026-10-06

Implemented immutable label versions with issue, reprint logging, automatic revocation (reassignment, cancellation, vehicle change through plan replacement, address correction), authenticated QR lookup with replacement information, actual-size Thai print pages for A4 four-up and 100 × 150 mm, watermarked samples for incomplete addresses, per-trip manifests, and staged CSV/XLSX imports for branches, vehicles and schedule templates (template download, mapping, Thai row errors, duplicate review, hash + edition idempotency, single-transaction commit, frozen history). Design: [PHASE7_DESIGN.md](PHASE7_DESIGN.md); decision D211. Additive migration 006 (53 models, six migrations) applied to moointer_dev after a verified backup. New pinned dependencies: qrcode-generator 2.0.4, jsqr 1.4.0 (dev).

Verified on 2026-10-06: lint, typecheck, build, prisma validate; 24 unit and 36 real MySQL integration tests (3 new); 6 label/import, 5 consignment, 6 search, 2 planning, 4 auth and 5 shell browser tests; production audit zero; secret scan zero hits. Print sizes, PDF page counts, QR decode and long-address fit are asserted. Six corrected failures are in the [evidence](evidence/phase-7/VERIFICATION.md). Preview on 3010 restarted on the new build.

Not run: physical printer and scanner checks, load test, screen-reader pass. Phase 8 release verification is not started.

Next three actions: review and commit Phase 7; test both label formats and QR scanning on the real printer and devices, and confirm D209–D211 with the owner; on an explicit Phase 8 request, run the full acceptance matrix, fix the backup-restore trigger normalization and prepare operations and release documents.

## Phase 8 completed — 2026-10-06

Scope: end-to-end verification and release preparation only. No deployment. Added migrations `202610060007_restorable_triggers` and `202610060008_audit_lookup_index` (applied to moointer_dev after a verified backup), `src/server/logging.ts`, security headers and production CSP in `next.config.ts`, `DATABASE_POOL_SIZE`, `scripts/runtime-grants.ts`, `scripts/backup-verify.ts`, `scripts/staging-rehearsal.ts`, `scripts/load-test.ts`, [OPERATIONS.md](OPERATIONS.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and D212.

Defects corrected: unrestorable mysqldump triggers; missing audit lookup index; search result cleared by a superseded response (intermittent keyboard focus loss, `src/components/trip-search.tsx`); silent sign-in and session failures when the database is unreachable (`src/app/api/auth/[...all]/route.ts`, `src/server/auth/session.ts`); no operational error log; no CSP.

Verified 2026-10-06: `npm run typecheck`, `npx prisma validate`, `npm run lint`, `npm run build` (no warnings); `npm test` 26/26; `npm run test:integration` 36/36 (`moointer_test_run_d66804a106c6401e`); `npm run test:e2e` 5/5; `npm run test:staging` auth 4, planning 2, search 7, consignment 5, labels 6 with the least-privilege account; `npm run db:backup:verify` identical restore; `npm audit --omit=dev` 0; secret scan 0 hits. Load test (single machine, 100,000 trips, 50 users): p95 413 ms without think time, 40 ms paced, no errors. Details and classification of open issues: [evidence/phase-8](evidence/phase-8/VERIFICATION.md).

Not run: real staging (HTTPS, proxy, identity provider), production-like load or write-path load, physical printer and scanner, screen reader, scheduled backup and timed restore drill, user acceptance.

Blockers for a production release: no deployed authentication mode; sign-in throttle is one shared bucket; hosting, TLS, backups and monitoring not provisioned; real master data and schedule not entered; owner decisions D209–D212 and the proposed availability/RPO/RTO/performance targets not accepted.

Next three actions: review and commit the Phase 8 changes; decide the identity provider and hosting so a deployed authentication mode, per-client throttle and TLS can be built and verified; print and scan the labels on real devices, supply the real transport sheets and master data, and confirm D209–D211.

## Resume check — 2026-10-06

Requested with the Resume prompt. Outcome: no active phase and no unfinished phase; PROMPTS.md defines Phases 1–8 only and all eight are complete locally. No new phase was started and nothing was deployed.

Claims verified against the repository: Git status matches the handoff (Phase 8 uncommitted, last commit `a5090db`); eight migration folders and eight applied rows in `moointer_dev._prisma_migrations`; 53 models, 54 tables, 67 triggers, the `AuditLog_entityId_createdAt_idx` index; evidence files for phases 1–8 present; the build is newer than every source file. Re-run: `npm run typecheck`, `npx prisma validate`, `npm run lint` passed; `npm test` 26/26; `npm run test:integration` 36/36 (`moointer_test_run_57a4a8c80b913d02`); `npm run test:e2e` 5/5; `npm run test:staging` auth 4, planning 2, search 7, consignment 5, labels 6. Not re-run: load test, backup verification, audit, secret scan (unchanged tree since their last run).

Corrected: `docs/TEST_MATRIX.md` had lost its heading and introduction in the Phase 6 commit (`16845c5`) and began with a stray status fragment; the heading was restored from `34bf57b`. The stale state line at the top of this file was updated. No code changed.

Next three actions are unchanged: commit Phase 8 on request; owner decisions on identity provider and hosting; real printer/scanner check, real transport sheets and master data, and confirmation of D209–D211.

## Handoff — 2026-10-06

Requested with the Handoff prompt. Repository state inspected: branch `master`, last commit `a5090db`, Phase 8 uncommitted (24 modified, 11 new paths), eight migrations applied to moointer_dev, no source file newer than the build, preview on 3010 answering. Active phase: none; Phase 8 stays Complete (local lab) because every acceptance condition was met with evidence earlier today, not because the session ended. No check was re-run for this handoff and no decision changed. Local leftovers: 158 disposable test schemas (about 1.3 GB) and 7 dumps (181 MB). [HANDOFF.md](HANDOFF.md) was rewritten with the acceptance table, changed files, check results, Not run items, open blockers, working notes and the next three actions.

## Phase 8 review — 2026-10-06

Requested with the Review prompt. No application code changed. Full record with reproduction steps: [evidence/phase-8/REVIEW.md](evidence/phase-8/REVIEW.md).

Verified failures:

- **R1 (high)** `src/server/services/planning-reassignment.ts:9,19`, `src/server/services/planning-read.ts:26`: a consignment cancelled after assignment makes every later publication for that service date fail (`REASSIGNMENT_REQUIRED`, then `CONSIGNMENT_IN_MOTION`). T08 did not cover a cancelled consignment on the re-planned date.
- **R2 (high)** `scripts/backup-verify.ts`, `docs/OPERATIONS.md` §6: a restored copy rejects trigger-guarded writes (MySQL 1142, or 1449 when the definer account is missing) while the tool reports PASS. Contents and trigger definitions themselves restore identically.
- **R3 (medium)** `docs/OPERATIONS.md` §5: migrations fail with MySQL 1419 on a binary-logging server unless `log_bin_trust_function_creators` is set; four scripts set that global flag silently.
- **R4 (low)** `src/server/services/consignments.ts:555-560`: the eligible-trip lookup answers for a private draft that belongs to another user.
- **R5, R7 (low)**: the load-test write-up omits that 50 workers share three sessions; the branch master accepts a postal code that label issue refuses.

Hypothesis, not reproduced: **R6 (low)** uploads are buffered before the size limit applies.

Checked and sound: migration 007 trigger fidelity (67/67), coverage on branch effective-date boundaries, capacity race, replay checks in all 29 guarded writes, authorization read-through of 20 routes and 20 pages, Thai text scan, restore content checksums.

Checks run: `npm run test:integration` with a temporary probe, 37/37 (probe removed; file unchanged in Git); scratch SQL checks on disposable schemas. Not run: browser suites, build, load test, audit, secret scan.

Status change: Phase 8 is In progress until R1–R3 are fixed and the affected checks rerun. R1 needs an owner decision only for consignments already in motion or completed; cancelled ones need none.

Next three actions: fix R1 with a regression test on a re-planned date that holds a cancelled consignment; fix R2 and R3 in `scripts/backup-verify.ts` and `docs/OPERATIONS.md` (functional write check after restore, definer and binary-log prerequisites); then rerun integration, the staging rehearsal and backup verification, and update VERIFICATION.md and the checklist.

## Phase 8 review fixes — 2026-10-06

Requested with the Fix and verify prompt. Every finding was confirmed first; each code fix has a regression test that failed before the change.

- **R1** `src/server/services/planning-reassignment.ts` (`requiresMove`), `planning-read.ts`: cancelled and rejected consignments no longer need a move when their date is re-planned. Test in `tests/integration/phase6.test.ts`.
- **R2** `scripts/backup-verify.ts`: restore is accepted only when the copy is usable (checksums, trigger definer privileges, guarded-write behaviour); `--check-restored` mode; OPERATIONS §6 restore procedure. The three earlier copies now fail; fresh restores of `moointer_dev` and the 1.55 M-row load database pass.
- **R3** OPERATIONS §5 prerequisite; notices in `scripts/migrate-local.ts` and `scripts/load-test.ts`; the backup tool no longer sets a global flag.
- **R4** `eligibleTrips` hides another user's draft (test in phase6). **R7** branch postal code rule matches label issue (test in phase3). **R5** VERIFICATION §6 wording.
- **R6** (confirmed by probe: 12 MB chunked upload buffered for 6,044 ms) `src/server/request-body.ts` caps bodies while reading in attachments, imports, `readWriteBody` and sign-in; refused after 42 ms now. Unit test in `tests/unit/operations.test.ts`.
- Decision D213 records the rule changes.

Verified 2026-10-06 06:39 UTC: `npm run typecheck`, `npx prisma validate`, `npm run lint`, `npm run build` (no warnings); `npm test` 27/27; `npm run test:integration` 38/38 (`moointer_test_run_d4f95d9f9f26e688`); `npm run test:e2e` 5/5; `npm run test:staging` auth 4, planning 2, search 7, consignment 5, labels 6; `npm run db:backup:verify` passed for both databases; `npm audit --omit=dev` 0; secret scan 0 hits. Not re-run: load test (search code unchanged).

Remaining defects: none known in the implemented behaviour. Release blockers and owner decisions are unchanged (RELEASE_CHECKLIST.md).

Next three actions: review and commit the Phase 8 working tree on request; owner decisions on identity provider, hosting and the handling of re-planning days with consignments already in motion; real printer/scanner check, real transport sheets and master data, and confirmation of D209–D213.

## Fix-and-verify request — 2026-10-06

Requested with the Fix and verify prompt. HANDOFF.md recorded no active phase and no reproducible defect, so no code changed. Confirmed: no source, script, test or schema file changed since the last full run; `npm run typecheck` passed; `npm test` 27/27; `npm run test:integration` 38/38 (`moointer_test_run_43a003b8da6d0f52`); preview liveness 200. Not re-run: browser suites, build, backup verification (no change since their passing runs). Remaining defects: none known.

## Brand assets and mock-up data — 2026-10-06

Owner request outside the phase plan. Phase status is unchanged (none active). Details and deviations: D214.

- Logos from `img1/` placed in the header, sign-in page, footer, browser/home-screen icons, web app manifest and printed trip manifest. Header tagline shows only at 1,500 px and wider so the navigation never wraps. Evidence: [evidence/phase-8/brand](evidence/phase-8/brand) (login and home at 1440/768/390 px, manifest screen and PDF).
- `scripts/seed-mockup.ts` / `npm run db:seed:mockup` ran against `moointer_dev` after a verified backup: 9 destinations, 6 vehicles, 6 drivers and the other masters, 7 role accounts. No route, template, plan, trip, reservation or consignment. Two runs left identical counts; both sample sign-ins (administrator, branch receiver) succeeded.
- Checks: typecheck, lint, build (no warnings); unit 27/27; integration 38/38; shell 5/5; staging rehearsal auth 4, planning 2, search 7, consignment 5, labels 6. Every page image loads and no page scrolls horizontally at the three widths. Mock passwords appear in no Git-visible file.

Next three actions: owner tests the seven roles with the mock data (sign-in limit: 5 per minute for all accounts together); decide whether to commit `img/`, `img1/` (1.4 MB Illustrator source) or keep them outside the repository; ask the designer for SVG or 2× PNG exports of the wordmark and banner.

## Administrator access and back-office icons — 2026-10-06

Owner request outside the phase plan; phase status unchanged (none active). Decision D215.

- `src/server/auth/permissions.ts`: administrator capabilities = union of all roles + master maintenance + `consignment.read.drafts`; `resource-policy.ts` and `consignments.ts` honour that capability for other users' drafts (read-only). Applied to `moointer_dev` with `npm run db:seed:mockup` (role links: administrator 56, no capability of another role missing).
- Back office: `src/app/admin/page.tsx` cards use a matching icon per data kind (planning, imports, vehicles, vehicle types, drivers, branches, product categories, storage conditions, consignment categories, warehouses, departments) instead of the diagonal arrow; "จัดการหลังบ้าน" in the header and the back-office heading carry a settings icon. Evidence: [admin-1440/768/390](evidence/phase-8/brand).
- Tests: new integration test for D215 (capability superset, foreign draft read-only, full lifecycle and planning as administrator); five assertions of the old administrator denial were changed to the new behaviour with denials moved to roles that lack the capability (phase3, phase5, phase7, search and label browser specs).
- Checks: typecheck, lint, build (no warnings); unit 27/27; integration 39/39; shell 5/5; staging rehearsal auth 4, planning 2, search 7, consignment 5, labels 6. As `mock.admin`, /admin/planning, /admin/imports, /consign, /consignments, /trips and /branches all open (200).

Next three actions: owner tests the administrator and the other six mock roles; decide how many people hold the administrator role (D215 removes separation of duties for it); commit when the owner asks.

## Back-office desk and Thai date/time fields — 2026-10-06

Owner request outside the phase plan; decision D218. Built on top of the uncommitted D216/D217 work, which was left intact (including the pending folder rename).

- `src/lib/navigation.ts` (`backofficeAreas`), `src/app/admin/page.tsx` (work / reference sections, role and scope line, verb chips, empty state), read-only labels on master list and record pages, CSS.
- `src/lib/date-input.ts`, `src/components/date-time-inputs.tsx` and their use in trip-search, trips, consignments, consign-form, consignment-actions, planning-workspace, planning-fields, planning-catalog-editor, planning-trip-editor and master-form.
- Tests: `tests/unit/date-input.test.ts` (4 tests; caught a typing bug where a digit after a full month was dropped, fixed), `tests/integration/backoffice.test.ts` (role table for all seven roles, added to the default integration run), new keyboard/calendar browser test in `tests/e2e/search.spec.ts`, auth spec heading updated.
- Checks: typecheck, lint, build (no warnings); unit 31/31; integration 40/40; access 3/3; shell 5/5; staging rehearsal auth 4, planning 2, search 8, consignment 7, labels 6, all PASS. Evidence screenshots: [evidence/phase-8/backoffice](evidence/phase-8/backoffice).

Next three actions: owner tries the back office with the supervisor, dispatcher and administrator mock accounts and the new date/time fields; then the pending folder rename from the D217 handoff; commit when the owner asks.

## Button fix, desk rows and ready-to-consign data — 2026-10-06

Owner request; decision D219.

- CSS defect fixed (planner rule overrode `.primary-button`; buttons white until hover). Verified on the preview: enabled planner save button rgb(230,0,35), hover rgb(191,0,29); master save button red; date/time triggers transparent with no border. Disabled buttons keep the light disabled style by design.
- `src/app/admin/page.tsx`: icons Tags (หมวดสินค้า) and Van (ประเภทรถ). A brief switch to row layout was reverted at the owner's request: the card grid is back exactly as committed (CSS lines restored from HEAD, which also restored the mobile one-column `.form-grid` rule that the row change had removed) and the verb chips are gone. Verified: 3/2/1 columns at 1440/768/390, no chips, no horizontal scroll, master form one column at 390; unit 31/31, integration 40/40, shell 5/5, auth 4/4.
- `moointer_dev`: all routes and plans deleted after a verified backup (guards restored identically, AuditLog `DEV_PLANNING_PURGED`), then `scripts/seed-mockup-plans.ts` published 14 days (2026-10-06 to 2026-10-19), 9 trips per day, all coverage rules passing. Read-only check: all seven mock accounts can open the consignment form (department, 2 warehouses, 8 branches, 4 categories) and tomorrow has 3 trips to BR-T01. No consignment created.
- `tests/e2e/auth.spec.ts`: sign-in helper accepts the query string the search page adds (timing-dependent failure seen once in the staging run).
- Checks: typecheck, lint, build; unit 31/31; integration 40/40; access 3/3; shell 5/5; staging planning 2, search 8, consignment 7, labels 6 PASS, auth failed once on the helper above, then auth 4/4 PASS after the fix. Evidence: [evidence/phase-8/backoffice](evidence/phase-8/backoffice).

Next three actions: owner tries consignments end to end with the mock accounts (requester submits, dispatcher assigns, warehouse loads, driver departs, branch receives); the pending folder rename (D217); commit when the owner asks.

## Role simplification and profile bar advice — 2026-10-07

Owner asked whether to reduce roles and add a header profile bar. Advice only; no application, schema, data or test change, and no new decision recorded (awaiting owner choice).

- Reviewed `src/server/auth/permissions.ts`, docs/PERMISSIONS.md, `src/components/session-navigation.tsx`, `src/components/app-header.tsx` and the untracked D220 work (`src/components/profile-menu.tsx`, `src/app/account/`, migration `202610070009_profiles_units_issue_types`). `ProfileMenu` exists but is not rendered by the header; D220 is not yet in DECISIONS.md.
- Recommendation given: keep fine-grained server capability codes, collapse the seven presets into fewer Thai account types (base user for everyone, branch receiver, warehouse/driver, planning with optional publish approval, administrator) and present each account as one type plus one scope; wire the profile menu into the header.

Next three actions: owner chooses the account-type grouping (especially dispatcher/supervisor separation and whether drivers sign in); record it as a decision and remap roles through an audited additive sync; wire `ProfileMenu` into the header and run unit, integration, access and shell checks.

## Five account types and header profile (D220, D221) — 2026-10-07

Owner request: reduce and simplify permissions, add a top profile bar, design it professionally, and show a before/after diagram. Decisions D220 (self-service account, completing the earlier rolled-back attempt) and D221 (five account types, header profile).

- Account types: `src/lib/account-display.ts` (`ACCOUNT_TYPES`, `accountTypeOf`), `src/server/auth/permissions.ts` (WAREHOUSE absorbs DRIVER, DISPATCHER absorbs SUPERVISOR; retired codes keep identical capabilities), `src/server/auth/provision.ts` (retired code stored as absorbing type; audited `consolidateRetiredRoles`), `scripts/sync-access-local.ts`, `scripts/seed-mockup.ts`.
- Header profile and account: `src/components/profile-menu.tsx`, `app-header.tsx`, `session-navigation.tsx` (`useSession`), `logout-button.tsx` (`signOut`), `src/app/api/session/route.ts`, `src/server/services/account.ts`, `src/app/account/page.tsx`, `src/app/api/account/route.ts`, `src/components/account-forms.tsx`, `src/app/admin/layout.tsx` and `page.tsx`, CSS in `src/app/globals.css` (menu collapses below 1200px; tagline hidden while signed in). Consignment form pre-fills saved phone and active default warehouse (`consignmentFormOptions`, `src/app/consign/page.tsx`).
- Wording: ผู้จัดรถ/หัวหน้างาน → ผู้วางแผนขนส่ง across 20 UI/service files; guide has an `#account-types` table built from `ACCOUNT_TYPES`.
- Schema: no new migration. Migration `202610070009_profiles_units_issue_types` was already applied to `moointer_dev` by an earlier, rolled-back session; `prisma/schema.prisma` declares `UserProfile`, `Unit`, `IssueType` again to match it (`prisma migrate diff` against moointer_dev shows only the pre-existing `IdempotencyRecord.requestHash` type difference). `scripts/runtime-grants.ts` grants INSERT/UPDATE on `UserProfile`. `Unit`/`IssueType` and untracked `src/server/services/code-names.ts` remain unused.
- Data (moointer_dev): `npm run db:backup:verify` PASS (backup `.local/backups/moointer_dev-20261007033443.sql`, zero differences) before `npm run auth:sync:local` PASS: 3 accounts moved off retired codes with `LOCAL_OPERATOR_ACCOUNT_TYPE_CONSOLIDATED` audit rows, Thai role names updated; passwords unchanged. Local mock-login headings relabelled (credentials untouched).
- Tests: `tests/unit/account-display.test.ts` rewritten (D221 names, retired-code folding); `tests/integration/backoffice.test.ts` (D221 capability equality and no cross-type widening); `tests/integration/access.test.ts` (provision/consolidation audit, scope still gates warehouse/driver/branch work, account summary, profile prefill and version conflict); expectations changed by design in `phase7.test.ts` (import denial now uses REQUESTER), `tests/e2e/planning.spec.ts` (planner sees publish; write-denial moved to branch account), `auth.spec.ts` (profile menu and /account; sign-out via profile), `consignment.spec.ts` (wording).
- Checks 2026-10-07 (after final build): `npm run typecheck` PASS; `npm run lint` PASS; `npm test` 34/34; `npm run test:integration` 41/41; `npm run test:access:integration` 5/5; `npm run build` PASS; `npm run test:auth:e2e -- --scoped-runtime` 4/4; `test:planning:e2e` 2/2; `test:search:e2e` 8/8; `test:consignment:e2e` 7/7; `test:labels:e2e` 6/6 (all `--scoped-runtime`); `npm run test:e2e` 5/5; `git diff --check` PASS. First auth/planning browser runs failed on a stale build and on intended D221 expectation changes; both fixed and rerun as above. Header fit measured at 390–1600px with administrator and planner menus: no overflow or horizontal scroll. Browser runners overwrote historical phase evidence; restored from HEAD.
- Evidence: [evidence/account-types](evidence/account-types) (before/after screenshots). Before/after diagram page published as a private artifact for the owner.

Next three actions: owner walks through the five mock accounts (profile menu, /account, guide `#account-types`); owner decides whether plan publication needs a second approver (D221 conflict note); commit when the owner asks.

## User management, planner end to end, development reset (D222–D224) — 2026-10-07

Owner request: build it professionally, delete all old users and create new mock users, and let the planner manage plans without an approver. The earlier D220/D221 work was committed first (`D220/D221: five account types, header profile and self-service account`).

- D222: no code change to capabilities (the planner already prepares and publishes after D221); recorded as the owner's decision; guide wording and mock plan seed updated (one planner drafts and publishes).
- D223 user management: `src/server/services/users.ts`, `src/app/api/users/route.ts`, `src/app/admin/users/` (list, new, detail), `src/components/user-admin.tsx`, back-office area in `src/lib/navigation.ts` and `src/app/admin/page.tsx`, CSS in `src/app/globals.css`. Runtime grants extended in `scripts/runtime-grants.ts` and applied to the local `moointer_app` account. No schema change, no migration.
- D224: `scripts/mock-accounts.ts` (single mock list), `scripts/reset-dev-operations.ts` with `npm run db:reset:dev-operations`, `scripts/seed-mockup.ts` (reuses existing masters), `scripts/seed-mockup-plans.ts`, `scripts/sync-access-local.ts`.
- Data (moointer_dev, synthetic only, owner-authorised full reset): backup `.local/backups/moointer_dev-20261007041736.sql` restore-verified; 39 account and operational tables cleared; guard trigger fingerprint unchanged; zero orphan foreign keys; masters kept (9 branches, 6 vehicles, 6 drivers, 2 warehouses, 3 departments); 7 mock accounts created; `npm run db:seed:mockup:plans` PASS (3 routes, 9 templates, 14 days published, 9 trips per day). Old credential files moved to `.local/auth/retired-2026-10-07T04-17-45-237Z`. New logins are in ignored `.local/auth/mockup-logins.txt`.
- Tests added: `tests/integration/users.test.ts` (7 tests: authorization, one-time password and replay, scope validation per type, audited version-checked change, disable/re-enable, reset and self-lockout rules, and a concurrent mutual-demotion race on real MySQL), run with the access suite; `tests/e2e/users.spec.ts` with `playwright.users.config.ts` and `npm run test:users:e2e` (create, sign in with the temporary password, change type, reset, disable, lockout, self-protection, phone width, and refusal for other types). `tests/integration/backoffice.test.ts` expects the new area for the administrator.
- Defects found by the tests and fixed before completion: (1) an administrator demoted a moment earlier could still finish an identity change that had already passed its permission check — every identity write now locks the active administrators and re-checks the actor under the lock; (2) that lock also tried to lock `Role`, which the least-privilege runtime account cannot lock, giving a generic error in the browser — narrowed to `FOR UPDATE OF u`; (3) a branch past its end date could be assigned — only open delivery branches are offered and accepted; (4) radio buttons inherited text-input sizing, the required mark wrapped to its own line and a primary link inside a card had red text on red.
- Checks 2026-10-07 on the final build: `npm run typecheck` PASS; `npm run lint` PASS; `npm test` 34/34; `npm run test:integration` 41/41; `npm run test:access:integration` 12/12 (run four times, stable); `npm run build` PASS; with `--scoped-runtime`: `test:users:e2e` 2/2, `test:auth:e2e` 4/4, `test:planning:e2e` 2/2, `test:search:e2e` 8/8, `test:consignment:e2e` 7/7, `test:labels:e2e` 6/6; `npm run test:e2e` 5/5 (it first failed 2 because the default config picked up the new spec; excluded there like the other dedicated specs). Live dev app checked with the new administrator (7 accounts listed) and planner (publish button present). Historical phase evidence overwritten by the runners was restored from HEAD.
- Evidence: [evidence/user-management](evidence/user-management).

Not done: forced password change at first sign-in; `test:staging` aggregate rehearsal not rerun and does not yet include the users suite; `test:load` not rerun.

Next three actions: owner walks through the seven mock accounts including creating a real-looking account at /admin/users; decide whether to force a password change at first sign-in; import real master data through /admin/imports before creating real accounts.

## Daily planning effort and coverage-table review (advice) — 2026-10-07

Owner asked whether the planner must plan every day and what the coverage table shows and whether it has gaps. Read-only review of `src/server/services/plans.ts` (validateDraft, candidateCoverage, publishPlan, changeBranchEligibility), `src/server/domain/planning.ts` (missingCoverage), `src/server/services/planning-catalog.ts` (generateTrips), `src/server/services/masters.ts` (branch eligibility and PORK/CHICKEN guards) and `src/components/planning-workspace.tsx`. No code, data or test change.

Findings reported: plans are per service date with manual generation from templates and manual publication (no scheduler, no multi-day generation in the UI); coverage is a hard publish gate over active delivery branches x rounds 1-3 x PORK/CHICKEN on non-cancelled BRANCH_DELIVERY trips. Verified gaps: no check or alert for dates without a published plan; round number is a label with no time ordering or separation rule between rounds; arrival time and driver are optional at publication and branch receiving hours are not compared with arrival; categories are declarations without quantity or delivery proof; past service dates can be drafted and published; no recorded exception path when reality breaks a published plan.

Next three actions (awaiting owner choice): multi-day generation and publication plus a missing-plan warning; round time rules and required arrival/driver with receiving-window check; decide whether pork/chicken deliveries need receipt confirmation.

## Planning screen UX review (advice) — 2026-10-07

Owner asked whether the plan table needs more detail (date, round start/end times), whether plan creation is hard to understand, and about status tracking. Read-only review of the live planning page with the mock planner (full-page captures at 1440 and 390, not committed). No code, data or test change.

Measured: one ordinary day (9 trips, 8 branches) renders 5,865 px tall at 1440 and 10,004 px at 390; the coverage table and the publish control are below every trip card; the selected date appears only in the date field; plan status appears only in the revision dropdown; coverage cells say only "ครบ"; the trip editor opens above the list with separate vehicle-occupancy fields and a two-step apply-then-save; trips have no executed status (only consignments have statuses).

Advice given: summary first and detail on demand rather than more detail everywhere — a sticky day header with date, weekday, plan status and coverage; a per-round time summary; trips as a compact table grouped by round; coverage cells naming the covering trip and time; a simpler editor with derived occupancy and a single save. Open owner decision: whether trips need actual departure/arrival status.

## Planning screen redesign, multi-day tools, gridlines, departure status (D225) — 2026-10-07

Owner request: do phase A professionally, give tables column lines, and say clearly in search whether a vehicle has left.

- Server: `src/server/services/planning-range.ts` (overview, generatePlans, publishPlans), `src/lib/planning-horizon.ts`, `src/app/api/planning/route.ts`, `src/server/services/planning-catalog.ts` (`templateTripId`, `templatesInEffect`, readable generated trip codes), `src/server/services/trip-search.ts` and `src/lib/departure-status.ts` (status per trip), `src/server/services/planning-read.ts` (issue wording).
- Screens: `src/components/planning-workspace.tsx` (rewritten plan tab; routes, templates and history tabs unchanged), `src/components/planning-day.tsx` (new), `src/components/planning-trip-editor.tsx`, `src/components/trip-results.tsx`, `src/app/trips/[tripId]/page.tsx`, `src/app/globals.css` (gridlines for all tables, planning layout).
- No schema change, no migration, no data change in moointer_dev.
- Measured on the live dev app, same day as the earlier review (9 trips, 8 branches): 3,779 px tall at 1440 (was 5,865) and 5,246 px at 390 (was 10,004), with date, status, round times and coverage above the trips.
- Defects found and fixed during the work: the first overview held one of the five pooled connections for about a second while running a couple of hundred small queries, so concurrent requests queued — rewritten as a few batched queries with coverage computed in memory by the publication rule; a superseded overview request was left unread, keeping its connection open — now aborted; a second live region broke single-status announcements — the missing-plan notice is no longer a status region.
- Tests: `tests/integration/planning-range.test.ts` (4 tests, run with the access suite): nothing is created without templates, range drafts and the overview, only untouched template drafts are published together with reservations, branch snapshot and audit per date, and limits and permissions. `tests/unit/departure-status.test.ts` (3 tests). `tests/e2e/planning.spec.ts` updated for the new screen and extended with day navigation, the two-week strip and both multi-day tools at 1440 and 390. `tests/integration/phase5.test.ts` wording.
- Checks 2026-10-07 on the final build: `npm run typecheck` PASS; `npm run lint` PASS; `npm test` 37/37; `npm run test:integration` 41/41; `npm run test:access:integration` 16/16; `npm run build` PASS; with `--scoped-runtime`: `test:planning:e2e` 2/2, `test:search:e2e` 8/8, `test:consignment:e2e` 7/7, `test:labels:e2e` 6/6, `test:users:e2e` 2/2, `test:auth:e2e` 4/4; `npm run test:e2e` 5/5. Planning browser runs failed during the work for test-side reasons that were corrected (a second status region, a title captured before the day loaded, a fixture day that is already published, and a merge target chosen by the old code sort order); the final run is as listed. Historical phase evidence overwritten by the runners was restored from HEAD.
- Evidence: [evidence/planning-redesign](evidence/planning-redesign).

Not done: round time rules, mandatory arrival and driver, receiving-hours check, past-date lock (need the owner's round times and back-dating limit); actual departure/arrival recording per trip (owner decision); `test:staging` aggregate and `test:load` not rerun.

Next three actions: owner tries the planning screen with demo.planner1 (date bar, strip, multi-day tools); owner gives the usual departure window of each round and how many days back a plan may be changed; decide who records actual departure and arrival on site.

## Back office without reference lists; consign from a trip row (D226) — 2026-10-07

Owner request. `src/lib/navigation.ts` and `src/app/admin/page.tsx` (reference section and its CSS removed; `BackofficeArea.section` dropped), `src/components/trip-results.tsx` (`ConsignAction`, "ดำเนินการ" column), `src/app/trips/page.tsx`, `src/components/trip-search.tsx`, `src/app/trips/[tripId]/page.tsx` (choice of stops), `src/app/globals.css`. No schema, data or capability change.

Tests: `tests/integration/backoffice.test.ts` (areas per account type, planner no longer lists read-only masters), `tests/e2e/search.spec.ts` (trip detail offers the stops; trip list shows the departure status and the row action leads to the consignment form with a destination). Checks on the final build: typecheck, lint, build PASS; unit 37/37; integration 41/41; access 16/16; browser search 8/8, consignment 7/7, planning 2/2, labels 6/6, users 2/2, auth 4/4, shell 5/5. One search browser check failed first because it expected the old disabled button; updated to the new behaviour. Evidence: [evidence/planning-redesign](evidence/planning-redesign) (`backoffice-planner-1440.png`, `trips-consign-1440.png`).

Next three actions: unchanged from the D225 entry (owner tries the planning screen; round times and back-dating limit for the rule changes; decide who records actual departure and arrival).

## Deployed account mode, installation SQL and upload package (D227, D228) — 2026-10-07

Owner request: remove the consign button from trip lists, run the build, say what to upload and how to set up DirectAdmin, and provide a complete SQL file for phpMyAdmin.

- D228: `src/components/trip-results.tsx`, `src/app/trips/page.tsx`, `src/components/trip-search.tsx`, `src/app/globals.css`, `tests/e2e/search.spec.ts`.
- D227 code: `src/server/auth/config.ts` (production mode, `peerAddress`), `src/app/api/auth/[...all]/route.ts`, `src/server/auth/auth.ts`, `src/server/services/users.ts` (administrator lock portable to MariaDB), `server.cjs`, `scripts/build-deploy-sql.ts`, `scripts/build-deploy-package.ts`, `package.json` (`deploy:sql`, `deploy:package`), `tests/unit/auth-config.test.ts`.
- No schema change and no migration. `moointer_dev` not changed. Temporary schemas and one temporary user were created on the local MySQL 8.4 and on the XAMPP MariaDB 10.4.32 for verification and dropped afterwards; the pre-existing XAMPP database was not touched.
- Output for the owner (ignored by Git): `.local/deploy/moointer-transport-app.zip`, `.local/deploy/sql/1_schema_mysql8.sql`, `1_schema_mariadb.sql`, `2_first_administrator.sql`, `first-administrator.txt`, `.local/deploy/INSTALL-TH.txt`.
- Defects found and fixed: `.next/node_modules` links pointing at the build machine would have broken the uploaded copy (now recreated by `server.cjs`); the first zip included the build cache and development output (825 MB, now about 10 MB); `FOR UPDATE OF` is not MariaDB syntax; `DROP CHECK` is not MariaDB syntax (SQL variant).
- Checks 2026-10-07 on the final build (MySQL 8.4): `npm run typecheck`, `npm run lint`, `npm run build` PASS; `npm test` 39/39; `npm run test:integration` 41/41; `npm run test:access:integration` 16/16; with `--scoped-runtime`: auth 4/4, users 2/2, search 8/8, consignment 7/7, planning 2/2, labels 6/6; `npm run test:e2e` 5/5. One search browser check failed first because a step order was wrong after removing the list button; corrected and rerun.
- Checks on MariaDB 10.4.32 (temporary schemas loaded from `1_schema_mariadb.sql`): phase suites 41/41 with the MySQL-version readiness assertion skipped for the experiment, access/users/range 16/16, and the simulated host installation described in D227. Browser suites were not run on MariaDB.

Not done / not verifiable here: a real DirectAdmin host, HTTPS production mode end to end, other MariaDB versions, a case-sensitive server, scheduled backups, monitoring, `test:staging` and `test:load`.

Next three actions: owner checks the host (Node.js app support and version, database type and version, SSL) and follows `.local/deploy/INSTALL-TH.txt`; report the first error message if any step fails; after the first successful sign-in on the host, change the administrator password and set up database backups in DirectAdmin.
