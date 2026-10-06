# Phase 6 verification — consignments, tracking and branch receipts

Date: 2026-10-06. Environment: Windows, Node 24.14.0, Oracle MySQL 8.4.11 on 127.0.0.1:3307, production build on 3011 for browser tests. All consignment, branch, trip and contact data in tests is synthetic.

## Commands and outcomes

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npx prisma validate`, `npx prisma generate` | Passed | Schema with migration 005 (53 models) |
| `npx tsc --noEmit -p .`, `npm run lint` | Passed after fixes | See failures 7–9 |
| `npm test` | Passed 19/19 | 13 existing + 6 new (transition matrix, draft validation, completeness, history filters, file signatures, upload path guard) |
| `npm run test:integration` | Passed 33/33 | 29 existing + 4 new Phase 6 tests; final run `moointer_test_run_e81a2a22e902901a` |
| `npm run build` | Passed, no warnings | After the Turbopack tracing fix |
| `npm run test:consignment:e2e` | Passed 5/5 | Final regression run `moointer_test_run_65c5c5dab02dca59` |
| `npm run test:e2e` / `test:auth:e2e` / `test:planning:e2e` / `test:search:e2e` | 5/5, 4/4, 2/2, 6/6 | Regression after navigation and hand-off changes |
| `npm audit --omit=dev` | 0 vulnerabilities | — |
| Current-value secret scan (168 text files vs `.local/auth` and `.env` secrets) | 0 hits | — |
| mysqldump of `moointer_dev` before migration + restore rehearsal | Passed with normalization | 53 tables, 59/59 triggers, 4 migrations, 3/3 users restored into `moointer_test_run_restore104834` |
| `npm run db:migrate:local`, `npm run auth:setup:local` | Passed | Migration 005 on moointer_dev; grants reviewed with `SHOW GRANTS` (no DELETE on history); Thai category names verified byte-exact |

## Acceptance trace

| Requirement | Test |
| --- | --- |
| Full marketing shipment, 30 posters in 3 boxes (T14) | Integration test 1 (service) and browser test 1 (search → form → submit → assign → warehouse → load → depart → receive → close across five real roles) |
| Partial receipt with later completion (T15) | 2 boxes + 20 sheets → PARTIALLY_RECEIVED; box 3 + 10 → RECEIVED; close |
| Rejected transitions | Load before warehouse receipt, receipt before departure, close while ISSUE, reassign after loading, requester cancel after assignment |
| Duplicate submission (T10) | Same key replays identical result with one SUBMITTED event; a new key gets INVALID_TRANSITION |
| Concurrent over-receipt (T09) | Two concurrent 10-sheet receipts at the same version: exactly one commits; a further sheet fails RECEIPT_EXCEEDS_SENT; ledger sums to 30 |
| 30 items vs 3 boxes | Receiving the item in BOX unit fails RECEIPT_UNIT; packages and sheets are separate ledgers |
| Unauthorized cross-branch access (T13) | Branch B cannot receive/read A's consignment or download its files; warehouse cannot assign; dispatcher cannot close; cross-origin POST 403; anonymous 401; other users' drafts 404 |
| Cancellation/reassignment without orphans (T08) | Manual reassignment keeps the previous assignment, revokes labels and moves the pointer; cancellation keeps the assignment history; Phase 4 plan replacement cancels a trip and moves an assigned consignment atomically; no active consignment points at a cancelled trip |
| Issues, returns, corrections (T15) | Shortage issue keeps resumeStatus; supervisor return of an undelivered box; returned box cannot be a received box; resolution compensates the issue event; close with returned package; corrective receipt before departure needs consignment.correct and records a CORRECTION event |
| Eligibility and limits | Capacity 1,200 KG > 1,000 KG rejected; past trip rejected by cutoff; wrong stop rejected |
| Files and snapshots (T18) | Signature check (HTML named .png rejected in the browser), size/type/count limits, sanitized names, scoped downloads with attachment headers; branch address edited after assignment leaves the snapshot unchanged; direct DB edit of a submitted request blocked by trigger; closed status cannot be reopened |
| Thai, responsive UI (T19) | Form, history and detail at 1440/768/390 px without horizontal page scroll |

## Failures found and corrected

1. The integration expectation for reassigning a loaded consignment was CONSIGNMENT_IN_MOTION. The transition matrix correctly rejects earlier with INVALID_TRANSITION; the test now expects that.
2. The Phase 5 fixture gives branch B a contact, so the "no recipient contact" check passed unexpectedly. The test now clears B's contact first.
3. A browser selector for จำนวนหีบห่อ matched the section, input and radio; replaced with a role selector.
4. The 390 px detail page overflowed: the collapsed `1fr` grid track grew to the items table's min-width. Fixed with `minmax(0, 1fr)`.
5. Required-field markers wrapped onto their own line (grid labels); labels changed to block layout.
6. A skip link appeared mid-image in full-page screenshots. Diagnosis: not focused (transform hides it), but Chromium positions fixed elements relative to the scroll position during full-page capture. Screenshots are now taken from the top. Focus management was also added: the outcome message receives focus after every action, so focus is never lost when a button disappears.
7. Turbopack warned that dynamic upload paths traced the whole project; the fs calls are now marked `turbopackIgnore`.
8. Lint/type fixes: unused destructured fields, JSON typing of draft items, ProcessEnv typing in the unit test.
9. Unit tests cannot import `server-only` modules; the pure file rules moved to `src/server/domain/files.ts`.
10. Backup: a shell-redirected dump had CRLF line endings (fixed with `--result-file`), and existing single-statement triggers dump as `...; */;;`, which does not restore as-is. Restore was verified with the documented normalization; a permanent fix is left for Phase 8.

## Screenshots

Files in this folder: `consign-form-1440.png`, `consignment-detail-1440.png`, and `form-`, `history-`, `detail-{1440,768,390}.png`. Manually inspected: consign-form-1440, consignment-detail-1440, detail-390, history-768 (after fixes). Thai labels, red primary actions and white cards follow the search page. The mobile items table scrolls inside its own region.

## Not run / remaining

- Phase 7: label issue/print/QR/manifests. Label revocation on reassignment/cancellation is implemented and tested with synthetic label rows, but no label issue UI exists.
- Not run: load testing, screen-reader pass, virus/malware scanning of uploads (only signature/size/type checks), upload retention policy, production storage.
- Operational values still proposed: cutoff lead (0 minutes), weights only in KG, D209/D210 scope rules.
