import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";
import { getDashboardModel, type StepKey } from "@/components/dashboardStatusMapping";
import { getNextAction } from "@/lib/lifecycle/nextAction";

const STEP_ROWS: Array<{ key: StepKey; label: string }> = [
  { key: "IPS", label: "IPS" },
  { key: "RISK", label: "Risk Profile" },
  { key: "GUIDELINES", label: "Portfolio Guidelines" },
  { key: "DECISIONS", label: "Decisions" },
];

type DashboardStatusProps = {
  lifecycleState: PolicyLifecycleState;
};

export default function DashboardStatus({ lifecycleState }: DashboardStatusProps) {
  const model = getDashboardModel(lifecycleState);
  const nextAction = getNextAction(lifecycleState);

  return (
    <section className="card" style={{ padding: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {STEP_ROWS.map((step) => (
            <tr key={step.key}>
              <td style={{ padding: "8px 0" }}>{step.label}</td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>
                <span className="msg__bubble">{model.steps[step.key]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <a className="btn btn--primary" href={nextAction.route}>
          {nextAction.label}
        </a>
      </div>
    </section>
  );
}
