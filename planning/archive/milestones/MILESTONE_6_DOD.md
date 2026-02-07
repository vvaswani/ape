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
#TODO Review with 3c DoD definition
## Definition of Done 

Milestone 6 is done when:

* Decision flow is gated by data readiness
* Data quality outcome is explicit and auditable
* Blocked states never reach recommendation logic
* All data issues are visible in the snapshot
* No LLM is used for reconciliation
* All readiness states are exercised
* Evidence of blocked / degraded behaviour is captured
* No hallucinated assumptions are observed
* Snapshots fully document data quality decisions


If APE “guesses” missing data → **fail**.


