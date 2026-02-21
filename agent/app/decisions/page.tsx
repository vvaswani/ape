import { redirect } from "next/navigation";

import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import { canAccessDecisions } from "@/lib/guards/lifecycleGuards";

export default async function DecisionsPage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  if (!canAccessDecisions(lifecycleState)) {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>Decisions</h1>
      <p>Not implemented.</p>
    </main>
  );
}

