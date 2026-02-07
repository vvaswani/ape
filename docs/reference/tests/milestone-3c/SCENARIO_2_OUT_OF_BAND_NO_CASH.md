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
# Scenario 2 — Out-of-Band, No Cash Flows

**(Expected: REBALANCE)**

**Prompt:**

```
Evaluate against policy.

Portfolio state:
- Equities: 90%
- Bonds: 8%
- Cash: 2%

No new cash flows.
```

**What this tests**

* Deterministic type (REBALANCE)
* Explanation contract completeness
* Policy-referential explanation

---
