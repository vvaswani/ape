/**
 * @file route.ts
 * @description
 * HTTP API route for chat requests.
 *
 * This route must remain thin:
 * - Parse JSON
 * - Call service
 * - Return JSON
 */

import { NextResponse } from "next/server";
import type { ChatRequest } from "@/lib/domain/chat";
import { runChat } from "@/lib/services/chatService";

export const runtime = "nodejs";

/**
 * POST /api/chat
 *
 * @param req - Next.js Request
 * @returns JSON response containing assistant content.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;
    const result = await runChat(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "failed to generate" }, { status: 500 });
  }
}
