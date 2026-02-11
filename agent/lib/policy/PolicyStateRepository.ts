import type { GuidelinesInstance, IpsInstance, PolicyState, RiskProfile } from "@/lib/policy/types";

export interface PolicyStateRepository {
  getPolicyState(userId: string): Promise<PolicyState | null>;
  upsertIps(userId: string, ips: IpsInstance): Promise<void>;
  upsertRiskProfile(userId: string, risk: RiskProfile): Promise<void>;
  upsertGuidelines(userId: string, guidelines: GuidelinesInstance): Promise<void>;
}
