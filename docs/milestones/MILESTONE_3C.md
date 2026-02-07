# Milestone 3c — Policy Coverage & Input Hardening

## **Milestone name:** `Milestone 3c: Policy Coverage & Input Hardening`
**Goal:** Expand deterministic guardrails beyond band logic, harden runtime validation, and make guardrail decisions fully auditable.

### Scope

**In scope**

* Deterministic input validation:

  * validate `portfolio_state` at runtime before drift computation
  * reject malformed or incomplete state with safe `DEFER_AND_REVIEW`
* Policy constraint coverage (beyond bands):

  * explicit min/max ranges, asset class exclusions, cash minimums (if present in policy JSON)
* Action-policy coherence:

  * prevent BUY recommendations on overweight assets unless explicitly driven by contributions
  * prevent SELL recommendations when only contributions exist (and no withdrawals)
* Cash flow logic:

  * proposed actions must align with contributions/withdrawals when provided
* Guardrail provenance:

  * structured audit fields for overrides/warnings (not just a concatenated string)
* Schema hardening:

  * runtime validator (e.g., zod) for model JSON with clear error reporting

**Out of scope (explicit)**

* Persistence of snapshots
* Outcome tracking / review loop
* Monitoring/notifications
* Automated ingestion/normalization
* Execution/trade blotter exports

### Acceptance Criteria (exit conditions)

1. Invalid `portfolio_state` never reaches `computeDrift`; a safe `DEFER_AND_REVIEW` snapshot is returned.
2. Guardrails enforce all policy constraints present in the policy JSON (bands + any explicit ranges/exclusions/cash minima).
3. Proposed actions are coherent with policy weights and cash flow direction:

   * contributions-only ⇒ no SELL actions
   * withdrawals-only ⇒ no BUY actions
4. Guardrail overrides and warnings are recorded as structured fields in `snapshot.audit` (machine-readable).
5. Model JSON validation failures return a safe snapshot with a clear error reason logged.

### Suggested Issues (copy into GitHub)

* **3c-01** Add runtime `portfolio_state` validator (reject malformed or partial input)
* **3c-02** Extend guardrails to enforce min/max ranges and asset exclusions (if present)
* **3c-03** Enforce cash-flow direction rules on proposed actions
* **3c-04** Implement structured guardrail audit fields (override reason codes + warnings array)
* **3c-05** Add zod (or equivalent) validator for model JSON and surface validation errors
