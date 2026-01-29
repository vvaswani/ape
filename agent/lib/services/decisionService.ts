/**
 * @file decisionService.ts
 * @description
 * Core decision orchestration for APE (Automated Portfolio Evaluator).
 *
 * Responsibilities:
 * - Load and log the active investment policy
 * - Accept optional structured portfolio state
 * - Compute drift deterministically (no LLM math)
 * - Ask the LLM ONLY for recommendation + explanation (JSON)
 * - Parse + validate the model response shape
 * - Apply Milestone #3b guardrails (policy/deterministic boundaries)
 * - Fall back safely when model output is invalid or violates guardrails
 * - Emit a complete Decision Snapshot
 */

import crypto from "node:crypto";

import type { ChatRequest } from "@/lib/domain/chat";
import type { DecisionSnapshot, RecommendationType } from "@/lib/domain/decisionSnapshot";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";

import { loadPolicy } from "@/lib/infra/policyLoader";
import { generateAssistantReply } from "@/lib/infra/mastra";
import { computeDrift } from "@/lib/services/drift";
import { applyGuardrails, type ModelDecision } from "@/lib/services/guardrails";

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
   * Structured portfolio state (optional)
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
   * Build LLM system prompt (minimal authority)
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
- Align strictly with the Investment Policy Model and policy JSON.
- Rebalancing is a risk-management tool, not return optimisation.
- NEVER invent missing weights or cash flows.

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
   * Invoke LLM (explanation only) + parse JSON
   * ------------------------------------------------------------------
   */
  const rawResponse = await generateAssistantReply({
    messages: req.messages,
    systemPrompt: prompt,
  });

  // Keep this for dev; consider logging only on parse failure later.
  console.log("[APE] Decision model raw response:", rawResponse);

  // Tolerate fenced JSON (```json ... ```)
  const cleanedResponse = rawResponse
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleanedResponse);
  } catch {
    parsed = null;
  }

  /**
   * ------------------------------------------------------------------
   * Validate model output shape (pre-guardrails)
   * ------------------------------------------------------------------
   */
  const invalidResponseFallback: ModelDecision = {
    recommendation_type: "DEFER_AND_REVIEW",
    recommendation_summary: "Model output was invalid; deferring and requesting a retry.",
    proposed_actions: [],
    explanation: {
      decision_summary: "Model returned invalid JSON; raw output was logged for review.",
      relevant_portfolio_state: state ? "Structured portfolio state was provided." : "No portfolio state.",
      policy_basis: "Cannot provide a policy-aligned recommendation without a valid model response.",
      reasoning_and_tradeoffs:
        "Returning a safe default avoids acting on malformed output. A retry can provide a valid response.",
      uncertainty_and_confidence: "High uncertainty due to invalid model output.",
      next_review_or_trigger: "Retry the request or provide missing inputs if prompted.",
    },
  };

  const modelCandidate = isPlainObject(parsed) ? (parsed as Record<string, unknown>) : null;

  let modelDecision: ModelDecision = invalidResponseFallback;
  let usedFallback = true;

  if (modelCandidate) {
    const recommendation_type = modelCandidate["recommendation_type"];
    const recommendation_summary = modelCandidate["recommendation_summary"];
    const explanation = modelCandidate["explanation"];
    const proposed_actions = modelCandidate["proposed_actions"];

    const allowedTypes: RecommendationType[] = [
      "DO_NOTHING",
      "REBALANCE_VIA_CONTRIBUTIONS",
      "PARTIAL_REBALANCE",
      "FULL_REBALANCE",
      "DEFER_AND_REVIEW",
      "ASK_CLARIFYING_QUESTIONS",
    ];

    const allowedAssetClasses: Array<"EQUITIES" | "BONDS" | "CASH"> = ["EQUITIES", "BONDS", "CASH"];
    const allowedActions: Array<"BUY" | "SELL" | "HOLD"> = ["BUY", "SELL", "HOLD"];

    if (
      typeof recommendation_type === "string" &&
      allowedTypes.includes(recommendation_type as RecommendationType) &&
      typeof recommendation_summary === "string" &&
      isPlainObject(explanation)
    ) {
      const exp = explanation as Record<string, unknown>;
      const requiredExplanationKeys: Array<keyof DecisionSnapshot["explanation"]> = [
        "decision_summary",
        "relevant_portfolio_state",
        "policy_basis",
        "reasoning_and_tradeoffs",
        "uncertainty_and_confidence",
        "next_review_or_trigger",
      ];

      const explanationOk = requiredExplanationKeys.every(
        (k) => typeof exp[k] === "string" && (exp[k] as string).length > 0
      );

      if (explanationOk) {
        const actionsArray = Array.isArray(proposed_actions) ? proposed_actions : [];
        const normalizedActions: ModelDecision["proposed_actions"] = [];

        let actionsOk = true;
        for (const item of actionsArray) {
          if (!isPlainObject(item)) {
            actionsOk = false;
            break;
          }
          const a = item as Record<string, unknown>;
          const asset_class = a["asset_class"];
          const action = a["action"];
          const amount = a["amount"];
          const rationale = a["rationale"];

          if (
            typeof asset_class !== "string" ||
            !allowedAssetClasses.includes(asset_class as any) ||
            typeof action !== "string" ||
            !allowedActions.includes(action as any) ||
            (amount !== null && amount !== undefined && typeof amount !== "number") ||
            typeof rationale !== "string"
          ) {
            actionsOk = false;
            break;
          }

          normalizedActions.push({
            asset_class: asset_class as "EQUITIES" | "BONDS" | "CASH",
            action: action as "BUY" | "SELL" | "HOLD",
            amount: amount === undefined ? null : (amount as number | null),
            rationale,
          });
        }

        if (actionsOk) {
          modelDecision = {
            recommendation_type: recommendation_type as RecommendationType,
            recommendation_summary,
            explanation: {
              decision_summary: exp["decision_summary"] as string,
              relevant_portfolio_state: exp["relevant_portfolio_state"] as string,
              policy_basis: exp["policy_basis"] as string,
              reasoning_and_tradeoffs: exp["reasoning_and_tradeoffs"] as string,
              uncertainty_and_confidence: exp["uncertainty_and_confidence"] as string,
              next_review_or_trigger: exp["next_review_or_trigger"] as string,
            },
            proposed_actions: normalizedActions,
          };
          usedFallback = false;
        }
      }
    }
  }

  /**
   * ------------------------------------------------------------------
   * Apply Milestone #3b guardrails (authoritative policy + drift boundaries)
   * ------------------------------------------------------------------
   */
  const guard = applyGuardrails(
    {
      policy,
      portfolio_state: state,
      drift: driftResult,
    },
    modelDecision
  );

  if (guard.overridden || guard.warnings.length) {
    console.warn("[APE] Guardrails applied:", guard.warnings);
  }

  const finalModel = guard.model;

  /**
   * ------------------------------------------------------------------
   * Build Decision Snapshot
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
      jurisdiction: policy.jurisdiction ?? "UK",
      base_currency: policy.strategic_asset_allocation.base_currency ?? "GBP",
    },

    inputs: {
      portfolio_state: {
        total_value: state?.total_value_gbp ?? null,
        asset_allocation: {
          EQUITIES: state?.weights.EQUITIES ?? null,
          BONDS: state?.weights.BONDS ?? null,
          CASH: state?.weights.CASH ?? null,
        },
        positions_summary: state ? "Structured portfolio state provided (manual input)." : "Not provided.",
        cash_balance: null,
      },
      cash_flows: {
        pending_contributions: state?.cash_flows.pending_contributions_gbp ?? null,
        pending_withdrawals: state?.cash_flows.pending_withdrawals_gbp ?? null,
        notes: state ? "Structured cash flows provided (manual input)." : "Not provided.",
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
        target_weights: {
          EQUITIES: policy.strategic_asset_allocation.target_weights.EQUITIES,
          BONDS: policy.strategic_asset_allocation.target_weights.BONDS,
          CASH: policy.strategic_asset_allocation.target_weights.CASH,
        },
        actual_weights: {
          EQUITIES: driftResult ? driftResult.actual_weights.EQUITIES : null,
          BONDS: driftResult ? driftResult.actual_weights.BONDS : null,
          CASH: driftResult ? driftResult.actual_weights.CASH : null,
        },
        absolute_drift: {
          EQUITIES: driftResult ? driftResult.absolute_drift.EQUITIES : null,
          BONDS: driftResult ? driftResult.absolute_drift.BONDS : null,
          CASH: driftResult ? driftResult.absolute_drift.CASH : null,
        },
        bands_breached: driftResult ? driftResult.bands_breached : null,
      },
      risk_checks: {
        risk_capacity_breached: null,
        notes: "Risk checks not implemented in Milestone #3b.",
      },
    },

    recommendation: {
      type: finalModel.recommendation_type,
      summary: finalModel.recommendation_summary,
      proposed_actions: (finalModel.proposed_actions ?? []).map((a) => ({
        asset_class: a.asset_class,
        action: a.action,
        amount: a.amount ?? null,
        rationale: a.rationale,
      })),
      turnover_estimate: {
        gross_turnover_pct: null,
        trade_count: (finalModel.proposed_actions ?? []).length,
      },
    },

    explanation: finalModel.explanation,

    user_acknowledgement: {
      decision: "DEFER",
      acknowledged_at: null,
      user_notes: "Milestone #3b: guardrails enforced.",
    },

    outcome: {
      implemented: null,
      implementation_notes: null,
      review_date: null,
      observed_effects: null,
    },

    audit: {
      logic_version: SNAPSHOT_VERSION,
      notes: [
        "Milestone #3b: guardrails enforce policy/deterministic constraints.",
        usedFallback ? "Model JSON invalid: used fallback before guardrails." : null,
        guard.overridden ? "Guardrails overrode model output." : null,
        guard.warnings.length ? `Guardrails warnings: ${guard.warnings.join(" | ")}` : null,
        "#TODO: add structured audit.guardrails when schema supports it.",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };

  return { snapshot };
}

/**
 * Narrow unknown to a plain object (not null/array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
