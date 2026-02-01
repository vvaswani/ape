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
import type { PolicyJson } from "@/lib/infra/policyLoader";

import { loadPolicy } from "@/lib/infra/policyLoader";
import { generateAssistantReply } from "@/lib/infra/mastra";
import { computeDrift } from "@/lib/services/drift";
import { applyGuardrails, type ModelDecision } from "@/lib/services/guardrails";

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

  console.log(
    `[APE] Loaded policy: id=${policy.policy_id} version=${policy.policy_version} source=${policy.source}`
  );

  /**
   * ------------------------------------------------------------------
   * Structured + prompt-derived portfolio state (optional)
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

  const auditWarnings: string[] = [];
  if (!structuredState) {
    console.log("[APE] Form state empty or incomplete:", describeFormState(req.portfolio_state));
  }

  const hasConflict =
    !!parsedState && !!structuredState && statesDiffer(parsedState, structuredState);
  if (hasConflict) {
    const warning =
      "Prompt portfolio state conflicts with the form values. Please confirm the correct inputs.";
    auditWarnings.push(warning);
    console.warn("[APE] Prompt/form conflict:", warning);
  } else if (parsedState && !req.portfolio_state) {
    const warning = "Using prompt-derived portfolio state.";
    auditWarnings.push(warning);
    console.log("[APE] Prompt-derived state:", warning);
  }

  // If there's a conflict, treat the state as missing to force clarification.
  const state: PortfolioStateInput | null = hasConflict
    ? null
    : structuredState ?? parsedState ?? null;

  /**
   * ------------------------------------------------------------------
   * Deterministic drift computation (ONLY if state exists)
   * ------------------------------------------------------------------
   */
  const driftResult = state && hasCompleteWeights(state) ? computeDrift(policy, state) : null;

  const pendingContrib = state?.cash_flows.pending_contributions_gbp ?? null;
  const pendingWithdraw = state?.cash_flows.pending_withdrawals_gbp ?? null;
  const hasCashFlows = (pendingContrib ?? 0) > 0 || (pendingWithdraw ?? 0) > 0;

  const expectedRecommendationType: RecommendationType = !state || !driftResult
    ? "ASK_CLARIFYING_QUESTIONS"
    : hasCashFlows
      ? "REBALANCE_VIA_CONTRIBUTIONS"
      : driftResult.bands_breached
        ? "REBALANCE"
        : "DO_NOTHING";

  /**
   * ------------------------------------------------------------------
   * Build LLM system prompt (minimal authority)
   * ------------------------------------------------------------------
   */
  const prompt = `
Return STRICT JSON ONLY (no markdown, no commentary).

Schema:
{
  "recommendation_type": "DO_NOTHING|REBALANCE|REBALANCE_VIA_CONTRIBUTIONS|DEFER_AND_REVIEW|ASK_CLARIFYING_QUESTIONS",
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
- Use the policy targets and bands provided below; do not invent targets or bands.
- The recommendation type is already decided: ${expectedRecommendationType}. Do NOT change it; only explain it.

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
      "REBALANCE",
      "REBALANCE_VIA_CONTRIBUTIONS",
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
            !allowedAssetClasses.includes(asset_class as "EQUITIES" | "BONDS" | "CASH") ||
            typeof action !== "string" ||
            !allowedActions.includes(action as "BUY" | "SELL" | "HOLD") ||
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

  const guardedModel = guard.overridden
    ? {
        ...guard.model,
        explanation: {
          ...guard.model.explanation,
          decision_summary: `Guardrails override applied. ${guard.warnings.join(" ")}`.trim(),
          policy_basis: `${guard.model.explanation.policy_basis} Guardrails enforced: ${guard.warnings.join(" ")}`.trim(),
          reasoning_and_tradeoffs:
            "Guardrails overrode the model output to keep the recommendation policy-aligned.",
          uncertainty_and_confidence:
            "High confidence in guardrail enforcement; model output was overridden.",
        },
      }
    : guard.model;

  const contract = enforceExplanationContract({
    expectedType: expectedRecommendationType,
    model: guardedModel,
    policy,
  });

  if (contract.overridden || contract.warnings.length) {
    console.warn("[APE] Explanation contract applied:", contract.warnings);
  }

  const finalModel = contract.model;

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
        contract.overridden ? "Explanation contract forced DEFER_AND_REVIEW." : null,
        contract.warnings.length ? `Explanation warnings: ${contract.warnings.join(" | ")}` : null,
        auditWarnings.length ? `Input warnings: ${auditWarnings.join(" | ")}` : null,
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

type ExplanationContractResult = {
  model: ModelDecision;
  warnings: string[];
  overridden: boolean;
};

const REQUIRED_EXPLANATION_FIELDS: Record<
  RecommendationType,
  Array<keyof DecisionSnapshot["explanation"]>
> = {
  DO_NOTHING: [
    "decision_summary",
    "policy_basis",
    "relevant_portfolio_state",
    "reasoning_and_tradeoffs",
    "uncertainty_and_confidence",
    "next_review_or_trigger",
  ],
  REBALANCE: [
    "decision_summary",
    "policy_basis",
    "relevant_portfolio_state",
    "reasoning_and_tradeoffs",
    "uncertainty_and_confidence",
    "next_review_or_trigger",
  ],
  REBALANCE_VIA_CONTRIBUTIONS: [
    "decision_summary",
    "policy_basis",
    "relevant_portfolio_state",
    "reasoning_and_tradeoffs",
    "uncertainty_and_confidence",
    "next_review_or_trigger",
  ],
  ASK_CLARIFYING_QUESTIONS: [
    "decision_summary",
    "policy_basis",
    "reasoning_and_tradeoffs",
    "uncertainty_and_confidence",
    "next_review_or_trigger",
  ],
  DEFER_AND_REVIEW: [
    "decision_summary",
    "policy_basis",
    "reasoning_and_tradeoffs",
    "uncertainty_and_confidence",
    "next_review_or_trigger",
  ],
};

function enforceExplanationContract(args: {
  expectedType: RecommendationType;
  model: ModelDecision;
  policy: PolicyJson;
}): ExplanationContractResult {
  const { expectedType, model, policy } = args;
  const warnings: string[] = [];

  if (model.recommendation_type !== expectedType) {
    warnings.push(
      `recommendation_type mismatch (expected ${expectedType}, got ${model.recommendation_type}).`
    );
    return {
      model: downgradeToDefer(model, policy, "Recommendation type mismatch."),
      warnings,
      overridden: true,
    };
  }

  const required = REQUIRED_EXPLANATION_FIELDS[expectedType];
  for (const key of required) {
    const value = model.explanation[key];
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      warnings.push(`explanation.${key} is missing or blank.`);
    }
  }
  if (warnings.length) {
    return {
      model: downgradeToDefer(model, policy, "Explanation contract violation; safe fallback applied."),
      warnings,
      overridden: true,
    };
  }

  if (!policyBasisReferencesPolicy(model.explanation.policy_basis, policy)) {
    warnings.push("policy_basis does not reference required policy values.");
    return {
      model: downgradeToDefer(model, policy, "Explanation contract violation; policy values missing."),
      warnings,
      overridden: true,
    };
  }

  if (expectedType === "ASK_CLARIFYING_QUESTIONS") {
    const text = `${model.explanation.decision_summary} ${model.explanation.policy_basis} ${model.explanation.reasoning_and_tradeoffs}`.toLowerCase();
    if (!text.includes("missing") && !text.includes("clarify") && !text.includes("provide")) {
      warnings.push("ASK_CLARIFYING_QUESTIONS lacks explicit missing-input disclosure.");
      return {
        model: downgradeToDefer(model, policy, "Missing-input disclosure required."),
        warnings,
        overridden: true,
      };
    }
  }

  if (expectedType === "DEFER_AND_REVIEW") {
    const text = `${model.explanation.decision_summary} ${model.explanation.policy_basis} ${model.explanation.reasoning_and_tradeoffs}`.toLowerCase();
    if (!text.includes("defer") && !text.includes("review")) {
      warnings.push("DEFER_AND_REVIEW lacks explicit defer/review rationale.");
      return {
        model: downgradeToDefer(model, policy, "Defer rationale required."),
        warnings,
        overridden: true,
      };
    }
  }

  return { model, warnings, overridden: false };
}

function policyBasisReferencesPolicy(policyBasis: string, policy: PolicyJson): boolean {
  const targets = policy.strategic_asset_allocation.target_weights;
  const bands = policy.rebalancing_policy.absolute_bands;
  const values = [
    targets.EQUITIES,
    targets.BONDS,
    targets.CASH,
    bands.EQUITIES,
    bands.BONDS,
    bands.CASH,
  ];

  return values.every((value) => valueMentioned(policyBasis, value));
}

function valueMentioned(text: string, value: number): boolean {
  const decimal = value.toString();
  const percent = (value * 100).toString();
  return text.includes(decimal) || text.includes(percent);
}

function downgradeToDefer(model: ModelDecision, policy: PolicyJson, reason: string): ModelDecision {
  return {
    ...model,
    recommendation_type: "DEFER_AND_REVIEW",
    recommendation_summary: "Defer and review required before proceeding.",
    proposed_actions: [],
    explanation: {
      decision_summary: reason,
      relevant_portfolio_state: model.explanation.relevant_portfolio_state || "Not provided.",
      policy_basis: `Policy ${policy.policy_id} v${policy.policy_version} (${policy.source}).`,
      reasoning_and_tradeoffs: "Cannot safely justify action; returning defer.",
      uncertainty_and_confidence: "Low confidence due to contract violation.",
      next_review_or_trigger: "Fix explanation contract and retry.",
    },
  };
}
