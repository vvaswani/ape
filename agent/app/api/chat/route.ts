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

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;
    const result = await runDecision(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Decision API error:", err);
    return NextResponse.json({ error: "failed to generate" }, { status: 500 });
  }
}

