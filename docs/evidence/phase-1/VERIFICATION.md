# Phase 1 verification

Date: 2026-10-06 (Asia/Bangkok). Scope: foundation only, as explicitly selected by the user. No deployment, operational data import or later-phase implementation.

## Environment and versions

Windows workspace: `C:/xampp/htdocs/MooRoute`. `node --version` returned `v24.14.0`; `npm --version` returned `11.9.0`. Initial `git status --short` failed because no repository existed. `git init` established a new local repository without replacing existing files or history. Original Markdown, DOCX and user-supplied JPG/PNG files were preserved.

Commit 3c5411e on master contains only the placeholder `.env.example`, following the explicit repository rule to commit that file. Other work is left uncommitted/untracked for review. No credentials or source references were committed, and no remote was configured.

`C:/xampp/mysql/bin/mysqld.exe --version` identified MariaDB 10.4.32, so it was not used as MySQL. The project-local Oracle binary reports 8.4.11 and runs on loopback 3307, independent of the pre-existing 3306 service. The existing program on port 3000 was left alone; local app scripts use 3010, browser tests 3011.

Package pins and rationale are in [architecture](../../ARCHITECTURE.md). `npm ls --depth=0` exits 0 with no invalid peer dependencies; npm also lists two platform-related optional Sharp packages as extraneous after a clean install. This did not prevent the reproducible build.

## Commands and outcomes

All commands below were actually run on the stated date. Checks are not evidence that any Phase 2–8 acceptance scenario passed.

| Exact command / manual check | Final outcome | Evidence |
| --- | --- | --- |
| `node --version`; `npm --version` | Passed | Node 24.14.0 / npm 11.9.0 |
| `npm view next version engines --json` and version/peer queries for selected packages | Completed | Exact compatible stable pins recorded in package.json; Prisma 8 was a release candidate |
| `npm install` | Passed after dependency selection adjustments | package-lock.json generated; compatible ESLint 10 plugins selected directly |
| `npm ci` | Passed | 332 packages installed; Prisma 7.10.0 client generation completed from the lockfile |
| `Get-FileHash -Algorithm MD5 -LiteralPath .local/downloads/mysql-8.4.11-winx64.zip` | Passed | Matches Oracle's published `2e833921898a9a030ea6bfe81bd811bc` checksum |
| `npm run db:setup:windows` | Passed | Independent MySQL, two databases and scoped accounts initialized; `.env` created with generated credentials |
| `npm run db:stop:windows`; `npm run db:start:windows` | Passed after shutdown wait fix | Clean shutdown waits for process exit; subsequent start launches the same retained data directory |
| `npm run db:setup:windows` on existing setup | Passed | Existing data and credentials preserved; no schema changes |
| `npm run db:validate` | Passed | Prisma mysql schema valid, with no operational models |
| `npm run db:check` | Passed, including after restart and clean install | Real server result: MySQL 8.4.11, InnoDB, utf8mb4, utf8mb4_0900_ai_ci; Thai/emoji round trip |
| `npm run test:db` | Passed | Dedicated test database, temporary InnoDB table, Thai/emoji persistence, DECIMAL `30.125` and service DATE `2026-10-06` |
| `npm run lint` | Passed | ESLint, zero warnings |
| `npm run typecheck` | Passed | Next route generation and strict TypeScript |
| `npm test` | Passed | 7 tests: safe configuration, TLS, test isolation, Bangkok midnight, Thai date display and error redaction |
| `npm run build` | Passed, including after `npm ci` | Optimized production build; `/`, `/guide`, `/api/health/live`, and not-found route |
| `npm start`; GET http://127.0.0.1:3010/api/health/live | Passed | Preview ready on 3010 and returned only `{"status":"ok"}` |
| `npm run test:install-browser` | Passed | Playwright Chromium/headless shell installed |
| `npm run test:e2e` | Passed | 5 tests in the final run; keyboard tabs, time basis, mobile navigation, guide navigation, overflow checks, liveness output and Thai 404 |
| `npm audit --omit=dev` | Passed | Zero reported production dependency vulnerabilities |
| `npm audit --json` | Findings retained | Four high entries from one braces advisory in the lint-only dependency chain; see below |
| `git check-ignore .env .local/mysql/root-client.ini references/messageImage_1791002598481.jpg` | Passed | Private local environment, data and source reference copies are ignored |
| Manual secret check: compare locally generated database password values against Git-visible source/config/document files, without printing values | Passed | No matches; `.env.example` is the only Git-visible environment file |
| `curl.exe --silent --output NUL --write-out '%{http_code}' http://127.0.0.1/MooRoute/.env` | Not served | Returned 404; no credential body was output or exposed by this tested URL |
| Manual database inventory using the local operator account | Passed | Zero persistent tables across moointer_dev and moointer_test; smoke-test table removed |
| SHA-256 comparison of original JPG/PNG and references/ copies | Passed | Identical files; hashes in references/README.md; originals unchanged |

## Visual and interaction evidence

Playwright captured every search-tab shell state at each required viewport. Document overflow checks passed at all three sizes. Representative visual inspection of desktop branch, tablet time and mobile range views found readable Thai, stacked mobile cards, clear active tabs, no clipped content, and red/white/gray hierarchy consistent with the reference.

| Width | Branch | Exact time | Range |
| --- | --- | --- | --- |
| 1440 px | [Screenshot](shell-1440-branch.png) | [Screenshot](shell-1440-time.png) | [Screenshot](shell-1440-range.png) |
| 768 px | [Screenshot](shell-768-branch.png) | [Screenshot](shell-768-time.png) | [Screenshot](shell-768-range.png) |
| 390 px | [Screenshot](shell-390-branch.png) | [Screenshot](shell-390-time.png) | [Screenshot](shell-390-range.png) |

This verifies foundation layout, not production route-search fidelity. Search data, metrics from authorized trips, branch autocomplete, time chips, actual filtering and consignments are deliberately unavailable until their implementing phases. Branding uses a development text wordmark. The operational PDF remains missing.

## Failures found and corrected

- Initial configuration tests used a fixture username that matched a forbidden placeholder; replaced the fixture with an unambiguous synthetic username. TypeScript initially rejected test objects because Next augments ProcessEnv with required NODE_ENV; narrowed the validator input to a string/undefined record.
- The first MySQL query failed because the connector required caching_sha2_password RSA key handling. Added loopback-only public-key retrieval; remote connections continue to require verified TLS. Real connection and persistence tests subsequently passed.
- Initial mobile browser tests looked for the old button accessible name after opening the menu. The UI correctly renamed it to the Thai close action; the assertion now targets that state. All 5 browser tests passed.
- Restart verification exposed that mysqladmin returned before complete process termination. Stop now waits for the owned process to exit before reporting success. A diagnostic command overlapped with the clean dependency reinstall and temporarily lacked tsx; it was rerun after npm ci completed and passed. Database state was unaffected.
- Initial ESLint 9 selection was deprecated; the Next preset also had plugins without ESLint 10 peer compatibility. Switched to supported direct ESLint 10-compatible plugins and verified lint/build. Scoped dependency overrides addressed the initial production connector and Prisma tooling advisories.

## Recheck following the repeated Phase 1 request

On 2026-10-06, the actual workspace, repository instructions, current handoff, package scripts, server configuration/persistence modules and Phase 1 prompt were inspected again. `node --version` and `npm --version` still reported 24.14.0 and 11.9.0. The following existing commands passed again: `npm run lint`, `npm run typecheck`, `npm test` (7/7), `npm run db:validate`, `npm run db:check`, `npm run test:db`, `npm run test:e2e` (5/5, 5.5 seconds) and `npm audit --omit=dev` (zero findings).

The local preview on 3010 and Oracle MySQL on 3307 remained running. The liveness response again contained only `status: ok`. Git's committed tree still contained only .env.example; local credentials remained ignored. Browser tests refreshed all nine screenshots using the existing production build. No application source, dependency, schema, migration or decision change was required. The production build was not rerun in this recheck; its prior successful build and clean-install evidence remain above. Next phase remains 2 only upon user request.

## Remaining findings and explicit exclusions

`npm audit` still lists `@next/eslint-plugin-next -> fast-glob -> micromatch -> braces` because braces 3.0.3 has an upstream stack-exhaustion advisory ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). No patched braces release was available in the queried registry. This path runs only in development lint tooling with repository-owned patterns; no application request reaches it. Do not call the full audit clean. Track an upstream compatible fix before release hardening; do not blindly force the suggested downgrade to the old Next 14 plugin.

Authentication, authorization/row-scope tests, operational schema and migrations, coverage publication, vehicle and receipt races, search semantics against real trip data, imports, printing, load testing and backup/restore rehearsal were not implemented or tested. The full T01–T24 matrix remains future-phase work. No source data was treated as a production fixture.
