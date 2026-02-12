import { describe, expect, it } from "vitest";

import { resolveLifecycleState } from "@/lib/policy/LifecycleResolver";
import type { PolicyState } from "@/lib/policy/types";

describe("resolveLifecycleState", () => {
  it('returns "NO_IPS" for null policy state', () => {
    expect(resolveLifecycleState(null)).toBe("NO_IPS");
  });

  it('returns "IPS_DRAFT" for IPS draft status', () => {
    const state: PolicyState = {
      userId: "user1",
      ips: {
        ipsVersion: "v1",
        ipsSha256: "abc123",
        status: "DRAFT",
        createdAtIso: "2026-02-12T00:00:00.000Z",
        content: "ips",
      },
    };

    expect(resolveLifecycleState(state)).toBe("IPS_DRAFT");
  });

  it('returns "RISK_PROFILE_MISSING" for frozen IPS with no risk profile', () => {
    const state: PolicyState = {
      userId: "user1",
      ips: {
        ipsVersion: "v1",
        ipsSha256: "abc123",
        status: "FROZEN",
        createdAtIso: "2026-02-12T00:00:00.000Z",
        content: "ips",
      },
    };

    expect(resolveLifecycleState(state)).toBe("RISK_PROFILE_MISSING");
  });

  it('returns "RISK_PROFILE_FROZEN" for frozen risk profile with no guidelines', () => {
    const state: PolicyState = {
      userId: "user1",
      riskProfile: {
        version: "v1",
        status: "FROZEN",
        createdAtIso: "2026-02-12T00:05:00.000Z",
        summary: "summary",
      },
    };

    expect(resolveLifecycleState(state)).toBe("RISK_PROFILE_FROZEN");
  });

  it('returns "GUIDELINES_DERIVED" for derived guidelines status', () => {
    const state: PolicyState = {
      userId: "user1",
      guidelines: {
        version: "v1",
        status: "DERIVED",
        createdAtIso: "2026-02-12T00:10:00.000Z",
        payloadJson: "{}",
      },
    };

    expect(resolveLifecycleState(state)).toBe("GUIDELINES_DERIVED");
  });

  it('returns "GUIDELINES_COMPILED" for compiled guidelines status', () => {
    const state: PolicyState = {
      userId: "user1",
      guidelines: {
        version: "v1",
        status: "COMPILED",
        createdAtIso: "2026-02-12T00:10:00.000Z",
        payloadJson: "{}",
      },
    };

    expect(resolveLifecycleState(state)).toBe("GUIDELINES_COMPILED");
  });
});
