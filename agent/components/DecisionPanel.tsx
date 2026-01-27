/**
 * @file DecisionPanel.tsx
 * @description
 * Renders a Decision Snapshot in a readable, audit-friendly way.
 */

import type { DecisionSnapshot } from "@/lib/domain/decisionSnapshot";

export default function DecisionPanel({ snapshot }: { snapshot: DecisionSnapshot }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="divider" />

      <div className="chat" style={{ paddingTop: 12 }}>
        <div className="chat__topbar">
          <div className="chat__hint">
            Decision Snapshot • Policy {snapshot.governance.investment_policy.policy_version} • Contract{" "}
            {snapshot.governance.explanation_contract.version}
          </div>
        </div>

        <div className="msg">
          <div className="msg__meta">Recommendation</div>
          <div className="msg__bubble">
            <strong>{snapshot.recommendation.type}</strong> — {snapshot.recommendation.summary}
          </div>
        </div>

        <div className="msg">
          <div className="msg__meta">Decision Summary</div>
          <div className="msg__bubble">{snapshot.explanation.decision_summary}</div>
        </div>

        <div className="msg">
          <div className="msg__meta">Relevant Portfolio State</div>
          <div className="msg__bubble">{snapshot.explanation.relevant_portfolio_state}</div>
        </div>

        <div className="msg">
          <div className="msg__meta">Policy Basis</div>
          <div className="msg__bubble">{snapshot.explanation.policy_basis}</div>
        </div>

        <div className="msg">
          <div className="msg__meta">Reasoning & Trade-offs</div>
          <div className="msg__bubble">{snapshot.explanation.reasoning_and_tradeoffs}</div>
        </div>

        <div className="msg">
          <div className="msg__meta">Uncertainty & Confidence</div>
          <div className="msg__bubble">{snapshot.explanation.uncertainty_and_confidence}</div>
        </div>

        <div className="msg">
          <div className="msg__meta">Next Review / Trigger</div>
          <div className="msg__bubble">{snapshot.explanation.next_review_or_trigger}</div>
        </div>

        <details style={{ marginTop: 10 }}>
          <summary className="chat__hint">Raw snapshot JSON</summary>
          <pre className="msg__bubble" style={{ width: "100%", maxWidth: "100%", overflow: "auto" }}>
{JSON.stringify(snapshot, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
