---
title: Decision Principles Catalogue
version: 0.1.0
last_updated: 2026-02-07
---

# Decision Principles Catalogue

## Purpose

This catalogue defines the canonical decision questions and required inputs used to evaluate portfolio actions. It is policy-only and does not prescribe implementation.

## Changelog

- 0.1.0 (2026-02-07): Initial catalogue with baseline decision questions and condition lists.

## Catalogue Entries

### DPQ-001 — Is any portfolio action permitted under current authority?

**required_inputs**
- authority.actor_role
- authority.decision_intent

**inaction_conditions**
- IC-001: Actor role is not authorized for any action.
- IC-002: Decision intent is ADVISE only and action requires APPROVE or EXECUTE.

**mandatory_action_conditions**
- MAC-001: None (no action required purely by authority context).

---

### DPQ-002 — Is the portfolio drift out of allowed bands?

**required_inputs**
- portfolio_state.weights
- policy.strategic_asset_allocation.target_weights
- policy.rebalancing_policy.absolute_bands

**inaction_conditions**
- IC-003: All asset-class drift values are within bands.
- IC-004: Portfolio state is missing or incomplete.

**mandatory_action_conditions**
- MAC-002: Any asset-class drift breaches its allowed band and a rebalance is permitted.

---

### DPQ-003 — Are there pending cash flows that require contribution-based rebalancing?

**required_inputs**
- portfolio_state.cash_flows
- portfolio_state.weights
- policy.rebalancing_policy.absolute_bands

**inaction_conditions**
- IC-005: No pending contributions or withdrawals.
- IC-006: Portfolio state is missing or incomplete.

**mandatory_action_conditions**
- MAC-003: Pending contributions exist and drift is out of band; use contribution-based rebalance.

---

### DPQ-004 — Are risk guardrails breached?

**required_inputs**
- risk_inputs.rolling_12m_drawdown_pct
- risk_inputs.risk_capacity_breached
- policy.risk_framework.drawdown_limit

**inaction_conditions**
- IC-007: Risk inputs are missing.

**mandatory_action_conditions**
- MAC-004: Risk capacity breach is true.
- MAC-005: Rolling drawdown exceeds policy limit.
