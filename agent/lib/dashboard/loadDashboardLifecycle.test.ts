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
      authType: "LOCAL_FAKE",
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
    });
  });

  it("resolves IPS_DRAFT when IPS is draft", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => ({
        userId: "u123",
        displayName: "User 123",
        authType: "LOCAL_FAKE",
      })),
    };
    const policyRepo: PolicyStateRepository = {
      getPolicyState: vi.fn(async (userId: string) => ({
        userId,
        ips: {
          ipsVersion: "v1",
          ipsSha256: "abc123",
          status: "DRAFT",
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
    expect(result.lifecycleState).toBe("IPS_DRAFT");
  });
});
