import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sha256Text(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

function writePolicyDir(args: {
  dir: string;
  filename: "policy.local.json" | "policy.default.json";
  primeFilename: "prime_directive.local.md" | "prime_directive.default.md";
  primeText: string;
}): void {
  const { dir, filename, primeFilename, primeText } = args;
  fs.mkdirSync(dir, { recursive: true });

  const policyJson = {
    policy_id: "ape-policy",
    policy_version: "0.1-test",
    source: "test",
    jurisdiction: "UK",
    strategic_asset_allocation: {
      base_currency: "GBP",
      target_weights: {
        EQUITIES: 0.6,
        BONDS: 0.35,
        CASH: 0.05,
      },
    },
    risk_guardrails: {
      max_rolling_12m_drawdown_pct: 0.2,
      risk_capacity_rule: "RISK_CAPACITY_OVERRIDES_TOLERANCE",
    },
    rebalancing_policy: {
      absolute_bands: {
        EQUITIES: 0.07,
        BONDS: 0.06,
        CASH: 0.03,
      },
    },
    constraints: {
      prohibited_actions: ["LEVERAGE"],
    },
    meta: {
      prime_directive_sha256: sha256Text(primeText),
    },
  };

  fs.writeFileSync(path.join(dir, filename), JSON.stringify(policyJson, null, 2), "utf-8");
  fs.writeFileSync(path.join(dir, primeFilename), primeText, "utf-8");
}

describe.sequential("policyLoader env resolution", () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();

  function resetEnv(): void {
    process.env = { ...originalEnv };
  }

  it("throws when no POLICY_* is set and artifacts reads are not allowed", async () => {
    resetEnv();
    delete process.env.POLICY_PATH;
    delete process.env.POLICY_DIR;
    delete process.env.ALLOW_ARTIFACTS_READ;

    const { loadPolicy } = await import("./policyLoader");
    expect(() => loadPolicy()).toThrow(/POLICY_(PATH|DIR)/i);
  });

  it("loads policy via POLICY_DIR when present", async () => {
    resetEnv();
    delete process.env.POLICY_PATH;
    delete process.env.ALLOW_ARTIFACTS_READ;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ape-policy-"));
    const primeText = "# Prime Directive Statement\n\nTest content.";
    writePolicyDir({
      dir: tmpDir,
      filename: "policy.default.json",
      primeFilename: "prime_directive.default.md",
      primeText,
    });

    process.env.POLICY_DIR = tmpDir;
    const { loadPolicy } = await import("./policyLoader");
    const policy = loadPolicy();
    expect(policy.policy_id).toBe("ape-policy");
  });

  it("loads policy via POLICY_PATH when present", async () => {
    resetEnv();
    delete process.env.POLICY_DIR;
    delete process.env.ALLOW_ARTIFACTS_READ;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ape-policy-path-"));
    const primeText = "# Prime Directive Statement\n\nTest content.";
    writePolicyDir({
      dir: tmpDir,
      filename: "policy.default.json",
      primeFilename: "prime_directive.default.md",
      primeText,
    });

    process.env.POLICY_PATH = path.join(tmpDir, "policy.default.json");
    const { loadPolicy } = await import("./policyLoader");
    const policy = loadPolicy();
    expect(policy.policy_id).toBe("ape-policy");
  });

  it("allows legacy artifacts fallback only when ALLOW_ARTIFACTS_READ=true", async () => {
    resetEnv();
    delete process.env.POLICY_PATH;
    delete process.env.POLICY_DIR;
    process.env.ALLOW_ARTIFACTS_READ = "true";

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ape-artifacts-"));
    const artifactsDir = path.join(tmpRoot, "artifacts", "policy", "default");
    const primeText = "# Prime Directive Statement\n\nTest content.";
    writePolicyDir({
      dir: artifactsDir,
      filename: "policy.default.json",
      primeFilename: "prime_directive.default.md",
      primeText,
    });

    process.chdir(tmpRoot);
    try {
      const { loadPolicy } = await import("./policyLoader");
      const policy = loadPolicy();
      expect(policy.policy_id).toBe("ape-policy");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("fails fast when prime directive hash does not match pinned hash", async () => {
    resetEnv();
    delete process.env.POLICY_PATH;
    delete process.env.ALLOW_ARTIFACTS_READ;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ape-policy-freeze-"));
    const primeText = "# Prime Directive Statement\n\nFrozen content.";
    writePolicyDir({
      dir: tmpDir,
      filename: "policy.default.json",
      primeFilename: "prime_directive.default.md",
      primeText,
    });

    fs.appendFileSync(path.join(tmpDir, "prime_directive.default.md"), "\n# drift", "utf-8");

    process.env.POLICY_DIR = tmpDir;
    const { loadPolicy } = await import("./policyLoader");
    expect(() => loadPolicy()).toThrow(/Prime Directive mismatch/i);
  });
});
