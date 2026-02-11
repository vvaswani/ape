import type { User } from "@/lib/user/types";

export interface UserContextProvider {
  getCurrentUser(): User;
}
