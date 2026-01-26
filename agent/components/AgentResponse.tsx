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
import ReactMarkdown from "react-markdown";

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
    <div className="chat">
      <div className="chat__topbar">
        <div className="chat__hint">Dev chat</div>
        <div className="chat__actions">
          <button className="btn btn--ghost" onClick={onClear}>Clear</button>
          <button
            className="btn btn--ghost"
            onClick={() => lastAssistantMessage && navigator.clipboard.writeText(lastAssistantMessage)}
            disabled={!lastAssistantMessage}
          >
            Copy last
          </button>
        </div>
      </div>

      {error && <div className="chat__error">Error: {error}</div>}

      <div className="chat__scroll">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "msg--user" : "msg--assistant"}`}>
            <div className="msg__meta">{m.role === "user" ? "You" : "APE"}</div>
            <div className="msg__bubble">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="msg msg--assistant">
            <div className="msg__meta">APE</div>
            <div className="msg__bubble msg__bubble--thinking">Thinking…</div>
          </div>
        )}
      </div>
    </div>
  );
}