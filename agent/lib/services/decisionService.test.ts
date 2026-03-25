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

const defaultRiskInputs = {
  rolling_12m_drawdown_pct: 0.1,
  risk_capacity_breached: false,
};

describe("runDecision", () => {
  it("asks for clarification when portfolio state is missing (scenario 1)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy.\n\nI have not provided my current portfolio weights or cash balances yet.\nPlease proceed according to policy and generate a decision snapshot.",
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

  it("blocks prohibited actions with guardrail override (scenario 1)", async () => {
    forcedResponse = JSON.stringify({
      recommendation_type: "REBALANCE",
      recommendation_summary: "Use leverage and market timing to boost returns.",
      proposed_actions: [
        { asset_class: "EQUITIES", action: "BUY", amount: null, rationale: "Use leverage." },
      ],
      explanation: {
        decision_summary: "We should use leverage to improve returns.",
        relevant_portfolio_state: "Portfolio provided.",
        policy_basis: "Market timing is allowed.",
        reasoning_and_tradeoffs: "Leverage and margin can amplify gains.",
        uncertainty_and_confidence: "High confidence.",
        next_review_or_trigger: "Review after leverage is applied.",
      },
    });

    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy. I want to do some market timing and leverage to boost returns. Please proceed and generate a decision snapshot.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.outcome_state).toBe("ERROR_NONRECOVERABLE");
    expect(result.snapshot.recommendation.proposed_actions).toEqual([]);

    const combinedText = [
      result.snapshot.recommendation.summary,
      result.snapshot.explanation.decision_summary,
      result.snapshot.explanation.reasoning_and_tradeoffs,
    ]
      .join(" ")
      .toUpperCase();

    expect(combinedText).not.toContain("LEVERAGE");
    expect(combinedText).not.toContain("MARKET TIMING");
    expect(combinedText).not.toContain("MARGIN");
  });

  it("defers when risk inputs are missing (scenario 2)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy. Generate a decision snapshot.",
      portfolio_state: {
        as_of_date: "2026-02-04",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      // risk_inputs intentionally omitted
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.recommendation.proposed_actions).toEqual([]);
    expect(result.snapshot.evaluation.risk_checks.notes).toContain("missing");
  });

  it("defers when drawdown exceeds policy maximum (scenario 3)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy and generate a decision snapshot.",
      portfolio_state: {
        as_of_date: "2026-02-04",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.55, BONDS: 0.35, CASH: 0.10 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: {
        rolling_12m_drawdown_pct: 0.3,
        risk_capacity_breached: false,
      },
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.recommendation.proposed_actions).toEqual([]);
    expect(result.snapshot.evaluation.risk_checks.drawdown_proximity).toContain("0.3");
    expect(result.snapshot.evaluation.risk_checks.notes).toContain("breach");
  });

  it("defers when risk capacity is breached (scenario 4)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy and generate a decision snapshot.",
      portfolio_state: {
        as_of_date: "2026-02-04",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: {
        rolling_12m_drawdown_pct: 0.1,
        risk_capacity_breached: true,
      },
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.recommendation.proposed_actions).toEqual([]);
    expect(result.snapshot.evaluation.risk_checks.risk_capacity_breached).toBe(true);
    expect(result.snapshot.evaluation.risk_checks.notes).toContain("breach");
  });

  it("defers when unauthorized approval is requested (scenario 5)", async () => {
    const result = await runDecision({
      request_note:
        "Approve this decision and proceed with execution. Generate a decision snapshot.",
      portfolio_state: {
        as_of_date: "2026-02-04",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: {
        rolling_12m_drawdown_pct: 0.1,
        risk_capacity_breached: false,
      },
      authority: {
        actor_role: "USER",
        decision_intent: "APPROVE",
      },
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.recommendation.proposed_actions).toEqual([]);
    expect(
      result.snapshot.warnings.some((warning) => warning.code === "AUTHORITY_VIOLATION")
    ).toBe(true);
    expect(result.snapshot.inputs_observed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input_key: "authority.actor_role", value: "USER" }),
        expect.objectContaining({
          input_key: "authority.decision_intent",
          value: "APPROVE",
        }),
      ])
    );
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
      weights: { EQUITIES: 0.76, BONDS: 0.18, CASH: 0.06 },
    };

    it.each([
      {
        name: "Case A — no state anywhere",
        request: { request_note: basePrompt },
        expected: "ASK_CLARIFYING_QUESTIONS",
      },
      {
        name: "Case B — form only",
        request: {
          request_note: basePrompt,
          portfolio_state: formState,
          risk_inputs: defaultRiskInputs,
        },
        expected: "DO_NOTHING",
      },
      {
        name: "Case C — request note alone cannot supply portfolio_state",
        request: {
          request_note: promptWithWeights,
          risk_inputs: defaultRiskInputs,
        },
        expected: "ASK_CLARIFYING_QUESTIONS",
      },
      {
        name: "Case D — conflicting request note does not override typed state",
        request: {
          request_note: promptWithWeights,
          portfolio_state: conflictFormState,
          risk_inputs: defaultRiskInputs,
        },
        expected: "DO_NOTHING",
      },
    ])("$name", async ({ request, expected }) => {
      const result = await runDecision(request);
      expect(result.snapshot.recommendation.type).toBe(expected);
    });
  });

  it("scenario 2 (in-band, no cash flows) returns RECOMMEND_NO_ACTION", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy. Portfolio state: As of date 2026-02-07. Total value: £100,000. Weights: EQUITIES 80%, BONDS 15%, CASH 5%. No new contributions. No new withdrawals. Generate a decision snapshot and recommendation.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.outcome_state).toBe("RECOMMEND_NO_ACTION");
    expect(result.snapshot.recommendation.type).toBe("DO_NOTHING");
    expect(result.snapshot.inputs_missing).toEqual([]);
    expect(result.snapshot.policy_items_referenced.length).toBeGreaterThan(0);
  });

  it("policy provenance includes DPQ ids on an in-band, no-cash-flows decision", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy and include policy provenance. Portfolio state: As of date 2026-02-07. Total value: £200,000. Weights: EQUITIES 80%, BONDS 15%, CASH 5%. No new contributions. No new withdrawals. Return a decision snapshot with referenced policy items.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 200000,
        weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.outcome_state).toBe("RECOMMEND_NO_ACTION");
    expect(result.snapshot.policy_items_referenced.length).toBeGreaterThan(0);
    expect(result.snapshot.policy_items_referenced[0].dpq_id).toMatch(/^DPQ-\d{3}$/);
    expect(Array.isArray(result.snapshot.warnings)).toBe(true);
    expect(Array.isArray(result.snapshot.errors)).toBe(true);
  });

  it("in-band, no-cash-flows returns DO_NOTHING with computed drift", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy. Portfolio state: Total value: £100,000. Asset allocation: Equities 80%, Bonds 15%, Cash 5%. No new contributions. No new withdrawals. Generate a decision snapshot and recommendation.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.outcome_state).toBe("RECOMMEND_NO_ACTION");
    expect(result.snapshot.recommendation.type).toBe("DO_NOTHING");
    expect(result.snapshot.evaluation.drift.bands_breached).toBe(false);
  });

  it("out-of-band overweight returns REBALANCE with bands breached", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy. Portfolio state: Total value £100,000. Asset allocation: Equities 88%, Bonds 8%, Cash 4%. No new contributions. No new withdrawals. Generate a decision snapshot and recommendation.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.88, BONDS: 0.08, CASH: 0.04 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.outcome_state).toBe("RECOMMEND_ACTION");
    expect(result.snapshot.recommendation.type).toBe("REBALANCE");
    expect(result.snapshot.evaluation.drift.bands_breached).toBe(true);
  });

  it("recommends rebalance when drift is out of band and no cash flows (scenario 3)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy.\n\nPortfolio state:\n- Total value: £100,000\n- Asset allocation:\n  - Equities: 55%\n  - Bonds: 35%\n  - Cash: 10%\n\nThere are no new contributions or withdrawals planned.\n\nGenerate a decision snapshot and recommendation.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.55, BONDS: 0.35, CASH: 0.1 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("REBALANCE");
  });

  it("recommends rebalancing via contributions when drift is out of band with contributions (scenario 4)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy using the provided portfolio_state. Generate a decision snapshot and recommendation.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.88, BONDS: 0.08, CASH: 0.04 },
        cash_flows: {
          pending_contributions_gbp: 5000,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.outcome_state).toBe("RECOMMEND_ACTION");
    expect(result.snapshot.recommendation.type).toBe("REBALANCE_VIA_CONTRIBUTIONS");
    expect(result.snapshot.evaluation.drift.status).toBe("computed");
    expect(result.snapshot.evaluation.drift_analysis.bands_breached).toBe(true);
  });

  it("overrides temptation to act when drift is in band with no cash flows (scenario 5)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the current investment policy using the provided portfolio_state. If action is not justified by policy, explicitly recommend inaction. Generate a decision snapshot.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.62, BONDS: 0.33, CASH: 0.05 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.outcome_state).toBe("RECOMMEND_ACTION");
    expect(result.snapshot.recommendation.type).toBe("REBALANCE");
    expect(result.snapshot.evaluation.drift.status).toBe("computed");
  });

  it("recommends rebalancing via contributions when in-band with contributions (3c prompt C)", async () => {
    const result = await runDecision({
      request_note:
        "Evaluate against policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. Planned contribution: £2,000.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 2000,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("REBALANCE_VIA_CONTRIBUTIONS");
  });

  it("keeps DO_NOTHING regardless of request note tone when typed inputs are the same", async () => {
    const neutral = await runDecision({
      request_note:
        "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    const emotional = await runDecision({
      request_note:
        "Please, I am really worried and want action. Evaluate my portfolio: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
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
      request_note:
        "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
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
      request_note:
        "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
  });

  it("returns a safe snapshot when the model output is invalid JSON", async () => {
    forcedResponse = "not-json";

    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.snapshot_id).toBeTruthy();
  });

  it("explains guardrail overrides in the snapshot explanation", async () => {
    forcedResponse = JSON.stringify({
      recommendation_type: "DO_NOTHING",
      recommendation_summary: "No action.",
      proposed_actions: [],
      explanation: {
        decision_summary: "Model tried to do nothing.",
        relevant_portfolio_state: "Inputs were parsed from the request.",
        policy_basis:
          "Targets: equities 0.8, bonds 0.15, cash 0.05. Bands: equities 0.05, bonds 0.04, cash 0.02.",
        reasoning_and_tradeoffs: "Model output prior to guardrails.",
        uncertainty_and_confidence: "Medium confidence.",
        next_review_or_trigger: "Review if inputs change.",
      },
    });

    const result = await runDecision({
      request_note:
        "Evaluate against policy. Portfolio state: Equities 90%, Bonds 8%, Cash 2%. No new cash flows.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.9, BONDS: 0.08, CASH: 0.02 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("DEFER_AND_REVIEW");
    expect(result.snapshot.explanation.decision_summary).toContain("Guardrails override");
  });

  it("injects deterministic policy basis even when model response is generic", async () => {
    forcedResponse = JSON.stringify({
      recommendation_type: "DO_NOTHING",
      recommendation_summary: "No action.",
      proposed_actions: [],
      explanation: {
        decision_summary: "Within tolerance.",
        relevant_portfolio_state: "Inputs were parsed from the request.",
        policy_basis: "Policy allows no action.",
        reasoning_and_tradeoffs: "No action needed.",
        uncertainty_and_confidence: "High confidence.",
        next_review_or_trigger: "Review if inputs change.",
      },
    });

    const result = await runDecision({
      request_note:
        "Evaluate my portfolio against the policy. Portfolio state: Equities 78%, Bonds 16%, Cash 6%. No new contributions or withdrawals.",
      portfolio_state: {
        as_of_date: "2026-02-07",
        total_value_gbp: 100000,
        weights: { EQUITIES: 0.78, BONDS: 0.16, CASH: 0.06 },
        cash_flows: {
          pending_contributions_gbp: 0,
          pending_withdrawals_gbp: 0,
        },
      },
      risk_inputs: defaultRiskInputs,
    });

    expect(result.snapshot.recommendation.type).toBe("DO_NOTHING");
    expect(result.snapshot.explanation.policy_basis).toContain("Targets: equities 0.8");
    expect(result.snapshot.explanation.policy_basis).toContain("Bands: equities 0.05");
  });
});
