import { NextResponse } from "next/server";

import type { DecisionRequest, DecisionResponse } from "@/lib/domain/decision";
import { runDecision } from "@/lib/services/decisionService";

type DecisionsRouteDeps = {
  decisionRunner?: (request: DecisionRequest) => Promise<DecisionResponse>;
};

type ApiErrorBody = {
  error: {
    code: "BAD_REQUEST" | "INTERNAL";
    message: string;
    details?: unknown;
  };
};

const ALLOWED_KEYS = ["request_note", "portfolio_state", "risk_inputs", "authority"] as const;

function errorResponse(
  status: number,
  code: ApiErrorBody["error"]["code"],
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDecisionPayload(body: unknown): { ok: true; value: DecisionRequest } | { ok: false; message: string; details?: unknown } {
  if (!isPlainObject(body)) {
    return { ok: false, message: "Request body must be an object." };
  }

  const keys = Object.keys(body);
  const unknownKeys = keys.filter((key) => !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number]));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: "Request body contains unsupported fields.",
      details: { unknownFields: unknownKeys },
    };
  }

  if (body.request_note !== undefined && typeof body.request_note !== "string") {
    return { ok: false, message: "Field 'request_note' must be a string when provided." };
  }

  return { ok: true, value: body as DecisionRequest };
}

export function createPostHandler(deps: DecisionsRouteDeps = {}) {
  return async function POST(req: Request) {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(400, "BAD_REQUEST", "Request body must be valid JSON.");
    }

    const validated = validateDecisionPayload(rawBody);
    if (!validated.ok) {
      return errorResponse(400, "BAD_REQUEST", validated.message, validated.details);
    }

    const decisionRunner = deps.decisionRunner ?? runDecision;

    try {
      return NextResponse.json(await decisionRunner(validated.value));
    } catch {
      return errorResponse(500, "INTERNAL", "Internal error");
    }
  };
}

export const POST = createPostHandler();
