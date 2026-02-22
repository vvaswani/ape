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
import type {
  DecisionSnapshot,
  OutcomeState,
  PolicyItemReference,
  RecommendationType,
  SnapshotNotice,
} from "@/lib/domain/decisionSnapshot";
import type { AuthorityContext } from "@/lib/domain/authority";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";
import type { RiskInputs } from "@/lib/domain/riskInputs";
import type { PolicyJson } from "@/lib/infra/policyLoader";

import { loadPolicy } from "@/lib/infra/policyLoader";
import { generateAssistantReply } from "@/lib/infra/mastra";
import { computeDrift } from "@/lib/services/drift";
import {
  applyGuardrails,
  evaluateAuthority,
  evaluateRiskGuardrails,
  type ModelDecision,
} from "@/lib/services/guardrails";

const SNAPSHOT_VERSION = "0.3";
const EPS = 1e-6;

const DPQ_AUTHORITY = "DPQ-001";
const DPQ_DRIFT = "DPQ-002";
const DPQ_CASHFLOW = "DPQ-003";
const DPQ_RISK = "DPQ-004";

const POLICY_ITEMS: PolicyItemReference[] = [
  { dpq_id: DPQ_AUTHORITY },
  { dpq_id: DPQ_DRIFT },
  { dpq_id: DPQ_CASHFLOW },
  { dpq_id: DPQ_RISK },
];

const REASON_CODES = {
  MISSING_INPUTS: "MISSING_INPUTS",
  DRIFT_CANNOT_COMPUTE: "DRIFT_CANNOT_COMPUTE",
  CONTRADICTION_DETECTED: "CONTRADICTION_DETECTED",
  SKIPPED_NOT_APPLICABLE: "SKIPPED_NOT_APPLICABLE",
  POLICY_APPLIED: "POLICY_APPLIED",
  PARTIAL_APPLY: "PARTIAL_APPLY",
  BLOCKED: "BLOCKED",
} as const;

function findPolicyItem(dpqId: string): PolicyItemReference | null {
  const match = POLICY_ITEMS.find((p) => p.dpq_id === dpqId);
  return match ?? null;
}

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

function listMissingInputs(
  state: PortfolioStateInput | null,
  hasPortfolioStateProvided: boolean
): Array<{ input_key: string; impact: string }> {
  const missing: Array<{ input_key: string; impact: string }> = [];
  if (!state) {
    return [
      ...(hasPortfolioStateProvided
        ? []
        : [{ input_key: "portfolio_state.weights", impact: "Required to compute drift and recommendation." }]),
      { input_key: "portfolio_state.cash_flows", impact: "Required to assess cashflow-driven rebalancing." },
      { input_key: "portfolio_state.total_value", impact: "Required for sizing and validation." },
    ];
  }

  if (
    !hasPortfolioStateProvided &&
    (state.weights.EQUITIES === null || state.weights.BONDS === null || state.weights.CASH === null)
  ) {
    missing.push({
      input_key: "portfolio_state.weights",
      impact: "Required to compute drift and recommendation.",
    });
  }
  if (state.cash_flows.pending_contributions_gbp === null || state.cash_flows.pending_withdrawals_gbp === null) {
    missing.push({
      input_key: "portfolio_state.cash_flows",
      impact: "Required to assess cashflow-driven rebalancing.",
    });
  }
  if (state.total_value_gbp === null) {
    missing.push({
      input_key: "portfolio_state.total_value",
      impact: "Required for sizing and validation.",
    });
  }
  return missing;
}

function outcomeFromRecommendation(type: RecommendationType): OutcomeState {
  switch (type) {
    case "DO_NOTHING":
      return "RECOMMEND_NO_ACTION";
    case "ASK_CLARIFYING_QUESTIONS":
      return "CANNOT_DECIDE_MISSING_INPUTS";
    case "DEFER_AND_REVIEW":
      return "CANNOT_DECIDE_POLICY_GAP";
    default:
      return "RECOMMEND_ACTION";
  }
}

function policyItemsForContext(args: {
  hasAuthorityCheck: boolean;
  hasDriftCheck: boolean;
  hasCashflowCheck: boolean;
  hasRiskCheck: boolean;
}): PolicyItemReference[] {
  const refs: PolicyItemReference[] = [];
  if (args.hasAuthorityCheck) {
    const item = findPolicyItem(DPQ_AUTHORITY);
    if (item) refs.push(item);
  }
  if (args.hasDriftCheck) {
    const item = findPolicyItem(DPQ_DRIFT);
    if (item) refs.push(item);
  }
  if (args.hasCashflowCheck) {
    const item = findPolicyItem(DPQ_CASHFLOW);
    if (item) refs.push(item);
  }
  if (args.hasRiskCheck) {
    const item = findPolicyItem(DPQ_RISK);
    if (item) refs.push(item);
  }
  return refs;
}

function detectContradiction(args: {
  expected: RecommendationType;
  model: RecommendationType;
  hasState: boolean;
  driftResult: ReturnType<typeof computeDrift> | null;
}): string | null {
  if (!args.hasState || !args.driftResult) return null;
  if (args.model !== args.expected) {
    return `Model recommendation ${args.model} contradicts deterministic expectation ${args.expected}.`;
  }
  return null;
}

function buildDriftEvaluation(args: {
  hasPortfolioStateProvided: boolean;
  driftResult: ReturnType<typeof computeDrift> | null;
  policy: PolicyJson;
}) {
  if (args.driftResult) {
    return {
      status: "computed" as const,
      target_weights: {
        EQUITIES: args.policy.strategic_asset_allocation.target_weights.EQUITIES,
        BONDS: args.policy.strategic_asset_allocation.target_weights.BONDS,
        CASH: args.policy.strategic_asset_allocation.target_weights.CASH,
      },
      actual_weights: {
        EQUITIES: args.driftResult.actual_weights.EQUITIES,
        BONDS: args.driftResult.actual_weights.BONDS,
        CASH: args.driftResult.actual_weights.CASH,
      },
      absolute_drift: {
        EQUITIES: args.driftResult.absolute_drift.EQUITIES,
        BONDS: args.driftResult.absolute_drift.BONDS,
        CASH: args.driftResult.absolute_drift.CASH,
      },
      bands_breached: args.driftResult.bands_breached,
    };
  }

  if (args.hasPortfolioStateProvided) {
    return {
      status: "cannot_compute" as const,
    };
  }

  return {
    status: "not_applicable" as const,
  };
}

function buildPolicyAppliedEvaluation(args: {
  policy: PolicyJson;
  hasPortfolioStateProvided: boolean;
  evaluatedPolicies: string[];
  skippedPolicies: Array<{ dpq_id: string; reason: string }>;
  riskGuardrailsUsed: string[];
  contradictionDetected: boolean;
  reasonCodes: string[];
  blockingInputs?: string[];
}) {
  const targets = args.policy.strategic_asset_allocation.target_weights;
  const bands = args.policy.rebalancing_policy.absolute_bands;
  const totalPolicies = [DPQ_AUTHORITY, DPQ_DRIFT, DPQ_CASHFLOW, DPQ_RISK];

  const evaluated = args.evaluatedPolicies;
  const skipped = args.skippedPolicies;
  const evaluatedCount = evaluated.length;

  let status: "applied" | "not_applied" | "partial" | "blocked" = "applied";
  if (args.contradictionDetected) {
    status = "blocked";
  } else if (evaluatedCount === 0) {
    status = "not_applied";
  } else if (evaluatedCount < totalPolicies.length || skipped.length > 0) {
    status = "partial";
  }

  return {
    targets: args.hasPortfolioStateProvided ? targets : null,
    bands: args.hasPortfolioStateProvided ? bands : null,
    risk_guardrails_used: args.riskGuardrailsUsed,
    evaluated_policies: evaluated,
    skipped_policies: skipped,
    status,
    reason_codes: args.reasonCodes,
    blocking_inputs: args.blockingInputs,
  };
}

function buildCorrectnessEvaluation(args: {
  checksRun: string[];
  contradictionDetected: boolean;
  hasPortfolioStateProvided: boolean;
  driftResult: ReturnType<typeof computeDrift> | null;
  riskEvalStatus: ReturnType<typeof evaluateRiskGuardrails>["status"];
}) {
  if (args.contradictionDetected) {
    return {
      status: "fail" as const,
      checks_run: args.checksRun,
      failed_checks: ["CONTRADICTION_DETECTED"],
    };
  }

  if (args.hasPortfolioStateProvided && !args.driftResult) {
    return {
      status: "indeterminate" as const,
      checks_run: args.checksRun,
      failed_checks: ["DRIFT_CANNOT_COMPUTE"],
    };
  }

  if (args.riskEvalStatus === "MISSING_INPUTS") {
    return {
      status: "indeterminate" as const,
      checks_run: args.checksRun,
      failed_checks: ["RISK_INPUTS_MISSING"],
    };
  }

  return {
    status: "pass" as const,
    checks_run: args.checksRun,
  };
}

/**
 * Main entry point for decision generation.
 */
export async function runDecision(req: ChatRequest): Promise<{ snapshot: DecisionSnapshot }> {
  const snapshotId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (!Array.isArray(req.messages)) {
    const errorSnapshot: DecisionSnapshot = {
      snapshot_id: snapshotId,
      snapshot_version: SNAPSHOT_VERSION,
      created_at: createdAt,
      project: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",
      outcome_state: "ERROR_NONRECOVERABLE",
      inputs_observed: [],
      inputs_missing: [],
      inputs_provenance: {
        risk_inputs: "missing",
        authority: "missing",
      },
      inputs_evaluated: {
        risk_inputs: false,
        authority: false,
      },
      policy_items_referenced: [],
      warnings: [],
      errors: [
        {
          code: "INVALID_REQUEST",
          message: "messages must be an array",
          fields: ["messages"],
        },
      ],
      context: {
        user_id: "local",
        environment: "dev",
        jurisdiction: "UK",
        base_currency: "GBP",
      },
      inputs: {
        portfolio_state: {
          total_value: null,
          asset_allocation: { EQUITIES: null, BONDS: null, CASH: null },
          positions_summary: "Not provided.",
          cash_balance: null,
        },
        cash_flows: {
          pending_contributions: null,
          pending_withdrawals: null,
          notes: "Not provided.",
        },
        constraints: {
          liquidity_needs: "Not captured yet.",
          tax_or_wrapper_constraints: "Not captured yet.",
          other_constraints: "Not captured yet.",
        },
        market_context: {
          as_of_date: new Date().toISOString().slice(0, 10),
          notes: "No exceptional market context assumed.",
        },
      },
      governance: {
        investment_policy: {
          policy_id: "unknown",
          policy_version: "unknown",
          policy_source: "unknown",
        },
        explanation_contract: {
          version: "0.1-default",
        },
      },
      evaluation: {
        policy_applied: {
          targets: null,
          bands: null,
          risk_guardrails_used: [],
          evaluated_policies: [],
          skipped_policies: [],
          status: "not_applied",
          reason_codes: ["INVALID_REQUEST"],
        },
        correctness: {
          status: "indeterminate",
          checks_run: [],
          failed_checks: ["INVALID_REQUEST"],
        },
        drift: {
          status: "not_applicable",
        },
        drift_analysis: {
          target_weights: { EQUITIES: 0, BONDS: 0, CASH: 0 },
          actual_weights: { EQUITIES: null, BONDS: null, CASH: null },
          absolute_drift: { EQUITIES: null, BONDS: null, CASH: null },
          bands_breached: null,
        },
        risk_checks: {
          drawdown_proximity: "Not evaluated.",
          risk_capacity_breached: null,
          notes: "Not evaluated.",
        },
      },
      recommendation: {
        type: "DEFER_AND_REVIEW",
        summary: "Invalid request; unable to evaluate.",
        proposed_actions: [],
        turnover_estimate: {
          gross_turnover_pct: null,
          trade_count: null,
        },
      },
      explanation: {
        decision_summary: "Invalid request; missing messages array.",
        relevant_portfolio_state: "No portfolio state.",
        policy_basis: "Policy unavailable due to invalid request.",
        reasoning_and_tradeoffs: "Cannot evaluate without a valid request payload.",
        uncertainty_and_confidence: "High uncertainty due to invalid request.",
        next_review_or_trigger: "Fix request payload and retry.",
      },
      user_acknowledgement: {
        decision: "DEFER",
        acknowledged_at: null,
        user_notes: "Invalid request payload.",
      },
      outcome: {
        implemented: null,
        implementation_notes: null,
        review_date: null,
        observed_effects: null,
      },
      audit: {
        logic_version: SNAPSHOT_VERSION,
        notes: "Invalid request; snapshot generated for error reporting.",
      },
    };
    return { snapshot: errorSnapshot };
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
  const hasPortfolioStateProvided =
    !!req.portfolio_state && !isEmptyState(req.portfolio_state);
  const structuredState =
    req.portfolio_state &&
    hasPortfolioStateProvided &&
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

  const authority: AuthorityContext = req.authority ?? {
    actor_role: "USER",
    decision_intent: "ADVISE",
  };

  const riskInputs: RiskInputs | null = req.risk_inputs ?? null;

  /**
   * ------------------------------------------------------------------
   * Deterministic drift computation (ONLY if state exists)
   * ------------------------------------------------------------------
   */
  const driftResult = state && hasCompleteWeights(state) ? computeDrift(policy, state) : null;

  const pendingContrib = state?.cash_flows.pending_contributions_gbp ?? null;
  const pendingWithdraw = state?.cash_flows.pending_withdrawals_gbp ?? null;
  const hasCashFlows = (pendingContrib ?? 0) > 0 || (pendingWithdraw ?? 0) > 0;

  const baseRecommendationType: RecommendationType = !state
    ? hasConflict
      ? "ASK_CLARIFYING_QUESTIONS"
      : hasPortfolioStateProvided
        ? "DEFER_AND_REVIEW"
        : "ASK_CLARIFYING_QUESTIONS"
    : !driftResult
      ? "DEFER_AND_REVIEW"
      : hasCashFlows
        ? "REBALANCE_VIA_CONTRIBUTIONS"
        : driftResult.bands_breached
          ? "REBALANCE"
          : "DO_NOTHING";

  const authorityViolation = evaluateAuthority(authority);
  const riskEval = evaluateRiskGuardrails({
    policy,
    risk_inputs: riskInputs,
    has_state: !!state,
  });
  const inputsProvenance = {
    risk_inputs: req.risk_inputs ? ("supplied" as const) : ("missing" as const),
    authority: req.authority ? ("supplied" as const) : ("derived" as const),
  };
  const inputsEvaluated = {
    risk_inputs:
      inputsProvenance.risk_inputs !== "missing" &&
      typeof riskInputs?.risk_capacity_breached === "boolean" &&
      typeof riskInputs?.rolling_12m_drawdown_pct === "number" &&
      Number.isFinite(riskInputs.rolling_12m_drawdown_pct),
    authority: true,
  };

  const preflightOverride: RecommendationType | null = authorityViolation
    ? "DEFER_AND_REVIEW"
    : riskEval.override_type ?? null;

  const expectedRecommendationType: RecommendationType =
    preflightOverride ?? baseRecommendationType;

  const policyItems = policyItemsForContext({
    hasAuthorityCheck: true,
    hasDriftCheck: !!driftResult,
    hasCashflowCheck: !!state,
    hasRiskCheck: true,
  });

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
- Align strictly with the Portfolio Guidelines and policy JSON.
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
      : hasPortfolioStateProvided
        ? `
Portfolio state was provided but is incomplete for deterministic evaluation.
- Do NOT ask for weights.
- Defer safely and explain which inputs are missing.
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
      policy_basis: buildPolicyBasis(policy),
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
              policy_basis: buildPolicyBasis(policy),
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
  const contradictionMessage = detectContradiction({
    expected: expectedRecommendationType,
    model: modelDecision.recommendation_type,
    hasState: !!state,
    driftResult,
  });
  const contradictionDetected = !!contradictionMessage;

  const guard = contradictionDetected
    ? {
        model: {
          ...downgradeToDefer(
            modelDecision,
            policy,
            "Contradiction detected between model output and deterministic evaluation."
          ),
          proposed_actions: [],
        },
        warnings: contradictionMessage ? [contradictionMessage] : [],
        overridden: true,
      }
    : applyGuardrails(
        {
          policy,
          portfolio_state: state,
          drift: driftResult,
          risk_inputs: riskInputs,
          authority,
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
  const missingInputs = listMissingInputs(state, hasPortfolioStateProvided);
  let outcomeState: OutcomeState =
    missingInputs.length > 0 && (!state || expectedRecommendationType === "ASK_CLARIFYING_QUESTIONS")
      ? "CANNOT_DECIDE_MISSING_INPUTS"
      : outcomeFromRecommendation(finalModel.recommendation_type);
  if (contradictionDetected) {
    outcomeState = "ERROR_NONRECOVERABLE";
  }
  const warnings: SnapshotNotice[] = [];
  const errors: SnapshotNotice[] = [];

  if (outcomeState === "CANNOT_DECIDE_MISSING_INPUTS" && missingInputs.length === 0) {
    warnings.push({
      code: "MISSING_INPUTS_UNSPECIFIED",
      message: "Missing inputs expected but none were recorded.",
    });
  }

  if (riskEval.status === "POLICY_MISSING") {
    warnings.push({
      code: "POLICY_GAP_RISK_GUARDRAILS",
      message: "Risk guardrails missing or invalid in policy.",
      fields: ["policy.risk_guardrails"],
    });
  }

  if (authorityViolation) {
    warnings.push({
      code: "AUTHORITY_VIOLATION",
      message: authorityViolation,
      fields: ["authority.actor_role", "authority.decision_intent"],
    });
  }

  if (contradictionDetected) {
    errors.push({
      code: "CONTRADICTION_DETECTED",
      message:
        contradictionMessage ??
        "Contradiction detected between model output and deterministic evaluation.",
      fields: ["recommendation.type"],
    });
  }

  if (hasPortfolioStateProvided && !driftResult) {
    warnings.push({
      code: "DRIFT_CANNOT_COMPUTE",
      message: "Portfolio state provided but drift could not be computed.",
    });
  }

  const inputsObserved = [
    ...(state
      ? [
          { input_key: "portfolio_state.weights", value: "provided", source: "form" as const },
          { input_key: "portfolio_state.cash_flows", value: "provided", source: "form" as const },
          { input_key: "portfolio_state.total_value", value: state.total_value_gbp, source: "form" as const },
        ]
      : []),
    ...(parsedState && !state
      ? [
          { input_key: "portfolio_state.weights", value: "provided", source: "prompt" as const },
          { input_key: "portfolio_state.cash_flows", value: "provided", source: "prompt" as const },
        ]
      : []),
    ...(riskInputs
      ? [
          {
            input_key: "risk_inputs.rolling_12m_drawdown_pct",
            value: riskInputs.rolling_12m_drawdown_pct ?? null,
            source: "request" as const,
          },
          {
            input_key: "risk_inputs.risk_capacity_breached",
            value: riskInputs.risk_capacity_breached ?? null,
            source: "request" as const,
          },
        ]
      : []),
    ...(authority
      ? [
          { input_key: "authority.actor_role", value: authority.actor_role, source: "request" as const },
          { input_key: "authority.decision_intent", value: authority.decision_intent, source: "request" as const },
        ]
      : []),
  ];

  const evaluatedPolicies: string[] = [];
  const skippedPolicies: Array<{ dpq_id: string; reason: string }> = [];

  evaluatedPolicies.push(DPQ_AUTHORITY);
  evaluatedPolicies.push(DPQ_RISK);

  if (driftResult) {
    evaluatedPolicies.push(DPQ_DRIFT);
  } else if (hasPortfolioStateProvided) {
    skippedPolicies.push({ dpq_id: DPQ_DRIFT, reason: REASON_CODES.DRIFT_CANNOT_COMPUTE });
  } else {
    skippedPolicies.push({ dpq_id: DPQ_DRIFT, reason: REASON_CODES.MISSING_INPUTS });
  }

  if (state) {
    evaluatedPolicies.push(DPQ_CASHFLOW);
  } else {
    skippedPolicies.push({ dpq_id: DPQ_CASHFLOW, reason: REASON_CODES.MISSING_INPUTS });
  }

  const reasonCodes: string[] = [];
  if (missingInputs.length > 0) reasonCodes.push(REASON_CODES.MISSING_INPUTS);
  if (hasPortfolioStateProvided && !driftResult) reasonCodes.push(REASON_CODES.DRIFT_CANNOT_COMPUTE);
  if (contradictionDetected) reasonCodes.push(REASON_CODES.CONTRADICTION_DETECTED);

  const policyApplied = buildPolicyAppliedEvaluation({
    policy,
    hasPortfolioStateProvided,
    evaluatedPolicies,
    skippedPolicies,
    riskGuardrailsUsed: [DPQ_RISK],
    contradictionDetected,
    reasonCodes: reasonCodes.length ? reasonCodes : [REASON_CODES.POLICY_APPLIED],
    blockingInputs: missingInputs.length ? missingInputs.map((m) => m.input_key) : undefined,
  });

  const correctness = buildCorrectnessEvaluation({
    checksRun: [
      "AUTHORITY_CHECK",
      "RISK_GUARDRAILS",
      "DRIFT_EVALUATION",
      "CONTRADICTION_CHECK",
    ],
    contradictionDetected,
    hasPortfolioStateProvided,
    driftResult,
    riskEvalStatus: riskEval.status,
  });

  const driftEvaluation = buildDriftEvaluation({
    hasPortfolioStateProvided,
    driftResult,
    policy,
  });

  const snapshot: DecisionSnapshot = {
    snapshot_id: snapshotId,
    snapshot_version: SNAPSHOT_VERSION,
    created_at: createdAt,

    project: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",

    outcome_state: outcomeState,
    inputs_observed: inputsObserved,
    inputs_missing: outcomeState === "CANNOT_DECIDE_MISSING_INPUTS" ? missingInputs : [],
    inputs_provenance: inputsProvenance,
    inputs_evaluated: inputsEvaluated,
    policy_items_referenced: policyItems,
    warnings,
    errors,

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
      policy_applied: policyApplied,
      correctness,
      drift: driftEvaluation,
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
        drawdown_proximity: formatDrawdownNote(riskEval),
        risk_capacity_breached: riskEval.risk_capacity_breached,
        notes: formatRiskNotes(riskEval, authorityViolation),
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
        authorityViolation ? "Authority guardrail enforced." : null,
        riskEval.status !== "OK" ? `Risk guardrails status: ${riskEval.status}.` : null,
        contract.overridden ? "Explanation contract forced DEFER_AND_REVIEW." : null,
        contract.warnings.length ? `Explanation warnings: ${contract.warnings.join(" | ")}` : null,
        auditWarnings.length ? `Input warnings: ${auditWarnings.join(" | ")}` : null,
        "#TODO: add structured audit.guardrails when schema supports it.",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };

  if (outcomeState === "CANNOT_DECIDE_POLICY_GAP" && warnings.length === 0) {
    warnings.push({
      code: "POLICY_GAP",
      message: "Decision deferred due to policy gap or guardrail override.",
    });
  }

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
    const mismatchReason = model.explanation.decision_summary.includes("Guardrails override")
      ? model.explanation.decision_summary
      : "Recommendation type mismatch.";
    if (expectedType === "ASK_CLARIFYING_QUESTIONS") {
      return {
        model: forceAsk(model, mismatchReason),
        warnings,
        overridden: true,
      };
    }
    return {
      model: downgradeToDefer(model, policy, mismatchReason),
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

function buildPolicyBasis(policy: PolicyJson): string {
  const targets = policy.strategic_asset_allocation.target_weights;
  const bands = policy.rebalancing_policy.absolute_bands;
  return `Policy ${policy.policy_id} v${policy.policy_version} (${policy.source}). Targets: equities ${targets.EQUITIES}, bonds ${targets.BONDS}, cash ${targets.CASH}. Bands: equities ${bands.EQUITIES}, bonds ${bands.BONDS}, cash ${bands.CASH}.`;
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
      policy_basis: buildPolicyBasis(policy),
      reasoning_and_tradeoffs: "Cannot safely justify action; returning defer.",
      uncertainty_and_confidence: "Low confidence due to contract violation.",
      next_review_or_trigger: "Fix explanation contract and retry.",
    },
  };
}

function forceAsk(model: ModelDecision, reason: string): ModelDecision {
  return {
    ...model,
    recommendation_type: "ASK_CLARIFYING_QUESTIONS",
    recommendation_summary: "Additional inputs required before a recommendation can be made.",
    proposed_actions: [],
    explanation: {
      decision_summary: reason,
      relevant_portfolio_state: model.explanation.relevant_portfolio_state || "Inputs were missing.",
      policy_basis: model.explanation.policy_basis,
      reasoning_and_tradeoffs: "Cannot proceed without required inputs.",
      uncertainty_and_confidence: "High uncertainty due to missing inputs.",
      next_review_or_trigger: "Provide the missing inputs and retry.",
    },
  };
}

function formatDrawdownNote(riskEval: ReturnType<typeof evaluateRiskGuardrails>): string {
  if (riskEval.drawdown_observed === null || riskEval.drawdown_limit === null) {
    return "Rolling 12-month drawdown input missing.";
  }
  return `Rolling 12-month drawdown ${riskEval.drawdown_observed} vs limit ${riskEval.drawdown_limit}.`;
}

function formatRiskNotes(
  riskEval: ReturnType<typeof evaluateRiskGuardrails>,
  authorityViolation: string | null
): string {
  if (authorityViolation) {
    return "Authority violation detected; decision deferred.";
  }
  switch (riskEval.status) {
    case "OK":
      return "Risk guardrails satisfied.";
    case "MISSING_INPUTS":
      return "Risk inputs missing; guardrails enforced safe fallback.";
    case "BREACH":
      return "Risk guardrail breach detected; decision deferred.";
    case "POLICY_MISSING":
      return "Risk guardrails missing or invalid; decision deferred.";
    default:
      return "Risk guardrails evaluated.";
  }
}

