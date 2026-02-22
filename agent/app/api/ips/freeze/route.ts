import { NextResponse } from "next/server";

import { JsonPolicyStateRepository } from "@/lib/policy/JsonPolicyStateRepository";
import type { PolicyStateRepository } from "@/lib/policy/PolicyStateRepository";
import type { IpsInstance } from "@/lib/policy/types";
import { LocalUserContextProvider } from "@/lib/user/LocalUserContextProvider";
import type { UserContextProvider } from "@/lib/user/UserContextProvider";

type IpsFreezeRouteDeps = {
  userProvider?: UserContextProvider;
  policyRepo?: PolicyStateRepository;
};

type ApiErrorBody = {
  error: {
    code: "BAD_REQUEST" | "UNAUTHORIZED" | "CONFLICT" | "INTERNAL";
    message: string;
    details?: unknown;
  };
};

type EmptyBodyValidationResult =
  | { ok: true }
  | { ok: false; message: string; details?: unknown };

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

async function validateCommandBody(req: Request): Promise<EmptyBodyValidationResult> {
  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return { ok: false, message: "Request body must be valid JSON." };
  }

  if (rawText.trim() === "") {
    return { ok: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, message: "Request body must be valid JSON." };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, message: "Request body must be an object." };
  }

  const unknownFields = Object.keys(parsed);
  if (unknownFields.length > 0) {
    return {
      ok: false,
      message: "Request body contains unsupported fields.",
      details: { unknownFields },
    };
  }

  return { ok: true };
}

function mapUnexpectedError(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof Error && err.message.includes("Invalid userId format")) {
    return errorResponse(400, "BAD_REQUEST", "Invalid user identifier.");
  }

  return errorResponse(500, "INTERNAL", "Internal error");
}

function freezeIps(ips: IpsInstance): IpsInstance {
  return {
    ...ips,
    status: "FROZEN",
  };
}

export function createPostHandler(deps: IpsFreezeRouteDeps = {}) {
  return async function POST(req: Request) {
    const bodyValidation = await validateCommandBody(req);
    if (!bodyValidation.ok) {
      return errorResponse(400, "BAD_REQUEST", bodyValidation.message, bodyValidation.details);
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
      const policyState = await policyRepo.getPolicyState(userId);
      const currentIps = policyState?.ips;

      if (!currentIps) {
        return errorResponse(409, "CONFLICT", "No IPS draft exists to freeze.");
      }

      if (currentIps.status === "FROZEN") {
        return NextResponse.json({ status: "FROZEN" });
      }

      await policyRepo.upsertIps(userId, freezeIps(currentIps));
      return NextResponse.json({ status: "FROZEN" });
    } catch (err) {
      return mapUnexpectedError(err);
    }
  };
}

export const POST = createPostHandler();
