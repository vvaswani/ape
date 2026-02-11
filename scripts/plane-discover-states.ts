#!/usr/bin/env node

interface PlaneState {
  id: string;
  name?: string;
  group?: string;
  color?: string;
  sequence?: number;
}

interface PlaneListResponse<T> {
  results?: T[];
  data?: T[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function normalizeList<T>(payload: PlaneListResponse<T> | T[]): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

async function main(): Promise<void> {
  const baseUrl = requireEnv("PLANE_API_BASE_URL").replace(/\/$/, "");
  const token = requireEnv("PLANE_API_TOKEN");
  const workspaceSlug = requireEnv("PLANE_WORKSPACE_SLUG");
  const projectId = requireEnv("PLANE_PROJECT_ID");

  const path = `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/states/?limit=200`;
  const url = `${baseUrl}${path}`;

  console.log(`Fetching states from ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": token,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch states (${response.status}): ${body.slice(0, 300)}`);
  }

  const raw = (await response.json()) as PlaneListResponse<PlaneState> | PlaneState[];
  const states = normalizeList(raw);

  if (!states.length) {
    console.log("No states found.");
    return;
  }

  console.log("Available Plane states:");
  for (const state of states) {
    const name = state.name || "(unnamed)";
    const group = state.group || "(no-group)";
    const sequence = typeof state.sequence === "number" ? state.sequence : "-";
    console.log(`- ${name} | id=${state.id} | group=${group} | sequence=${sequence}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
