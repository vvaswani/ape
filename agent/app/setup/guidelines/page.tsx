import { redirect } from "next/navigation";

import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import { canAccessGuidelines } from "@/lib/guards/lifecycleGuards";

export default async function PortfolioGuidelinesPage() {
  const { lifecycleState } = await loadDashboardLifecycle();

  if (!canAccessGuidelines(lifecycleState)) {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>Portfolio Guidelines</h1>
      <p>Not implemented.</p>
    </main>
  );
}

