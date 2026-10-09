# MySQL data model and contracts

## Technology baseline

Use MySQL with InnoDB, utf8mb4, foreign keys and a documented collation verified with Thai names and aliases. Pin a supported MySQL release and compatible Prisma/Node versions during Phase 1. Use the Prisma mysql provider; follow the installed Prisma version for connection configuration rather than copying version-specific setup blindly. Keep credentials in server-only environment configuration.

Use MySQL in development, integration tests and production. SQLite tests are not a substitute for MySQL transaction behavior. Use a dedicated database per test run or an isolated schema and reject destructive test commands against a production connection. Use migrations committed to source control. Never use a development reset against real data.

Represent service_date with DATE and round_no as an integer constrained to 1, 2 or 3 for branch deliveries. Use UTC DATETIME(3) for event and planned instant timestamps with an explicit application UTC convention; DATETIME does not preserve a timezone identifier. Convert display/input through Asia/Bangkok. Unknown times are NULL, not zero dates or midnight. Test local midnight conversion. Use DECIMAL for measured quantities, integer package counts and explicit units.

Use stable primary keys, created_at, updated_at and an optimistic version where applicable. Scope uniqueness intentionally. Validate normalized registration plate plus province and unique branch code. Keep aliases in their own table; flag ambiguous alias matches rather than selecting a branch arbitrarily. Use explicit lifecycle status/effective dates for master data. Prefer restricted deletion for referenced records and archive them instead.

## Relational entities

- User, Role, Permission, UserRole and UserScope: identity, capabilities and department/warehouse/branch scope.
- Branch and BranchAlias: code, official name, destination type, address parts, postal code, contact, receiving windows, active_from and active_to. DCs/factories are not automatically branches in coverage.
- Vehicle and VehicleType: normalized plate, province, brand, model, color, type, wheel count, body/storage capability, capacity and unit, owner, status and availability. Driver is separate from Vehicle; Trip stores the actual assignment.
- ProductCategory and StorageCondition: category hierarchy separated from ambient/chilled/frozen conditions. ConsignmentCategory is separate.
- Route and RouteStop: ordered destinations and effective version. Do not infer unverified source order.
- ScheduleTemplate and TemplateStopCategory: weekday/effective-date rules, default round, local planned times and intended stop categories.
- DailyPlan and PlanRevision: service_date, revision, draft/published/superseded state, creator/publisher and publication time. Preserve revision membership and changes.
- Trip and TripStop: stable dated trip identity, operational type, round, selected plan revision membership, driver/vehicle, UTC timestamps and ordered destination snapshots. Version published planning details without duplicating operational consignment identities.
- TripStopCategory: explicit many-to-many stop/category relationship used by coverage and search. Do not store branches or categories as comma-separated strings.
- VehicleReservation: vehicle, trip, start/end occupancy instants, buffer policy and active state. Track assignment changes and revisions.
- Consignment and ConsignmentItem: requester/scope, source, destination, receipt mode, item category, item name, decimal quantity and unit, state, current assignment and optimistic version.
- ConsignmentPackage: stable package ID, sequence, total, optional measured weight/unit and current custody state. D234: one row per physical piece; the packaging kind and contents of piece N come from the packaging lines in the frozen request document (`Consignment.draftItems.packaging`, document version 2), expanded in line order. `Consignment.packageCount` is the total of those lines and `packageWeight`/`packageWeightUnit` are null for requests saved after D234. No migration. D236 (document version 3): the document also holds the request `categoryId`, each row holds its item `name` and optional `quantity`/`unit`, and at submission a row with a quantity stores the ID of its ConsignmentItem (`itemId`).
- ConsignmentAssignment and AddressSnapshot: trip and destination stop, frozen sender/recipient/address, approval time, previous assignment and reason.
- ConsignmentEvent and ReceiptLine: actor, timestamp, event type, package or item, quantity/unit, discrepancy, return and idempotency key. Corrections append compensating events.
- Attachment: private storage key, content type, size, owning record, checksum, uploader and access metadata.
- LabelVersion, LabelPackage and PrintEvent: assignment/vehicle/address version, immutable printable payload, active/revoked state, opaque lookup ID, print actor and time.
- ImportBatch, ImportRow, AuditLog and IdempotencyRecord: source hash, staged raw data, validation results, before/after change summary, request fingerprint and stored response.

Finalize an ER diagram and field dictionary before writing the migration. Include nullability, units, validation and indexes. Do not store frequently filtered relationships in opaque JSON. JSON is acceptable for immutable source evidence and versioned audit payloads with a defined schema.

## Transactions and concurrency

Coverage publication, revision replacement, trip reassignment, vehicle changes and cancellation must be transactional. Serialize writes that affect the same service date using a stable daily-plan guard row, then validate coverage against the candidate revision. Every code path that changes coverage must use the same guard protocol. Lock relevant branch eligibility changes consistently or version the eligibility snapshot to prevent a branch change racing with publication.

Serialize vehicle reservation changes by locking the stable vehicle row before a current locking read of overlapping reservations. Acquire multiple vehicle locks in deterministic ID order, including the old and new vehicle during reassignment. All reservation writers must use this protocol. A check followed by an unlocked insert is insufficient. Use half-open intervals and the chosen buffer policy; retry bounded deadlocks safely with an idempotency key.

Lock the relevant consignment/package or item balance before receiving. Validate remaining quantities and append events in the same transaction. Persist idempotency records with a unique operation-scope key and request hash; replay the original result on the same payload and reject a changed payload reusing the key. Optimistic version conflicts return a safe Thai refresh/retry message, not silent overwrite.

Do not use PostgreSQL-only arrays, ILIKE, exclusion constraints or timezone column types in migrations. For an existing repository on another database, first inventory schemas/data, design a reversible migration and rehearse with a backup in staging; do not silently destroy/recreate it.

## Service and API contracts

Define typed contracts for master CRUD, trip search/detail, coverage preview, plan publication/revision, consignment submission/assignment/events/receipt, label issue/print and staged imports. Document exact routes or server actions after selecting repository conventions. Validate payloads on the server and return stable error codes plus Thai user-facing text. Avoid exposing database errors.

Search input includes serviceDate, searchMode, branchId/query, selectedTimes or from/to, timeBasis, roundNumbers, categoryIds, page and sort. Return rows, total, matched stops and applied filters from a consistent predicate. Use an EXISTS condition over the same TripStop for branch/category matching. Add pagination limits and indexes driven by actual query plans.

Default proposed uploads: JPG, PNG or PDF, maximum 10 MB each and five files per consignment, configurable. Check file signatures, size and authorization; sanitize display names; serve private authenticated downloads. Do not execute uploaded content. Record configurable retention and backup policies in the operations guide.

## Phase 4 implementation supplement — 2026-10-06

The 52-model schema is extended by additive migration 004. See [reviewed field dictionary, ER relationships and transaction decisions](PHASE4_DESIGN.md) and [actual MySQL evidence](evidence/phase-4/VERIFICATION.md). Existing history triggers, FK ownership and stable trip identities remain in force. No applied migration rewritten or database reset.

## Phase 6 implementation supplement — 2026-10-06

Additive migration 005: consignment request fields, `resumeStatus`, the ReturnLine ledger, the REJECTED/ISSUE_RESOLVED event kinds, the request-freeze trigger, versioned Warehouse/Department and three seeded consignment categories. 53 models, five migrations. See [PHASE6_DESIGN.md](PHASE6_DESIGN.md).

## Phase 7 implementation supplement — 2026-10-06

Additive migration 006 extends ImportBatch (kind, headers, mapping, summary, rowCount, version, rejectionReason) and ImportRow (decision) and adds triggers that freeze raw source rows and closed batches. Label tables are unchanged. 53 models, six migrations. See [PHASE7_DESIGN.md](PHASE7_DESIGN.md).

## Phase 8 implementation supplement — 2026-10-06

Migration 007 recreates 42 history-guard triggers in a restorable form (no rule change). Migration 008 adds the `AuditLog(entityId, createdAt)` index. 53 models, eight migrations.
