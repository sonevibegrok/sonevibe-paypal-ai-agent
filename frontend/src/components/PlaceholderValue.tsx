import { COPY } from "../copy";

export function PlaceholderValue({ value }: { value: string | null }) {
  if (value === null || value === COPY.placeholder) {
    return (
      <span className="placeholder">
        <span>{COPY.placeholder}</span>
        <span className="placeholder-note"> {COPY.placeholderNote}</span>
      </span>
    );
  }
  return <>{value}</>;
}
