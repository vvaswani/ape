/**
 * @file components/AgentInput.tsx
 *
 * ## Purpose
 * Input control for the APE chat UI.
 *
 * This component is intentionally "dumb":
 * - no network calls
 * - no global events
 * - delegates submit to parent via callback
 */

"use client";

import { useCallback, useState } from "react";

export type AgentInputProps = {
  /**
   * Called when the user submits non-empty input.
   */
  onSubmit: (input: string) => void;

  /**
   * Disables the input and button (e.g., while waiting for response).
   */
  disabled?: boolean;
};

export default function AgentInput({ onSubmit, disabled = false }: AgentInputProps) {
  const [input, setInput] = useState("");

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setInput("");
  }, [input, disabled, onSubmit]);

  return (
    <div className="agent-input">
      <input
        type="text"
        value={input}
        placeholder="Type your message..."
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        disabled={disabled}
      />
      <button onClick={submit} disabled={disabled}>
        Send
      </button>
    </div>
  );
}
