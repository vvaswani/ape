import type { PolicyState } from "@/lib/policy/types";

export type PolicyLifecycleState =
  | "NO_IPS"
  | "IPS_DRAFT"
  | "RISK_PROFILE_MISSING"
  | "RISK_PROFILE_FROZEN"
  | "GUIDELINES_DERIVED"
  | "GUIDELINES_COMPILED";

export function resolveLifecycleState(policyState: PolicyState | null): PolicyLifecycleState {
  if (policyState === null) {
    return "NO_IPS";
  }

  if (policyState.ips?.status === "DRAFT") {
    return "IPS_DRAFT";
  }

  if (
    policyState.ips?.status === "FROZEN" &&
    (!policyState.riskProfile || policyState.riskProfile.status === "MISSING")
  ) {
    return "RISK_PROFILE_MISSING";
  }

  if (
    policyState.riskProfile?.status === "FROZEN" &&
    (!policyState.guidelines || policyState.guidelines.status === "MISSING")
  ) {
    return "RISK_PROFILE_FROZEN";
  }

  if (policyState.guidelines?.status === "DERIVED") {
    return "GUIDELINES_DERIVED";
  }

  if (policyState.guidelines?.status === "COMPILED") {
    return "GUIDELINES_COMPILED";
  }

  return "NO_IPS";
}
