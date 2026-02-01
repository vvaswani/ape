/**
 * @file drift.ts
 * @description
 * Deterministic drift computation: target vs actual, absolute drift and band breach.
 */

import type { PolicyJson } from "@/lib/infra/policyLoader";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";

export interface DriftResult {
  actual_weights: { EQUITIES: number; BONDS: number; CASH: number };
  absolute_drift: { EQUITIES: number; BONDS: number; CASH: number };
  bands_breached: boolean;
}

export function computeDrift(policy: PolicyJson, state: PortfolioStateInput): DriftResult {
  const target = policy.strategic_asset_allocation.target_weights;
  const bands = policy.rebalancing_policy.absolute_bands;

  const actual = state.weights;

  const drift = {
    EQUITIES: actual.EQUITIES - target.EQUITIES,
    BONDS: actual.BONDS - target.BONDS,
    CASH: actual.CASH - target.CASH,
  };

  const abs = {
    EQUITIES: Math.abs(drift.EQUITIES),
    BONDS: Math.abs(drift.BONDS),
    CASH: Math.abs(drift.CASH),
  };

  const EPS = 1e-6;
  const breached =
    abs.EQUITIES - bands.EQUITIES > EPS ||
    abs.BONDS - bands.BONDS > EPS ||
    abs.CASH - bands.CASH > EPS;

  return {
    actual_weights: actual,
    absolute_drift: abs,
    bands_breached: breached,
  };
}
