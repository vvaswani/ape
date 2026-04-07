import { JsonPolicyStateRepository } from "@/lib/policy/JsonPolicyStateRepository";
import { resolveLifecycleState, type PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import { getNextAction, type NextAction } from "@/lib/lifecycle/nextAction";
import { LocalUserContextProvider } from "@/lib/user/LocalUserContextProvider";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";

type LoadDashboardLifecycleDeps = {
  userProvider?: UserContextProvider;
  policyRepo?: PolicyStateRepository;
};

type DashboardLifecycleResult = {
  userId: string;
  lifecycleState: PolicyLifecycleState;
  nextAction: NextAction;
};

export async function loadDashboardLifecycle(
  deps: LoadDashboardLifecycleDeps = {},
): Promise<DashboardLifecycleResult> {
  const userProvider = deps.userProvider ?? new LocalUserContextProvider();
  const policyRepo = deps.policyRepo ?? new JsonPolicyStateRepository();

  const { userId } = userProvider.getCurrentUser();
  const policyState = await policyRepo.getPolicyState(userId);
  const lifecycleState = resolveLifecycleState(policyState);
  const nextAction = getNextAction(lifecycleState);

  return { userId, lifecycleState, nextAction };
}
