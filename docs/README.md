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
Index only. This file must not be treated as authoritative.

# Docs Index

## Core
- `ARCHITECTURE.md` — system overview, invariants, core flows. Update when boundaries or invariants change.
- `CHANGELOG.md` — iteration change log. Update per iteration or release.
- `decisions/README.md` — ADR index and rules. Update when a decision is recorded.
- Only the three core docs above are authoritative.
- If a supporting doc conflicts with code or ADRs, treat it as outdated.

## Supporting
- `API.md` — Decision API contract. Update when request/response schema changes.
- API semantics live in `docs/API.md`.
- Type definitions live in generated docs at `docs/reference/api/` (run `cd agent && npm run docs:api`).
- `reference/tests/README.md` — Manual test scenarios by milestone. Update when scenarios or validation steps change.
- `../artifacts/README.md` — Policy artifact usage and precedence. Update when policy structure changes.
- `../artifacts/policy/default/decision-principles-catalogue.md` — Decision Principles Catalogue (policy reference).
- `../artifacts/policy/default/decision-principles-catalogue.json` — Decision Principles Catalogue (machine-readable).
- `../artifacts/policy/default/decision-principles-catalogue.schema.json` — JSON schema for the catalogue.
- `../artifacts/policy/default/decision-principles-to-ipm-mapping.md` — Mapping of decision questions to IPM sections.
- Planning materials live in `planning/archive/` and are non-authoritative.
