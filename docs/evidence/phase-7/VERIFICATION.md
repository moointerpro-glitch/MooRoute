# Phase 7 verification — labels, manifests and controlled imports

Date: 2026-10-06. Environment: Windows, Node 24.14.0, Oracle MySQL 8.4.11 on 127.0.0.1:3307, production build on 3011 with headless Chromium for browser and PDF checks. Every branch, address, contact, plate, trip and import row in the tests is synthetic. No real source sheet, PDF or image was imported.

## Commands and outcomes

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npx prisma validate`, `npx tsc --noEmit -p .`, `npm run lint` | Passed | Schema with migration 006 (53 models, six migrations) |
| `npm test` | Passed 24/24 | 19 existing + 5 new (label rules, QR encode/decode, CSV/XLSX readers, mapping and value parsing) |
| `npm run test:integration` | Passed 36/36 | 33 existing + 3 new; final run `moointer_test_run_8925952bafc51601` |
| `npm run build` | Passed, no warnings | New routes under `/print`, `/l`, `/admin/imports`, `/api/labels`, `/api/imports` |
| `npm run test:labels:e2e` | Passed 6/6 | Final regression run `moointer_test_run_06921bfc719c0220` |
| `test:consignment:e2e` / `test:search:e2e` / `test:planning:e2e` / `test:auth:e2e` / `test:e2e` | 5/5, 6/6, 2/2, 4/4, 5/5 | Regression |
| `npm audit --omit=dev` | 0 vulnerabilities | After adding qrcode-generator 2.0.4 |
| Current-value secret scan (199 text files) | 0 hits | — |
| Backup of `moointer_dev` + restore rehearsal | Passed with the documented normalization | 54 tables, 62/62 triggers, 3/3 users restored into `moointer_test_run_restore113518` |
| `npm run db:migrate:local`, `npm run auth:setup:local` | Passed | Migration 006 on moointer_dev; grants checked with `SHOW GRANTS` |

## Acceptance trace

| Requirement | Evidence |
| --- | --- |
| Print both formats at actual scale with long Thai addresses, packages 1/3–3/3 (T16) | Browser test 1: A4 sheet measured 210 × 297 mm with 105 × 148.5 mm labels; sticker sheets 100 × 150 mm; a 280-character Thai address and long contact fit without overflow at 11 pt; PDFs produced from the page's own `@page` rule have 1 A4 page (595 × 842 pt) and 3 sticker pages (283.5 × 425 pt). Files `labels-a4.pdf`, `labels-sticker.pdf` |
| A reprint does not create records (T17) | Integration: consignment, package and label counts unchanged, only PrintEvent +2; the same idempotency key replays. Browser: reprint requires a reason, history shows first print and reprint, still one version and three packages |
| Revoked QR versions are rejected with the replacement for authorized users (T17) | Integration and browser: after reassignment the scanned URL reports REVOKED; after re-issue it names version 2; revoked versions render no label and cannot be printed; a vehicle change on the same trip (plan replacement) and an address correction also revoke |
| QR carries only an authenticated lookup URL | Unit and browser: the code decodes (jsQR) to exactly `<base>/l/<32-char token>?p=<n>`; lookup redirects to login when signed out, is 401 on the API, and denies other branches and roles without access |
| Incomplete addresses are blocked (T16) | Integration and browser: postal code 00000 → LABEL_INCOMPLETE; only the watermarked sample without QR is available |
| Label payloads and history are immutable (T18) | Integration: direct update of a payload is rejected by trigger; old payload keeps the old vehicle after a vehicle change |
| Manifest per trip grouped by destination with totals and signatures | Integration: groups, package totals, per-unit totals, label numbers, scope rules. Browser: two destination groups, signature areas, 1-page A4 PDF (`manifest.pdf`) |
| Mixed-validity import stays uncommitted until handled (T22) | Integration and browser: IMPORT_HAS_ERRORS with nothing written; row-specific Thai errors; skip/update decisions; a row that fails during commit (retroactive branch) rolls back an earlier applied row |
| The same batch cannot duplicate records (T22) | Same file + edition reopens the batch; committing a committed batch is a no-op; raw rows and closed batches are frozen by triggers |
| Repeated category pages, reference dates and ambiguity (T23) | 18 synthetic rows over three pages → 2 templates and 1 route; another reference date is a separate batch needing an explicit decision and appends revisions; unknown departure stays null; ambiguous plate, alias, unknown category, bad round/weekday/date are reported, nothing is guessed |
| PDFs and images are reference material | Unit, integration and browser: REFERENCE_ONLY with a Thai explanation; no OCR path exists |
| Permission checks (T13) | Requester cannot issue; branch receiver cannot print or open manifests; other branch cannot look up; warehouse and dispatcher cannot import branches; administrator cannot import schedules; cross-kind template download is 403 |

## Failures found and corrected

1. Plan publication (Phase 4 code) wrote transport snapshots without a service date, so a label could not be issued after a vehicle change. The snapshot now records it, and the label payload falls back to the trip's immutable plan date.
2. Importing a new branch with a past opening date correctly violates published coverage. The integration test was reshaped to use this as the rollback proof (an earlier updated row is rolled back with it).
3. The branch master requires contact name and phone, but the import field list marked them optional. The import specification now matches the master form.
4. Browser test issues, not product defects: a stale counter after client-side navigation let the test leave before the reprint finished; the print URL was captured before navigation completed; an assertion used a non-existent second argument. All fixed.
5. Print polish after visual review: the manifest's หีบห่อ header wrapped mid-word; the sample label showed a version number instead of ตัวอย่าง.
6. A wrong expected value in a unit test (Excel serial 46296 is 2026-10-01; the parser was right).

## Screenshots and files

`print-a4-screen.png`, `print-sticker-screen.png`, `print-sample.png`, `manifest-screen.png`, `labels-page-{1440,768,390}.png`, `labels-history-1440.png`, `lookup-revoked.png`, `import-review-1440.png`, `imports-{768,390}.png`, plus the three PDFs. Manually inspected: print-a4-screen, manifest-screen, print-sample. The PDFs could not be rendered for visual inspection in this environment (no PDF rasterizer); their page counts and page sizes are asserted by the tests.

## Not run / remaining

- No print on a physical printer: margins, cut alignment of the A4 sheet and QR scan distance must be checked on the real device (D106).
- No scan with a physical scanner or phone camera; QR content was verified by software decode.
- XLSX support is limited to the first worksheet with text and numbers; styled date cells are accepted only as serial numbers or text.
- Imports cover branches, vehicles and schedule templates. Drivers, categories and dated trips are not importable.
- Load test, screen-reader pass and Phase 8 release work are not started.
