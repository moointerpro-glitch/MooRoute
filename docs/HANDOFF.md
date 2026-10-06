# AI session handoff

## Current state — 2026-10-06

Phase 6 (consignments, tracking, branch receipts) was explicitly requested and is complete locally. Respond in Thai; technical docs and identifiers in English, UI in Thai. No Phase 7 work or deployment is authorized. Phase 5 is committed as `34bf57b`; Phase 6 changes are uncommitted for review.

Implemented: migration `202610060005_consignments` (request fields, resumeStatus, ReturnLine, REJECTED/ISSUE_RESOLVED events, request-freeze trigger, Warehouse/Department versions, MARKETING/DOCUMENT/EQUIPMENT categories). Code: `src/server/domain/consignment.ts` (transition matrix), `domain/files.ts`, `services/consignments.ts`, updated `services/receipts.ts` and `auth/resource-policy.ts` (shared consignmentScope; drafts private), `storage/attachments.ts`, APIs under `/api/consignments` and `/api/attachments/[id]`, pages `/consign`, `/consignments`, `/consignments/[id]`, components `consign-form.tsx` and `consignment-actions.tsx`, and warehouse/department masters. Contracts: [API_CONTRACTS](API_CONTRACTS.md); design/matrix: [PHASE6_DESIGN](PHASE6_DESIGN.md); decisions D209–D210.

Database: MySQL 8.4.11 on 127.0.0.1:3307, 53 models, five migrations, applied to moointer_dev after a backup in ignored `.local/backups/` (restore rehearsed into `moointer_test_run_restore104834`). `auth:setup:local` re-run: new master capabilities and INSERT/UPDATE grants; no DELETE on history. The dev DB still has no warehouses, departments or published plans: an administrator must add a คลังต้นทาง and แผนก, then the CLI can create REQUESTER/WAREHOUSE/BRANCH_RECEIVER/DRIVER accounts (see SETUP). Uploads go to `.local/uploads` (`UPLOAD_DIR`). Never print credentials.

Verified: lint, typecheck, build, prisma validate; 19 unit, 33 integration (real MySQL), 5 consignment, 6 search, 2 planning, 4 auth and 5 shell browser tests; audit zero; secret scan zero hits. Evidence and the ten corrected failures: [evidence/phase-6](evidence/phase-6/VERIFICATION.md). Preview http://127.0.0.1:3010 runs the new build.

Known limitations: cutoff lead (default 0 minutes) and KG-only package weights are proposed values. A mysqldump of the history triggers needs the documented normalization to restore (Phase 8). There is no malware scanning or retention policy for uploads. Label issue/print/QR/manifests are Phase 7.

## Next three actions

1. Review and commit the Phase 6 changes.
2. Confirm D209/D210 with the operating owner: cutoff rule, weight/capacity units, department-wide visibility and contact display.
3. On an explicit Phase 7 request, implement label versions, A4 and 100×150 mm print layouts, QR lookup and manifests on the existing assignment snapshots and revocation.
