import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";

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
