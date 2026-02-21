import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";

export type StepKey = "IPS" | "RISK" | "GUIDELINES" | "DECISIONS";

export type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "LOCKED";

export type DashboardStateModel = {
  steps: Record<StepKey, StepStatus>;
};

const DASHBOARD_STATE_MODELS: Record<PolicyLifecycleState, DashboardStateModel> = {
  NO_IPS: {
    steps: {
      IPS: "NOT_STARTED",
      RISK: "LOCKED",
      GUIDELINES: "LOCKED",
      DECISIONS: "LOCKED",
    },
  },
  IPS_DRAFT: {
    steps: {
      IPS: "IN_PROGRESS",
      RISK: "LOCKED",
      GUIDELINES: "LOCKED",
      DECISIONS: "LOCKED",
    },
  },
  RISK_PROFILE_MISSING: {
    steps: {
      IPS: "COMPLETE",
      RISK: "NOT_STARTED",
      GUIDELINES: "LOCKED",
      DECISIONS: "LOCKED",
    },
  },
  RISK_PROFILE_FROZEN: {
    steps: {
      IPS: "COMPLETE",
      RISK: "COMPLETE",
      GUIDELINES: "NOT_STARTED",
      DECISIONS: "LOCKED",
    },
  },
  GUIDELINES_DERIVED: {
    steps: {
      IPS: "COMPLETE",
      RISK: "COMPLETE",
      GUIDELINES: "IN_PROGRESS",
      DECISIONS: "LOCKED",
    },
  },
  GUIDELINES_COMPILED: {
    steps: {
      IPS: "COMPLETE",
      RISK: "COMPLETE",
      GUIDELINES: "COMPLETE",
      DECISIONS: "NOT_STARTED",
    },
  },
};

export function getDashboardModel(lifecycle: PolicyLifecycleState): DashboardStateModel {
  return DASHBOARD_STATE_MODELS[lifecycle];
}
