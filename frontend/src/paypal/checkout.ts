import type { Quote } from "@sonevibe/shared";
import { captureOrder, createPayPalOrder, newIdempotencyKey } from "../api/client";
import { isApiError } from "../api/errors";
import { COPY } from "../copy";

export type CheckoutNotice =
  | { type: "ordered"; quote: Quote }
  | { type: "captured"; quote: Quote }
  | { type: "pending"; quote: Quote }
  | { type: "declined"; quote: Quote; message: string }
  | { type: "instrument"; quote: Quote | null; message: string }
  | { type: "already"; message: string }
  | { type: "cancelled"; quote: Quote | null; message: string }
  | { type: "error"; message: string };

function messageFrom(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export async function approveSandboxQuote(quoteId: string): Promise<CheckoutNotice> {
  let ordered: Quote | null = null;
  try {
    const order = await createPayPalOrder(quoteId, newIdempotencyKey());
    ordered = order.quote;
    const capture = await captureOrder(quoteId, order.orderId, newIdempotencyKey());
    if (capture.status === "COMPLETED" || capture.quote.status === "captured") {
      return { type: "captured", quote: capture.quote };
    }
    if (capture.status === "PENDING") {
      return { type: "pending", quote: capture.quote };
    }
    return {
      type: "declined",
      quote: capture.quote,
      message: capture.quote.failure?.message ?? "The sandbox payment was declined.",
    };
  } catch (error) {
    if (isApiError(error) && error.code === "INSTRUMENT_DECLINED") {
      return { type: "instrument", quote: ordered, message: COPY.instrumentDeclined };
    }
    if (isApiError(error) && error.code === "ALREADY_CAPTURED") {
      return { type: "already", message: COPY.alreadyPaid };
    }
    return { type: "error", message: messageFrom(error) };
  }
}

export async function cancelSandboxQuote(quoteId: string): Promise<CheckoutNotice> {
  try {
    const order = await createPayPalOrder(quoteId, newIdempotencyKey());
    return { type: "cancelled", quote: order.quote, message: COPY.cancelled };
  } catch (error) {
    if (isApiError(error) && error.code === "ALREADY_CAPTURED") {
      return { type: "already", message: COPY.alreadyPaid };
    }
    return { type: "error", message: messageFrom(error) };
  }
}
