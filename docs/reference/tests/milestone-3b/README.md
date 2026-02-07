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
# Milestone 3b — Manual Test Scenarios  
**Decision Snapshot Correctness & Guardrails**

---

## Purpose

This folder contains **manual acceptance test scenarios** for **Milestone 3b** of the  
**AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**.

Milestone 3b focuses on ensuring that:

- Decision Snapshots are always produced
- Snapshots are **policy-aligned and deterministic**
- Guardrails override model output when required
- Recommendation **type** is deterministic; the LLM supplies explanation text only
- “Do nothing” and “defer” outcomes are first-class, valid results

These scenarios are executed **manually via the GUI** and are intended to be
**promotable to automated tests** in later milestones.

---

## Scope (What Is Tested)

Included in scope:

- Snapshot generation
- Drift calculation and band breach detection
- Recommendation type correctness
- Guardrail enforcement
- Policy provenance and transparency

Explicitly out of scope:

- Trade execution
- Performance attribution
- Persistence or outcome tracking
- Monitoring or automation loops

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
| 1 | Missing portfolio state | `ASK_CLARIFYING_QUESTIONS` |
| 2 | In-band drift, no cash flows | `DO_NOTHING` |
| 3 | Out-of-band drift, no cash flows | `REBALANCE` |
| 4 | Out-of-band drift with contribution | `REBALANCE_VIA_CONTRIBUTIONS` |
| 5 | In-band drift but tempting to act | `DO_NOTHING` or `DEFER_AND_REVIEW` |

---

## Common Validation Checklist (All Scenarios)

For every scenario, confirm:

- A **Decision Snapshot** is produced (no silent failure)
- `snapshot_id`, `created_at`, and `snapshot_version` are populated
- `governance.investment_policy` reflects the loaded policy (id + version)
- `evaluation.drift_analysis` is:
  - populated when portfolio_state is provided
  - omitted or null when portfolio_state is missing
- `bands_breached` is:
  - `true` or `false` when drift is evaluated
  - never inferred or guessed
- `recommendation.type` matches the scenario expectation
- Any override by guardrails is clearly explained

---

## Notes on Guardrails

These scenarios deliberately include cases where:

- the model might be tempted to “help”
- deterministic logic must override model output
- inaction is the correct and explicit outcome

If the snapshot output violates a scenario expectation,  
**Milestone 3b is not complete**.

---

## Versioning

- This test suite corresponds to **Milestone 3b**
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
| 2026-01-30 | Scenario 1 — Missing portfolio state | PASS | Asked clarifying questions due to missing state |
| 2026-02-01 | Scenario 2 — In-band drift, no cash flows | PASS | Verified form/prompt precedence and deterministic DO_NOTHING |

---
