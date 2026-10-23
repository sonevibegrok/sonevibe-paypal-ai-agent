import { http, HttpResponse } from "msw";
import { apiBase } from "../api/client";
import {
  configMock,
  handleAccept,
  handleCapture,
  handleChat,
  handleGetQuote,
  handleInvoice,
  handlePatchQuote,
  handlePayPalOrder,
  handleEmpty,
  healthMock,
  maybeDelay,
  traffic,
  type MockResult,
} from "./store";

function json(result: MockResult) {
  return HttpResponse.json(result.body as Record<string, unknown>, {
    status: result.status,
    headers: result.headers,
  });
}

async function readBody(request: Request): Promise<{ raw: string; payload: unknown }> {
  const raw = await request.text();
  if (!raw) {
    return { raw: "", payload: {} };
  }
  try {
    return { raw, payload: JSON.parse(raw) };
  } catch {
    return { raw, payload: null };
  }
}

export const handlers = [
  http.get(`${apiBase()}/health`, () => HttpResponse.json(healthMock)),
  http.get(`${apiBase()}/config`, () => HttpResponse.json(configMock)),
  http.post(`${apiBase()}/chat`, async ({ request }) => {
    traffic.chats += 1;
    const { payload } = await readBody(request);
    return json(handleChat(payload));
  }),
  http.get(`${apiBase()}/quotes/:quoteId`, ({ request, params }) => {
    traffic.lastSessionHeader = request.headers.get("X-Session-Id");
    return json(handleGetQuote(String(params.quoteId), request.headers.get("X-Session-Id")));
  }),
  http.patch(`${apiBase()}/quotes/:quoteId`, async ({ request, params }) => {
    traffic.lastSessionHeader = request.headers.get("X-Session-Id");
    const { payload } = await readBody(request);
    return json(handlePatchQuote(String(params.quoteId), request.headers.get("X-Session-Id"), payload));
  }),
  http.post(`${apiBase()}/quotes/:quoteId/accept`, async ({ request, params }) => {
    traffic.lastSessionHeader = request.headers.get("X-Session-Id");
    const { payload } = await readBody(request);
    const invalid = handleEmpty(payload);
    if (invalid) {
      return json(invalid);
    }
    return json(handleAccept(String(params.quoteId), request.headers.get("X-Session-Id")));
  }),
  http.post(`${apiBase()}/quotes/:quoteId/paypal-order`, async ({ request, params }) => {
    await maybeDelay();
    traffic.lastSessionHeader = request.headers.get("X-Session-Id");
    const { raw, payload } = await readBody(request);
    const invalid = handleEmpty(payload);
    if (invalid) {
      return json(invalid);
    }
    return json(
      handlePayPalOrder(
        String(params.quoteId),
        request.headers.get("X-Session-Id"),
        raw || "{}",
        request.headers.get("Idempotency-Key"),
      ),
    );
  }),
  http.post(`${apiBase()}/quotes/:quoteId/capture`, async ({ request, params }) => {
    await maybeDelay();
    traffic.lastSessionHeader = request.headers.get("X-Session-Id");
    const { raw, payload } = await readBody(request);
    return json(
      handleCapture(
        String(params.quoteId),
        request.headers.get("X-Session-Id"),
        payload,
        raw,
        request.headers.get("Idempotency-Key"),
      ),
    );
  }),
  http.post(`${apiBase()}/quotes/:quoteId/invoice`, async ({ request, params }) => {
    traffic.lastSessionHeader = request.headers.get("X-Session-Id");
    const { raw, payload } = await readBody(request);
    return json(
      handleInvoice(
        String(params.quoteId),
        request.headers.get("X-Session-Id"),
        payload,
        raw,
        request.headers.get("Idempotency-Key"),
      ),
    );
  }),
];
