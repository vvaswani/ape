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
});
