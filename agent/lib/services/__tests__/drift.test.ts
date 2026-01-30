import { describe, expect, it } from "vitest";

import type { PolicyJson } from "@/lib/infra/policyLoader";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";
import { computeDrift } from "@/lib/services/drift";

describe("computeDrift", () => {
  it("calculates absolute drift and band status", () => {
    const policy: PolicyJson = {
      policy_id: "policy-test",
      policy_version: "1.0",
      source: "unit-test",
      jurisdiction: "GB",
      strategic_asset_allocation: {
        base_currency: "GBP",
        target_weights: {
          EQUITIES: 0.6,
          BONDS: 0.3,
          CASH: 0.1,
        },
      },
      rebalancing_policy: {
        absolute_bands: {
          EQUITIES: 0.05,
          BONDS: 0.05,
          CASH: 0.02,
        },
      },
    };

    const state: PortfolioStateInput = {
      as_of_date: "2025-02-01",
      total_value_gbp: 100000,
      weights: {
        EQUITIES: 0.66,
        BONDS: 0.27,
        CASH: 0.07,
      },
      cash_flows: {
        pending_contributions_gbp: null,
        pending_withdrawals_gbp: null,
      },
    };

    const result = computeDrift(policy, state);

    expect(result.actual_weights).toEqual(state.weights);
    expect(result.absolute_drift).toEqual({
      EQUITIES: 0.06,
      BONDS: 0.03,
      CASH: 0.03,
    });
    expect(result.bands_breached).toBe(true);
  });
});
