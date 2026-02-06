import { describe, expect, it, vi } from "vitest";

const policyJson = JSON.stringify({
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
    prime_directive_sha256: "deadbeef",
  },
});

const primeDirectiveText = "# Prime Directive Statement\n\nTest content.";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const existsSync = (p: string) =>
    p.includes("policy.default.json") || p.includes("prime_directive.default.md");
  const readFileSync = (p: string, encoding?: string) => {
    if (p.includes("policy.default.json")) {
      return policyJson;
    }
    if (p.includes("prime_directive.default.md")) {
      return encoding ? primeDirectiveText : Buffer.from(primeDirectiveText, "utf-8");
    }
    throw new Error(`Unexpected read: ${p}`);
  };

  return {
    ...actual,
    existsSync,
    readFileSync,
    default: {
      ...(actual as typeof import("node:fs")),
      existsSync,
      readFileSync,
    },
  };
});

describe("loadPolicy governance freeze", () => {
  it("fails fast when prime directive hash does not match pin", async () => {
    const { loadPolicy } = await import("./policyLoader");
    expect(() => loadPolicy()).toThrow(/Prime Directive mismatch/);
  });
});
