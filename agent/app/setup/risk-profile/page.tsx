import { redirect } from "next/navigation";

import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import { canAccessRiskProfile } from "@/lib/guards/lifecycleGuards";

export default async function RiskProfilePage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  if (!canAccessRiskProfile(lifecycleState)) {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>Risk Profile</h1>
      <p>Not implemented.</p>
    </main>
  );
}

