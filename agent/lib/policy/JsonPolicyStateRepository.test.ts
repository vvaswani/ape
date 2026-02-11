import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonPolicyStateRepository } from "@/lib/policy/JsonPolicyStateRepository";
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

    await expect(repo.upsertIps("../bad-user", ips)).rejects.toThrow("Invalid userId format");
    await expect(repo.getPolicyState("../bad-user")).rejects.toThrow("Invalid userId format");
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

    await expect(repo.upsertIps("bad/user", ips)).rejects.toThrow("Invalid userId format");
  });

  it("unsafe userId throws for spaces", async () => {
    const repo = new JsonPolicyStateRepository();
    const risk: RiskProfile = {
      version: "v1",
      status: "FROZEN",
      createdAtIso: "2026-02-11T00:05:00.000Z",
      summary: "Risk summary",
    };

    await expect(repo.upsertRiskProfile("bad user", risk)).rejects.toThrow("Invalid userId format");
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
