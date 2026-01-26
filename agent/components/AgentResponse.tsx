/**
 * @file components/AgentResponse.tsx
 *
 * ## Purpose
 * Renders chat messages and operational UI controls:
 * - shows "Thinking..." while waiting
 * - shows errors if present
 * - supports clearing the chat
 * - supports copying the last assistant response
 */

"use client";

import type { UiChatMessage } from "@/app/page";

export type AgentResponseProps = {
  messages: UiChatMessage[];
  isThinking: boolean;
  error: string | null;
  onClear: () => void;
  lastAssistantMessage: string;
};

export default function AgentResponse({
  messages,
  isThinking,
  error,
  onClear,
  lastAssistantMessage,
}: AgentResponseProps) {
  return (
    <div className="agent-response">
      <div className="agent-response__actions" style={{ display: "flex", gap: 8 }}>
        <button onClick={onClear} disabled={isThinking && messages.length === 0}>
          Clear
        </button>

        <button
          onClick={() => {
            if (!lastAssistantMessage) return;
            navigator.clipboard.writeText(lastAssistantMessage);
          }}
          disabled={!lastAssistantMessage}
        >
          Copy last answer
        </button>
      </div>

      {error && (
        <div className="agent-response__error" style={{ marginTop: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {isThinking && (
        <div className="agent-response__thinking" style={{ marginTop: 12 }}>
          Thinking...
        </div>
      )}

      <div className="agent-response__messages" style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} className="agent-message" style={{ border: "1px solid #ddd", padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{m.role.toUpperCase()}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
