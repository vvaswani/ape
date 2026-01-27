/**
 * @file policyLoader.ts
 * @description
 * Loads the machine-readable policy for the AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator).
 *
 * Precedence:
 * 1) artifacts/local/policy.local.json (if present)
 * 2) artifacts/policy/default/policy.default.json
 *
 * Template files are never used at runtime.
 */

import fs from "node:fs";
import path from "node:path";

export type PolicyJson = {
  policy_id: string;
  policy_name: string;
  policy_version: string;
  source: "default" | "local" | "template" | string;
  jurisdiction: string;
  owner: string;
  updated_at: string;

  strategic_asset_allocation: {
    base_currency: string;
    asset_classes: string[];
    target_weights: Record<string, number>;
  };

  risk_guardrails: {
    max_rolling_12m_drawdown_pct: number;
    risk_capacity_rule: string;
  };

  rebalancing_policy: {
    trigger_type: string;
    absolute_bands: Record<string, number>;
    review_cadence: {
      light_check: string;
      formal_review: string;
    };
    execution_preferences: {
      use_contributions_first: boolean;
      sell_only_if_required: boolean;
      avoid_micro_trades: boolean;
    };
  };

  turnover_controls: {
    min_trade_gbp: number;
    min_trade_pct_of_portfolio: number;
    notes?: string;
  };

  constraints: {
    prohibited_actions: string[];
    wrappers_supported: string[];
  };

  meta?: Record<string, unknown>;
};

/**
 * Resolve the absolute file path for a policy JSON file.
 */
function resolvePolicyPath(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

/**
 * Load JSON from disk with a clear error if invalid.
 */
function readJsonFile<T>(absPath: string): T {
  const raw = fs.readFileSync(absPath, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${absPath}`);
  }
}

/**
 * Load policy JSON using local → default precedence.
 */
export function loadPolicy(): PolicyJson {
  const localPath = resolvePolicyPath("artifacts/local/policy.local.json");
  const defaultPath = resolvePolicyPath("artifacts/policy/default/policy.default.json");

  if (fs.existsSync(localPath)) {
    return readJsonFile<PolicyJson>(localPath);
  }

  return readJsonFile<PolicyJson>(defaultPath);
}
