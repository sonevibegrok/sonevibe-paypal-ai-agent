import { useRef, useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { acceptQuote } from "../api/client";
import { isApiError } from "../api/errors";
import { COPY } from "../copy";
import { ErrorBanner } from "./ErrorBanner";

export function AcceptQuoteButton({
  quote,
  onAccepted,
}: {
  quote: Quote;
  onAccepted: (quote: Quote) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const disabled = busy || !quote.pricingComplete || quote.status !== "draft";

  async function accept() {
    if (lock.current || !quote.pricingComplete || quote.status !== "draft") {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      onAccepted(await acceptQuote(quote.id));
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : "The quote could not be accepted.");
      lock.current = false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="accept-row">
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled}
        aria-describedby="accept-reason"
        onClick={() => void accept()}
      >
        {COPY.accept}
      </button>
      <p id="accept-reason">
        {quote.pricingComplete
          ? "Accepting does not charge anything. You still approve the sandbox payment afterward."
          : COPY.pricing}
      </p>
      {error ? <ErrorBanner message={error} /> : null}
    </div>
  );
}
