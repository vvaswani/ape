# ADR-0003: Enforce closed recommendation types and explanation contract

Date: 2026-02-01  
Status: Accepted

## Context
Milestone 3c requires recommendation semantics to be stable and prompt-invariant, while explanations remain complete, policy-referential, and safe under model failures.

## Decision
Constrain recommendations to a closed enum and run model output through explanation-contract validation/override logic; when violated, downgrade to safe types (`DEFER_AND_REVIEW` or `ASK_CLARIFYING_QUESTIONS`) with explicit audit warnings.

## Alternatives considered
- Option A — Allow open-ended recommendation labels and free-form explanation text; rejected due to semantic drift and audit inconsistency.
- Option B — Enforce type only, skip explanation contract checks; rejected because misleading rationale can still bypass policy intent.

## Trade-offs (accepted)
- Pros:
  - Deterministic recommendation semantics resilient to prompt phrasing.
  - Safer failure behavior with explicit downgrade paths.
- Cons:
  - Possible increase in conservative/deferral outcomes.
  - Ongoing upkeep of contract validation rules as schema evolves.

## Consequences
- What changes immediately?
  - Non-compliant explanation content is overridden and recorded with warnings.
- What becomes harder later?
  - Expanding explanation schema requires coordinated validator and test updates.
- What must be monitored?
  - Frequency of explanation-contract overrides and prompt invariance regressions.

## Links
- Related commits: `8b53e87`, `df4ec33`, `d0485ac`, `1c5a7f8`.
- Evidence: `agent/lib/domain/decisionSnapshot.ts`, `agent/lib/services/decisionService.ts`, `agent/lib/services/decisionService.test.ts`, `docs/reference/tests/milestone-3c/README.md`, `docs/reference/tests/milestone-3c/SCENARIO_5_PROMPT_INVARIANCE.md`.
- Related docs: `planning/archive/milestones/MILESTONE_3C.md`, `planning/archive/milestones/MILESTONE_3C_DOD.md`.
