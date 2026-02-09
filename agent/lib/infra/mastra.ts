/**
 * @file mastra.ts
 * @description
 * Infrastructure wiring for Mastra Agent used by the AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator).
 *
 * This module is intentionally small:
 * - Creates the Agent and Mastra instance
 * - Provides a single function to generate a response from messages
 *
 * No HTTP concerns and no UI concerns belong here.
 */

import { Mastra } from "@mastra/core/mastra";
import { Agent } from "@mastra/core/agent";
import type { ChatMessage } from "@/lib/domain/chat";

/**
 * Runtime identifier for the agent instance.
 */
const AGENT_ID = "ape-agent";

/**
 * Create and cache the Mastra instance.
 *
 * Note:
 * In Next.js, module scope is reused within the same server process.
 * This is good enough for Milestone #1.
 */
const resolvedModel =
  process.env.OLLAMA_BASE_URL
    ? {
        id: process.env.LLM_MODEL_ID ?? "custom/qwen2.5:7b-instruct",
        url: process.env.OLLAMA_BASE_URL,
      }
    : "google/gemini-2.5-flash";

const mastra = new Mastra({
  agents: {
    apeAgent: new Agent({
      id: AGENT_ID,
      name: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",
      instructions: `
You are a knowledgeable portfolio decision support assistant.

Rules:
- Be concise, actionable, and policy-respecting.
- Prefer "do nothing" when the user has not provided sufficient information.
- Do not claim to execute trades or provide regulated financial advice.
- When uncertain, ask targeted clarifying questions.

Output:
- Plain text for Milestone #1.
      `.trim(),
      model: resolvedModel,
      // model: "google/gemini-2.5-flash-lite",

    }),
  },
});

/**
 * Convert domain chat messages to the format expected by Mastra.
 *
 * @param messages - Domain chat history (user/assistant/system).
 * @returns Messages in the agent format.
 */
function toAgentMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export interface GenerateAssistantReplyInput {
  messages: ChatMessage[];
  systemPrompt?: string;
}

/**
 * Generate an assistant response using the Mastra agent.
 *
 * @param input - Full conversation history and optional system prompt.
 * @returns Assistant response content as plain text.
 */
export async function generateAssistantReply(input: GenerateAssistantReplyInput): Promise<string> {
  const agent = mastra.getAgent("apeAgent");
  const finalMessages = input.systemPrompt
    ? [{ role: "system", content: input.systemPrompt }, ...input.messages]
    : input.messages;
  const result = await agent.generate(toAgentMessages(finalMessages));
  return result.text ?? "";
}
