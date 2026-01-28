/**
 * @file decisionService.ts
 * @description
 * Core decision orchestration for APE (Automated Portfolio Evaluator).
 *
 * Responsibilities:
 * - Load and log the active investment policy
 * - Accept optional structured portfolio state
 * - Compute drift deterministically (no LLM math)
 * - Ask the LLM ONLY for recommendation + explanation
 * - Validate the model response shape before building the snapshot
 * - Emit a complete Decision Snapshot
 */

import crypto from "node:crypto";

import type { ChatRequest } from "@/lib/domain/chat";
import type { DecisionSnapshot, RecommendationType } from "@/lib/domain/decisionSnapshot";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";

import { loadPolicy } from "@/lib/infra/policyLoader";
import { generateAssistantReply } from "@/lib/infra/mastra";
import { computeDrift } from "@/lib/services/drift";

const SNAPSHOT_VERSION = "0.3";

/**
 * Main entry point for decision generation.
 */
export async function runDecision(req: ChatRequest): Promise<{ snapshot: DecisionSnapshot }> {
  const snapshotId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (!Array.isArray(req.messages)) {
    throw new Error("runDecision: messages must be an array");
  }

  /**
   * ------------------------------------------------------------------
   * Load policy (hard gate)
   * ------------------------------------------------------------------
   */
  const policy = loadPolicy();

  console.log(
    `[APE] Loaded policy: id=${policy.policy_id} version=${policy.policy_version} source=${policy.source}`
  );

  /**
   * ------------------------------------------------------------------
   * Structured portfolio state (optional in Milestone #3a)
   * ------------------------------------------------------------------
   */
  const state: PortfolioStateInput | null = req.portfolio_state ?? null;

  /**
   * ------------------------------------------------------------------
   * Deterministic drift computation (ONLY if state exists)
   * ------------------------------------------------------------------
   */
  const driftResult = state ? computeDrift(policy, state) : null;

  /**
   * ------------------------------------------------------------------
   * Build LLM prompt (conditional, minimal authority)
   * ------------------------------------------------------------------
   */
  const prompt = `
Return STRICT JSON ONLY (no markdown, no commentary).

Schema:
{
  "recommendation_type": "DO_NOTHING|REBALANCE_VIA_CONTRIBUTIONS|PARTIAL_REBALANCE|FULL_REBALANCE|DEFER_AND_REVIEW|ASK_CLARIFYING_QUESTIONS",
  "recommendation_summary": "one short sentence",
  "explanation": {
    "decision_summary": "string",
    "relevant_portfolio_state": "string",
    "policy_basis": "string",
    "reasoning_and_tradeoffs": "string",
    "uncertainty_and_confidence": "string",
    "next_review_or_trigger": "string"
  },
  "proposed_actions": [
    {
      "asset_class": "EQUITIES|BONDS|CASH",
      "action": "BUY|SELL|HOLD",
      "amount": number|null,
      "rationale": "string"
    }
  ]
}

Important rules:
- No market predictions. No urgency.
- Align strictly with the Investment Policy Model.
- Rebalancing is a risk-management tool, not return optimisation.

${
  state
    ? `
Portfolio state HAS been provided.
- Do NOT ask for weights or cash flows.
- Use the provided state and computed drift below.
- Focus on a policy-aligned recommendation and explanation only.

Portfolio state:
- as_of_date: ${state.as_of_date}
- weights: equities=${state.weights.EQUITIES}, bonds=${state.weights.BONDS}, cash=${state.weights.CASH}
- pending_contributions_gbp: ${state.cash_flows.pending_contributions_gbp ?? "null"}
- pending_withdrawals_gbp: ${state.cash_flows.pending_withdrawals_gbp ?? "null"}

Computed drift (deterministic):
- absolute_drift: equities=${driftResult?.absolute_drift.EQUITIES}, bonds=${driftResult?.absolute_drift.BONDS}, cash=${driftResult?.absolute_drift.CASH}
- bands_breached: ${driftResult?.bands_breached}
`
    : `
Portfolio state has NOT been provided.
- Default to ASK_CLARIFYING_QUESTIONS or DEFER_AND_REVIEW.
- Ask only for the minimum missing inputs required to proceed.
`
}
`.trim();

  /**
   * ------------------------------------------------------------------
   * Invoke LLM (reasoning + explanation only; parse + validate JSON)
   * ------------------------------------------------------------------
   */
  const rawResponse = await generateAssistantReply({
    messages: req.messages,
    systemPrompt: prompt,
  });
  const cleanedResponse = rawResponse.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  let modelResponse: unknown;
  console.log("[APE] Decision model raw response:", rawResponse);
  try {
    modelResponse = JSON.parse(cleanedResponse);
  } catch {
    throw new Error("Decision model response was not valid JSON.");
  }
  if (!modelResponse || typeof modelResponse !== "object") {
    throw new Error("Decision model response must be a JSON object.");
  }
  const response = modelResponse as {
    recommendation_type?: RecommendationType;
    recommendation_summary?: string;
    proposed_actions?: DecisionSnapshot["recommendation"]["proposed_actions"];
    explanation?: DecisionSnapshot["explanation"];
  };
  if (!response.recommendation_type || typeof response.recommendation_type !== "string") {
    throw new Error("Decision model response missing recommendation_type.");
  }
  if (!response.recommendation_summary || typeof response.recommendation_summary !== "string") {
    throw new Error("Decision model response missing recommendation_summary.");
  }
  if (!response.explanation || typeof response.explanation !== "object") {
    throw new Error("Decision model response missing explanation.");
  }
  if (response.proposed_actions === undefined) {
    response.proposed_actions = [];
  }
  if (!Array.isArray(response.proposed_actions)) {
    throw new Error("Decision model response proposed_actions must be an array.");
  }
  const allowedAssetClasses: DecisionSnapshot["recommendation"]["proposed_actions"][number]["asset_class"][] =
    ["EQUITIES", "BONDS", "CASH"];
  const allowedActions: DecisionSnapshot["recommendation"]["proposed_actions"][number]["action"][] = [
    "BUY",
    "SELL",
    "HOLD",
  ];
  for (const [index, action] of response.proposed_actions.entries()) {
    if (!action || typeof action !== "object") {
      throw new Error(`Decision model response proposed_actions[${index}] must be an object.`);
    }
    if (!allowedAssetClasses.includes(action.asset_class)) {
      throw new Error(`Decision model response proposed_actions[${index}].asset_class is invalid.`);
    }
    if (!allowedActions.includes(action.action)) {
      throw new Error(`Decision model response proposed_actions[${index}].action is invalid.`);
    }
    if (action.amount !== null && typeof action.amount !== "number") {
      throw new Error(`Decision model response proposed_actions[${index}].amount is invalid.`);
    }
    if (!action.rationale || typeof action.rationale !== "string") {
      throw new Error(`Decision model response proposed_actions[${index}].rationale is invalid.`);
    }
  }
  const explanation = response.explanation as DecisionSnapshot["explanation"];
  const requiredExplanationKeys: Array<keyof DecisionSnapshot["explanation"]> = [
    "decision_summary",
    "relevant_portfolio_state",
    "policy_basis",
    "reasoning_and_tradeoffs",
    "uncertainty_and_confidence",
    "next_review_or_trigger",
  ];
  for (const key of requiredExplanationKeys) {
    if (!explanation[key] || typeof explanation[key] !== "string") {
      throw new Error(`Decision model response missing explanation.${key}.`);
    }
  }

  /**
   * ------------------------------------------------------------------
   * Build Decision Snapshot (authoritative output)
   * ------------------------------------------------------------------
   */
  const snapshot: DecisionSnapshot = {
    snapshot_id: snapshotId,
    snapshot_version: SNAPSHOT_VERSION,
    created_at: createdAt,
    project: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",

    context: {
      user_id: "local",
      environment: "dev",
      jurisdiction: policy.jurisdiction,
      base_currency: policy.strategic_asset_allocation.base_currency,
    },

    inputs: {
      portfolio_state: {
        total_value: state?.total_value_gbp ?? null,
        asset_allocation: state
          ? {
              EQUITIES: state.weights.EQUITIES,
              BONDS: state.weights.BONDS,
              CASH: state.weights.CASH,
            }
          : {
              EQUITIES: null,
              BONDS: null,
              CASH: null,
            },
        positions_summary: state
          ? "Provided via manual structured input."
          : "Not provided.",
        cash_balance: null, // #TODO: add explicit cash_balance_gbp if needed later
      },

      cash_flows: {
        pending_contributions: state?.cash_flows.pending_contributions_gbp ?? null,
        pending_withdrawals: state?.cash_flows.pending_withdrawals_gbp ?? null,
        notes: state
          ? "Provided via manual structured input."
          : "Not provided.",
      },

      constraints: {
        liquidity_needs: "Not captured yet.",
        tax_or_wrapper_constraints: "Not captured yet.",
        other_constraints: "Not captured yet.",
      },

      market_context: {
        as_of_date: state?.as_of_date ?? new Date().toISOString().slice(0, 10),
        notes: "No exceptional market context assumed.",
      },
    },

    governance: {
      investment_policy: {
        policy_id: policy.policy_id,
        policy_version: policy.policy_version,
        policy_source: policy.source,
      },
      explanation_contract: {
        version: "0.1-default",
      },
    },

    evaluation: {
      drift_analysis: {
        target_weights: policy.strategic_asset_allocation.target_weights,
        actual_weights: driftResult?.actual_weights ?? {
          EQUITIES: null,
          BONDS: null,
          CASH: null,
        },
        absolute_drift: driftResult?.absolute_drift ?? {
          EQUITIES: null,
          BONDS: null,
          CASH: null,
        },
        bands_breached: driftResult?.bands_breached ?? null,
      },

      risk_checks: {
        risk_capacity_breached: null, // #TODO: implement risk capacity checks in Milestone #3b
        notes: state
          ? "Risk checks not yet implemented."
          : "Risk checks require portfolio state.",
      },
    },

    recommendation: {
      type: response.recommendation_type,
      summary: response.recommendation_summary,
      proposed_actions: response.proposed_actions ?? [],
      turnover_estimate: {
        gross_turnover_pct: null, // #TODO: compute once trades are formalised
        trade_count: response.proposed_actions?.length ?? 0,
      },
    },

    explanation: response.explanation,

    user_acknowledgement: {
      decision: "DEFER",
      acknowledged_at: null,
      user_notes: "Snapshot generated; not yet implemented.",
    },

    outcome: {
      implemented: null,
      implementation_notes: null,
      review_date: null,
      observed_effects: null,
    },

    audit: {
      logic_version: SNAPSHOT_VERSION,
      notes: "Milestone #3a: structured portfolio state + deterministic drift.",
    },
  };

  return { snapshot };
}
