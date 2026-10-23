import { useEffect, useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { getQuote } from "../api/client";
import { isApiError } from "../api/errors";
import { useApp } from "../app-state";
import { AcceptQuoteButton } from "../components/AcceptQuoteButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { QuoteDraftPanel } from "../components/QuoteDraftPanel";
import { QuoteTerms } from "../components/QuoteTerms";
import { Skeleton } from "../components/Skeleton";
import { COPY } from "../copy";
import { setPrefill } from "../session";

export function QuotePage({ quoteId }: { quoteId: string }) {
  const { config, setQuote } = useApp();
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
        setError(null);
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

  function update(next: Quote) {
    setLocal(next);
    setQuote(next);
  }

  return (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>Review quote</h1>
      {loading ? <Skeleton label="Loading the quote." /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => window.location.reload()} /> : null}
      {quote ? (
        <>
          <QuoteDraftPanel quote={quote} editable={quote.status === "draft"} onQuote={update} />
          <QuoteTerms terms={config.terms} />
          {quote.status === "draft" ? <AcceptQuoteButton quote={quote} onAccepted={update} /> : null}
          {quote.status === "accepted" ||
          quote.status === "ordered" ||
          (quote.status === "failed" && quote.failure?.retryable) ? (
            <a className="btn btn-primary" href={`#/checkout/${encodeURIComponent(quote.id)}`}>
              {COPY.continueCheckout}
            </a>
          ) : null}
          {quote.status === "captured" ? (
            <a className="btn btn-primary" href={`#/receipt/${encodeURIComponent(quote.id)}`}>
              {COPY.viewReceipt}
            </a>
          ) : null}
          {quote.status === "expired" ? (
            <div className="stack">
              <p role="status">{COPY.expired}</p>
              <a
                className="btn btn-primary"
                href="#/"
                onClick={() => setPrefill("Please create a new quote. The previous one expired.")}
              >
                {COPY.requote}
              </a>
            </div>
          ) : null}
          {quote.status === "failed" && quote.failure ? <p role="alert">{quote.failure.message}</p> : null}
          {quote.status === "invoiced" ? (
            <p>The sandbox invoice was sent. A receipt appears here after the server marks it paid.</p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
