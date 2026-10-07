# Access policy and product naming verification

Date: 2026-10-06. Owner-authorized changes D216/D217. All database tests use fresh disposable Oracle MySQL 8.4.11 schemas; no non-disposable data was reset. No schema or migration change; no deployment or commit.

## Baseline and resulting behavior

Baseline code and regression expectations restricted warehouse search, branch company visibility and creation to REQUESTER. Main navigation showed links without capability filtering. Owner requested common published reads, own creation for all seven roles, filtered action menus and product/folder names. Current integration and browser tests confirm the resulting behavior, preserving D215 administrator draft reads and operational/contact scopes.

- Common published searches cover all seven roles, all trip kinds and only the selected published service date; drafts are not searchable.
- Every role can draft/submit/cancel its own request. Explicit sender department is mandatory even with GLOBAL; department scope removal blocks same-key draft and submission replay. Sender membership alone does not widen history or attachment reads.
- Own-request assignment/rejection/reassignment rejects SELF_REVIEW (HTTP 403), including administrator and eligible-trip lookup. Plan publication with own linked reassignment rolls back and retains the existing published plan.
- Navigation hides unpermitted entries. Authorized but premature actions show disabled buttons and Thai reasons, including receive-before-departure. Warehouse creation and full multi-role lifecycle through closure pass.
- Home title and manifest names match the requested English/Thai titles. Guide contains plan/consignment diagrams and all seven role duties at desktop/tablet/mobile widths.

## Actual successful checks

| Exact command | Actual outcome / retained evidence |
| --- | --- |
| npm run lint | PASS, zero warnings |
| npm run typecheck | PASS |
| npm test | PASS 27/27 |
| npm run test:integration | PASS 39/39; moointer_test_run_a590126457904c4e |
| npm run test:access:integration | PASS 3/3; moointer_test_run_ac8d23fee728c2de |
| npm run build | PASS, production compilation and page generation |
| npm run test:e2e | PASS 5/5; browser title, install names, Thai shell and guide at 1440/768/390 px |
| npm run test:planning:e2e -- --scoped-runtime | PASS 2/2; moointer_test_run_d2fc8ea8cfe0c419 |
| npm run test:search:e2e -- --scoped-runtime | PASS 7/7; moointer_test_run_7ece82100bf12bcf |
| npm run test:consignment:e2e -- --scoped-runtime | PASS 7/7; moointer_test_run_5e03e31094e5facb |
| npm run test:staging | Auth PASS 4/4 (38f4bb0f8350a8a0), labels PASS 6/6 (feeb5675d1cb717f); overall attempt FAIL because planning/search/consignment expectations needed correction; affected suites subsequently pass above |
| npm audit --omit=dev | PASS, zero vulnerabilities |
| npm run auth:sync:local | PASS; additive seven-role grants, nine known active local synthetic memberships; existing requester membership/passwords preserved |
| npm run db:backup:verify | PASS twice; post-sync restore moointer_test_run_restore67f772692adc matches 437 rows, 54 tables, 67 triggers, 229 constraints; zero diffs/usability failures |
| npm run db:check | PASS after MySQL restart: InnoDB, utf8mb4, Oracle 8.4.11 |
| powershell -NoProfile -ExecutionPolicy Bypass -File scripts/rename-workspace.ps1 -CheckOnly | PASS exact source/target and MySQL path validation; PowerShell parser also passed |
| GET http://127.0.0.1:3010/api/health/live | PASS after npm start; current production preview restarted |
| git diff --check | PASS; line-ending notices only |

## Failures observed and corrected

The first typecheck found a missing statusLabels import; corrected. Initially running the new access fixture before historical phase suites created extra published plans/active branches and invalidated baseline count expectations: 39/42. Access tests now run in their own fresh schema (3/3), existing six phase suites remain 39/39; no failing tests were removed. The supervisor creation denial expectation was updated to the new policy.

A staging run started before the clean MySQL restart completed and failed fixture setup; restarted after database readiness. One overlapping shell run was refused because staging owned port 3011; subsequent browser runs are sequential. Staging then exposed three obsolete/incorrect browser expectations: branch default login should land on search, branch company-wide list should count 8 while selected-branch results remain 5, and the draft API action is saveDraft. These were corrected; all affected browser suites pass. Node printed its pre-existing NO_COLOR/FORCE_COLOR notice; assertions passed.

Two Rename-Item attempts failed with Windows sharing errors. Handles are held by VS Code, Explorer/Photos and coding-tool processes; no handles were force-closed. MySQL configuration was restored and services restarted at C:/xampp/htdocs/MooRoute. The folder is still MooRoute; relocation to moointer-transport remains pending closing applications holding it. The prepared external helper C:/xampp/htdocs/rename-moointer-transport.ps1 re-verifies a backup, renames without copy/delete/reset, updates absolute MySQL paths, preserves .env, builds and restarts the preview. Its full relocation path has not succeeded and must not be called passed.

## Visual evidence

Screenshots contain synthetic fixtures only. Inspected the mobile guide and dispatcher self-review screen: flows, Thai role descriptions and disabled reasons are readable. Automated overflow checks pass at 1440/768/390 px. Files: guide-1440.png, guide-768.png, guide-390.png, self-review-blocked.png, warehouse-own-form.png, published-search-1440.png, consignment-detail-390.png. Prior Phase 1/3–7 evidence was restored after browser runners overwrote it.

## Remaining work and limits

No known failing application check for D216/D217. Folder relocation is incomplete because external applications hold the workspace. Existing production authentication/HTTPS/monitoring/backup scheduling, source-master verification, physical printing/scanning, screen-reader and user-acceptance limitations remain in the Phase 8 release checklist. Load tests were not rerun; no new performance claim. No web account editor was added. Next actions: (1) release workspace handles and run the external rename helper; (2) reopen the target and verify MySQL/preview and recorded helper checks; (3) user-acceptance walkthrough using the seven existing mock roles and then separately authorize any release work.
