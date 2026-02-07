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
# Scenario 1 — Missing Portfolio State

**(Expected: CANNOT_DECIDE_MISSING_INPUTS)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

I have not provided my current portfolio weights or cash balances yet.
Please proceed according to policy and generate a decision snapshot.
```

**API Call (PowerShell):**

```powershell
$body = @{ 
  messages = @(
    @{ role = "user"; content = "Evaluate my portfolio against the current investment policy. I have not provided my current portfolio weights or cash balances yet. Please proceed according to policy and generate a decision snapshot." }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/chat" -ContentType "application/json" -Body $body
```

**Expected Outcomes:**

- `snapshot` is present
- `snapshot.outcome_state` is `CANNOT_DECIDE_MISSING_INPUTS`
- `snapshot.inputs_missing` is non-empty and each item includes `input_key` and `impact`
- `snapshot.warnings` and `snapshot.errors` are arrays of structured objects

**What this tests**

* Missing-input handling is explicit
* No silent failure when required data is absent
* Outcome state is deterministic

---
