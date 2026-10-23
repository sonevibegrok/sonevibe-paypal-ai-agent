import type { KeyboardEvent } from "react";
import { COPY } from "../copy";

const LIMIT = 2000;

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  const remaining = LIMIT - value.length;
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && value.trim()) {
          onSend();
        }
      }}
    >
      <label htmlFor="chat-message">{COPY.messageLabel}</label>
      <textarea
        id="chat-message"
        value={value}
        maxLength={LIMIT}
        rows={3}
        disabled={disabled}
        aria-describedby="chat-hint"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <p id="chat-hint" className="hint">
        {remaining} characters left. Enter to send, Shift+Enter for a new line.
      </p>
      <button type="submit" className="btn btn-primary" disabled={disabled || value.trim().length === 0}>
        {COPY.send}
      </button>
    </form>
  );
}
