import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonPolicyStateRepository } from "@/lib/policy/JsonPolicyStateRepository";
import { RepoError } from "@/lib/policy/errors";
import type { GuidelinesInstance, IpsInstance, RiskProfile } from "@/lib/policy/types";

describe("JsonPolicyStateRepository", () => {
  let tmpDir: string;
  let originalPolicyStateDir: string | undefined;

  beforeEach(async () => {
    originalPolicyStateDir = process.env.POLICY_STATE_DIR;
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ape-policy-state-"));
    process.env.POLICY_STATE_DIR = tmpDir;
  });

  afterEach(async () => {
    if (originalPolicyStateDir === undefined) {
      delete process.env.POLICY_STATE_DIR;
    } else {
      process.env.POLICY_STATE_DIR = originalPolicyStateDir;
    }

    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no file exists", async () => {
    const repo = new JsonPolicyStateRepository();
    await expect(repo.getPolicyState("user1")).resolves.toBeNull();
  });

  it("upsertIps then getPolicyState returns ips", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };

    await repo.upsertIps("user1", ips);

    await expect(repo.getPolicyState("user1")).resolves.toEqual({
      userId: "user1",
      ips,
    });
  });

  it("sets createdAtIso as draft creation time on first DTO draft save and derives metadata", async () => {
    const repo = new JsonPolicyStateRepository();
    const content = "IPS content";

    await repo.upsertIps("user1", {
      status: "DRAFT",
      content,
    });

    const state = await repo.getPolicyState("user1");
    expect(state?.userId).toBe("user1");
    expect(state?.ips).toMatchObject({
      ipsVersion: "v1",
      status: "DRAFT",
      content,
      ipsSha256: crypto.createHash("sha256").update(content, "utf-8").digest("hex"),
    });
    expect(typeof state?.ips?.createdAtIso).toBe("string");
    expect(state?.ips?.createdAtIso?.trim()).not.toBe("");
    expect(Number.isNaN(Date.parse(state?.ips?.createdAtIso ?? ""))).toBe(false);
  });

  it("preserves createdAtIso on DTO draft overwrite and keeps existing ipsVersion when request omits it", async () => {
    const repo = new JsonPolicyStateRepository();

    await repo.upsertIps("user1", {
      status: "DRAFT",
      content: "First draft",
      ipsVersion: "v9",
    });
    const firstState = await repo.getPolicyState("user1");
    const firstCreatedAtIso = firstState?.ips?.createdAtIso;

    await repo.upsertIps("user1", {
      status: "DRAFT",
      content: "Second draft",
    });
    const secondState = await repo.getPolicyState("user1");

    expect(firstCreatedAtIso).toBeDefined();
    expect(secondState?.ips).toMatchObject({
      ipsVersion: "v9",
      status: "DRAFT",
      content: "Second draft",
      createdAtIso: firstCreatedAtIso,
      ipsSha256: crypto.createHash("sha256").update("Second draft", "utf-8").digest("hex"),
    });
  });

  it("creates a new draft creation timestamp when replacing a frozen IPS with a DTO draft", async () => {
    const repo = new JsonPolicyStateRepository();
    const frozenIps: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "FROZEN",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "Frozen content",
    };

    await repo.upsertIps("user1", frozenIps);
    await repo.upsertIps("user1", {
      status: "DRAFT",
      content: "New draft after freeze",
    });

    const state = await repo.getPolicyState("user1");
    expect(state?.ips?.status).toBe("DRAFT");
    expect(state?.ips?.ipsVersion).toBe("v1");
    expect(state?.ips?.createdAtIso).not.toBe(frozenIps.createdAtIso);
  });

  it("upsertRiskProfile merges without deleting ips", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };
    const risk: RiskProfile = {
      version: "v1",
      status: "FROZEN",
      createdAtIso: "2026-02-11T00:05:00.000Z",
      summary: "Risk summary",
    };

    await repo.upsertIps("user1", ips);
    await repo.upsertRiskProfile("user1", risk);

    await expect(repo.getPolicyState("user1")).resolves.toEqual({
      userId: "user1",
      ips,
      riskProfile: risk,
    });
  });

  it("upsertGuidelines merges without deleting other fields", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "FROZEN",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };
    const risk: RiskProfile = {
      version: "v1",
      status: "FROZEN",
      createdAtIso: "2026-02-11T00:05:00.000Z",
      summary: "Risk summary",
    };
    const guidelines: GuidelinesInstance = {
      version: "v1",
      status: "DERIVED",
      createdAtIso: "2026-02-11T00:10:00.000Z",
      payloadJson: "{\"rule\":1}",
    };

    await repo.upsertIps("user1", ips);
    await repo.upsertRiskProfile("user1", risk);
    await repo.upsertGuidelines("user1", guidelines);

    await expect(repo.getPolicyState("user1")).resolves.toEqual({
      userId: "user1",
      ips,
      riskProfile: risk,
      guidelines,
    });
  });

  it("unsafe userId throws for traversal", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };

    await expect(repo.upsertIps("../bad-user", ips)).rejects.toMatchObject({
      name: "RepoError",
      code: "INVALID_USER_ID",
      message: "Invalid userId format",
    });
    await expect(repo.getPolicyState("../bad-user")).rejects.toMatchObject({
      name: "RepoError",
      code: "INVALID_USER_ID",
      message: "Invalid userId format",
    });
  });

  it("unsafe userId throws for slash", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };

    await expect(repo.upsertIps("bad/user", ips)).rejects.toMatchObject({
      name: "RepoError",
      code: "INVALID_USER_ID",
      message: "Invalid userId format",
    });
  });

  it("unsafe userId throws for spaces", async () => {
    const repo = new JsonPolicyStateRepository();
    const risk: RiskProfile = {
      version: "v1",
      status: "FROZEN",
      createdAtIso: "2026-02-11T00:05:00.000Z",
      summary: "Risk summary",
    };

    await expect(repo.upsertRiskProfile("bad user", risk)).rejects.toMatchObject({
      name: "RepoError",
      code: "INVALID_USER_ID",
      message: "Invalid userId format",
    });
  });

  it("invalid userId throws RepoError", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };

    await expect(repo.upsertIps("bad/user", ips)).rejects.toBeInstanceOf(RepoError);
  });

  it("deterministic write formatting creates parseable json", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };

    await repo.upsertIps("user1", ips);

    const filePath = path.join(tmpDir, "user1.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { userId: string; ips: IpsInstance };

    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("\n  ");
    expect(parsed).toEqual({
      userId: "user1",
      ips,
    });
  });

  it("deterministic formatting is byte-identical across repeated writes", async () => {
    const repo = new JsonPolicyStateRepository();
    const ips: IpsInstance = {
      ipsVersion: "v1",
      ipsSha256: "abc123",
      status: "DRAFT",
      createdAtIso: "2026-02-11T00:00:00.000Z",
      content: "IPS content",
    };

    await repo.upsertIps("user1", ips);
    const filePath = path.join(tmpDir, "user1.json");
    const first = await readFile(filePath, "utf8");

    await repo.upsertIps("user1", ips);
    const second = await readFile(filePath, "utf8");

    expect(second).toBe(first);
  });

});
