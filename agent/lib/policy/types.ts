export interface IpsInstance {
  ipsVersion: string;
  ipsSha256: string;
  status: "DRAFT" | "FROZEN";
  createdAtIso: string;
  content: string;
}

export interface RiskProfile {
  version: string;
  status: "MISSING" | "FROZEN";
  createdAtIso: string;
  summary: string;
}

export interface GuidelinesInstance {
  version: string;
  status: "MISSING" | "DERIVED" | "COMPILED";
  createdAtIso: string;
  payloadJson: string;
}

export interface PolicyState {
  userId: string;
  ips?: IpsInstance;
  riskProfile?: RiskProfile;
  guidelines?: GuidelinesInstance;
}
