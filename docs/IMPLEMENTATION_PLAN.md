# Implementation plan

Initial state: no application implementation is asserted by this pack. A phase may be marked Complete only with evidence for its acceptance conditions. If an existing repository already provides a feature, verify it before updating status.

| Phase | Outcome | Prerequisite | Completion evidence |
| --- | --- | --- | --- |
| 1 | Thai shell and MySQL development foundation | Repository inspection | Startup, connection, lint and type checks |
| 2 | Schema, migrations and core domain invariants | Phase 1 | Disposable MySQL migration, seed and invariant tests |
| 3 | Authentication and master administration | Phase 2 | CRUD, archive and permission checks |
| 4 | Routes, templates and daily planning | Phase 3 | Complete coverage, conflict and revision checks |
| 5 | Three-mode Thai route search | Phase 4 | Search semantics and responsive screenshots |
| 6 | Consignment lifecycle and receipts | Phases 3–5 | End-to-end shipment and concurrency checks |
| 7 | Labels, manifests and controlled imports | Phase 6 | Actual-scale print and import evidence |
| 8 | Release verification and operations | Phases 1–7 | Full matrix, build and restore rehearsal |

Each phase prompt is in PROMPTS.md. Phase 2 establishes core service contracts and tests; Phases 4 and 6 complete their operational workflows and user interfaces. Recheck the relevant invariants when integration changes them. A passing unit test alone is insufficient evidence for an end-to-end acceptance condition.

## Definition of done

- Requested behavior works through the Thai user flow and server boundary.
- Applicable authorization, validation, transactional and history invariants hold.
- Relevant checks pass on the intended environment, including MySQL where needed.
- No unresolved critical defect prevents the phase's intended use.
- Progress, changed decisions and handoff reflect observed reality.
- Synthetic fixtures and unfinished integrations are visibly identified.

## Handling unavailable prerequisites

Continue independent work without pretending the missing dependency exists. Record the exact blocker, affected acceptance conditions and how to reproduce it. A blocked database integration must not be labeled complete based on a UI mock. Proceed to another phase only if the user requests it and its actual prerequisites are satisfied.
