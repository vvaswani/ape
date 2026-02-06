/**
 * @file policyLoader.ts
 * @description
 * Loads the machine-readable investment policy JSON using local → default precedence.
 */

import crypto from "node:crypto";
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

  risk_guardrails: {
    max_rolling_12m_drawdown_pct: number;
    risk_capacity_rule: string;
  };

  rebalancing_policy: {
    absolute_bands: {
      EQUITIES: number;
      BONDS: number;
      CASH: number;
    };
  };

  constraints: {
    prohibited_actions: string[];
    wrappers_supported?: string[];
  };

  meta?: {
    prime_directive_sha256?: string;
    [key: string]: unknown;
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

function sha256File(absPath: string): string {
  const raw = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function enforcePrimeDirectiveFreeze(args: {
  policy: PolicyJson;
  policyPath: string;
}): void {
  const { policy, policyPath } = args;
  const expected = policy.meta?.prime_directive_sha256;

  if (!expected || typeof expected !== "string" || expected.trim().length === 0) {
    throw new Error("Prime Directive pin missing: meta.prime_directive_sha256 must be set.");
  }

  const isLocal = policyPath.includes("artifacts\\local") || policyPath.includes("artifacts/local");
  const cwd = process.cwd();
  const primeCandidates = isLocal
    ? [
        path.resolve(cwd, "artifacts/local/prime_directive.local.md"),
        path.resolve(cwd, "..", "artifacts/local/prime_directive.local.md"),
        "/artifacts/local/prime_directive.local.md",
      ]
    : [
        path.resolve(cwd, "artifacts/policy/default/prime_directive.default.md"),
        path.resolve(cwd, "..", "artifacts/policy/default/prime_directive.default.md"),
        "/artifacts/policy/default/prime_directive.default.md",
      ];

  const primePath = firstExisting(primeCandidates);
  if (!primePath) {
    throw new Error("Prime Directive not found for governance freeze check.");
  }

  const actual = sha256File(primePath);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `Prime Directive mismatch: expected ${expected.toLowerCase()} but found ${actual.toLowerCase()}.`
    );
  }
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
  const cwd = process.cwd();
  const localCandidates = [
    path.resolve(cwd, "artifacts/local/policy.local.json"),
    path.resolve(cwd, "..", "artifacts/local/policy.local.json"),
    "/artifacts/local/policy.local.json",
  ];

  const defaultCandidates = [
    path.resolve(cwd, "artifacts/policy/default/policy.default.json"),
    path.resolve(cwd, "..", "artifacts/policy/default/policy.default.json"),
    "/artifacts/policy/default/policy.default.json",
  ];

  const localPath = firstExisting(localCandidates);
  if (localPath) {
    const policy = readJson<PolicyJson>(localPath);
    enforcePrimeDirectiveFreeze({ policy, policyPath: localPath });
    return policy;
  }

  const defaultPath = firstExisting(defaultCandidates);
  if (!defaultPath) {
    throw new Error("Policy JSON not found (local or default).");
  }

  const policy = readJson<PolicyJson>(defaultPath);
  enforcePrimeDirectiveFreeze({ policy, policyPath: defaultPath });
  return policy;
}
