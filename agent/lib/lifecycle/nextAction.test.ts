import { describe, expect, it } from "vitest";

import { isRouteAllowedForLifecycle } from "@/lib/guards/lifecycleGuards";
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

  it.each(LIFECYCLE_STATES)("returns a route allowed for the same lifecycle state: %s", (state) => {
    const { route } = getNextAction(state);

    expect(isRouteAllowedForLifecycle(route, state)).toBe(true);
  });
});
