# Phase 4 verification — 2026-10-06

Implemented and verified locally. No deployment, database reset, operational import or Phase 5 implementation.

Schema, migration 004 and reviewed design committed as afd46b2 (Add Phase 4 planning schema and reviewed revision design), as required by DATA_MODEL. Remaining application/documentation changes are available in the working tree for review.

## Actual checks

Windows PowerShell; Node v24.14.0; npm 11.9.0; Git 2.53.0.windows.2; Oracle MySQL 8.4.11, InnoDB, utf8mb4_0900_ai_ci, loopback 3307. Dependency pins and lockfile unchanged. MariaDB 3306 and unrelated port 3000 untouched.

| Exact command | Outcome |
| --- | --- |
| node --version; npm --version; git --version | Versions above |
| npm run db:generate; npm run db:validate | Client generated; 52-model schema valid |
| npm run db:migrate:local | Additive migration 004 deployed to existing moointer_dev; no reset |
| npm run auth:setup:local | Separate dispatcher/supervisor local accounts and narrow grants installed; rerun preserved passwords/accounts |
| npm run db:check | Real MySQL/InnoDB/utf8mb4 passed |
| npm run lint; npm run typecheck | Passed, no warnings/errors |
| npm test | 8/8 passed |
| npm run build | Production build passed |
| npm run test:integration | 23/23 passed; final schema moointer_test_run_67c3f05285dc2582 |
| npm run test:planning:e2e | 2/2 passed; final schema moointer_test_run_fa03cd922d277983 |
| npm run test:auth:e2e | 4/4 passed; schema moointer_test_run_4f788fad0867a1b8 |
| npm run test:e2e | 5/5 passed |
| npm audit --omit=dev | Zero vulnerabilities |
| npm start | Latest local production-mode preview ready on 3010 |
| node .local/phase4-runtime-smoke.mjs | Both actual planning roles signed in, read empty planner using limited runtime DB account, rendered page, signed out, then received 401; no operational rows inserted |
| node .local/phase4-secret-scan.mjs | Source/docs scanned against current generated secrets; no matches or values printed |
| git diff --check | Passed; line-ending normalization notices only |
| git check-ignore .env .local/auth/admin-credentials.txt .local/auth/dispatcher-credentials.txt .local/auth/supervisor-credentials.txt | All ignored |

Native runners deploy all four migrations into fresh disposable MySQL databases. Schemas retained, never reset/dropped. Browser suites run sequentially on 3011. Smoke/secret utilities are ignored operator-only files; reproducible tests are tests/integration/phase4.test.ts and tests/e2e/planning.spec.ts.

## Acceptance evidence

- T01–T03: Three effective branches require 18 cells. Complete plans publish. One missing category, wrong same-stop category, inbound/cancelled coverage reject. Effective/inactive branch checks run on the server. Failed replacements preserve publication/reservations.
- T07: Independent clients race overlapping publications; one reservation set commits. Half-open boundaries/buffer behavior pass. All reservation writers use sorted vehicle locks plus current locking overlap reads. Drafts acquire no reservations.
- T08: Copy/merge/cancel and never-published draft removal preserve old revisions. Referenced/published omission rejects. Explicit destination-matching reassignment creates assignment, transport snapshot, ASSIGNED event and audit; preserves addresses/packages/old assignment; revokes labels. Missing mapping, wrong stop and in-motion records reject. Capacity failure after reassignment work proves labels/events/assignments/plan all roll back.
- T11: Master uniqueness, FK ownership/deletion, route deletion and immutable history remain valid. Duplicate dated trip code returns a safe conflict.
- T12: Concurrent route/daily editors return version conflicts. Template changes leave generated null departure/notes unchanged. Historical stop names remain frozen when master names change. Rejected replacement preserves prior publication.
- T21: Same-key replay is exact; different-key repeat adds zero trips; concurrent generation cannot duplicate template/day identity. Removed drafts are not silently regenerated. Unknown times remain null and visible.
- Authorization: Page/API/catalog/history require plan.read plus GLOBAL. Dispatcher writes but cannot publish; supervisor publishes but cannot write drafts. Branch-scoped/unauthenticated requests reject. Session/origin/idempotency checks remain enforced.
- Browser flow: Real ordered-route/effective-template creation, stop categories, repeated generation, copy/round/vehicle edit, merge/cancel/history, draft deletion, complete 18 cells, one-cell rejection, correction and supervisor publication pass. Audit shows actual actor/reason. No simulated successful writes.

## Visual evidence and boundaries

Synthetic data only. Page-overflow checks pass at 1440/768/390 px. Desktop/mobile inspected: Thai controls/cards and the labeled horizontally scrollable coverage table are usable. Existing design tokens reused; no claim of pixel matching a source planning mockup.

[Desktop](planner-1440.png), [tablet](planner-768.png), [mobile](planner-390.png), [rejected publication](rejected-coverage.png), [mobile audit](history-390.png).

Initial browser run moointer_test_run_c2d11e65214bb34c timed out on exact getByLabel for a nested select. The accessible combobox existed; test now uses role/exact accessible name. Subsequent full runs passed. Historical stop presentation was corrected to use persisted snapshots, with a regression test. Inherited development lint advisory remains documented in Phase 3; production audit clean.

Not run/out of scope: production IdP/TLS/proxy/load/restore/deployment, public search, full consignment/movement/receipt UI, print/file/QR/imports. Reassignment accepts only pre-loading ASSIGNED/WAREHOUSE_RECEIVED records; moving/completed records cannot silently move. No real plates, contacts, times or buffers invented. Missing PDF and operational confirmation remain data limitations, not blockers for the verified local flow.
