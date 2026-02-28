export type RepoErrorCode = "INVALID_USER_ID";

export class RepoError extends Error {
  readonly code: RepoErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RepoErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RepoError";
    this.code = code;
    this.details = details;
  }
}

export function isRepoError(error: unknown): error is RepoError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  const hasValidDetails =
    candidate.details === undefined ||
    (typeof candidate.details === "object" && candidate.details !== null && !Array.isArray(candidate.details));

  return (
    candidate.name === "RepoError" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    hasValidDetails
  );
}
