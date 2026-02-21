import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import DashboardStatus from "@/components/DashboardStatus";
import { getDashboardModel, type StepStatus } from "@/components/dashboardStatusMapping";
import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";

describe("dashboardStatusMapping", () => {
  const cases: Array<{
    lifecycle: PolicyLifecycleState;
    expectedSteps: {
      IPS: StepStatus;
      RISK: StepStatus;
      GUIDELINES: StepStatus;
      DECISIONS: StepStatus;
    };
  }> = [
    {
      lifecycle: "NO_IPS",
      expectedSteps: {
        IPS: "NOT_STARTED",
        RISK: "LOCKED",
        GUIDELINES: "LOCKED",
        DECISIONS: "LOCKED",
      },
    },
    {
      lifecycle: "IPS_DRAFT",
      expectedSteps: {
        IPS: "IN_PROGRESS",
        RISK: "LOCKED",
        GUIDELINES: "LOCKED",
        DECISIONS: "LOCKED",
      },
    },
    {
      lifecycle: "RISK_PROFILE_MISSING",
      expectedSteps: {
        IPS: "COMPLETE",
        RISK: "NOT_STARTED",
        GUIDELINES: "LOCKED",
        DECISIONS: "LOCKED",
      },
    },
    {
      lifecycle: "RISK_PROFILE_FROZEN",
      expectedSteps: {
        IPS: "COMPLETE",
        RISK: "COMPLETE",
        GUIDELINES: "NOT_STARTED",
        DECISIONS: "LOCKED",
      },
    },
    {
      lifecycle: "GUIDELINES_DERIVED",
      expectedSteps: {
        IPS: "COMPLETE",
        RISK: "COMPLETE",
        GUIDELINES: "IN_PROGRESS",
        DECISIONS: "LOCKED",
      },
    },
    {
      lifecycle: "GUIDELINES_COMPILED",
      expectedSteps: {
        IPS: "COMPLETE",
        RISK: "COMPLETE",
        GUIDELINES: "COMPLETE",
        DECISIONS: "NOT_STARTED",
      },
    },
  ];

  it.each(cases)("returns deterministic model for $lifecycle", ({ lifecycle, expectedSteps }) => {
    const model = getDashboardModel(lifecycle);

    expect(model.steps).toEqual(expectedSteps);
  });
});

describe("DashboardStatus", () => {
  it("renders fixed 4 steps and exactly one CTA link", () => {
    render(<DashboardStatus lifecycleState="RISK_PROFILE_MISSING" />);

    expect(screen.getByText("IPS")).toBeInTheDocument();
    expect(screen.getByText("Risk Profile")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Guidelines")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Complete Risk Profile");
    expect(links[0]).toHaveAttribute("href", "/setup/risk-profile");
  });
});
