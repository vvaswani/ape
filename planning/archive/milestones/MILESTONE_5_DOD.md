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

Milestone 5 is done when:

* Decision snapshots are persisted immutably
* Outcomes can be recorded and retrieved
* Review prompts are policy-driven
* No downstream logic consumes outcomes yet
* Artefacts can be inspected without running the UI
* All acceptance checks pass
* Evidence of snapshots + outcomes is captured
* Review cadence behaviour is verified
* No unintended coupling with recommendation logic exists

If outcomes influence recommendations → **fail**.
