import type { UserContextProvider } from "@/lib/user/UserContextProvider";
import type { User } from "@/lib/user/types";

export const DEFAULT_LOCAL_USER: User = {
  userId: "local",
  displayName: "Local User",
  authType: "LOCAL_FAKE",
};

function readEnvOrDefault(name: "DEFAULT_USER_ID" | "DEFAULT_USER_NAME", fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

export class LocalUserContextProvider implements UserContextProvider {
  getCurrentUser(): User {
    return {
      userId: readEnvOrDefault("DEFAULT_USER_ID", DEFAULT_LOCAL_USER.userId),
      displayName: readEnvOrDefault("DEFAULT_USER_NAME", DEFAULT_LOCAL_USER.displayName),
      authType: DEFAULT_LOCAL_USER.authType,
    };
  }
}
