# Explanation Contract

**Project:** **AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**  
**Owner:** __OWNER__  
**Date:** __DATE__  
**Version:** __VERSION__  
**Applies to:** All recommendations, including “do nothing”

---

## 1. Purpose of the Explanation Contract

The Explanation Contract defines **how decisions must be explained** by the
AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator).

Its purpose is to ensure that every recommendation is:
- understandable,
- honest about uncertainty,
- grounded in policy, and
- reviewable after the fact.

If an explanation violates this contract, the recommendation is considered **invalid**, regardless of numerical correctness.

---

## 2. Mandatory Explanation Components

Every recommendation **must** include the following sections, in this order.

### 2.1 Decision Summary

A concise statement answering:

- What action (if any) is being recommended?
- What is the recommendation type?  
  (e.g. *Do nothing*, *Rebalance via contributions*, *Partial rebalance*)

This section must be brief and factual.

---

### 2.2 Current Portfolio State (Relevant Facts Only)

A summary of the **specific facts that triggered evaluation**, such as:

- current vs target asset weights,
- magnitude of drift,
- cash balance and flows,
- relevant constraints (liquidity, wrappers, drawdown proximity).

Do not restate the full portfolio if only a subset is relevant.

---

### 2.3 Policy Reference

An explicit link to the governing rules applied:

- policy version used,
- relevant target weights or bands,
- relevant risk or turnover constraints.

The explanation must make it clear that the decision is **policy-driven**, not opinion-driven.

---

### 2.4 Reasoning and Trade-offs

A clear description of:

- why action *is* or *is not* justified,
- which trade-offs were considered (e.g. risk vs turnover, precision vs cost),
- why alternative actions were rejected.

This section explains *why this decision* was chosen over plausible alternatives.

---

### 2.5 Uncertainty and Confidence

An explicit statement covering:

- key assumptions,
- sources of uncertainty,
- confidence level in the recommendation (qualitative, not numeric).

Overconfidence is considered a failure of explanation.

---

### 2.6 Next Review or Trigger

State clearly:

- when this decision should be revisited, or
- what future condition would trigger reassessment.

This reinforces that decisions are part of a process, not one-off events.

---

## 3. Language and Tone Rules

The following rules are **non-negotiable**.

### Required Tone

- Neutral
- Precise
- Calm
- Non-persuasive

The system must sound like a disciplined investment committee note, not a sales pitch.

---

### Prohibited Language

The explanation must **not** include:

- predictions or forecasts,
- claims of market edge,
- emotionally charged language,
- urgency framing (“now”, “before it’s too late”),
- absolutes (“guaranteed”, “will outperform”).

---

### Handling “Do Nothing”

When recommending no action:

- the explanation must explicitly justify *why inaction is appropriate*,
- inaction must be framed as an active, disciplined choice.

---

## 4. Relationship to Other Artefacts

The Explanation Contract operates downstream of:

- the Portfolio Guidelines,
- the machine-readable policy JSON.

It operates upstream of:

- Decision Snapshots,
- Audit Logs,
- User acknowledgement.

If there is a conflict between narrative explanation and policy logic, **policy logic prevails**.

---

## 5. Failure Conditions

An explanation is considered invalid if it:

- contradicts the applied policy,
- omits uncertainty,
- persuades rather than explains,
- recommends action without clear justification,
- fails to support “do nothing” when appropriate.

Invalid explanations must not be presented to the user.

---

## 6. Status

This document is a **template**.

All concrete implementations must:
- reference a specific policy version, and
- be captured in a Decision Snapshot.

