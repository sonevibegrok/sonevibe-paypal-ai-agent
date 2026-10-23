import { useEffect, useRef, useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { captureOrder, createPayPalOrder, newIdempotencyKey } from "../api/client";
import { isApiError } from "../api/errors";
import { COPY } from "../copy";
import { approveSandboxQuote, cancelSandboxQuote, type CheckoutNotice } from "../paypal/checkout";
import { loadPayPalSdk, type PaymentSession } from "../paypal/sdk";
import { useApp } from "../app-state";

export function PayPalButtonMount({
  quote,
  onNotice,
}: {
  quote: Quote;
  onNotice: (notice: CheckoutNotice) => void;
}) {
  const { config, mockCheckout } = useApp();
  const [busy, setBusy] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const quoteIdRef = useRef(quote.id);
  const onNoticeRef = useRef(onNotice);
  useEffect(() => {
    quoteIdRef.current = quote.id;
    onNoticeRef.current = onNotice;
  }, [onNotice, quote.id]);

  useEffect(() => {
    if (mockCheckout) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let cancelled = false;
    let button: HTMLElement | null = null;
    let session: PaymentSession | null = null;

    const createOrder = () => {
      return createPayPalOrder(quoteIdRef.current, newIdempotencyKey()).then((result) => {
        onNoticeRef.current({ type: "ordered", quote: result.quote });
        return { orderId: result.orderId };
      });
    };

    async function onClick() {
      if (!session || lock.current) {
        return;
      }
      lock.current = true;
      setBusy(true);
      try {
        const createOrderPromise = createOrder();
        await session.start({ presentationMode: "auto" }, createOrderPromise);
      } catch (error) {
        onNoticeRef.current({
          type: "error",
          message: isApiError(error) ? error.message : "PayPal sandbox could not start the checkout. Please try again.",
        });
      } finally {
        lock.current = false;
        setBusy(false);
      }
    }

    void (async () => {
      try {
        const paypal = await loadPayPalSdk();
        if (cancelled) {
          return;
        }
        const sdk = await paypal.createInstance({
          clientId: config.paypalClientId,
          components: ["paypal-payments"],
          pageType: "checkout",
        });
        const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
        if (cancelled) {
          return;
        }
        if (!methods.isEligible("paypal")) {
          setEligible(false);
          return;
        }
        session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async (data) => {
            try {
              const capture = await captureOrder(quoteIdRef.current, data.orderId, newIdempotencyKey());
              if (capture.status === "COMPLETED" || capture.quote.status === "captured") {
                onNoticeRef.current({ type: "captured", quote: capture.quote });
                return;
              }
              if (capture.status === "PENDING") {
                onNoticeRef.current({ type: "pending", quote: capture.quote });
                return;
              }
              onNoticeRef.current({
                type: "declined",
                quote: capture.quote,
                message: capture.quote.failure?.message ?? "The sandbox payment was declined.",
              });
            } catch (error) {
              if (isApiError(error) && error.code === "INSTRUMENT_DECLINED") {
                onNoticeRef.current({ type: "instrument", quote: null, message: COPY.instrumentDeclined });
                return;
              }
              if (isApiError(error) && error.code === "ALREADY_CAPTURED") {
                onNoticeRef.current({ type: "already", message: COPY.alreadyPaid });
                return;
              }
              const text = isApiError(error) ? error.message : "The sandbox payment could not be captured.";
              if (/INSTRUMENT_DECLINED/.test(text)) {
                onNoticeRef.current({ type: "instrument", quote: null, message: COPY.instrumentDeclined });
                return;
              }
              if (/ALREADY_CAPTURED|DUPLICATE_INVOICE/.test(text)) {
                onNoticeRef.current({ type: "already", message: COPY.alreadyPaid });
                return;
              }
              onNoticeRef.current({ type: "error", message: text });
            }
          },
          onCancel: () => {
            onNoticeRef.current({ type: "cancelled", quote: null, message: COPY.cancelled });
          },
          onError: (error) => {
            const text = error.message ?? "PayPal sandbox reported an error. Please try again.";
            if (error.code === "INSTRUMENT_DECLINED" || /INSTRUMENT_DECLINED/.test(text)) {
              onNoticeRef.current({ type: "instrument", quote: null, message: COPY.instrumentDeclined });
              return;
            }
            if (/ALREADY_CAPTURED|DUPLICATE_INVOICE/.test(`${error.code ?? ""} ${text}`)) {
              onNoticeRef.current({ type: "already", message: COPY.alreadyPaid });
              return;
            }
            onNoticeRef.current({ type: "error", message: text });
          },
        });
        if (session.hasReturned?.()) {
          await session.resume?.();
          return;
        }
        button = document.createElement("paypal-button");
        button.setAttribute("type", "pay");
        button.addEventListener("click", () => void onClick());
        container.appendChild(button);
        setEligible(true);
        setSdkFailed(false);
      } catch {
        if (!cancelled) {
          setSdkFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      button?.remove();
    };
  }, [attempt, config.paypalClientId, mockCheckout]);

  async function run(action: "approve" | "cancel") {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const notice = action === "approve" ? await approveSandboxQuote(quote.id) : await cancelSandboxQuote(quote.id);
      onNotice(notice);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (mockCheckout) {
    return (
      <div className="pay-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void run("approve")}
        >
          {COPY.approveMock}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run("cancel")}>
          {COPY.cancelMock}
        </button>
        {busy ? (
          <p className="visually-hidden" role="status">
            Payment in progress.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pay-actions">
      {sdkFailed ? (
        <div className="error-banner" role="alert">
          <p>{COPY.sdkFail}</p>
          <button type="button" className="btn btn-secondary" onClick={() => setAttempt((value) => value + 1)}>
            {COPY.retry}
          </button>
        </div>
      ) : null}
      {eligible === false ? (
        <p role="status">PayPal checkout is not available in this browser. You can send a sandbox invoice instead.</p>
      ) : null}
      {eligible === null && !sdkFailed ? <p role="status">Loading PayPal sandbox checkout.</p> : null}
      <div ref={containerRef} />
    </div>
  );
}
