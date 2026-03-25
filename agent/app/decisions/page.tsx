import { redirect } from "next/navigation";

import DecisionRunner from "@/components/DecisionRunner";
import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import { canAccessDecisions, getRedirectForLifecycle } from "@/lib/guards/lifecycleGuards";

export default async function DecisionsPage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  if (!canAccessDecisions(lifecycleState)) {
    redirect(getRedirectForLifecycle(lifecycleState));
  }

  return <DecisionRunner />;
}

