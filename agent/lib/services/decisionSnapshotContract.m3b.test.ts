import path from "node:path";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mastra = vi.hoisted(() => ({
  generateAssistantReply: vi.fn(),
}));

vi.mock("@/lib/infra/mastra", () => ({
  generateAssistantReply: mastra.generateAssistantReply,
}));

const baseModel = {
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
};

function mockModelResponse(payload: typeof baseModel) {
  mastra.generateAssistantReply.mockResolvedValue(JSON.stringify(payload));
}

describe("Decision Snapshot contract (M3b)", () => {
  beforeEach(() => {
    mastra.generateAssistantReply.mockReset();
    mockModelResponse(baseModel);
  });

  it("populates policy_applied and drift evaluation for a full apply pass", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content: "Evaluate my portfolio and generate a decision snapshot.",
        },
      ],
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: { pending_contributions_gbp: 0, pending_withdrawals_gbp: 0 },
      },
      risk_inputs: { rolling_12m_drawdown_pct: 0.1, risk_capacity_breached: false },
    });

    const evalBlock = result.snapshot.evaluation;
    expect(evalBlock.policy_applied.targets).toEqual({
      EQUITIES: 0.8,
      BONDS: 0.15,
      CASH: 0.05,
    });
    expect(evalBlock.policy_applied.bands).toEqual({
      EQUITIES: 0.05,
      BONDS: 0.04,
      CASH: 0.02,
    });
    expect(evalBlock.policy_applied.risk_guardrails_used).toContain("DPQ-004");
    expect(evalBlock.policy_applied.status).toBe("applied");

    expect(evalBlock.drift.status).toBe("computed");
    expect(typeof evalBlock.drift.bands_breached).toBe("boolean");

    expect(evalBlock.correctness.status).toBe("pass");
  });

  it("does not request weights when portfolio_state exists but weights are missing", async () => {
    const result = await runDecision({
      messages: [{ role: "user", content: "Evaluate my portfolio." }],
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: null, BONDS: null, CASH: null },
        cash_flows: { pending_contributions_gbp: null, pending_withdrawals_gbp: null },
      },
      risk_inputs: { rolling_12m_drawdown_pct: 0.1, risk_capacity_breached: false },
    });

    expect(result.snapshot.recommendation.type).not.toBe("ASK_CLARIFYING_QUESTIONS");
    const missing = result.snapshot.inputs_missing.map((m) => m.input_key);
    expect(missing).not.toContain("portfolio_state.weights");
    expect(result.snapshot.evaluation.drift.status).toBe("cannot_compute");
  });

  it("rejects contradictory model output with correctness=fail", async () => {
    mockModelResponse({ ...baseModel, recommendation_type: "REBALANCE" });

    const result = await runDecision({
      messages: [
        {
          role: "user",
          content: "Evaluate my portfolio and generate a decision snapshot.",
        },
      ],
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: { pending_contributions_gbp: 0, pending_withdrawals_gbp: 0 },
      },
      risk_inputs: { rolling_12m_drawdown_pct: 0.1, risk_capacity_breached: false },
    });

    expect(result.snapshot.outcome_state).toBe("ERROR_NONRECOVERABLE");
    expect(result.snapshot.evaluation.correctness.status).toBe("fail");
    expect(result.snapshot.evaluation.policy_applied.status).not.toBe("applied");
    expect(result.snapshot.errors.map((e) => e.code)).toContain("CONTRADICTION_DETECTED");
  });

  it("golden snapshot exists and includes M3b evaluation fields", () => {
    const repoRoot = path.resolve(process.cwd(), "..");
    const snapshotPath = path.join(
      repoRoot,
      "artifacts",
      "reference",
      "milestone-3b",
      "scenario_1_full_apply_pass.json"
    );

    const raw = readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw) as DecisionSnapshot;

    expect(snapshot.evaluation.policy_applied).toBeTruthy();
    expect(snapshot.evaluation.correctness).toBeTruthy();
    expect(snapshot.evaluation.drift).toBeTruthy();
  });

  it("marks drift as not_applicable when no portfolio_state is provided", async () => {
    const result = await runDecision({
      messages: [{ role: "user", content: "Evaluate my portfolio." }],
    });

    expect(result.snapshot.evaluation.drift.status).toBe("not_applicable");
    expect(result.snapshot.evaluation.correctness.status).toBe("indeterminate");
  });
});
