import DashboardStatus from "@/components/DashboardStatus";
import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";

export default async function DashboardPage() {
  const { lifecycleState, nextAction } = await loadDashboardLifecycle();

  return (
    <main className="app">
      <p data-testid="dashboard-lifecycle-state">Lifecycle: {lifecycleState}</p>
      <p data-testid="dashboard-next-cta-route">Next CTA route: {nextAction.route}</p>
      <DashboardStatus lifecycleState={lifecycleState} />
    </main>
  );
}
