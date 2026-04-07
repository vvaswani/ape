import { describe, expect, it } from "vitest";

import { createPostHandler } from "@/app/api/chat/route";

describe("POST /api/chat", () => {
  it("returns 410 and points callers at the canonical decision endpoint", async () => {
    const handler = createPostHandler();

    const response = await handler(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
      }),
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "GONE",
        message: "POST /api/chat no longer executes decisions. Use POST /api/decisions.",
        details: {
          replacement: "/api/decisions",
        },
      },
    });
  });
});
