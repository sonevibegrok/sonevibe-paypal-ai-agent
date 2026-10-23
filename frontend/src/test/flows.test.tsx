import { QuoteSchema } from "@sonevibe/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { ServerWakeGate } from "../components/ServerWakeGate";
import { apiUrl } from "../api/client";
import { COPY } from "../copy";
import { seedQuote, setArtificialDelay, traffic } from "../mocks/store";
import { getSessionId } from "../session";
import { timing } from "../timing";
import capturedFixture from "../../../shared/fixtures/quote.captured.json";
import expiredFixture from "../../../shared/fixtures/quote.expired.json";
import orderedFixture from "../../../shared/fixtures/quote.ordered.json";
import alreadyCaptured from "../../../shared/fixtures/error.ALREADY_CAPTURED.json";
import healthMock from "../../../shared/fixtures/health.mock.json";
import configMock from "../../../shared/fixtures/config.mock.json";
import { server } from "./setup";

function renderApp(hash = "#/") {
  window.location.hash = hash;
  window.dispatchEvent(new Event("hashchange"));
  return render(<App />);
}

async function sendChat(user: ReturnType<typeof userEvent.setup>, message: string) {
  await screen.findByRole("heading", { name: "Chat with the assistant" });
  if (message === "I need a security review") {
    await user.click(screen.getByRole("button", { name: message }));
    return;
  }
  await user.type(screen.getByLabelText(COPY.messageLabel), message);
  await user.click(screen.getByRole("button", { name: COPY.send }));
}

async function reviewAndAccept(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("link", { name: COPY.reviewQuote }));
  await screen.findByRole("heading", { name: "Review quote" });
  await user.click(screen.getByRole("button", { name: COPY.accept }));
  await user.click(await screen.findByRole("link", { name: COPY.continueCheckout }));
  await screen.findByRole("heading", { name: "Sandbox checkout" });
}

describe("sandbox shell", () => {
  it("shows the sandbox and mock banners and does not offer a way to dismiss them", async () => {
    renderApp();
    expect(await screen.findByText(COPY.sandboxBanner)).toBeInTheDocument();
    expect(screen.getByText(COPY.mockBanner)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss|close banner/i })).not.toBeInTheDocument();
  });

  it("refuses to run when health is not sandbox", async () => {
    server.use(
      http.get(apiUrl("/health"), () =>
        HttpResponse.json({ ...healthMock, environment: "live", mock: false }),
      ),
    );
    renderApp();
    expect(await screen.findByText(COPY.notSandboxCode)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: COPY.notSandboxTitle })).toBeInTheDocument();
    expect(screen.queryByLabelText(COPY.messageLabel)).not.toBeInTheDocument();
    expect(screen.getByText(COPY.sandboxBanner)).toBeInTheDocument();
  });

  it("shows a waking state and then the chat", async () => {
    timing.wakeBaseMs = 20;
    let calls = 0;
    server.use(
      http.get(apiUrl("/health"), () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.error();
        }
        return HttpResponse.json(healthMock);
      }),
    );
    renderApp();
    expect(await screen.findByRole("heading", { name: COPY.waking })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Chat with the assistant" })).toBeInTheDocument();
  });

  it("keeps the mock banner when the dev flag is on, even if health.mock is false", async () => {
    server.use(http.get(apiUrl("/health"), () => HttpResponse.json({ ...healthMock, mock: false })));
    renderApp();
    await screen.findByRole("heading", { name: "Chat with the assistant" });
    expect(screen.getByText(COPY.mockBanner)).toBeInTheDocument();
    expect(screen.getByText(COPY.sandboxBanner)).toBeInTheDocument();
  });

  it("hides the mock banner when the dev flag is off and health is not mock", async () => {
    server.use(http.get(apiUrl("/health"), () => HttpResponse.json({ ...healthMock, mock: false })));
    render(
      <ServerWakeGate envMock={false} production={false}>
        {() => <h1>Chat with the assistant</h1>}
      </ServerWakeGate>,
    );
    await screen.findByRole("heading", { name: "Chat with the assistant" });
    expect(screen.queryByText(COPY.mockBanner)).not.toBeInTheDocument();
    expect(screen.getByText(COPY.sandboxBanner)).toBeInTheDocument();
  });

  it("closes a production build when health reports mock mode", async () => {
    render(
      <ServerWakeGate envMock={false} production>
        {() => <p>app-ready</p>}
      </ServerWakeGate>,
    );
    expect(await screen.findByRole("heading", { name: COPY.mockBlockedTitle })).toBeInTheDocument();
    expect(screen.getByText(COPY.mockBlockedCode)).toBeInTheDocument();
    expect(screen.queryByText("app-ready")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: COPY.approveMock })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(COPY.messageLabel)).not.toBeInTheDocument();
  });

  it("closes a production build when the PayPal client id is MOCK", async () => {
    server.use(http.get(apiUrl("/health"), () => HttpResponse.json({ ...healthMock, mock: false })));
    render(
      <ServerWakeGate envMock={false} production>
        {() => <p>app-ready</p>}
      </ServerWakeGate>,
    );
    expect(await screen.findByRole("heading", { name: COPY.mockBlockedTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: COPY.approveMock })).not.toBeInTheDocument();
    expect(screen.queryByText("app-ready")).not.toBeInTheDocument();
  });

  it("opens a production build when the server is a non-mock sandbox", async () => {
    server.use(
      http.get(apiUrl("/health"), () => HttpResponse.json({ ...healthMock, mock: false })),
      http.get(apiUrl("/config"), () => HttpResponse.json({ ...configMock, paypalClientId: "sb-client" })),
    );
    render(
      <ServerWakeGate envMock={false} production>
        {() => <p>app-ready</p>}
      </ServerWakeGate>,
    );
    expect(await screen.findByText("app-ready")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: COPY.mockBlockedTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: COPY.approveMock })).not.toBeInTheDocument();
  });
});

describe("quote and checkout flow", () => {
  it("quotes, accepts, approves in mock mode, and shows a captured receipt", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "I need a security review");
    expect((await screen.findAllByText("MOCK Security review")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    await reviewAndAccept(user);
    expect(traffic.lastSessionHeader).toBe(getSessionId());
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByRole("heading", { name: "Sandbox receipt" })).toBeInTheDocument();
    expect(screen.getByText(COPY.receiptLabel)).toBeInTheDocument();
    expect(screen.getByText(COPY.paid)).toBeInTheDocument();
    expect(screen.getByText(/MOCK-ORDER-/)).toBeInTheDocument();
    expect(screen.getByText(/MOCK-CAPTURE-/)).toBeInTheDocument();
  });

  it("edits quantity without sending money fields", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "I need a security review");
    await user.click(await screen.findByRole("link", { name: COPY.reviewQuote }));
    await screen.findByRole("heading", { name: "Review quote" });
    await user.click(screen.getByRole("button", { name: "Increase quantity for MOCK Security review" }));
    await waitFor(() => expect(traffic.patches.length).toBeGreaterThan(0));
    const body = traffic.patches.at(-1) as { items: { serviceId: string; quantity: number }[] };
    expect(body).toEqual({ items: [{ serviceId: "svc_security_mock", quantity: 2 }] });
    expect(JSON.stringify(body)).not.toMatch(/unitPrice|lineTotal|subtotal|amount|"price"/);
    expect((await screen.findAllByText("$200.00")).length).toBeGreaterThan(0);
  });

  it("blocks accept and shows TBD when pricing is missing", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "research #placeholder");
    expect((await screen.findAllByText(COPY.placeholder)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(COPY.tbd).length).toBeGreaterThan(0);
    expect(screen.queryByText("$100.00")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: COPY.reviewQuote }));
    const accept = await screen.findByRole("button", { name: COPY.accept });
    expect(accept).toBeDisabled();
    expect(screen.getAllByText(COPY.pricing).length).toBeGreaterThan(0);
  });

  it("keeps an ordered quote and allows retry when PayPal is cancelled", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "I need a security review");
    await reviewAndAccept(user);
    await user.click(screen.getByRole("button", { name: COPY.cancelMock }));
    expect(await screen.findByText(COPY.cancelled)).toBeInTheDocument();
    expect(screen.getByText("Paying")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.approveMock })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByRole("heading", { name: "Sandbox receipt" })).toBeInTheDocument();
  });

  it("ignores a second click while approval is in flight", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "I need a security review");
    await reviewAndAccept(user);
    setArtificialDelay(300);
    const button = screen.getByRole("button", { name: COPY.approveMock });
    button.click();
    button.click();
    await waitFor(() => expect(traffic.orders).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(traffic.orders).toBe(1);
  });

  it("stays on checkout when the funding source is declined", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "security #declined");
    await reviewAndAccept(user);
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/funding source/i);
    expect(screen.getByRole("heading", { name: "Sandbox checkout" })).toBeInTheDocument();
    expect(screen.getByText("Paying")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.approveMock })).toBeEnabled();
  });

  it("shows pending and then the receipt", async () => {
    timing.pendingPollMs = 800;
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "security #pending");
    await reviewAndAccept(user);
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByText(COPY.pending)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Sandbox receipt" }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("shows a retryable failure when capture is declined", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "security #capturefail");
    await reviewAndAccept(user);
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.approveMock })).toBeEnabled();
  });

  it("reports PayPal sandbox as unavailable and lets the buyer retry", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "security #paypaldown");
    await reviewAndAccept(user);
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(screen.getByRole("button", { name: COPY.approveMock })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByRole("heading", { name: "Sandbox receipt" })).toBeInTheDocument();
  });

  it("opens the receipt when the server says the quote was already captured", async () => {
    const sessionId = getSessionId();
    const ordered = QuoteSchema.parse(orderedFixture);
    seedQuote(ordered, sessionId);
    let gets = 0;
    server.use(
      http.get(apiUrl(`/quotes/${ordered.id}`), () => {
        gets += 1;
        return HttpResponse.json(gets === 1 ? ordered : QuoteSchema.parse(capturedFixture));
      }),
      http.post(apiUrl(`/quotes/${ordered.id}/paypal-order`), () =>
        HttpResponse.json(alreadyCaptured, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp(`#/checkout/${ordered.id}`);
    await user.click(await screen.findByRole("button", { name: COPY.approveMock }));
    expect(await screen.findByRole("heading", { name: "Sandbox receipt" })).toBeInTheDocument();
    expect(screen.getByText(COPY.paid)).toBeInTheDocument();
  });

  it("does not render a receipt until the quote is captured", async () => {
    const sessionId = getSessionId();
    const ordered = QuoteSchema.parse(orderedFixture);
    seedQuote(ordered, sessionId);
    renderApp(`#/receipt/${ordered.id}`);
    expect(await screen.findByRole("heading", { name: "Receipt not available" })).toBeInTheDocument();
    expect(screen.queryByText(COPY.receiptLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(COPY.paid)).not.toBeInTheDocument();
  });

  it("shows an expired quote with a re-quote action", async () => {
    const sessionId = getSessionId();
    const expired = QuoteSchema.parse(expiredFixture);
    seedQuote(expired, sessionId);
    renderApp(`#/quote/${expired.id}`);
    expect(await screen.findByText(COPY.expired)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: COPY.requote })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: COPY.accept })).not.toBeInTheDocument();
  });

  it("sends on Enter and keeps Shift+Enter as a newline", async () => {
    const user = userEvent.setup();
    renderApp();
    const box = await screen.findByLabelText(COPY.messageLabel);
    await user.type(box, "hello{Shift>}{Enter}{/Shift}there");
    expect(box).toHaveValue("hello\nthere");
    await user.type(box, "{Enter}");
    expect(await screen.findByText(/Which do you need/)).toBeInTheDocument();
    expect(traffic.chats).toBe(1);
  });

  it("retries once when the assistant is rate limited", async () => {
    const user = userEvent.setup();
    renderApp();
    await sendChat(user, "hello #llm429");
    expect(await screen.findByText(COPY.busy)).toBeInTheDocument();
    expect(await screen.findByText(/Which do you need/, undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(traffic.chats).toBe(2);
  }, 12000);
});
