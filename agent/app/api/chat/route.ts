import { NextResponse } from "next/server";

type ApiErrorBody = {
  error: {
    code: "GONE";
    message: string;
    details: {
      replacement: "/api/decisions";
    };
  };
};

export function createPostHandler() {
  return async function POST(req: Request) {
    void req;

    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "GONE",
          message: "POST /api/chat no longer executes decisions. Use POST /api/decisions.",
          details: {
            replacement: "/api/decisions",
          },
        },
      },
      { status: 410 },
    );
  };
}

export const POST = createPostHandler();

