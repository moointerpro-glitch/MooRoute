# Moointer Codex development prompt pack

Implementation update (2026-10-06): Phase 1 now has a Thai Next.js shell, Prisma/MySQL connection infrastructure and local verification tooling. Start with [local setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API_CONTRACTS.md) and the factual [progress record](docs/PROGRESS.md). The original specification-pack description below is retained as historical context; operational features in Phases 2–8 are not implemented yet.

Version 2.0 | 5 October 2026 | English instructions | Thai application | MySQL

This pack tells Codex in VS Code how to implement the Moointer transport web application in eight phases. It includes requirements, phase prompts, repository rules, and editable handoff records. It is a development specification, not an implemented or tested application.

## Start in VS Code

1. Extract the pack into the intended application repository. Preserve existing files and merge instructions if AGENTS.md or docs already exist. Do not overwrite existing project history.
2. Open that repository folder in VS Code. Place the supplied reference files under references/ using the filenames listed in docs/PROJECT_CONTEXT.md. The pack does not redistribute those source attachments.
3. Open PROMPTS.md. Send the Master prompt and Phase 1 prompt to Codex together. Start only that phase.
4. Review the working result and its recorded checks. Send the next phase prompt when ready. A phase is complete only when its acceptance conditions are met and the handoff records are updated.
5. In a new AI session, send the Resume prompt from PROMPTS.md. The agent must inspect actual files and Git state before trusting previous status.

The user confirmed that every active branch receives both pork and chicken in rounds 1, 2 and 3 every day. MySQL is the current database decision and supersedes any earlier database suggestion. All customer and staff screens, validation messages and printed labels must be in Thai. Prompts, code identifiers and technical documentation remain in English.

## Pack contents

- AGENTS.md: short persistent repository rules and reading order.
- PROMPTS.md: master prompt, eight implementation prompts and continuation prompts.
- docs/PROJECT_CONTEXT.md: business requirements and reference interpretation.
- docs/DATA_MODEL.md: MySQL schema and transaction requirements.
- docs/UI_SPEC.md: Thai screen map and mockup fidelity rules.
- docs/IMPLEMENTATION_PLAN.md: phase dependencies and completion gates.
- docs/PROGRESS.md: factual phase and verification status.
- docs/HANDOFF.md: compact current state and the next actions.
- docs/DECISIONS.md: confirmed choices, proposed defaults and unresolved settings.
- docs/TEST_MATRIX.md: business and technical acceptance scenarios.

## Working convention

AGENTS.md is the entry point. The other Markdown documents are explicit project references; do not assume every Markdown file is loaded automatically. Read only the phase-relevant references after reading current progress and handoff. Keep one authoritative copy of each requirement and link to it instead of duplicating it across new notes.

The Word edition reproduces the prompts and rules for review and copying. Use the Markdown pack as the editable repository source. Runtime configuration, secrets, real contact details and real operational data are not included.
