# Phase 7 design — labels, manifests and controlled imports (2026-10-06)

Reviewed against the 53-model schema and the Phase 6 lifecycle. Label tables (LabelVersion, LabelPackage, PrintEvent) already existed with immutability triggers. Migration `202610060006_imports` is additive and only extends the staged-import tables. No applied migration was rewritten and no data was reset. Two pinned dependencies were added: `qrcode-generator` 2.0.4 (runtime, MIT, no transitive dependencies) and `jsqr` 1.4.0 (tests only, Apache-2.0).

## Label lifecycle

| Operation | Actor | Rules |
| --- | --- | --- |
| Issue (`issueLabel`) | label.issue + GLOBAL or source WAREHOUSE | Status ASSIGNED / WAREHOUSE_RECEIVED / LOADED; assignment on the current published, non-cancelled revision; no current (non-revoked) version exists; branch master unchanged since the snapshot; all mandatory fields present. One LabelVersion per issue with a consignment-wide increasing number, a random opaque `lookupToken`, an immutable JSON payload and one LabelPackage per package |
| Print / reprint (`recordPrint`) | label.print + GLOBAL or source WAREHOUSE | Appends a PrintEvent (actor, time, format, copies, reason). A reprint requires a reason. Revoked versions are refused (`LABEL_REVOKED`) and name the replacement. No consignment, package or label row is created |
| Revocation | automatic | Reassignment, cancellation, plan publication that moves the consignment (including a vehicle change on the same trip) and address correction all revoke the versions of the previous assignment |
| Address correction (`correctAssignmentAddress`) | consignment.assign + GLOBAL | Before departure only. Appends a new assignment on the same trip/stop with fresh sender/recipient snapshots, revokes previous labels, records an ASSIGNED event of type ADDRESS_CORRECTION. A new label must then be issued |
| Lookup (`lookupLabel`, `/l/<token>?p=<n>`) | any signed-in user passing the consignment row policy | Returns CURRENT or REVOKED, the label number, package custody, and for revoked versions the current replacement. Unknown tokens and out-of-scope rows reveal nothing |

The payload is built only from the frozen assignment snapshots (recipient branch address/contact, sender warehouse/department, transport trip/date/round/vehicle). It never reads live master data. If the branch master differs from the snapshot, issuing is blocked (`ADDRESS_CHANGED`) until the dispatcher runs the address correction. Old payloads are never rewritten.

Mandatory fields for a production label: branch code and name, address line, subdistrict, district, province, a 5-digit postal code not starting with 0, recipient name and phone, source warehouse, trip code, service date, vehicle plate, at least one package, and an address of at most 300 characters (longer text would overflow the 100 × 150 mm label; essential text is not shrunk). Otherwise only a sample is available: watermarked ตัวอย่าง, no QR, no label version, no print record.

The QR encodes only `<base URL>/l/<opaque token>?p=<package sequence>`. It contains no name, address or phone number. The receipt screen verifies scanned QR codes on the server and rejects revoked versions with the replacement number.

## Print layouts

Sheets are sized in physical millimetres and each print page injects its own `@page` rule. A4 portrait holds four 105 × 148.5 mm labels per page (margin 0). The sticker format is one 100 × 150 mm label per page. Navigation, toolbar and footer are hidden in print. Labels are monochrome. The manifest is A4 with 12 mm margins, grouped by destination stop, with package totals, item totals per unit (different units are never summed), a receiver signature line per destination and three signature areas at the end.

## Staged imports

| Step | Behaviour |
| --- | --- |
| Template | CSV or XLSX with the approved Thai headers only (no example row) |
| Stage | Session actor with import.manage + GLOBAL + the target write capability. CSV (UTF-8, comma/semicolon/tab) or XLSX (first sheet) up to 2 MB and 500 rows. PDF, JPG and PNG are refused as reference-only material; nothing is read by OCR. The SHA-256 of the file plus the reference edition identify the batch: the same file for the same edition reopens the existing batch |
| Mapping | Auto-match by Thai label or field name; the user can remap. One column feeds at most one field. Unmapped source columns are kept in the raw row but never applied |
| Validation | Stored per row: parsed values, Thai errors, notes, duplicate information and the resulting action (CREATE, UPDATE, SKIP, MERGED, BLOCKED, UNDECIDED) |
| Duplicate review | A record that already exists needs an explicit UPDATE or SKIP. A duplicate key inside one file is an error. Blank optional cells never erase existing values on update |
| Commit | Only when no row is BLOCKED or UNDECIDED. Everything is re-validated against current data and applied in one transaction through the same master/route/template services as the screens (same guards, audit and versions). Any failing row rolls back the whole batch. A committed batch is a no-op on repeat |
| History | ImportBatch and ImportRow rows are never deleted. Raw rows are immutable (trigger). Committed and rejected batches are frozen (trigger) |

Import kinds and approved fields are defined in `src/server/domain/imports.ts`: branches (`master.branches.write`), vehicles (`master.vehicles.write`) and schedule templates (`route.write` + `template.write`).

Schedule rows are one row per template stop. Rows repeated for the same template and stop (the category pages of a source sheet) are merged into one stop with the union of categories, so 18 source rows over three pages become two templates, not 18. A template is decided as a whole. Different reference dates are different editions and therefore separate batches; an existing template is only revised after an explicit UPDATE decision, which appends a revision. Unknown departure, arrival and vehicle stay null. Aliases, ambiguous plates, unknown branches and categories are reported for review and never resolved automatically.

## Additive schema (migration 006)

| Entity / field | Type | Meaning |
| --- | --- | --- |
| ImportBatch.kind | VARCHAR(32), CHECK | branches, vehicles or schedule |
| ImportBatch.headers / mapping / summary | JSON | Source headers (immutable), column mapping, validation counts |
| ImportBatch.rowCount / version / updatedAt / rejectionReason | INT / INT / DATETIME(3) / VARCHAR(500) | Size, optimistic version, rejection reason |
| ImportRow.decision | VARCHAR(16), CHECK | UPDATE or SKIP |
| Triggers | ImportBatch_history, ImportBatch_no_delete, ImportRow_no_delete, ImportRow_staged_insert, ImportRow_source_frozen | Identity and raw source immutable; closed batches frozen; no deletes |

Runtime grants added: INSERT on LabelVersion, LabelPackage and PrintEvent; INSERT and UPDATE on ImportBatch and ImportRow. No DELETE on any history table.
