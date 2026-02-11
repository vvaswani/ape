import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCAL_USER, LocalUserContextProvider } from "@/lib/user/LocalUserContextProvider";

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

  it("returns default local user when env vars are not set", () => {
    delete process.env.DEFAULT_USER_ID;
    delete process.env.DEFAULT_USER_NAME;

    expect(provider.getCurrentUser()).toEqual(DEFAULT_LOCAL_USER);
  });

  it("overrides user id and display name from env vars", () => {
    process.env.DEFAULT_USER_ID = "custom-user";
    process.env.DEFAULT_USER_NAME = "Custom Name";

    expect(provider.getCurrentUser()).toEqual({
      userId: "custom-user",
      displayName: "Custom Name",
      authType: DEFAULT_LOCAL_USER.authType,
    });
  });

  it("falls back to defaults when env vars are blank", () => {
    process.env.DEFAULT_USER_ID = "   ";
    process.env.DEFAULT_USER_NAME = "";

    expect(provider.getCurrentUser()).toEqual(DEFAULT_LOCAL_USER);
  });
});
