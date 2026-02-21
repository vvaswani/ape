import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";
import { getNextAction } from "@/lib/lifecycle/nextAction";

const GUIDELINES_ACCESS_STATES: ReadonlySet<PolicyLifecycleState> = new Set([
  "RISK_PROFILE_FROZEN",
  "GUIDELINES_DERIVED",
  "GUIDELINES_COMPILED",
]);

export function canAccessDecisions(state: PolicyLifecycleState): boolean {
  return state === "GUIDELINES_COMPILED";
}

export function canAccessRiskProfile(state: PolicyLifecycleState): boolean {
  return state !== "NO_IPS" && state !== "IPS_DRAFT";
}

export function canAccessGuidelines(state: PolicyLifecycleState): boolean {
  return GUIDELINES_ACCESS_STATES.has(state);
}

export function isRouteAllowedForLifecycle(route: string, state: PolicyLifecycleState): boolean {
  if (route === "/decisions") {
    return canAccessDecisions(state);
  }

  if (route === "/setup/risk-profile") {
    return canAccessRiskProfile(state);
  }

  if (route === "/setup/guidelines") {
    return canAccessGuidelines(state);
  }

  if (route === "/setup/ips" || route === "/dashboard" || route === "/chat") {
    return true;
  }

  return true;
}

export function getRedirectForLifecycle(state: PolicyLifecycleState): string {
  return getNextAction(state).route;
}
