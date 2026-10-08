# D234 packaging lines and D235 unrestricted administrator — verification (2026-10-08)

Scope: owner request of 2026-10-08. See DECISIONS D234 and D235. Local machine only: Oracle MySQL 8.4.11 on 127.0.0.1:3307 with a fresh disposable schema per run; nothing was deployed and no hosted data was read or changed. No migration was added.

## What was checked

| Area | Evidence |
| --- | --- |
| Packaging lines validated, totalled, expanded to numbered pieces; legacy requests read as one "หีบห่อ" line; submission rules | `tests/unit/consignment.test.ts` (3 new or rewritten tests) |
| Draft → submit with packaging only (no item list), one package record per piece with per-line weight, frozen request document, history search by contents, CSV-safe wildcard handling | `tests/integration/phase6.test.ts` "D234: the sender states what the goods are packed in…" |
| Capacity: a vehicle capacity in boxes is not checked and does not block; a kilogram capacity is still enforced against the stated weight | same test, and the unchanged T08 test (3 × 400 kg refused) |
| Administrator edits, attaches to, submits and cancels another person's request; reviews their own request; moves it through plan publication; works without scope rows; a planner is still refused for their own request | `tests/integration/access.test.ts` "D216/D235…" and "D235…", `tests/integration/phase6.test.ts` T13 (D215) |
| Form, detail page, piece checklists, scan by piece number, history list | `tests/e2e/consignment.spec.ts`; screenshots `consign-form-1440.png`, `consignment-detail-1440.png`, `form-*.png`, `detail-*.png`, `history-*.png` |
| Label prints packaging and sender on single lines and still fits at the 300-character address limit (13.4 mm spare measured on the A4 quadrant); scan result names the piece and where it is; manifest counts pieces | `tests/e2e/labels.spec.ts`; `print-a4-screen.png`, `print-sticker-screen.png`, `labels-sticker.pdf`, `manifest-screen.png`, `lookup-revoked.png` |
| History search expression on MariaDB | Literal read-only `SELECT JSON_SEARCH(…, '$.packaging[*].description')` on the local XAMPP MariaDB 10.4.32: match, no match on JSON keys, legacy document and NULL document return NULL, escaped `%` is literal. No schema or data was touched |

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS 45/45 |
| `npm run test:integration` | PASS 42/42 (schema `moointer_test_run_878090af3da50406`) |
| `npm run test:access:integration` | PASS 19/19 (schema `moointer_test_run_a3f1d04b2672cb21`) |
| `npm run build` | PASS |
| `npm run test:consignment:e2e -- --scoped-runtime` | PASS 7/7 on the final build (schema `moointer_test_run_83cbd99fce2ee264`) |
| `npm run test:labels:e2e -- --scoped-runtime` | PASS 6/6 (schema `moointer_test_run_74d5509216aee085`) |
| `npm run test:auth:e2e -- --scoped-runtime` | PASS 4/4 (schema `moointer_test_run_b6019263b236a63d`) |
| `npm run test:planning:e2e -- --scoped-runtime` | PASS 2/2 (schema `moointer_test_run_79ea9c73342e6444`) |
| `npm run test:search:e2e -- --scoped-runtime` | PASS 11/11 (schema `moointer_test_run_733b08dce3a53d97`) |
| `npm run test:users:e2e -- --scoped-runtime` | PASS 2/2 (schema `moointer_test_run_6f22c22945d30ba0`) |
| `npm run test:e2e` | PASS 5/5 |
| `npm run deploy:package -- --skip-build` | PASS; `.local/deploy/moointer-transport-app.zip`, 9,927,670 bytes, not uploaded |
| `git diff --check` | Clean |

Not run: `npm run test:staging` (the same browser suites were run one by one instead), `npm run test:load`, `npm run db:backup:verify`.

## Failures found during the work and how they were resolved

1. First consignment browser run: 7/7 failed. The server page imported the blank packaging row from the `"use client"` form module, which arrives on the server as a client reference and not as a value, so the form crashed while rendering (`Cannot read properties of undefined (reading 'trim')`). The type checker cannot see this. Fixed by moving the row type and default to the shared module `src/lib/consignment-format.ts`. The remaining six failures in that run were sign-in throttling after the first crash.
2. First label browser run: the label overflowed by 1.3 mm with the 275-character test address because the first layout added packaging and sender as wrapping rows beside the QR code. Reworked: packaging under the heading and the sender on one full-width line, both cut with an ellipsis. A permanent check now pads the address to the 300-character limit.
3. One label lookup assertion still expected the old text "…-1/3 · ผู้ฝาก"; it now expects "ชิ้นที่ 1/3 · หีบห่อ · อยู่กับผู้ฝาก".

## Limits

- Not verified: the hosted system, a physical label printer or scanner, screen readers, MariaDB beyond the literal query above (the integration and browser suites ran on MySQL 8.4 only).
- A request without an item list is not found by the "หมวดสิ่งของ" filter (accepted by the owner, option ก).
- On a 390 px screen the "ตอนนี้อยู่ที่" column of the packaging table is reached by scrolling the table sideways; the summary line above the table always shows how many pieces the branch has received.
- Earlier evidence folders were restored after the runs: tracked folders with `git checkout`, untracked folders from a copy taken before the runs.
