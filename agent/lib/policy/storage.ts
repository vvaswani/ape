import * as fs from "node:fs/promises";

const SAFE_USER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function ensureDirExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function safeUserIdToFilename(userId: string): string {
  if (!SAFE_USER_ID_PATTERN.test(userId)) {
    throw new Error(`Invalid userId format: ${userId}`);
  }

  return `${userId}.json`;
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteJsonWithFs(filePath, value, fs);
}

type FsOps = Pick<typeof fs, "writeFile" | "rename" | "rm">;

export async function atomicWriteJsonWithFs(filePath: string, value: unknown, fsOps: FsOps): Promise<void> {
  const json = stableStringify(value);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    await fsOps.writeFile(tmpPath, json, "utf8");
    await fsOps.rename(tmpPath, filePath);
  } catch (error) {
    // Best-effort cleanup of partially written temp file.
    await fsOps.rm(tmpPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortRecursively(value), null, 2)}\n`;
}

function sortRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecursively);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortRecursively(obj[key]);
    }
    return sorted;
  }

  return value;
}
