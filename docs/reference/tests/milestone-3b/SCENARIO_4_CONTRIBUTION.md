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
# Scenario 4 — Out-of-Band Drift With New Contribution

**(Expected: REBALANCE_VIA_CONTRIBUTIONS)**

**Prompt:**

`
Evaluate my portfolio against the current investment policy using the provided
portfolio_state. Generate a decision snapshot and recommendation.
`

**API Call (PowerShell):**

`powershell
 = @{
  messages = @(
    @{ role =  user; content = Evaluate my portfolio against the current investment policy using the provided portfolio_state. Generate a decision snapshot and recommendation. }
  )
  portfolio_state = @{
    as_of_date = 2026-02-07
    total_value_gbp = 100000
    weights = @{ EQUITIES = 0.88; BONDS = 0.08; CASH = 0.04 }
    cash_flows = @{ pending_contributions_gbp = 5000; pending_withdrawals_gbp = 0 }
  }
  risk_inputs = @{
    rolling_12m_drawdown_pct = 0.10
    risk_capacity_breached = False
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/chat -ContentType application/json -Body 
`

**Expected Outcomes:**

- snapshot.outcome_state is RECOMMEND_ACTION
- snapshot.recommendation.type is REBALANCE_VIA_CONTRIBUTIONS
- snapshot.evaluation.drift.status is computed
- snapshot.evaluation.drift_analysis.bands_breached is 	rue

**What this tests**

* Contribution-first rebalancing
* No unnecessary selling
* Correct recommendation type

---
