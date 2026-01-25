"use client";

import { useEffect, useState } from "react";

export default function AgentResponse() {
  const [response, setResponse] = useState("");

  useEffect(() => {
    function onThinking() {
      setResponse("Thinking...");
    }

    function onResponse(e: Event) {
      const custom = e as CustomEvent<string>;
      setResponse(custom.detail);
    }

    window.addEventListener("agent:thinking", onThinking);
    window.addEventListener("agent:response", onResponse);

    return () => {
      window.removeEventListener("agent:thinking", onThinking);
      window.removeEventListener("agent:response", onResponse);
    };
  }, []);

  return (
    <div className="response">
      <p>{response}</p>
    </div>
  );
}
