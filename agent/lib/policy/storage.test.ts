import { describe, expect, it, vi } from "vitest";

import { atomicWriteJsonWithFs } from "@/lib/policy/storage";

describe("policy storage helpers", () => {
  it("atomicWriteJsonWithFs cleans up temp file when rename fails", async () => {
    const writeFile = vi.fn(async () => undefined);
    const rename = vi.fn(async () => {
      throw new Error("rename failed");
    });
    const rm = vi.fn(async () => undefined);

    await expect(
      atomicWriteJsonWithFs("C:/tmp/user1.json", { userId: "user1" }, { writeFile, rename, rm })
    ).rejects.toThrow("rename failed");

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(rm).toHaveBeenCalledTimes(1);

    const firstRmArg = rm.mock.calls[0]?.[0];
    expect(typeof firstRmArg).toBe("string");
    expect((firstRmArg as string).includes(".json.tmp-")).toBe(true);
  });
});
