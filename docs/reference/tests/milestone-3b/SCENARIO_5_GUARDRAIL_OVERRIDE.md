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
# Scenario 5 — In-Band Drift but Tempting to Act

**(Guardrail: Override to DO_NOTHING / DEFER)**

**Prompt:**

```
Evaluate my portfolio against the current investment policy.

Portfolio state:
- Total value: £100,000
- Asset allocation:
  - Equities: 62%
  - Bonds: 33%
  - Cash: 5%

No new contributions.
No new withdrawals.

If action is not justified by policy, explicitly recommend inaction.
Generate a decision snapshot.
```

**What this tests**

* Guardrails overriding “helpful” but unnecessary action
* Discipline over optimisation theatre

---
