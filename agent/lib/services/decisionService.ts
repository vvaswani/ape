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
 * - Fall back to a safe response when model output is invalid
 * - Emit a complete Decision Snapshot
 */

import crypto from "node:crypto";

import type { ChatRequest } from "@/lib/domain/chat";
import type { DecisionSnapshot, RecommendationType } from "@/lib/domain/decisionSnapshot";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";

import { loadPolicy } from "@/lib/infra/policyLoader";
import { generateAssistantReply } from "@/lib/infra/mastra";
import logger from "@/lib/infra/logger";
import { computeDrift } from "@/lib/services/drift";

const SNAPSHOT_VERSION = "0.3";
const EPS = 1e-6;

function extractLastUserMessage(messages: ChatRequest["messages"]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user" && typeof messages[i]?.content === "string") {
      return messages[i].content;
    }
  }
  return null;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseWeight(value: number, hasPercent: boolean): number {
  if (hasPercent || value > 1) {
    return value / 100;
  }
  return value;
}

function extractPortfolioStateFromPrompt(content: string): PortfolioStateInput | null {
  const eqMatch = /equities[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*(%?)/i.exec(content);
  const bdMatch = /bonds?[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*(%?)/i.exec(content);
  const csMatch = /cash[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*(%?)/i.exec(content);

  if (!eqMatch || !bdMatch || !csMatch) {
    return null;
  }

  const eqRaw = parseNumber(eqMatch[1]);
  const bdRaw = parseNumber(bdMatch[1]);
  const csRaw = parseNumber(csMatch[1]);
  if (eqRaw === null || bdRaw === null || csRaw === null) {
    return null;
  }

  const weights = {
    EQUITIES: parseWeight(eqRaw, eqMatch[2] === "%"),
    BONDS: parseWeight(bdRaw, bdMatch[2] === "%"),
    CASH: parseWeight(csRaw, csMatch[2] === "%"),
  };

  const totalMatch = /total\s*value[^0-9]*([0-9,]+(?:\.[0-9]+)?)/i.exec(content);
  const total_value_gbp = totalMatch ? parseNumber(totalMatch[1]) : null;

  let pending_contributions_gbp: number | null = null;
  let pending_withdrawals_gbp: number | null = null;
  if (/no\s+new\s+contributions?/i.test(content)) {
    pending_contributions_gbp = 0;
  } else {
    const contribMatch = /contributions?[^0-9]*([0-9,]+(?:\.[0-9]+)?)/i.exec(content);
    if (contribMatch) pending_contributions_gbp = parseNumber(contribMatch[1]);
  }
  if (/no\s+new\s+withdrawals?/i.test(content)) {
    pending_withdrawals_gbp = 0;
  } else {
    const wdMatch = /withdrawals?[^0-9]*([0-9,]+(?:\.[0-9]+)?)/i.exec(content);
    if (wdMatch) pending_withdrawals_gbp = parseNumber(wdMatch[1]);
  }

  return {
    as_of_date: new Date().toISOString().slice(0, 10),
    total_value_gbp,
    weights,
    cash_flows: {
      pending_contributions_gbp,
      pending_withdrawals_gbp,
    },
  };
}

function statesDiffer(a: PortfolioStateInput, b: PortfolioStateInput): boolean {
  const diffWeight =
    Math.abs((a.weights.EQUITIES ?? 0) - (b.weights.EQUITIES ?? 0)) > EPS ||
    Math.abs((a.weights.BONDS ?? 0) - (b.weights.BONDS ?? 0)) > EPS ||
    Math.abs((a.weights.CASH ?? 0) - (b.weights.CASH ?? 0)) > EPS;

  const diffTotal = (a.total_value_gbp ?? null) !== (b.total_value_gbp ?? null);
  const diffContrib =
    (a.cash_flows.pending_contributions_gbp ?? null) !==
    (b.cash_flows.pending_contributions_gbp ?? null);
  const diffWd =
    (a.cash_flows.pending_withdrawals_gbp ?? null) !==
    (b.cash_flows.pending_withdrawals_gbp ?? null);

  return diffWeight || diffTotal || diffContrib || diffWd;
}

function isEmptyState(state: PortfolioStateInput): boolean {
  const weightsZero =
    state.weights.EQUITIES === 0 &&
    state.weights.BONDS === 0 &&
    state.weights.CASH === 0;
  const weightsUnset =
    state.weights.EQUITIES === null &&
    state.weights.BONDS === null &&
    state.weights.CASH === null;
  const weightsEmpty = weightsZero || weightsUnset;
  const noTotals = state.total_value_gbp === null;
  const noFlows =
    state.cash_flows.pending_contributions_gbp === null &&
    state.cash_flows.pending_withdrawals_gbp === null;
  return weightsEmpty && noTotals && noFlows;
}

function hasCompleteWeights(state: PortfolioStateInput): boolean {
  return (
    typeof state.weights.EQUITIES === "number" &&
    Number.isFinite(state.weights.EQUITIES) &&
    typeof state.weights.BONDS === "number" &&
    Number.isFinite(state.weights.BONDS) &&
    typeof state.weights.CASH === "number" &&
    Number.isFinite(state.weights.CASH)
  );
}

function describeFormState(state: PortfolioStateInput | undefined): string {
  if (!state) return "no portfolio_state provided";
  const missing: string[] = [];
  if (state.weights.EQUITIES === null) missing.push("weights.EQUITIES");
  if (state.weights.BONDS === null) missing.push("weights.BONDS");
  if (state.weights.CASH === null) missing.push("weights.CASH");
  if (state.total_value_gbp === null) missing.push("total_value_gbp");
  if (state.cash_flows.pending_contributions_gbp === null) missing.push("cash_flows.pending_contributions_gbp");
  if (state.cash_flows.pending_withdrawals_gbp === null) missing.push("cash_flows.pending_withdrawals_gbp");
  if (missing.length === 0) return "complete";
  return `missing: ${missing.join(", ")}`;
}

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

  logger.info(
    { policy_id: policy.policy_id, policy_version: policy.policy_version, policy_source: policy.source },
    "[APE] Loaded policy"
  );

  /**
   * ------------------------------------------------------------------
   * Structured portfolio state (optional in Milestone #3a)
   * ------------------------------------------------------------------
   */
  const lastUserMessage = extractLastUserMessage(req.messages);
  const parsedState = lastUserMessage ? extractPortfolioStateFromPrompt(lastUserMessage) : null;
  const structuredState =
    req.portfolio_state &&
    !isEmptyState(req.portfolio_state) &&
    hasCompleteWeights(req.portfolio_state)
      ? req.portfolio_state
      : null;
  const state: PortfolioStateInput | null = structuredState ?? parsedState ?? null;

  const auditWarnings: string[] = [];
  if (!structuredState) {
    logger.info(
      { form_state: describeFormState(req.portfolio_state) },
      "[APE] Form state empty or incomplete"
    );
  }
  const hasConflict =
    !!parsedState && !!structuredState && statesDiffer(parsedState, structuredState);
  logger.debug(
    {
      parsed_state: !!parsedState,
      structured_state: !!structuredState,
      has_conflict: hasConflict,
    },
    "[APE] Conflict check"
  );
  if (hasConflict) {
    const warning =
      "Prompt portfolio state conflicts with the form values. Please confirm the correct inputs.";
    auditWarnings.push(warning);
    logger.warn({ warning }, "[APE] Prompt/form conflict");
  } else if (parsedState && !req.portfolio_state) {
    const warning = "Using prompt-derived portfolio state.";
    auditWarnings.push(warning);
    logger.info({ warning }, "[APE] Prompt-derived state");
  }

  /**
   * ------------------------------------------------------------------
   * Deterministic drift computation (ONLY if state exists)
   * ------------------------------------------------------------------
   */
  const driftResult = state && hasCompleteWeights(state) ? computeDrift(policy, state) : null;
  if (state && driftResult) {
    logger.info(
      {
        policy_targets: policy.strategic_asset_allocation.target_weights,
        actual_weights: state.weights,
        bands_breached: driftResult.bands_breached,
      },
      "[APE] Drift inputs"
    );
  }
  const hasCashFlows =
    state &&
    ((state.cash_flows.pending_contributions_gbp ?? 0) !== 0 ||
      (state.cash_flows.pending_withdrawals_gbp ?? 0) !== 0);

  const recommendationType: RecommendationType = hasConflict
    ? "ASK_CLARIFYING_QUESTIONS"
    : !state || !driftResult
      ? "ASK_CLARIFYING_QUESTIONS"
      : !driftResult.bands_breached && !hasCashFlows
        ? "DO_NOTHING"
        : driftResult.bands_breached && hasCashFlows
          ? "REBALANCE_VIA_CONTRIBUTIONS"
          : "FULL_REBALANCE";

  // TODO: Consider skipping LLM for conflict/clarification cases to reduce noisy explanations.
  const deterministicExplanation =
    recommendationType === "DO_NOTHING" && state && driftResult
      ? {
          recommendation_summary:
            "Portfolio is within policy bands and has no planned cash flows; no action required.",
          proposed_actions: [],
          explanation: {
            decision_summary:
              "The portfolio is within the policy's rebalancing bands and does not require action.",
            relevant_portfolio_state: `Current allocation: Equities ${state.weights.EQUITIES}, Bonds ${state.weights.BONDS}, Cash ${state.weights.CASH}.`,
            policy_basis:
              "The investment policy triggers rebalancing only when an asset class breaches its absolute band.",
            reasoning_and_tradeoffs:
              "Rebalancing when within bands would add unnecessary turnover without improving policy alignment.",
            uncertainty_and_confidence:
              "High confidence based on deterministic drift and absence of cash flows.",
            next_review_or_trigger:
              "Review at the next scheduled cadence or if bands are breached or cash flows occur.",
          },
        }
      : null;

  /**
   * ------------------------------------------------------------------
   * Build LLM prompt (conditional, minimal authority)
   * ------------------------------------------------------------------
   */
  const prompt = `
Return STRICT JSON ONLY (no markdown, no commentary).

Schema:
{
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
- Use the policy targets and bands provided below; do not invent targets or bands.
- The recommendation type is already decided: ${recommendationType}. Do NOT change it; only explain it.

Policy (authoritative):
- target_weights: equities=${policy.strategic_asset_allocation.target_weights.EQUITIES}, bonds=${policy.strategic_asset_allocation.target_weights.BONDS}, cash=${policy.strategic_asset_allocation.target_weights.CASH}
- absolute_bands: equities=${policy.rebalancing_policy.absolute_bands.EQUITIES}, bonds=${policy.rebalancing_policy.absolute_bands.BONDS}, cash=${policy.rebalancing_policy.absolute_bands.CASH}

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
  let modelResponse: unknown = deterministicExplanation;
  if (!deterministicExplanation) {
    const rawResponse = await generateAssistantReply({
      messages: req.messages,
      systemPrompt: prompt,
    });
    logger.debug({ raw_response: rawResponse }, "[APE] Decision model raw response");
    const cleanedResponse = rawResponse
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    try {
      modelResponse = JSON.parse(cleanedResponse);
    } catch {
      modelResponse = null;
    }
  }

  const invalidResponseFallback = {
    recommendation_summary: "Model output was invalid; using a safe default explanation.",
    proposed_actions: [],
    explanation: {
      decision_summary: "Model returned invalid JSON; raw output was logged for review.",
      relevant_portfolio_state: state ? "Structured portfolio state was provided." : "No portfolio state.",
      policy_basis: "The recommendation type was decided deterministically by policy rules.",
      reasoning_and_tradeoffs:
        "Returning a safe default avoids acting on malformed output. A retry can provide a valid response.",
      uncertainty_and_confidence: "High uncertainty due to invalid model output.",
      next_review_or_trigger: "Retry the request or provide missing inputs if prompted.",
    },
  };

  const response = (modelResponse && typeof modelResponse === "object" ? modelResponse : null) as {
    recommendation_summary?: string;
    proposed_actions?: DecisionSnapshot["recommendation"]["proposed_actions"];
    explanation?: DecisionSnapshot["explanation"];
  } | null;
  let validatedResponse = response ?? invalidResponseFallback;
  let usedFallback = validatedResponse === invalidResponseFallback;

  if (!validatedResponse.recommendation_summary || typeof validatedResponse.recommendation_summary !== "string") {
    validatedResponse = invalidResponseFallback;
    usedFallback = true;
  }
  if (!validatedResponse.explanation || typeof validatedResponse.explanation !== "object") {
    validatedResponse = invalidResponseFallback;
    usedFallback = true;
  }
  if (validatedResponse.proposed_actions === undefined) {
    validatedResponse.proposed_actions = [];
  }
  if (!Array.isArray(validatedResponse.proposed_actions)) {
    validatedResponse = invalidResponseFallback;
    usedFallback = true;
  }

  const explanation = validatedResponse.explanation as DecisionSnapshot["explanation"];
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
      validatedResponse = invalidResponseFallback;
      usedFallback = true;
      break;
    }
  }

  if (validatedResponse !== invalidResponseFallback) {
    const policyBasis = explanation.policy_basis;
    const { EQUITIES, BONDS, CASH } = policy.strategic_asset_allocation.target_weights;
    const targetPattern = /target[^0-9]*equities[^0-9]*([0-9]+(?:\.[0-9]+)?)%?[^0-9]*bonds[^0-9]*([0-9]+(?:\.[0-9]+)?)%?[^0-9]*cash[^0-9]*([0-9]+(?:\.[0-9]+)?)%?/i;
    const match = targetPattern.exec(policyBasis);
    if (match) {
      const rawValues = [Number(match[1]), Number(match[2]), Number(match[3])];
      const hasPercent = /%/.test(match[0]);
      const parsed = {
        EQUITIES: parseWeight(rawValues[0], hasPercent),
        BONDS: parseWeight(rawValues[1], hasPercent),
        CASH: parseWeight(rawValues[2], hasPercent),
      };
      const mismatch =
        Math.abs(parsed.EQUITIES - EQUITIES) > EPS ||
        Math.abs(parsed.BONDS - BONDS) > EPS ||
        Math.abs(parsed.CASH - CASH) > EPS;
      if (mismatch) {
        logger.warn(
          {
            policy_targets: policy.strategic_asset_allocation.target_weights,
            mentioned_targets: parsed,
          },
          "[APE] Model policy_basis mentions targets that differ from policy"
        );
      }
    }
  }

  if (validatedResponse !== invalidResponseFallback) {
    const allowedAssetClasses: DecisionSnapshot["recommendation"]["proposed_actions"][number]["asset_class"][] =
      ["EQUITIES", "BONDS", "CASH"];
    const allowedActions: DecisionSnapshot["recommendation"]["proposed_actions"][number]["action"][] = [
      "BUY",
      "SELL",
      "HOLD",
    ];
    for (const [index, action] of validatedResponse.proposed_actions.entries()) {
      if (!action || typeof action !== "object") {
        validatedResponse = invalidResponseFallback;
        usedFallback = true;
        break;
      }
      if (!allowedAssetClasses.includes(action.asset_class)) {
        validatedResponse = invalidResponseFallback;
        usedFallback = true;
        break;
      }
      if (!allowedActions.includes(action.action)) {
        validatedResponse = invalidResponseFallback;
        usedFallback = true;
        break;
      }
      if (action.amount !== null && typeof action.amount !== "number") {
        validatedResponse = invalidResponseFallback;
        usedFallback = true;
        break;
      }
      if (!action.rationale || typeof action.rationale !== "string") {
        validatedResponse = invalidResponseFallback;
        usedFallback = true;
        break;
      }
    }
  }
  if (usedFallback) {
    logger.warn("[APE] Decision model fallback used due to invalid response.");
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
      type: recommendationType,
      summary: validatedResponse.recommendation_summary,
      proposed_actions: validatedResponse.proposed_actions ?? [],
      turnover_estimate: {
        gross_turnover_pct: null, // #TODO: compute once trades are formalised
        trade_count: validatedResponse.proposed_actions?.length ?? 0,
      },
    },

    explanation: validatedResponse.explanation,

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
      warnings: auditWarnings.length ? auditWarnings : undefined,
    },
  };

  return { snapshot };
}
