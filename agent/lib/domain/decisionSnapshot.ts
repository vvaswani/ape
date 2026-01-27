/**
 * @file decisionSnapshot.ts
 * @description
 * Domain types for Decision Snapshots produced by APE.
 *
 * These types mirror the governance artefact template and provide a stable contract
 * between the service layer and UI.
 */

export type RecommendationType =
  | "DO_NOTHING"
  | "REBALANCE_VIA_CONTRIBUTIONS"
  | "PARTIAL_REBALANCE"
  | "FULL_REBALANCE"
  | "DEFER_AND_REVIEW"
  | "ASK_CLARIFYING_QUESTIONS";

export interface DecisionSnapshot {
  snapshot_id: string;
  snapshot_version: string;
  created_at: string;

  project: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)";

  context: {
    user_id: string;
    environment: string;
    jurisdiction: string;
    base_currency: string;
  };

  inputs: {
    portfolio_state: {
      total_value: number | null;
      asset_allocation: {
        EQUITIES: number | null;
        BONDS: number | null;
        CASH: number | null;
      };
      positions_summary?: string;
      cash_balance: number | null;
    };
    cash_flows: {
      pending_contributions: number | null;
      pending_withdrawals: number | null;
      notes?: string;
    };
    constraints: {
      liquidity_needs?: string;
      tax_or_wrapper_constraints?: string;
      other_constraints?: string;
    };
    market_context: {
      as_of_date: string;
      notes?: string;
    };
  };

  governance: {
    investment_policy: {
      policy_id: string;
      policy_version: string;
      policy_source: string;
    };
    explanation_contract: {
      version: string;
    };
  };

  evaluation: {
    drift_analysis: {
      target_weights: { EQUITIES: number; BONDS: number; CASH: number };
      actual_weights: { EQUITIES: number | null; BONDS: number | null; CASH: number | null };
      absolute_drift: { EQUITIES: number | null; BONDS: number | null; CASH: number | null };
      bands_breached: boolean | null;
    };
    risk_checks: {
      drawdown_proximity?: string;
      risk_capacity_breached: boolean | null;
      notes?: string;
    };
  };

  recommendation: {
    type: RecommendationType;
    summary: string;
    proposed_actions: Array<{
      asset_class: "EQUITIES" | "BONDS" | "CASH";
      action: "BUY" | "SELL" | "HOLD";
      amount: number | null;
      rationale: string;
    }>;
    turnover_estimate: {
      gross_turnover_pct: number | null;
      trade_count: number | null;
    };
  };

  explanation: {
    decision_summary: string;
    relevant_portfolio_state: string;
    policy_basis: string;
    reasoning_and_tradeoffs: string;
    uncertainty_and_confidence: string;
    next_review_or_trigger: string;
  };

  user_acknowledgement: {
    decision: "ACCEPT" | "DEFER" | "IGNORE";
    user_notes?: string;
    acknowledged_at: string | null;
  };

  outcome: {
    implemented: boolean | null;
    implementation_notes: string | null;
    review_date: string | null;
    observed_effects: string | null;
  };

  audit: {
    logic_version: string;
    notes?: string;
  };
}
