# AI session handoff

Prepared 2026-10-06 from the actual repository state. Read [AGENTS.md](../AGENTS.md) and [PROGRESS.md](PROGRESS.md) with this file.

Latest request (2026-10-06): explain the requirements as easy Thai workflow diagrams for all seven roles. Source review covers daily plan publication, consignment lifecycle, exceptions and mock-account testing order; see PROGRESS “End-to-end workflow explanation”. Only these two handoff/status documents changed; no tests, live account audit, data mutation, implementation or deployment performed. Next three explanation-follow-up actions: test plan publication, test the scoped consignment handovers through closure, then test partial receipt/returns and label replacement. Existing release actions below remain pending authorization.

Latest session (2026-10-06): owner asked how existing permissions work. Source review confirmed seven predefined roles, separate capabilities/scopes, administrator without automatic operational powers, and local operator account provisioning without a web role editor. No defect repair, application/schema/database change or deployment was requested or performed. Only PROGRESS/HANDOFF review notes added; no tests rerun and no live account grants audited. See [PROGRESS.md](PROGRESS.md) “Role explanation review” for inspected paths and checks. Existing blockers and the next three release actions below remain unchanged; do not interpret this explanation as authorization to modify roles or begin a new phase.

## Where things stand

- **Active phase: none.** PROMPTS.md defines Phases 1–8; all eight are complete in the local lab. The Phase 8 review findings R1–R7 were fixed and verified. Do not deploy, publish or start new work without an explicit owner request.
- **Git:** branch `master`, last commit `a5090db` (Phase 7). Phase 8 and its review fixes are **uncommitted**. Commit only when the owner asks; commits go directly on `master` and are not pushed. The untracked `img/` (designer usage sheet) and `img1/` (source logos, including a 1.4 MB `.ai`) folders belong to the owner: ask before committing them. The app uses cropped copies in `src/assets/brand/`, `src/app/` icons and `public/brand/`.
- **Language:** reply to the owner in Thai. Technical docs and identifiers are English; all UI and print content is Thai.
- **Decisions:** D212 (Phase 8 choices), D213 (review fixes), D214 (brand assets, mock-up data) and D215 (administrator can do and see everything, owner-accepted) are the latest; proposed values in D209–D214 still await owner confirmation.
- **Since Phase 8:** the owner's MOOROUTE logos are in place (header, sign-in, footer, icons, manifest print) and `moointer_dev` holds mock-up master data plus seven `mock.*@moointer.test` role accounts (`npm run db:seed:mockup`; passwords only in ignored `.local/auth/mockup-logins.txt`). Planning and consignments are intentionally empty: the owner will test them.

## Phase 8 acceptance conditions

| Condition | State | Evidence |
| --- | --- | --- |
| Matrix rows T01–T24 pass with evidence | Met locally | [VERIFICATION.md](evidence/phase-8/VERIFICATION.md) §3. T16/T17 software only, T23 synthetic sheets, T19 without a screen reader |
| Unresolved issues classified honestly | Met | VERIFICATION §10 |
| Production build succeeds | Met | `npm run build`, no warnings |
| Disposable backup restore verified | Met | `npm run db:backup:verify` now proves the copy is usable, not only identical |
| Operator can follow the documented process | Met locally | [OPERATIONS.md](OPERATIONS.md) §5 (migration prerequisite) and §6 (restore procedure) |
| T01–T24 results and external decisions recorded | Met | [TEST_MATRIX.md](TEST_MATRIX.md), VERIFICATION §11 |
| Reviewable release package, no deployment | Met | [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §F; nothing deployed |

## Uncommitted changes (Phase 8 + review fixes)

- **Migrations:** `202610060007_restorable_triggers`, `202610060008_audit_lookup_index`; index in `prisma/schema.prisma`.
- **Application:** new `src/server/logging.ts`, `src/server/request-body.ts`; changed `src/server/http.ts`, `src/server/auth/session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/api/consignments/[id]/attachments/route.ts`, `src/app/api/imports/route.ts`, `src/app/page.tsx`, `src/app/l/[token]/page.tsx`, `src/components/trip-search.tsx`, `src/server/services/planning-reassignment.ts`, `planning-read.ts`, `consignments.ts`, `masters.ts`, `src/server/config/environment.ts`, `src/server/persistence/database.ts`, `next.config.ts`.
- **Scripts:** new `runtime-grants.ts`, `backup-verify.ts`, `staging-rehearsal.ts`, `load-test.ts`; changed `run-integration.ts`, `setup-auth.ts`, `migrate-local.ts`; `package.json` scripts; `.env.example`.
- **Tests:** new `tests/unit/operations.test.ts`; additions in `tests/integration/phase3.test.ts`, `phase6.test.ts` and the shell, search and consignment browser specs.
- **Docs:** new OPERATIONS, RELEASE_CHECKLIST, `evidence/phase-8/` (VERIFICATION, REVIEW, load-test.json); changed DECISIONS, SETUP, ARCHITECTURE, DATA_MODEL, TEST_MATRIX, PROGRESS, HANDOFF.

## Database and local environment

- MySQL 8.4.11 at 127.0.0.1:3307 (`npm run db:start:windows`). XAMPP MariaDB on 3306 is not used. `log_bin_trust_function_creators` is 1 on the lab server.
- `moointer_dev`: eight migrations applied; 53 models, 54 tables, 67 triggers (definer `moointer_migrate`). Mock-up masters (manifest `mockup-dev-v1`: 9 destinations, 6 vehicles, 6 drivers, …) and 7 mock role accounts besides the original local accounts; no routes, templates, plans or consignments. All data is fictitious.
- 172 disposable `moointer_test_run_*` schemas (about 1.8 GB) and 11 dumps (361 MB) in `.local/backups/` are retained. They may be dropped with the owner's agreement; never drop or reset `moointer_dev`.
- Preview `http://127.0.0.1:3010` runs the current build. Credentials live only in ignored `.env` and `.local/`; never print them.

## Checks and results (2026-10-06, current tree, after D214/D215)

| Command | Result |
| --- | --- |
| `npm run typecheck`, `npx prisma validate`, `npm run lint`, `npm run build` | Passed, no warnings |
| `npm test` | 27/27 |
| `npm run test:integration` | 39/39 on real MySQL (includes the D215 administrator test) |
| `npm run test:e2e` | 5/5 |
| `npm run test:staging` | auth 4/4, planning 2/2, search 7/7, consignment 5/5, labels 6/6 (least-privilege database account) |
| `npm run db:backup:verify` (dev and the 1.55 M-row load database) | Passed; earlier copies correctly fail with `--check-restored` |
| `npm audit --omit=dev`; secret scan | 0 vulnerabilities; 0 hits |
| `npm run test:load` | Not re-run (search code unchanged); earlier baseline in VERIFICATION §6 |
| Real staging (HTTPS, proxy, identity provider), write-path load, physical printer and scanner, screen reader, scheduled backup and timed restore, user acceptance | Not run |

## Unresolved

No known defect in the implemented behaviour. A later fix-and-verify request on 2026-10-06 found nothing to fix (typecheck, unit 27/27 and integration 38/38 rerun on the unchanged tree). Open items (details in RELEASE_CHECKLIST.md and VERIFICATION §10):

- **Blocks a production release:** no authentication mode for a deployed environment; sign-in throttle is one shared bucket of 5 per minute; no HTTPS/proxy, scheduled backups or monitoring.
- **Blocks go-live:** real master data and schedule not entered (source PDF never supplied); labels never printed or scanned on real devices; no user acceptance.
- **Owner decisions:** how to re-plan a day whose consignments are already loaded, in transit or completed (still blocked by design); D209–D213 values; availability, RPO, RTO and performance targets.
- **Known weak spot:** the regression check for the search focus-loss defect (last test in `tests/e2e/search.spec.ts`) is timing-dependent; if it fails, treat it as a real defect in `src/components/trip-search.tsx`.

## Working notes for the next session

- Bash heredocs and `node -e` mangle backslashes and quotes on this machine; Git Bash also rewrites arguments that start with `/`. Use the Write/Edit tools for code, and `MSYS_NO_PATHCONV=1` with Windows paths when running scratch scripts.
- Browser suites overwrite earlier phases' evidence images. Afterwards run `git checkout -- docs/evidence/phase-1 docs/evidence/phase-3 docs/evidence/phase-4 docs/evidence/phase-5 docs/evidence/phase-6 docs/evidence/phase-7`.
- Stop the `next start --port 3010` process before `npm run build`, then start it again with `npm start`.
- Browser specs sign in once per account per worker because of the 5-per-minute throttle; one failing test can cascade into sign-in failures.

## Next three actions

1. When the owner asks, commit the Phase 8 working tree on `master` (check `git status`; include both migrations and `docs/evidence/phase-8/`; ask about `img/`).
2. Obtain the owner's decisions on identity provider, hosting and re-planning with consignments in motion; then build and verify a deployed authentication mode, per-client sign-in throttling and TLS (new work, needs an explicit request).
3. With the owner: print and scan labels on the real printer and devices, supply the real transport sheets and verified master data, and confirm D209–D213.
