import { describe, expect, it } from "vitest";

import { getNextAction } from "@/lib/lifecycle/nextAction";
import type { PolicyLifecycleState } from "@/lib/policy/LifecycleResolver";

const LIFECYCLE_STATES: readonly PolicyLifecycleState[] = [
  "NO_IPS",
  "IPS_DRAFT",
  "RISK_PROFILE_MISSING",
  "RISK_PROFILE_FROZEN",
  "GUIDELINES_DERIVED",
  "GUIDELINES_COMPILED",
] as const;

describe("getNextAction", () => {
  it.each(LIFECYCLE_STATES)("returns non-empty route and label for %s", (state) => {
    const action = getNextAction(state);

    expect(action.route).toBeTruthy();
    expect(action.label).toBeTruthy();
  });

  it("returns expected route for RISK_PROFILE_MISSING", () => {
    expect(getNextAction("RISK_PROFILE_MISSING").route).toBe("/setup/risk-profile");
  });
});
