import { redirect } from "next/navigation";

import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import { canAccessDecisions, getRedirectForLifecycle } from "@/lib/guards/lifecycleGuards";

export default async function DecisionsPage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  if (!canAccessDecisions(lifecycleState)) {
    redirect(getRedirectForLifecycle(lifecycleState));
  }

  return (
    <main>
      <h1>Decisions</h1>
      <p>Not implemented.</p>
    </main>
  );
}

