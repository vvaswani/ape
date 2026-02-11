import path from "node:path";

import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { GuidelinesInstance, IpsInstance, PolicyState, RiskProfile } from "@/lib/policy/types";
import { atomicWriteJson, ensureDirExists, readJsonIfExists, safeUserIdToFilename } from "@/lib/policy/storage";

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

  async upsertIps(userId: string, ips: IpsInstance): Promise<void> {
    await this.upsert(userId, { ips });
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
}
