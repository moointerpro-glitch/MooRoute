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
- Reference availability update (2026-10-07): the operational PDF is now present and all three pages have been visually inspected. Its hash and identical private reference copy are recorded in references/README.md. This resolves the historical missing-file limitation only; ambiguous annotations and source values remain unapproved, and no PDF data has been imported. See PROGRESS “PDF review and installation baseline comparison”.

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

## D222 — The planner manages daily plans end to end; no plan approver (owner decision, 2026-10-07)

Status: Accepted by the owner ("ไม่ต้องมีผู้อนุมัติแผน ให้ผู้จัดแผนจัดการเองได้ทั้งหมด"). Resolves the conflict noted in D221.

- ผู้วางแผนขนส่ง (DISPATCHER) prepares routes, templates and daily plans and publishes them. No second person or separate approver type exists, and none is planned.
- Unchanged controls: publication still requires the automatic pork/chicken three-round coverage check for every active branch, a reason and an explicit confirmation; every plan revision and its publisher are kept.
- Unchanged and separate: a consignment request cannot be assigned, rejected or reassigned by the person who created it, including through a replacement plan (D216). That rule is about consignment review, not plan approval; two mock planners exist so it can be exercised.
- Master data (vehicles, drivers, branches and so on) stays with the administrator; planners read and export it.

## D223 — Web user management for the administrator (2026-10-07)

Status: Implemented. Until now accounts could only be created by operator scripts on the server machine.

- `/admin/users` (back-office area "ผู้ใช้งาน", shown only with `identity.manage` and company scope): list with search, account-type and status filters; create; change name, account type and scope; disable and re-enable; issue a new temporary password. Service `src/server/services/users.ts`, API `/api/users`, components `src/components/user-admin.tsx`.
- One account type per account, chosen from the five D221 types (retired codes cannot be chosen). Scope rules are validated on the server: every account needs an active sender department; พนักงานสาขา needs an open delivery branch; คลังและรถขนส่ง needs a warehouse, a driver record or both; ผู้วางแผนขนส่ง and ผู้ดูแลระบบ get the company scope. Saving replaces the role and scope rows in one transaction; AuditLog keeps before and after.
- Accounts are never deleted in the application, because plans, consignments and audit rows refer to them. Disabling blocks sign-in (session hook and the per-request active check) and ends every session; the email cannot be changed.
- Passwords: the server generates a temporary password (12 characters from an unambiguous alphabet, about 59 bits), stores only its hash, returns it once and never writes it to the replay record, logs or audit; a retried request shows no password. Issuing a new one ends the account's sessions. Not implemented: forcing a change at first sign-in (the screen tells the administrator to ask for it); recorded as a follow-up.
- Protection against lockout and races: every identity write locks the active administrators' User rows in id order (`FOR UPDATE OF u`) and re-checks the actor under that lock, so an administrator demoted or disabled a moment earlier cannot finish a change and two administrators cannot remove each other; an administrator cannot disable, demote or reset their own account here; a change that would leave no active administrator is refused. Writes are idempotent, version-checked and need a reason (except creation).
- Changed decision: D220 kept `User` read-only to the web application. User management needs writes, so the runtime database account now also has INSERT/UPDATE on `User`, INSERT on `AuthAccount` and INSERT/DELETE on `UserRole` and `UserScope` (`scripts/runtime-grants.ts`). It still has no DELETE on `User`, `AuthAccount` or any history table, and no DDL.

## D224 — Development database reset and new mock accounts (owner request, 2026-10-07)

Status: Done once on `moointer_dev` at the owner's request ("ลบ users เก่าทั้งหมดและสร้าง users mock ใหม่ทั้งหมด"; the owner chose the full clean reset over disabling). All data involved was synthetic.

- The eleven old accounts were referenced by audit rows, fourteen published plans and two consignments that the guard triggers protect, so deleting only the accounts was impossible. The owner authorised clearing all accounts and operational history while keeping master data.
- `npm run db:reset:dev-operations -- --confirm=moointer_dev` (`scripts/reset-dev-operations.ts`) is a guarded operator tool: local environment, moointer_dev on 127.0.0.1:3307 and the confirmation flag are required; it takes and restore-verifies a backup first and stops if that fails; it truncates 39 account and operational tables (TRUNCATE does not fire the guard triggers, whose definitions are fingerprinted before and after and must match); it checks every foreign key for orphans; it recreates the mock accounts and writes `DEV_OPERATIONS_RESET` to the new audit log. Master data, roles, permissions, seed manifest and migrations are kept. It must never be pointed at shared, staging or production data.
- Mock accounts now come from one list, `scripts/mock-accounts.ts` (seven fictitious people marked ทดสอบ covering the five types: administrator, two planners, warehouse worker, driver, branch staff, general staff). `db:seed:mockup`, `db:seed:mockup:plans` and `auth:sync:local` use it. Mock plans are drafted and published by one planner (D222). Old local credential files were moved to `.local/auth/retired-*`, not deleted.

## D225 — Daily planning screen, multi-day tools, table gridlines and plan-based departure status (owner request, 2026-10-07)

Status: Implemented (the screen and tools agreed as "phase A"). No schema change and no change to any publication rule.

- Planning screen (`src/components/planning-workspace.tsx`, `planning-day.tsx`, `planning-trip-editor.tsx`): a date bar that stays in view (weekday and Buddhist-era date, plan status, coverage, trip count, previous / today / next), a two-week strip with the status and coverage of every date, a warning for dates in the next seven days without a published plan, a per-round time summary, the coverage table before the trips with the covering trip and its arrival time in each cell, and trips as one table grouped by round with detail on demand. The trip editor opens under its trip; the vehicle booking window follows the trip times unless set by hand under "ขั้นสูง". Edits still stay on screen until the draft is saved, now from a persistent unsaved-changes bar; a draft saved without a typed reason records "แก้ไขแผน N รายการ". Publication still needs a typed reason and the confirmation.
- Multi-day tools (`src/server/services/planning-range.ts`, `/api/planning` actions `generateRange` and `publishRange`, `?overview=`): drafts are generated from the recurring templates for every date in a range that has no plan yet (existing plans are never touched, and a date with no template in effect creates nothing). Several dates are published together only when each is the first revision of its plan, consists solely of untouched template-generated trips, and has full coverage; any hand-edited date must be opened and confirmed on its own. Each date is its own transaction through the unchanged `generateTrips` / `publishPlan`, so every existing rule applies, and each date's outcome is reported.
- Limits for the multi-day tools only (`src/lib/planning-horizon.ts`): today and later; drafts up to 30 days ahead; publication up to 14 days ahead; at most 31 dates per request. Reason for the shorter publication horizon: a published date blocks branch opening/closing changes until it is re-planned. Single-day drafting and publication are deliberately not limited, so far-future fixtures and corrections of past dates keep working; limiting those is part of the rule changes still to be decided.
- Generated trips are named after their template and date (`<template code>-<ddmmyy BE>`), falling back to the previous hash form only when that code is taken.
- Every data table shows column and row lines (`.admin-table`, coverage, guide and search result tables).
- Departure status in search, the trip list and trip detail (`src/lib/departure-status.ts`): "รถออกแล้ว" appears only when a departure was actually recorded (the existing consignment departure action, `TRIP_DEPARTED`). Otherwise the status is derived from the planned time and worded as the plan: "ยังไม่ถึงเวลาออก" or "ถึงเวลาออกตามแผนแล้ว … ยังไม่มีการบันทึกรถออก". The consignment eligibility reason was reworded the same way ("เลยเวลาออกรถตามแผนของรอบนี้แล้ว"). Limitation recorded: a trip without consignments can never be recorded as departed today, so most trips show the plan-based status. Recording actual departure and arrival for every trip is a separate feature (needs someone to record it on site) awaiting the owner's decision.
- Not done, awaiting the owner's numbers: round time rules, mandatory arrival time and driver, receiving-hours check and a lock on past dates (to be introduced as warnings first, then enforced).

## D226 — No reference lists in the back office; consign straight from a trip row (owner request, 2026-10-07)

Status: Implemented.

- The back office no longer shows the "ข้อมูลอ้างอิง — ดูและส่งออกได้ แก้ไขไม่ได้" section. `backofficeAreas()` lists only areas where the account has a job, so a planner sees แผนเดินรถรายวัน and นำเข้าข้อมูล. This changes D218's presentation only: capabilities are unchanged, and a master list the server allows reading still opens by its address and says it is read-only.
- Trip lists (search results and รอบรถทั้งหมด) have a "ดำเนินการ" column with รายละเอียด and, for accounts that may consign, "ฝากของกับรอบนี้". It is offered only for a branch-delivery trip whose planned departure is still ahead. With one destination (the searched branch, or a single-stop trip) it links straight to the consignment form; with several stops it opens a short list of that trip's branches. The trip detail page offers the same choice of stops instead of a disabled button when the destination is the only thing missing. The consignment page and the server still re-check eligibility, cut-off and scope.

## D227 — Deployed account mode and hosted installation package (owner decision, 2026-10-07)

Status: Implemented. The owner chose the application's own password accounts for the hosted system (asked explicitly; the company SSO in `loginsso/` was the alternative) and asked for a build, an upload package for a DirectAdmin host and an SQL file to import through phpMyAdmin. This resolves the "authentication for a deployed environment" release blocker as a decision; it does not make the system verified on a real host.

- `APP_ENV=production` is now accepted (`src/server/auth/config.ts`): the origin must be HTTPS on a real host name (plain HTTP, loopback and IP literals are refused), so session cookies are always Secure. `APP_ENV=local` is unchanged (loopback only). Any other value still refuses to start. No sign-up, no fallback.
- Sign-in throttling per client: `peerAddress()` reads `x-forwarded-for` or `x-real-ip` only in production and only when `TRUSTED_PROXY_HEADER` names it; for `x-forwarded-for` the entry written by the nearest proxy is used (`TRUSTED_PROXY_HOPS`, default 1). Without the setting, or with a malformed value, all sign-ins share one bucket as before. This is safe only when the application is reachable solely through the host's web server.
- Not provided by this mode: second factor, password recovery by email (an administrator issues a temporary password), forced change at first sign-in, and account lockout beyond the rate limit.
- Installation SQL (`npm run deploy:sql`, output in ignored `.local/deploy/sql`): built from `prisma/migrations` rather than a dump, because the local servers lower-case table names while Linux hosts are case-sensitive; trigger bodies are wrapped in DELIMITER blocks for phpMyAdmin; the migrations are recorded as applied with Prisma's checksums; account types and capabilities are inserted; one first administrator with a random temporary password is a separate file. Verified: the MySQL 8 file imported into a fresh schema on MySQL 8.4.11 is identical to `moointer_dev` in tables (57), triggers (67), column definitions, indexes, foreign keys and trigger bodies. A static check of 463 table references in hand-written SQL found no letter-case mismatch.
- MariaDB: the owner's host is described as "MySQL like XAMPP", and XAMPP is MariaDB (10.4.32 on this machine). The project standard remains MySQL 8.4 (`db:check` still requires it). A MariaDB variant of the SQL differs in two statements kinds only (collation `utf8mb4_unicode_ci`; `DROP CONSTRAINT` instead of `DROP CHECK`). Evidence on MariaDB 10.4.32 in temporary schemas that were dropped afterwards: the variant imports completely; integration suites pass 41/41 (with the MySQL-version readiness assertion skipped for the experiment) and 16/16; the only application defect found was this session's `FOR UPDATE OF` lock, replaced by a statement that names only `User` and runs on both engines. Not verified on MariaDB: the browser suites, any version other than 10.4.32, and a case-sensitive Linux server.
- Upload package (`npm run deploy:package`, output `.local/deploy/moointer-transport-app.zip`): the production build, `public/`, `server.cjs` (CommonJS startup file for Passenger hosts), `next.config.ts` and a `package.json` limited to runtime dependencies with the lock file reduced, so the host's "Run NPM Install" needs no development tooling. The build's `.next/node_modules` links point at the build machine; they are listed in `next-externals.json` and recreated by `server.cjs` on the host. Verified by simulation on this machine: the zip extracted into an empty folder outside the repository, `npm install --omit=dev`, MariaDB loaded from the SQL files, `node server.cjs`: health, first administrator sign-in, user list, a master record saved, an account created with a one-time password, planning, search, account page and sign-out all worked.
- Not verified and stated to the owner: nothing has run on a real DirectAdmin host; HTTPS production mode could only be unit-tested locally; whether the host offers Node.js applications and which Node.js version (tested on 24.14 only); whether the host's database user may create triggers (error 1419 when binary logging is on without `log_bin_trust_function_creators`); scheduled backups and monitoring still do not exist.

## D228 — No consign button in trip lists (owner request, 2026-10-07)

Status: Implemented. The per-row "ฝากของกับรอบนี้" action added in D226 was removed from search results and รอบรถทั้งหมด at the owner's request; the last column is again รายละเอียด. Consigning starts from the trip detail page, which keeps the D226 choice of destination stops, and from the ฝากของส่งรถ menu.

## D229 — Dedicated time entry and hour/minute wheel popup (2026-10-07)

Status: Implemented on the owner's explicit request to replace time dropdowns with direct entry and a clock-triggered popup for upward/downward selection. Supersedes D218's 30-minute time list. All shared TimeInput/DateTimeInput consumers use the new wheel; search range start/end dropdowns now use TimeInput. The published-time multi-select chips and time-basis/category selectors retain their existing purpose.

- Thai 24-hour text entry accepts normal HH:MM, Thai digits and supported compact entry; e.g. 830 normalizes to 08:30 on blur. Three compact digits remain editable until blur or the fourth digit, preventing premature punctuation from breaking entry. Invalid hours/minutes are retained for correction, marked invalid and blocked by existing form validation; the range action independently parses/validates and canonicalizes before requesting results. Server validation and payload formats remain unchanged.
- Clock opens separate bounded hour (00–23) and minute (00–59) wheels with native mouse/touch scrolling, up/down buttons, spinbutton keyboard controls and an explicit use-time action. There is no select/listbox of time values. Popup edits are provisional until confirmation; cancel, Escape and outside click preserve the field. Opening an empty optional field leaves it empty; clearing remains available only for optional inputs. No rounding to 30-minute slots, no automatic midnight/date rollover, no invented operational timestamps.
- Popup is portaled outside labels/scroll containers, kept within the viewport and internally scrollable on short screens. Focus is restored on explicit close/confirmation; outside dismissal preserves the destination focus. Styling follows the existing Thai red/white interface. No dependency, schema, migration, authorization or operational-data change.
- Verified in local production-build browser tests on disposable MySQL: direct entry/invalid values, mouse wheel, touch emulation, keyboard boundaries, cancel/clear/outside dismissal, responsive placement and template FormData. Physical mobile devices, screen readers and the deployed host are not verified for this change. See evidence/time-picker/VERIFICATION.md.
