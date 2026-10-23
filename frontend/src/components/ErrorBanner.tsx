import { COPY } from "../copy";

export function ErrorBanner({
  message,
  requestId,
  onRetry,
}: {
  message: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <p>{message}</p>
      {requestId ? <p className="meta">Reference: {requestId}</p> : null}
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          {COPY.retry}
        </button>
      ) : null}
    </div>
  );
}
