/**
 * @file portfolioState.ts
 * @description
 * Minimal, explicit portfolio state input for Milestone #3a.
 *
 * This is user-entered structured data (no parsing). It must be treated as the
 * factual portfolio snapshot used for deterministic drift computation.
 */

export interface PortfolioStateInput {
  /**
   * Date the snapshot applies to (YYYY-MM-DD).
   */
  as_of_date: string;

  /**
   * Total portfolio value in base currency (optional but useful).
   */
  total_value_gbp: number | null;

  /**
   * Current allocation weights expressed as decimals (e.g., 0.63).
   * Must sum to ~1.0 (we'll validate loosely).
   */
  weights: {
    EQUITIES: number | null;
    BONDS: number | null;
    CASH: number | null;
  };

  /**
   * Optional cash flows expected in near term.
   */
  cash_flows: {
    pending_contributions_gbp: number | null;
    pending_withdrawals_gbp: number | null;
  };
}
