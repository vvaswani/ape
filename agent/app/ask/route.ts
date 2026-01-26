/**
 * @file app/ask/route.ts
 *
 * ## Purpose
 * Provides a single API endpoint to send a prompt (or chat history) to the APE agent
 * and return the model-generated response.
 *
 * This endpoint is intentionally dev-oriented:
 * - minimal but strict validation
 * - does not log secrets
 * - provides a requestId for tracing failures
 *
 * ## Endpoint
 * - POST /ask
 *
 * ## Request shapes
 * - { input: string }
 * - { messages: Array<{ role: "system" | "user" | "assistant", content: string }> }
 *
 * If both are provided, `messages` takes precedence.
 *
 * ## Response shapes
 * - 200: { ok: true, requestId: string, response: string }
 * - 4xx/5xx: { ok: false, requestId: string, error: string, details?: string }
 */

import { NextResponse } from "next/server";
import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";

export const runtime = "nodejs";

/**
 * Permitted chat roles for request payloads.
 */
type ChatRole = "system" | "user" | "assistant";

/**
 * Chat message format accepted by this endpoint.
 */
type ChatMessage = {
  role: ChatRole;
  content: string;
};

type AskResponseOk = {
  ok: true;
  requestId: string;
  response: string;
};

type AskResponseErr = {
  ok: false;
  requestId: string;
  error: string;
  details?: string;
};

/**
 * Normalizes incoming text:
 * - trims whitespace
 * - converts empty/invalid values to null
 *
 * @param raw unknown value (typically from parsed JSON)
 */
function normalizeText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Validates and normalizes the role string.
 *
 * @param raw unknown role value
 */
function normalizeRole(raw: unknown): ChatRole | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "system" || v === "user" || v === "assistant") return v as ChatRole;
  return null;
}

/**
 * Validates and normalizes an array of chat messages.
 *
 * Guardrails:
 * - must be an array of objects with valid role + non-empty content
 * - hard cap on number of messages (dev safety)
 *
 * @param raw unknown value (typically from parsed JSON)
 * @param maxMessages maximum allowed messages in one request
 */
function normalizeMessages(raw: unknown, maxMessages = 40): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;

  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;

    const role = normalizeRole((item as any).role);
    const content = normalizeText((item as any).content);

    if (!role || !content) return null;

    out.push({ role, content });

    if (out.length > maxMessages) return null;
  }

  return out;
}

const apeAgent = new Agent({
  id: "ape-agent",
  name: "ape-agent",
  instructions: `
    You are a knowledgeable portfolio advisory assistant.
    Users will send short questions or instructions about portfolio allocation,
    rebalancing, risk management, or investing strategies.
    Provide concise, helpful, and actionable advice.
  `,
  model: "google/gemini-2.5-flash",
});

const mastra = new Mastra({
  agents: {
    apeAgent,
  },
});

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      const payload: AskResponseErr = {
        ok: false,
        requestId,
        error: "Invalid JSON body",
      };
      return NextResponse.json(payload, { status: 400 });
    }

    const messages =
      body?.messages !== undefined ? normalizeMessages(body.messages) : null;

    const input =
      body?.input !== undefined ? normalizeText(body.input) : null;

    if (body?.messages !== undefined && !messages) {
      const payload: AskResponseErr = {
        ok: false,
        requestId,
        error: "Invalid messages",
        details:
          'Provide messages: [{ role: "system"|"user"|"assistant", content: non-empty string }]',
      };
      return NextResponse.json(payload, { status: 400 });
    }

    if (body?.messages === undefined && !input) {
      const payload: AskResponseErr = {
        ok: false,
        requestId,
        error: "Missing input",
        details: "Provide either { input: string } or { messages: ChatMessage[] }",
      };
      return NextResponse.json(payload, { status: 400 });
    }

    const finalMessages: ChatMessage[] = messages ?? [
      { role: "user", content: input as string },
    ];

    // Minimal debug logging (do not log content)
    console.log(`[ask:${requestId}] received`, {
      turns: finalMessages.length,
      lastRole: finalMessages[finalMessages.length - 1]?.role,
    });

    const agent = mastra.getAgent("apeAgent");
    const result = await agent.generate(finalMessages);

    const responseText = typeof result?.text === "string" ? result.text : "";

    console.log(`[ask:${requestId}] success`, { chars: responseText.length });

    const payload: AskResponseOk = {
      ok: true,
      requestId,
      response: responseText,
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error(`[ask:${requestId}] error`, err?.message ?? err);

    const payload: AskResponseErr = {
      ok: false,
      requestId,
      error: "Failed to generate",
      details: err?.message ?? String(err),
    };

    return NextResponse.json(payload, { status: 500 });
  }
}
