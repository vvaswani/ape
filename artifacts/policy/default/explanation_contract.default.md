# Explanation Contract

**Project:** **AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**  
**Owner:** Default  
**Date:** 27 January 2026  
**Version:** 0.1-default  
**Applies to:** All recommendations, including “do nothing”

---

## 1. Purpose

The Explanation Contract defines the **minimum standard** for how decisions produced by the
AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator) must be explained.

Its purpose is to ensure explanations are:
- policy-aligned,
- transparent,
- honest about uncertainty, and
- suitable for later review and audit.

Any recommendation presented without a valid explanation is considered **incomplete**.

---

## 2. Mandatory Explanation Structure

Every explanation must contain the following sections.

### 2.1 Decision Summary

State clearly and briefly:
- the recommended action (or inaction), and
- the recommendation type (e.g. *Do nothing*, *Rebalance via contributions*).

No justification belongs in this section.

---

### 2.2 Relevant Portfolio State

Summarise only the facts that materially influenced the decision, such as:
- current vs target allocations,
- degree of drift,
- cash availability,
- applicable constraints.

Irrelevant portfolio details must be omitted.

---

### 2.3 Policy Basis

Explicitly reference:
- the policy version applied,
- the specific rules or thresholds involved (targets, bands, limits).

The explanation must make clear that the decision follows predefined policy, not judgement or opinion.

---

### 2.4 Reasoning and Trade-offs

Explain:
- why action or inaction is justified,
- which trade-offs were considered (e.g. risk vs turnover),
- why alternative actions were rejected.

This section should read like a concise investment committee note.

---

### 2.5 Uncertainty and Confidence

Acknowledge:
- key assumptions,
- sources of uncertainty,
- qualitative confidence in the recommendation.

Uncertainty must be stated explicitly. Overconfidence is not permitted.

---

### 2.6 Next Review or Trigger

State either:
- the expected review timing, or
- the condition that would trigger reassessment.

---

## 3. Language and Tone Rules

### Required Tone
- Neutral
- Precise
- Calm
- Non-promotional

---

### Prohibited Language

The explanation must not include:
- market forecasts or predictions,
- claims of superior insight or edge,
- urgency framing,
- emotional or persuasive language,
- absolute or guaranteed outcomes.

---

### “Do Nothing” Guidance

When recommending no action:
- inaction must be explicitly justified,
- it must be framed as a deliberate, disciplined decision.

---

## 4. Precedence and Governance

This contract operates:
- downstream of the Investment Policy Model and policy JSON,
- upstream of Decision Snapshots and Audit Logs.

If explanation text conflicts with applied policy logic, **policy logic prevails**.

---

## 5. Failure Conditions

An explanation is invalid if it:
- contradicts the applied policy,
- omits uncertainty,
- persuades rather than explains,
- recommends action without justification,
- fails to support inaction when appropriate.

Invalid explanations must not be surfaced to the user.

---

## 6. Status

This document represents the **default explanation standard**.

All explanations must reference:
- the applied policy version, and
- this Explanation Contract version.
