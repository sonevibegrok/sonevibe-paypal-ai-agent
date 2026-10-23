import { useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { patchQuote } from "../api/client";
import { isApiError } from "../api/errors";
import { COPY } from "../copy";
import { formatTimestamp } from "../format/money";
import { ErrorBanner } from "./ErrorBanner";
import { QuoteLineItem } from "./QuoteLineItem";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { QuoteTotals } from "./QuoteTotals";

export function QuoteDraftPanel({
  quote,
  editable,
  onQuote,
  showReviewLink,
}: {
  quote: Quote;
  editable: boolean;
  onQuote: (quote: Quote) => void;
  showReviewLink?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(items: { serviceId: string; quantity: number }[]) {
    setBusy(true);
    setError(null);
    try {
      onQuote(await patchQuote(quote.id, items));
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : "The quote could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quote-panel">
      <div className="quote-head">
        <h2>Quote {quote.id}</h2>
        <QuoteStatusBadge status={quote.status} />
      </div>
      <p className="meta">Expires {formatTimestamp(quote.expiresAt)} UTC</p>
      {quote.items.map((item) => (
        <QuoteLineItem
          key={item.serviceId}
          item={item}
          currency={quote.currency}
          editable={editable && quote.status === "draft"}
          disableRemove={quote.items.length <= 1}
          busy={busy}
          onQuantity={(quantity) =>
            void save(quote.items.map((line) => ({
              serviceId: line.serviceId,
              quantity: line.serviceId === item.serviceId ? quantity : line.quantity,
            })))
          }
          onRemove={() =>
            void save(
              quote.items
                .filter((line) => line.serviceId !== item.serviceId)
                .map((line) => ({ serviceId: line.serviceId, quantity: line.quantity })),
            )
          }
        />
      ))}
      {quote.items.length <= 1 ? (
        <p className="meta">A quote needs at least one service. Ask the assistant to change it.</p>
      ) : null}
      <QuoteTotals quote={quote} />
      {!quote.pricingComplete ? <p className="meta">{COPY.pricing}</p> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {showReviewLink ? (
        <a className="btn btn-primary" href={`#/quote/${encodeURIComponent(quote.id)}`}>
          {COPY.reviewQuote}
        </a>
      ) : null}
    </div>
  );
}
