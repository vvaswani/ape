/**
 * @file chatService.ts
 * @description
 * Application service for chat interactions.
 *
 * Responsibilities:
 * - Validate request shape
 * - Apply basic safety/limits
 * - Call infra (Mastra)
 * - Return normalized API response
 *
 * Non-responsibilities:
 * - No HTTP handling (belongs in route.ts)
 * - No UI state concerns
 */

import type { ChatRequest, ChatResponse, ChatMessage } from "@/lib/domain/chat";
import { generateAssistantReply } from "@/lib/infra/mastra";

/**
 * Hard limit to prevent runaway payload sizes in Milestone #1.
 * Keep it conservative; adjust later.
 */
const MAX_MESSAGES = 30;

/**
 * Validate and normalize incoming chat request.
 *
 * @param req - Untrusted request payload.
 * @returns Normalized chat messages.
 */
function normalizeRequest(req: ChatRequest): ChatMessage[] {
  if (!req || !Array.isArray(req.messages)) {
    throw new Error("Invalid request: 'messages' must be an array.");
  }

  const trimmed = req.messages
    .filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
    .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content.trim() }))
    .filter((m) => m.content.length > 0);

  if (trimmed.length === 0) {
    throw new Error("Invalid request: at least one non-empty message is required.");
  }

  // Keep only the last N messages to control context size.
  return trimmed.slice(-MAX_MESSAGES);
}

/**
 * Run a single chat turn and return the assistant response.
 *
 * @param req - Chat request containing full conversation history.
 * @returns Chat response containing assistant content.
 */
export async function runChat(req: ChatRequest): Promise<ChatResponse> {
  const messages = normalizeRequest(req);
  const content = await generateAssistantReply({ messages });

  return {
    assistant: { content },
  };
}
