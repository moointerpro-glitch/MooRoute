# Back navigation simplification — D232

2026-10-08, owner requested removing newly added duplicate Undo/back controls and clarifying the existing ones while preserving their placement and page structure.

Source audit: master editors, new-account form and import upload had a new top return plus a footer return. Lists had an added back-office return beside the existing shared back-office link. Planning editors had both a new top return and the original footer cancel. User detail already had a top return before D231 and also a form footer return. There is no general edit-history Undo control; the Undo2 icon on a cancelled trip means restore that trip and remains unchanged.

Removed newly added redundant top returns from master/new-account/import-upload and list pages. Kept the original footer return for long forms, with a visible ArrowLeft, neutral outlined style, keyboard focus outline and an explicit Thai destination. User detail keeps its original top return and omits the duplicate footer. Planning keeps footer navigation labelled by destination; a standalone top return remains only during loading/failure when no editor footer exists. Filters, selected service date/revision, dirty guards and server behavior remain unchanged. No schema, dependency, operational-data or host changes.

Checks executed on 2026-10-08:
- npm run lint: PASS.
- npm run typecheck: PASS.
- npm run build: PASS (final CSS included).
- npm run test:auth:e2e -- --scoped-runtime: PASS 4/4, disposable MySQL moointer_test_run_d541aaa48fff2978. Includes filtered return, failed-write retention, browser Back and discard/cancel.
- npm run test:users:e2e -- --scoped-runtime: PASS 2/2, disposable MySQL moointer_test_run_bc83f18bd2c5a844. Includes new-account guard, full account lifecycle and authorization.
- npm run test:planning:e2e -- --scoped-runtime: PASS 2/2, disposable MySQL moointer_test_run_c9f3919182d5f59d. Includes template/footer return, date/revision return, browser Back, discard and save flows.
- npm run deploy:package -- --skip-build: PASS. Target .local/deploy/app verified inside workspace and not a link before replacement.
- git diff --check: PASS.

Inspected mobile vehicle and new-account captures. New evidence is retained here; previous evidence was restored byte-for-byte. Browser suites capture desktop/mobile forms and verify no page overflow. Import navigation received source/build checks only this turn; no import browser rerun. Unit suite not rerun for this presentation-only change. No test failures this turn. One documentation lookup used .mdx instead of .md; resolved through rg and read the installed Link guide before editing.

ZIP: .local/deploy/moointer-transport-app.zip, 9824687 bytes, SHA-256 7b078700a005b460472045ae60a08db3468aab29251378f20c7c674feda88d45. Local artifact only, not uploaded.

Next three actions: review the existing-position return controls locally; collect any specific screen needing further refinement; when authorized, update host and smoke-test navigation. No claimed physical-device or hosted verification.
