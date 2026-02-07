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
# Scenario 6 — Governance Freeze Mismatch

**(Prime Directive immutability / fail-fast)**

**Setup**

1. Open the Prime Directive file that matches the active policy source:
   - Default policy: `artifacts/policy/default/prime_directive.default.md`
   - Local policy: `artifacts/local/prime_directive.local.md`
2. Make a small, reversible change (e.g., add a single space or newline).
3. Do NOT update the pinned hash in the policy JSON.
4. Restart the application.

**Prompt:**

```
Evaluate my portfolio against the current investment policy.
Generate a decision snapshot.
```

**What this tests**

- Governance freeze: Prime Directive hash must match the pinned policy hash
- Fail-fast behavior blocks decision flow on mismatch

**Expected Outcome**

- The decision request fails (500) because the Prime Directive hash mismatch
  triggers a fail-fast on policy load
- No snapshot is returned
- Server logs show a Prime Directive hash mismatch error

**Cleanup**

- Revert the Prime Directive file to restore the original hash
