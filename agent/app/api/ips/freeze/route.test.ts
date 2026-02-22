import { describe, expect, it, vi } from "vitest";

import { createPostHandler } from "@/app/api/ips/freeze/route";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { IpsInstance, PolicyState } from "@/lib/policy/types";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";
import type { User } from "@/lib/user/types";

function createIps(overrides: Partial<IpsInstance> = {}): IpsInstance {
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

describe("POST /api/ips/freeze", () => {
  it("freezes a draft IPS for the current user", async () => {
    const draftIps = createIps({ status: "DRAFT" });
    const userProvider = createUserProvider("u123");
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => ({
        userId: "u123",
        ips: draftIps,
      })),
    });
    const handler = createPostHandler({ userProvider, policyRepo });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "FROZEN" });
    expect(userProvider.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(policyRepo.getPolicyState).toHaveBeenCalledTimes(1);
    expect(policyRepo.getPolicyState).toHaveBeenCalledWith("u123");
    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
    expect(policyRepo.upsertIps).toHaveBeenCalledWith("u123", {
      ...draftIps,
      status: "FROZEN",
    });
  });

  it("returns 409 when no IPS draft exists", async () => {
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => null),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONFLICT",
        message: "No IPS draft exists to freeze.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 200 idempotent success when IPS is already frozen", async () => {
    const frozenIps = createIps({ status: "FROZEN" });
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => ({
        userId: "u123",
        ips: frozenIps,
      })),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "FROZEN" });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
    expect(frozenIps.status).toBe("FROZEN");
  });

  it("treats empty JSON object body as no-args command input", async () => {
    const draftIps = createIps({ status: "DRAFT" });
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => ({
        userId: "u123",
        ips: draftIps,
      })),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips/freeze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "FROZEN" });
    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
    expect(policyRepo.upsertIps).toHaveBeenCalledWith("u123", {
      ...draftIps,
      status: "FROZEN",
    });
  });

  it("returns 401 when user context is unavailable", async () => {
    const userProvider: UserContextProvider = {
      getCurrentUser: vi.fn(() => {
        throw new Error("auth unavailable");
      }),
    };
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({ userProvider, policyRepo });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "User context unavailable.",
      },
    });
    expect(policyRepo.getPolicyState).not.toHaveBeenCalled();
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 400 when request body is malformed JSON", async () => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips/freeze", {
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
    expect(policyRepo.getPolicyState).not.toHaveBeenCalled();
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 400 when request body contains unsupported fields", async () => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips/freeze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ foo: "bar" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body contains unsupported fields.",
        details: {
          unknownFields: ["foo"],
        },
      },
    });
    expect(policyRepo.getPolicyState).not.toHaveBeenCalled();
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 409 when policy state exists but IPS is missing", async () => {
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => ({
        userId: "u123",
      })),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONFLICT",
        message: "No IPS draft exists to freeze.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("maps known repo invalid-userId errors to 400", async () => {
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => ({
        userId: "bad/user",
        ips: createIps({ status: "DRAFT" }),
      })),
      upsertIps: vi.fn(async () => {
        throw new Error("Invalid userId format: bad/user");
      }),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("bad/user"),
      policyRepo,
    });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(policyRepo.getPolicyState).toHaveBeenCalledTimes(1);
    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid user identifier.",
      },
    });
  });

  it("returns 500 for unexpected repository errors without leaking details", async () => {
    const policyRepo = createPolicyRepo({
      getPolicyState: vi.fn(async () => {
        throw new Error("disk exploded");
      }),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(new Request("http://localhost/api/ips/freeze", { method: "POST" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal error",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });
});
