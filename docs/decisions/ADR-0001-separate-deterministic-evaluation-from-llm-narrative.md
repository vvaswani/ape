# ADR-0001: Separate deterministic evaluation from LLM narrative generation

Date: 2026-01-30  
Status: Accepted

## Context
APE must produce policy-consistent recommendations where drift math and policy constraints are not vulnerable to prompt phrasing or model hallucination. Milestone 3b introduced structured `portfolio_state` and deterministic drift/guardrail evaluation.

## Decision
Treat deterministic portfolio evaluation (policy loading, drift math, contradiction checks, risk/authority guardrails) as service-owned logic, while restricting the LLM to recommendation/explanation text generation that is later validated and overrideable.

## Alternatives considered
- Option A — Let the model compute drift and choose actions end-to-end; rejected because this weakens repeatability and auditability.
- Option B — Remove model output entirely and use static templates only; rejected because explanation quality/flexibility requirements still need generated narrative.

## Trade-offs (accepted)
- Pros:
  - Repeatable, testable recommendation typing under equivalent facts.
  - Stronger policy adherence and safer failure behavior.
- Cons:
  - More orchestration complexity in service layer.
  - Additional maintenance burden for guardrail logic and tests.

## Consequences
- What changes immediately?
  - Decision service becomes the authority for policy/drift correctness and applies guardrail overrides on model output.
- What becomes harder later?
  - Expanding recommendation space requires coordinated updates to deterministic checks and explanation constraints.
- What must be monitored?
  - Guardrail override frequency and contradiction/fallback paths in logs/tests.

## Links
- Related commits: `7decfba`, `4e47677`, `834dade`.
- Evidence: `agent/lib/services/decisionService.ts`, `agent/lib/services/drift.ts`, `agent/lib/services/guardrails.ts`, `agent/lib/services/decisionService.test.ts`.
- Related docs: `docs/milestones/milestone-3b.md`, `docs/tests/milestone-3b/README.md`.
