"use client";

/**
 * @file PortfolioStateForm.tsx
 * @description
 * Minimal, explicit portfolio state input (manual, structured).
 */

import { useState } from "react";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";

export default function PortfolioStateForm({
  value,
  onChange,
}: {
  value: PortfolioStateInput;
  onChange: (next: PortfolioStateInput) => void;
}) {
  const [raw, setRaw] = useState({
    total: value.total_value_gbp?.toString() ?? "",
    eq: value.weights.EQUITIES.toString(),
    bd: value.weights.BONDS.toString(),
    cs: value.weights.CASH.toString(),
    contrib: value.cash_flows.pending_contributions_gbp?.toString() ?? "",
    wd: value.cash_flows.pending_withdrawals_gbp?.toString() ?? "",
  });

  function toNum(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function update(nextRaw: typeof raw) {
    setRaw(nextRaw);

    onChange({
      as_of_date: value.as_of_date,
      total_value_gbp: toNum(nextRaw.total),
      weights: {
        EQUITIES: Number(nextRaw.eq),
        BONDS: Number(nextRaw.bd),
        CASH: Number(nextRaw.cs),
      },
      cash_flows: {
        pending_contributions_gbp: toNum(nextRaw.contrib),
        pending_withdrawals_gbp: toNum(nextRaw.wd),
      },
    });
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="chat__topbar">
        <div className="chat__hint">Portfolio state (manual input)</div>
      </div>

      <div className="composer" style={{ paddingTop: 0 }}>
        <input
          className="composer__input"
          value={value.as_of_date}
          onChange={(e) => onChange({ ...value, as_of_date: e.target.value })}
          placeholder="YYYY-MM-DD"
        />
      </div>

      <div className="composer" style={{ paddingTop: 0 }}>
        <input
          className="composer__input"
          value={raw.total}
          onChange={(e) => update({ ...raw, total: e.target.value })}
          placeholder="Total value (GBP, optional)"
        />
      </div>

      <div className="composer" style={{ paddingTop: 0 }}>
        <input
          className="composer__input"
          value={raw.eq}
          onChange={(e) => update({ ...raw, eq: e.target.value })}
          placeholder="Equities weight (e.g. 0.63)"
        />
        <input
          className="composer__input"
          value={raw.bd}
          onChange={(e) => update({ ...raw, bd: e.target.value })}
          placeholder="Bonds weight (e.g. 0.27)"
        />
        <input
          className="composer__input"
          value={raw.cs}
          onChange={(e) => update({ ...raw, cs: e.target.value })}
          placeholder="Cash weight (e.g. 0.10)"
        />
      </div>

      <div className="composer" style={{ paddingTop: 0 }}>
        <input
          className="composer__input"
          value={raw.contrib}
          onChange={(e) => update({ ...raw, contrib: e.target.value })}
          placeholder="Pending contribution (GBP, optional)"
        />
        <input
          className="composer__input"
          value={raw.wd}
          onChange={(e) => update({ ...raw, wd: e.target.value })}
          placeholder="Pending withdrawal (GBP, optional)"
        />
      </div>

      <div className="chat__hint">
        Weights should sum to ~1.0 (e.g., 0.63 + 0.27 + 0.10 = 1.00).
      </div>
    </div>
  );
}
