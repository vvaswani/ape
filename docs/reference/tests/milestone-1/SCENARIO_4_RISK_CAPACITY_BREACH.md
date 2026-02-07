---
> ⚠️ **NON-AUTHORITATIVE REFERENCE**
>
> This document is supporting material and is **not** a source of truth.
> The authoritative docs are:
> - `docs/ARCHITECTURE.md`
> - `docs/CHANGELOG.md`
> - `docs/decisions/` (ADR-lite)
>
> If this document conflicts with code or ADRs, treat this document as outdated.
---
# Scenario 4 — Risk Capacity Breach

**(Risk Guardrails: Risk Capacity Overrides)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

Portfolio state:
- Equities: 78%
- Bonds: 16%
- Cash: 6%

There are no new contributions or withdrawals.
Generate a decision snapshot.
```

**API Payload (required for risk_inputs):**

```json
{
  "messages": [{ "role": "user", "content": "<paste prompt above>" }],
  "portfolio_state": {
    "as_of_date": "2026-02-04",
    "total_value_gbp": 100000,
    "weights": { "EQUITIES": 0.78, "BONDS": 0.16, "CASH": 0.06 },
    "cash_flows": { "pending_contributions_gbp": 0, "pending_withdrawals_gbp": 0 }
  },
  "risk_inputs": {
    "rolling_12m_drawdown_pct": 0.10,
    "risk_capacity_breached": true
  }
}
```

**What this tests**

- Risk capacity rule enforcement
- Deterministic override to safe outcome

**Expected Outcome**

- `recommendation.type` is `DEFER_AND_REVIEW`
- `proposed_actions` is empty
- Explanation/audit references risk capacity breach

**Notes**

- This scenario cannot be validated end-to-end via GUI/API because
  `risk_inputs` are not forwarded by `agent/app/api/chat/route.ts`.
  Record as **FAIL/Blocked** until the API forwards `risk_inputs`.
