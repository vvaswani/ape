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
# Milestone 3c — Manual Test Scenarios  
**Recommendation Typing & Explanation Discipline**

---

## Purpose

This folder contains **manual acceptance test scenarios** for **Milestone 3c** of the  
**AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**.

Milestone 3c focuses on ensuring that:

- Recommendation types are **closed, deterministic, and immutable**
- Explanations are **complete, policy-referential, and non-speculative**
- Prompt phrasing cannot change meaning (prompt invariance)
- Invalid or incomplete explanations downgrade to safe defaults

These scenarios are executed **manually via the GUI** and are intended to be
**promotable to automated tests** in later milestones.

---

## Scope (What Is Tested)

Included in scope:

- Closed recommendation enum enforcement
- Deterministic type computation
- Explanation contract completeness
- Policy-referential explanations
- Safe downgrade behavior

Explicitly out of scope:

- New recommendation types
- UX polish or narrative style improvements
- Optimisation logic
- Learning or adaptation

---

## How to Use These Scenarios

1. Run **one scenario at a time** via the GUI.
2. Paste the **exact prompt** from the scenario file.
3. Inspect the **Decision Snapshot output**, not conversational text.
4. Verify the snapshot against the **Expected Outcomes** listed.
5. Record PASS/FAIL at the milestone level (e.g. in Plane.so).

Do **not** modify the prompts during testing.  
If a prompt needs to change, update the scenario file and version control it.

---

## Scenario Index

| Scenario | Description | Expected Recommendation |
|--------|-------------|-------------------------|
| 1 | In-band, no cash flows | `DO_NOTHING` |
| 2 | Out-of-band, no cash flows | `REBALANCE` |
| 3 | In-band with contribution | `REBALANCE_VIA_CONTRIBUTIONS` |
| 4 | Missing portfolio state | `ASK_CLARIFYING_QUESTIONS` |
| 5 | Prompt invariance (emotional tone) | `DO_NOTHING` |

---

## Common Validation Checklist (All Scenarios)

For every scenario, confirm:

- `recommendation.type` is one of the approved enum values
- Explanation includes **all required fields** for the type
- Explanation references **actual policy values** (targets + bands)
- Explanation does **not** contradict drift or guardrails
- Missing inputs are explicitly disclosed (when applicable)

---

## Notes on Explanation Discipline

These scenarios deliberately include cases where:

- The model could be “helpful” but must stay constrained
- Deterministic types must override prompt tone or creativity
- Inaction must be explicitly justified

If the snapshot output violates a scenario expectation,  
**Milestone 3c is not complete**.

---

## Versioning

- This test suite corresponds to **Milestone 3c**
- Scenarios may evolve as policy parameters change
- Any updates must be:
  - committed to version control
  - reflected in Plane milestone acceptance

---

## Promotion Path

These manual scenarios are expected to map **1:1** to future automated tests:

- Prompt → test fixture input
- Expected outcome → assertion set
- Snapshot fields → structured validation

No scenario here should be discarded without an explicit replacement.

---

## Test Run Log (manual)

Record manual test results here so milestone status is traceable.

| Date (YYYY-MM-DD) | Scenario | Result | Notes |
|---|---|---|---|
| 2026-02-01 | Scenario 1 — In-band, no cash flows | PASS |  |
| 2026-02-01 | Scenario 2 — Out-of-band, no cash flows | PASS |  |
| 2026-02-01 | Scenario 3 — In-band with contribution | PASS |  |
| 2026-02-01 | Scenario 4 — Missing portfolio state | PASS |  |
| 2026-02-01 | Scenario 5 — Prompt invariance | PASS |  |

---
