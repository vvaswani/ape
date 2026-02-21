"use client";

/**
 * @file ChatPage.tsx
 * @description
 * Main UI container for Milestone #2.
 *
 * Responsibilities:
 * - Maintain chat state (UX continuity)
 * - Call the decision API
 * - Render the Decision Snapshot as the authoritative output
 */

import { useCallback, useState } from "react";
import ChatComposer from "@/components/ChatComposer";
import ChatThread from "@/components/ChatThread";
import ResponsePanel from "@/components/ResponsePanel";
import DecisionPanel from "@/components/DecisionPanel";
import clientLogger from "@/lib/infra/clientLogger";

import type { ChatMessage, ChatRequest } from "@/lib/domain/chat";
import type { DecisionSnapshot } from "@/lib/domain/decisionSnapshot";

import PortfolioStateForm from "@/components/PortfolioStateForm";
import type { PortfolioStateInput } from "@/lib/domain/portfolioState";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m the AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator). Tell me what you’re trying to decide and what you know (targets, current weights, cash flows).",
    },
  ]);

  const [lastSnapshot, setLastSnapshot] = useState<DecisionSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [portfolioState, setPortfolioState] = useState<PortfolioStateInput>({
    as_of_date: new Date().toISOString().slice(0, 10),
    total_value_gbp: null,
    weights: { EQUITIES: null, BONDS: null, CASH: null },
    cash_flows: { pending_contributions_gbp: null, pending_withdrawals_gbp: null },
  });

  const onSend = useCallback(
    async (text: string) => {
      setError(null);
      setIsLoading(true);

      // Build next chat state optimistically
      const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(nextMessages);

      try {
        const payload: ChatRequest = { messages: nextMessages, portfolio_state: portfolioState };
        clientLogger.debug("[APE UI] Sending chat payload:", payload);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const data = (await res.json()) as { snapshot: DecisionSnapshot };

        // Snapshot is authoritative
        setLastSnapshot(data.snapshot);

        // Chat is supportive UX only
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${data.snapshot.recommendation.type}: ${data.snapshot.recommendation.summary}`,
          },
        ]);
      } catch (e) {
        console.error(e);
        setError("Something went wrong. Check server logs and your API key.");
      } finally {
        setIsLoading(false);
      }
    },
    [messages, portfolioState]
  );

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__brand">
          AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)
        </div>
        <div className="app__subtitle">
          Policy-driven portfolio decisions with an audit trail
        </div>
      </header>

      <div className="card">
        <div className="chat">
          <div className="chat__topbar">
            <div className="chat__hint">
              Chat for context · Decision Snapshot is authoritative
            </div>
          </div>

          <PortfolioStateForm value={portfolioState} onChange={setPortfolioState} />
          <ChatThread messages={messages} />
          <ResponsePanel isLoading={isLoading} error={error} />

          {lastSnapshot && <DecisionPanel snapshot={lastSnapshot} />}
        </div>

        <div className="divider" />
        <ChatComposer onSend={onSend} disabled={isLoading} />
      </div>
    </main>
  );
}
