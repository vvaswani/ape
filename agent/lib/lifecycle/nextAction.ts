import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";

export type NextAction = {
  route: string;
  label: string;
};

const NEXT_ACTION: Record<PolicyLifecycleState, NextAction> = {
  NO_IPS: {
    route: "/setup/ips",
    label: "Set up IPS",
  },
  IPS_DRAFT: {
    route: "/setup/ips",
    label: "Complete IPS",
  },
  RISK_PROFILE_MISSING: {
    route: "/setup/risk-profile",
    label: "Complete Risk Profile",
  },
  RISK_PROFILE_FROZEN: {
    route: "/setup/guidelines",
    label: "Create Guidelines",
  },
  GUIDELINES_DERIVED: {
    route: "/setup/guidelines",
    label: "Review Guidelines",
  },
  GUIDELINES_COMPILED: {
    route: "/decisions",
    label: "Go to Decisions",
  },
};

export function getNextAction(state: PolicyLifecycleState): NextAction {
  return NEXT_ACTION[state];
}
