import type { ToolEvent } from "@sonevibe/shared";

export function ToolActivityChip({ event }: { event: ToolEvent }) {
  return <p className="tool-chip">{event.label}</p>;
}
