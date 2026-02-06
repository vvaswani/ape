import { describe, expect, it } from "vitest";

import type { PolicyJson } from "@/lib/infra/policyLoader";
import type { ModelDecision, GuardrailContext } from "@/lib/services/guardrails";

import { applyGuardrails } from "@/lib/services/guardrails";

const basePolicy: PolicyJson = {
  policy_id: "ape-policy",
  policy_version: "0.1-test",
  source: "test",
  jurisdiction: "UK",
  strategic_asset_allocation: {
    base_currency: "GBP",
    target_weights: {
      EQUITIES: 0.6,
      BONDS: 0.35,
      CASH: 0.05,
    },
  },
  risk_guardrails: {
    max_rolling_12m_drawdown_pct: 0.2,
    risk_capacity_rule: "RISK_CAPACITY_OVERRIDES_TOLERANCE",
  },
  rebalancing_policy: {
    absolute_bands: {
      EQUITIES: 0.07,
      BONDS: 0.06,
      CASH: 0.03,
    },
  },
  constraints: {
    prohibited_actions: ["MARKET_TIMING", "LEVERAGE"],
  },
  meta: {
    prime_directive_sha256: "test",
  },
};

const baseModel: ModelDecision = {
  recommendation_type: "DO_NOTHING",
  recommendation_summary: "No action required.",
  proposed_actions: [],
  explanation: {
    decision_summary: "Portfolio within policy bands.",
    relevant_portfolio_state: "Inputs were provided.",
    policy_basis: "Policy targets and bands applied.",
    reasoning_and_tradeoffs: "Guardrails favor inaction.",
    uncertainty_and_confidence: "High confidence.",
    next_review_or_trigger: "Review at next cadence.",
  },
};

function baseContext(): GuardrailContext {
  return {
    policy: basePolicy,
    portfolio_state: null,
    drift: null,
    risk_inputs: {
      rolling_12m_drawdown_pct: 0.1,
      risk_capacity_breached: false,
    },
    authority: {
      actor_role: "USER",
      decision_intent: "ADVISE",
    },
  };
}

describe("applyGuardrails", () => {
  it("overrides when prohibited actions appear in model output", () => {
    const ctx = baseContext();
    const model: ModelDecision = {
      ...baseModel,
      explanation: {
        ...baseModel.explanation,
        decision_summary: "We should try some market timing based on recent trends.",
      },
    };

    const result = applyGuardrails(ctx, model);

    expect(result.overridden).toBe(true);
    expect(result.model.recommendation_type).toBe("DEFER_AND_REVIEW");
    expect(result.model.explanation.decision_summary.toLowerCase()).not.toContain("market timing");
  });

  it("overrides when risk guardrails are breached", () => {
    const ctx = baseContext();
    ctx.risk_inputs = {
      rolling_12m_drawdown_pct: 0.25,
      risk_capacity_breached: false,
    };

    const result = applyGuardrails(ctx, baseModel);

    expect(result.overridden).toBe(true);
    expect(result.model.recommendation_type).toBe("DEFER_AND_REVIEW");
  });

  it("defers when unauthorized actor attempts approval or execution", () => {
    const ctx = baseContext();
    ctx.authority = {
      actor_role: "USER",
      decision_intent: "APPROVE",
    };

    const result = applyGuardrails(ctx, baseModel);

    expect(result.overridden).toBe(true);
    expect(result.model.recommendation_type).toBe("DEFER_AND_REVIEW");
  });
});
