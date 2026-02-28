import { NextResponse } from "next/server";

import { JsonPolicyStateRepository } from "@/lib/policy/JsonPolicyStateRepository";
import { isRepoError } from "@/lib/policy/errors";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { IpsDraftUpsertInput } from "@/lib/policy/types";
import { LocalUserContextProvider } from "@/lib/user/LocalUserContextProvider";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";

type IpsRouteDeps = {
  userProvider?: UserContextProvider;
  policyRepo?: PolicyStateRepository;
};

type ApiErrorBody = {
  error: {
    code: "BAD_REQUEST" | "UNAUTHORIZED" | "INTERNAL";
    message: string;
    details?: unknown;
  };
};

type ValidationResult =
  | { ok: true; value: IpsDraftUpsertInput }
  | { ok: false; message: string; details?: unknown };

const ALLOWED_KEYS = ["ipsVersion", "content"] as const;

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

function validateIpsDraftPayload(body: unknown): ValidationResult {
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

  const ipsVersion = body.ipsVersion;
  if (ipsVersion !== undefined && (typeof ipsVersion !== "string" || ipsVersion.trim() === "")) {
    return { ok: false, message: "Field 'ipsVersion' must be a non-empty string when provided." };
  }

  const content = body.content;
  if (typeof content !== "string" || content.trim() === "") {
    return { ok: false, message: "Field 'content' must be a non-empty string." };
  }

  return {
    ok: true,
    value: {
      status: "DRAFT",
      content,
      ...(ipsVersion === undefined ? {} : { ipsVersion }),
    },
  };
}

function mapUnexpectedError(err: unknown): NextResponse<ApiErrorBody> {
  if (isRepoError(err)) {
    if (err.code === "INVALID_USER_ID") {
      return errorResponse(400, "BAD_REQUEST", "Invalid user identifier.", { reason: err.code });
    }
  }

  return errorResponse(500, "INTERNAL", "Internal error");
}

export function createPostHandler(deps: IpsRouteDeps = {}) {
  return async function POST(req: Request) {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(400, "BAD_REQUEST", "Request body must be valid JSON.");
    }

    const validated = validateIpsDraftPayload(rawBody);
    if (!validated.ok) {
      return errorResponse(400, "BAD_REQUEST", validated.message, validated.details);
    }

    const userProvider = deps.userProvider ?? new LocalUserContextProvider();
    const policyRepo = deps.policyRepo ?? new JsonPolicyStateRepository();

    let userId: string | undefined;
    try {
      userId = userProvider.getCurrentUser()?.userId;
    } catch {
      return errorResponse(401, "UNAUTHORIZED", "User context unavailable.");
    }

    if (typeof userId !== "string" || userId.trim() === "") {
      return errorResponse(401, "UNAUTHORIZED", "User context unavailable.");
    }

    try {
      await policyRepo.upsertIps(userId, validated.value);
      return NextResponse.json({ status: validated.value.status });
    } catch (err) {
      return mapUnexpectedError(err);
    }
  };
}

export const POST = createPostHandler();
