import { describe, expect, it } from "vitest";
import { assertNoMoneyFields } from "../api/guard";
import { formatMoney } from "../format/money";
import { isSafeInvoiceUrl, productionMockBlocked, shouldUseMockCheckout } from "../paypal/sdk";

describe("money display", () => {
  it("formats decimal strings and never invents a price", () => {
    expect(formatMoney(null)).toBe("TBD");
    expect(formatMoney("100.00")).toMatch(/\$100\.00/);
    expect(formatMoney("200.50")).toMatch(/\$200\.50/);
    expect(formatMoney("100")).toBe("TBD");
    expect(formatMoney("free")).toBe("TBD");
  });
});

describe("request guard", () => {
  it("rejects amount fields and allows service ids with quantities", () => {
    expect(() => assertNoMoneyFields({ items: [{ serviceId: "svc_security_mock", quantity: 2 }] })).not.toThrow();
    expect(() => assertNoMoneyFields({ items: [{ serviceId: "svc", quantity: 1, unitPrice: "10.00" }] })).toThrow(
      /Refusing to send/,
    );
    expect(() => assertNoMoneyFields({ total: "10.00" })).toThrow(/Refusing to send/);
    for (const key of ["value", "unit_amount", "currency_code", "discount"]) {
      expect(() => assertNoMoneyFields({ [key]: "10.00" })).toThrow(/Refusing to send/);
    }
  });
});

describe("sandbox checkout guards", () => {
  it("allows mock checkout only for a dev build with the env flag", () => {
    expect(shouldUseMockCheckout({ dev: true, useMock: "true" })).toBe(true);
    expect(shouldUseMockCheckout({ dev: false, useMock: "true" })).toBe(false);
    expect(shouldUseMockCheckout({ dev: true, useMock: "false" })).toBe(false);
    expect(shouldUseMockCheckout({ dev: true, useMock: undefined })).toBe(false);
  });

  it("blocks a production build when the server reports mock mode", () => {
    expect(productionMockBlocked({ prod: true, healthMock: true, clientId: "sb-client" })).toBe(true);
    expect(productionMockBlocked({ prod: true, healthMock: false, clientId: "MOCK" })).toBe(true);
    expect(productionMockBlocked({ prod: true, healthMock: false, clientId: "sb-client" })).toBe(false);
    expect(productionMockBlocked({ prod: false, healthMock: true, clientId: "MOCK" })).toBe(false);
  });

  it("only links sandbox invoice urls, and example.invalid only in dev", () => {
    expect(isSafeInvoiceUrl("https://www.sandbox.paypal.com/invoice/p/#ABC", false)).toBe(true);
    expect(isSafeInvoiceUrl("https://example.invalid/mock-invoice/INV2-MOCK-0001", true)).toBe(true);
    expect(isSafeInvoiceUrl("https://example.invalid/mock-invoice/INV2-MOCK-0001", false)).toBe(false);
    expect(isSafeInvoiceUrl("https://www.paypal.com/invoice/p/#ABC", true)).toBe(false);
    expect(isSafeInvoiceUrl("http://www.sandbox.paypal.com/invoice", true)).toBe(false);
    expect(isSafeInvoiceUrl("javascript:alert(1)", true)).toBe(false);
  });
});
