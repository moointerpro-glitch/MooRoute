# Actual Phase 3 permission matrix

Implemented 2026-10-06. `src/server/auth/permissions.ts` seeds explicit role/capability links; server transactions resolve these links on each operation. Roles never imply a bypass. An administrator has master/identity privileges, not automatic planning, movement or receipt privileges. No self-signup or web role-edit endpoint exists.

| Role | Implemented master access | Operational capabilities prepared for domain services | Row scope |
| --- | --- | --- | --- |
| REQUESTER | Branch read | trip.read; consignment.create/read | Explicit branches for branch lists; own or assigned department consignments |
| DISPATCHER | All master read/export | trip.read; plan.write; consignment.read/assign | Explicit operational scope; current all-day plan writer requires GLOBAL |
| WAREHOUSE | Consignment-category read | consignment.read/warehouse/load | Assigned source warehouse |
| DRIVER | Own driver profile read | trip.read/move; consignment.read | Explicit DRIVER scope linked to the actual trip driver |
| BRANCH_RECEIVER | Assigned branch read | trip.read; consignment.read/receive | Explicit destination branch |
| SUPERVISOR | All master read/export | trip.read; plan.publish; consignment.read/correct | Explicit scope; current whole-day publication requires GLOBAL |
| ADMINISTRATOR | All master read/write/delete/export; identity.manage | None automatically | GLOBAL for new records; existing rows still constrained by assigned scope |

Concrete master capability names are `master.<kind>.read`, `.write`, `.delete`, `.export`, for vehicles, vehicle-types, drivers, branches, product-categories, storage-conditions and consignment-categories. Aliases are edited atomically inside the branch aggregate, so the branch policy also protects them. GLOBAL is an explicit persisted scope, never inferred merely from a role name. UserScope has exactly one target matching GLOBAL/BRANCH/DEPARTMENT/WAREHOUSE/DRIVER; SQL CHECK and FKs enforce this.

Branch lists/details/mutations use allowed branch IDs. Driver profiles use allowed driver IDs. Shared dictionaries are readable by a scoped user only with the corresponding capability. Fleet master records require GLOBAL scope. Export requires a separate export capability and exactly the same row predicate, with a 1,000-row cap. All list filters and counts are executed within one repeatable-read transaction; pages contain at most 20 rows.

`resource-policy.ts` provides the common consignment predicate for future detail/export/file/print adapters and an assigned-driver/branch trip predicate. This guard is exercised for all four consignment surfaces in integration tests. Phase 3 does not expose consignment file downloads, QR or print endpoints: those remain unavailable, with no public storage URLs. Full T13 for those future endpoints remains to be exercised when implemented; these guard tests are not a claim that Phase 6/7 workflows exist.

Every current `/api/masters` route derives actorId from a verified Better Auth database session and resolves active identity and policy again on the server. Request body actor/role fields cannot grant access; unsupported master fields are rejected. Mutation requests require exact same-origin and JSON, an idempotency key, optimistic version and reason. HTML hiding is only presentation.

Local-account bootstrap is an operator CLI, never a production request path. The initial administrator is GLOBAL and has no operational role. The CLI can create users with one role/scope, reset a password (revoking all sessions), or disable an account (also revoking sessions). Provisioning/reset/disable audit events explicitly identify local operator tooling; the affected account is the FK actor for this bootstrap exception, not a claimed authenticated web actor. Do not reuse that exception for normal mutations.
