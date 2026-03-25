"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import DecisionPanel from "@/components/DecisionPanel";
import PortfolioStateForm from "@/components/PortfolioStateForm";
import ResponsePanel from "@/components/ResponsePanel";
import type { DecisionRequest, DecisionResponse } from "@/lib/domain/decision";
import type { DecisionSnapshot } from "@/lib/domain/decisionSnapshot";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";
import type { RiskInputs } from "@/lib/domain/riskInputs";

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function DecisionRunner() {
  const [requestNote, setRequestNote] = useState("");
  const [portfolioState, setPortfolioState] = useState<PortfolioStateInput>({
    as_of_date: new Date().toISOString().slice(0, 10),
    total_value_gbp: null,
    weights: { EQUITIES: null, BONDS: null, CASH: null },
    cash_flows: { pending_contributions_gbp: null, pending_withdrawals_gbp: null },
  });
  const [drawdownInput, setDrawdownInput] = useState("");
  const [riskCapacityBreached, setRiskCapacityBreached] = useState("false");
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const riskInputs: RiskInputs = {
      rolling_12m_drawdown_pct: toNullableNumber(drawdownInput),
      risk_capacity_breached: riskCapacityBreached === "unknown" ? null : riskCapacityBreached === "true",
    };

    const payload: DecisionRequest = {
      request_note: requestNote.trim() || undefined,
      portfolio_state: portfolioState,
      risk_inputs: riskInputs,
    };

    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as DecisionResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(
          data && "error" in data
            ? data.error?.message ?? `Request failed: ${response.status}`
            : `Request failed: ${response.status}`,
        );
      }

      setSnapshot((data as DecisionResponse).snapshot);
    } catch (submitError) {
      setSnapshot(null);
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__brand">APE Decisions</div>
        <div className="app__subtitle">Deterministic decision execution from the canonical non-chat boundary</div>
      </header>

      <div className="card">
        <form className="chat" onSubmit={onSubmit}>
          <div className="chat__topbar">
            <div className="chat__hint">Decision request · Structured inputs are authoritative</div>
          </div>

          <div className="composer" style={{ paddingTop: 0 }}>
            <label className="chat__hint" htmlFor="request-note">
              Decision note (optional)
            </label>
            <textarea
              id="request-note"
              className="composer__input"
              rows={4}
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder="Optional context for this decision request"
            />
          </div>

          <PortfolioStateForm value={portfolioState} onChange={setPortfolioState} />

          <div style={{ marginBottom: 12 }}>
            <div className="chat__topbar">
              <div className="chat__hint">Risk inputs</div>
            </div>

            <div className="composer" style={{ paddingTop: 0 }}>
              <label className="chat__hint" htmlFor="drawdown-input">
                Rolling 12m drawdown (decimal)
              </label>
              <input
                id="drawdown-input"
                className="composer__input"
                value={drawdownInput}
                onChange={(event) => setDrawdownInput(event.target.value)}
                placeholder="e.g. 0.12"
              />
            </div>

            <div className="composer" style={{ paddingTop: 0 }}>
              <label className="chat__hint" htmlFor="risk-capacity">
                Risk capacity breached
              </label>
              <select
                id="risk-capacity"
                className="composer__input"
                value={riskCapacityBreached}
                onChange={(event) => setRiskCapacityBreached(event.target.value)}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          <ResponsePanel isLoading={isLoading} error={error} />

          <div className="composer" style={{ paddingTop: 0 }}>
            <button className="btn btn--primary" type="submit" disabled={isLoading}>
              Run Decision
            </button>
          </div>

          {snapshot && <DecisionPanel snapshot={snapshot} />}
        </form>
      </div>
    </main>
  );
}
