import { useState, type FormEvent } from "react";
import type { Quote } from "@sonevibe/shared";
import { newIdempotencyKey, sendInvoice } from "../api/client";
import { isApiError } from "../api/errors";
import { COPY } from "../copy";
import { isSafeInvoiceUrl } from "../paypal/sdk";
import { ErrorBanner } from "./ErrorBanner";

export function InvoiceOption({
  quote,
  onQuote,
  onAlreadyCaptured,
}: {
  quote: Quote;
  onQuote: (quote: Quote) => void;
  onAlreadyCaptured: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState(quote.paypal.payerViewUrl);
  const orderBlocked =
    quote.status === "ordered" &&
    (quote.paypal.orderStatus === "APPROVED" || quote.paypal.orderStatus === "COMPLETED");
  const allowed =
    quote.pricingComplete &&
    !orderBlocked &&
    (quote.status === "accepted" ||
      quote.status === "ordered" ||
      (quote.status === "failed" && quote.failure?.retryable === true) ||
      quote.status === "invoiced");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!allowed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await sendInvoice(quote.id, email.trim(), newIdempotencyKey());
      onQuote(result.quote);
      setLink(result.payerViewUrl);
    } catch (caught) {
      if (isApiError(caught) && caught.code === "ALREADY_CAPTURED") {
        onAlreadyCaptured();
        return;
      }
      setError(isApiError(caught) ? caught.message : "The sandbox invoice could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invoice" onSubmit={(event) => void onSubmit(event)}>
      <h2>Email me a PayPal sandbox invoice instead</h2>
      <label htmlFor="invoice-email">Sandbox PayPal email</label>
      <input
        id="invoice-email"
        type="email"
        autoComplete="email"
        value={email}
        required
        disabled={!allowed || busy}
        onChange={(event) => setEmail(event.target.value)}
      />
      <p className="hint">The server only sends invoices to PayPal sandbox addresses.</p>
      {!quote.pricingComplete ? <p className="meta">{COPY.pricing}</p> : null}
      <button type="submit" className="btn btn-secondary" disabled={!allowed || busy || email.trim().length === 0}>
        Send sandbox invoice
      </button>
      {error ? <ErrorBanner message={error} /> : null}
      {link ? (
        isSafeInvoiceUrl(link) ? (
          <a href={link} target="_blank" rel="noreferrer noopener">
            Open the sandbox invoice
          </a>
        ) : (
          <p>{link}</p>
        )
      ) : null}
    </form>
  );
}
