/**
 * @file clientLogger.ts
 * @description
 * Minimal client-side logger with level gating.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL ?? "info").toLowerCase();
const activeLevel = (["debug", "info", "warn", "error"].includes(configuredLevel)
  ? configuredLevel
  : "info") as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[activeLevel];
}

const clientLogger = {
  debug: (message: string, data?: unknown) => {
    if (shouldLog("debug")) console.debug(message, data ?? "");
  },
  info: (message: string, data?: unknown) => {
    if (shouldLog("info")) console.info(message, data ?? "");
  },
  warn: (message: string, data?: unknown) => {
    if (shouldLog("warn")) console.warn(message, data ?? "");
  },
  error: (message: string, data?: unknown) => {
    if (shouldLog("error")) console.error(message, data ?? "");
  },
};

export default clientLogger;
