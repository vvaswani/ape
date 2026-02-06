/**
 * @file riskInputs.ts
 * @description
 * Structured risk inputs used for deterministic guardrail enforcement.
 */

export interface RiskInputs {
  /**
   * Rolling 12-month drawdown as a decimal (e.g., 0.18 for 18%).
   */
  rolling_12m_drawdown_pct: number | null;

  /**
   * Whether risk capacity is breached (true/false) or unknown (null).
   */
  risk_capacity_breached: boolean | null;
}
