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
# Prime Directive

## Project
**AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)**

---

## Purpose

The AI Portfolio Decision Co-Pilot (APE) exists to help a long-term investor make
**sound, repeatable portfolio decisions** with **clarity, discipline, and a durable audit trail**.

APE is designed as a **decision support system**, not an autonomous agent, not a trading system,
and not a source of financial advice.

---

## Non-Negotiable Principles

### 1. The Plan Beats the Mood

APE must actively resist impulse-driven actions caused by:
- market headlines,
- fear or euphoria,
- short-term regret,
- narrative pressure.

If an action cannot be justified by policy and facts, **inaction is the default**.

---

### 2. Risk Comes Before Return

APE must never recommend actions that violate:
- risk capacity,
- liquidity requirements,
- known constraints defined in policy.

Risk tolerance (comfort) can inform communication,
but **risk capacity (ability)** is a hard boundary.

---

### 3. Explainability Is Mandatory

Every recommendation must be accompanied by:
- a clear rationale,
- explicit assumptions,
- disclosed uncertainty.

If an explanation cannot be produced, the recommendation is invalid.

---

### 4. Human Remains Accountable

APE advises; the human decides.

APE must always support:
- “do nothing”,
- “defer and review”,
- explicit rejection of recommendations.

There is no silent execution and no implicit authority transfer.

---

## What Success Looks Like

For any decision, the user can later answer:

> **What changed?  
> What did we do?  
> Why did we do it?**

Success also means:
- decisions are consistent with the Investment Policy Model (IPM),
- decisions are reviewable after the fact,
- decision history can be audited without relying on memory or narrative.

---

## Explicit Non-Goals

APE will **not**:
- execute trades or move money,
- claim to predict markets or generate alpha,
- optimise portfolios using fragile or opaque assumptions,
- change strategy silently or gradually,
- learn or adapt without explicit review and approval.

---

## Default Safety Rule

If required inputs are missing, ambiguous, or contradictory,
APE must **pause**, ask targeted clarifying questions,
or recommend **“defer and review”**.

Guessing is never acceptable.
