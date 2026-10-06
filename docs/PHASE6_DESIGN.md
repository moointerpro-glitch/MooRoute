# Phase 6 consignment design — 2026-10-06

Reviewed against the 52-model schema, the immutable-history triggers and the Phase 4/5 services. Migration `202610060005_consignments` is additive. It adds consignment request fields, the `ReturnLine` ledger (53 models), two event kinds, a request-freeze trigger, versioned warehouse/department masters, and the three consignment categories named in the requirements. No applied migration was rewritten and no data was reset.

## State transition matrix

The application exposes no other status change and no arbitrary status edit. `src/server/domain/consignment.ts` (`transitionMatrix`) is the executable source. Capabilities and row scopes are re-resolved inside every transaction, including idempotent replays. GLOBAL satisfies every scope except OWN_REQUESTER.

| Action | From | To | Actor (capability + scope) | Prerequisites |
| --- | --- | --- | --- | --- |
| saveDraft | DRAFT (or new) | DRAFT | consignment.create, own requester | Department in the requester's scope; active warehouse, BRANCH destination and categories |
| submit | DRAFT | PENDING_REVIEW | consignment.create, own requester | ≥1 item, ≥1 package, sender name/phone, recipient contact (own or branch), service date not in the past, branch open that date, preferred trip eligible; receipt mode frozen; items and packages materialized |
| cancelRequest | DRAFT, PENDING_REVIEW | CANCELLED | consignment.create, own requester | Reason |
| reject | PENDING_REVIEW | REJECTED | consignment.assign, GLOBAL | Reason |
| assign | PENDING_REVIEW | ASSIGNED | consignment.assign, GLOBAL | Current published, non-cancelled BRANCH_DELIVERY trip with a stop at the destination; before cutoff; compatible known capacity; sender/recipient/transport snapshots frozen |
| reassign | ASSIGNED, WAREHOUSE_RECEIVED | unchanged | consignment.assign, GLOBAL | No LOADED/DEPARTED/RECEIPT event; packages with sender/warehouse; eligible target; previous labels revoked; reason |
| cancelAssigned | ASSIGNED, WAREHOUSE_RECEIVED | CANCELLED | consignment.assign, GLOBAL | Not in motion; labels revoked; custody retained; reason |
| warehouseReceive | ASSIGNED | WAREHOUSE_RECEIVED | consignment.warehouse, source WAREHOUSE | Every stable package ID confirmed (SENDER → WAREHOUSE) |
| load | WAREHOUSE_RECEIVED | LOADED | consignment.load, source WAREHOUSE | Assignment is on the current published, non-cancelled revision; every package (WAREHOUSE → VEHICLE) |
| depart (per trip) | LOADED | IN_TRANSIT | trip.move + own DRIVER, or consignment.load + source WAREHOUSE | Applied to every loaded consignment on the trip that the actor may move |
| receive | IN_TRANSIT, PARTIALLY_RECEIVED, ISSUE (movement departed) | PARTIALLY_RECEIVED / RECEIVED (ISSUE kept while open) | consignment.receive, destination BRANCH | DEPARTED event; package IDs in VEHICLE custody; cumulative received + returned ≤ sent, same unit |
| correctiveReceive | LOADED (no departure) | PARTIALLY_RECEIVED / RECEIVED | consignment.correct, GLOBAL | Reason; CORRECTION event plus RECEIPT event |
| reportIssue | WAREHOUSE_RECEIVED, LOADED, IN_TRANSIT, PARTIALLY_RECEIVED, RECEIVED | ISSUE | receive/destination, warehouse/source, trip.move/driver or correct/GLOBAL | Type and description; previous state stored in `resumeStatus` |
| recordReturn | ISSUE | unchanged, or RETURNED when every package is returned | consignment.correct, GLOBAL | Only undelivered packages/quantities; reason; ReturnLine ledger |
| resolveIssue | ISSUE | recomputed: RECEIVED / PARTIALLY_RECEIVED / resumeStatus | consignment.correct, GLOBAL | Reason; ISSUE_RESOLVED event compensates the issue event |
| close | RECEIVED, PARTIALLY_RECEIVED | CLOSED | consignment.receive + destination, or consignment.correct + GLOBAL | No open issue; every package received or returned; detailed items received + returned = sent |

CLOSED, CANCELLED, REJECTED and RETURNED are terminal. A database trigger also blocks any status change out of CLOSED, CANCELLED and REJECTED. Phase 4 plan publication may additionally move ASSIGNED/WAREHOUSE_RECEIVED records between trips (status unchanged) under `plan.publish`.

## Integrity rules

- **Drafts.** Draft line items are stored in `draftItems` (versioned JSON) because ConsignmentItem/ConsignmentPackage rows can be inserted only while DRAFT and can never be deleted. Submission inserts the immutable rows while still DRAFT, then changes the status in the same transaction. Drafts are private to their requester (detail, list, export, files).
- **Frozen request.** After DRAFT, the `Consignment_request_frozen` trigger rejects changes to requester, department, source, destination, receipt mode, requested date/round/trip, contacts, notes, package count/weight, draft items, code and submission time.
- **Lock order.** Lock order is idempotency → daily plan(s) → consignment. Assignment locks the target trip's DailyPlan, which serializes capacity accounting and keeps publication's eligibility → plan → vehicles → consignments order. Reassignment locks both plans in ID order. Movement and receipt lock only the consignment row (`FOR UPDATE`).
- **Receipts.** Receipts are append-only `ReceiptLine` rows (package lines unique per package). Returns are append-only `ReturnLine` rows. Quantities are DECIMAL(14,3) with explicit units; 30 SHEET and 3 PACKAGE are separate balances.
- **Snapshots.** AddressSnapshot rows are immutable (sender warehouse/department/contact; recipient branch address and contact, falling back to the branch contact). The transport snapshot records trip, revision, service date, round, vehicle/plate, driver, times and stop.
- **Cutoff (proposed, D210).** The cutoff is loading start, or departure when loading start is unknown, minus `CONSIGNMENT_CUTOFF_LEAD_MINUTES` (default 0). Unknown both → ineligible.
- **Capacity.** Capacity is checked only when the vehicle capacity, the package weight and the same unit are all known. It sums trip planned load (same unit) and the active consignments on the trip. A unit mismatch rejects; anything unknown is reported as "ไม่ทราบความจุ".
- **Files.** JPG/PNG/PDF are detected by signature, ≤10 MB, ≤5 per consignment. Files are stored under `UPLOAD_DIR` (default `.local/uploads`, refused inside public/.next/src/app) with opaque UUID keys. Uploads are allowed for the own requester in DRAFT/PENDING_REVIEW. Downloads require the consignment row policy and are served with `Content-Disposition: attachment`, `nosniff`, a sandbox CSP and `no-store`.

## Additive field dictionary (migration 005)

| Entity / field | Type | Meaning |
| --- | --- | --- |
| Consignment.requestedServiceDate / requestedRoundNo / requestedTripId | DATE / INT 1–3 / FK Trip, all nullable | Requester's desired date, round and optional preferred trip; assignment decides |
| Consignment.senderName / senderPhone / recipientName / recipientPhone | VARCHAR, nullable | Request contacts; frozen into snapshots at assignment |
| Consignment.notes | VARCHAR(1000) | Free text |
| Consignment.packageCount / packageWeight / packageWeightUnit | INT 0–500 / DECIMAL(14,3) / VARCHAR | Planned packages; weight pair both-or-none (KG) |
| Consignment.draftItems | JSON (schemaVersion 1) | Draft items; retained as submitted evidence |
| Consignment.resumeStatus | ConsignmentStatus, only while ISSUE (CHECK) | Movement state preserved during an issue |
| Consignment.submittedAt / closedAt | DATETIME(3) | Lifecycle instants (UTC) |
| ConsignmentEvent.kind | + REJECTED, ISSUE_RESOLVED | Append-only event kinds |
| ReturnLine | eventId+consignmentId FK, itemId or packageId, DECIMAL quantity, unit, note | Append-only return ledger; packageId unique; no update/delete triggers |
| Warehouse / Department.version, updatedAt | INT / DATETIME(3) | Optimistic versioning for the new master screens |
| ConsignmentCategory rows MARKETING / DOCUMENT / EQUIPMENT | data, INSERT IGNORE | Categories named in the requirements; separate from food ProductCategory |

New indexes: Consignment(status, createdAt), (requestedServiceDate), (requestedTripId).
