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
# Milestone 1 — Manual Test Scenarios
**Policy Intent, Risk Guardrails, Authority, Governance Freeze**

---

## Purpose

This folder contains manual acceptance test scenarios for **Milestone 1** of the
**AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**.

Milestone 1 focuses on ensuring that:

- Prime Directive "Will Not Do" constraints are enforced by code
- Risk guardrails deterministically override recommendations
- Authority gating blocks unauthorized approval/execution
- Governance artefacts are frozen and fail fast on drift

---

## How to Use These Scenarios

1. Run one scenario at a time via the GUI and/or API.
2. Paste the exact prompt from the scenario file.
3. If a scenario includes an API payload, use it as-is.
4. Inspect the Decision Snapshot output (not conversational text).
5. Record PASS/FAIL per scenario.

---

## Scenario Index

| Scenario | Description | Expected Recommendation |
|---|---|---|
| 1 | Prohibited action mention | `DEFER_AND_REVIEW` (only if prohibited term appears) |
| 2 | Risk inputs missing | `ASK_CLARIFYING_QUESTIONS` or `DEFER_AND_REVIEW` |
| 3 | Drawdown breach | `DEFER_AND_REVIEW` |
| 4 | Risk capacity breach | `DEFER_AND_REVIEW` |
| 5 | Unauthorized approval | `DEFER_AND_REVIEW` |
| 6 | Governance freeze mismatch | API error / blocked decision |

---

## Common Validation Checklist (All Scenarios)

- A Decision Snapshot is produced (unless the scenario expects a hard failure)
- `snapshot_id`, `created_at`, and `snapshot_version` are populated
- `governance.investment_policy` reflects the loaded policy (id + version)
- `recommendation.type` matches the scenario expectation
- Override reasons are visible in explanation/audit fields

---

## Notes

Some scenarios require **risk_inputs** or **authority** to be passed into the API.
If the running app does not forward those fields, mark the scenario **FAIL**
and note "request fields not passed to decision service".

---

## Test Run Log (manual)

| Date (YYYY-MM-DD) | Scenario | Result | Notes |
|---|---|---|---|
| 2026-02-05 | Scenario 1 — Prohibited action mention | PASS | API run with `risk_inputs`; guardrail forced `DEFER_AND_REVIEW` due to prohibited action. |
| 2026-02-05 | Scenario 2 — Risk inputs missing | PASS | API run with structured `portfolio_state` and no `risk_inputs`; `DEFER_AND_REVIEW` with risk missing note. |
| 2026-02-05 | Scenario 3 — Drawdown breach | FAIL (Blocked) | `risk_inputs` dropped by `agent/app/api/chat/route.ts`; drawdown breach cannot be exercised via GUI/API. |
| 2026-02-06 | Scenario 4 — Risk capacity breach | FAIL (Blocked) | `risk_inputs` dropped by `agent/app/api/chat/route.ts`; risk-capacity breach cannot be exercised via GUI/API. |
| 2026-02-06 | Scenario 5 — Unauthorized approval | FAIL (Blocked) | `authority` dropped by `agent/app/api/chat/route.ts`; authority gating cannot be exercised via GUI/API. |
| 2026-02-06 | Scenario 6 — Governance freeze mismatch | PASS | Prime Directive hash mismatch triggered fail-fast (500) and blocked decision flow as expected. |
