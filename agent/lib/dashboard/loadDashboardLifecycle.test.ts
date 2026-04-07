import { describe, expect, it, vi } from "vitest";

import { loadDashboardLifecycle } from "@/lib/dashboard/loadDashboardLifecycle";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { PolicyState } from "@/lib/policy/types";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";
import type { User } from "@/lib/user/types";

describe("loadDashboardLifecycle", () => {
  it("uses current user id and resolves NO_IPS when policy state is missing", async () => {
    const getCurrentUser = vi.fn<() => User>(() => ({
      userId: "u123",
      displayName: "User 123",
      authType: "LOCAL_FAKE" as const,
    }));
    const getPolicyState = vi.fn<(userId: string) => Promise<PolicyState | null>>(async () => null);

    const userProvider: UserContextProvider = { getCurrentUser };
    const policyRepo: PolicyStateRepository = {
      getPolicyState,
      upsertIps: vi.fn(async () => undefined),
      upsertRiskProfile: vi.fn(async () => undefined),
      upsertGuidelines: vi.fn(async () => undefined),
    };

    const result = await loadDashboardLifecycle({ userProvider, policyRepo });

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(getPolicyState).toHaveBeenCalledTimes(1);
    expect(getPolicyState).toHaveBeenCalledWith("u123");
    expect(result).toEqual({
      userId: "u123",
      lifecycleState: "NO_IPS",
      nextAction: {
        route: "/setup/ips",
        label: "Set up IPS",
      },
    });
  });

  it("resolves IPS_DRAFT and IPS CTA when IPS is draft", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => ({
        userId: "u123",
        displayName: "User 123",
        authType: "LOCAL_FAKE" as const,
      })),
    };
    const policyRepo: PolicyStateRepository = {
      getPolicyState: vi.fn(async (userId: string) => ({
        userId,
        ips: {
          ipsVersion: "v1",
          ipsSha256: "abc123",
          status: "DRAFT" as const,
          createdAtIso: "2026-02-12T00:00:00.000Z",
          content: "ips",
        },
      })),
      upsertIps: vi.fn(async () => undefined),
      upsertRiskProfile: vi.fn(async () => undefined),
      upsertGuidelines: vi.fn(async () => undefined),
    };

    const result = await loadDashboardLifecycle({ userProvider, policyRepo });

    expect(policyRepo.getPolicyState).toHaveBeenCalledWith("u123");
    expect(result).toEqual({
      userId: "u123",
      lifecycleState: "IPS_DRAFT",
      nextAction: {
        route: "/setup/ips",
        label: "Complete IPS",
      },
    });
  });

  it("resolves RISK_PROFILE_MISSING and risk profile CTA when IPS is frozen", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => ({
        userId: "u123",
        displayName: "User 123",
        authType: "LOCAL_FAKE" as const,
      })),
    };
    const policyRepo: PolicyStateRepository = {
      getPolicyState: vi.fn(async (userId: string) => ({
        userId,
        ips: {
          ipsVersion: "v1",
          ipsSha256: "abc123",
          status: "FROZEN" as const,
          createdAtIso: "2026-02-12T00:00:00.000Z",
          content: "ips",
        },
      })),
      upsertIps: vi.fn(async () => undefined),
      upsertRiskProfile: vi.fn(async () => undefined),
      upsertGuidelines: vi.fn(async () => undefined),
    };

    const result = await loadDashboardLifecycle({ userProvider, policyRepo });

    expect(policyRepo.getPolicyState).toHaveBeenCalledWith("u123");
    expect(result).toEqual({
      userId: "u123",
      lifecycleState: "RISK_PROFILE_MISSING",
      nextAction: {
        route: "/setup/risk-profile",
        label: "Complete Risk Profile",
      },
    });
  });

  it("resolves NO_IPS and IPS CTA when policy state exists but ips is missing", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => ({
        userId: "u123",
        displayName: "User 123",
        authType: "LOCAL_FAKE" as const,
      })),
    };
    const policyRepo: PolicyStateRepository = {
      getPolicyState: vi.fn(async (userId: string) => ({
        userId,
      })),
      upsertIps: vi.fn(async () => undefined),
      upsertRiskProfile: vi.fn(async () => undefined),
      upsertGuidelines: vi.fn(async () => undefined),
    };

    const result = await loadDashboardLifecycle({ userProvider, policyRepo });

    expect(policyRepo.getPolicyState).toHaveBeenCalledWith("u123");
    expect(result).toEqual({
      userId: "u123",
      lifecycleState: "NO_IPS",
      nextAction: {
        route: "/setup/ips",
        label: "Set up IPS",
      },
    });
  });

  it("throws deterministically when user context provider throws", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => {
        throw new Error("auth unavailable");
      }),
    };
    const policyRepo: PolicyStateRepository = {
      getPolicyState: vi.fn(async () => null),
      upsertIps: vi.fn(async () => undefined),
      upsertRiskProfile: vi.fn(async () => undefined),
      upsertGuidelines: vi.fn(async () => undefined),
    };

    await expect(loadDashboardLifecycle({ userProvider, policyRepo })).rejects.toThrow("auth unavailable");
    expect(policyRepo.getPolicyState).not.toHaveBeenCalled();
  });

  it("resolves GUIDELINES_COMPILED and decisions CTA when guidelines are compiled", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => ({
        userId: "u123",
        displayName: "User 123",
        authType: "LOCAL_FAKE" as const,
      })),
    };
    const policyRepo: PolicyStateRepository = {
      getPolicyState: vi.fn(async (userId: string) => ({
        userId,
        ips: {
          ipsVersion: "v1",
          ipsSha256: "abc123",
          status: "FROZEN" as const,
          createdAtIso: "2026-02-12T00:00:00.000Z",
          content: "ips",
        },
        riskProfile: {
          version: "rp1",
          status: "FROZEN" as const,
          createdAtIso: "2026-02-13T00:00:00.000Z",
          summary: "Moderate risk profile",
        },
        guidelines: {
          version: "g1",
          status: "COMPILED" as const,
          createdAtIso: "2026-02-14T00:00:00.000Z",
          payloadJson: "{\"policyVersion\":\"runtime-v1\"}",
        },
      })),
      upsertIps: vi.fn(async () => undefined),
      upsertRiskProfile: vi.fn(async () => undefined),
      upsertGuidelines: vi.fn(async () => undefined),
    };

    const result = await loadDashboardLifecycle({ userProvider, policyRepo });

    expect(result).toEqual({
      userId: "u123",
      lifecycleState: "GUIDELINES_COMPILED",
      nextAction: {
        route: "/decisions",
        label: "Go to Decisions",
      },
    });
  });
});
