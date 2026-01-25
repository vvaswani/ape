"use client";

import { FormEvent, useState } from "react";

export default function AgentInput() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    window.dispatchEvent(
      new CustomEvent("agent:thinking", { detail: true })
    );

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });

      const data = await res.json();

      window.dispatchEvent(
        new CustomEvent("agent:response", {
          detail: data.response ?? "No response",
        })
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("agent:response", {
          detail: "Error getting response",
        })
      );
    } finally {
      setLoading(false);
      setText("");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your message..."
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Thinking..." : "Send"}
      </button>
    </form>
  );
}
