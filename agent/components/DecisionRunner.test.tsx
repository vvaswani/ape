import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import DecisionRunner from "@/components/DecisionRunner";

const originalFetch = global.fetch;

function createSnapshotResponse() {
  return {
    snapshot: {
      snapshot_id: "snap-1",
      snapshot_version: "0.3",
      created_at: "2026-03-24T00:00:00.000Z",
      project: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",
      outcome_state: "RECOMMEND_NO_ACTION",
      inputs_observed: [],
      inputs_missing: [],
      inputs_provenance: {
        risk_inputs: "supplied",
        authority: "derived",
      },
      inputs_evaluated: {
        risk_inputs: true,
        authority: true,
      },
      policy_items_referenced: [],
      warnings: [],
      errors: [],
      context: {
        user_id: "local",
        environment: "test",
        jurisdiction: "UK",
        base_currency: "GBP",
      },
      inputs: {
        portfolio_state: {
          total_value: 100000,
          asset_allocation: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
          cash_balance: null,
        },
        cash_flows: {
          pending_contributions: 0,
          pending_withdrawals: 0,
        },
        constraints: {},
        market_context: {
          as_of_date: "2026-03-24",
        },
      },
      governance: {
        investment_policy: {
          policy_id: "ape-policy",
          policy_version: "0.1-test",
          policy_source: "test",
        },
        explanation_contract: {
          version: "0.1-default",
        },
      },
      evaluation: {
        policy_applied: {
          targets: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
          bands: { EQUITIES: 0.05, BONDS: 0.04, CASH: 0.02 },
          risk_guardrails_used: [],
          evaluated_policies: [],
          skipped_policies: [],
          status: "applied",
          reason_codes: [],
        },
        correctness: {
          status: "pass",
          checks_run: [],
        },
        drift: {
          status: "computed",
          target_weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
          actual_weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
          absolute_drift: { EQUITIES: 0, BONDS: 0, CASH: 0 },
          bands_breached: false,
        },
        drift_analysis: {
          target_weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
          actual_weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
          absolute_drift: { EQUITIES: 0, BONDS: 0, CASH: 0 },
          bands_breached: false,
        },
        risk_checks: {
          risk_capacity_breached: false,
        },
      },
      recommendation: {
        type: "DO_NOTHING",
        summary: "No action.",
        proposed_actions: [],
        turnover_estimate: {
          gross_turnover_pct: null,
          trade_count: 0,
        },
      },
      explanation: {
        decision_summary: "No action required.",
        relevant_portfolio_state: "Portfolio provided.",
        policy_basis: "Policy basis.",
        reasoning_and_tradeoffs: "Within bands.",
        uncertainty_and_confidence: "High confidence.",
        next_review_or_trigger: "Review if inputs change.",
      },
      user_acknowledgement: {
        decision: "DEFER",
        acknowledged_at: null,
      },
      outcome: {
        implemented: null,
        implementation_notes: null,
        review_date: null,
        observed_effects: null,
      },
      audit: {
        logic_version: "0.3",
      },
    },
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("DecisionRunner", () => {
  it("submits to /api/decisions and renders the snapshot", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => createSnapshotResponse(),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    render(<DecisionRunner />);

    await user.type(screen.getByLabelText("Decision note (optional)"), "Review current allocation");
    await user.type(screen.getByLabelText("Rolling 12m drawdown (decimal)"), "0.12");
    await user.selectOptions(screen.getByLabelText("Risk capacity breached"), "false");
    await user.click(screen.getByRole("button", { name: "Run Decision" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decisions",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(
      await screen.findByText((_, element) => element?.textContent === "DO_NOTHING — No action."),
    ).toBeInTheDocument();
    expect(screen.getByText("No action required.")).toBeInTheDocument();
  });

  it("renders API failure text when the canonical endpoint fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        error: {
          message: "Decision service unavailable.",
        },
      }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    render(<DecisionRunner />);
    await user.click(screen.getByRole("button", { name: "Run Decision" }));

    expect(await screen.findByText("Decision service unavailable.")).toBeInTheDocument();
  });
});
