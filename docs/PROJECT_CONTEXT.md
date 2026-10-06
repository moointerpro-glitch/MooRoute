# Project context

## Product and scope

Moointer staff need to find branch delivery trips by branch, exact times or time range; administrators need to maintain vehicles, branches, categories, routes and daily trips. Staff also need to deposit marketing materials or other items onto a branch vehicle, track their delivery and print branch address labels.

The first release includes authentication, role and branch scope, master data, route and trip management, daily coverage checks, Thai search screens, consignments, receipts, labels, manifests, imports and operational history. GPS tracking, route optimization, payment, inventory valuation and ERP synchronization are outside this release unless the user extends scope.

## Confirmed requirements

- UI language: Thai. Prompt and engineering language: English.
- Database: MySQL. Earlier PostgreSQL suggestions are superseded for this implementation pack.
- Every active branch receives both pork and chicken in three rounds per day: round 1, round 2 and round 3.
- Separate product categories and maintain vehicles with registration plate, brand, color and vehicle type.
- Maintain branches and their printable addresses and contacts.
- Provide a dedicated consignment page and searchable history, including marketing materials transported on branch vehicles.
- Preserve the red, white and light-gray visual structure of the supplied web mockup.

## Reference handling

Place these user-provided files under references/ without changing the originals:

- messageImage_1791002598481.jpg: dated transport sheet, 2 October 2026.
- ChatGPT Image 3 ต.ค. 2569 16_07_16.png: UI reference showing three alternative search modes.
- รายการของสด-แห้ง ขึ้นสาขา.pdf: category-marked operational sheets dated 18 September 2026.

The reviewed October sheet contains 42 displayed lines across main branch transport, the 07:00 group, Van Sales and inbound DC transport. These lines are not all unique route definitions. The PDF repeats a 41-line schedule on three pages with category markings; do not create 123 trips. Different source dates are separate snapshots, not duplicate records to merge blindly.

The mockup's count of 41 and displayed phone numbers are illustrative. Calculate live counts from filtered data and use authorized contacts only. Yellow/red fills, crossed-out text, abbreviations and handwritten marks require a review mapping; do not infer cancellation, urgency or product meaning from color alone. Verify ambiguous registration plates and branch aliases before import.

The source heading เริ่มขึ้นของ means loading start. It is not proof of departure time. A morning/afternoon DC entry with the same displayed 08:00 needs verification. Keep ambiguous values in staging with source provenance. Do not fabricate departure times or stop order.

## Daily operations

A route is an ordered reusable set of stops. A template is an effective-dated recurring schedule. A trip is a dated execution with round, vehicle, driver, planned times and stop-level categories. Several branches may share one trip; the three-round requirement does not mean only three trips in the company or one vehicle per branch.

Coverage is evaluated by service date, active destination branch, round number and category. The required categories are pork and chicken. Three active branches therefore require 18 planned cells: 3 branches x 3 rounds x 2 categories. A trip covers a cell only if it is an eligible outbound branch-delivery trip, includes that branch stop and carries that category at that stop. Cancelled and inbound DC trips never count. Additional categories are optional unless separately configured.

Publish a complete daily plan revision atomically. Show a matrix of missing cells in Thai and block publication until all required cells are covered. Preserve the last published revision until the replacement passes validation. A route template alone does not satisfy dated coverage. Newly opened and closed branches use effective dates. Do not permit an editable exemption to silently bypass the confirmed all-branch rule.

Validate vehicle availability over a configured occupancy interval, including loading and turnaround where configured. Do not use departure alone to prove availability. If necessary occupancy times are unknown, allow a draft but block assignment/publication with a Thai explanation. Permit back-to-back non-overlapping intervals according to the documented buffer. Capacity checking is enforced only with known compatible capacity and load units; show unknown capacity honestly.

Changes to templates affect future generation only. Changes to a published day require a new revision with impact preview, coverage revalidation and consignment handling. Cancellation, consolidation or reduction must preserve valid coverage and handle every linked consignment. Retain previous versions and actor/reason timestamps.

## Search semantics

Select the service date first; default to today in Asia/Bangkok. Branch mode supports official name, branch code and reviewed aliases. Time mode supports one or more exact times using OR. Range mode includes both endpoints; reject an end earlier than its start in this release. Cross-midnight trips use full dated timestamps even though range search remains within the selected local date.

Provide a visible time basis selector: เวลาออกรถ or เวลาเริ่มขึ้นของ. Default to departure; unknown departure does not match a departure time filter. The UI must not relabel a loading time as departure. Show time chips derived from available records, not a fixed list.

Combine different filters using AND. Selected categories use OR, but the matched branch and category must belong to the same stop. Return one row per trip, even with several matching stops. Include the matched stop and categories, full route, round, times, vehicle, status and authorized contact. Use stable sorting by time then trip ID, pagination and filter-consistent counts. All three search tabs operate on one screen, rather than showing three copies of the application.

## Consignment lifecycle

An authenticated requester selects a source warehouse, one destination branch, desired service date/round, item category, item quantities and units, package count, sender/recipient contacts and optional notes/files. Destinations in different branches require separate consignments. Marketing media, documents and equipment are distinct consignment categories, not food delivery categories.

An eligible assignment points to an actual published trip that visits the destination, is still accepting consignments and has compatible known limits. A template or a route ID alone is insufficient. The dispatcher may assign during review. Freeze the receipt mode before submission: packages by default, or packages plus item quantities for detailed receipt.

Use an explicit transition matrix for draft, pending_review, rejected, assigned, warehouse_received, loaded, in_transit, partially_received, issue, received, closed, cancelled and returned. Specify authorized actors and prerequisites for every edge. Do not offer unsupported arbitrary status editing. Requesters can cancel a draft or pending request; later cancellation requires authorized dispatch handling and a reason. Loaded shipments cannot disappear by deleting the parent trip.

Record handover, loading, departure, partial receipts, discrepancies and returns as append-only events. Prevent receipt before departure except a controlled supervisor correction with a reason and audit trail. Package receipts must reference stable package IDs. Item receipts use quantities and units; receiving 30 posters is different from receiving 3 boxes. Cumulative receipt may not exceed the sent amount. Repeated submissions with the same idempotency key must not duplicate events or quantities.

Close only when the selected receipt mode is satisfied and any discrepancy is resolved. An issue event does not erase the previous movement state; preserve movement and exception information so the allowed recovery transition is unambiguous. Record returned quantities and custody separately. Add search by number, branch, requester, trip, date, category and status, subject to authorization.

## Labels and master history

Snapshot sender, destination address, recipient contact, trip, round and vehicle at assignment approval. Changes to branch master data must not rewrite issued labels or historical shipments. Address corrections, reassignment or a vehicle change on the same trip produce a new label version and revoke prior versions.

Print one label per package, showing a stable consignment number, package index such as 1/3, branch code/name, address, recipient/contact, source, service date, round, trip and vehicle. A QR code should contain an authenticated lookup URL or opaque identifier, not raw personal information. Reject revoked versions at scan time and show the replacement.

Support A4 with four labels per page and 100 x 150 mm labels. Reprinting the same version records a print event without creating new packages or consignments. Require a complete printable address and contact before issuing a production label. Provide a trip manifest grouped by destination with package totals and signature areas. A sample or incomplete label must clearly say ตัวอย่าง.

## Roles

- Requester: search trips and create/read permitted own or department consignments according to assigned scope.
- Dispatcher: plan and assign trips/consignments within operational scope.
- Warehouse: acknowledge source receipt and loading for assigned warehouses.
- Driver: view assigned trips and record authorized trip movement.
- Branch receiver: view and receive consignments for assigned branches only.
- Supervisor: publish daily plans, approve controlled corrections and inspect reports.
- Administrator: maintain master data, users and role assignments; operational powers still require explicitly granted capabilities.

Apply row scope to list, detail, download, QR, print, export and mutation endpoints. Log sensitive administrative changes. Do not collect national identity numbers for these features.
