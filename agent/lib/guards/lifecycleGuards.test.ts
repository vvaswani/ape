import { describe, expect, it } from "vitest";

import {
  canAccessDecisions,
  canAccessGuidelines,
  canAccessRiskProfile,
  getRedirectForLifecycle,
  isRouteAllowedForLifecycle,
} from "@/lib/guards/lifecycleGuards";
import { getNextAction } from "@/lib/lifecycle/nextAction";

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
    expect(getRedirectForLifecycle("RISK_PROFILE_MISSING")).toBe(getNextAction("RISK_PROFILE_MISSING").route);
  });

  it("codifies route allow rules for guarded and safe routes", () => {
    expect(isRouteAllowedForLifecycle("/setup/ips", "NO_IPS")).toBe(true);
    expect(isRouteAllowedForLifecycle("/dashboard", "NO_IPS")).toBe(true);
    expect(isRouteAllowedForLifecycle("/chat", "NO_IPS")).toBe(true);
    expect(isRouteAllowedForLifecycle("/decisions", "GUIDELINES_DERIVED")).toBe(false);
    expect(isRouteAllowedForLifecycle("/setup/risk-profile", "NO_IPS")).toBe(false);
    expect(isRouteAllowedForLifecycle("/setup/guidelines", "RISK_PROFILE_MISSING")).toBe(false);
    expect(isRouteAllowedForLifecycle("/unknown-route", "NO_IPS")).toBe(true);
  });
});
