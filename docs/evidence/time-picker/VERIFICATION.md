# D229 time input verification — 2026-10-07

Scope: shared time input and popup; replacement of the search range dropdowns. No schema, data, authorization or server contract change. Earlier unrelated diagnostic/access-test work and the owner's newly supplied root PDF were preserved. No host upload/deployment performed.

## Checks

| Command | Outcome |
| --- | --- |
| `npm run typecheck` | PASS after final test edits |
| `npm run lint` | PASS |
| `npm test` | PASS 42/42; compact digit entry and invalid-hour regression included |
| `npm run build` | PASS after correcting two new Playwright assertion signatures |
| `npm run test:search:e2e -- --scoped-runtime` | Final PASS 11/11, disposable MySQL `moointer_test_run_b4f8f4cd43863ad0` |
| `npm run test:planning:e2e -- --scoped-runtime` | Final PASS 2/2, disposable MySQL `moointer_test_run_46a7b8553ba3954c` |
| `npm run deploy:package -- --skip-build` | PASS; final production build packaged in ignored `.local/deploy/moointer-transport-app.zip` |
| `git diff --check` | PASS |

Search runs used `E2E_EVIDENCE_DIR=.local/time-picker-search` for legacy screenshots, removed from the process environment afterwards. New time-picker captures stay in this directory. Prior planning screenshots were backed up before tests and restored byte-for-byte afterwards.

## Behavior checked

- Start/end are text time fields, no time select/listbox remains. Existing inclusive search and invalid-reversed-range semantics pass.
- Typing `830` normalizes to `08:30`; `24:00` displays an error and cannot initiate an invalid range search. Four-digit/Thai-digit masks and server search validation tests remain covered by the unit suite.
- Separate 00–23/00–59 spinbutton wheels: up/down buttons, Home/End/PageUp/arrow keys, native mouse wheel and Chromium touch-event swipe. Maximum values disable increase; no midnight rollover.
- No field mutation until confirmation. Cancel, Escape and outside click discard changes; outside click keeps focus on the clicked field. Explicit confirmation focuses the input. Optional clear and opening/cancelling an unknown time preserve empty values.
- Popup fits tested 1440x844 and 390x844 viewports; overall search layouts additionally checked at 768px. Screenshot panels and full pages visually reviewed.
- Shared uncontrolled template input preserves its field name and FormData value (09:30), and the existing complete planning/publication flow passes.

## Iterations and limits

The initial build caught two test assertion arguments in the wrong position; fixed. First search run exposed stale selectOption calls and normalization not running when Tab moved to the clock button; fixed actual input blur behavior and tests. Worker restarts after those failures then exhausted the real sign-in throttle; those failures were not counted as passes. Corrected search first passed 10/10, then 11/11 after adding native touch and outside-dismissal coverage. The first extended planning run passed the picker and planning flow but its extra login exhausted the suite's five-attempt window; the picker check was integrated into the existing authenticated flow, leaving production throttling unchanged, and the final run passed 2/2. The unavailable Windows Python alias was avoided; no Python edit succeeded.

No physical phone/tablet, screen-reader audit or host smoke test was performed. No full load/integration/staging suite rerun was needed for this UI-only change. New build is prepared for manual upload; it is not live on the host merely because local tests pass.

Visuals: [desktop popup](panel-1440.png), [mobile popup](panel-390.png), [desktop context](picker-1440.png), [mobile context](picker-390.png).
