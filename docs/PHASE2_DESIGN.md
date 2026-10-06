# Phase 2 relational design review

Reviewed against DATA_MODEL.md, PROJECT_CONTEXT.md and T01–T12 on 2026-10-06 before generating the initial migration. This is an engineering review, not a claim of business-owner approval. Source schedules are not seed data.

## Identity and history boundaries

`Trip` is the permanent operational identity for a service date. `TripRevision` belongs to exactly one `PlanRevision`; its stops and categories are immutable once published. Consignment assignments refer to both the stable trip and the precise stop revision. A daily plan points to its current published revision; older revisions remain readable. Publication writes the pointer, reservation replacement and audit in one transaction. Assigned consignments block a replacement that removes or changes their assigned trip revision; audited reassignment is an explicit later workflow, never an automatic deletion.

Route and template identities have separately numbered immutable versions. Templates store local minute-of-day values; dated trips store UTC DATETIME(3). Service DATE is a Bangkok calendar day encoded at UTC midnight for Prisma, not an event instant. Unknown times are null. No production round times or turnaround buffers are inferred. Synthetic examples use explicit times and zero buffer.

## Serialization and access review

Lock order: idempotency row, global eligibility guard, daily-plan row, sorted vehicle rows, consignment row. Transactions use READ COMMITTED and bounded retries for deadlocks. The eligibility guard serializes branch eligibility changes with publication; existing published dates affected by an eligibility change block that change pending a future coordinated revision workflow. Every plan mutation acquires the same guard and daily-plan row. Reservation replacement locks both old and new vehicles before a current locking overlap read. Intervals are half-open, with explicit buffer minutes incorporated into their stored bounds. Unknown occupancy blocks publication.

Domain entry points accept a user ID only from a future trusted server authentication adapter. They resolve active users, capabilities and scope from persisted tables inside the transaction. No HTTP mutation endpoint or caller-supplied role bypass is introduced in Phase 2. The synthetic operator has explicit permissions and global scope only in the disposable fixture database.

Receipt transactions lock the consignment, validate state and item/package ownership, then append event and receipt lines and update optimistic version together. Units are never converted or combined. An item has one immutable unit; each package can be received once. Detailed mode requires both all packages and all item quantities before completion. Partial receipt remains open. Corrections/returns need separate compensating event workflows in later phases; receipt history cannot be updated/deleted.

## Constraint review

- All relationships have foreign keys with RESTRICT deletion; historical source rows are archived, not deleted.
- Unique branch codes, normalized plate/province, date, revision numbers, stop order, stop/category, package sequence, label sequence and operation/actor/key.
- CHECK constraints cover rounds, positive decimals, intervals, effective dates, exclusive receipt targets, package weights and buffer bounds. Composite foreign keys enforce plan/trip date ownership, assignment stop ownership and receipt item/package ownership where applicable.
- Immutable history tables reject UPDATE/DELETE with database triggers. Published planning content cannot be edited; updates to the current plan pointer require the domain guard protocol. Operational application credentials never own migration/trigger privileges.
- JSON is reserved for frozen snapshots, event/audit evidence, print payloads and import staging; searchable relationships stay relational.
- Private attachments store opaque storage keys, checksum, owner/uploader and access metadata only. No public download URL or upload handler is created.
- Seed uses a fixed namespace and manifest. A rerun validates the existing manifest instead of rewriting published rows or receipts.

The generated [field dictionary](FIELD_DICTIONARY.md) enumerates physical fields, nullability, defaults and keys. The [ER diagram](ER_DIAGRAM.md) enumerates foreign-key relationships. Both must be checked against the final Prisma schema and SQL migration.

References: [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html), [Prisma migration CLI](https://docs.prisma.io/docs/cli/migrate). Installed Prisma 7 CLI help, rather than Prisma 8 examples, determines the actual migration command.
