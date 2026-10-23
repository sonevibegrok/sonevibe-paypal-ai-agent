import { useEffect, useRef } from "react";
import type { ToolEvent } from "@sonevibe/shared";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export type ChatEntry = {
  id: string;
  role: "user" | "agent";
  text: string;
  toolEvents?: ToolEvent[];
};

export function ChatThread({ entries, busy }: { entries: ChatEntry[]; busy: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [entries, busy]);

  return (
    <div className="thread" aria-live="polite" aria-relevant="additions">
      {entries.length === 0 ? (
        <p className="thread-empty">
          Describe the work you need. The assistant drafts a quote from the service catalog.
        </p>
      ) : null}
      {entries.map((entry) => (
        <MessageBubble key={entry.id} role={entry.role} text={entry.text} toolEvents={entry.toolEvents} />
      ))}
      {busy ? <TypingIndicator /> : null}
      <div ref={endRef} />
    </div>
  );
}
