# AI session handoff

## Current state — 2026-10-06

Phase 7 (labels, manifests, controlled imports) was explicitly requested and is complete locally. Respond in Thai; technical docs and identifiers in English, UI and print content in Thai. No Phase 8 work or deployment is authorized. Phase 6 is committed as `16845c5`; Phase 7 changes are uncommitted for review.

Implemented: `domain/labels.ts`, `services/labels.ts` (issue, print/reprint, lookup, manifest), `correctAssignmentAddress` in `services/consignments.ts`, print pages under `/print`, QR landing `/l/[token]`, label page `/consignments/[id]/labels`, scan verification in the receipt panel; `domain/tabular.ts` (CSV + minimal XLSX), `domain/imports.ts`, `services/imports.ts`, `/admin/imports` pages and `/api/imports` routes. Master and route/template services now expose transaction-level functions used by imports. Design: [PHASE7_DESIGN](PHASE7_DESIGN.md); contracts: [API_CONTRACTS](API_CONTRACTS.md); decisions D209–D211.

Database: MySQL 8.4.11 on 127.0.0.1:3307, 53 models, six migrations, applied to moointer_dev after a backup in ignored `.local/backups/` (restore rehearsed). `auth:setup:local` re-run for new capabilities and grants. The dev database still has no warehouses, departments or published plans. Never print credentials.

Verified: lint, typecheck, build, prisma validate; 24 unit, 36 integration (real MySQL), 6 label/import, 5 consignment, 6 search, 2 planning, 4 auth and 5 shell browser tests; audit zero; secret scan zero hits. Evidence, print files and corrected failures: [evidence/phase-7](evidence/phase-7/VERIFICATION.md). Preview http://127.0.0.1:3010 runs the new build.

Known limitations: nothing was printed on a physical printer or scanned with a real device. XLSX reading is first-sheet text/numbers only. Imports cover branches, vehicles and schedule templates, 500 rows per file. Proposed operational values (D209–D211: visibility, cutoff lead, weight unit, label formats) await owner confirmation. mysqldump restores need the trigger normalization documented in SETUP (Phase 8).

## Next three actions

1. Review and commit the Phase 7 changes.
2. Print both label formats and the manifest on the real printer, scan the QR with the devices staff will use, and confirm D209–D211 with the operating owner.
3. On an explicit Phase 8 request, run the full T01–T24 matrix against a staging-like configuration, fix the backup-restore issue, load-test search and write OPERATIONS.md and RELEASE_CHECKLIST.md.
