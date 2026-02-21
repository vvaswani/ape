import { describe, expect, it } from "vitest";

import {
  canAccessDecisions,
  canAccessGuidelines,
  canAccessRiskProfile,
  getRedirectForLifecycle,
} from "@/lib/guards/lifecycleGuards";

describe("lifecycleGuards", () => {
  it("enforces decisions access only for GUIDELINES_COMPILED", () => {
    expect(canAccessDecisions("GUIDELINES_DERIVED")).toBe(false);
    expect(canAccessDecisions("GUIDELINES_COMPILED")).toBe(true);
  });

  it("enforces risk profile access only after IPS is frozen", () => {
    expect(canAccessRiskProfile("NO_IPS")).toBe(false);
    expect(canAccessRiskProfile("RISK_PROFILE_MISSING")).toBe(true);
  });

  it("enforces guidelines access at or after RISK_PROFILE_FROZEN", () => {
    expect(canAccessGuidelines("RISK_PROFILE_MISSING")).toBe(false);
    expect(canAccessGuidelines("RISK_PROFILE_FROZEN")).toBe(true);
  });

  it("returns redirect route from lifecycle next-action mapping", () => {
    expect(getRedirectForLifecycle("RISK_PROFILE_MISSING")).toBe("/setup/risk-profile");
  });
});
