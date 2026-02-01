import { describe, expect, it, vi } from "vitest";

import { runDecision } from "@/lib/services/decisionService";

vi.mock("@/lib/infra/mastra", () => ({
  generateAssistantReply: vi.fn(async () =>
    JSON.stringify({
      recommendation_summary: "Need more information to proceed.",
      proposed_actions: [],
      explanation: {
        decision_summary: "Portfolio inputs are missing.",
        relevant_portfolio_state: "No portfolio weights or cash flows provided.",
        policy_basis: "Policy requires actual weights to compute drift.",
        reasoning_and_tradeoffs: "Requesting inputs avoids acting on assumptions.",
        uncertainty_and_confidence: "High uncertainty without portfolio data.",
        next_review_or_trigger: "Provide portfolio weights and cash flow details.",
      },
    })
  ),
}));

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
});
