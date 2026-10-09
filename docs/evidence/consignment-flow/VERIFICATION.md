# D236 merged table, progress, action dialogs, tracking and history — verification (2026-10-08)

Scope: owner request of 2026-10-08, see DECISIONS D236. Local machine only: Oracle MySQL 8.4.11 on 127.0.0.1:3307 with a fresh disposable schema per run. No migration was added; nothing was deployed; no hosted data was read or changed.

## What was checked

| Area | Evidence |
| --- | --- |
| A merged row (packaging, pieces, item name, optional inner quantity and unit, note); request category; old shapes still accepted; a separate item list cannot be mixed with inner quantities | `tests/unit/consignment.test.ts` "D236: one merged row…", "submission completeness…" |
| No reject action; a reviewer cancels a pending request and can never reach a draft | unit "D236: no reject action…"; `tests/integration/phase6.test.ts` T08 (reason required, warehouse refused, planner cancels pending, another person's draft is NOT_FOUND) |
| Progress built from recorded facts only: current step, who acts next, skipped step without a record, partial receipt, issue, cancelled, closed with returns | unit "D236: progress shows what is done…" |
| Rows linked to their item balance by ID; category filter and name search on the request document; active and finished phases; status counts with the caller's row scope; closed with returns reported as not delivered in full | `tests/integration/phase6.test.ts` "D236: merged rows link…" |
| Form, detail table without weight and location columns, progress to "จัดส่งสำเร็จ", one dialog per action (cancel reason only inside its dialog, trips loaded for the requested date, calendar usable inside the dialog, piece checklists, scan by piece number), tracking with next step, history, typing searches without a button, planner cancels a pending request | `tests/e2e/consignment.spec.ts`; screenshots `consign-form-1440.png`, `assign-dialog-1440.png`, `consignment-detail-1440.png`, `tracking-*.png`, `history-*.png`, `form-*.png`, `detail-*.png` |
| Search expressions on MariaDB | Literal read-only `SELECT` on the local XAMPP MariaDB 10.4.32: `JSON_SEARCH` over `$.packaging[*].name` and `$.packaging[*].description` matches names and notes but not keys; `JSON_UNQUOTE(JSON_EXTRACT(doc,'$.categoryId'))` matches, and is NULL for an old or NULL document. No schema or data was touched |

## Commands and results

See the table in docs/PROGRESS.md (top section) for the final numbers of this session; schema names of the browser runs are printed in the run output and retained on the local MySQL server.

## Found while looking at the screenshots and fixed

1. The search icon covered the first letters of the placeholder in the new filter (an earlier, more specific input rule set the padding). Fixed with a rule of equal specificity.
2. The dialog footer was cut by a few pixels because it was pinned 24 px below the scroll area. Pinned to the bottom edge instead.
3. On a phone the action buttons came after the whole record, so staff had to scroll to the end to act. They now come first below 1100 px.
4. Fields typed inside the new dialogs had no field styling (the shared rule listed only the page containers). Added.

## Limits

- Not verified: the hosted system, a physical printer or scanner, screen readers, real phones (responsive checks ran in Chromium at 1440, 768 and 390 px), MariaDB beyond the literal queries above.
- A request with items of several categories carries one category (accepted by the owner).
- Requests entered through the form are never checked against vehicle capacity, because the form no longer asks for weight (accepted by the owner).
- The detail page does not highlight a menu item; its status decides whether it belongs to tracking or history, and the back link says which.

## D237 addendum — packaging as the unit and self-refreshing lists

- Wording is asserted in `tests/unit/consignment.test.ts` (`pieceName`, `packagingCountText`) and in the browser flow (count column, totals, dialogs, scan messages; the detail page contains no generic counter word).
- Cause of the stale list, by control runs of `npm run test:consignment:e2e -- --scoped-runtime` with only `router.refresh()` disabled in `AutoRefresh`: the step that returns to tracking with the browser's Back button still passed (so that was not the cause), and the two-session step failed with "พบ 1 รายการ" after 30 s (another person's cancellation never reached the open list). With the real component both pass (schema `moointer_test_run_f22a329e015d48ee`).
- Screenshots in this folder are from the final run.
- Limit: the 20 s and 30 s timers were exercised in Chromium only; behaviour on a phone browser that suspends background tabs relies on the re-read when the tab becomes active again, which was not tested on a real phone.
