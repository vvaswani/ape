import { describe, expect, it } from "vitest";

import type { PolicyJson } from "@/lib/infra/policyLoader";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";
import { computeDrift } from "@/lib/services/drift";

const basePolicy: PolicyJson = {
  policy_id: "test-policy",
  policy_version: "0.0-test",
  source: "test",
  jurisdiction: "GB",
  strategic_asset_allocation: {
    base_currency: "GBP",
    target_weights: { EQUITIES: 0.6, BONDS: 0.3, CASH: 0.1 },
  },
  risk_guardrails: {
    max_rolling_12m_drawdown_pct: 0.2,
    risk_capacity_rule: "RISK_CAPACITY_OVERRIDES_TOLERANCE",
  },
  rebalancing_policy: {
    absolute_bands: { EQUITIES: 0.05, BONDS: 0.05, CASH: 0.05 },
  },
  constraints: {
    prohibited_actions: ["LEVERAGE"],
  },
  meta: {
    prime_directive_sha256: "test",
  },
};

function stateWithWeights(weights: PortfolioStateInput["weights"]): PortfolioStateInput {
  return {
    as_of_date: "2026-02-01",
    total_value_gbp: 100000,
    weights,
    cash_flows: {
      pending_contributions_gbp: 0,
      pending_withdrawals_gbp: 0,
    },
  };
}

describe("computeDrift", () => {
  it("returns absolute drift and no breach when within bands", () => {
    const state = stateWithWeights({ EQUITIES: 0.62, BONDS: 0.28, CASH: 0.1 });
    const result = computeDrift(basePolicy, state);

    expect(result.absolute_drift.EQUITIES).toBeCloseTo(0.02, 6);
    expect(result.absolute_drift.BONDS).toBeCloseTo(0.02, 6);
    expect(result.absolute_drift.CASH).toBeCloseTo(0, 6);
    expect(result.bands_breached).toBe(false);
  });

  it("flags a breach when any absolute drift exceeds its band", () => {
    const state = stateWithWeights({ EQUITIES: 0.7, BONDS: 0.2, CASH: 0.1 });
    const result = computeDrift(basePolicy, state);

    expect(result.absolute_drift.EQUITIES).toBeCloseTo(0.1, 6);
    expect(result.absolute_drift.BONDS).toBeCloseTo(0.1, 6);
    expect(result.absolute_drift.CASH).toBeCloseTo(0, 6);
    expect(result.bands_breached).toBe(true);
  });
});
