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
# Scenario 2 — In-Band Drift, No Cash Flows

**(Expected: RECOMMEND_NO_ACTION)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

Portfolio state:
- As of date: 2026-02-07
- Total value: £100,000
- Weights: EQUITIES 78%, BONDS 16%, CASH 6%
- No pending contributions or withdrawals

Generate a decision snapshot and recommendation.
```

**API Call (PowerShell):**

```powershell
$body = @{ 
  messages = @(
    @{ role = "user"; content = "Evaluate my portfolio against the current investment policy. Portfolio state: As of date 2026-02-07. Total value: £100,000. Weights: EQUITIES 78%, BONDS 16%, CASH 6%. No pending contributions or withdrawals. Generate a decision snapshot and recommendation." }
  )
  portfolio_state = @{ 
    as_of_date = "2026-02-07"
    total_value_gbp = 100000
    weights = @{ EQUITIES = 0.78; BONDS = 0.16; CASH = 0.06 }
    cash_flows = @{ pending_contributions_gbp = 0; pending_withdrawals_gbp = 0 }
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/chat" -ContentType "application/json" -Body $body
```

**Expected Outcomes:**

- `snapshot.outcome_state` is `RECOMMEND_NO_ACTION`
- `snapshot.inputs_observed` includes portfolio state values
- `snapshot.inputs_missing` is empty or not present
- `snapshot.policy_items_referenced` includes at least one `dpq_id`
- `snapshot.warnings` and `snapshot.errors` are arrays

**What this tests**

* Snapshot created on a normal path
* Outcome states are explicit
* Policy provenance is recorded

---
