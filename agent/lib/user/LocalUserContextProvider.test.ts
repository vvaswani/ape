import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCAL_USER, LocalUserContextProvider } from "@/lib/user/LocalUserContextProvider";
import type { User } from "@/lib/user/types";

const provider = new LocalUserContextProvider();

describe("LocalUserContextProvider", () => {
  let originalDefaultUserId: string | undefined;
  let originalDefaultUserName: string | undefined;

  beforeEach(() => {
    originalDefaultUserId = process.env.DEFAULT_USER_ID;
    originalDefaultUserName = process.env.DEFAULT_USER_NAME;
  });

  afterEach(() => {
    if (originalDefaultUserId === undefined) {
      delete process.env.DEFAULT_USER_ID;
    } else {
      process.env.DEFAULT_USER_ID = originalDefaultUserId;
    }

    if (originalDefaultUserName === undefined) {
      delete process.env.DEFAULT_USER_NAME;
    } else {
      process.env.DEFAULT_USER_NAME = originalDefaultUserName;
    }
  });

  it("getCurrentUser returns consistent results", () => {
    process.env.DEFAULT_USER_ID = "consistent-user";
    process.env.DEFAULT_USER_NAME = "Consistent User";

    const first = provider.getCurrentUser();
    const second = provider.getCurrentUser();

    expect(first).toEqual(second);
  });

  it("respects DEFAULT_USER_ID override", () => {
    process.env.DEFAULT_USER_ID = "user-123";
    delete process.env.DEFAULT_USER_NAME;

    expect(provider.getCurrentUser()).toEqual({
      userId: "user-123",
      displayName: DEFAULT_LOCAL_USER.displayName,
      authType: DEFAULT_LOCAL_USER.authType,
    });
  });

  it("respects DEFAULT_USER_NAME override", () => {
    delete process.env.DEFAULT_USER_ID;
    process.env.DEFAULT_USER_NAME = "Jane Doe";

    expect(provider.getCurrentUser()).toEqual({
      userId: DEFAULT_LOCAL_USER.userId,
      displayName: "Jane Doe",
      authType: DEFAULT_LOCAL_USER.authType,
    });
  });

  it("respects both DEFAULT_USER_ID and DEFAULT_USER_NAME overrides", () => {
    process.env.DEFAULT_USER_ID = "custom-user";
    process.env.DEFAULT_USER_NAME = "Custom Name";

    expect(provider.getCurrentUser()).toEqual({
      userId: "custom-user",
      displayName: "Custom Name",
      authType: DEFAULT_LOCAL_USER.authType,
    });
  });

  it("falls back to defaults when env vars are unset", () => {
    delete process.env.DEFAULT_USER_ID;
    delete process.env.DEFAULT_USER_NAME;

    expect(provider.getCurrentUser()).toEqual(DEFAULT_LOCAL_USER);
  });

  it("falls back to defaults when env vars are blank", () => {
    process.env.DEFAULT_USER_ID = "   ";
    process.env.DEFAULT_USER_NAME = "";

    expect(provider.getCurrentUser()).toEqual(DEFAULT_LOCAL_USER);
  });

  it("returns authType LOCAL_FAKE", () => {
    const user = provider.getCurrentUser();
    expect(user.authType).toBe("LOCAL_FAKE");
  });

  it("returns expected User shape", () => {
    const user = provider.getCurrentUser();
    const keys = Object.keys(user).sort();

    expect(keys).toEqual(["authType", "displayName", "userId"]);
    expect(typeof user.userId).toBe("string");
    expect(typeof user.displayName).toBe("string");
    expect(typeof user.authType).toBe("string");

    const typedUser: User = user;
    expect(typedUser).toBeDefined();
  });
});
