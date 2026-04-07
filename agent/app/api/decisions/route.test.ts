import { describe, expect, it, vi } from "vitest";

import { createPostHandler } from "@/app/api/decisions/route";
import type { DecisionRequest, DecisionResponse } from "@/lib/domain/decision";

function createSnapshotResponse(): DecisionResponse {
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

describe("POST /api/decisions", () => {
  it("returns snapshot from runDecision on valid decision request", async () => {
    const responseBody = createSnapshotResponse();
    const decisionRunner = vi.fn<(request: DecisionRequest) => Promise<DecisionResponse>>(async () => responseBody);
    const handler = createPostHandler({ decisionRunner });

    const response = await handler(
      new Request("http://localhost/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_note: "Review current allocation.",
          portfolio_state: {
            as_of_date: "2026-03-24",
            total_value_gbp: 100000,
            weights: { EQUITIES: 0.8, BONDS: 0.15, CASH: 0.05 },
            cash_flows: { pending_contributions_gbp: 0, pending_withdrawals_gbp: 0 },
          },
          risk_inputs: {
            rolling_12m_drawdown_pct: 0.1,
            risk_capacity_breached: false,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(responseBody);
    expect(decisionRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        request_note: "Review current allocation.",
      }),
    );
  });

  it("returns 400 when request body is malformed JSON", async () => {
    const handler = createPostHandler();

    const response = await handler(
      new Request("http://localhost/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      },
    });
  });

  it("returns 400 when body is not an object", async () => {
    const handler = createPostHandler();

    const response = await handler(
      new Request("http://localhost/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "[]",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body must be an object.",
      },
    });
  });

  it("returns 400 with unknownFields for unsupported fields", async () => {
    const handler = createPostHandler();

    const response = await handler(
      new Request("http://localhost/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_note: "Review allocation.",
          foo: "bar",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body contains unsupported fields.",
        details: {
          unknownFields: ["foo"],
        },
      },
    });
  });

  it("returns 500 when decision service throws unexpectedly", async () => {
    const decisionRunner = vi.fn<(request: DecisionRequest) => Promise<DecisionResponse>>(async () => {
      throw new Error("boom");
    });
    const handler = createPostHandler({ decisionRunner });

    const response = await handler(
      new Request("http://localhost/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_note: "Review allocation." }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal error",
      },
    });
  });
});
