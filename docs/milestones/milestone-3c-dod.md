# Milestone 3c — Definition of Done

**Recommendation Typing & Explanation Discipline**

---

## Milestone Intent (non-negotiable)

Milestone 3c is complete **only when** every Decision Snapshot:

> says *only what it is allowed to say*,
> in a *fixed, policy-grounded language*,
> and cannot be made misleading by prompt phrasing or model creativity.

This milestone **locks semantics**. No new intelligence is added.

---

## 1. Recommendation Typing (Hard Requirement)

### 1.1 Closed Recommendation Vocabulary

✅ **DONE WHEN:**

* `recommendation.type` is restricted to a **closed enum**, e.g.:

  * `DO_NOTHING`
  * `REBALANCE`
  * `REBALANCE_VIA_CONTRIBUTIONS`
  * `ASK_CLARIFYING_QUESTIONS`
  * `DEFER_AND_REVIEW`
* Any value outside this set is:

  * rejected, or
  * downgraded to a safe fallback (`DEFER_AND_REVIEW`)

❌ **NOT DONE IF:**

* the LLM can invent new recommendation types
* free-text recommendations bypass the enum

---

## 2. Deterministic Mapping: Facts → Type

### 2.1 Recommendation Type Is Computed, Not Suggested

✅ **DONE WHEN:**

* Recommendation type is determined **before** explanation generation
* Inputs to this decision are limited to:

  * policy
  * drift result
  * cash flows
  * guardrail state
* The LLM **cannot override** the computed type

❌ **NOT DONE IF:**

* explanation text implies a different action than the type
* the LLM selects the recommendation type implicitly

---

## 3. Explanation Contract Enforcement

### 3.1 Required Explanation Sections per Type

Each `recommendation.type` has a **mandatory explanation structure**.

Example (illustrative):

| Type                     | Required Sections                                           |
| ------------------------ | ----------------------------------------------------------- |
| DO_NOTHING               | decision_summary, policy_basis, drift_summary               |
| REBALANCE                | decision_summary, band_breach, policy_basis, tradeoff_notes |
| ASK_CLARIFYING_QUESTIONS | missing_inputs, why_required                                |

✅ **DONE WHEN:**

* All required sections are present
* No extra speculative sections appear
* Missing sections cause rejection or downgrade

❌ **NOT DONE IF:**

* explanations vary unpredictably
* “helpful” narrative replaces structured justification

---

## 4. Policy-Referential Explanations

### 4.1 Explanations Must Cite Actual Policy Values

✅ **DONE WHEN:**

* Explanations reference:

  * actual target weights
  * actual rebalancing bands
  * actual guardrails
* Referenced values **match the loaded policy**

❌ **NOT DONE IF:**

* explanations use generic phrases (“within tolerance”)
* numbers appear that are not traceable to policy

---

## 5. Guardrail-Driven Overrides Are Explained

### 5.1 Guardrail Overrides Are Explicit

✅ **DONE WHEN:**

* If guardrails override action:

  * explanation explicitly states **why**
* Example:

  > “Although drift exists, policy bands are not breached; therefore no action is recommended.”

❌ **NOT DONE IF:**

* inaction is implied but not justified
* guardrail logic is invisible to the user

---

## 6. Uncertainty Disclosure (Mandatory)

### 6.1 Uncertainty Is Explicit, Not Implied

✅ **DONE WHEN:**

* Missing or inferred inputs are explicitly disclosed
* Confidence level is stated when required
* The system prefers:

  * `ASK_CLARIFYING_QUESTIONS`
  * or `DEFER_AND_REVIEW`
    over guesswork

❌ **NOT DONE IF:**

* the system “fills in the blanks”
* explanations sound confident without data

---

## 7. Prompt Invariance (Critical)

### 7.1 Prompt Phrasing Cannot Change Meaning

✅ **DONE WHEN:**

* Rewording the user prompt:

  * does **not** change recommendation type
  * does **not** alter explanation structure
* Scenario 2 (in-band drift) **always** yields `DO_NOTHING`

❌ **NOT DONE IF:**

* persuasive or emotional prompts cause action
* conversational tone influences outcome

---

## 8. Snapshot Integrity

### 8.1 Snapshot Is Self-Consistent

✅ **DONE WHEN:**

* `recommendation.type`
* `evaluation`
* `explanation`

are mutually consistent and non-contradictory.

❌ **NOT DONE IF:**

* explanation suggests rebalancing but type is `DO_NOTHING`
* explanation contradicts drift analysis

---

## 9. Failure Behaviour

### 9.1 Safe Failure Is the Default

✅ **DONE WHEN:**

* Explanation contract violations result in:

  * rejection, or
  * downgrade to safe type
* Failures are visible, not silent

❌ **NOT DONE IF:**

* partial explanations are emitted
* the system “does its best” silently

---

## Final Acceptance Statement

Milestone **3c is DONE** when:

> For every Decision Snapshot,
> the recommendation type is deterministic,
> the explanation is constrained,
> policy-referential,
> and immune to prompt manipulation.

Only after this is true does it make sense to:

* interpret policy (Milestone 4)
* store memory (Milestone 5)
* add agents (Milestone 6)

