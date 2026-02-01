/**
 * @file logger.ts
 * @description
 * Centralized structured logger (pino).
 */

import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

export default logger;
