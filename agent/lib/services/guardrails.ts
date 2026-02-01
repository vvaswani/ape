/**
 * @file guardrails.ts
 * @description
 * Milestone #3b guardrails: enforce deterministic constraints on model output.
 *
 * Core principle:
 * - Deterministic facts (policy + portfolio_state + drift) are authoritative.
 * - The LLM may provide recommendation/explanation only within those boundaries.
 * - If the LLM contradicts deterministic evaluation, we override to a safe outcome.
 *
 * This prevents "vibe coding" failures where the model improvises trades or asks
 * for weights that already exist.
 */

import type { PolicyJson } from "@/lib/infra/policyLoader";
import type { DriftResult } from "@/lib/services/drift";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";
import type { RecommendationType } from "@/lib/domain/decisionSnapshot";

/**
 * @description Minimal structured shape expected from the model (after JSON parsing).
 *
 * Keep this intentionally small and stable:
 * - decisionService owns snapshot construction and deterministic fields
 * - model provides only recommendation/explanation + optional proposed actions
 */
export interface ModelDecision {
  /**
   * @description Recommendation type selected by the model.
   */
  recommendation_type: RecommendationType;

  /**
   * @description One-sentence summary of the recommendation.
   */
  recommendation_summary: string;

  /**
   * @description Explanation payload (per explanation contract).
   */
  explanation: {
    decision_summary: string;
    relevant_portfolio_state: string;
    policy_basis: string;
    reasoning_and_tradeoffs: string;
    uncertainty_and_confidence: string;
    next_review_or_trigger: string;
  };

  /**
   * @description Optional actions (may be omitted by the model).
   */
  proposed_actions?: Array<{
    asset_class: "EQUITIES" | "BONDS" | "CASH";
    action: "BUY" | "SELL" | "HOLD";
    amount?: number | null;
    rationale: string;
  }>;
}

/**
 * @description Context required to enforce guardrails.
 */
export interface GuardrailContext {
  policy: PolicyJson;
  portfolio_state: PortfolioStateInput | null;
  drift: DriftResult | null;
}

/**
 * @description Result of guardrail enforcement.
 */
export interface GuardrailOutcome {
  model: ModelDecision;
  warnings: string[];
  overridden: boolean;
}

/**
 * @description
 * Guardrail 2: deterministic evaluation completeness.
 *
 * If portfolio_state is present, drift must be present and fully populated.
 * If not, we should not trust downstream decisions (even if model output is valid JSON).
 */
export function validateDeterministicCompleteness(ctx: GuardrailContext): string[] {
  const warnings: string[] = [];

  if (!ctx.portfolio_state) return warnings;

  if (!ctx.drift) {
    warnings.push("portfolio_state provided but drift is missing.");
    return warnings;
  }

  if (typeof ctx.drift.bands_breached !== "boolean") {
    warnings.push("drift.bands_breached must be boolean when portfolio_state is provided.");
  }

  const keys: Array<keyof DriftResult["actual_weights"]> = ["EQUITIES", "BONDS", "CASH"];

  for (const k of keys) {
    if (typeof ctx.drift.actual_weights[k] !== "number") {
      warnings.push(`drift.actual_weights.${k} is missing/invalid.`);
    }
    if (typeof ctx.drift.absolute_drift[k] !== "number") {
      warnings.push(`drift.absolute_drift.${k} is missing/invalid.`);
    }
  }

  return warnings;
}

/**
 * @description
 * Apply Milestone #3b guardrails to a parsed model decision.
 *
 * Enforced rules:
 * 1) If portfolio_state exists, ASK_CLARIFYING_QUESTIONS is not permitted.
 * 2) If deterministic evaluation is incomplete, force DEFER_AND_REVIEW.
 * 3) If in-band and no cash flows, rebalance recommendations/actions are not permitted.
 * 4) If out-of-band, DO_NOTHING is not permitted (force DEFER_AND_REVIEW).
 * 5) Proposed actions must be coherent with supported asset classes and basic numeric sanity.
 */
export function applyGuardrails(ctx: GuardrailContext, modelIn: ModelDecision): GuardrailOutcome {
  let model: ModelDecision = normalizeModelDecision(modelIn);

  const warnings: string[] = [];
  let overridden = false;

  const hasState = !!ctx.portfolio_state;
  const drift = ctx.drift;

  // Guardrail 2: deterministic completeness (fail-safe)
  const detWarnings = validateDeterministicCompleteness(ctx);
  if (detWarnings.length > 0) {
    warnings.push(...detWarnings);
    overridden = true;

    model = forceDefer(
      model,
      "Deterministic evaluation incomplete; cannot recommend safely."
    );
    model.proposed_actions = [];

    return { model, warnings, overridden };
  }

  // Cash flows (optional but part of PortfolioStateInput)
  const pendingContrib = ctx.portfolio_state?.cash_flows.pending_contributions_gbp ?? null;
  const pendingWithdraw = ctx.portfolio_state?.cash_flows.pending_withdrawals_gbp ?? null;
  const hasCashFlows = (pendingContrib ?? 0) > 0 || (pendingWithdraw ?? 0) > 0;

  // Guardrail 1: state present => cannot ask for weights
  if (hasState && model.recommendation_type === "ASK_CLARIFYING_QUESTIONS") {
    warnings.push("Model returned ASK_CLARIFYING_QUESTIONS despite portfolio_state being provided.");
    overridden = true;

    model = forceDefer(
      model,
      "Portfolio state was provided; asking for weights is not permitted."
    );
  }

  if (hasState && drift) {
    // Guardrail 3: in-band & no cash flows => no rebalance actions
    if (drift.bands_breached === false && !hasCashFlows) {
      const actions = model.proposed_actions ?? [];

      const rebalanceRequested =
        model.recommendation_type !== "DO_NOTHING" &&
        model.recommendation_type !== "DEFER_AND_REVIEW";

      if (rebalanceRequested || actions.length > 0) {
        warnings.push("In-band and no cash flows: rebalance recommendations/actions are not permitted.");
        overridden = true;

        model.recommendation_type = "DO_NOTHING";
        model.recommendation_summary = "No action required; portfolio is within policy rebalancing bands.";
        model.proposed_actions = [];

        // Keep explanation aligned with the enforced outcome.
        model.explanation = {
          ...model.explanation,
          decision_summary: "Portfolio is within policy bands and there are no cash flows; no rebalance is required.",
          policy_basis: "Policy uses band-based rebalancing; no band breach detected.",
          uncertainty_and_confidence: "High confidence (deterministic evaluation).",
          next_review_or_trigger: "Review at next cadence or if bands are breached.",
        };
      }
    }

    // Guardrail 4: out-of-band => DO_NOTHING not allowed
    if (drift.bands_breached === true && model.recommendation_type === "DO_NOTHING") {
      warnings.push("Out-of-band drift detected: DO_NOTHING is not permitted.");
      overridden = true;

      model = forceDefer(
        model,
        "Drift breached policy bands; action requires review of constraints or execution preferences."
      );
      model.proposed_actions = [];
    }
  }

  // Guardrail 5: action coherence
  // In Milestone #3b, supported asset classes are fixed to those present in PolicyJson and DriftResult.
  // #TODO: if PolicyJson later adds an explicit asset_classes list, derive from policy instead.
  const validAssetClasses = new Set<"EQUITIES" | "BONDS" | "CASH">([
    "EQUITIES",
    "BONDS",
    "CASH",
  ]);

  const actions = model.proposed_actions ?? [];
  const filtered = actions.filter((a) => {
    if (!validAssetClasses.has(a.asset_class)) {
      warnings.push(`Proposed action has invalid asset_class: ${a.asset_class}`);
      overridden = true;
      return false;
    }

    // amount may be undefined or null (e.g., "allocate contribution to bonds" without a number)
    if (a.amount !== undefined && a.amount !== null) {
      if (!Number.isFinite(a.amount) || a.amount <= 0) {
        warnings.push("Proposed action has invalid amount (must be null/undefined or > 0).");
        overridden = true;
        return false;
      }
    }

    return true;
  });

  if (filtered.length !== actions.length) {
    model.proposed_actions = filtered;
  } else if (!model.proposed_actions) {
    model.proposed_actions = [];
  }

  return { model, warnings, overridden };
}

/**
 * @description Normalize optional fields so downstream code has stable shapes.
 */
function normalizeModelDecision(model: ModelDecision): ModelDecision {
  return {
    ...model,
    proposed_actions: model.proposed_actions ?? [],
  };
}

/**
 * @description Force a safe DEFER_AND_REVIEW outcome while keeping the explanation structure intact.
 */
function forceDefer(model: ModelDecision, reason: string): ModelDecision {
  return {
    ...model,
    recommendation_type: "DEFER_AND_REVIEW",
    recommendation_summary: "Defer and review required before proceeding.",
    explanation: {
      ...model.explanation,
      decision_summary: reason,
      uncertainty_and_confidence: "High uncertainty due to guardrail enforcement.",
      next_review_or_trigger: "Provide missing constraints/inputs and retry.",
    },
  };
}
