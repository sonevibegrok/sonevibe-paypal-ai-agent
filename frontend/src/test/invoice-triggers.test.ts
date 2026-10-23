import { ERROR_HTTP_STATUS, QuoteSchema } from "@sonevibe/shared";
import { describe, expect, it } from "vitest";
import { handleCapture, handleInvoice, handlePayPalOrder, resetMockStore, seedQuote } from "../mocks/store";
import acceptedFixture from "../../../shared/fixtures/quote.accepted.json";

const session = "11111111-1111-4111-8111-111111111111";

function seedAccepted(id = "q_mock_0001") {
  const quote = QuoteSchema.parse({ ...acceptedFixture, id });
  seedQuote(quote, session);
  return quote;
}

describe("invoice email triggers", () => {
  it("rejects a hash in the email and does not arm a capture trigger", () => {
    resetMockStore();
    const quote = seedAccepted();
    const email = "sb-abc#declined@personal.example.com";
    const result = handleInvoice(quote.id, session, { email }, JSON.stringify({ email }), "hash-email");
    expect(result.status).toBe(ERROR_HTTP_STATUS.VALIDATION_ERROR);
    expect((result.body as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    const capture = handleCapture(
      quote.id,
      session,
      { orderId: "MOCK-ORDER-0099" },
      JSON.stringify({ orderId: "MOCK-ORDER-0099" }),
      "cap-hash",
    );
    expect((capture.body as { status: string }).status).toBe("COMPLETED");
  });

  it("reads plus tags for declined, pending, and capturefail", () => {
    resetMockStore();
    const declined = seedAccepted("q_mock_0101");
    const declinedEmail = "sb-abc+declined@personal.example.com";
    expect(
      handleInvoice(declined.id, session, { email: declinedEmail }, JSON.stringify({ email: declinedEmail }), "inv-d")
        .status,
    ).toBe(200);
    const declinedCapture = handleCapture(
      declined.id,
      session,
      { orderId: "MOCK-ORDER-0101" },
      JSON.stringify({ orderId: "MOCK-ORDER-0101" }),
      "cap-d",
    );
    expect(declinedCapture.status).toBe(ERROR_HTTP_STATUS.INSTRUMENT_DECLINED);

    const pending = seedAccepted("q_mock_0102");
    const pendingEmail = "sb-abc+pending@business.example.com";
    handleInvoice(pending.id, session, { email: pendingEmail }, JSON.stringify({ email: pendingEmail }), "inv-p");
    const pendingCapture = handleCapture(
      pending.id,
      session,
      { orderId: "MOCK-ORDER-0102" },
      JSON.stringify({ orderId: "MOCK-ORDER-0102" }),
      "cap-p",
    );
    const pendingBody = pendingCapture.body as { status: string; captureId: string };
    expect(pendingBody.status).toBe("PENDING");
    expect(pendingBody.captureId).toMatch(/^MOCK-CAPTURE-\d{4}$/);

    const failed = seedAccepted("q_mock_0103");
    const failEmail = "sb-abc+capturefail@personal.example.com";
    handleInvoice(failed.id, session, { email: failEmail }, JSON.stringify({ email: failEmail }), "inv-f");
    const failCapture = handleCapture(
      failed.id,
      session,
      { orderId: "MOCK-ORDER-0103" },
      JSON.stringify({ orderId: "MOCK-ORDER-0103" }),
      "cap-f",
    );
    expect((failCapture.body as { status: string }).status).toBe("DECLINED");
  });

  it("arms paypaldown from a plus tag and ignores placeholder on an invoice", () => {
    resetMockStore();
    const first = seedAccepted("q_mock_0104");
    const second = seedAccepted("q_mock_0105");
    const email = "sb-abc+paypaldown@personal.example.com";
    expect(handleInvoice(first.id, session, { email }, JSON.stringify({ email }), "inv-down").status).toBe(200);
    const order = handlePayPalOrder(second.id, session, "{}", "order-down");
    expect(order.status).toBe(ERROR_HTTP_STATUS.PAYPAL_UNAVAILABLE);

    const placeholder = seedAccepted("q_mock_0106");
    const placeholderEmail = "sb-abc+placeholder@personal.example.com";
    expect(
      handleInvoice(
        placeholder.id,
        session,
        { email: placeholderEmail },
        JSON.stringify({ email: placeholderEmail }),
        "inv-ph",
      ).status,
    ).toBe(200);
    const capture = handleCapture(
      placeholder.id,
      session,
      { orderId: "MOCK-ORDER-0106" },
      JSON.stringify({ orderId: "MOCK-ORDER-0106" }),
      "cap-ph",
    );
    expect((capture.body as { status: string }).status).toBe("COMPLETED");
  });
});
