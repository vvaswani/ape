#!/usr/bin/env node

import { readFileSync } from "node:fs";

type PullRequestEventAction = "opened" | "reopened" | "ready_for_review" | "closed" | string;
type TargetState = "IN_PROGRESS" | "IN_REVIEW" | "DONE";

interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged?: boolean;
  head?: {
    ref?: string;
  };
}

interface GitHubPullRequestEvent {
  action: PullRequestEventAction;
  pull_request?: GitHubPullRequest;
}

interface PlaneWorkItem {
  id: string;
  key?: string;
  issue_key?: string;
  identifier?: string | number;
  sequence_id?: string | number;
  project_identifier?: string;
  project?: {
    identifier?: string;
  };
  project_detail?: {
    identifier?: string;
  };
}

interface PlaneListResponse<T> {
  results?: T[];
  data?: T[];
}

interface Config {
  planeApiBaseUrl: string;
  planeApiToken: string;
  planeWorkspaceSlug: string;
  planeProjectId: string;
  planeStateInProgressId: string;
  planeStateInReviewId: string;
  planeStateDoneId: string;
  planeKeyPrefix: string;
}

class HttpError extends Error {
  status: number;
  responseBody: string;

  constructor(message: string, status: number, responseBody: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

const BASE_RETRY_DELAY_MS = 500;
const MAX_429_RETRIES = 3;
const getRequestCache = new Map<string, unknown>();

async function main(): Promise<void> {
  const event = readGitHubEvent();
  const action = event.action;
  const pullRequest = event.pull_request;

  if (!pullRequest) {
    console.log("No pull_request payload found; skipping.");
    return;
  }

  const targetState = determineTargetState(action, pullRequest.merged === true);
  if (!targetState) {
    console.log(`No state transition for action '${action}'; skipping.`);
    return;
  }

  const planeKeyPrefix = (process.env.PLANE_KEY_PREFIX || "APE").trim() || "APE";
  const planeKey = findPlaneKey(
    [pullRequest.head?.ref || "", pullRequest.title || "", pullRequest.body || ""],
    planeKeyPrefix,
  );

  if (!planeKey) {
    console.log("No Plane key found; skipping.");
    return;
  }

  const config = readConfig(planeKeyPrefix);
  console.log(`Plane key detected: ${planeKey}`);
  console.log(`Target transition: ${targetState}`);

  const desiredStateId = resolveStateId(config, targetState);

  const workItem = await findWorkItemByKey(config, planeKey);
  if (!workItem) {
    console.log(`Plane work item '${planeKey}' not found in project '${config.planeProjectId}'; skipping.`);
    return;
  }

  console.log(`Found work item '${workItem.id}'. Updating state.`);
  await updateWorkItemState(config, workItem.id, desiredStateId);
  console.log(`State updated to '${desiredStateId}'.`);

  const commentHtml = buildCommentHtml({
    action,
    targetState,
    planeKey,
    prNumber: pullRequest.number,
    prUrl: pullRequest.html_url,
    prTitle: pullRequest.title,
  });

  console.log("Posting comment to work item.");
  await postWorkItemComment(config, workItem.id, commentHtml);
  console.log("Comment posted successfully.");
}

function readGitHubEvent(): GitHubPullRequestEvent {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required.");
  }

  const raw = readFileSync(eventPath, "utf8");
  return JSON.parse(raw) as GitHubPullRequestEvent;
}

function determineTargetState(action: PullRequestEventAction, merged: boolean): TargetState | null {
  if (action === "opened" || action === "reopened") {
    return "IN_PROGRESS";
  }

  if (action === "ready_for_review") {
    return "IN_REVIEW";
  }

  if (action === "closed" && merged) {
    return "DONE";
  }

  return null;
}

function findPlaneKey(fields: string[], prefix: string): string | null {
  const escapedPrefix = escapeRegex(prefix.toUpperCase());
  const regex = new RegExp(`(?:^|[^A-Z0-9])(${escapedPrefix}-\\d+)(?:[^A-Z0-9]|$)`, "i");

  for (const field of fields) {
    const match = regex.exec(field || "");
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

function readConfig(planeKeyPrefix: string): Config {
  return {
    planeApiBaseUrl: requireEnv("PLANE_API_BASE_URL"),
    planeApiToken: requireEnv("PLANE_API_TOKEN"),
    planeWorkspaceSlug: requireEnv("PLANE_WORKSPACE_SLUG"),
    planeProjectId: requireEnv("PLANE_PROJECT_ID"),
    planeStateInProgressId: requireEnv("PLANE_STATE_IN_PROGRESS_ID"),
    planeStateInReviewId: requireEnv("PLANE_STATE_IN_REVIEW_ID"),
    planeStateDoneId: requireEnv("PLANE_STATE_DONE_ID"),
    planeKeyPrefix,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function resolveStateId(config: Config, targetState: TargetState): string {
  const allowedStates = new Map<TargetState, string>([
    ["IN_PROGRESS", config.planeStateInProgressId],
    ["IN_REVIEW", config.planeStateInReviewId],
    ["DONE", config.planeStateDoneId],
  ]);

  const stateId = allowedStates.get(targetState);
  if (!stateId) {
    throw new Error(`Unsupported target state: ${targetState}`);
  }

  return stateId;
}

async function findWorkItemByKey(config: Config, planeKey: string): Promise<PlaneWorkItem | null> {
  const ws = encodeURIComponent(config.planeWorkspaceSlug);
  const project = encodeURIComponent(config.planeProjectId);
  const encodedKey = encodeURIComponent(planeKey);

  const directPath = `/api/v1/workspaces/${ws}/projects/${project}/work-items/${encodedKey}/`;
  console.log("Attempting direct work-item lookup by key.");
  try {
    const direct = await requestWithRetry<PlaneWorkItem>(config, directPath, { method: "GET" });
    if (direct?.id) {
      return direct;
    }
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 404) {
      console.log("Direct lookup failed; falling back to list lookup.");
    }
  }

  const listPaths = [
    `/api/v1/workspaces/${ws}/projects/${project}/work-items/?search=${encodedKey}&limit=50`,
    `/api/v1/workspaces/${ws}/projects/${project}/work-items/?limit=50`,
  ];

  for (const path of listPaths) {
    console.log(`Searching work items via ${path}`);
    try {
      const payload = await requestWithRetry<PlaneListResponse<PlaneWorkItem> | PlaneWorkItem[]>(config, path, {
        method: "GET",
      });

      const items = normalizeList(payload);
      const matched = items.find((item) => matchesPlaneKey(item, planeKey, config.planeKeyPrefix));
      if (matched) {
        return matched;
      }
    } catch (error) {
      if (error instanceof HttpError) {
        console.log(`Lookup path failed (${error.status}); trying next candidate.`);
        continue;
      }
      throw error;
    }
  }

  return null;
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

function matchesPlaneKey(item: PlaneWorkItem, expectedKey: string, defaultPrefix: string): boolean {
  const expectedUpper = expectedKey.toUpperCase();
  const candidates = new Set<string>();

  const maybeStrings = [item.key, item.issue_key, normalizeIdentifier(item.identifier)];
  for (const value of maybeStrings) {
    if (value) {
      candidates.add(value.toUpperCase());
    }
  }

  const prefix =
    item.project_detail?.identifier || item.project?.identifier || item.project_identifier || defaultPrefix || "APE";

  const sequence = normalizeIdentifier(item.sequence_id) || normalizeIdentifier(item.identifier);
  if (sequence && /^\d+$/.test(sequence)) {
    candidates.add(`${prefix}-${sequence}`.toUpperCase());
  }

  return candidates.has(expectedUpper);
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}

async function updateWorkItemState(config: Config, workItemId: string, stateId: string): Promise<void> {
  const ws = encodeURIComponent(config.planeWorkspaceSlug);
  const project = encodeURIComponent(config.planeProjectId);
  const item = encodeURIComponent(workItemId);

  const path = `/api/v1/workspaces/${ws}/projects/${project}/work-items/${item}/`;
  await requestWithRetry(config, path, {
    method: "PATCH",
    body: JSON.stringify({ state: stateId }),
  });
}

async function postWorkItemComment(config: Config, workItemId: string, commentHtml: string): Promise<void> {
  const ws = encodeURIComponent(config.planeWorkspaceSlug);
  const project = encodeURIComponent(config.planeProjectId);
  const item = encodeURIComponent(workItemId);

  const path = `/api/v1/workspaces/${ws}/projects/${project}/work-items/${item}/comments/`;
  await requestWithRetry(config, path, {
    method: "POST",
    body: JSON.stringify({ comment_html: commentHtml }),
  });
}

function buildCommentHtml(input: {
  action: string;
  targetState: TargetState;
  planeKey: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
}): string {
  const escapedTitle = escapeHtml(input.prTitle || "(untitled)");
  const escapedAction = escapeHtml(input.action);
  const prLink = `<a href="${escapeHtml(input.prUrl)}">PR #${input.prNumber}</a>`;

  if (input.targetState === "DONE") {
    return `<p>${prLink} merged for ${escapeHtml(input.planeKey)}.</p><p>Merged PR #${input.prNumber}: ${escapedTitle}</p>`;
  }

  return `<p>${prLink} event: ${escapedAction}. Target state: ${escapeHtml(input.targetState)}.</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requestWithRetry<T>(config: Config, path: string, init: RequestInit): Promise<T> {
  const baseUrl = config.planeApiBaseUrl.replace(/\/$/, "");
  const method = (init.method || "GET").toUpperCase();
  const cacheKey = `${baseUrl}${path}`;

  if (method === "GET" && getRequestCache.has(cacheKey)) {
    return getRequestCache.get(cacheKey) as T;
  }

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.planeApiToken,
      },
      body: init.body,
    });

    if (response.status === 429 && attempt < MAX_429_RETRIES) {
      const waitMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      console.log(`Rate limited by Plane API (429). Retry ${attempt + 1}/${MAX_429_RETRIES} in ${waitMs}ms.`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const errorBody = await safeReadText(response);
      throw new HttpError(
        `Plane API request failed (${response.status}) ${init.method || "GET"} ${path}`,
        response.status,
        errorBody,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await safeReadText(response);
    if (!text) {
      return undefined as T;
    }

    const parsed = JSON.parse(text) as T;
    if (method === "GET") {
      getRequestCache.set(cacheKey, parsed as unknown);
    }

    return parsed;
  }

  throw new Error(`Exceeded retry attempts for request ${method} ${path}`);
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  const strictMode = (process.env.PLANE_SYNC_STRICT || "false").toLowerCase() === "true";
  const message = error instanceof Error ? error.message : String(error);

  console.log(`Plane sync failed: ${message}`);
  if (error instanceof HttpError && error.responseBody) {
    console.log(`Plane API response snippet: ${error.responseBody.slice(0, 400)}`);
  }

  if (strictMode) {
    process.exitCode = 1;
    return;
  }

  console.log("Continuing with success exit code because PLANE_SYNC_STRICT is not enabled.");
  process.exitCode = 0;
});
