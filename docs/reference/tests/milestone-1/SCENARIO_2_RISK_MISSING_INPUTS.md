---
> ?? **NON-AUTHORITATIVE REFERENCE**
>
> This document is supporting material and is **not** a source of truth.
> The authoritative docs are:
> - docs/ARCHITECTURE.md
> - docs/CHANGELOG.md
> - docs/decisions/ (ADR-lite)
>
> If this document conflicts with code or ADRs, treat this document as outdated.
---
# Scenario 2 — Risk Inputs Missing

**(Risk Guardrails: Missing Inputs)**

**Prompt:**

`
Evaluate my portfolio against the current investment policy.

Portfolio state:
- Equities: 78%
- Bonds: 16%
- Cash: 6%

There are no new contributions or withdrawals.
Generate a decision snapshot.
`

**API Payload (risk_inputs intentionally omitted):**

`json
{
   messages: [{ role: user, content: <paste prompt above> }],
  portfolio_state: {
    as_of_date: 2026-02-04,
    total_value_gbp: 100000,
    weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
    cash_flows: { pending_contributions_gbp: 0, pending_withdrawals_gbp: 0 }
  }
}
`

**What this tests**

- Guardrail behavior when risk inputs are missing
- Deterministic override to safe fallback

**Expected Outcome**

- If portfolio state is provided and risk inputs are missing:
  - ecommendation.type becomes DEFER_AND_REVIEW
  - proposed_actions is empty
  - valuation.risk_checks.notes mentions missing risk inputs

**Notes**

- When testing via the API, omit portfolio details from the prompt and provide
  portfolio_state only in the request body. If the prompt includes portfolio
  state, the service may treat it as conflicting input and drop the structured
  state, resulting in ASK_CLARIFYING_QUESTIONS instead of the expected
  DEFER_AND_REVIEW.
