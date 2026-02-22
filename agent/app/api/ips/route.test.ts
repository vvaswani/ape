import { describe, expect, it, vi } from "vitest";

import { createPostHandler } from "@/app/api/ips/route";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { IpsInstance, PolicyState } from "@/lib/policy/types";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";
import type { User } from "@/lib/user/types";

function createValidDraft(overrides: Partial<IpsInstance> = {}): IpsInstance {
  return {
    ipsVersion: "v1",
    ipsSha256: "abc123",
    status: "DRAFT",
    createdAtIso: "2026-02-22T00:00:00.000Z",
    content: "IPS draft content",
    ...overrides,
  };
}

function createUserProvider(userId = "u123"): UserContextProvider {
  const getCurrentUser = vi.fn<() => User>(() => ({
    userId,
    displayName: "User 123",
    authType: "LOCAL_FAKE",
  }));

  return { getCurrentUser };
}

function createPolicyRepo(overrides: Partial<PolicyStateRepository> = {}): PolicyStateRepository {
  return {
    getPolicyState: vi.fn<(userId: string) => Promise<PolicyState | null>>(async () => null),
    upsertIps: vi.fn<(userId: string, ips: IpsInstance) => Promise<void>>(async () => undefined),
    upsertRiskProfile: vi.fn(async () => undefined),
    upsertGuidelines: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("POST /api/ips", () => {
  it("saves a valid IPS draft for the current user", async () => {
    const userProvider = createUserProvider("u123");
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({ userProvider, policyRepo });
    const payload = createValidDraft();

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "DRAFT" });
    expect(userProvider.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
    expect(policyRepo.upsertIps).toHaveBeenCalledWith("u123", {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-22T00:00:00.000Z",
      content: "IPS draft content",
    });
  });

  it("returns 400 and does not call repo when validation fails", async () => {
    const userProvider = createUserProvider("u123");
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({ userProvider, policyRepo });
    const payload = createValidDraft({ status: "FROZEN" });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Field 'status' must be 'DRAFT' for this endpoint.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("maps known repo invalid-userId errors to 400", async () => {
    const userProvider = createUserProvider("bad/user");
    const policyRepo = createPolicyRepo({
      upsertIps: vi.fn(async () => {
        throw new Error("Invalid userId format: bad/user");
      }),
    });
    const handler = createPostHandler({ userProvider, policyRepo });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createValidDraft()),
      }),
    );

    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid user identifier.",
      },
    });
  });

  it("returns 400 when request body is malformed JSON", async () => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });
});
