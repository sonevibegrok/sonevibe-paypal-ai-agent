import { useEffect, useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { getQuote } from "../api/client";
import { isApiError } from "../api/errors";
import { useApp } from "../app-state";
import { ErrorBanner } from "../components/ErrorBanner";
import { ReceiptCard } from "../components/ReceiptCard";
import { Skeleton } from "../components/Skeleton";
import { QuoteStatusBadge } from "../components/QuoteStatusBadge";

export function ReceiptPage({ quoteId }: { quoteId: string }) {
  const { setQuote } = useApp();
  const [quote, setLocal] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getQuote(quoteId).then(
      (loaded) => {
        if (cancelled) {
          return;
        }
        setLocal(loaded);
        setQuote(loaded);
        setLoading(false);
      },
      (caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(isApiError(caught) ? caught.message : "The quote could not be loaded.");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [quoteId, setQuote]);

  const captured = quote?.status === "captured";

  return (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>{captured ? "Sandbox receipt" : "Receipt not available"}</h1>
      {loading ? <Skeleton label="Loading the quote." /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {quote && captured ? <ReceiptCard quote={quote} /> : null}
      {quote && !captured ? (
        <div className="stack">
          <p>A receipt is shown only after the server reports this quote as captured.</p>
          <QuoteStatusBadge status={quote.status} />
          <a className="btn btn-secondary" href={`#/quote/${encodeURIComponent(quote.id)}`}>
            Back to the quote
          </a>
        </div>
      ) : null}
    </main>
  );
}
