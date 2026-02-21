import { redirect } from "next/navigation";

import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import { canAccessRiskProfile, getRedirectForLifecycle } from "@/lib/guards/lifecycleGuards";

export default async function RiskProfilePage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  if (!canAccessRiskProfile(lifecycleState)) {
    redirect(getRedirectForLifecycle(lifecycleState));
  }

  return (
    <main>
      <h1>Risk Profile</h1>
      <p>Not implemented.</p>
    </main>
  );
}

