# Planning navigation and editing UX — 2026-10-08

Scope: daily planning, trip detail/edit/copy, route/template editors, publication and removal confirmations, actionable coverage, and master-data navigation guidance. Synthetic fixtures only. The owner authorized local implementation of the reviewed UX recommendations; no hosted publication or deployment was performed.

## Implemented behavior

- `/admin/planning/edit` is an authenticated, capability-checked dedicated page. Its URL carries the service date, selected plan revision, editor type and record identity; it survives refresh. Trip copies are provisional until explicitly saved.
- A trip submission persists the complete version-checked daily draft once, then returns to the selected date/revision with updated server coverage and a focus highlight. Route/template saves return to their respective lists. Return navigation restores the previously recorded list scroll position; dates and tabs are represented in the list URL.
- Edited fields are protected on in-app navigation and browser Back by a discard dialog. Reload/tab close uses the browser's native unsaved-data warning. Calendar/time-picker selections, stop reorder/add/remove, typing and pasting mark the form changed. Failed writes leave fields on screen. Repeated network retries of the same editor payload retain the idempotency key; an explicit HTTP error resets it. Existing server concurrency, authorization and historical revision rules are unchanged.
- Native modal dialogs display trip details and category codes, missing-cell repair guidance, and confirmation for publish/cancel/remove/merge. Native focus containment, Escape dismissal, scroll locking and focus return are used. Busy confirmations cannot be dismissed or submitted twice.
- Coverage headings group pork/chicken beneath one heading per round. Missing cells link to candidate trips in that round. Missing/inactive canonical category codes produce explicit guidance and a link to the category list; the system does not infer canonical categories from names or rewrite master data.
- Trip status says vehicle/time completeness rather than implying all coverage is satisfied. Actions have visible text; details no longer expand beneath table rows. Master edit pages have a top back link; category forms explain exact `PORK` / `CHICKEN` codes and putting test labels in names.
- Every operational change still creates an audited draft; publication is a separate explicit action. The previous published revision remains authoritative until the server accepts the replacement. Existing advanced options, historical read-only disclosures and multi-day tools remain available.

## Checks

- `npm run build`: PASS, including the new edit route.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test:planning:e2e -- --scoped-runtime`: PASS 2/2, 28.8 seconds, disposable MySQL `moointer_test_run_7b9efa4d9b7ca22c`; least-privilege web runtime.
- Planning browser coverage: authenticated route/template creation, idempotent generation, single-save trip copy/edit, modal Escape/focus return, date/revision restoration after refresh, browser Back discard/continue, retained fields after simulated HTTP 503 then successful retry, merge/removal, complete 18-cell coverage, disabled incomplete publication plus direct server rejection, successful publication after confirmation, authorization, multi-day tools and responsive layouts.
- Noncanonical category guidance is tested with an explicitly mocked read-response fixture. It does not modify database category codes. Write failures are simulated only for the field-retention check; ordinary planning and publication use real MySQL.
- `npm run test:auth:e2e -- --scoped-runtime`: PASS 4/4, 14.4 seconds, disposable MySQL `moointer_test_run_e0caadf1da6e2d05`; actual master saves/edits, authorization/CSRF, login, wheel integers and vehicle/branch responsive forms.
- `git diff --check`: initial whitespace findings in the adapted browser test were corrected; final result recorded in PROGRESS.

## Iterations and visual evidence

An initial return-navigation defect passed a route revision ID as a plan revision ID; fixed by carrying the original plan revision for catalog saves. Initial test failures also revealed assumptions in the old script: hidden advanced controls needed opening, Next's route announcer made a global alert locator ambiguous, and copied trips are now saved/sorted rather than always last in the list. Locators and setup were updated to match actual user flows and stable IDs. Earlier disposable schemas were retained. A canceled navigation stream warning during an early test was removed by awaiting navigation before the next `page.goto`.

Screenshots include trip editors at 1440/390 px, detail dialog, 1440/768/390 px daily planning, coverage rejection, history and category guidance. Selected desktop and mobile editor/modal/daily-plan screenshots were visually inspected. The existing evidence directories are restored byte-for-byte after copying this run's planning screenshots here.

## Limits

No schema changes, master-code correction, production data writes, host upload or service restart. No screen-reader or physical-device certification. This is a local Chromium/Windows verification against disposable MySQL, not a DirectAdmin/MariaDB deployment test. Unrelated application modules were not redesigned. Review the local build before a separately authorized hosted update.

## Delivery artifact

`npm run deploy:package -- --skip-build`: PASS. Staging path was resolved and verified inside the workspace before replacement. ZIP `.local/deploy/moointer-transport-app.zip`: 9726604 bytes, 1,134 entries, SHA-256 `2c0de7596926a70275881522bf793e8d6c561f77897b4539af56a2ed4552a424`. Archive contains the new edit page and only `.env.example`, not a live `.env`. Existing development server on 127.0.0.1:3010 retained; GET /api/health/live returned status ok. No SQL regeneration or deployment.
