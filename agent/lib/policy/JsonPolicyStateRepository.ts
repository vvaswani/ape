import crypto from "node:crypto";
import path from "node:path";

import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type {
  GuidelinesInstance,
  IpsDraftUpsertInput,
  IpsInstance,
  IpsUpsertInput,
  PolicyState,
  RiskProfile,
} from "@/lib/policy/types";
import { atomicWriteJson, ensureDirExists, readJsonIfExists, safeUserIdToFilename } from "@/lib/policy/storage";

const DEFAULT_IPS_VERSION = "v1";

function resolveStorageRoot(): string {
  const configured = process.env.POLICY_STATE_DIR?.trim();
  if (configured) {
    return configured;
  }

  return path.resolve(process.cwd(), "var", "policy_state");
}

export class JsonPolicyStateRepository implements PolicyStateRepository {
  private readonly rootDir: string;

  constructor(rootDir = resolveStorageRoot()) {
    this.rootDir = rootDir;
  }

  async getPolicyState(userId: string): Promise<PolicyState | null> {
    const filePath = this.filePathForUser(userId);
    return await readJsonIfExists<PolicyState>(filePath);
  }

  async upsertIps(userId: string, ips: IpsUpsertInput): Promise<void> {
    const filePath = this.filePathForUser(userId);
    await ensureDirExists(this.rootDir);

    const existing = await readJsonIfExists<PolicyState>(filePath);
    const normalizedIps = isPersistedIpsInstance(ips) ? ips : this.normalizeDraftIpsInput(ips, existing?.ips);
    const nextState: PolicyState = {
      ...(existing ?? { userId }),
      ips: normalizedIps,
      userId,
    };

    await atomicWriteJson(filePath, nextState);
  }

  async upsertRiskProfile(userId: string, risk: RiskProfile): Promise<void> {
    await this.upsert(userId, { riskProfile: risk });
  }

  async upsertGuidelines(userId: string, guidelines: GuidelinesInstance): Promise<void> {
    await this.upsert(userId, { guidelines });
  }

  private async upsert(userId: string, partial: Partial<PolicyState>): Promise<void> {
    const filePath = this.filePathForUser(userId);
    await ensureDirExists(this.rootDir);

    const existing = await readJsonIfExists<PolicyState>(filePath);
    const nextState: PolicyState = {
      ...(existing ?? { userId }),
      ...partial,
      userId,
    };

    await atomicWriteJson(filePath, nextState);
  }

  private filePathForUser(userId: string): string {
    const fileName = safeUserIdToFilename(userId);
    return path.join(this.rootDir, fileName);
  }

  private normalizeDraftIpsInput(input: IpsDraftUpsertInput, existingIps?: IpsInstance): IpsInstance {
    const ipsVersion = input.ipsVersion ?? existingIps?.ipsVersion ?? DEFAULT_IPS_VERSION;
    // `createdAtIso` is the draft creation timestamp, so draft overwrites preserve it.
    // A new draft created after a frozen IPS gets a fresh creation timestamp.
    const createdAtIso =
      existingIps?.status === "DRAFT" && typeof existingIps.createdAtIso === "string" && existingIps.createdAtIso.trim() !== ""
        ? existingIps.createdAtIso
        : new Date().toISOString();

    return {
      ipsVersion,
      ipsSha256: crypto.createHash("sha256").update(input.content, "utf-8").digest("hex"),
      status: "DRAFT",
      createdAtIso,
      content: input.content,
    };
  }
}

function isPersistedIpsInstance(input: IpsUpsertInput): input is IpsInstance {
  return (
    typeof input.ipsVersion === "string" &&
    typeof input.ipsSha256 === "string" &&
    typeof input.createdAtIso === "string" &&
    (input.status === "DRAFT" || input.status === "FROZEN") &&
    typeof input.content === "string"
  );
}
