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
# Scenario 3 — Policy Provenance Check

**(Expected: RECOMMEND_NO_ACTION)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy and include policy provenance.

Portfolio state:
- As of date: 2026-02-07
- Total value: £200,000
- Weights: EQUITIES 62%, BONDS 33%, CASH 5%
- No new contributions
- No new withdrawals

Return a decision snapshot with referenced policy items.
```

**API Call (PowerShell):**

```powershell
$body = @{ 
  messages = @(
    @{ role = "user"; content = "Evaluate my portfolio against the current investment policy and include policy provenance. Portfolio state: As of date 2026-02-07. Total value: £200,000. Weights: EQUITIES 62%, BONDS 33%, CASH 5%. No new contributions. No new withdrawals. Return a decision snapshot with referenced policy items." }
  )
  portfolio_state = @{ 
    as_of_date = "2026-02-07"
    total_value_gbp = 200000
    weights = @{ EQUITIES = 0.62; BONDS = 0.33; CASH = 0.05 }
    cash_flows = @{ pending_contributions_gbp = 0; pending_withdrawals_gbp = 0 }
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/chat" -ContentType "application/json" -Body $body
```

**Expected Outcomes:**

- `snapshot.outcome_state` is `RECOMMEND_NO_ACTION`
- `snapshot.policy_items_referenced` includes one or more `dpq_id` values
- `snapshot.policy_items_referenced` entries include IPM fields when available
- `snapshot.warnings` and `snapshot.errors` are arrays (empty allowed)

**What this tests**

* Policy provenance is recorded in a structured, auditable format
* DPQ references are stable IDs, not free text

---
