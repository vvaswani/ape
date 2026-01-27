/**
 * @file decisionService.ts
 * @description
 * Builds a Decision Snapshot for the current conversation.
 *
 * In Milestone #2, the snapshot is the primary output.
 * We deliberately keep portfolio state coarse unless the user provides weights.
 */

import crypto from "node:crypto";
import type { ChatRequest } from "@/lib/domain/chat";
import type { DecisionSnapshot, RecommendationType } from "@/lib/domain/decisionSnapshot";
import { loadPolicy } from "@/lib/infra/policyLoader";
import { generateAssistantReply } from "@/lib/infra/mastra";

const SNAPSHOT_VERSION = "0.2";
const EXPLANATION_CONTRACT_VERSION = "0.1-default";
const LOGIC_VERSION = "0.2";

/**
 * Extract a JSON object from a model response.
 * We keep this deliberately tolerant because models sometimes wrap JSON in text.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function safeParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

type ModelExplanation = {
  recommendation_type: RecommendationType;
  recommendation_summary: string;
  explanation: DecisionSnapshot["explanation"];
  proposed_actions?: DecisionSnapshot["recommendation"]["proposed_actions"];
};

/**
 * Build a deterministic baseline snapshot and fill explanation via the model.
 */
export async function runDecision(req: ChatRequest): Promise<{ snapshot: DecisionSnapshot }> {
  const policy = loadPolicy();

  const now = new Date();
  const snapshotId = crypto.randomUUID();

  // Ask the model ONLY for fields we allow it to control.
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
    { "asset_class": "EQUITIES|BONDS|CASH", "action": "BUY|SELL|HOLD", "amount": number|null, "rationale": "string" }
  ]
}

Important:
- If the user has not provided actual weights/cashflows, default to ASK_CLARIFYING_QUESTIONS or DEFER_AND_REVIEW.
- No market predictions. No urgency.
- Align with a policy of target weights and band-based rebalancing.
`.trim();

  const modelText = await generateAssistantReply([
    ...req.messages,
    { role: "system", content: prompt },
  ]);

  const jsonBlob = extractJsonObject(modelText);
  const parsed = jsonBlob ? safeParse<ModelExplanation>(jsonBlob) : null;

  const fallbackExplanation: DecisionSnapshot["explanation"] = {
    decision_summary: "Insufficient information to make a policy-aligned rebalance recommendation.",
    relevant_portfolio_state: "Current weights, cash, and recent contributions/withdrawals were not provided.",
    policy_basis: `Policy ${policy.policy_version} targets and bands exist, but cannot be applied without portfolio state.`,
    reasoning_and_tradeoffs: "Defaulting to caution avoids unnecessary turnover and behavioural mistakes.",
    uncertainty_and_confidence: "Low confidence due to missing inputs. The correct next step is to capture actual weights and cash flows.",
    next_review_or_trigger: "Provide current asset weights (equities/bonds/cash) and any planned contributions; then re-run.",
  };

  const recommendationType: RecommendationType =
    parsed?.recommendation_type ?? "ASK_CLARIFYING_QUESTIONS";

  const recommendationSummary =
    parsed?.recommendation_summary ??
    "Please share current weights and cash flows so I can assess drift versus policy.";

  const explanation = parsed?.explanation ?? fallbackExplanation;

  const proposedActions = parsed?.proposed_actions ?? [];

  // Baseline portfolio state: unknown until user supplies it.
  const snapshot: DecisionSnapshot = {
    snapshot_id: snapshotId,
    snapshot_version: SNAPSHOT_VERSION,
    created_at: now.toISOString(),
    project: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",

    context: {
      user_id: "local",
      environment: "dev",
      jurisdiction: policy.jurisdiction,
      base_currency: policy.strategic_asset_allocation.base_currency,
    },

    inputs: {
      portfolio_state: {
        total_value: null,
        asset_allocation: { EQUITIES: null, BONDS: null, CASH: null },
        positions_summary: "Not provided in Milestone #2 (v0).",
        cash_balance: null,
      },
      cash_flows: {
        pending_contributions: null,
        pending_withdrawals: null,
        notes: "Not provided in Milestone #2 (v0).",
      },
      constraints: {
        liquidity_needs: "Not captured yet.",
        tax_or_wrapper_constraints: "Not captured yet.",
        other_constraints: "Not captured yet.",
      },
      market_context: {
        as_of_date: now.toISOString().slice(0, 10),
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
        version: EXPLANATION_CONTRACT_VERSION,
      },
    },

    evaluation: {
      drift_analysis: {
        target_weights: policy.strategic_asset_allocation.target_weights,
        actual_weights: { EQUITIES: null, BONDS: null, CASH: null },
        absolute_drift: { EQUITIES: null, BONDS: null, CASH: null },
        bands_breached: null,
      },
      risk_checks: {
        risk_capacity_breached: null,
        notes: "Risk checks require portfolio state; not evaluated in Milestone #2 (v0).",
      },
    },

    recommendation: {
      type: recommendationType,
      summary: recommendationSummary,
      proposed_actions: proposedActions,
      turnover_estimate: {
        gross_turnover_pct: null,
        trade_count: proposedActions.length,
      },
    },

    explanation,

    user_acknowledgement: {
      decision: "DEFER",
      acknowledged_at: null,
      user_notes: "Milestone #2: snapshot generated but not implemented.",
    },

    outcome: {
      implemented: null,
      implementation_notes: null,
      review_date: null,
      observed_effects: null,
    },

    audit: {
      logic_version: LOGIC_VERSION,
      notes: "Milestone #2: snapshot-first output; portfolio state capture not yet implemented.",
    },
  };

  return { snapshot };
}
