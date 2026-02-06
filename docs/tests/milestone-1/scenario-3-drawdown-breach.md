# Scenario 3 — Drawdown Breach

**(Risk Guardrails: Drawdown Over Limit)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

Portfolio state:
- Equities: 55%
- Bonds: 35%
- Cash: 10%

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

- Risk guardrail enforcement for max rolling 12m drawdown
- Deterministic override to safe outcome

**Expected Outcome**

- `recommendation.type` is `DEFER_AND_REVIEW`
- `proposed_actions` is empty
- Explanation/audit references risk guardrail breach

**Notes**

- This scenario cannot be validated end-to-end via GUI/API because
  `risk_inputs` are not forwarded by `agent/app/api/chat/route.ts`.
  Record as **FAIL/Blocked** until the API forwards `risk_inputs`.
