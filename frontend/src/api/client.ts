import {
  CaptureResponseSchema,
  ChatResponseSchema,
  ConfigSchema,
  HealthSchema,
  InvoiceResponseSchema,
  PayPalOrderResponseSchema,
  QuoteSchema,
  type CaptureResponse,
  type ChatResponse,
  type AppConfig,
  type Health,
  type InvoiceResponse,
  type PayPalOrderResponse,
  type Quote,
} from "@sonevibe/shared";
import type { ZodType } from "zod";
import { ApiError, toApiError } from "./errors";
import { assertNoMoneyFields } from "./guard";
import { getSessionId } from "../session";

export function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE?.trim().replace(/\/$/, "") ?? "";
  if (import.meta.env.PROD) {
    if (!configured.startsWith("https://")) {
      throw new Error("VITE_API_BASE must be set to an https URL");
    }
    return configured;
  }
  return configured || "http://localhost:8787/api";
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  session?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

async function request<T>(path: string, schema: ZodType<T>, options: RequestOptions = {}): Promise<T> {
  if (options.body !== undefined) {
    assertNoMoneyFields(options.body);
  }
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.session) {
    headers.set("X-Session-Id", getSessionId());
  }
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: "omit",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError({
      message: "We could not reach the server. Please try again.",
      code: "NETWORK",
      retryable: true,
      status: 0,
    });
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError({
        message: "The server returned an unexpected response.",
        code: "UNEXPECTED_RESPONSE",
        retryable: true,
        status: response.status,
      });
    }
  }

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      message: "The server returned an unexpected response.",
      code: "UNEXPECTED_RESPONSE",
      retryable: true,
      status: response.status,
    });
  }
  return parsed.data;
}

export function getHealth(signal?: AbortSignal): Promise<Health> {
  return request("/health", HealthSchema, { signal });
}

export function getConfig(signal?: AbortSignal): Promise<AppConfig> {
  return request("/config", ConfigSchema, { signal });
}

export function postChat(input: {
  message: string;
  quoteId?: string;
  signal?: AbortSignal;
}): Promise<ChatResponse> {
  const body: { sessionId: string; message: string; quoteId?: string } = {
    sessionId: getSessionId(),
    message: input.message,
  };
  if (input.quoteId) {
    body.quoteId = input.quoteId;
  }
  return request("/chat", ChatResponseSchema, { method: "POST", body, signal: input.signal });
}

export function getQuote(quoteId: string, signal?: AbortSignal): Promise<Quote> {
  return request(`/quotes/${encodeURIComponent(quoteId)}`, QuoteSchema, { session: true, signal });
}

export function patchQuote(
  quoteId: string,
  items: { serviceId: string; quantity: number }[],
): Promise<Quote> {
  return request(`/quotes/${encodeURIComponent(quoteId)}`, QuoteSchema, {
    method: "PATCH",
    session: true,
    body: {
      items: items.map((item) => ({
        serviceId: item.serviceId,
        quantity: item.quantity,
      })),
    },
  });
}

export function acceptQuote(quoteId: string): Promise<Quote> {
  return request(`/quotes/${encodeURIComponent(quoteId)}/accept`, QuoteSchema, {
    method: "POST",
    session: true,
    body: {},
  });
}

export function createPayPalOrder(quoteId: string, idempotencyKey: string): Promise<PayPalOrderResponse> {
  return request(`/quotes/${encodeURIComponent(quoteId)}/paypal-order`, PayPalOrderResponseSchema, {
    method: "POST",
    session: true,
    idempotencyKey,
    body: {},
  });
}

export function captureOrder(
  quoteId: string,
  orderId: string,
  idempotencyKey: string,
): Promise<CaptureResponse> {
  return request(`/quotes/${encodeURIComponent(quoteId)}/capture`, CaptureResponseSchema, {
    method: "POST",
    session: true,
    idempotencyKey,
    body: { orderId },
  });
}

export function sendInvoice(
  quoteId: string,
  email: string,
  idempotencyKey: string,
): Promise<InvoiceResponse> {
  return request(`/quotes/${encodeURIComponent(quoteId)}/invoice`, InvoiceResponseSchema, {
    method: "POST",
    session: true,
    idempotencyKey,
    body: { email },
  });
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
