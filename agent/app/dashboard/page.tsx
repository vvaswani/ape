import DashboardStatus from "@/components/DashboardStatus";
import { JsonPolicyStateRepository } from "@/lib/policy/JsonPolicyStateRepository";
import { resolveLifecycleState } from "@/lib/policy/LifecycleResolver";
import { LocalUserContextProvider } from "@/lib/user/LocalUserContextProvider";

export default async function DashboardPage() {
  const userProvider = new LocalUserContextProvider();
  const user = userProvider.getCurrentUser();

  const policyRepository = new JsonPolicyStateRepository();
  const policyState = await policyRepository.getPolicyState(user.userId);
  const lifecycleState = resolveLifecycleState(policyState);

  return (
    <main className="app">
      <DashboardStatus lifecycleState={lifecycleState} />
    </main>
  );
}
