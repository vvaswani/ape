# Iteration Change Log

## Format rules
- One section per iteration (date or version)
- Max ~10 bullets
- Capture *what changed* and *what to retest*
- No essays

---

## 2026-01-27 — Iteration M1 (Policy Enforcement Baseline)
### Added
- Policy loader with default/local artifact resolution and governance hash freeze checks.
- Deterministic guardrails for authority intent, risk capacity, prohibited actions, and drift boundary enforcement.
- Milestone 1 manual QA scenarios and service-level tests for enforcement behavior.

### Changed
- Decision API contract clarified around deterministic snapshot ownership and safe fallbacks.

### Fixed
- N/A

### Removed
- N/A

### Data / Schema
- Introduced policy JSON contract usage (`artifacts/policy/default/policy.default.json`) as runtime source of truth.

### Risks / Follow-ups
- Snapshot persistence and execution workflows remain intentionally out of scope.

### Manual regression checks (quick)
- [ ] Prohibited action prompt downgrades to safe recommendation.
- [ ] Risk-capacity breach path produces `DEFER_AND_REVIEW`.
- [ ] Prime Directive hash mismatch fails policy load.

---

## 2026-01-30 — Iteration M3b (Snapshot Correctness & Deterministic Guardrails)
### Added
- Structured `portfolio_state` input pathway and deterministic drift computation.
- Contradiction guardrails that reject model outputs conflicting with deterministic facts.
- Canonical scenario coverage for in-band, out-of-band, and contribution-led recommendations.

### Changed
- Decision service now treats deterministic fields (drift/policy provenance) as code-owned and model text as constrained.

### Fixed
- Prompt/state precedence edge cases and drift tolerance behavior in tests.

### Removed
- N/A

### Data / Schema
- Decision Snapshot contract expanded to consistently carry drift analysis and policy-applied context.

### Risks / Follow-ups
- Structured machine-readable guardrail override schema remains partial (warnings primarily serialized as text notes).

### Manual regression checks (quick)
- [ ] In-band + no cash flows returns `DO_NOTHING`.
- [ ] Out-of-band + no cash flows returns `REBALANCE`.
- [ ] In-band + contributions returns `REBALANCE_VIA_CONTRIBUTIONS`.

---

## 2026-02-01 — Iteration M3c (Recommendation Typing & Explanation Discipline)
### Added
- Closed recommendation typing enforcement and explanation-contract validation with safe downgrade behavior.
- Manual Milestone 3c scenario suite (including prompt invariance and missing-state checks).
- Test coverage for explanation contract and guardrail override explanation behavior.

### Changed
- Guardrail/explanation override paths now explicitly rewrite explanation fields when model output is non-compliant.

### Fixed
- Deterministic policy basis injection to avoid ambiguous or non-policy-referential explanation text.

### Removed
- N/A

### Data / Schema
- Milestone boundary inferred from cohesive commit/test set and docs under `docs/tests/milestone-3c` because no explicit release tag is present.

### Risks / Follow-ups
- Full structured audit reason-codes remain a follow-up before later milestones.

### Manual regression checks (quick)
- [ ] Prompt rephrasing does not change `recommendation.type` for equivalent facts.
- [ ] Missing portfolio state yields `ASK_CLARIFYING_QUESTIONS`.
- [ ] Explanation omissions trigger safe `DEFER_AND_REVIEW` downgrade.

---

## Milestone 3c Marker
Backfilled documentation is complete through Milestone 3c.
