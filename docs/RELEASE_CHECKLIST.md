# Release checklist

Status on 2026-10-06. **No deployment has been made and none is authorized.** Each line states what was actually done. "Verified (local)" means it ran on the local lab recorded in [Phase 8 evidence](evidence/phase-8/VERIFICATION.md). "Open" items must be completed, and "Decision" items need the operating owner, before a production release.

## A. Build and automated checks

| Item | State | Evidence |
| --- | --- | --- |
| Reproducible install (`npm ci`), pinned dependencies and lockfile | Verified (local) | Phase 1 and package-lock.json |
| Lint, type check, production build without warnings | Verified (local) | Phase 8 |
| Unit tests | Verified (local) | Phase 8 |
| Integration tests on real MySQL (fresh migrated schema each run) | Verified (local) | Phase 8 |
| Browser tests for every implemented flow, three viewport widths, print/PDF checks | Verified (local) | Phase 8 |
| Staging rehearsal: all authenticated flows with the least-privilege database account | Verified (local) | `npm run test:staging` |
| Production dependency audit | Verified (local): 0 findings | `npm audit --omit=dev` |
| Development dependency audit | Open: upstream advisory in lint-only tooling remains | Phase 1 record |
| Secret scan of repository files and captured run logs | Verified (local): 0 hits | 11 current values, 275 files, 12 logs |
| Keyboard-only use of the search page | Verified (local) | An intermittent focus-loss defect was found and fixed in Phase 8; its regression check is timing-dependent |
| Screen-reader pass | Open | Not run |

## B. Data and database

| Item | State | Notes |
| --- | --- | --- |
| All eight migrations apply to an empty MySQL 8.4 database | Verified (local). Prerequisite for other servers documented (OPERATIONS §5, review R3) | Every test run |
| Migrations applied to the development database after a verified backup | Verified (local) | Phases 6–8 |
| Backup restores into a new schema with identical tables, triggers, constraints and row counts | Verified (local): contents, checksums, definer privileges and guarded writes | `npm run db:backup:verify`; review R2 fixed; procedure in OPERATIONS §6 |
| Runtime account limited to documented grants; no DELETE on history, no DDL | Verified (local) | `scripts/runtime-grants.ts`, `SHOW GRANTS` |
| Production database server, TLS (`?ssl=true`), accounts and sizing | Open | Not provisioned |
| Scheduled backups, off-machine copies, retention, timed restore drill | Open | Needed before accepting RPO/RTO |
| Retention/archive policy for audit, idempotency, events and import history | Decision | Tables grow without limit today |
| Real master data (branches, addresses, contacts, vehicles, drivers) verified and entered or imported | Open | Only synthetic data exists; no source data was imported |
| Real schedule transcribed and reviewed from the transport sheets | Open | Source PDF was never supplied; colours and handwriting need a review mapping |

## C. Security and access

| Item | State | Notes |
| --- | --- | --- |
| Authentication for a deployed environment (company IdP or approved account mode) | Decided (D227), **not verified on a host** | Owner chose the application's own password accounts; `APP_ENV=production` requires HTTPS on a real host name. No second factor or email recovery |
| HTTPS termination, HSTS, trusted proxy configuration | Open | Not verified |
| Session settings (8 h, HttpOnly, SameSite=Lax, Secure on HTTPS) | Verified (local) | — |
| Sign-in throttle per client | **Open — must fix before release** | Today the limit is 5 sign-ins per minute for all users combined, because no trusted proxy header identifies the client. At shift start this would lock staff out. Needs the proxy to set the peer header, or the identity provider to own throttling |
| Server-side authorization and row scope on every list, detail, export, file, print, QR and mutation path | Verified (local) | T13 |
| Security headers and production Content-Security-Policy | Verified (local) | Phase 8 |
| Private attachments: signature check, size/count limits (enforced while reading), scoped download | Verified (local) | Malware scanning: Open |
| Operational logging without secrets or personal data | Verified (local) | Checked against real lines emitted with the database unreachable. Log collection and alerting: Open |
| Secrets in a managed store; rotation procedure | Open | Local `.env` only |
| MFA, password recovery by email, account self-service | Not implemented | Depends on the identity decision |

## D. Operations

| Item | State | Notes |
| --- | --- | --- |
| Operator guide ([OPERATIONS.md](OPERATIONS.md)) followed on the local lab | Verified (local) | Migration, grants, readiness check, build, start, liveness, backup verify, account create/reset/disable, database-outage behaviour. Master data entry was exercised by the browser suites, not by hand |
| Monitoring, alerting, log retention | Open | Liveness endpoint and error log lines exist |
| Persistent private storage for `UPLOAD_DIR`, included in backups | Open | Local folder today |
| Load test on production-like hardware | Open | Local baseline only; see evidence |
| Availability 99.5%, RPO 24 h, RTO 4 h | Decision | Proposed targets; not measured, not accepted |
| Rollback rehearsal (application and database) | Open | Forward-only migrations; restore loses later changes |

## E. Business readiness

| Item | State | Notes |
| --- | --- | --- |
| Rule "every active branch gets pork and chicken in rounds 1–3" enforced at publication | Verified (local) | T01–T03 |
| Re-planning a published day that has a cancelled consignment | Verified (local) | Review R1 fixed; regression test in `tests/integration/phase6.test.ts` |
| Search scope and contact visibility (D209) | Decision | Department requesters see company-wide outbound trips |
| Consignment cutoff, weight/capacity units, turnaround buffers, round time windows (D210 and open values) | Decision | Defaults are placeholders |
| Label formats on the real printer; QR scanning with the real devices (D106, D211) | Open | Verified by measurement and software decode only |
| User acceptance by dispatchers, warehouse, drivers, branches | Open | Not started |
| Thai wording review by the business | Open | — |
| Approved brand assets (logo) | Open | Text wordmark is used |

## F. Release package

The reviewable package is this repository with the Phase 8 changes (uncommitted in the working tree until a commit is requested): source, eight migrations, tests, evidence under `docs/evidence/phase-1` to `phase-8`, [OPERATIONS.md](OPERATIONS.md), this checklist, [TEST_MATRIX.md](TEST_MATRIX.md) and [DECISIONS.md](DECISIONS.md). No artifact has been published and no environment has been changed outside the local lab.

## Sign-off

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Operating owner | | | |
| Technical reviewer | | | |
| Security reviewer | | | |
