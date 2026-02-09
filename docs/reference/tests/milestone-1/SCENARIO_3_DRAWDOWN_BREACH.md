---
> WARNING **NON-AUTHORITATIVE REFERENCE**
>
> This document is supporting material and is **not** a source of truth.
> The authoritative docs are:
> - `docs/ARCHITECTURE.md`
> - `docs/CHANGELOG.md`
> - `docs/decisions/` (ADR-lite)
>
> If this document conflicts with code or ADRs, treat this document as outdated.
---

# Scenario 3 - Drawdown Breach

**(Risk Guardrails: Drawdown Over Limit)**

**Prompt:**

```text
Evaluate my portfolio against the current investment policy and generate a decision snapshot.
```

**API Payload:**

```json
{
  "messages": [{ "role": "user", "content": "<paste prompt above>" }],
  "portfolio_state": {
    "as_of_date": "2026-02-04",
    "total_value_gbp": 100000,
    "weights": { "EQUITIES": 0.55, "BONDS": 0.35, "CASH": 0.10 },
    "cash_flows": { "pending_contributions_gbp": 0, "pending_withdrawals_gbp": 0 }
  },
  "risk_inputs": {
    "rolling_12m_drawdown_pct": 0.30,
    "risk_capacity_breached": false
  }
}
```

**What this tests**

- Risk guardrail enforcement for max rolling 12-month drawdown
- Deterministic override to safe outcome

**Expected Outcome**

- `recommendation.type` is `DEFER_AND_REVIEW`
- `proposed_actions` is empty
- `evaluation.risk_checks.drawdown_proximity` reflects breach against policy limit
- `evaluation.risk_checks.notes` mentions breach

**Notes**

- Use structured request fields for `portfolio_state` and `risk_inputs`.
