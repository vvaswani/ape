/**
 * @file decision.ts
 * @description
 * Canonical non-chat request/response contract for decision execution.
 */

import type { AuthorityContext } from "@/lib/domain/authority";
import type { DecisionSnapshot } from "@/lib/domain/decisionSnapshot";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";
import type { RiskInputs } from "@/lib/domain/riskInputs";

export interface DecisionRequest {
  request_note?: string;
  portfolio_state?: PortfolioStateInput;
  risk_inputs?: RiskInputs;
  authority?: AuthorityContext;
}

export interface DecisionResponse {
  snapshot: DecisionSnapshot;
}
