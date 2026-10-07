# Current permission policy

Updated 2026-10-06 for owner decisions D215 and D216. Server capability and row-scope checks apply to every read and mutation; menu visibility grants no access. There are seven predefined roles. No public self-signup or web role editor exists.

## Common access

All seven roles have trip.read.company, trip.read, consignment.create and consignment.read. They can search every published trip kind on the selected date and view general branch directory data. This does not expose unpublished plans, arbitrary contacts, manifests, private drafts, files or other people's consignments. Custom roles without trip.read.company keep their existing scoped search policy.

Every role can create, edit, submit and cancel its own draft/pending request. Creation and submission require an explicitly assigned active DEPARTMENT scope; GLOBAL alone is insufficient. Scope is rechecked before idempotent replay. Adding a sender department does not grant department-wide history: that requires consignment.read.department (REQUESTER and ADMINISTRATOR).

| Role | Additional operations | Operational record scope |
| --- | --- | --- |
| REQUESTER | Submitted department history | Own requests or explicitly assigned department; other drafts private |
| DISPATCHER | Routes/templates, daily draft plans, assignment/rejection/reassignment, labels, manifests, schedule imports | GLOBAL |
| WAREHOUSE | Warehouse receipt, load/depart, labels and warehouse manifest | Assigned source WAREHOUSE, plus own requests |
| DRIVER | Departure, issues and trip manifest | Assigned trip DRIVER, plus own requests |
| BRANCH_RECEIVER | Receipt, issues and closure | Assigned destination BRANCH, plus own requests |
| SUPERVISOR | Publish plans, corrective receipt, returns, issue resolution/closure, label printing and manifests | GLOBAL |
| ADMINISTRATOR | Union of all roles, full master maintenance, imports and read-only access to others' drafts | GLOBAL; own-only draft edit/submit/cancel still enforced |

## Separation and presentation

A request's creator cannot assign, reject or reassign that request, including the administrator. This is enforced before replay and in eligible-trip lookup. Publishing a replacement plan cannot reassign the publisher's own active consignment: the entire transaction rejects and the previous published plan remains valid. Another eligible dispatcher or administrator must handle it. D215 still permits administrators to prepare and publish a daily plan; D216 adds the consignment self-review restriction.

Main navigation comes from /api/session capabilities: all predefined roles see search, trips, branches, own consignments and history. Management is shown only for management capabilities. Login defaults to management for dispatcher/supervisor/admin and search for the other roles; an explicit safe next path is preserved. Actions outside actor capability/scope are absent. Authorized actions whose prerequisites are unmet appear disabled with Thai reasons in a collapsed panel. The server independently validates transitions, quantities, ownership, versions and audit.

Contact visibility remains master.branches.read + GLOBAL/assigned BRANCH, and master.drivers.read + GLOBAL/own DRIVER. Consignment form options redact other branches' contacts but can indicate that a stored recipient is available; the server snapshots the stored contact on approval. Labels, QR, files, exports and manifests retain their own capability and row predicates.

Master maintenance requires master.<kind>.read/write/delete/export and matching row scope. Planning requires GLOBAL plus its corresponding capability. History remains immutable and MySQL/InnoDB/utf8mb4 is unchanged. No migration was added.

## Account setup

Operator provisioning may include departmentId alongside the primary GLOBAL/BRANCH/WAREHOUSE/DRIVER scope. Existing local accounts can receive an audited department with npm run auth:account:local using an ignored .local/auth request with action assign-department, email, departmentId and reason. This is operator-only tooling, not a request-handler bypass. npm run auth:sync:local installs the new predefined capabilities and assigns the synthetic operations department only to nine known active development accounts; requester marketing membership and passwords are preserved.

Regression evidence: [access-policy verification](evidence/access-policy/VERIFICATION.md). Historical Phase 3–7 policy descriptions and D209 are superseded where they conflict with D215/D216.

Back-office listing (D218, 2026-10-06): `backofficeAreas()` in `src/lib/navigation.ts` decides which back-office areas an account sees (work vs reference) and whether the header shows "จัดการหลังบ้าน". It is presentation only; every route keeps its own server check.
