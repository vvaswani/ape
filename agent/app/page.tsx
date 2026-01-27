"use client";

/**
 * @file page.tsx
 * @description
 * Main UI container for Milestone #1.
 * Owns chat state and calls the API route.
 */

import { useCallback, useState } from "react";
import ChatComposer from "@/components/ChatComposer";
import ChatThread from "@/components/ChatThread";
import ResponsePanel from "@/components/ResponsePanel";
import type { ChatMessage, ChatRequest, ChatResponse } from "@/lib/domain/chat";

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m the AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator). Tell me what you’re trying to decide and what you know (targets, current weights, cash flows).",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSend = useCallback(async (text: string) => {
    setError(null);
    setIsLoading(true);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];

    // Optimistic update: show user message immediately.
    setMessages(nextMessages);

    try {
      const payload: ChatRequest = { messages: nextMessages };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = (await res.json()) as ChatResponse;

      setMessages((prev) => [...prev, { role: "assistant", content: data.assistant.content }]);
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Check server logs and your API key.");
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__brand">AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)</div>
        <div className="app__subtitle">Policy-driven portfolio decision support with an audit trail (Milestone #1)</div>
      </header>

      <div className="card">
        <div className="chat">
          <div className="chat__topbar">
            <div className="chat__hint">Multi-turn chat. No trade execution. No market timing.</div>
          </div>

          <ChatThread messages={messages} />
          <ResponsePanel isLoading={isLoading} error={error} />
        </div>

        <div className="divider" />
        <ChatComposer onSend={onSend} disabled={isLoading} />
      </div>
    </main>
  );
}
