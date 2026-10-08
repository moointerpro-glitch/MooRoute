# Per-request sender department (D233)

Verified locally on 2026-10-08. No hosted application or production database changes.

## Behavior and scope

- A person with consignment.create chooses any active sender department per request. New forms start blank; drafts retain the choice and permit changing it before submission.
- Missing, fabricated and inactive selections are rejected server-side. Department is included in the review and draft audit metadata.
- Account department membership is optional and remains an administrator-controlled read scope. Selecting a sender department does not create membership or expose another person's records or attachments. Existing authorized department readers can see submitted requests assigned to that department.
- Own-draft restrictions, operational scopes, self-review denial, transaction versions and idempotency remain enforced. No schema migration or existing membership changes.

Affected implementation: src/server/services/{consignments,users,account}.ts, src/app/consign/page.tsx, src/components/{consign-form,user-admin}.tsx, src/lib/account-display.ts and src/app/guide/page.tsx. Test changes: scripts/prepare-search-e2e.ts, tests/integration/{access,users}.test.ts and tests/e2e/{consignment,users}.spec.ts. Contract, permission, UI, context and decision documents updated; earlier navigation work preserved.

## Executed checks

| Command | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS 43/43 |
| npm run test:access:integration | PASS 18/18; disposable MySQL moointer_test_run_f4dc72cecbe61ded |
| npm run test:integration | PASS 41/41; disposable MySQL moointer_test_run_066a6f452b0cf3df |
| npm run build | PASS; final UI changes included |
| npm run test:consignment:e2e -- --scoped-runtime | PASS 7/7; disposable MySQL moointer_test_run_d6fb2186ed53a41d |
| npm run test:users:e2e -- --scoped-runtime | PASS 2/2; disposable MySQL moointer_test_run_e34aefc6722b1a16 |
| npm run deploy:package -- --skip-build | PASS |

The first consignment browser run failed in moointer_test_run_6b19a70ce5ce8fb3: an exact-text assertion targeted a department embedded in a longer paragraph, and the newly added reload allowed upload interaction before client hydration. Corrected the locator and awaited page readiness; subsequent failures were cascading shared-flow/sign-in-throttle effects. The fresh full rerun passed. Tests use disposable local MySQL and least-privilege web credentials; this change was not rehearsed on MariaDB or the actual host.

Evidence in this directory includes the full consignment lifecycle and responsive 1440/768/390 captures, plus optional account-department captures under users/. Visually reviewed form-390.png and users/new-1440.png. Prior evidence restored byte-for-byte from the pre-change backup; no temporary passwords captured.

## Upload package

`.local/deploy/moointer-transport-app.zip`: 9,860,058 bytes, 1,161 entries. SHA-256: `5de93bb00489706ee8223a69dc2297386e984a4135e263bb35a75f40f9f76734`.

Verified archive BUILD_ID matches the final local build, server.cjs exists, and the only environment file is .env.example. No SQL, node_modules, private uploads or .local data included. Staging directory was resolved inside this workspace and checked as a normal directory before replacement. No SQL re-import is needed. Package prepared only; not uploaded or restarted on the host.

Next actions: owner review on the local app; update the host only when requested while preserving environment and data; hosted smoke test with an account having no department membership, selecting an active sender department and submitting a synthetic request.
