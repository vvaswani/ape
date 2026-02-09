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

**(Expected: DO_NOTHING)**

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

Generate a decision snapshot and recommendation.
```

**What this tests**

* Correct drift calculation
* Bands respected
* “Do nothing” explicitly recommended
* Recommendation type is deterministic; LLM supplies explanation only

**Input precedence (testable cases)**

* **Case A — No state anywhere:** Form weights are empty (`null/null/null`) and the prompt has no equities/bonds/cash numbers → expect `ASK_CLARIFYING_QUESTIONS`.
* **Case B — Form only:** Form weights are complete (e.g., 0.78/0.16/0.06) and the prompt has no portfolio state → use form values; proceed deterministically.
* **Case C — Prompt only:** Form weights are empty (`null/null/null`) and the prompt includes equities/bonds/cash (e.g., 78%/16%/6%) → parse prompt; proceed deterministically.
* **Case D — Conflict:** Form weights are complete (e.g., 0.73/0.20/0.07) and the prompt includes different values (e.g., 75%/20%/5%) → return `ASK_CLARIFYING_QUESTIONS`.

---
