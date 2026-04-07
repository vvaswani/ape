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

function isArtifactsPath(p: string): boolean {
  const normalized = path.resolve(p).replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/artifacts/");
}

function assertArtifactsReadAllowed(p: string, allowArtifacts: boolean): void {
  if (!allowArtifacts && isArtifactsPath(p)) {
    throw new Error(
      "Artifact policy paths are not allowed at runtime unless ALLOW_ARTIFACTS_READ=true. Set POLICY_PATH or POLICY_DIR to a non-artifacts runtime location."
    );
  }
}

function resolvePolicyPathFromEnv(allowArtifacts: boolean): string | null {
  const policyPathEnv = process.env.POLICY_PATH?.trim();
  if (policyPathEnv && policyPathEnv.length > 0) {
    const resolved = path.isAbsolute(policyPathEnv)
      ? policyPathEnv
      : path.resolve(process.cwd(), policyPathEnv);
    assertArtifactsReadAllowed(resolved, allowArtifacts);
    return resolved;
  }

  const policyDir = process.env.POLICY_DIR?.trim();
  if (policyDir && policyDir.length > 0) {
    const baseDir = path.isAbsolute(policyDir) ? policyDir : path.resolve(process.cwd(), policyDir);
    assertArtifactsReadAllowed(baseDir, allowArtifacts);
    const candidates = [
      path.join(baseDir, "policy.local.json"),
      path.join(baseDir, "policy.default.json"),
    ];
    return firstExisting(candidates);
  }

  return null;
}

function resolvePrimeDirectivePath(args: {
  policyPath: string;
  allowArtifacts: boolean;
}): string | null {
  const { policyPath, allowArtifacts } = args;
  const policyDirEnv = process.env.POLICY_DIR?.trim();
  const policyDir = policyDirEnv
    ? path.isAbsolute(policyDirEnv)
      ? policyDirEnv
      : path.resolve(process.cwd(), policyDirEnv)
    : path.dirname(policyPath);

  const isLocal = policyPath.includes("policy.local.json");
  const localFirst = isLocal
    ? ["prime_directive.local.md", "prime_directive.default.md"]
    : ["prime_directive.default.md", "prime_directive.local.md"];

  const candidates = localFirst.map((name) => path.join(policyDir, name));
  if (!allowArtifacts) {
    for (const p of candidates) {
      assertArtifactsReadAllowed(p, allowArtifacts);
    }
  }

  if (allowArtifacts) {
    const cwd = process.cwd();
    const artifactCandidates = isLocal
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
    candidates.push(...artifactCandidates);
  }

  return firstExisting(candidates);
}

function sha256File(absPath: string): string {
  const raw = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function enforcePrimeDirectiveFreeze(args: {
  policy: PolicyJson;
  policyPath: string;
  allowArtifacts: boolean;
}): void {
  const { policy, policyPath, allowArtifacts } = args;
  const expected = policy.meta?.prime_directive_sha256;

  if (!expected || typeof expected !== "string" || expected.trim().length === 0) {
    throw new Error("Prime Directive pin missing: meta.prime_directive_sha256 must be set.");
  }

  const primePath = resolvePrimeDirectivePath({ policyPath, allowArtifacts });
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
 * 1) POLICY_PATH (explicit file path)
 * 2) POLICY_DIR (directory with policy.local.json or policy.default.json)
 * 3) Optional legacy artifacts fallback if ALLOW_ARTIFACTS_READ=true
 */
export function loadPolicy(): PolicyJson {
  const allowArtifacts = process.env.ALLOW_ARTIFACTS_READ === "true";
  const envResolved = resolvePolicyPathFromEnv(allowArtifacts);

  let policyPath = envResolved;
  if (!policyPath && allowArtifacts) {
    const cwd = process.cwd();
    const legacyCandidates = [
      path.resolve(cwd, "artifacts/local/policy.local.json"),
      path.resolve(cwd, "..", "artifacts/local/policy.local.json"),
      "/artifacts/local/policy.local.json",
      path.resolve(cwd, "artifacts/policy/default/policy.default.json"),
      path.resolve(cwd, "..", "artifacts/policy/default/policy.default.json"),
      "/artifacts/policy/default/policy.default.json",
    ];
    policyPath = firstExisting(legacyCandidates);
  }

  if (!policyPath) {
    throw new Error(
      "Policy JSON not found. Set POLICY_PATH or POLICY_DIR (or enable ALLOW_ARTIFACTS_READ=true for legacy artifacts)."
    );
  }

  const policy = readJson<PolicyJson>(policyPath);
  enforcePrimeDirectiveFreeze({ policy, policyPath, allowArtifacts });
  return policy;
}
