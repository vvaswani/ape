/**
 * @file app/health/route.ts
 *
 * ## Purpose
 * Lightweight health probe for local development.
 *
 * This endpoint is intentionally "dumb":
 * - it does not call the LLM
 * - it does not require any API keys
 * - it confirms the Next.js server is up and routes are working
 *
 * ## Endpoint
 * - GET /health
 */

type HealthResponse = {
  ok: true;
  service: "ape";
  ts: string;
};

export async function GET() {
  const payload: HealthResponse = {
    ok: true,
    service: "ape",
    ts: new Date().toISOString(),
  };

  return Response.json(payload);
}
