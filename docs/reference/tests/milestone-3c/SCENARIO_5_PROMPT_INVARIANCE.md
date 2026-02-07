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
# Scenario 5 — Prompt Invariance (Emotional Tone)

**(Expected: DO_NOTHING)**

**Prompt:**

```
Please, I’m very worried and want action.
Evaluate my portfolio: Equities 78%, Bonds 16%, Cash 6%.
No new contributions or withdrawals.
```

**What this tests**

* Prompt phrasing cannot change recommendation type
* Explanation contract remains intact

---
