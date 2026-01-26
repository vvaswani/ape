"use client";

/**
 * @file app/page.tsx
 *
 * ## Purpose
 * Main UI for interacting with the APE agent in dev mode.
 *
 * Responsibilities:
 * - holds chat message state
 * - passes messages and callbacks to child components
 * - keeps the page composition minimal
 */

import { useCallback, useMemo, useState } from "react";
import AgentInput from "@/components/AgentInput";
import AgentResponse from "@/components/AgentResponse";

/**
 * Permitted roles for chat messages shown in the UI.
 */
type ChatRole = "user" | "assistant";

/**
 * Message shape used by the UI.
 */
export type UiChatMessage = {
  role: ChatRole;
  content: string;
};

export default function Page() {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return messages[i]?.content ?? "";
    }
    return "";
  }, [messages]);

  /**
   * Clears all chat history from the UI.
   */
  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsThinking(false);
  }, []);

  /**
   * Submits a user message to the backend and appends the assistant response.
   *
   * @param inputRaw user-entered text
   */
  const submit = useCallback(async (inputRaw: string) => {
    const input = inputRaw.trim();
    if (!input || isThinking) return;

    setError(null);
    setIsThinking(true);

    // Append the user message immediately for responsiveness
    const nextMessages: UiChatMessage[] = [...messages, { role: "user", content: input }];
    setMessages(nextMessages);

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send full history to enable multi-turn context
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const details = typeof data?.details === "string" ? data.details : "";
        const errMsg =
          typeof data?.error === "string" ? data.error : "Request failed";
        throw new Error(details ? `${errMsg}: ${details}` : errMsg);
      }

      const responseText = typeof data?.response === "string" ? data.response : "";
      setMessages([...nextMessages, { role: "assistant", content: responseText }]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, messages]);

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__brand">APE</h1>
        <div className="app__subtitle">Automated Portfolio Evaluator (dev)</div>
      </header>

      <section className="card">
        <AgentResponse
          messages={messages}
          isThinking={isThinking}
          error={error}
          onClear={clear}
          lastAssistantMessage={lastAssistantMessage}
        />

        <div className="divider" />

        <AgentInput onSubmit={submit} disabled={isThinking} />
      </section>
    </main>
  );
}
