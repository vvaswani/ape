import DashboardStatus from "@/components/DashboardStatus";
import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";

export default async function DashboardPage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  return (
    <main className="app">
      <p>Lifecycle: {lifecycleState}</p>
      <DashboardStatus lifecycleState={lifecycleState} />
    </main>
  );
}
