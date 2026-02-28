import { describe, expect, it, vi } from "vitest";

import { createPostHandler } from "@/app/api/ips/route";
import { RepoError } from "@/lib/policy/errors";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { IpsInstance, IpsUpsertInput, PolicyState } from "@/lib/policy/types";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";
import type { User } from "@/lib/user/types";

type IpsDraftRequest = {
  content: string;
  ipsVersion?: string;
};

function createValidDraftRequest(overrides: Partial<IpsDraftRequest> = {}): IpsDraftRequest {
  return {
    content: "IPS draft content",
    ipsVersion: "v1",
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
    upsertIps: vi.fn<(userId: string, ips: IpsUpsertInput) => Promise<void>>(async () => undefined),
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
    const payload = createValidDraftRequest();

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
      status: "DRAFT",
      content: "IPS draft content",
      ipsVersion: "v1",
    });
  });

  it("accepts DTO without ipsVersion and leaves version derivation to repo", async () => {
    const userProvider = createUserProvider("u123");
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({ userProvider, policyRepo });
    const payload = createValidDraftRequest({ ipsVersion: undefined });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "DRAFT" });
    expect(policyRepo.upsertIps).toHaveBeenCalledWith("u123", {
      status: "DRAFT",
      content: "IPS draft content",
    });
  });

  it("rejects persistence-shaped client metadata fields", async () => {
    const userProvider = createUserProvider("u123");
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({ userProvider, policyRepo });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "IPS draft content",
          status: "DRAFT",
          createdAtIso: "2026-02-22T00:00:00.000Z",
          ipsSha256: "abc123",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body contains unsupported fields.",
        details: {
          unknownFields: ["status", "createdAtIso", "ipsSha256"],
        },
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 400 with unknown field details and does not call repo", async () => {
    const userProvider = createUserProvider("u123");
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({ userProvider, policyRepo });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createValidDraftRequest(),
          foo: "bar",
        }),
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
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 400 when content is missing", async () => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ipsVersion: "v1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Field 'content' must be a non-empty string.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 400 when content is empty or whitespace", async () => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "   ", ipsVersion: "v1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Field 'content' must be a non-empty string.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 400 when ipsVersion is invalid when provided", async () => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "IPS draft content", ipsVersion: "" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Field 'ipsVersion' must be a non-empty string when provided.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it.each(["null", "[]"])("returns 400 when request body is not an object (%s)", async (body) => {
    const policyRepo = createPolicyRepo();
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body must be an object.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("maps known repo invalid-userId errors to 400", async () => {
    const userProvider = createUserProvider("bad/user");
    const policyRepo = createPolicyRepo({
      upsertIps: vi.fn(async () => {
        throw new RepoError("INVALID_USER_ID", "Invalid userId format", { userId: "bad/user" });
      }),
    });
    const handler = createPostHandler({ userProvider, policyRepo });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createValidDraftRequest()),
      }),
    );

    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid user identifier.",
        details: {
          reason: "INVALID_USER_ID",
        },
      },
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

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createValidDraftRequest()),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "User context unavailable.",
      },
    });
    expect(policyRepo.upsertIps).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected repository errors without leaking details", async () => {
    const policyRepo = createPolicyRepo({
      upsertIps: vi.fn(async () => {
        throw new Error("disk exploded");
      }),
    });
    const handler = createPostHandler({
      userProvider: createUserProvider("u123"),
      policyRepo,
    });

    const response = await handler(
      new Request("http://localhost/api/ips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createValidDraftRequest()),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal error",
      },
    });
    expect(policyRepo.upsertIps).toHaveBeenCalledTimes(1);
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
