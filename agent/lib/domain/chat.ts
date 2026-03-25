/**
 * @file chat.ts
 * @description
 * Lightweight conversational message types used only inside the LLM adapter layer.
 */

/**
 * A supported chat role for multi-turn conversation.
 */
export type ChatRole = "user" | "assistant" | "system";

/**
 * A single chat message in a multi-turn conversation.
 */
export interface ChatMessage {
  /**
   * The role of the message sender.
   */
  role: ChatRole;

  /**
   * The message content.
   */
  content: string;
}

