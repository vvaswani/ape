import { beforeEach, describe, expect, it, vi } from "vitest";

import { runDecision } from "@/lib/services/decisionService";

let forcedResponse: string | null = null;

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
    rebalancing_policy: {
      absolute_bands: {
        EQUITIES: 0.05,
        BONDS: 0.04,
        CASH: 0.02,
      },
    },
  }),
}));

vi.mock("@/lib/infra/mastra", () => ({
  generateAssistantReply: vi.fn(async ({ systemPrompt }: { systemPrompt: string }) => {
    if (forcedResponse !== null) {
      return forcedResponse;
    }

    const pickRecommendation = (): string => {
      if (systemPrompt.includes("Portfolio state has NOT been provided.")) {
        return "ASK_CLARIFYING_QUESTIONS";
      }
      if (
        systemPrompt.includes("pending_contributions_gbp: 2000") ||
        systemPrompt.includes("pending_contributions_gbp: 5000")
      ) {
        return "REBALANCE_VIA_CONTRIBUTIONS";
      }
      if (systemPrompt.includes("bands_breached: true")) {
        return "REBALANCE";
      }
      return "DO_NOTHING";
    };

    const recommendation_type = pickRecommendation();
    const decision_summary =
      recommendation_type === "ASK_CLARIFYING_QUESTIONS"
        ? "Missing inputs; please provide portfolio weights and cash flows."
        : recommendation_type === "DEFER_AND_REVIEW"
          ? "Defer and review required before proceeding."
          : "Decision follows the investment policy guardrails.";

    return JSON.stringify({
      recommendation_type,
      recommendation_summary: "Policy-aligned recommendation based on provided inputs.",
      proposed_actions: [],
      explanation: {
        decision_summary,
        relevant_portfolio_state: "Inputs were parsed from the request.",
        policy_basis:
          "Targets: equities 0.8, bonds 0.15, cash 0.05. Bands: equities 0.05, bonds 0.04, cash 0.02. Policy ape-policy v0.1-test (test).",
        reasoning_and_tradeoffs: "Guardrails prevent unnecessary action.",
        uncertainty_and_confidence: "High confidence given deterministic inputs.",
        next_review_or_trigger: "Review if inputs or cash flows change.",
      },
    });
  }),
}));

beforeEach(() => {
  forcedResponse = null;
});

describe("runDecision", () => {
  it("asks for clarification when portfolio state is missing (scenario 1)", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the current investment policy.\n\nI have not provided my current portfolio weights or cash balances yet.\nPlease proceed according to policy and generate a decision snapshot.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("ASK_CLARIFYING_QUESTIONS");
    expect(result.snapshot.inputs.portfolio_state.asset_allocation).toEqual({
      EQUITIES: null,
      BONDS: null,
      CASH: null,
    });
    expect(result.snapshot.evaluation.drift_analysis.bands_breached).toBeNull();
    expect(result.snapshot.evaluation.drift_analysis.actual_weights).toEqual({
      EQUITIES: null,
      BONDS: null,
      CASH: null,
    });
  });

  describe("scenario 2 input precedence", () => {
    const basePrompt =
      "Evaluate my portfolio against the current investment policy.\n\nGenerate a decision snapshot and recommendation.";

    const promptWithWeights =
      "Evaluate my portfolio against the current investment policy.\n\nPortfolio state:\n- Total value: £100,000\n- Asset allocation:\n  - Equities: 78%\n  - Bonds: 16%\n  - Cash: 6%\n\nThere are no new contributions or withdrawals planned.\n\nGenerate a decision snapshot and recommendation.";

    const formState = {
      as_of_date: "2026-02-01",
      total_value_gbp: 100000,
      weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
      cash_flows: {
        pending_contributions_gbp: null,
        pending_withdrawals_gbp: null,
      },
    };

    const conflictFormState = {
      ...formState,
      weights: { EQUITIES: 0.73, BONDS: 0.20, CASH: 0.07 },
    };

    it.each([
      {
        name: "Case A — no state anywhere",
        request: { messages: [{ role: "user", content: basePrompt }] },
        expected: "ASK_CLARIFYING_QUESTIONS",
      },
      {
        name: "Case B — form only",
        request: {
          messages: [{ role: "user", content: basePrompt }],
          portfolio_state: formState,
        },
        expected: "DO_NOTHING",
      },
      {
        name: "Case C — prompt only",
        request: { messages: [{ role: "user", content: promptWithWeights }] },
        expected: "DO_NOTHING",
      },
      {
        name: "Case D — conflict between form and prompt",
        request: {
          messages: [{ role: "user", content: promptWithWeights }],
          portfolio_state: conflictFormState,
        },
        expected: "ASK_CLARIFYING_QUESTIONS",
      },
    ])("$name", async ({ request, expected }) => {
      const result = await runDecision(request);
      expect(result.snapshot.recommendation.type).toBe(expected);
    });
  });

  it("recommends rebalance when drift is out of band and no cash flows (scenario 3)", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the current investment policy.\n\nPortfolio state:\n- Total value: £100,000\n- Asset allocation:\n  - Equities: 55%\n  - Bonds: 35%\n  - Cash: 10%\n\nThere are no new contributions or withdrawals planned.\n\nGenerate a decision snapshot and recommendation.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("REBALANCE");
  });

  it("recommends rebalancing via contributions when drift is out of band with contributions (scenario 4)", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the current investment policy.\n\nPortfolio state:\n- Total value: £100,000\n- Asset allocation:\n  - Equities: 86%\n  - Bonds: 9%\n  - Cash: 5%\n\nCash flows:\n- Planned contribution: £5,000\n- No withdrawals\n\nGenerate a decision snapshot and recommendation.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("REBALANCE_VIA_CONTRIBUTIONS");
  });

  it("overrides temptation to act when drift is in band with no cash flows (scenario 5)", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the current investment policy.\n\nPortfolio state:\n- Total value: £100,000\n- Asset allocation:\n  - Equities: 81%\n  - Bonds: 14%\n  - Cash: 5%\n\nThere are no new contributions or withdrawals.\n\nIf action is not justified by policy, explicitly recommend inaction.\nGenerate a decision snapshot.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("DO_NOTHING");
  });

  it("recommends rebalancing via contributions when in-band with contributions (3c prompt C)", async () => {
    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate against policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. Planned contribution: £2,000.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("REBALANCE_VIA_CONTRIBUTIONS");
  });

  it("keeps DO_NOTHING regardless of prompt tone (prompt invariance)", async () => {
    const neutral = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
        },
      ],
    });

    const emotional = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Please, I am really worried and want action. Evaluate my portfolio: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
        },
      ],
    });

    expect(neutral.snapshot.recommendation.type).toBe("DO_NOTHING");
    expect(emotional.snapshot.recommendation.type).toBe("DO_NOTHING");
  });

  it("downgrades when model returns an unknown recommendation type", async () => {
    forcedResponse = JSON.stringify({
      recommendation_type: "GO_ALL_IN",
      recommendation_summary: "Invalid type.",
      proposed_actions: [],
      explanation: {
        decision_summary: "Invalid type supplied.",
        relevant_portfolio_state: "Inputs were parsed from the request.",
        policy_basis:
          "Targets: equities 0.8, bonds 0.15, cash 0.05. Bands: equities 0.05, bonds 0.04, cash 0.02.",
        reasoning_and_tradeoffs: "Invalid type.",
        uncertainty_and_confidence: "Low confidence.",
        next_review_or_trigger: "Retry.",
      },
    });

    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
  });

  it("downgrades when required explanation fields are missing", async () => {
    forcedResponse = JSON.stringify({
      recommendation_type: "DO_NOTHING",
      recommendation_summary: "Missing policy basis.",
      proposed_actions: [],
      explanation: {
        decision_summary: "Decision follows the investment policy guardrails.",
        relevant_portfolio_state: "Inputs were parsed from the request.",
        policy_basis: "",
        reasoning_and_tradeoffs: "Guardrails prevent unnecessary action.",
        uncertainty_and_confidence: "High confidence.",
        next_review_or_trigger: "Review if inputs change.",
      },
    });

    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
  });

  it("returns a safe snapshot when the model output is invalid JSON", async () => {
    forcedResponse = "not-json";

    const result = await runDecision({
      messages: [
        {
          role: "user",
          content:
            "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
        },
      ],
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.snapshot_id).toBeTruthy();
  });
});
