# Acceptance test matrix

Initial status of every test: Not run. Record actual evidence in docs/PROGRESS.md and link it here. Integration and concurrency tests must use real MySQL.

Phase 1 verification on 2026-10-06 covers configuration safety, database connectivity/persistence, Bangkok midnight, the Thai shell at 1440/768/390 px, keyboard navigation and error redaction. See [Phase 1 evidence](evidence/phase-1/VERIFICATION.md). Phase 2 adds the real MySQL results below; remaining full operational scenarios await their implementing phases.

| ID | Area | Required scenario | Status |
| --- | --- | --- | --- |
| T01 | Coverage complete | 3 active branches x 3 rounds x pork/chicken = 18 cells; valid daily revision publishes. | Passed (Phase 2) |
| T02 | Coverage incomplete | Remove one required category at one branch/round; publication fails with that missing cell. | Passed (Phase 2) |
| T03 | Coverage eligibility | Cancelled/inbound DC trips do not count; branch effective dates determine required branches. | Passed (Phase 2) |
| T04 | Branch and category | Pork at A and chicken at B cannot match branch A plus chicken; aliases resolve or flag ambiguity. | Core predicate passed; alias handling not run |
| T05 | Time filters | Selected times use OR; inclusive range includes endpoints; duplicate matched stops produce one trip. | Not run |
| T06 | Time truth | Loading time is not departure; null departure does not match; Bangkok midnight preserves service date. | Core time/storage passed; search filters not run |
| T07 | Vehicle race | Two concurrent overlapping assignments for one vehicle cannot both commit; boundary/buffer behavior is explicit. | Passed (real MySQL race) |
| T08 | Trip changes | Cancel/merge/reassign validates coverage and consignments atomically; history and ownership remain intact. | Passed Phase 4 for pre-loading reassignment; in-motion changes rejected |
| T09 | Receipt race | Concurrent receipts cannot exceed sent quantity; 30 items and 3 boxes are distinct balances. | Passed (real MySQL race) |
| T10 | Idempotency | Same key/payload replays once; same key/different payload conflicts; no duplicate events. | Passed (replay and real deadlock) |
| T11 | Master constraints | Duplicate plate/province and branch code fail; referenced rows cannot be destructively deleted. | Passed (Phase 2/3 schema and master workflows) |
| T12 | Versions | Stale edit conflicts; template change leaves past data intact; concurrent publication preserves valid revision. | Passed (Phase 2) |
| T13 | Authorization | Wrong branch/role cannot list, read, mutate, export, print, scan or download restricted data. | Passed for Phase 3 endpoints; future file/print/QR endpoints pending |
| T14 | Consignment flow | A permitted marketing shipment moves from draft through assignment, loading, transit and complete receipt. | Not run |
| T15 | Partial and exceptions | Partial receipt stays open; premature receipt fails; discrepancy/return resolution preserves event history. | Not run |
| T16 | Print integrity | A4 and 100 x 150 mm long Thai addresses fit; 3 packages produce 1/3, 2/3, 3/3; missing address blocks issue. | Not run |
| T17 | Label lifecycle | Vehicle/address/trip changes revoke old label; QR checks current version; reprint does not duplicate records. | Not run |
| T18 | Files and snapshots | Private files remain scoped; invalid uploads fail; branch edits do not change historical snapshots. | Not run |
| T19 | Thai and responsive UI | All screens/states are Thai; keyboard navigation and 1440/768/390 px views are usable. | Not run |
| T20 | Search truth | Counts/sort/pagination follow the same filters; no fixed count 41 or invented contact details. | Not run |
| T21 | Generation | Repeated daily generation is idempotent; missing operational time data remains draft and visible. | Passed Phase 4, including different-key and concurrent generation |
| T22 | Import validation | Invalid staged rows produce precise errors; no partial silent commit; repeated batch does not duplicate. | Not run |
| T23 | Source provenance | Repeated PDF category pages do not become 123 trips; different source dates and ambiguity are preserved. | Not run |
| T24 | Release and recovery | Build/checks run; measured load test documented; disposable backup restores; secrets absent from logs/repo. | Not run |

## Phase 2 evidence — 2026-10-06

[13 real MySQL integration tests and explicit scope limits](evidence/phase-2/VERIFICATION.md). T08 covers fail-closed publication with assigned consignments, not the later full cancel/merge/reassignment workflow. T13 has internal permission/scope rejection tests only; complete authenticated endpoints remain later work. The seven unit and five Thai-shell browser tests also passed on the new production build.

## Phase 3 evidence — 2026-10-06

[Authentication/master verification](evidence/phase-3/VERIFICATION.md): T11 and implemented T13 surfaces tested against real MySQL and real browser sessions; 18 integration, 4 authenticated browser, 5 foundation browser and 8 unit tests pass. Responsive master forms at 1440/768/390 px manually sampled; full T19 operational screen matrix awaits later phases. No production auth bypass.

## Phase 4 evidence — 2026-10-06

[Planning verification](evidence/phase-4/VERIFICATION.md): T01–T03, T07–T08, T11–T12 and T21 passed with real MySQL and the implemented Thai planner flow. 23 integration, 2 planning browser, 4 auth/master browser, 5 shell browser and 8 unit tests pass. T13 covers planning API/page/global scope. T19 covers planner at 1440/768/390 px; later operational/print screens remain pending. T17 label revocation inside reassignment passed; actual label issue/QR/print lifecycle remains Phase 7 work.
