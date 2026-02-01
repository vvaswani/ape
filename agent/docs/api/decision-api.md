# APE Decision API Contract (v0.1)

## Endpoint

**`POST /api/chat`**

## Purpose

Accepts a chat history plus an optional **structured portfolio_state** and returns a **Decision Snapshot** (policy-stamped, deterministic drift + model explanation).

## Request body (JSON)

```ts
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type PortfolioStateInput = {
  as_of_date: string; // YYYY-MM-DD
  total_value_gbp: number | null;

  weights: {
    EQUITIES: number | null; // decimal (0.63 not 63)
    BONDS: number | null;
    CASH: number | null;
  };

  cash_flows: {
    pending_contributions_gbp: number | null;
    pending_withdrawals_gbp: number | null;
  };
};

type ChatRequest = {
  messages: ChatMessage[];
  portfolio_state?: PortfolioStateInput;
};
```

### Required invariants

* `messages` **must** be an array.
* If `portfolio_state` is provided:

  * weights are **decimals** (0–1), not percentages
  * weights should sum to ~1.0 (validation may be loose in MVP)
  * if any weights are missing/null, the state is treated as incomplete
* Policy resolution order:

  1. `/artifacts/local/policy.local.json`
  2. `/artifacts/policy/default/policy.default.json`

## Response body (JSON)

```ts
type ChatResponse = {
  snapshot: DecisionSnapshot;
};
```

### Response guarantees

* Always returns a snapshot on success.
* If model output is invalid JSON, system returns a **safe fallback** snapshot:

  * deterministic `recommendation.type` is preserved
  * explanation notes parsing failure
  * model raw output may be logged (dev)

## Decision Snapshot ownership

* Deterministic fields owned by code:

  * policy provenance (`governance.investment_policy`)
  * targets/bands
  * drift math (`evaluation.drift_analysis`)
  * portfolio_state input echo (`inputs.portfolio_state`)
* Model-owned fields:

  * recommendation summary
  * proposed actions (optional)
  * explanation text

## Errors

* `500` only for unexpected server failures (MVP).
  (Expected “bad model output” should **not** 500; it should fallback.)





```
docs(api): add decision API contract and milestone checklist
```

