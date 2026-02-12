import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";

export type StepKey = "IPS" | "RISK" | "GUIDELINES" | "DECISIONS";

export type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "LOCKED";

export type DashboardCTA = {
  label: string;
  href: string;
};

export type DashboardStateModel = {
  steps: Record<StepKey, StepStatus>;
  cta: DashboardCTA;
};

const DASHBOARD_STATE_MODELS: Record<PolicyLifecycleState, DashboardStateModel> = {
  NO_IPS: {
    steps: {
      IPS: "NOT_STARTED",
      RISK: "LOCKED",
      GUIDELINES: "LOCKED",
      DECISIONS: "LOCKED",
    },
    cta: {
      label: "Set up IPS",
      href: "/setup/ips",
    },
  },
  IPS_DRAFT: {
    steps: {
      IPS: "IN_PROGRESS",
      RISK: "LOCKED",
      GUIDELINES: "LOCKED",
      DECISIONS: "LOCKED",
    },
    cta: {
      label: "Complete IPS",
      href: "/setup/ips",
    },
  },
  RISK_PROFILE_MISSING: {
    steps: {
      IPS: "COMPLETE",
      RISK: "NOT_STARTED",
      GUIDELINES: "LOCKED",
      DECISIONS: "LOCKED",
    },
    cta: {
      label: "Complete Risk Profile",
      href: "/setup/risk-profile",
    },
  },
  RISK_PROFILE_FROZEN: {
    steps: {
      IPS: "COMPLETE",
      RISK: "COMPLETE",
      GUIDELINES: "NOT_STARTED",
      DECISIONS: "LOCKED",
    },
    cta: {
      label: "Create Guidelines",
      href: "/setup/guidelines",
    },
  },
  GUIDELINES_DERIVED: {
    steps: {
      IPS: "COMPLETE",
      RISK: "COMPLETE",
      GUIDELINES: "IN_PROGRESS",
      DECISIONS: "LOCKED",
    },
    cta: {
      label: "Review Guidelines",
      href: "/setup/guidelines",
    },
  },
  GUIDELINES_COMPILED: {
    steps: {
      IPS: "COMPLETE",
      RISK: "COMPLETE",
      GUIDELINES: "COMPLETE",
      DECISIONS: "NOT_STARTED",
    },
    cta: {
      label: "Go to Decisions",
      href: "/decisions",
    },
  },
};

export function getDashboardModel(lifecycle: PolicyLifecycleState): DashboardStateModel {
  return DASHBOARD_STATE_MODELS[lifecycle];
}
