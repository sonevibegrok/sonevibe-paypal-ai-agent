import {
  ChatRequestSchema,
  ChatResponseSchema,
  ConfigSchema,
  ERROR_HTTP_STATUS,
  EmptyBodySchema,
  ErrorEnvelopeSchema,
  HealthSchema,
  InvoiceRequestSchema,
  PatchQuoteRequestSchema,
  QuoteSchema,
  CaptureRequestSchema,
  type ChatResponse,
  type ErrorCode,
  type Quote,
  type Service,
} from "@sonevibe/shared";
import configMockJson from "../../../shared/fixtures/config.mock.json";
import healthMockJson from "../../../shared/fixtures/health.mock.json";
import clarifyJson from "../../../shared/fixtures/chat.clarify.json";

const errorFiles = import.meta.glob("../../../shared/fixtures/error.*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

export const healthMock = HealthSchema.parse(healthMockJson);
export const configMock = ConfigSchema.parse(configMockJson);
const clarifyResponse = ChatResponseSchema.parse(clarifyJson);

const errorFixtures = new Map<ErrorCode, ReturnType<typeof ErrorEnvelopeSchema.parse>>();
for (const [path, value] of Object.entries(errorFiles)) {
  const parsed = ErrorEnvelopeSchema.parse(value);
  errorFixtures.set(parsed.error.code, parsed);
  if (!path.endsWith(`error.${parsed.error.code}.json`)) {
    throw new Error(`Fixture filename does not match ${parsed.error.code}`);
  }
}

export type MockResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

type Row = { quote: Quote; sessionId: string };
type CaptureFlag = "declined" | "pending" | "capturefail";

const quotes = new Map<string, Row>();
const chatTimes = new Map<string, number[]>();
const idempotency = new Map<string, { body: string; result: MockResult }>();
const llm429Seen = new Set<string>();

let quoteSeq = 1;
let orderSeq = 1;
let captureSeq = 1;
let invoiceSeq = 1;
let nextCapture: CaptureFlag | null = null;
let nextOrderDown = false;
let pendingUpgradeId: string | null = null;

export const traffic = {
  orders: 0,
  captures: 0,
  patches: [] as unknown[],
  chats: 0,
  lastSessionHeader: null as string | null,
};

export let artificialDelayMs = 0;

export function setArtificialDelay(ms: number): void {
  artificialDelayMs = ms;
}

export function resetMockStore(): void {
  quotes.clear();
  chatTimes.clear();
  idempotency.clear();
  llm429Seen.clear();
  quoteSeq = 1;
  orderSeq = 1;
  captureSeq = 1;
  invoiceSeq = 1;
  nextCapture = null;
  nextOrderDown = false;
  pendingUpgradeId = null;
  artificialDelayMs = 0;
  traffic.orders = 0;
  traffic.captures = 0;
  traffic.patches = [];
  traffic.chats = 0;
  traffic.lastSessionHeader = null;
}

export function seedQuote(quote: Quote, sessionId: string): void {
  quotes.set(quote.id, { quote: structuredClone(quote), sessionId });
}

export async function maybeDelay(): Promise<void> {
  if (artificialDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, artificialDelayMs));
  }
}

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

function cents(value: string): number {
  const [dollars, fraction] = value.split(".");
  return Number(dollars) * 100 + Number(fraction);
}

function fromCents(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

function emptyPaypal(): Quote["paypal"] {
  return {
    orderId: null,
    orderStatus: null,
    captureId: null,
    captureStatus: null,
    invoiceId: null,
    invoiceStatus: null,
    payerViewUrl: null,
  };
}

function catalogService(serviceId: string): Service | undefined {
  return configMock.services.find((service) => service.id === serviceId);
}

function errorResult(code: ErrorCode, headers?: Record<string, string>): MockResult {
  const fixture = errorFixtures.get(code);
  if (!fixture) {
    throw new Error(`Missing error fixture ${code}`);
  }
  return {
    status: ERROR_HTTP_STATUS[code],
    body: structuredClone(fixture),
    headers,
  };
}

function rememberTriggers(text: string): void {
  if (text.includes("#declined")) {
    nextCapture = "declined";
  }
  if (text.includes("#capturefail")) {
    nextCapture = "capturefail";
  }
  if (text.includes("#pending")) {
    nextCapture = "pending";
  }
  if (text.includes("#paypaldown")) {
    nextOrderDown = true;
  }
}

function rememberEmailTriggers(localPart: string): void {
  const tags = localPart
    .split("+")
    .slice(1)
    .map((part) => part.split(".")[0]?.toLowerCase() ?? "");
  if (tags.includes("declined")) {
    nextCapture = "declined";
  }
  if (tags.includes("capturefail")) {
    nextCapture = "capturefail";
  }
  if (tags.includes("pending")) {
    nextCapture = "pending";
  }
  if (tags.includes("paypaldown")) {
    nextOrderDown = true;
  }
}

function wantsTwo(message: string): boolean {
  return /(^|\s)(2|two)(\s|$)/i.test(message);
}

function buildQuote(
  id: string,
  status: Quote["status"],
  lines: { serviceId: string; quantity: number }[],
  seed: Partial<Quote> & { createdAt?: string },
): Quote {
  const anyNull = lines.some((line) => catalogService(line.serviceId)?.price == null);
  const items = lines.map((line) => {
    const service = catalogService(line.serviceId);
    if (!service) {
      throw new Error(`Unknown service ${line.serviceId}`);
    }
    const unitPrice = anyNull ? null : service.price;
    const lineTotal =
      unitPrice === null ? null : fromCents(cents(unitPrice) * line.quantity);
    return {
      serviceId: service.id,
      category: service.category,
      name: service.name,
      unit: service.unit,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
    };
  });
  const now = isoNow();
  const total = anyNull
    ? null
    : fromCents(items.reduce((sum, item) => sum + cents(item.lineTotal ?? "0.00"), 0));
  return QuoteSchema.parse({
    id,
    status,
    currency: "USD",
    catalogVersion: configMock.catalogVersion,
    items,
    subtotal: total,
    total,
    pricingComplete: !anyNull,
    paymentMethod: seed.paymentMethod ?? null,
    expiresAt: seed.expiresAt ?? isoNow(configMock.quoteTtlHours * 60 * 60 * 1000),
    createdAt: seed.createdAt ?? now,
    updatedAt: seed.updatedAt ?? now,
    paypal: { ...emptyPaypal(), ...seed.paypal },
    failure: seed.failure ?? null,
    sandbox: true,
  });
}

function owned(quoteId: string, sessionId: string | null): { row: Row } | { result: MockResult } {
  if (!sessionId) {
    return { result: errorResult("SESSION_MISMATCH") };
  }
  const row = quotes.get(quoteId);
  if (!row) {
    return { result: errorResult("QUOTE_NOT_FOUND") };
  }
  if (row.sessionId !== sessionId) {
    return { result: errorResult("SESSION_MISMATCH") };
  }
  return { row };
}

function expireIfNeeded(row: Row): void {
  if (row.quote.status !== "draft" && row.quote.status !== "accepted") {
    return;
  }
  if (Date.parse(row.quote.expiresAt) <= Date.now()) {
    row.quote = { ...row.quote, status: "expired", updatedAt: isoNow() };
  }
}

function rateLimited(sessionId: string): boolean {
  const now = Date.now();
  const recent = (chatTimes.get(sessionId) ?? []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 20) {
    chatTimes.set(sessionId, recent);
    return true;
  }
  recent.push(now);
  chatTimes.set(sessionId, recent);
  return false;
}

function latestQuote(sessionId: string, quoteId?: string): Quote | null {
  if (quoteId) {
    const row = quotes.get(quoteId);
    if (row && row.sessionId === sessionId) {
      return row.quote;
    }
  }
  const ownedQuotes = [...quotes.values()].filter((row) => row.sessionId === sessionId);
  return ownedQuotes.at(-1)?.quote ?? null;
}

function chatOk(response: ChatResponse): MockResult {
  return { status: 200, body: ChatResponseSchema.parse(response) };
}

function serviceLines(message: string): { serviceId: string; quantity: number }[] | null {
  const quantity = wantsTwo(message) ? 2 : 1;
  if (message.includes("#placeholder")) {
    return [{ serviceId: "svc_placeholder_mock", quantity }];
  }
  const matched = [
    [/research/i, "svc_research_mock"],
    [/security/i, "svc_security_mock"],
    [/marketing/i, "svc_marketing_mock"],
  ] as const;
  const lines = matched
    .filter(([pattern]) => pattern.test(message))
    .map(([, serviceId]) => ({ serviceId, quantity }));
  return lines.length > 0 ? lines : null;
}

export function handleChat(payload: unknown): MockResult {
  const parsed = ChatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResult("VALIDATION_ERROR");
  }
  const { sessionId, message, quoteId } = parsed.data;
  if (rateLimited(sessionId)) {
    return errorResult("RATE_LIMITED", { "Retry-After": "3" });
  }
  if (message.includes("#llm429") && !llm429Seen.has(sessionId)) {
    llm429Seen.add(sessionId);
    return errorResult("LLM_RATE_LIMITED", { "Retry-After": "3" });
  }
  rememberTriggers(message);

  if (/\b(crypto|bitcoin|wallet)\b/i.test(message)) {
    return chatOk({
      reply: "I only quote SoneVibe services: research, security, and marketing.",
      quote: null,
      toolEvents: [{ type: "refused", label: "This assistant only quotes SoneVibe services" }],
    });
  }

  const lines = serviceLines(message);
  if (!lines) {
    const current = latestQuote(sessionId, quoteId);
    if (wantsTwo(message) && current?.status === "draft") {
      const updated = buildQuote(
        current.id,
        "draft",
        current.items.map((item) => ({ serviceId: item.serviceId, quantity: 2 })),
        { createdAt: current.createdAt, paypal: current.paypal, paymentMethod: current.paymentMethod },
      );
      quotes.set(current.id, { quote: updated, sessionId });
      return chatOk({
        reply: `Quantity is now **2** on each line.\n\n[Open the draft quote](#/quote/${updated.id})`,
        quote: updated,
        toolEvents: [{ type: "quote_updated", label: "Updated your quote" }],
      });
    }
    return { status: 200, body: structuredClone(clarifyResponse) };
  }

  const id = `q_mock_${pad(quoteSeq)}`;
  quoteSeq += 1;
  const created = buildQuote(id, "draft", lines, {});
  quotes.set(id, { quote: created, sessionId });
  const list = created.items.map((item) => `- ${item.name}`).join("\n");
  return chatOk({
    reply: `I drafted a quote.\n\n${list}\n\n[Open the draft quote](#/quote/${created.id})`,
    quote: created,
    toolEvents: [
      { type: "catalog_searched", label: "Checked the service catalog" },
      { type: "quote_created", label: "Prepared a draft quote" },
      ...(created.pricingComplete
        ? [{ type: "checkout_suggested" as const, label: "You can review and accept the quote" }]
        : []),
    ],
  });
}

export function handleGetQuote(quoteId: string, sessionId: string | null): MockResult {
  const access = owned(quoteId, sessionId);
  if ("result" in access) {
    return access.result;
  }
  if (pendingUpgradeId === quoteId) {
    pendingUpgradeId = null;
    const captureId = access.row.quote.paypal.captureId ?? `MOCK-CAPTURE-${pad(captureSeq)}`;
    if (!access.row.quote.paypal.captureId) {
      captureSeq += 1;
    }
    access.row.quote = QuoteSchema.parse({
      ...access.row.quote,
      status: "captured",
      paymentMethod: "paypal_order",
      updatedAt: isoNow(),
      failure: null,
      paypal: {
        ...access.row.quote.paypal,
        orderStatus: "COMPLETED",
        captureId,
        captureStatus: "COMPLETED",
      },
    });
  }
  expireIfNeeded(access.row);
  return { status: 200, body: access.row.quote };
}

export function handlePatchQuote(quoteId: string, sessionId: string | null, payload: unknown): MockResult {
  traffic.patches.push(payload);
  const access = owned(quoteId, sessionId);
  if ("result" in access) {
    return access.result;
  }
  expireIfNeeded(access.row);
  if (access.row.quote.status === "expired") {
    return errorResult("QUOTE_EXPIRED");
  }
  if (access.row.quote.status !== "draft") {
    return errorResult("QUOTE_NOT_EDITABLE");
  }
  const parsed = PatchQuoteRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResult("VALIDATION_ERROR");
  }
  if (parsed.data.items.some((item) => !catalogService(item.serviceId))) {
    return errorResult("VALIDATION_ERROR");
  }
  access.row.quote = buildQuote(access.row.quote.id, "draft", parsed.data.items, {
    createdAt: access.row.quote.createdAt,
  });
  return { status: 200, body: access.row.quote };
}

export function handleAccept(quoteId: string, sessionId: string | null): MockResult {
  const access = owned(quoteId, sessionId);
  if ("result" in access) {
    return access.result;
  }
  expireIfNeeded(access.row);
  if (access.row.quote.status === "expired") {
    return errorResult("QUOTE_EXPIRED");
  }
  if (access.row.quote.status !== "draft") {
    return errorResult("INVALID_QUOTE_STATE");
  }
  if (!access.row.quote.pricingComplete) {
    return errorResult("PRICING_NOT_CONFIGURED");
  }
  access.row.quote = {
    ...access.row.quote,
    status: "accepted",
    updatedAt: isoNow(),
  };
  return { status: 200, body: access.row.quote };
}

function withIdempotency(key: string | null, rawBody: string, produce: () => MockResult): MockResult {
  if (!key) {
    return produce();
  }
  const existing = idempotency.get(key);
  if (existing) {
    if (existing.body === rawBody) {
      return existing.result;
    }
    return errorResult("VALIDATION_ERROR");
  }
  const result = produce();
  idempotency.set(key, { body: rawBody, result });
  return result;
}

export function handlePayPalOrder(
  quoteId: string,
  sessionId: string | null,
  rawBody: string,
  idempotencyKey: string | null,
): MockResult {
  return withIdempotency(idempotencyKey, rawBody, () => {
    traffic.orders += 1;
    const access = owned(quoteId, sessionId);
    if ("result" in access) {
      return access.result;
    }
    const quote = access.row.quote;
    if (quote.status === "captured") {
      return errorResult("ALREADY_CAPTURED");
    }
    expireIfNeeded(access.row);
    if (access.row.quote.status === "expired") {
      return errorResult("QUOTE_EXPIRED");
    }
    if (!quote.pricingComplete) {
      return errorResult("PRICING_NOT_CONFIGURED");
    }
    const allowed =
      quote.status === "accepted" ||
      quote.status === "ordered" ||
      (quote.status === "failed" && quote.failure?.retryable === true);
    if (!allowed) {
      return errorResult("INVALID_QUOTE_STATE");
    }
    if (nextOrderDown) {
      nextOrderDown = false;
      return errorResult("PAYPAL_UNAVAILABLE");
    }
    const reusable =
      quote.status === "ordered" &&
      quote.paypal.orderId &&
      (quote.paypal.orderStatus === "CREATED" || quote.paypal.orderStatus === "APPROVED");
    const orderId = reusable ? quote.paypal.orderId! : `MOCK-ORDER-${pad(orderSeq++)}`;
    access.row.quote = QuoteSchema.parse({
      ...quote,
      status: "ordered",
      paymentMethod: "paypal_order",
      updatedAt: isoNow(),
      failure: null,
      paypal: {
        ...emptyPaypal(),
        orderId,
        orderStatus: reusable ? quote.paypal.orderStatus : "CREATED",
        invoiceId: quote.paypal.invoiceId,
        invoiceStatus: quote.paypal.invoiceStatus,
        payerViewUrl: quote.paypal.payerViewUrl,
      },
    });
    return { status: 200, body: { orderId, quote: access.row.quote } };
  });
}

export function handleCapture(
  quoteId: string,
  sessionId: string | null,
  payload: unknown,
  rawBody: string,
  idempotencyKey: string | null,
): MockResult {
  return withIdempotency(idempotencyKey, rawBody, () => {
    traffic.captures += 1;
    const access = owned(quoteId, sessionId);
    if ("result" in access) {
      return access.result;
    }
    const parsed = CaptureRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResult("VALIDATION_ERROR");
    }
    const quote = access.row.quote;
    if (quote.paypal.orderId && parsed.data.orderId !== quote.paypal.orderId) {
      return errorResult("ORDER_MISMATCH");
    }
    if (quote.status === "captured" && quote.paypal.captureId) {
      return {
        status: 200,
        body: { status: "COMPLETED", captureId: quote.paypal.captureId, quote },
      };
    }
    const flag = nextCapture;
    nextCapture = null;
    if (flag === "declined") {
      return errorResult("INSTRUMENT_DECLINED");
    }
    if (flag === "capturefail") {
      access.row.quote = QuoteSchema.parse({
        ...quote,
        status: "failed",
        paymentMethod: "paypal_order",
        updatedAt: isoNow(),
        failure: {
          code: "CAPTURE_FAILED",
          message: "The sandbox payment was declined. You can try another funding source.",
          retryable: true,
        },
        paypal: {
          ...quote.paypal,
          orderStatus: "APPROVED",
          captureId: null,
          captureStatus: "DECLINED",
        },
      });
      return { status: 200, body: { status: "DECLINED", captureId: null, quote: access.row.quote } };
    }
    if (flag === "pending") {
      const captureId = `MOCK-CAPTURE-${pad(captureSeq)}`;
      captureSeq += 1;
      access.row.quote = QuoteSchema.parse({
        ...quote,
        status: "ordered",
        paymentMethod: "paypal_order",
        updatedAt: isoNow(),
        failure: null,
        paypal: {
          ...quote.paypal,
          orderStatus: "APPROVED",
          captureId,
          captureStatus: "PENDING",
        },
      });
      pendingUpgradeId = quote.id;
      return { status: 200, body: { status: "PENDING", captureId, quote: access.row.quote } };
    }
    const captureId = `MOCK-CAPTURE-${pad(captureSeq)}`;
    captureSeq += 1;
    access.row.quote = QuoteSchema.parse({
      ...quote,
      status: "captured",
      paymentMethod: "paypal_order",
      updatedAt: isoNow(),
      failure: null,
      paypal: {
        ...quote.paypal,
        orderStatus: "COMPLETED",
        captureId,
        captureStatus: "COMPLETED",
      },
    });
    return { status: 200, body: { status: "COMPLETED", captureId, quote: access.row.quote } };
  });
}

export function handleInvoice(
  quoteId: string,
  sessionId: string | null,
  payload: unknown,
  rawBody: string,
  idempotencyKey: string | null,
): MockResult {
  return withIdempotency(idempotencyKey, rawBody, () => {
    const access = owned(quoteId, sessionId);
    if ("result" in access) {
      return access.result;
    }
    const parsed = InvoiceRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResult("VALIDATION_ERROR");
    }
    const email = parsed.data.email;
    const localPart = email.split("@")[0] ?? "";
    rememberEmailTriggers(localPart);
    if (!/^[^@\s]+@(personal|business)\.example\.com$/i.test(email)) {
      return errorResult("INVOICE_EMAIL_NOT_ALLOWED");
    }
    const quote = access.row.quote;
    if (quote.status === "captured") {
      return errorResult("ALREADY_CAPTURED");
    }
    if (!quote.pricingComplete) {
      return errorResult("PRICING_NOT_CONFIGURED");
    }
    if (quote.paypal.invoiceId && quote.status === "invoiced") {
      return {
        status: 200,
        body: {
          invoiceId: quote.paypal.invoiceId,
          status: quote.paypal.invoiceStatus ?? "SENT",
          payerViewUrl: quote.paypal.payerViewUrl,
          quote,
        },
      };
    }
    const orderBlocking =
      quote.status === "ordered" &&
      (quote.paypal.orderStatus === "APPROVED" || quote.paypal.orderStatus === "COMPLETED");
    const allowed =
      !orderBlocking &&
      (quote.status === "accepted" ||
        quote.status === "ordered" ||
        (quote.status === "failed" && quote.failure?.retryable === true));
    if (!allowed) {
      return errorResult("INVALID_QUOTE_STATE");
    }
    const invoiceId = `INV2-MOCK-${pad(invoiceSeq)}`;
    invoiceSeq += 1;
    const payerViewUrl = `https://example.invalid/mock-invoice/${invoiceId}`;
    access.row.quote = QuoteSchema.parse({
      ...quote,
      status: "invoiced",
      paymentMethod: "invoice",
      updatedAt: isoNow(),
      failure: null,
      paypal: {
        ...quote.paypal,
        invoiceId,
        invoiceStatus: "SENT",
        payerViewUrl,
      },
    });
    return {
      status: 200,
      body: { invoiceId, status: "SENT", payerViewUrl, quote: access.row.quote },
    };
  });
}

export function handleEmpty(payload: unknown): MockResult | null {
  if (EmptyBodySchema.safeParse(payload).success) {
    return null;
  }
  return errorResult("VALIDATION_ERROR");
}
