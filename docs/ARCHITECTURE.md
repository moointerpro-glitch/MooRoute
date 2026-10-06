# Application architecture

Implemented 2026-10-06. A modular monolith using the Next.js App Router, TypeScript, Tailwind CSS and Prisma's MySQL provider. Phase 1 provides the Thai shell; Phase 2 adds relational entities and tested server domain transactions; Phase 3 adds local-account authentication, persisted scope policies and Thai master administration. Daily planning/consignment operational screens remain later phases.

## Phase 3 access and write boundary

Better Auth 1.7.7 with the Prisma mysql adapter owns password verification and database sessions. `src/server/auth/config.ts` permits only the explicit local-account environment and loopback origin. Public auth routes allow sign-in, sign-out and session lookup; unsupported endpoints are closed. No production authentication fallback or actor-from-body bypass exists. Current master API routes derive the active actor from the signed session and resolve capability/scope again inside service transactions. See [actual matrix](PERMISSIONS.md).

`masters.ts` uses a static entity/field allowlist, parameterized values, shared eligibility serialization, sorted vehicle locking, optimistic versions and idempotency. Dynamic SQL identifiers originate only from repository definitions. Lists/counts/export share row scope; deletes with retained dependencies archive instead, while changes affecting current operations or published eligibility reject atomically. Audit stores actor/reason/before/after in the same transaction.

Migration 003 adds authentication tables and missing master lifecycle metadata. Runtime grants now permit only implemented master tables, ephemeral auth tables, append-only audit, idempotency and eligibility version writes. Identity provisioning/role assignment remains local operator-only; web credentials have no migration/grant privileges. The prior Phase 2 read-only account state below is historical and superseded by these explicit Phase 3 grants. Private file/print handlers are not introduced; the common scoped resource policy is ready and tested for their future adapters.

## Boundaries

- `src/app`: server-rendered routes, Thai page metadata, loading/error/not-found boundaries and a minimal liveness endpoint.
- `src/components`: presentation and local interaction only. Search tabs and mobile navigation work; unavailable operational controls are disabled and explained in Thai.
- `src/lib/bangkok-date.ts`: explicit Bangkok service-date conversion and Buddhist-era display.
- `src/server/config`: validated connection input and safe error codes. No input value or underlying parser error is returned to a caller.
- `src/server/domain`: confirmed policy, six-cell coverage calculation, same-stop matching, safe Thai errors and explicit service-date/UTC conversion.
- `src/server/services`: database readiness, guarded draft/publication, branch eligibility, scoped same-stop reads and append-only receipt transactions. `transaction.ts` centralizes authorization, idempotency, lock order and bounded retries.
- `src/server/persistence`: server-only Prisma construction and process-local reuse. Development reloads reuse one client. CLI processes always disconnect.
- `scripts`: local environment lifecycle, safe operator migrations/seed/checks and a fresh-database integration runner. Test connections accept only separate loopback `moointer_test` or `moointer_test_run_<alphanumeric>` databases.
- `prisma`: MySQL schema and two forward migrations, including FK/CHECK constraints and immutable-history triggers. `tests/fixtures/synthetic.ts` contains explicitly synthetic seed and invalid scenarios.

Future business mutations must pass validated input, authenticated capability/row scope, domain services and persistence in that order. No operational API, authentication bypass or fabricated successful write is included. The public shell contains no operational records or contacts; backend navigation is absent until authorization exists.

## Database

Oracle MySQL Community 8.4.11 runs as a separate project-owned Windows process on `127.0.0.1:3307`, with InnoDB, utf8mb4 and `utf8mb4_0900_ai_ci`. XAMPP's MariaDB 10.4.32 on 3306 is not used or modified. The package named `@prisma/adapter-mariadb` is Prisma's documented MySQL driver adapter; this does not change the database product.

`moointer_dev` and `moointer_test` have separate generated credentials. The app account remains SELECT only while there are no authenticated mutation endpoints. The dedicated `moointer_migrate` operator identity owns development schema migrations; the test identity is scoped to disposable schemas. Neither operator identity is used by web requests. No reset command is provided. The project-owned native lab enables `log_bin_trust_function_creators` for trigger migrations; external servers require their administrator's migration policy.

## Phase 2 identity and consistency

See [design review](PHASE2_DESIGN.md), [field dictionary](FIELD_DICTIONARY.md), [ER diagram](ER_DIAGRAM.md) and [verification](evidence/phase-2/VERIFICATION.md). A stable Trip belongs to a DailyPlan service date; its immutable TripRevision belongs to a numbered PlanRevision. Assignments reference the exact stop revision as well as the stable trip. Publishing switches the daily plan pointer and reservations in one transaction, while retaining old revisions, assignments and snapshots.

All coverage-affecting services lock the global eligibility guard and stable daily plan. Vehicle locks are acquired in sorted ID order before a current locking overlap read. Receipts lock the consignment before calculating cumulative Decimal balances and appending history. Production modules export no unlocked reservation writer. Seed and direct persistence in integration fixtures are privileged test setup only. Changes to master eligibility outside these services are not supported.

CHECK constraints and triggers complement service validation; they do not replace the common write protocol. The global eligibility guard intentionally favors simple correctness over publication throughput in Phase 2. Future master/route/template mutation services must use this same guard protocol when creating versions or changing eligibility. No arbitrary SQL write API is available.

Remote connection URLs require `?ssl=true`, mapped to certificate verification. Loopback connections support MySQL caching_sha2_password public-key retrieval; remote public-key retrieval is disabled. Database diagnostics are CLI-only, with safe error codes and no connection URLs. Liveness does not check database readiness.

## UI and time

Self-hosted Noto Sans Thai 400/500/600/700 is supplied by a pinned Fontsource package; font assets are bundled locally with their upstream OFL license. No build-time Google Fonts dependency is required. Tokens are in `src/app/globals.css`, including red `#E60023`, white surfaces, gray background and 44px minimum interactive targets. A development text wordmark avoids inventing a brand asset.

The shell shows the current Bangkok service date, consistently formatted in Buddhist era. Unknown operational availability is shown as unavailable, not zero or the mockup's illustrative count 41. The three-round card states a business requirement, not evidence of published coverage. The default time basis is departure; selecting loading start never relabels it as departure.

## Dependency selection

Node 24.14.0 / npm 11.9.0 were installed on the machine. Direct dependencies are exact versions with a committed-ready lockfile: Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Tailwind 4.3.3 and Prisma 7.10.0. Prisma 8 was a release candidate in the registry during setup, so the stable 7.x line was selected. Node 24 meets both framework requirements; TypeScript 5.9 stays within the selected lint tooling's supported range.

ESLint 10.12.0 uses TypeScript ESLint 8.71.1, Next's 16.3.8 plugin and React Hooks 7.1.1 directly. The initial Next ESLint preset pulled React plugins without ESLint 10 peer support; the explicit compatible configuration avoids forcing peer mismatches.

Scoped overrides pin the MariaDB connector to 3.5.4, mysql2 to 3.24.5 and deepmerge-ts to 8.0.2 to address registry audit findings in upstream transitive pins. Client generation, validation, build and real MySQL checks verify these choices. See the Phase 1 verification record for the remaining lint-only advisory.

Primary references consulted during setup:

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Prisma 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements)
- [Prisma MySQL configuration and driver adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql)
- [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Oracle MySQL Community 8.4 downloads](https://dev.mysql.com/downloads/mysql/8.4.html)
- [MySQL Windows archive setup](https://dev.mysql.com/doc/refman/8.4/en/windows-install-archive.html)
