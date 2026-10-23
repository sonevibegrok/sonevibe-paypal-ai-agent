export function Skeleton({ label }: { label: string }) {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <span className="skeleton-block" />
      <span className="skeleton-block short" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
