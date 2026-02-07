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
# Scenario 3 — Out-of-Band Equity Overweight, No Cash

**(Expected: REBALANCE)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

Portfolio state:
- Total value: £100,000
- Asset allocation:
  - Equities: 88%
  - Bonds: 8%
  - Cash: 4%

There are no new contributions or withdrawals.

Generate a decision snapshot and recommendation.
```

**What this tests**

* Band breach detection
* Rebalance recommendation justified by risk control
* No reliance on cash flows

---
