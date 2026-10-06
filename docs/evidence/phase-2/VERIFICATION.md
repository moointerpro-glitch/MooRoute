# Phase 2 verification — 2026-10-06

## Implemented and verified

Two forward MySQL migrations implement identity/scope, master data, versioned route/template/plan/trip data, stop categories, reservations, consignments/items/packages, assignments/snapshots, append-only events/receipts, labels/prints, private attachment metadata, import staging and audit/idempotency. All use InnoDB/utf8mb4, explicit FK/unique/index/CHECK constraints, UTC DATETIME(3), DATE service/effective days and DECIMAL(14,3) with units. See [field dictionary](../../FIELD_DICTIONARY.md), [ER diagram](../../ER_DIAGRAM.md) and [design review](../../PHASE2_DESIGN.md).

Server domain services perform real authorization lookups, coverage validation, optimistic writes, serialization, idempotent replay, atomic publication/reservation replacement and partial receipt accounting. There are no public mutation endpoints. Existing Thai shell and disabled later-phase controls remain accurate.

## Exact commands and outcomes

| Command | Result |
| --- | --- |
| `node --version`; `npm --version` | Node v24.14.0; npm 11.9.0 |
| `npx prisma migrate diff --help` | Verified installed Prisma 7 CLI flags |
| `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` | Initial SQL generated before application; reviewed checks/triggers added |
| `npm run db:generate`; `npm run db:validate` | Passed with Prisma 7.10.0 |
| `npm run db:migrate:local` | Both forward migrations applied to retained moointer_dev using scoped operator account; no seed/reset |
| `npm run db:migrate:test` | Both migrations applied to disposable moointer_test |
| `npm run db:seed` (twice) | Passed twice; deterministic synthetic plan; rerun preserves rows and history |
| `npm run test:integration` | Final run: 13/13 passed against newly created `moointer_test_run_34e10676cba94368`; 2.18 seconds test duration; fresh migration deployment passed |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test` | 7/7 passed |
| `npm run build` | Passed; generated client, Next production compilation/types/static output |
| `npm run db:check` | Real Oracle MySQL 8.4.11, InnoDB, utf8mb4, utf8mb4_0900_ai_ci |
| `npm run test:db` | Passed Thai/emoji/Decimal/DATE persistence probe in disposable database |
| `npm run test:e2e` | 5/5 passed on fresh production build; Thai shell, tabs/navigation, 1440/768/390 px, safe liveness and Thai 404 |
| `git check-ignore .env .local/mysql/root-client.ini src/generated/prisma/client.ts` | All ignored |
| Value-based scan of Git-visible source/config/document files | 68 files inspected; no current generated credential values found; values were never printed |
| `git diff --cached --check`; `git diff --check` | Passed |
| `npm start`; GET `http://127.0.0.1:3010/api/health/live` | New production preview ready; returned status ok |

Git commit `7cd31ae` records schema, both migrations, reviewed schema documents and placeholder-only .env.example. Other implementation and pre-existing files remain available as uncommitted work; no unrelated files were added to that commit.

Existing dependency pins are unchanged. Full dependency audit was not rerun in Phase 2; the Phase 1 lint-chain advisory remains recorded in its evidence. No claim of new release/load/backup validation.

## Acceptance trace

- T01: 3 eligible branches x 6 cells = 18; seed publishes and reserves three vehicles; rerun adds no trips/revisions/reservations/audit rows.
- T02: omitted chicken at branch C/round 3 returns precisely that missing cell; failed publication leaves no pointer or reservations.
- T03: expired inactive branch is excluded; cancelled/inbound trips cannot supply coverage. Eligibility changes affecting a published date are rejected under the shared guard.
- T04 subset: branch/category must share a stop; persisted query reads exact service date and published pointer. Alias ambiguity and full search remain later-phase work.
- T06: loading is distinct from null departure; null departure blocks publish; Bangkok local midnight converts to prior UTC day; Thai/emoji and DECIMAL/DATE round trips succeed. Full search time-filter behavior is not implemented yet.
- T07: concurrent publications on separate dates with overlapping occupancy cannot both commit; two clients, actual MySQL transactions; no active reservation self-join collision. Half-open boundary succeeds; one-minute buffer conflict rolls back and preserves previous publication/reservations.
- T08 subset: replacement with an assigned consignment fails atomically, retaining pointer, assignment, snapshot, label and print history. Cancel/merge/reassignment workflows are **not implemented or claimed** in Phase 2.
- T09: simultaneous receipts from distinct clients cannot exceed sent quantities; stale version fails; retry at current version still rejects excess; exact decimals and separate 30-piece/3-package balances; partial remains open until complete.
- T10: concurrent same-key/same-payload calls return one event/result; changed payload conflicts; failed calls leave no success record. A deliberately forced real InnoDB deadlock retries the entire transaction, producing each effect once.
- T11: duplicate branch/plate keys fail; referenced branch deletion fails; receipt updates/deletion, published trip edits and stop appends fail; composite FK rejects foreign receipt ownership; invalid reservation interval fails.
- T12: concurrent draft creation/stale edits and publication leave a valid single current revision; new template version leaves old version unchanged; historical template edit fails.
- Authorization subset: unprivileged user and wrong branch scope cannot mutate/read core services. Login/session and the complete T13 endpoint matrix await Phase 3 and later feature endpoints.

## Failures found and corrected

1. First clean migration attempt failed with MySQL 1419 because binary logging requires appropriate trigger-creation policy. The isolated native lab now explicitly enables `log_bin_trust_function_creators` through its local operator; migration users do not receive global SUPER. The failed disposable schema was retained, not reset; subsequent fresh migrations passed.
2. Prisma optional composite published-pointer relation suppressed default generation of DailyPlan.id on create. The domain creates an explicit random UUID; clean seed and all tests passed afterwards.
3. History review added a separate forward migration for append-after-use protection, release-only reservation history, frozen sent item/package membership, stable trip identity and assignment/label/event ownership. Initial applied migration was retained unchanged.

## Not run / deferred / blockers

- No Phase 2 environment blocker remains in the documented native Windows/MySQL setup.
- No operational data imported, no destructive reset, no XAMPP MariaDB changes, no deployment.
- Full authenticated UI, master CRUD, planner UI/reassignment, full search, consignment lifecycle/corrections/returns, actual label printing/private upload handlers/import commits remain their requested later phases. Storage tables are not a claim that these workflows are implemented.
- Operational PDF remains absent; verified operational plates/contacts/times/buffers remain unresolved source data. Synthetic times and plates are explicitly labeled and confined to disposable data.
- Production load, restore, release and actual printer tests were not run.
