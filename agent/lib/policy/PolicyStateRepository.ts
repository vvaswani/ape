import type { GuidelinesInstance, IpsUpsertInput, PolicyState, RiskProfile } from "@/lib/policy/types";

export interface PolicyStateRepository {
  getPolicyState(userId: string): Promise<PolicyState | null>;
  upsertIps(userId: string, ips: IpsUpsertInput): Promise<void>;
  upsertRiskProfile(userId: string, risk: RiskProfile): Promise<void>;
  upsertGuidelines(userId: string, guidelines: GuidelinesInstance): Promise<void>;
}
