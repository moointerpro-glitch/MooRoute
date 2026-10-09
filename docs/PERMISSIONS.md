# Current permission policy

Updated 2026-10-08 for D236 (no reject; reviewer cancels a pending request), D235 (administrator unrestricted), D233 (per-request sender department) and D221 (five account types), D222 (planners publish their own plans; no approver) and D223 (web user management) on top of D215 and D216. Server capability and row-scope checks apply to every read and mutation; menu visibility grants no access. People see five account types; each account holds one type and zero or more scopes (operational scopes remain required for branch/warehouse/planner/admin types). No public self-signup exists; the administrator manages accounts at /admin/users (D223). Capabilities per type are fixed in code, not editable on the web.

## Common access

All account types have trip.read.company, trip.read, consignment.create and consignment.read. They can search every published trip kind on the selected date and view general branch directory data. This does not expose unpublished plans, arbitrary contacts, manifests, private drafts, files or other people's consignments. Custom roles without trip.read.company keep their existing scoped search policy.

Every role can create, edit, submit and cancel its own draft/pending request. D233: the sender chooses an active department per request; no account DEPARTMENT scope is required. The department remains mandatory on the request and is validated on save/submit, including idempotent replay. Selecting it never writes account scopes or grants history/file access. Department-wide submitted history still requires consignment.read.department plus an administrator-assigned DEPARTMENT scope; GLOBAL and existing operational read rules remain unchanged. New account membership is optional, independently of sender selection.

| Account type (code) | Additional operations | Operational record scope |
| --- | --- | --- |
| พนักงานทั่วไป (REQUESTER) | Submitted department history | Own requests or explicitly assigned department; other drafts private |
| พนักงานสาขา (BRANCH_RECEIVER) | Receipt, issues and closure | Assigned destination BRANCH, plus own requests |
| คลังและรถขนส่ง (WAREHOUSE; absorbs DRIVER) | Warehouse receipt, load, departure, issues, labels and manifests | Assigned source WAREHOUSE and/or assigned trip DRIVER, plus own requests. Each action needs its own scope: a driver-only account cannot do warehouse work, and departure needs the driver of the trip or its source warehouse |
| ผู้วางแผนขนส่ง (DISPATCHER; absorbs SUPERVISOR) | Routes/templates, daily plans including publication, assignment/rejection/reassignment, corrective receipt, returns, issue resolution/closure, labels, manifests, schedule imports | GLOBAL |
| ผู้ดูแลระบบ (ADMINISTRATOR) | Union of all types, full master maintenance, imports, user management; may edit, submit and cancel another person's request and review their own (D235) | Not limited by scope rows or by request ownership |

Retired codes DRIVER and SUPERVISOR keep exactly the capabilities of the type that absorbed them so old fixtures and history stay valid. Provisioning a retired code stores the absorbing type; `npm run auth:sync:local` moves existing holders with an audit row. By owner decision D222 the planner prepares and publishes daily plans alone; there is no plan approver. Consignment self-review remains forbidden for planners; the administrator is exempt (D235).

## Separation and presentation

A request's creator cannot assign or reassign that request (cancelling one's own draft or pending request is always allowed). D236: there is no reject action; a reviewer may cancel a PENDING_REVIEW request with a reason through the `cancelPending` rule, which never applies to a draft, so private drafts stay out of reach. This is enforced before replay and in eligible-trip lookup. Publishing a replacement plan cannot reassign the publisher's own active consignment: the entire transaction rejects and the previous published plan remains valid. Another planner or an administrator must handle it. D235: none of this applies to the administrator, who is identified by account type (`principal().admin`), is treated as company scope even without scope rows, and may also edit, attach to, submit and cancel another person's draft or pending request. The request keeps its requester and every action records the administrator as actor. Rules that are not permissions still apply to the administrator: consignment status order, quantity/version checks, immutable history, coverage before publication and the user-management lockout guards.

Main navigation and the header profile (initial, account type, scopes, account page, sign-out) come from /api/session: all account types see search, trips, branches, own consignments and history. Management is shown only for management capabilities. Login defaults to management for planner/admin and search for the other roles; an explicit safe next path is preserved. Actions outside actor capability/scope are absent. Authorized actions whose prerequisites are unmet appear disabled with Thai reasons in a collapsed panel. The server independently validates transitions, quantities, ownership, versions and audit.

Contact visibility remains master.branches.read + GLOBAL/assigned BRANCH, and master.drivers.read + GLOBAL/own DRIVER. Consignment form options redact other branches' contacts but can indicate that a stored recipient is available; the server snapshots the stored contact on approval. Labels, QR, files, exports and manifests retain their own capability and row predicates.

Master maintenance requires master.<kind>.read/write/delete/export and matching row scope. Planning requires GLOBAL plus its corresponding capability. History remains immutable and MySQL/InnoDB/utf8mb4 is unchanged. No migration was added.

## Account setup

Normal operation (D223): the administrator creates, changes, disables and re-enables accounts and issues temporary passwords at /admin/users. Requires identity.manage plus GLOBAL; one type per account; server-validated scope per type; accounts are disabled, never deleted; every change is audited; administrators cannot lock themselves out and at least one active administrator must remain. The runtime database account has INSERT/UPDATE on User, INSERT on AuthAccount and INSERT/DELETE on UserRole/UserScope for this, and no DELETE on User or history.

Operator tooling below remains for first installation and local development only.


Operator provisioning may include departmentId alongside the primary GLOBAL/BRANCH/WAREHOUSE/DRIVER scope. Existing local accounts can receive an audited department with npm run auth:account:local using an ignored .local/auth request with action assign-department, email, departmentId and reason. This is operator-only tooling, not a request-handler bypass. npm run auth:sync:local installs the new predefined capabilities and assigns the synthetic operations department only to nine known active development accounts; requester marketing membership and passwords are preserved.

Regression evidence: [access-policy verification](evidence/access-policy/VERIFICATION.md). Historical Phase 3–7 policy descriptions and D209 are superseded where they conflict with D215/D216; D233 supersedes the assigned-department prerequisite in D216 only.

Back-office listing (D218, 2026-10-06): `backofficeAreas()` in `src/lib/navigation.ts` decides which back-office areas an account sees (work vs reference) and whether the header shows "จัดการหลังบ้าน". It is presentation only; every route keeps its own server check.
