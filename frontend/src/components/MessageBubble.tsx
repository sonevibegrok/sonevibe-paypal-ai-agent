import type { ToolEvent } from "@sonevibe/shared";
import { AgentReply } from "../format/reply";
import { ToolActivityChip } from "./ToolActivityChip";

export function MessageBubble({
  role,
  text,
  toolEvents,
}: {
  role: "user" | "agent";
  text: string;
  toolEvents?: ToolEvent[];
}) {
  const label = role === "user" ? "You" : "Assistant";
  return (
    <article className={`bubble bubble-${role}`} aria-label={label}>
      <p className="bubble-label">{label}</p>
      {role === "user" ? <p className="user-text">{text}</p> : <AgentReply text={text} />}
      {toolEvents?.map((event, index) => (
        <ToolActivityChip key={`${event.type}-${index}`} event={event} />
      ))}
    </article>
  );
}
