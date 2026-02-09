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
# Scenario 5 — In-Band Drift but Tempting to Act

**(Guardrail: Override to DO_NOTHING / DEFER)**

**Prompt:**

`
Evaluate my portfolio against the current investment policy using the provided
portfolio_state. If action is not justified by policy, explicitly recommend
inaction. Generate a decision snapshot.
`

**API Call (PowerShell):**

`powershell
 = @{
  messages = @(
    @{ role =  user; content = Evaluate my portfolio against the current investment policy using the provided portfolio_state. If action is not justified by policy, explicitly recommend inaction. Generate a decision snapshot. }
  )
  portfolio_state = @{
    as_of_date = 2026-02-07
    total_value_gbp = 100000
    weights = @{ EQUITIES = 0.62; BONDS = 0.33; CASH = 0.05 }
    cash_flows = @{ pending_contributions_gbp = 0; pending_withdrawals_gbp = 0 }
  }
  risk_inputs = @{
    rolling_12m_drawdown_pct = 0.10
    risk_capacity_breached = False
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/chat -ContentType application/json -Body 
`

**Expected Outcomes:**

- snapshot.outcome_state is RECOMMEND_NO_ACTION
- snapshot.recommendation.type is DO_NOTHING
- snapshot.evaluation.drift.status is computed
- snapshot.evaluation.drift_analysis.bands_breached is alse

**What this tests**

* Guardrails overriding helpful but unnecessary action
* Discipline over optimisation theatre

---
