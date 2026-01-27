"use client";

/**
 * @file ChatComposer.tsx
 * @description
 * UI component for composing and submitting a user message.
 */

import { useState } from "react";

export interface ChatComposerProps {
  /**
   * Called when the user submits text.
   */
  onSend: (text: string) => Promise<void> | void;

  /**
   * Whether submission is disabled (e.g., request in flight).
   */
  disabled?: boolean;
}

export default function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [text, setText] = useState("");

  return (
    <form
      className="composer"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t || disabled) return;
        setText("");
        await onSend(t);
      }}
    >
      <input
        className="composer__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask about allocation, rebalancing, risk, contributions…"
        disabled={disabled}
      />
      <button className="btn btn--primary" type="submit" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  );
}
