export function Spinner({ label }: { label: string }) {
  return (
    <p className="spinner" role="status">
      <span className="spinner-mark" aria-hidden="true" />
      <span>{label}</span>
    </p>
  );
}
