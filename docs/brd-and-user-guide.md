
# APE — BRD & User Guide (Working Document)

## 1. Purpose

APE (AI Portfolio Decision Co-Pilot / Automated Portfolio Evaluator) exists to help a long-term investor make **sound, repeatable portfolio decisions** with **clarity, discipline, and an audit trail**.

APE is designed as **decision support**, not advice and not execution.

## 2. Problem Statement

Investors often make portfolio changes driven by noise, emotion, or incomplete information. Even when decisions are reasonable, they are rarely documented in a way that supports later review.

APE solves this by producing **Decision Snapshots**: structured records of the inputs, policy constraints, evaluation, recommendation, and explanation that can be audited later.

## 3. Guiding Principles (non-negotiable)

* **Policy-gated reasoning:** the policy is authoritative; recommendations that conflict with policy are invalid.
* **Deterministic compute:** portfolio math is computed by code, not by the LLM.
* **Explainability:** every recommendation requires rationale + assumptions + uncertainty.
* **Human accountability:** APE advises; the user decides. “Do nothing” is valid.
* **Safe failure:** missing/invalid inputs lead to defer/ask, not guesswork.

## 4. Scope (Current)

### In scope

* Manual/structured portfolio input (weights + cash flows)
* Deterministic drift calculation vs policy targets/bands
* Decision Snapshot generation and display
* Guardrails that reject contradictory model outputs

### Out of scope (by design)

* Trade execution
* Automated ingestion from brokers/platforms
* Monitoring/alerts
* Learning/adaptation
* Performance attribution
* Policy extraction from prose documents

## 5. Key Artefacts

### Investment Policy JSON

APE reads policy configuration from mounted artifacts:

* Local override: `/artifacts/local/policy.local.json`
* Default fallback: `/artifacts/policy/default/policy.default.json`

Policy controls:

* Target weights (SAA)
* Rebalancing bands
* Risk guardrails
* Prohibited actions

### Decision Snapshot

A Decision Snapshot is the canonical output of the system. It contains:

* Context (jurisdiction, currency, environment)
* Inputs (portfolio_state, cash_flows)
* Governance (policy provenance/version)
* Evaluation (targets, actuals, drift, band breaches)
* Recommendation (type, summary, proposed actions)
* Explanation (structured narrative)
* Audit metadata

## 6. Milestone 3b Rationale (Why this milestone exists)

Milestone 3a proved end-to-end wiring: policy load → deterministic drift → model explanation → snapshot output.

Milestone 3b exists to make the system **trustworthy**:

* If portfolio_state is present, the system must not “ask for weights”.
* Deterministic evaluation must be complete and visible in the snapshot.
* The LLM must not be allowed to override computed facts.
* Invalid or contradictory model outputs must degrade safely, never crash the API.

This milestone earns the right to add persistence and monitoring later. Without this, later “agentic” features would amplify errors.

## 7. User Guide (How to use APE today)

### Step 1 — Ensure policy is configured

* Default policy exists under artifacts
* Optionally create a local policy override for personal values
* Restart the container if you change artifacts mount paths

### Step 2 — Provide a portfolio state (manual)

You enter:

* as_of_date (YYYY-MM-DD)
* weights for EQUITIES / BONDS / CASH (decimals, e.g. 0.63)
* optional cash flows (pending contributions/withdrawals)

### Step 3 — Ask a decision question

Example:

* “Should I rebalance given this snapshot and policy?”
* “Direct my next contribution: where should it go?”

### Step 4 — Read the Decision Snapshot

Pay attention to:

* policy version/source
* whether bands were breached
* recommendation type and explanation
* any uncertainty disclosures

### Step 5 — If the system defers

APE will defer when:

* inputs are missing/invalid
* output parsing fails
* model output contradicts deterministic evaluation

This is intentional and conservative.

## 8. Glossary

* **SAA:** Strategic Asset Allocation (target weights)
* **Drift:** deviation between actual and target weights
* **Bands:** allowed drift thresholds before rebalancing triggers
* **Decision Snapshot:** structured record of decision inputs/evaluation/output


# Appendix

## Milestone #3b Guardrails: What to enforce

### Guardrail 1 — Portfolio state present ⇒ model cannot ask for weights

**Rule:** If `portfolio_state` exists, recommendation type **cannot** be `ASK_CLARIFYING_QUESTIONS`.

If it is, **override** to safe fallback:

* `DEFER_AND_REVIEW` (or `DO_NOTHING` if in-band and no cash flows)

---

### Guardrail 2 — Deterministic evaluation completeness

If `portfolio_state` exists, then all must be non-null:

* actual_weights
* absolute_drift
* bands_breached is boolean

If any are missing → treat as **system error** but still return safe snapshot:

* `DEFER_AND_REVIEW`
* explanation: “Evaluation incomplete; cannot recommend.”

This protects you from silent bugs.

---

### Guardrail 3 — In-band & no cash flows ⇒ no rebalance actions

If:

* `bands_breached === false`
* AND no pending contributions/withdrawals
  Then only valid types are:
* `DO_NOTHING` (preferred)
* `DEFER_AND_REVIEW`

If model outputs any rebalance type or proposes actions → override.

---

### Guardrail 4 — Out-of-band ⇒ must not return DO_NOTHING

If:

* `bands_breached === true`
  Then valid types are:
* `REBALANCE_VIA_CONTRIBUTIONS` (if contributions exist and can fix)
* `REBALANCE`
* `DEFER_AND_REVIEW` (only if constraints missing)

If model says `DO_NOTHING` → override to `DEFER_AND_REVIEW` with reason.

---

### Guardrail 5 — Proposed actions must be coherent

Even in MVP:

* asset_class must be one of policy asset classes
* amount must be null or > 0
* action must be BUY/SELL/HOLD
* If `bands_breached === false` and no contributions → actions must be `[]`

If actions violate these, drop them (set `[]`) and downgrade to `DEFER_AND_REVIEW`.

---
