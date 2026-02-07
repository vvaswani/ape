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

# ✅ Definition of Done (Milestone 4)

Milestone 4 is **done** when:

* A compiled policy JSON is generated deterministically from IPM
* All missing or conflicting policy elements are surfaced explicitly
* Decision API refuses to run without a valid compiled policy
* No defaults are invented silently
* Policy provenance is traceable in logs and snapshots
* Artefacts exist on disk and are reviewable without running the app

If any decision can be made without a compiled policy → **Milestone not done**.
