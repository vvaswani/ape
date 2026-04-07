export type AuthType = "LOCAL_FAKE" | "SSO" | "OAUTH" | "DB";

export interface User {
  userId: string;
  displayName: string;
  authType: AuthType;
}
