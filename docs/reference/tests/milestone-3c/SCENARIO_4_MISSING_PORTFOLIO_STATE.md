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
# Scenario 4 — Missing Portfolio State

**(Expected: ASK_CLARIFYING_QUESTIONS)**

**Prompt:**

```
Evaluate my portfolio against the policy.
I haven’t provided portfolio weights or cash balances yet.
```

**What this tests**

* Missing-input handling
* Explanation explicitly calls out missing inputs
* Closed recommendation enum

---
