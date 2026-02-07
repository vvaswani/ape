# ADR-0002: Use file-based policy artifacts with governance hash freeze

Date: 2026-01-27  
Status: Accepted

## Context
APE needs a transparent, local-first policy source and tamper-evident governance linkage for early milestones, without introducing database persistence.

## Decision
Load policy from file artifacts using local-override-first resolution (`artifacts/local/policy.local.json`, then default policy), and enforce Prime Directive hash pin validation before policy is accepted.

## Alternatives considered
- Option A — Hardcode policy constants in application code; rejected due to poor governance traceability and update friction.
- Option B — Introduce a policy database/service now; rejected as premature complexity for current milestone scope.

## Trade-offs (accepted)
- Pros:
  - Human-readable policy and governance artifacts under version control.
  - Deterministic startup behavior with explicit failure on governance mismatch.
- Cons:
  - Operational dependence on filesystem layout.
  - No multi-tenant or runtime policy version management yet.

## Consequences
- What changes immediately?
  - Decision execution is blocked when policy artifacts or governance hash checks fail.
- What becomes harder later?
  - Migration to persisted/versioned policy storage needs compatibility planning.
- What must be monitored?
  - Policy load errors and hash mismatch incidents.

## Links
- Related commits: `736e43f`.
- Evidence: `agent/lib/infra/policyLoader.ts`, `agent/lib/infra/policyLoader.test.ts`, `artifacts/policy/default/policy.default.json`, `artifacts/policy/default/prime_directive.default.md`.
- Related docs: `docs/governance/PRIME_DIRECTIVE.md`.
