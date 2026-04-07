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

# Reference Docs

This folder contains generated or supporting reference material.

## API Type Reference

Generated via TypeDoc from `agent/lib/domain/*`:

```bash
cd agent
npm run docs:api
```

Output is written to `docs/reference/api/` and is not committed to Git.
