/**
 * @file policyLoader.ts
 * @description
 * Loads the machine-readable investment policy JSON using local → default precedence.
 */

import fs from "node:fs";
import path from "node:path";

export interface PolicyJson {
  policy_id: string;
  policy_version: string;
  source: string;
  jurisdiction: string;

  strategic_asset_allocation: {
    base_currency: string;
    target_weights: {
      EQUITIES: number;
      BONDS: number;
      CASH: number;
    };
  };

  rebalancing_policy: {
    absolute_bands: {
      EQUITIES: number;
      BONDS: number;
      CASH: number;
    };
  };
}

function readJson<T>(absPath: string): T {
  const raw = fs.readFileSync(absPath, "utf-8");
  return JSON.parse(raw) as T;
}

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Load the policy JSON.
 *
 * Resolution order:
 * 1) artifacts/local/policy.local.json
 * 2) artifacts/policy/default/policy.default.json
 *
 * Supports both:
 * - agent/artifacts/...
 * - repo-root/artifacts/...
 */
export function loadPolicy(): PolicyJson {

  const localCandidates = [
    "/artifacts/local/policy.local.json"
  ];

  const defaultCandidates = [
    "/artifacts/policy/default/policy.default.json"
  ];

  const localPath = firstExisting(localCandidates);
  if (localPath) {
    return readJson<PolicyJson>(localPath);
  }

  const defaultPath = firstExisting(defaultCandidates);
  if (!defaultPath) {
    throw new Error("Policy JSON not found (local or default).");
  }

  return readJson<PolicyJson>(defaultPath);
}
