# Decisions and unresolved settings

## Confirmed by the user

- D001: MySQL is the required database. Earlier PostgreSQL recommendations no longer control this pack.
- D002: All application and printed user-facing content is Thai. AI prompts are English.
- D003: Every active branch receives both pork and chicken in each of three rounds every day.
- D004: Preserve the supplied mockup's search UI style, add complete backend administration, vehicle master data, branch master data, product categories, consignments and history.
- D005: Deliver phase prompts and Markdown rules with a Word edition for review.

## Proposed implementation defaults

These defaults are design choices for initial development, not confirmed operational facts. Codex may implement them when they do not conflict with the existing repository; record changes with reasons.

- D101: Modular monolith with Next.js, TypeScript, Tailwind CSS, Prisma and MySQL/InnoDB/utf8mb4. Verify exact versions during setup.
- D102: Internal authenticated application with explicit role and branch/department/warehouse scope. Identity provider remains to be selected.
- D103: Asia/Bangkok display and input, Gregorian DATE internally, UTC event timestamps, consistent Thai Buddhist-era display.
- D104: One destination branch per consignment; package-based receipt by default; optional detailed item receipt frozen before submission.
- D105: Source warehouse to branch transport in v1; no arbitrary external recipient destination flow.
- D106: A4 four-label sheets and 100 x 150 mm label printing. Hardware margins and QR size must be tested with the actual printer before production use.
- D107: JPG/PNG/PDF attachments, 10 MB each and five files per request, configurable.
- D108: Search p95 <= 2 seconds for 100,000 trips and 50 concurrent users is a proposed benchmark. Availability/RPO/RTO targets require operating-owner acceptance.

## Operational values still to confirm

- Exact time windows for rounds 1/2/3 by branch/route; do not guess them from the requirement for three rounds.
- Actual departure and occupancy end times; loading sheets alone do not establish them.
- Consignment cutoff rules, turnaround buffers, capacity units and handling constraints.
- Verified branch aliases, printable addresses, contacts, driver assignments and vehicle details.
- Meaning of source colors/handwriting and ambiguous DC times.
- Authentication provider, deployment host, backup retention, upload retention and authorized contact visibility.

Use clearly labeled synthetic defaults in development and keep unverified operational values out of production seeds. These questions do not prevent building configuration screens or core workflows. Do not weaken the confirmed daily coverage rule while waiting for operational data.

## D201 Source edition differences observed during study

- Date: 2026-10-06.
- Status: Proposed (implementation precedence based on README.md; no new user-confirmed business rule).
- Question: How should differences between the Markdown development pack v2.0 and Moointer_Webapp_Requirements_v1.0.docx be handled?
- Observation: The DOCX is a Thai requirements document with 20 numbered sections, U01–U24 acceptance cases and eight embedded UI images. It is not an identical Word reproduction of the English prompts/rules as README.md describes.
- Conflicts: DOCX section 6 defaults time search to loading start, while PROJECT_CONTEXT.md defaults to departure. DOCX allows a next-day selection for a reversed time range, while Markdown rejects a reversed range in this release. DOCX permits Gregorian display or explicitly labeled Buddhist-era display, while UI_SPEC.md specifies consistent Buddhist-era display. DOCX tests 360/768/1440 px and uses primary #E50922; Markdown specifies 390/768/1440 px and proposes #E60023.
- Additional details needing phase-specific reconciliation: DOCX describes in-app notifications, optional category-specific branch rules, package/item allocation, actual food-delivery results and a proposed 24-month history retention. These are reference requirements to trace against the requested phase, not automatically implemented scope. DOCX also requires an eligible selected trip before submission, whereas Markdown permits dispatcher assignment during review; the submission/assignment contract must be made explicit before Phase 6.
- Choice: Use Markdown as the editable implementation source, as README.md directs, and retain the DOCX as business/visual reference. Follow current explicit user instructions first. Preserve these differences for review before the relevant phase; do not silently merge incompatible defaults, create coverage exemptions, or treat proposed retention/operational values as confirmed.
- Reason: Avoid contradictory search and workflow behavior while retaining source evidence. This session authorizes study only.
- Source/owner: README.md, PROMPTS.md, docs/PROJECT_CONTEXT.md, docs/UI_SPEC.md and the supplied DOCX; operational owner confirmation remains pending where materially required.
- Affected files: docs/DECISIONS.md, docs/PROGRESS.md, docs/HANDOFF.md. No application requirements or original references were rewritten.
- Migration impact: None; no schema or application implementation exists in this workspace.

## D202 Phase 1 authorization and reference availability

- Date: 2026-10-06. Status: Confirmed.
- Question/choice: The user selected Phase 1 explicitly in the follow-up and supplied the Phase 1 prompt. Implement foundation only; the earlier study-only scope is superseded for this work session.
- Reason/source: Current user instructions and PROMPTS.md Phase 1. JPG/PNG originals are now present in the workspace root; identical ignored copies are retained in references/. The operational PDF is still absent.
- Affected files: Phase 1 source, tests, configuration, references/README.md and handoff documents.
- Migration impact: No operational models, migrations or seeds. No existing database migration was performed.

## D203 Foundation technology and isolated native MySQL

- Date: 2026-10-06. Status: Proposed (implemented engineering choice under the user's routine-decision authority).
- Question/choice: Pin Node 24.14.0, Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Tailwind 4.3.3 and Prisma 7.10.0. Use Oracle MySQL 8.4.11 with InnoDB/utf8mb4/utf8mb4_0900_ai_ci in a project-local Windows process on loopback 3307. Use web port 3010 and browser-test port 3011.
- Reason: Installed Node satisfies the verified framework/Prisma requirements. Prisma 8 was still an npm release candidate. XAMPP supplies MariaDB 10.4.32, not the requested MySQL; port 3000 already belongs to another application. An independent MySQL data directory avoids touching that service and its data. Prisma's adapter-mariadb is the documented connector to the actual Oracle MySQL server.
- Security/maintenance: Random local credentials, separate development/test accounts, no root web connection, verified TLS for remote databases, loopback-only local public-key retrieval. Pin compatible ESLint 10 plugins directly. Scope audited transitive overrides as described in ARCHITECTURE.md; the remaining braces advisory is confined to trusted lint patterns and requires upstream follow-up.
- Source/owner: Repository inspection, npm metadata, official framework/Prisma/MySQL documentation linked in ARCHITECTURE.md; engineering default, not an operational business rule.
- Affected files: package files, Prisma configuration, scripts/mysql-local.ps1, src/server, .env.example, .gitignore, .htaccess and setup/architecture documents.
- Migration impact: Creates only new isolated development/test databases and accounts; no operational tables or existing-data migration.

## D204 Foundation UI and access boundary

- Date: 2026-10-06. Status: Proposed (implemented Phase 1 scope).
- Question/choice: Build a Thai responsive shell and guide with working navigation and three keyboard-operable tabs. Disable unavailable operational actions with Thai explanations. Use a development text wordmark, local licensed Thai font, Markdown visual tokens and departure as the initial time basis.
- Reason: Phase 1 cannot truthfully expose live route search, publish plans or accept consignments before their data/authentication phases. No illustrative counts, plates, phone numbers or source rows become operational data. The three-round card describes policy, not completed coverage.
- Access boundary: Public shell and minimal liveness only; database readiness is an operator-only server CLI. No private data, operational mutation route, backend button or authentication bypass exists. .htaccess prevents Apache from serving repository files through XAMPP.
- Source/owner: Current phase prompt, UI_SPEC.md, PROJECT_CONTEXT.md, supplied mockup and D201 precedence. Full authorization remains Phase 3.
- Affected files: src/app, src/components, src/server/domain/transport-policy.ts, docs/API_CONTRACTS.md and visual evidence.
- Migration impact: None.

## Decision record format

## D207 Phase 3 authentication and master administration

- Date: 2026-10-06. Status: Proposed, implemented under the explicit Phase 3 request and routine engineering authority.
- Choice: Better Auth 1.7.7, Prisma/MySQL adapter, database sessions and password authentication for a documented local-account development path. No company IdP configuration was found; an optional IdP question was sent and no answer was available during implementation. Public signup and unsupported auth endpoints are closed. The local account configuration accepts only APP_ENV=local and an exact loopback origin; deployed production configuration must be implemented explicitly, without any login bypass.
- Reason: Reuse maintained authentication with the existing Node/Prisma architecture while making the fallback usable and testable. The initial administrator has explicit master capabilities but no operational privileges. Persisted scopes include driver identity. One local rate-limit bucket avoids trusting forwarded IPs; distributed production throttling is not claimed.
- Master policy: versioned/audited server mutations, shared eligibility guard and vehicle locks, dependency-aware archive fallback, protected PORK/CHICKEN codes, active lookup enforcement, private/no-store APIs, scoped export. Alias updates belong to the branch aggregate. Existing historical snapshots are never rewritten. Changes to eligibility of any published date fail closed until a coordinated plan revision exists.
- UI choice: Thai labels/errors, Buddhist-era DD/MM/YYYY input translated to Gregorian API DATE, Bangkok local time input translated to UTC; shared responsive tokens. No national identity data collected.
- Source/owner: Current user Phase 3 instructions, PROJECT_CONTEXT.md/UI_SPEC.md, maintained Better Auth documentation linked in Phase 3 verification; engineering default, not a confirmed production identity provider choice.
- Affected paths: authentication/session/policy modules, master definitions/services, Thai admin/login pages and API routes, local operator scripts, permission matrix, tests/evidence and updated setup/contracts.
- Migration impact: Additive migration 003 (four auth tables, user email metadata, DRIVER scope/FK, per-vehicle wheels, master active/version/timestamps); no applied migration rewrite, no reset, no source data import. Narrow runtime grants only for implemented auth/master writes; local credentials remain ignored.

## D205 Phase 2 revision identity, transaction guards and fail-closed scope

- Date: 2026-10-06. Status: Proposed (implemented engineering choice under the user's Phase 2 authorization).
- Choice: Stable Trip identities belong to a service date; immutable TripRevision/TripStop rows belong to numbered PlanRevision records. DailyPlan points to the current published revision. Publish under eligibility/day/sorted vehicle locks, with six-cell validation and half-open occupancy including explicit trailing buffer. Receipts lock a consignment and append immutable event/line records; detailed completion requires items and packages. Persist idempotency results and retry bounded deadlocks.
- Reason: Preserve operational identities, prevent reservation/receipt races and retain historical labels/snapshots. Unknown departure/occupancy blocks publication. No operational buffer/time values are invented; synthetic examples use zero buffer and fixed explicit times.
- Scope: Internal services resolve stored permissions/scopes; no public mutation endpoint or production auth bypass. Existing assignments block replacement until an audited reassignment workflow is implemented in its later phase. Global eligibility serialization is a deliberate correctness-first default, not a performance claim.
- Source/owner: Current Phase 2 request, DATA_MODEL.md and PROJECT_CONTEXT.md; engineering review documented in PHASE2_DESIGN.md.
- Affected paths: prisma/schema.prisma, two migrations, src/server/domain, src/server/services, tests/fixtures, tests/integration and schema/API/architecture docs.
- Migration impact: New relational schema in previously empty local development/test databases; no reset or source-data migration. CHECK constraints and triggers preserve immutable history and ownership.

## D206 Scoped local migration and disposable-test lifecycle

- Date: 2026-10-06. Status: Proposed (implemented local development choice).
- Choice: Dedicated development migration user, SELECT-only web user until authenticated mutation routes exist, disposable test user scoped per generated test schema. Operator CLI secrets remain only in ignored local configuration. Fresh integration schemas are created and retained; never reset existing schemas.
- Reason: Real MySQL trigger migrations require explicit operator policy. The project-owned loopback lab enables log_bin_trust_function_creators for these migrations without granting global SUPER to migration users. External environments must follow their administrator's migration policy.
- Seed: Deterministic synthetic namespace/date and manifest; three active branches, one separate expired fixture branch, pork/chicken in three rounds, three synthetic vehicles; reruns preserve published history. No production seed or unverified plates/contacts.
- Source/owner: Phase 2 acceptance and observed MySQL 1419 during clean migration; local engineering default.
- Affected paths: scripts/migrate-local.ts, migrate-test.ts, run-integration.ts, seed.ts, environment validation, .env.example, setup/evidence docs.
- Migration impact: Both migrations applied forward to local development and disposable test databases; failed disposable attempts retained for inspection.

For each new decision record: ID, date, status (Confirmed, Proposed or Superseded), question, choice, reason, source/owner, affected files and migration impact. Explicit user changes supersede older decisions; retain the old entry with its replacement reference.

## D208 — Phase 4 planning and atomic reassignment (2026-10-06)

Phase 4 explicitly authorized. Preserve stack, dependency pins, MySQL and applied migrations. Add migration 004 for VAN_SALES, nullable trip notes/load/unit and template vehicle/driver/occupancy/offset/buffer metadata. See [reviewed fields and ER](PHASE4_DESIGN.md).

Route/template edits append immutable revisions; highest numbered effective revision wins generation. Deterministic template identity + service-date trip IDs prevent semantic duplicates. Generated trips retain source revisions. Daily edits append complete candidates with optimistic DailyPlan.version; never-published/unassigned draft removal preserves historical rows. Published/linked trips must be cancelled instead of omitted. No history DELETE granted.

Supersede D205's temporary blanket reassignment block with explicit pre-loading reassignment inside publication. Require every linked consignment's expected version and destination-matching outbound target. Only ASSIGNED/WAREHOUSE_RECEIVED without loaded/departed/receipt evidence or vehicle/branch custody may move. New assignment/event/transport snapshot, label revocation, audit, reservations and publication commit together. Moving/completed records still block pending a later operational workflow. No invented mapping between consignment categories and product-coverage categories.

Planning/catalog reads require plan.read + GLOBAL; dispatcher gets route/template/plan writes, supervisor publication including atomic reassignment approval. Administrator retains master/identity duties. Local setup creates separate secure planning accounts; reruns preserve passwords. Preview is advisory; publish rechecks under eligibility -> plan -> sorted vehicles -> sorted consignments. Known load/capacity units must match. Existing cancelled trips may retain archived references. Unknown facts stay null; no deployment or Phase 5 work.

## D209 — Phase 5 search scope, time semantics and consignment hand-off (2026-10-06)

Status: Proposed (implemented under the explicit Phase 5 request; operational owner confirmation pending where noted).

- Row scope for published trip search/detail: GLOBAL sees all; BRANCH sees trips with a stop at that branch; DRIVER sees own trips; DEPARTMENT/WAREHOUSE `trip.read` holders (requesters choosing a vehicle) see company-wide published BRANCH_DELIVERY trips only. Requesting another kind is 403; out-of-scope detail is 404. Reason: requesters must find a trip to any destination, while inbound DC/Van Sales stay restricted. Confirm with the operating owner.
- Contacts: branch contact name/phone only with `master.branches.read` plus GLOBAL or that BRANCH scope; driver name/phone only with `master.drivers.read` plus GLOBAL or own DRIVER scope. Printable business addresses are shown to trip readers.
- Time matching uses minute offsets from 00:00 Asia/Bangkok of the selected service date. Exact chips may lie on the neighbouring local day and are labelled วันก่อนหน้า/วันถัดไป; ranges stay within 00:00–23:59 of the date, include the whole end minute and reject reversed or partial ranges (D201 Markdown precedence). NULL never matches.
- Branch text resolves by code, official name or active alias (case-insensitive collation, literal wildcards). One exact match, or exactly one partial match, resolves; otherwise the UI lists candidates instead of choosing.
- The eligible-trip action is a pre-check (permission, published, not cancelled, outbound, visits branch, departure known and in the future). `/consign` only shows the checked trip/branch with a Thai “not yet open” notice. No cutoff rule is invented; Phase 6 must re-validate on submission.
- No schema change, new dependency or runtime grant. Affected: src/server/domain/search.ts, src/server/services/trip-search.ts, search/branch APIs, search/detail/directory/consign pages, header/login redirect, tests, docs.

## D210 — Phase 6 consignment lifecycle (2026-10-06)

Status: Proposed (implemented under the explicit Phase 6 request; operational owner confirmation pending where noted).

- Submission/assignment contract (resolves the D201 difference): the requester may pick a preferred eligible trip at submission (validated then), but the dispatcher assigns during review (Markdown precedence). Assignment always re-checks eligibility.
- Cutoff: loading start, or departure when loading is unknown, minus `CONSIGNMENT_CUTOFF_LEAD_MINUTES` (default 0). This is a placeholder until the operating owner supplies real cutoff rules.
- Package handover at warehouse and loading must confirm every stable package ID; partial handover is recorded as an issue, not a partial status. Departure is recorded per trip by the trip's driver or the source warehouse.
- Returns are only for undelivered packages/quantities and use a separate ReturnLine ledger. RETURNED is terminal when every package is returned. CLOSED requires every package received or returned and no open issue.
- Drafts are private to their requester; department/branch/warehouse/driver scopes see only submitted records.
- Consignment codes are `FS-<พ.ศ. YYYYMMDD>-<6 random characters>` to keep visible identifiers consistent with Buddhist-era display.
- Warehouse and department become versioned master screens. They were needed to enter source warehouses and requester departments; the generic masters service and audit are reused.
- Backup finding: dumps of the existing history triggers need the documented normalization on restore. A permanent fix (migration or restore tooling) belongs to Phase 8 release work.
- Migration impact: additive migration 005 applied to moointer_dev after a verified backup (restore rehearsed into a disposable schema); runtime grants extended with INSERT on ledgers and UPDATE only on Consignment/ConsignmentPackage; no DELETE on history.

## D211 — Phase 7 labels, QR, manifests and imports (2026-10-06)

Status: Proposed (implemented under the explicit Phase 7 request).

- One current label version per consignment, numbered across its assignments. Issue is blocked while the branch master differs from the frozen snapshot; the dispatcher's address correction re-freezes the snapshot and revokes earlier versions.
- QR content is only the lookup URL with a random opaque token and the package sequence. Lookup needs a session and the consignment row policy.
- Reprints require a reason. Revoked versions cannot be rendered or printed.
- Label formats: A4 with four 105 × 148.5 mm labels, and 100 × 150 mm. Addresses above 300 characters block a production label instead of shrinking text. Printer margins and QR size still need a test on the real printer (D106).
- Dependencies: qrcode-generator 2.0.4 (runtime) and jsqr 1.4.0 (tests). XLSX is read by a small in-repo reader instead of the npm xlsx package, whose registry version is outdated.
- Imports: approved fields only, 500 rows per file, staged then committed in one transaction, same file + edition = same batch. Contact name and phone are required for imported branches, matching the branch master form.
- Schedule import creates recurring templates (not dated trips); repeated category pages merge into one template per code; unknown times and vehicles stay null.
- Affected: migration 006, role capabilities, grants (INSERT on label tables, INSERT/UPDATE on import tables), print CSS, docs.

## D212 — Phase 8 release verification choices (2026-10-06)

Status: Proposed (implemented under the explicit Phase 8 request). No deployment was made.

- Migration 007 recreates the 42 single-statement history triggers with compound bodies so that mysqldump output restores unmodified. Rules are unchanged. It supersedes the restore normalization noted in D210.
- Migration 008 adds `AuditLog(entityId, createdAt)` for the planning history read, which filters by entity ID only.
- Unexpected API failures, sign-in backend failures and page session-check failures are logged as one JSON line with error class, safe code and source location only (`api.unexpected_error`, `auth.unavailable`, `page.session_unavailable`). Messages, SQL and parameters are never logged. A 5xx from the authentication library is reported to the user as "service unavailable", never as wrong credentials.
- Production builds send a Content-Security-Policy limited to same-origin sources. Inline scripts and styles stay allowed because Next.js hydration and the per-page print rule need them; a nonce-based policy is a later hardening option. HSTS is left to the TLS proxy.
- `DATABASE_POOL_SIZE` (1–50, default 5) makes the connection pool configurable; the default is unchanged.
- The staging rehearsal is a freshly migrated schema, the production build and the least-privilege runtime account on loopback. HTTPS, a reverse proxy and a company identity provider are not available locally and remain open.
- A deployed authentication mode is not implemented. It depends on the owner's identity decision (D102, D207) and blocks a production release.
- Load results are a single-machine baseline. No performance, availability, RPO or RTO target is claimed or accepted.

## D213 — Phase 8 review fixes (2026-10-06)

Status: Implemented under the explicit fix request; values marked proposed still await the owner.

- Re-planning a published day requires an explicit move only for consignments that may still travel. CANCELLED and REJECTED consignments keep their assignment as history and are not moved. Loaded, in-transit and completed consignments still block re-planning until the owner decides how an operational change should work.
- Branch postal codes follow the label rule everywhere: five digits, not starting with 0 (proposed; matches Thai postal codes).
- Request bodies are read with a hard byte limit while streaming (attachments 10 MB + 64 KB, imports 2 MB + 64 KB, JSON mutations three bytes per allowed character, sign-in 12 KB). Content-Length is no longer trusted alone.
- A backup restore is accepted only when the copy is usable: trigger definer accounts exist with TRIGGER and SELECT, and guarded writes behave as on the source. Accounts and grants are part of what a complete backup must cover.
- Trigger creation on a binary-logging server needs `log_bin_trust_function_creators=ON` in the server configuration (or SUPER). The lab tools still set it at run time (D206) and now say so; the backup tool no longer touches it.

## D214 — MOOROUTE brand assets and local mock-up data (2026-10-06)

Status: Implemented on the owner's request. Brand placement follows the designer's usage sheet in `img/`; deviations are listed.

- Source logos are the owner's files in `img1/` (PNG and the Illustrator source). They are not modified or served directly. Cropped copies live in `src/assets/brand/` (wordmark, stacked logo, company banner), `src/app/` (`favicon.ico` 16/32/48 px, `icon.png`, `apple-icon.png`) and `public/brand/` (192/512 px install icons), generated reproducibly from the originals.
- Placement: wordmark in the site header (designer: side menu); stacked logo on the sign-in page; pin as browser and home-screen icon (designer: favicon); company + product banner in the footer and on the printed trip manifest. The designer suggested the stacked logo for the mobile header; at 34 px its text would be unreadable, so the wordmark is used at every width.
- Labels keep the text brand line: they are printed on monochrome label printers and their layout was verified at actual size in Phase 7.
- The supplied PNGs are low resolution (wordmark 97 px tall). Displayed sizes stay at or below the source pixels; an SVG or 2× export from the Illustrator file would sharpen high-density screens and print.
- `npm run db:seed:mockup` adds clearly fictitious master data (labelled ทดสอบ) and one account per role to `moointer_dev` through the audited master service. It creates no route, template, plan, trip, reservation or consignment. Passwords are written only to ignored `.local/auth/mockup-logins.txt`; a mock account without a recorded password is reset and audited. Seed manifest key `mockup-dev-v1`.

## D215 — Administrator can do and see everything (owner decision, 2026-10-06)

Status: Accepted by the owner ("แอดมินควรทำได้ทุกอย่างและเห็นทุกอย่างในระบบ"). Supersedes the earlier rule that the administrator has no operational capabilities (Phase 3 PERMISSIONS.md, OPERATIONS §4).

- `rolePermissions.ADMINISTRATOR` is derived as the union of every other role's capabilities plus full master maintenance (`master.*.write/delete`), `identity.manage` and the new `consignment.read.drafts`. A capability added to any role reaches the administrator automatically; an integration test asserts the superset.
- With GLOBAL scope the administrator can plan and publish, assign, run warehouse, loading, departure and receipt steps, issue and print labels, read manifests, import every kind, and search with full contact visibility.
- `consignment.read.drafts` lets the administrator read other users' consignment drafts (detail, list, export, files, labels page). Drafts stay invisible to every other role. Editing, submitting or cancelling a request remains reserved to its own requester.
- Conflict recorded: one administrator account can now prepare and publish its own daily plan, so separation of duties no longer covers that account. Every action still records the actor in the audit log and events. Recommendation: give the administrator role to as few people as possible and review its use.
- Tests that asserted administrator denials were changed to assert the new access; their denial checks moved to roles that genuinely lack the capability (warehouse for search, another branch's receiver for QR lookup, supervisor for schedule import, branch receiver for import templates).

## D216 — Shared published reads and own consignments (2026-10-06)

Status: Implemented on the owner's request to apply the discussed permission/menu model. Supersedes D209 and historical Phase 3–6 descriptions where they limit common published reads or own creation to selected roles. D215 administrator access remains in force with the new self-review exception.

- All seven predefined roles can read published trip kinds company-wide and general branch directory data. Contacts, unpublished plans, other people's consignments/files and operational manifests remain capability/row scoped. This is not universal access to every read-only endpoint.
- Every role can create/edit/submit/cancel its own draft/pending consignment after explicit active department membership. A sender department is not department-history permission; REQUESTER and ADMINISTRATOR hold the separate consignment.read.department capability. Scope is rechecked before retries.
- Dispatcher/admin cannot assign, reject or reassign their own request, including via replacement-plan publication. Another authorized reviewer is required; atomic failure retains the existing published revision. This narrows D215's all-operations request to preserve independent consignment review. Administrators retain daily-plan prepare/publish and read-only access to other users' drafts.
- Unpermitted menus/actions are hidden; permitted actions blocked by prerequisites are disabled with Thai reasons. Server policies are authoritative. The guide includes Thai end-to-end flows and all seven roles.
- No schema migration or operational-data reset. Audited additive role sync and explicit synthetic department memberships were applied only to known local development accounts; passwords preserved.

## D217 — Product names and workspace relocation (2026-10-06)

Status: Names implemented; folder relocation pending Windows handle release. Owner requested default browser/install short title MooRoute | หมูอินเตอร์, Thai product name ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์, and folder moointer-transport. The npm package/lockfile name is updated. Owner logo pixels remain unchanged.

Two safe same-volume rename attempts failed because VS Code, Photos, Explorer and coding-tool processes hold handles under C:/xampp/htdocs/MooRoute. No forced handle closing, process killing of user apps, copy/delete relocation or data reset was used. MySQL configuration was rolled back and MySQL/preview restarted at the original path. Verified backup restores and a concrete rename helper are available; see SETUP.md. The actual current folder remains MooRoute. The helper's successful execution must be recorded before claiming relocation complete.

## D218 — Back-office desk by responsibility; dedicated Thai date and time fields (2026-10-06)

Status: Implemented on the owner's request after the owner accepted the recommended design.

- The back office lists only what an account is responsible for. `backofficeAreas()` in `src/lib/navigation.ts` is the single rule for the header menu, the page and tests: **work** = the account has a job there (master write/delete, prepare plans, review and publish plans, imports); **reference** = read and export only (dispatcher and supervisor look up master data); anything else is not listed. The menu appears only when at least one area exists. The page states the account's role and scope, shows each work area as a card (verb chips were later removed, D219) and lists reference data compactly with a "ดูและส่งออกได้ แก้ไขไม่ได้" badge. Opening an area directly still works where the server allows reading; list and record pages then say they are read-only. Server authorization is unchanged.
- Dates are entered in a dedicated วว/ดด/ปปปป (พ.ศ.) field and times in a dedicated 24-hour ชช:นน field (`src/components/date-time-inputs.tsx`, rules in `src/lib/date-input.ts`). Typing digits shapes the text (06102569 → 06/10/2569, 830 → 08:30), Thai digits and pasted ISO dates are accepted, two-digit years mean 25YY พ.ศ., impossible dates and times are refused with Thai messages. A calendar (Thai months, Buddhist years, Sunday first, keyboard: arrows, Page Up/Down, Enter, Esc) and a time list (30-minute steps) are optional helpers; typing always works. Date-and-time values use a paired field. The fields submit exactly the previous text formats, so no parser or API changed.
- Replaced in: search, trips, consignment history filter, consignment form, assignment panel, planner date, route/template dates and times, trip editor instants, and master-data date/time/date-time fields.

## D219 — Button colour fix, desk rows, dev planning reset and ready-to-consign mock-up plans (2026-10-06)

Status: Implemented on the owner's request.

- Defect: the planner rule `.planner-actions button, .planner-toolbar button, …` (specificity 0,1,1) beat `.primary-button` (0,1,0), so red save buttons in the planner rendered white and only turned red through the stronger `:hover` rule; the same rule boxed the date/time triggers. The rule now uses `:where()` and excludes styled buttons, so explicit button classes always win. Date/time triggers are icon-only (no box or fill).
- Back office: work areas stay in the card grid (`admin-grid`, 3/2/1 columns) with icon, title and a short summary; the verb chips introduced in D218 are removed at the owner's request (the capability verbs remain in `backofficeAreas()` for tests only). Icons: หมวดสินค้า = tags, ประเภทรถ = van (vehicles keep the truck).
- Development data: on the owner's request every route and daily plan in `moointer_dev` was deleted (1 route with 3 stops, 1 unpublished plan with 4 empty drafts; no trips, templates or consignments existed). A verified backup was taken first; only the three delete guards involved were dropped and then recreated byte-identically (all 67 trigger definitions unchanged); the action is recorded in AuditLog (`DEV_PLANNING_PURGED`). This was a one-off operator action, not a committed tool.
- `npm run db:seed:mockup:plans` creates fictitious routes CMN, CMS and UPC covering all 8 mock branches, 9 templates (rounds 1–3, pork and chicken at every stop, processed or dry goods on some rounds) and published plans for 14 days from today, drafted by the mock dispatcher and published by the mock supervisor through the normal services. Trip identities match template generation, so "สร้างเที่ยวจากแม่แบบ" never duplicates them. No consignment is created.

## D220 — Self-service account page and contact defaults (2026-10-07)

Status: Implemented together with D221. An earlier session on 2026-10-07 created migration `202610070009_profiles_units_issue_types` and applied it to `moointer_dev`, then its tracked changes (schema models, header wiring) were rolled back while the migration, the untracked files and the applied tables remained. Because the migration is applied it is kept unchanged; `prisma/schema.prisma` now declares the three models again so the schema matches the database.

- `UserProfile` (phone, default source warehouse, version) is separate from `User`, so the web account never updates `User`. The application role gets INSERT/UPDATE on `UserProfile` only (`scripts/runtime-grants.ts`). Updates are idempotent, version-checked, locked and audited (`PROFILE_UPDATED`); password changes go through Better Auth, revoke other sessions and are audited (`PASSWORD_CHANGED`).
- `/account` shows the account type, scope, contact defaults and password change. A new consignment request pre-fills the saved phone and the default warehouse when it is still active; both stay editable per request.
- `Unit` and `IssueType` tables exist (seeded with the codes already fixed in code) but the application does not use them yet; units and issue types are still the fixed lists in `src/server/domain/consignment.ts`. Turning them into managed master data is a separate, not yet requested change.

## D221 — Five account types and a header profile (owner request, 2026-10-07)

Status: Implemented. The owner asked for fewer, broader permissions to reduce confusion, and a profile bar at the top, and delegated the design ("ออกแบบและทำมาแบบมืออาชีพ").

- Seven roles became five account types: พนักงานทั่วไป (REQUESTER), พนักงานสาขา (BRANCH_RECEIVER), คลังและรถขนส่ง (WAREHOUSE, absorbs DRIVER), ผู้วางแผนขนส่ง (DISPATCHER, absorbs SUPERVISOR) and ผู้ดูแลระบบ (ADMINISTRATOR). Wording, order and duties live in `ACCOUNT_TYPES` (`src/lib/account-display.ts`), shared by the header, back office, account page and guide.
- Role codes were kept so existing accounts, audit history and fixtures stay valid. DRIVER and SUPERVISOR are retired aliases with exactly the capabilities of the type that absorbed them; provisioning stores the absorbing type and records the requested code; `consolidateRetiredRoles()` (run by `npm run auth:sync:local`) moves holders with an audit row per account (`LOCAL_OPERATOR_ACCOUNT_TYPE_CONSOLIDATED`).
- Capability codes stay fine-grained and every movement, receipt, label and manifest action still needs its scope (warehouse, driver, branch or company). Merging therefore never widens whose records an account may touch: a driver holds warehouse capabilities but is still refused warehouse work without a warehouse scope, and warehouse staff still cannot record departure for a trip they do not drive unless it leaves their warehouse.
- Conflict recorded: merging dispatcher and supervisor removes the two-person split between preparing and publishing a daily plan (already true for the administrator under D215). Publishing still requires the automatic pork/chicken three-round coverage check, a reason and confirmation, keeps every revision and records the publisher. Consignment self-review stays forbidden for everyone (D216). If the owner later wants approval by a different person, a planner can be split again by adding a separate publish-only type; no data change is needed.
- The header shows a profile button (initial, account type) with a panel: name, email, account type, scopes with the working scope first, links to /account and the guide, and sign-out. The back-office layout no longer has its own name and sign-out button. The menu collapses behind the toggle below 1200px so six menu items, the guide and the profile always fit; the brand tagline is hidden while signed in.
- User-facing words ผู้จัดรถ and หัวหน้างาน in messages, panels and the guide now read ผู้วางแผนขนส่ง. Display names of existing accounts were not changed.
