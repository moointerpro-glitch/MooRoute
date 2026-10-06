# Phase 8 review — 2026-10-06

Review of the Phase 8 working tree against AGENTS.md, the Phase 8 acceptance conditions and TEST_MATRIX.md. No application code was changed by this review. "Verified" means the behaviour was reproduced in the local lab on real MySQL; "Hypothesis" means it follows from reading the code and was not reproduced.

## Outcome (fixed on 2026-10-06 — see the last section)

Two verified high-severity findings and one verified medium finding need a fix before Phase 8 can be called complete. Phase 8 is therefore reopened as **In progress**. Everything else that was checked held up.

## Findings

### R1 — High, verified: one cancelled consignment permanently blocks re-planning of its service date

- **Where:** `src/server/services/planning-reassignment.ts:9` and `:19`; the planner read has the same query at `src/server/services/planning-read.ts:26`.
- **What happens:** publishing a replacement plan requires a move for every consignment whose current assignment points at the published revision, whatever its status. A consignment cancelled after assignment keeps that assignment as history, so it is always in the list, and it can never satisfy the "ASSIGNED or WAREHOUSE_RECEIVED" check.
- **Reproduction (temporary integration test, fresh schema, synthetic data):** publish a complete plan for a date; submit a consignment, assign it to round 1, cancel it as dispatcher; save a new draft for the same date that only changes a driver; publish.
  - Without `reassignments`: `REASSIGNMENT_REQUIRED` ("กรุณาระบุเที่ยวและจุดส่งใหม่ให้พัสดุที่ผูกกับแผนเดิมครบทุกใบ").
  - With a move for the cancelled consignment: `CONSIGNMENT_IN_MOTION` ("พัสดุขึ้นรถหรือมีการรับแล้ว…"), which is also untrue for a consignment that never moved.
- **Impact:** after any assigned consignment is cancelled, that day's vehicles, drivers and trips can no longer be changed through the application, and history guards forbid a manual repair. This contradicts the rule that operational records can be reduced, merged or cancelled with audited reassignment.
- **Why tests missed it:** T08 in `tests/integration/phase6.test.ts` cancels a consignment on one date and replaces the plan of a different date.
- **Related, already documented:** a received consignment blocks the same way (reproduced: status RECEIVED, same two errors). VERIFICATION.md §10 lists "a published day with loaded or completed consignments cannot be re-planned" as a major limitation. The cancelled case is not covered by that sentence. What should happen to in-motion and completed consignments when the day is re-planned is a design decision for the owner; terminal consignments that never moved (CANCELLED) should simply not require a move.

### R2 — High, verified: a restored backup is not writable unless the trigger definer account has rights on it, and nothing detects or documents this

- **Where:** `scripts/backup-verify.ts` (compares names and row counts only); `docs/OPERATIONS.md` §6 "Equivalent manual commands"; RELEASE_CHECKLIST.md §B.
- **What happens:** all 67 guard triggers are stored with `DEFINER` = the account that ran the migration (67 of 67 in `moointer_dev`), and the dump carries those clauses. MySQL runs a trigger with its definer's privileges.
- **Reproduction:**
  - On the restored copy of the 100,000-trip database, `UPDATE Trip SET version=version ORDER BY id LIMIT 1` fails with `1142 TRIGGER command denied`; the identical statement succeeds on the source. History updates fail with 1142 instead of the intended `IMMUTABLE_HISTORY`.
  - Restoring the `moointer_dev` dump with the definer rewritten to an account that does not exist succeeds, and every statement that fires a trigger then fails with `1449 The user specified as a definer does not exist`.
- **Impact:** a restore onto a new server, into a differently named schema, or after the migration account was dropped or lost its grants yields a database where plan saves, consignment submission and every consignment update fail. `npm run db:backup:verify` still prints PASS. The acceptance condition "a disposable backup restore is verified" is met structurally only; the proposed RTO cannot be judged from it.
- **What was confirmed sound:** table contents are identical after restore (`CHECKSUM TABLE` equal for all 54 tables) and the 67 trigger definitions are identical.
- **Direction for the fix:** make the verification tool execute one allowed and one forbidden statement against the restored copy; document that the definer account must exist with TRIGGER privilege on the target schema (and that the restoring account needs SET_ANY_DEFINER), or provide a post-restore step that recreates the triggers; include accounts and grants in the list of what a complete backup needs.

### R3 — Medium, verified: the documented migration procedure fails on a server with binary logging unless a global flag is set

- **Where:** `docs/OPERATIONS.md` §5 step 3; `scripts/backup-verify.ts:26`, `scripts/load-test.ts:120`, `scripts/run-integration.ts:19`, `scripts/migrate-local.ts:27`.
- **Reproduction:** with `log_bin_trust_function_creators=0`, a schema-scoped account creating a trigger gets `1419 You do not have the SUPER privilege and binary logging is enabled`; with the flag at 1 it succeeds. The lab server has binary logging on and the flag is not in `my.ini`; the local scripts set it at run time.
- **Impact:** an operator following §5 for another environment (`npx prisma migrate deploy` with the migration account) cannot apply the five migrations that create triggers (001, 002, 005, 006, 007). D206 in DECISIONS.md records the lab choice, but the operations guide does not mention the prerequisite, and the backup and load tools change a global server setting without saying so.

### R4 — Low, verified: eligible-trip lookup ignores draft privacy

- **Where:** `src/server/services/consignments.ts:555-560`.
- **What happens:** a dispatcher calling `GET /api/consignments/{id}/trips` with the ID of another user's private draft receives the eligible trips for that draft's destination (3 trips in the probe) instead of "not found". The detail endpoint correctly hides the same draft. No personal data is returned; it confirms the draft exists and reveals its destination indirectly.

### R5 — Low, verified by reading: load-test evidence does not say that 50 workers share three sessions

- **Where:** `scripts/load-test.ts:155`; VERIFICATION.md §6.
- The 50 simulated users reuse three signed-in accounts (supervisor, requester, branch receiver). Each request still performs a session lookup, so the latency figures stand, but the write-up should state it, and it does not exercise 50 distinct sessions.

### R6 — Low, hypothesis: uploads are buffered before the size limit is enforced

- **Where:** `src/app/api/consignments/[id]/attachments/route.ts:16`, `src/app/api/imports/route.ts:15`.
- The `Content-Length` check can be bypassed with chunked transfer; `request.formData()` then reads the whole body into memory before `file.size` is checked. Requires a signed-in user. Not reproduced.

### R7 — Low, verified by reading: postal code accepted by the branch master but refused at label issue

- **Where:** `src/server/services/masters.ts:74` accepts any five digits; `src/server/domain/labels.ts:27` requires a first digit of 1–9. A branch saved with a code starting with 0 passes master validation and import, and only fails later when a label is issued (with a clear Thai message).

## Checked and found sound

| Check | Result |
| --- | --- |
| Migration 007 fidelity: all triggers of a schema at migration 006 against one at 008 | 67 before, 67 after; 42 rewritten with identical rule, table, timing and event; 25 untouched; none missing or added |
| Coverage rule and branch effective dates (probe branch active 2040-01-01 to 2040-01-31) | Not required on 2039-12-31 or 2040-02-01; all six cells required on both boundary dates |
| Capacity race: two 600 KG consignments assigned concurrently to a 1,000 KG vehicle | Exactly one assigned, the other `INELIGIBLE_TRIP` |
| Idempotency: all 29 `guardedWrite` call sites check for a prior response after authorization | Read through; no gap found |
| Authorization: all 20 API route files and 20 pages | Apart from the public liveness, sign-in, login and guide endpoints, each resolves the session actor and goes through a service that checks capability and row scope; mutations check the exact Origin |
| Receipts, returns, close; label issue, print, revoke, lookup; manifest scope | Read through; row locks and ledgers consistent with T09, T15–T17 |
| Phase 8 changes: search abort handling, session helpers, auth route, logging, CSP | Read through; behaviour matches the recorded checks |
| Thai text: error messages, JSX text and visible attributes scanned for strings without Thai | No user-facing English string found |
| Restore content | `CHECKSUM TABLE` equal for 54 tables; trigger definitions equal |

## Checks run for this review

- `npm run test:integration` with a temporary probe test appended to `tests/integration/phase6.test.ts`: 37/37 (36 existing + probe); the probe was removed afterwards and the file is unchanged in Git.
- Scratch scripts against disposable schemas for the trigger comparison, restore content, definer and binary-log checks. `log_bin_trust_function_creators` was set to 0 for one statement and restored to 1.
- **Not run in this review:** browser suites, build, load test, audit, secret scan (no application code changed). Print layouts and the import service internals were not re-inspected beyond their outline; no physical printing.

## Local side effects

Four more disposable `moointer_test_run_*` schemas (162 in total) and two more dump files (9 in total). Nothing was dropped. `moointer_dev` was only read and dumped.

## Fix and verify — 2026-10-06

All seven findings were confirmed and fixed. R6, recorded as a hypothesis, was confirmed first with a chunked-upload probe. Each code fix got a regression test that failed before the change.

| Finding | Fix | Evidence |
| --- | --- | --- |
| R1 | `requiresMove` (`src/server/services/planning-reassignment.ts`) used by publication and by `planning-read.ts`; CANCELLED and REJECTED consignments need no move | New integration test "T08: a cancelled consignment never blocks re-planning its date…": red before, green after |
| R2 | `scripts/backup-verify.ts`: checksums, definer existence and TRIGGER/SELECT privileges, rolled-back no-op update per guarded table compared with the source, definer grant replay for the disposable copy, `--check-restored`; OPERATIONS §6 restore procedure and backup contents | Old copies fail (1142, 1449); new restores of `moointer_dev` and the 1.55 M-row database pass |
| R3 | OPERATIONS §5 prerequisite and DEFINER note; notices in `migrate-local.ts` and `load-test.ts`; backup tool no longer sets the flag | Backup verification passed with the flag at 0 |
| R4 | `eligibleTrips` hides another user's draft | New integration test: red before, green after |
| R5 | VERIFICATION §6 states the three shared sessions | Documentation |
| R6 | `src/server/request-body.ts` (`readBodyWithin`), used by attachments, imports, `readWriteBody` and the sign-in route | Probe 6,044 ms → 42 ms; unit test with an endless body |
| R7 | Branch master postal code rule matches label issue | New integration assertion: red before, green after |

Final checks: typecheck, prisma validate, lint, build (no warnings); unit 27/27; integration 38/38; shell 5/5; staging rehearsal auth 4, planning 2, search 7, consignment 5, labels 6; backup verification passed for both databases; production audit 0; secret scan 0 hits.
