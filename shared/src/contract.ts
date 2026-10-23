import { z } from "zod";

/**
 * API contract v1.1 (2026-10-23).
 * Backend must review this module together with shared/fixtures.
 * Money fields are decimal strings. Request schemas reject amount fields.
 * Chat scenario words stay hash triggers such as "#declined".
 * Invoice emails use plus addressing, such as sb-abc+declined@personal.example.com, because email() rejects "#".
 * captureId stays nullable and is a string whenever PayPal returned a capture id, including PENDING.
 */

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "SESSION_MISMATCH",
  "QUOTE_NOT_FOUND",
  "QUOTE_NOT_EDITABLE",
  "INVALID_QUOTE_STATE",
  "PRICING_NOT_CONFIGURED",
  "ALREADY_CAPTURED",
  "ORDER_MISMATCH",
  "QUOTE_EXPIRED",
  "INSTRUMENT_DECLINED",
  "INVOICE_EMAIL_NOT_ALLOWED",
  "RATE_LIMITED",
  "LLM_RATE_LIMITED",
  "LLM_UNAVAILABLE",
  "PAYPAL_UNAVAILABLE",
  "PAYPAL_ORDER_FAILED",
  "CAPTURE_FAILED",
  "INVOICE_FAILED",
  "INTERNAL_ERROR",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  SESSION_MISMATCH: 403,
  QUOTE_NOT_FOUND: 404,
  QUOTE_NOT_EDITABLE: 409,
  INVALID_QUOTE_STATE: 409,
  PRICING_NOT_CONFIGURED: 409,
  ALREADY_CAPTURED: 409,
  ORDER_MISMATCH: 409,
  QUOTE_EXPIRED: 410,
  INSTRUMENT_DECLINED: 422,
  INVOICE_EMAIL_NOT_ALLOWED: 422,
  RATE_LIMITED: 429,
  LLM_RATE_LIMITED: 429,
  LLM_UNAVAILABLE: 503,
  PAYPAL_UNAVAILABLE: 502,
  PAYPAL_ORDER_FAILED: 502,
  CAPTURE_FAILED: 502,
  INVOICE_FAILED: 502,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ErrorCode, number>;

export const ErrorBodySchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  requestId: z.string().min(1),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

export const ErrorEnvelopeSchema = z.object({
  error: ErrorBodySchema,
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export const MoneySchema = z.string().regex(/^\d+\.\d{2}$/);
export type Money = z.infer<typeof MoneySchema>;

export const IsoTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);

export const ServiceCategorySchema = z.enum(["research", "security", "marketing"]);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const QuoteStatusSchema = z.enum([
  "draft",
  "accepted",
  "ordered",
  "captured",
  "invoiced",
  "failed",
  "expired",
]);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

export const PaymentMethodSchema = z.enum(["paypal_order", "invoice"]).nullable();
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const OrderStatusSchema = z.enum(["CREATED", "APPROVED", "COMPLETED", "VOIDED"]).nullable();
export const CaptureStatusSchema = z.enum(["COMPLETED", "PENDING", "DECLINED"]).nullable();
export const InvoiceStatusSchema = z.enum(["SENT", "PAID", "CANCELLED"]).nullable();

export const QuoteItemSchema = z.object({
  serviceId: z.string().min(1),
  category: ServiceCategorySchema,
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  unitPrice: MoneySchema.nullable(),
  lineTotal: MoneySchema.nullable(),
});
export type QuoteItem = z.infer<typeof QuoteItemSchema>;

export const PaypalBlockSchema = z.object({
  orderId: z.string().nullable(),
  orderStatus: OrderStatusSchema,
  captureId: z.string().nullable(),
  captureStatus: CaptureStatusSchema,
  invoiceId: z.string().nullable(),
  invoiceStatus: InvoiceStatusSchema,
  payerViewUrl: z.string().nullable(),
});
export type PaypalBlock = z.infer<typeof PaypalBlockSchema>;

export const FailureSchema = z
  .object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    retryable: z.boolean(),
  })
  .nullable();
export type Failure = z.infer<typeof FailureSchema>;

function cents(value: string): number {
  const [dollars, fraction] = value.split(".");
  return Number(dollars) * 100 + Number(fraction);
}

export const QuoteSchema = z
  .object({
    id: z.string().min(1),
    status: QuoteStatusSchema,
    currency: z.literal("USD"),
    catalogVersion: z.string().min(1),
    items: z.array(QuoteItemSchema).min(1).max(10),
    subtotal: MoneySchema.nullable(),
    total: MoneySchema.nullable(),
    pricingComplete: z.boolean(),
    paymentMethod: PaymentMethodSchema,
    expiresAt: IsoTimestampSchema,
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
    paypal: PaypalBlockSchema,
    failure: FailureSchema,
    sandbox: z.literal(true),
  })
  .superRefine((quote, ctx) => {
    const ids = quote.items.map((item) => item.serviceId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "duplicate serviceId",
      });
    }

    const missingPrice = quote.items.some((item) => item.unitPrice === null);
    if (missingPrice) {
      if (quote.pricingComplete) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pricingComplete"],
          message: "pricingComplete must be false while any unitPrice is null",
        });
      }
      if (quote.subtotal !== null || quote.total !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["total"],
          message: "totals must be null while any price is null",
        });
      }
      if (quote.items.some((item) => item.lineTotal !== null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: "lineTotal must be null while any price is null",
        });
      }
      return;
    }

    if (!quote.pricingComplete || quote.subtotal === null || quote.total === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricingComplete"],
        message: "priced quotes need pricingComplete and totals",
      });
      return;
    }

    if (quote.subtotal !== quote.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "subtotal must equal total in v1",
      });
    }

    let sum = 0;
    for (const item of quote.items) {
      if (item.unitPrice === null || item.lineTotal === null) {
        continue;
      }
      const expected = cents(item.unitPrice) * item.quantity;
      if (cents(item.lineTotal) !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: "lineTotal must equal unitPrice times quantity",
        });
      }
      sum += cents(item.lineTotal);
    }
    if (cents(quote.total) !== sum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "total must equal the sum of line totals",
      });
    }
  });
export type Quote = z.infer<typeof QuoteSchema>;

export const HealthSchema = z.object({
  ok: z.boolean(),
  environment: z.string().min(1),
  version: z.string().min(1),
  mock: z.boolean(),
  llm: z.enum(["ready", "unavailable"]),
  webhooks: z.enum(["enabled", "polling"]),
});
export type Health = z.infer<typeof HealthSchema>;

export const ServiceSchema = z.object({
  id: z.string().min(1),
  category: ServiceCategorySchema,
  name: z.string().min(1),
  unit: z.string().min(1),
  price: MoneySchema.nullable(),
  description: z.string(),
  deliveryDays: z.number().int().nonnegative().nullable(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const ConfigSchema = z.object({
  paypalClientId: z.string().min(1),
  environment: z.string().min(1),
  currency: z.literal("USD"),
  catalogVersion: z.string().min(1),
  pricingComplete: z.boolean(),
  quoteTtlHours: z.number().int().positive(),
  terms: z.string().nullable(),
  services: z.array(ServiceSchema).min(1),
});
export type AppConfig = z.infer<typeof ConfigSchema>;

export const ToolEventTypeSchema = z.enum([
  "catalog_searched",
  "quote_created",
  "quote_updated",
  "paypal_lookup",
  "checkout_suggested",
  "refused",
]);
export type ToolEventType = z.infer<typeof ToolEventTypeSchema>;

export const ToolEventSchema = z.object({
  type: ToolEventTypeSchema,
  label: z.string().min(1),
});
export type ToolEvent = z.infer<typeof ToolEventSchema>;

export const ChatRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    message: z.string().min(1).max(2000),
    quoteId: z.string().min(1).optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  reply: z.string().min(1),
  quote: QuoteSchema.nullable(),
  toolEvents: z.array(ToolEventSchema),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const PatchQuoteItemSchema = z
  .object({
    serviceId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

export const PatchQuoteRequestSchema = z
  .object({
    items: z.array(PatchQuoteItemSchema).min(1).max(10),
  })
  .strict()
  .superRefine((body, ctx) => {
    const ids = body.items.map((item) => item.serviceId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "duplicate serviceId",
      });
    }
  });
export type PatchQuoteRequest = z.infer<typeof PatchQuoteRequestSchema>;

export const EmptyBodySchema = z.object({}).strict();

export const CaptureRequestSchema = z
  .object({
    orderId: z.string().min(1),
  })
  .strict();
export type CaptureRequest = z.infer<typeof CaptureRequestSchema>;

export const InvoiceRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();
export type InvoiceRequest = z.infer<typeof InvoiceRequestSchema>;

export const PayPalOrderResponseSchema = z.object({
  orderId: z.string().min(1),
  quote: QuoteSchema,
});
export type PayPalOrderResponse = z.infer<typeof PayPalOrderResponseSchema>;

export const CaptureResponseSchema = z.object({
  status: z.enum(["COMPLETED", "PENDING", "DECLINED"]),
  captureId: z.string().min(1).nullable(),
  quote: QuoteSchema,
});
export type CaptureResponse = z.infer<typeof CaptureResponseSchema>;

export const InvoiceResponseSchema = z.object({
  invoiceId: z.string().min(1),
  status: z.enum(["SENT", "PAID", "CANCELLED"]),
  payerViewUrl: z.string().min(1),
  quote: QuoteSchema,
});
export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;

export const SANDBOX_INVOICE_EMAIL = /^[^@\s]+@(personal|business)\.example\.com$/i;

export const SCENARIO_TRIGGERS = [
  "#declined",
  "#pending",
  "#capturefail",
  "#llm429",
  "#paypaldown",
  "#placeholder",
] as const;
export type ScenarioTrigger = (typeof SCENARIO_TRIGGERS)[number];
