# Milestone 3b — Snapshot Correctness & Guardrails**

## **Milestone name:** `Milestone 3b: Snapshot Correctness & Deterministic Guardrails`
**Goal:** Ensure that given a policy + explicit portfolio_state, APE produces a **correct, complete, policy-consistent Decision Snapshot** every time, and safely rejects model outputs that contradict deterministic facts.

### Scope

**In scope**

* Enforce **portfolio_state contract** (manual/structured input, validated)
* Deterministic evaluation completeness:

  * actual weights populated when state exists
  * drift computed and included
  * bands breached = boolean (never null when state exists)
* Make policy application visible in snapshot (`policy_applied` section with targets/bands/guardrails)
* Constrain model role:

  * model may only produce recommendation + explanation + optional proposed_actions
  * model may **not** ask for weights if state exists
* Add contradiction handling:

  * if model output conflicts with deterministic facts/policy constraints → **discard** and fallback to safe recommendation
* Improve observability:

  * log policy provenance
  * log when fallback used (parse failure or contradiction)

**Out of scope (explicit)**

* Persistence of snapshots
* Outcome tracking / review loop
* Policy interpreter (markdown → JSON)
* Monitoring/notifications
* Execution/trade blotter exports
* Automated ingestion/normalization

### Acceptance Criteria (exit conditions)

1. If `portfolio_state` is provided, recommendation type is **never** `ASK_CLARIFYING_QUESTIONS`.
2. If `portfolio_state` is provided:

   * snapshot includes `evaluation.drift_analysis.actual_weights`, `absolute_drift`, and `bands_breached` as `true|false`.
3. Snapshot includes `evaluation.policy_applied` showing **targets**, **bands**, and **risk guardrails** used.
4. If deterministic facts say “no action” (e.g., no breach, no cashflows), model-generated trades are rejected and snapshot falls back to a safe type (`DO_NOTHING` or `DEFER_AND_REVIEW` with explanation).
5. Invalid model JSON never causes a 500; safe fallback snapshot returned.
6. Three canonical scenarios produce correct outcomes (manual smoke tests):

   * In-band, no cashflows → `DO_NOTHING`
   * Out-of-band, no cashflows → `PARTIAL_REBALANCE` or `FULL_REBALANCE` (per your rules)
   * In-band + contribution → `REBALANCE_VIA_CONTRIBUTIONS`

### Suggested Issues (copy into GitHub)

* **3b-01** Add portfolio_state validation (weights 0..1, sum ~1, required keys)
* **3b-02** Add `policy_applied` section to snapshot
* **3b-03** Enforce “no ASK when state exists” rule in code
* **3b-04** Add contradiction checks (recommendation/actions vs drift/bands/cashflows)
* **3b-05** Add smoke-test fixtures + manual runbook (3 scenarios)
* **3b-06** Improve logs: policy provenance + fallback reason codes

