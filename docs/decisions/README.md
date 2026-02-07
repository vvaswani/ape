# Decision Log (ADR-lite)

## What belongs here
Record decisions that change:
- architecture boundaries
- data model / contracts
- security posture
- integration approach
- major libraries/frameworks
- non-trivial abstractions

## What does NOT belong here
- code walkthroughs
- minor refactors
- formatting/lint choices
- “maybe someday” ideas

## Naming convention
- `ADR-0001-<short-title>.md`
- Keep titles action-oriented (e.g., `ADR-0003-use-supabase-for-auth.md`)

## Process
- Write at decision time
- Link from `docs/ARCHITECTURE.md` if it affects the system shape
- If it changes user-visible workflow, note it in `docs/CHANGELOG.md`
