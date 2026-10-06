# Project progress

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
