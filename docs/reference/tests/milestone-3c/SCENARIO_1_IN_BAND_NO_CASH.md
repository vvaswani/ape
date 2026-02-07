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
# Scenario 1 — In-Band, No Cash Flows

**(Expected: DO_NOTHING)**

**Prompt:**

```
Evaluate my portfolio against the policy.

Portfolio state:
- Equities: 78%
- Bonds: 16%
- Cash: 6%

No new contributions or withdrawals.
```

**What this tests**

* Deterministic type (DO_NOTHING)
* Explanation contract completeness
* Policy-referential explanation

---
