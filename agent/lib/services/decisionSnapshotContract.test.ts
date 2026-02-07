import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { runDecision } from "@/lib/services/decisionService";
import type { DecisionSnapshot } from "@/lib/domain/decisionSnapshot";

vi.mock("@/lib/infra/policyLoader", () => ({
  loadPolicy: () => ({
    policy_id: "ape-policy",
    policy_version: "0.1-test",
    source: "test",
    jurisdiction: "UK",
    strategic_asset_allocation: {
      base_currency: "GBP",
      target_weights: {
        EQUITIES: 0.8,
        BONDS: 0.15,
        CASH: 0.05,
      },
    },
    risk_guardrails: {
      max_rolling_12m_drawdown_pct: 0.2,
      risk_capacity_rule: "RISK_CAPACITY_OVERRIDES_TOLERANCE",
    },
    rebalancing_policy: {
      absolute_bands: {
        EQUITIES: 0.05,
        BONDS: 0.04,
        CASH: 0.02,
      },
    },
    constraints: {
      prohibited_actions: ["LEVERAGE", "MARGIN", "MARKET_TIMING"],
    },
  }),
}));

vi.mock("@/lib/infra/mastra", () => ({
  generateAssistantReply: vi.fn(async () =>
    JSON.stringify({
      recommendation_type: "DO_NOTHING",
      recommendation_summary: "Policy-aligned recommendation.",
      proposed_actions: [],
      explanation: {
        decision_summary: "Decision follows the investment policy guardrails.",
        relevant_portfolio_state: "Inputs were parsed from the request.",
        policy_basis:
          "Targets: equities 0.8, bonds 0.15, cash 0.05. Bands: equities 0.05, bonds 0.04, cash 0.02. Policy ape-policy v0.1-test (test).",
        reasoning_and_tradeoffs: "Guardrails prevent unnecessary action.",
        uncertainty_and_confidence: "High confidence given deterministic inputs.",
        next_review_or_trigger: "Review if inputs or cash flows change.",
      },
    })
  ),
}));

type SnapshotWithOutcome = DecisionSnapshot & { outcome_state: string };

function assertSnapshotContract(snapshot: DecisionSnapshot): void {
  if (!snapshot.outcome_state) {
    throw new Error("snapshot.outcome_state is required");
  }
  if (!Array.isArray(snapshot.warnings)) {
    throw new Error("snapshot.warnings must be an array");
  }
  if (!Array.isArray(snapshot.errors)) {
    throw new Error("snapshot.errors must be an array");
  }
  for (const warn of snapshot.warnings) {
    if (!warn || typeof warn.code !== "string" || typeof warn.message !== "string") {
      throw new Error("snapshot.warnings must contain structured entries");
    }
  }
  for (const err of snapshot.errors) {
    if (!err || typeof err.code !== "string" || typeof err.message !== "string") {
      throw new Error("snapshot.errors must contain structured entries");
    }
  }
}

describe("Decision Snapshot contract (M3a)", () => {
  it("always returns a snapshot with outcome_state", async () => {
    const result = await runDecision({
      messages: [{ role: "user", content: "Evaluate my portfolio." }],
    });
    expect(result.snapshot.outcome_state).toBeTruthy();
  });

  it("missing inputs outcome includes inputs_missing entries", async () => {
    const result = await runDecision({
      messages: [{ role: "user", content: "Evaluate my portfolio." }],
    });

    expect(result.snapshot.outcome_state).toBe("CANNOT_DECIDE_MISSING_INPUTS");
    expect(result.snapshot.inputs_missing.length).toBeGreaterThan(0);
    for (const item of result.snapshot.inputs_missing) {
      expect(item.input_key).toBeTruthy();
      expect(item.impact).toBeTruthy();
    }
  });

  it("policy_items_referenced includes at least one DPQ id on a normal path", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No cash flows.",
        },
      ],
      risk_inputs: { rolling_12m_drawdown_pct: 0.1, risk_capacity_breached: false },
    });

    expect(result.snapshot.policy_items_referenced.length).toBeGreaterThan(0);
    expect(result.snapshot.policy_items_referenced[0]?.dpq_id).toMatch(/^DPQ-\d{3}$/);
  });

  it("warnings/errors are arrays of structured objects", async () => {
    const result = await runDecision({
      messages: [{ role: "user", content: "Evaluate my portfolio." }],
    });

    assertSnapshotContract(result.snapshot);
  });

  it("golden snapshot exists and includes required fields", () => {
    const repoRoot = path.resolve(process.cwd(), "..");
    const snapshotPath = path.join(
      repoRoot,
      "artifacts",
      "reference",
      "milestone-3a",
      "golden_snapshot.in_band.no_cashflows.json"
    );
    const raw = readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw) as SnapshotWithOutcome;

    expect(snapshot.outcome_state).toBe("RECOMMEND_NO_ACTION");
    expect(Array.isArray(snapshot.inputs_observed)).toBe(true);
    expect(Array.isArray(snapshot.inputs_missing)).toBe(true);
    expect(Array.isArray(snapshot.policy_items_referenced)).toBe(true);
    expect(Array.isArray(snapshot.warnings)).toBe(true);
    expect(Array.isArray(snapshot.errors)).toBe(true);
  });

  it("fails validation when outcome_state is missing", () => {
    const badSnapshot = { warnings: [], errors: [] } as unknown as DecisionSnapshot;
    expect(() => assertSnapshotContract(badSnapshot)).toThrow("snapshot.outcome_state is required");
  });
});
