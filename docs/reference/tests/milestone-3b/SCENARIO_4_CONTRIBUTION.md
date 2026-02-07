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
# Scenario 4 — Out-of-Band Drift With New Contribution

**(Expected: REBALANCE_VIA_CONTRIBUTIONS)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

Portfolio state:
- Total value: £100,000
- Asset allocation:
  - Equities: 84%
  - Bonds: 11%
  - Cash: 5%

Cash flows:
- Planned contribution: £5,000
- No withdrawals

Generate a decision snapshot and recommendation.
```

**What this tests**

* Contribution-first rebalancing
* No unnecessary selling
* Correct recommendation type

---
