/**
 * @file route.ts
 * @description
 * HTTP API route for Decision requests.
 *
 * This route must remain thin:
 * - Parse JSON
 * - Call service
 * - Return JSON
 */

import { NextResponse } from "next/server";
import type { ChatRequest } from "@/lib/domain/chat";
import { runDecision } from "@/lib/services/decisionService";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;

    // 🔒 Enforce correct request shape
    if (!Array.isArray(body.messages)) {
      throw new Error("Invalid request: messages must be an array");
    }

    const result = await runDecision({
      messages: body.messages,
      portfolio_state: body.portfolio_state,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Decision API error:", err);
    return NextResponse.json(
      { error: "failed to generate decision" },
      { status: 500 }
    );
  }
}

