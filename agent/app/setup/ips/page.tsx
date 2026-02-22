"use client";

import { useState } from "react";

type RequestKind = "save-draft" | "freeze";

type LastResponse = {
  requestKind: RequestKind;
  status: number;
  bodyText: string;
};

const DEFAULT_DRAFT_JSON = `{
  "ipsVersion": "v1",
  "ipsSha256": "placeholder-sha256",
  "status": "DRAFT",
  "createdAtIso": "2026-02-22T00:00:00.000Z",
  "content": "IPS draft content"
}`;

function prettyPrintIfJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export default function IpsSetupPage() {
  const [draftJson, setDraftJson] = useState<string>(DEFAULT_DRAFT_JSON);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<LastResponse | null>(null);

  async function captureResponse(requestKind: RequestKind, res: Response): Promise<void> {
    const rawText = await res.text();
    setLastResponse({
      requestKind,
      status: res.status,
      bodyText: prettyPrintIfJson(rawText),
    });
  }

  async function onSaveDraft(): Promise<void> {
    setClientError(null);

    try {
      JSON.parse(draftJson);
    } catch {
      setClientError("Invalid JSON");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: draftJson,
      });

      await captureResponse("save-draft", res);
    } catch (err) {
      setLastResponse({
        requestKind: "save-draft",
        status: 0,
        bodyText: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onFreeze(): Promise<void> {
    setClientError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/ips/freeze", {
        method: "POST",
      });

      await captureResponse("freeze", res);
    } catch (err) {
      setLastResponse({
        requestKind: "freeze",
        status: 0,
        bodyText: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <h1>IPS</h1>
      <p>Use this page to exercise the IPS draft and freeze APIs.</p>

      <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
        <label htmlFor="ips-json">IPS Draft JSON</label>
        <textarea
          id="ips-json"
          value={draftJson}
          onChange={(event) => setDraftJson(event.target.value)}
          rows={14}
          style={{ width: "100%", fontFamily: "monospace" }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onSaveDraft} disabled={isSubmitting}>
            Save draft
          </button>
          <button type="button" onClick={onFreeze} disabled={isSubmitting}>
            Freeze
          </button>
          <a href="/dashboard">Back to dashboard</a>
          <a href="/dashboard" target="_blank" rel="noreferrer">
            Open dashboard in new tab
          </a>
        </div>

        <div>
          <strong>Client error:</strong> {clientError ?? "None"}
        </div>

        <section>
          <h2>Last response</h2>
          {lastResponse ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <strong>Request:</strong> {lastResponse.requestKind}
              </div>
              <div>
                <strong>Status:</strong> {lastResponse.status}
              </div>
              <div>
                <strong>Body:</strong>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{lastResponse.bodyText}</pre>
            </div>
          ) : (
            <p>No requests yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
