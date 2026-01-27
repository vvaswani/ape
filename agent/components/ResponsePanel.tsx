/**
 * @file ResponsePanel.tsx
 * @description
 * Optional panel for status/errors. Kept minimal for Milestone #1.
 */

export interface ResponsePanelProps {
  error?: string | null;
  isLoading?: boolean;
}

export default function ResponsePanel({ error, isLoading }: ResponsePanelProps) {
  if (!error && !isLoading) return null;

  return (
    <div className="chat__error" role="status" aria-live="polite">
      {isLoading ? "Thinking…" : error}
    </div>
  );
}
