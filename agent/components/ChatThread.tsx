/**
 * @file ChatThread.tsx
 * @description
 * Renders a simple chat thread of user/assistant messages.
 */

import type { ChatMessage } from "@/lib/domain/chat";

export interface ChatThreadProps {
  /**
   * Messages to render in chronological order.
   */
  messages: ChatMessage[];
}

export default function ChatThread({ messages }: ChatThreadProps) {
  return (
    <div className="chat__scroll">
      {messages.map((m, idx) => (
        <div key={idx} className={`msg ${m.role === "user" ? "msg--user" : ""}`}>
          <div className="msg__meta">{m.role}</div>
          <div className="msg__bubble">{m.content}</div>
        </div>
      ))}
    </div>
  );
}
