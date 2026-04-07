import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import ChatRoutePage from "@/app/chat/page";

describe("/chat page", () => {
  it("redirects to /decisions", () => {
    expect(() => ChatRoutePage()).toThrow("redirect:/decisions");
    expect(mocks.redirect).toHaveBeenCalledWith("/decisions");
  });
});
