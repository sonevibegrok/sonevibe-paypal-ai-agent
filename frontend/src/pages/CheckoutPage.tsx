import { useEffect, useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { getQuote } from "../api/client";
import { isApiError } from "../api/errors";
import { useApp } from "../app-state";
import { CheckoutSummary } from "../components/CheckoutSummary";
import { ErrorBanner } from "../components/ErrorBanner";
import { InvoiceOption } from "../components/InvoiceOption";
import { PayPalButtonMount } from "../components/PayPalButtonMount";
import { SandboxBuyerHelp } from "../components/SandboxBuyerHelp";
import { Skeleton } from "../components/Skeleton";
import { COPY } from "../copy";
import type { CheckoutNotice } from "../paypal/checkout";
import { go } from "../router";
import { timing } from "../timing";

export function CheckoutPage({ quoteId }: { quoteId: string }) {
  const { setQuote } = useApp();
  const [quote, setLocal] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageRole, setMessageRole] = useState<"status" | "alert">("status");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  function apply(next: Quote) {
    setLocal(next);
    setQuote(next);
  }

  useEffect(() => {
    let cancelled = false;
    void getQuote(quoteId).then(
      (loaded) => {
        if (cancelled) {
          return;
        }
        apply(loaded);
        setLoading(false);
        if (loaded.paypal.captureStatus === "PENDING" && loaded.status === "ordered") {
          setPending(true);
          setMessage(COPY.pending);
          setMessageRole("status");
        }
      },
      (caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(isApiError(caught) ? caught.message : "Checkout could not be loaded.");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // apply is recreated each render; the load is keyed by the quote id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const timer = window.setInterval(() => {
      void getQuote(quoteId).then((loaded) => {
        apply(loaded);
        if (loaded.status === "captured") {
          go(`#/receipt/${loaded.id}`);
        }
        if (loaded.status === "failed") {
          setPending(false);
          setMessage(loaded.failure?.message ?? "The sandbox payment failed.");
          setMessageRole("alert");
        }
      });
    }, timing.pendingPollMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, quoteId]);

  function onNotice(notice: CheckoutNotice) {
    if (notice.type === "ordered" || notice.type === "pending" || notice.type === "declined") {
      apply(notice.quote);
    }
    if ((notice.type === "instrument" || notice.type === "cancelled") && notice.quote) {
      apply(notice.quote);
    }
    if ((notice.type === "instrument" || notice.type === "cancelled") && !notice.quote) {
      void getQuote(quoteId).then(apply);
    }
    if (notice.type === "captured") {
      apply(notice.quote);
      go(`#/receipt/${notice.quote.id}`);
      return;
    }
    if (notice.type === "already") {
      setMessage(notice.message);
      setMessageRole("status");
      go(`#/receipt/${quoteId}`);
      return;
    }
    if (notice.type === "pending") {
      setPending(true);
      setMessage(COPY.pending);
      setMessageRole("status");
      return;
    }
    if (notice.type === "cancelled") {
      setPending(false);
      setMessage(notice.message);
      setMessageRole("status");
      return;
    }
    if (notice.type === "instrument" || notice.type === "declined" || notice.type === "error") {
      setPending(false);
      setMessage(notice.message);
      setMessageRole("alert");
    }
  }

  const canPay =
    !!quote &&
    quote.pricingComplete &&
    !pending &&
    (quote.status === "accepted" ||
      quote.status === "ordered" ||
      (quote.status === "failed" && quote.failure?.retryable === true));

  return (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>Sandbox checkout</h1>
      {loading ? <Skeleton label="Loading checkout." /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {quote ? (
        <>
          <CheckoutSummary quote={quote} />
          {message ? <p role={messageRole}>{message}</p> : null}
          {quote.status === "draft" ? (
            <p>
              Accept the quote before paying.{" "}
              <a href={`#/quote/${encodeURIComponent(quote.id)}`}>Back to the quote</a>
            </p>
          ) : null}
          {quote.status === "expired" ? <p role="status">{COPY.expired}</p> : null}
          {quote.status === "captured" ? (
            <p>
              {COPY.alreadyPaid} <a href={`#/receipt/${encodeURIComponent(quote.id)}`}>{COPY.viewReceipt}</a>
            </p>
          ) : null}
          {canPay ? <PayPalButtonMount quote={quote} onNotice={onNotice} /> : null}
          <InvoiceOption quote={quote} onQuote={apply} onAlreadyCaptured={() => onNotice({ type: "already", message: COPY.alreadyPaid })} />
          <SandboxBuyerHelp />
        </>
      ) : null}
    </main>
  );
}
