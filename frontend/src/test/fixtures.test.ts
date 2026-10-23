import {
  CaptureResponseSchema,
  ChatResponseSchema,
  ConfigSchema,
  ERROR_CODES,
  ErrorEnvelopeSchema,
  HealthSchema,
  InvoiceResponseSchema,
  PayPalOrderResponseSchema,
  QuoteSchema,
} from "@sonevibe/shared";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

const files = import.meta.glob("../../../shared/fixtures/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const schemas: Record<string, ZodType> = {
  "health.json": HealthSchema,
  "health.mock.json": HealthSchema,
  "config.json": ConfigSchema,
  "config.mock.json": ConfigSchema,
  "chat.clarify.json": ChatResponseSchema,
  "chat.quote-created.json": ChatResponseSchema,
  "quote.draft.json": QuoteSchema,
  "quote.draft.placeholder.json": QuoteSchema,
  "quote.accepted.json": QuoteSchema,
  "quote.ordered.json": QuoteSchema,
  "quote.captured.json": QuoteSchema,
  "quote.invoiced.json": QuoteSchema,
  "quote.failed.json": QuoteSchema,
  "quote.expired.json": QuoteSchema,
  "paypal-order.json": PayPalOrderResponseSchema,
  "capture.completed.json": CaptureResponseSchema,
  "capture.pending.json": CaptureResponseSchema,
  "invoice.json": InvoiceResponseSchema,
};

for (const code of ERROR_CODES) {
  schemas[`error.${code}.json`] = ErrorEnvelopeSchema;
}

describe("shared fixtures", () => {
  it("has one fixture for every contract file and error code", () => {
    const names = Object.keys(files).map((path) => path.split("/").pop());
    for (const name of Object.keys(schemas)) {
      expect(names).toContain(name);
    }
  });

  it("uses mock quote ids and a pending capture id", () => {
    const draft = Object.entries(files).find(([path]) => path.endsWith("quote.draft.json"))?.[1] as { id: string };
    const pending = Object.entries(files).find(([path]) => path.endsWith("capture.pending.json"))?.[1] as {
      captureId: string;
      quote: { paypal: { captureId: string } };
    };
    expect(draft.id).toBe("q_mock_0007");
    expect(pending.captureId).toBe("MOCK-CAPTURE-0002");
    expect(pending.quote.paypal.captureId).toBe("MOCK-CAPTURE-0002");
  });

  it("validates every fixture against the contract schema", () => {
    for (const [path, value] of Object.entries(files)) {
      const name = path.split("/").pop() ?? path;
      const schema = schemas[name];
      expect(schema, name).toBeTruthy();
      expect(schema.safeParse(value).success, name).toBe(true);
    }
  });
});
