# AI session handoff

Latest (2026-10-07, second session part): D222–D224 implemented. Planner prepares and publishes plans alone (owner decision, no approver). Administrator user management at /admin/users (create, type and scope, disable/re-enable, one-time temporary password; audited, lockout-safe; runtime grants extended, see D223). moointer_dev was fully reset at the owner's request after a verified backup: all old accounts and operational history removed, masters kept, 7 new mock accounts (`scripts/mock-accounts.ts`, logins in ignored `.local/auth/mockup-logins.txt`), 14 days of published mock plans. All checks pass: unit 34, integration 41, access+users 12, browser users 2/auth 4/planning 2/search 8/consignment 7/labels 6/shell 5. No schema change. Not done: forced password change at first sign-in; staging aggregate and load test not rerun. Details: PROGRESS “User management, planner end to end, development reset”. Next: owner walkthrough with the seven mock accounts; decide on forced first-sign-in password change; import real master data before creating real accounts.

Earlier (2026-10-07): D220/D221 implemented and committed. Seven roles → five account types (พนักงานทั่วไป, พนักงานสาขา, คลังและรถขนส่ง = WAREHOUSE+DRIVER, ผู้วางแผนขนส่ง = DISPATCHER+SUPERVISOR, ผู้ดูแลระบบ); role codes kept, retired codes alias the absorbing type; scope checks unchanged. Header profile menu, /account page (contact defaults pre-fill consignments, password change). Schema now matches already-applied migration 009 (no new migration); runtime grant added for UserProfile. moointer_dev: verified backup, then audited sync moved 3 accounts. All checks pass (unit 34, integration 41, access 5, browser auth 4/planning 2/search 8/consignment 7/labels 6/shell 5). Conflict: planners now prepare and publish plans themselves (see D221). Details and paths: PROGRESS “Five account types and header profile”. Next: owner walkthrough of the five mock accounts; decide on a second plan approver; commit on request.

Latest follow-up (2026-10-07): owner requested `npm run dev`. Development server is running in the background at http://127.0.0.1:3010 (replaces the previously reported production-preview mode). Startup ready; `/api/health/live` and `/login` returned HTTP 200. Ignored logs/PID: `.local/dev-server/`. Next.js generated AGENTS.md guide additions and next-env.d.ts development imports; no application implementation, schema/data changes or migration applied. Existing untracked account/profile work preserved. No regression suite rerun; `git diff --check` passed. Next three actions: open the URL, try the intended flow, report any reproducible defect. Existing relocation/release limitations remain; see PROGRESS “Development server start”.
Latest follow-up (2026-10-06): explained creating a daily plan using actual current UI labels, manual trips or optional templates, explicit draft persistence and supervisor/admin publication. Reviewed planning components and authorization; no plan created/published, no data/application/schema change or tests rerun. See PROGRESS “Creating a daily plan explanation” for next walkthrough actions. Existing implementation, relocation and release state below is unchanged.

Latest follow-up (2026-10-06): explained current plan deletion from source. No whole-daily-plan deletion exists. Draft-trip removal creates another retained revision and is allowed only for trips never published or consignment-linked; published trips use cancellation/replacement with coverage and consignment guards. Only PROGRESS/HANDOFF updated; no application/data change, test rerun or new decision. See PROGRESS “Daily-plan deletion explanation” for reviewed evidence and three flow actions. Existing unfinished relocation/release work below is unchanged.

Prepared 2026-10-06 from the actual repository. Read AGENTS.md and PROGRESS.md first. Latest owner request: implement the discussed permission/navigation/common-read/own-consignment policy professionally, add clear flows, change product names, and rename MooRoute to moointer-transport.

## Current result

- Application changes completed: seven predefined roles can read company-wide published trips/general branch data and create their own consignments after explicit department assignment. Contacts, drafts, files and operational records remain scoped. Admin retains D215 all-role capabilities and read-only access to others' drafts.
- Menus/actions without permission are hidden; authorized prerequisite-blocked actions show Thai disabled reasons. Creator cannot assign/reject/reassign own request, even admin or through plan publication. Retry authorization is rechecked.
- D218 (later the same day): the back office lists only work and read-only reference areas per account (`backofficeAreas()` in `src/lib/navigation.ts`, single rule for menu, page and tests), and every date/time entry uses dedicated วว/ดด/ปปปป (พ.ศ.) and ชช:นน fields with calendar and time list (`src/components/date-time-inputs.tsx`); submitted formats unchanged.
- D219: planner save buttons were white until hover (CSS specificity bug) — fixed; back office keeps the card grid without verb chips; `moointer_dev` routes/plans were purged on request (backup first, guards restored identically) and `npm run db:seed:mockup:plans` published 14 days of mock plans (3 routes, 9 trips/day) so consignments work immediately.
- Guide /guide contains Thai plan/consignment flows and all seven account duties. Default title/install short name: MooRoute | หมูอินเตอร์. Thai product name: ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์. npm package/lockfile name: moointer-transport. Owner logo pixels preserved. See current [PERMISSIONS.md](PERMISSIONS.md) and D216/D217 in DECISIONS.md.
- **Folder rename remains incomplete. Actual root: C:/xampp/htdocs/MooRoute.** Two safe same-volume rename attempts failed with Windows sharing violations. VS Code, Explorer/Photos and coding-tool processes hold handles. Do not force-close handles or kill user tools. MySQL configuration restored; MySQL3307 and current production preview3010 restarted at this root.
- Concrete helper copied outside the workspace to C:/xampp/htdocs/rename-moointer-transport.ps1; source scripts/rename-workspace.ps1. Parser and -CheckOnly passed. Save work and close applications using the root, then run from a separate PowerShell window following [SETUP.md](SETUP.md). It verifies a backup, stops owned services, renames without copy/delete/reset, adjusts MySQL absolute paths, checks retained environment/database/build and restarts preview. Full relocation has not succeeded.

## Repository and data

Git branch master; actual HEAD b96abc0. This request's changes are uncommitted; no commit, push or deployment authorized/performed. Preserve unrelated owner changes and img/, img1/, loginsso/ originals. Technical docs/identifiers English; UI/print/owner replies Thai.

No schema/migration changes. Oracle MySQL8.4.11 remains on loopback3307, InnoDB/utf8mb4; XAMPP MariaDB3306 untouched. No operational-data reset or destructive migration. Additive seven-role capability sync and nine known development accounts' synthetic operations-department memberships were applied with audit; requester marketing membership/passwords preserved. Newly provisioned senders need departmentId in addition to their operational scope. Operator tooling remains local-only, no web role editor.

Credentials remain only in ignored .env/.local/auth. Synthetic mock-up masters/accounts remain available for owner walkthrough; no production facts inferred. Disposable schemas/dumps retained for inspection; do not reset moointer_dev or delete retained schemas without authorization. Current preview: http://127.0.0.1:3010 (npm start).

## Affected paths

Auth permissions/resource-policy/provision, trip-search/consignments/planning-reassignment/http, session API and navigation/login/header/form/actions, layout/manifest/guide/CSS, provisioning/sync/fixture/rename scripts, package metadata, integration/browser tests and permission/context/setup/decision/progress documentation. New tests/integration/access.test.ts and scripts/run-integration.ts --access isolate new fixtures from historical phase-count assumptions. New screenshots and full evidence: [access-policy verification](evidence/access-policy/VERIFICATION.md). Prior Phase1/3–7 screenshots restored after runners overwrote them.

## Checks — 2026-10-06

| Command | Actual result |
| --- | --- |
| npm run lint; npm run typecheck; npm run build | PASS |
| npm test | PASS 31/31 (after D218) |
| npm run test:integration | PASS 40/40 (after D218; includes backoffice.test.ts) |
| npm run test:access:integration | PASS 3/3 (ac8d23fee728c2de) |
| npm run test:e2e | PASS 5/5, names and guide responsive widths |
| npm run test:planning:e2e -- --scoped-runtime | PASS 2/2 |
| npm run test:search:e2e -- --scoped-runtime | PASS 7/7 |
| npm run test:consignment:e2e -- --scoped-runtime | PASS 7/7 |
| npm run test:staging | After D218: PASS — auth 4, planning 2, search 8, consignment 7, labels 6 (the earlier D216 aggregate run had failed before its corrections) |
| npm audit --omit=dev | Zero vulnerabilities |
| npm run db:backup:verify | PASS twice; post-sync restore zero differences/usability failures |
| npm run db:check; GET preview /api/health/live | PASS after restart |
| rename-workspace.ps1 -CheckOnly; parser; git diff --check | PASS; actual rename failed twice |

Exact schema names, original failures and corrected expectations are in the verification link; never report the failed aggregate staging attempt or pending rename as passed. No load test rerun or new performance claim.

## Remaining work and release limits

Only requested unfinished item: folder relocation blocked by external workspace handles. No known failing application regression after corrections. Existing production authentication/HTTPS/proxy, per-client sign-in throttling, monitoring, scheduled backup/timed restore, real master-data/source verification, physical printing/scanning, screen-reader and user-acceptance requirements remain; consult Phase8 VERIFICATION and RELEASE_CHECKLIST. Loaded/in-transit/completed re-planning remains blocked by design. No production release was attempted.

## Next three concrete actions

1. Save work, release workspace handles by closing the editors/viewers/coding tools, and run the prepared external rename helper from C:/xampp/htdocs.
2. After helper success, reopen C:/xampp/htdocs/moointer-transport; verify .local/workspace-rename.json, MySQL/preview readiness and updated handoff result. Do not infer success from npm package name alone.
3. Walk through guide /guide and the seven existing mock-role accounts for owner acceptance; record defects and only begin deployment/identity changes when explicitly requested.
