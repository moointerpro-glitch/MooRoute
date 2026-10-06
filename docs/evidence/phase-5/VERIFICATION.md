# Phase 5 verification — Thai route search

Date: 2026-10-06. Environment: Windows, Node 24.14.0, Oracle MySQL 8.4.11 on 127.0.0.1:3307 (InnoDB, utf8mb4_0900_ai_ci), production build served by `next start` on 3011 for browser tests. All search data is the synthetic fixture in `tests/fixtures/search.ts` (service dates 2028-03-01/02/03); no source plate, contact or schedule was imported.

## Commands and outcomes

| Command | Result | Evidence |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | Passed | No type errors |
| `npm run lint` | Passed after fix | First run: 2 unused destructured variables in `trip-search.ts`; replaced with an explicit mapper |
| `npm test` | Passed 13/13 | 8 existing + 5 new search-domain unit tests |
| `npm run db:validate` | Passed | Schema unchanged; no migration added |
| `npm run test:integration` | Passed 29/29 | 23 existing + 6 Phase 5 tests on fresh `moointer_test_run_b636f38babdb290a` |
| `npm run build` | Passed | New routes `/trips`, `/trips/[tripId]`, `/branches`, `/consign`, `/api/search`, `/api/search/branches` |
| `npm run test:search:e2e` | Passed 6/6 | Fresh `moointer_test_run_e2d7f7a20c784870` (first green run); final rerun after CSS fixes also 6/6 |
| `npm run test:e2e` | Passed 5/5 | Public shell after copy update |
| `npm run test:auth:e2e` | Passed 4/4 | Regression |
| `npm run test:planning:e2e` | Passed 2/2 | Regression, `moointer_test_run_0c8d7b0000302861` |
| `npm audit --omit=dev` | 0 vulnerabilities | — |
| Current-value secret scan (144 tracked/untracked text files vs `.local/auth` and `.env` values) | 0 hits | — |

Failures found and corrected during the session:

1. The first integration run reused 2027-03-01, which a Phase 4 test already publishes; the fixture's idempotent `publish` skipped and assertions saw Phase 4 trips. The search fixture moved to unused 2028 dates.
2. The first browser run hit the real sign-in throttle (5 attempts/minute) on the sixth login. The throttle was kept; the spec reuses one UI-created session per account inside the worker.
3. Visual review found the hamburger toggle visible on desktop (generic `.icon-button` overrode `.menu-toggle`) and the departure clock icon wrapping above its time (Tailwind preflight `svg{display:block}`); both were fixed in CSS and screenshots were regenerated.
4. Regression browser suites regenerate Phase 1/3/4 evidence screenshots; those historical files were restored from Git so earlier evidence is unchanged.

## Acceptance trace

| Requirement | Test |
| --- | --- |
| T04 pork at A + chicken at B never satisfies A + chicken; alias, Thai digits, case-insensitive code, ambiguity (no arbitrary pick), literal `%` | `phase5.test.ts` T04; browser alias autocomplete and ambiguous candidate selection |
| T05 exact times OR; inclusive range endpoints; reversed/partial range rejected; duplicate matched stops → one row with both matched sequences | `phase5.test.ts` T05; browser chip OR (3 trips) and range 15:30–16:00 (2 trips), reversed range Thai error |
| T06 loading ≠ departure; NULL loading/departure never matches; previous-day loading shown as `23:45 (วันก่อนหน้า)`; 23:59 stays on D, 00:00 belongs to D+1 | `phase5.test.ts` T06 (unknown departure via clearly labelled privileged fixture because publication correctly rejects it); browser `ยังไม่ระบุ` |
| T20 counts, facets, chips, span, sorting and pagination use one predicate inside one repeatable-read transaction | `phase5.test.ts` T20 (pages of 3 concatenate to the full list; desc order; rounds/kinds) |
| T13 scope: GLOBAL all; BRANCH trips visiting branch; DRIVER own; DEPARTMENT outbound only; no `trip.read` → 403; out-of-scope detail → 404; contacts per branch policy | `phase5.test.ts` T13; browser T13 (401/403/400 APIs, branch receiver contact visibility, admin denial) |
| T19 Thai labels, keyboard tabs, combobox, 1440/768/390 layouts without horizontal page scroll; table → cards ≤900 px | Browser responsive tests and screenshots below |
| Eligible-trip action is a pre-check only; no consignment is created | `phase5.test.ts` eligibility test (0 consignments); browser consign hand-off shows the Thai “not yet open” notice and no submit control |

## Screenshots and comparison with the reference mockup

Files: `search-{1440,768,390}-{branch,time,range}.png`, `trip-detail-{1440,768,390}.png`, `branches-{1440,768,390}.png`, `consign-handoff-1440.png`.

Manually inspected: search-1440-branch, search-1440-range, search-390-time, trip-detail-768 (after fixes).

- Same hierarchy as the reference: identity header with red active navigation, title/subtitle, three metric cards (trip count, time span, three modes), one search card with three tabs (red selected tab), mode panel, red count badge, sort control, results table, footer “แสดง x–y จาก N รายการ” with “หน้า 1 จาก 1”.
- Branch mode: search input with clear button and red ค้นหา button, as in panel 1; the matched branch is highlighted in the route chain.
- Time mode: checkbox chips in a grid with red checked state, as in panel 2; chips are derived from data, so values differ from the illustration.
- Range mode: start/end selects and a full-width red search button on mobile, as in panel 3; an inclusive-boundary note is added.
- Intentional differences: counts, times and names come from synthetic data (no fixed 41, no invented phone numbers); filters for date/round/category/trip type sit above the tabs per UI_SPEC; the results table uses the UI_SPEC columns (loading and departure shown separately) instead of the mockup's “สาขาอื่นร่วม/เบอร์โทร” columns, and authorized contacts appear under the matched stop; a text wordmark with a route icon replaces the unapproved pig logo; the decorative bus illustration is omitted.
- Not claimed: pixel-level fidelity, contrast measurement with tooling, or screen-reader testing with assistive technology.
