# API and operator contracts

## Phase 5 implemented search routes

All routes require a verified session; the actor is never taken from the request. Responses are `no-store`; errors use the shared Thai contract (401 unauthenticated, 403 forbidden, 404 out-of-scope detail, 400 invalid input, 503 generic).

`GET /api/search` (capability `trip.read`). Query string, all optional:

| Parameter | Contract |
| --- | --- |
| `date` | Gregorian `YYYY-MM-DD` service date; default today in Asia/Bangkok |
| `mode` | `branch` (default), `time`, `range`; only the active mode's filter applies |
| `branch` / `q` | Branch ID, or text (≤100 chars, Thai digits normalized) matched against code, official name and active aliases |
| `times` | Comma list (≤48) of minute offsets from 00:00 Bangkok of `date`, −1440…2879; combined with OR |
| `from`, `to` | `HH:mm`, both or neither, `to ≥ from`; inclusive, within the date |
| `basis` | `departure` (default) or `loading`; NULL never matches |
| `rounds` | Subset of `1,2,3` (OR); `categories`: product category IDs (OR, ≤20); `kinds`: TripKind list (OR), default `BRANCH_DELIVERY` |
| `sort` | `time_asc` (default) or `time_desc`; unknown times last, ties by stable trip ID |
| `page` | 1…10000; page size 20 |

Different groups combine with AND. Branch and category must be satisfied by the same `TripStop` (EXISTS). Only the current published revision of the date is searched; cancelled trips are excluded. The response is `{serviceDate, applied, resolution:{status NONE|RESOLVED|AMBIGUOUS|NOT_FOUND, branch, candidates}, total, page, pageSize, pageCount, rows, published, facets:{tripCount, unknownCount, times[{offset,label}], span}, allowedKinds}`. Each row is one trip with ordered stops (frozen names), per-stop categories, `matched` flags, times `{at, offset, label}` or null, vehicle, and permission-filtered contact/driver objects. Count, rows and facets run in one repeatable-read transaction with the same scope predicate; facets ignore only the active mode filter.

`GET /api/search/branches?q=` returns up to 10 `{id, code, name, alias}` candidates for autocomplete (`trip.read`).

Pages: `/` (search; anonymous visitors see the public shell and a login link; accounts without `trip.read` see a Thai permission message), `/trips` (all permitted published trips by date), `/trips/[tripId]?branch=` (current published revision detail with eligibility pre-check), `/branches?q=&page=` (directory, 20 per page), `/consign?trip=&branch=` (read-only hand-off; no submission). `/login?next=` accepts only same-site relative paths.

## Phase 4 implemented planning routes

`/admin/planning` is the Thai authenticated daily planner with route/template editors and revision audit. The complete workspace requires GLOBAL plus `plan.read`. Its mobile coverage table intentionally scrolls horizontally in a labeled region. Dates are entered as DD/MM/YYYY Buddhist era; API dates are Gregorian and instants are exact UTC ISO strings with millisecond precision. Empty times become null, never assumed departures.

`GET /api/planning?date=YYYY-MM-DD&revision=<optional UUID>` returns a consistent read snapshot: current daily version, selected/published revision IDs, immutable revision history, ordered candidate trips, eligible branches, six-cell missing coverage, vehicles/capacity, drivers, categories, routes/template revisions, linked consignment IDs/codes/versions/states, changed trip codes and preliminary conflict messages. An unknown revision for that date returns 404. Only global planning users can access this operational metadata. Audit is limited to the most recent 100 relevant entries; historical revisions remain selectable. Preview is advisory and publication revalidates under write locks.

`POST /api/planning` requires a verified active session, exact configured Origin, JSON body <=500,000 characters, ASCII `Idempotency-Key` <=100 characters, and `{action,input}`. Every input requires a 3–500 character reason. Successful writes return actual persisted IDs/versions; errors use the shared Thai response contract. No actor/capability is accepted from request fields.

| Action | Capability + GLOBAL | Input / result |
| --- | --- | --- |
| `route` | route.write | RouteInput in planning-catalog.ts: immutable code, expectedVersion, active, name, effectiveFrom/To, ordered branchIds; returns id/revisionId/version |
| `template` | template.write | TemplateInput: stable identity/version, effective range, route revision, kind/round, weekday list 1–7, vehicle/driver, nullable clock minutes, arrivalDayOffset 0–2, occupancy minute offsets 0–4319, buffer, per-route-stop category IDs, notes; returns id/revisionId/version |
| `draft` | plan.write | serviceDate, expectedVersion (0 for new day), complete `DraftTrip[]` candidate, reason; returns planId/revisionId/version |
| `generate` | plan.write | serviceDate, expectedVersion, reason; returns planId/revisionId/version/generated; a repeated semantic generation adds zero trips and preserves existing revisions |
| `publish` | plan.publish | revisionId, expectedVersion, reason, optional reassignments `{consignmentId, expectedVersion, tripId, stopSequence}[]`; returns revisionId/version after atomic commit |

DraftTrip includes stable tripId/code, BRANCH_DELIVERY/INBOUND_DC/VAN_SALES (legacy OTHER remains readable), roundNo, cancelled, vehicleId/driverId, provenance route/template revision IDs, distinct nullable loading/departure/arrival/occupancy instants, bufferMinutes, notes, plannedLoad decimal string/loadUnit and ordered stops with category IDs. Coverage requires the branch and PORK/CHICKEN category at the same stop. Known load/capacity comparisons require identical units. Drafts do not acquire reservations; every reservation writer runs only in publication under sorted vehicle locks and a locking current overlap query.

Copy creates a new trip identity. Edit/reduce changes the complete candidate. Merge combines target stops/categories and cancels the source; explicit quantities need operator reconciliation. Delete omits a never-published unassigned draft member while retaining all old revision rows. Omitting a published or referenced trip fails `TRIP_DELETE_FORBIDDEN`; cancel it instead. Replacement publish requires every old linked consignment to have an explicit destination-matching outbound target and expected version. Only pre-loading ASSIGNED/WAREHOUSE_RECEIVED records may move. New assignments/events/snapshots, label revocation, audit, reservation release/acquisition and plan pointer change commit together. Failed replacement retains the previous published plan/reservations/assignments/labels. Missing coverage, in-motion consignments, stale versions, capacity, inactive references and overlaps reject with Thai errors.

No public search, consignment creation, print/file or import handlers are added by Phase 4.

## Phase 3 implemented routes

| Route | Contract |
| --- | --- |
| `/login` | Thai email/password login; no signup/reset-by-email form |
| `/admin`, `/admin/[kind]`, `/admin/[kind]/[id]` | Verified active session; permitted master list/detail/edit; `new` requires write capability; Thai permission/error states |
| `POST /api/auth/sign-in/email` | Better Auth password authentication; exact configured origin; 5 attempts/minute; generic Thai failures |
| `POST /api/auth/sign-out` | Revokes current session; same origin required |
| `GET /api/auth/get-session` | Better Auth session contract; no-store; all other auth endpoints unavailable |
| `GET /api/session` | Active actor display name and canOpenBackend; no role editing or permission grant |
| `GET /api/masters/[kind]` | q <=100 chars, status active/archived/all, page positive integer; rows/total/page/pageSize=20 and allowed UI actions |
| `GET /api/masters/[kind]/[id]` | Same row policy as list; branch includes active aliases; missing or out-of-scope returns 404 |
| `POST /api/masters/[kind]` | JSON `{id?, expectedVersion, reason, action: save or delete, values?}`; Idempotency-Key header; same origin; trusted session actor only |
| `GET /api/masters/[kind]/export` | Same filters/scope plus explicit export capability; <=1,000 rows, UTF-8 BOM CSV, Thai headers/enums/dates, formula-prefix escaping; no-store |

Kinds: vehicles, vehicle-types, drivers, branches, product-categories, storage-conditions, consignment-categories. Field allowlists/Thai labels live in `src/lib/master-definitions.ts`; values must include a boolean active. Alias lines are part of the branch aggregate. The API uses Gregorian YYYY-MM-DD and local ISO YYYY-MM-DDTHH:mm for form dates; the UI accepts/displays explicit Buddhist-year DD/MM/YYYY and translates before submission. Event persistence remains UTC DATETIME(3).

Mutations return `{id, version, outcome}` where outcome is saved/deleted/archived. A delete with retained FK dependencies archives instead; conflicts with published branch eligibility, active reservations or current dependencies reject the whole transaction. Required PORK/CHICKEN codes cannot be disabled/renamed. Every successful mutation writes actor, reason, before/after and idempotency reference in the same transaction. Duplicate normalized plate/province or code returns 409; stale version returns 409; forbidden 403; unauthenticated 401; invalid input 400; unexpected persistence/configuration error 503 with generic Thai text.

See [actual permission matrix](PERMISSIONS.md). All current API paths derive the actor from a database-backed session; local-account provisioning remains CLI-only. Historical Phase 1–3 sections describe their original exposure boundaries; the Phase 4 section above is the current planning contract. Public operational reads and consignment/file/print endpoints remain unavailable.

## GET /api/health/live

Public process liveness only. Returns HTTP 200, `Content-Type: application/json` and `Cache-Control: no-store`:

```json
{"status":"ok"}
```

This response says that the web handler is running. It does not claim database readiness, authentication, published coverage or operational availability. It contains no environment values, database versions or diagnostics. `status` is a machine contract, not visible application copy.

There is no `/api/health/ready` endpoint. `npm run db:check` is an operator-only server-side CLI and returns exit code 0 on a real MySQL check, otherwise 1 with a safe error code. It validates MySQL 8.4, InnoDB, utf8mb4, collation and a parameterized Thai/emoji round trip. Full exceptions, credentials and connection strings are suppressed.

## Web routes

| Route | Behavior | Data access |
| --- | --- | --- |
| `/` | Thai shell, current Bangkok date, keyboard-operable search tabs, time-basis choice and unavailable search controls | No operational data; no writes |
| `/guide` | Thai introductory guide and accurate feature availability | Static public guidance |
| Unknown path | HTTP 404 and Thai recovery link | None |

Shared response headers include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: same-origin`. The Next.js powered-by header is disabled. Search engines are told not to index this internal-app shell.

## Deferred contracts

Master CRUD, trip search, coverage preview/publication, consignment submission/events/receipt, labels and imports are not exposed in Phase 1. Implement them only in their requested phases with authenticated scope, server input validation and the documented transaction guards. Never treat a disabled button as authorization. Routes proposed in the source DOCX remain reference proposals until implemented and documented here.

## Phase 2 internal server contracts

These are implemented TypeScript services, not public HTTP endpoints or server actions. The future authenticated adapter must derive `actorId` from the verified session, never from request JSON. Each call resolves active identity, persisted permissions and scope inside the transaction. Phase 3 owns login/session integration. No production authentication bypass exists. Application credentials remain read-only until the authenticated mutation surface is introduced.

| Function | Input / result | Permission and transaction |
| --- | --- | --- |
| `saveDraft` | `DraftInput`: serviceDate, expectedVersion (0 for new day), trips; returns planId/revisionId/version | `plan.write`, global scope; eligibility + daily-plan locks; creates a new draft revision, retaining stable trip IDs |
| `publishPlan` | revisionId, expectedVersion; returns revisionId/version | `plan.publish`, global scope; eligibility + plan + sorted old/new vehicle locks; validates all six cells per eligible branch, occupancy and assigned consignments; publishes and switches reservations atomically |
| `changeBranchEligibility` | branchId, expectedVersion, activeFrom/activeTo, archived; returns version | `master.write`, global scope; eligibility lock; changes affecting existing published dates are rejected pending coordinated revision workflow |
| `receiveConsignment` | consignmentId, expectedVersion, lines with exactly itemId or packageId, decimal string quantity, unit, optional note; returns eventId/status/version | `consignment.receive`, destination branch or global scope; consignment lock; requires departed event; appends receipt/event/audit, updates custody and optimistic version |
| `findPublishedTripIds` | serviceDate, branchId, categoryCode; returns ordered stable trip IDs | `trip.read`, branch or global scope; published pointer, exact service date, same-stop EXISTS; repeatable-read transaction |

All mutation calls also require an idempotency key (1–100 ASCII letters, digits, colon, underscore or hyphen). Unique actor/operation/key, canonical SHA-256 payload hash, and stored JSON result live in the same transaction. Exact replay reauthorizes and returns the stored result; a changed payload conflicts. Failed transactions leave no success record. Bounded retries handle MySQL deadlocks and unique-insert races; callbacks must never perform external side effects.

Safe domain failures use `DomainError.code` and Thai `message`, optionally a structured missing-coverage list. Important codes: `FORBIDDEN`, `VERSION_CONFLICT`, `COVERAGE_MISSING`, `UNKNOWN_OCCUPANCY`, `VEHICLE_OVERLAP`, `REASSIGNMENT_REQUIRED`, `RECEIPT_STATE`, `RECEIPT_EXCEEDS_SENT`, `RECEIPT_UNIT`, `IDEMPOTENCY_CONFLICT`. A future HTTP adapter must redact unexpected persistence errors; the current public liveness endpoint never calls these operations.

Time contracts: serviceDate is Gregorian YYYY-MM-DD in Bangkok; event/planning instants are ISO UTC strings with millisecond precision. Unknown instants are null. Quantities are positive decimal strings with up to 11 integer/3 fractional digits; package receipt is exactly `1 PACKAGE` per stable package ID. An item is measured in its sent unit. Detailed mode completes only when both all item balances and all packages are received and no issue is open. A partial receipt stays `PARTIALLY_RECEIVED`.

## Versioned JSON evidence

JSON is not used for stop/category relationships or quantity balances. Frozen payloads carry `schemaVersion: 1`. Address snapshot payloads contain sender/recipient name, address components and contact as known at assignment; transport snapshots contain stable trip ID, trip revision ID, service date, round and vehicle details. Receipt event payloads contain the validated lines; the normalized `ReceiptLine` table is the authoritative balance ledger. Audit before/after objects identify the changed revision/version and relevant input; imports retain raw source rows and validation issues, never executable instructions. Print/label payload rendering, upload validation and full lifecycle endpoints remain their later requested phases; Phase 2 provides storage and ownership/history constraints only.

T08 currently fails closed with `REASSIGNMENT_REQUIRED` when a published replacement affects assigned consignments. It does not implement the later cancellation/merge/reassignment UI or silently move labels. Authentication, complete search filters/counts/pagination, master CRUD, submission/loading, corrections/returns, label printing and import commit routes are not exposed.
