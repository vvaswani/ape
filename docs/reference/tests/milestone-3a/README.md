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
# Milestone 3a — Manual Test Scenarios  
**Decision Snapshot Foundation**

---

## Purpose

This folder contains **manual acceptance test scenarios** for **Milestone 3a** of the  
**AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**.

Milestone 3a focuses on ensuring that:
- A Decision Snapshot is always produced
- Outcome states are explicit and consistent
- Missing inputs are surfaced with impact
- Policy provenance is captured with DPQ references
- Warnings and errors are structured (not concatenated strings)

---

## Scope (What Is Tested)

Included in scope:
- Snapshot creation on every request
- Missing-input handling and evidence
- Policy provenance fields
- Structured warnings/errors

Explicitly out of scope:
- policy_applied (Milestone 3b)
- expanded guardrails and coherence rules (Milestone 3c)
- portfolio optimization or execution logic

---

## How to Use These Scenarios

1. Run **one scenario at a time**.
2. Use the **PowerShell API call** provided in each scenario file.
3. Inspect the **Decision Snapshot output**, not conversational text.
4. Verify the snapshot against the **Expected Outcomes** listed.
5. Record PASS/FAIL at the milestone level (e.g. in Plane.so).

Do **not** modify the prompts during testing.  
If a prompt needs to change, update the scenario file and version control it.

---

## Scenario Index

| Scenario | Description | Expected Outcome State |
|--------|-------------|------------------------|
| 1 | Missing portfolio state | `CANNOT_DECIDE_MISSING_INPUTS` |
| 2 | In-band, no cash flows | `RECOMMEND_NO_ACTION` |
| 3 | Policy provenance check | `RECOMMEND_NO_ACTION` |

---

## Common Validation Checklist (All Scenarios)

For every scenario, confirm:
- A **Decision Snapshot** is produced (no silent failure)
- `snapshot_id`, `created_at`, and `snapshot_version` are populated
- `outcome_state` is present and matches the scenario expectation
- `inputs_observed` is present and structured
- `inputs_missing` is present (empty allowed only if outcome is not missing-input)
- `policy_items_referenced` includes DPQ IDs when a decision is made
- `warnings` and `errors` are arrays of structured objects

---

## Versioning

- This test suite corresponds to **Milestone 3a**
- Scenarios may evolve as policy parameters change
- Any updates must be:
- committed to version control
- reflected in Plane milestone acceptance

---

## Test Run Log (manual)

Record manual test results here so milestone status is traceable.

| Date (YYYY-MM-DD) | Scenario | Result | Notes |
|---|---|---|---|
| 2026-02-08 | Scenario 1 — Missing portfolio state |  |  |
| 2026-02-08 | Scenario 2 — In-band, no cash flows |  |  |
| 2026-02-08 | Scenario 3 — Policy provenance check |  |  |

---
