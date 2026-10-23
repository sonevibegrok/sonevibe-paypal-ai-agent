import { useEffect, useRef, useState } from "react";
import { postChat } from "../api/client";
import { isApiError } from "../api/errors";
import { useApp } from "../app-state";
import { ChatComposer } from "../components/ChatComposer";
import { ChatThread, type ChatEntry } from "../components/ChatThread";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { QuoteDraftPanel } from "../components/QuoteDraftPanel";
import { SuggestedPrompts } from "../components/SuggestedPrompts";
import { COPY } from "../copy";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { consumePrefill, getActiveQuoteId } from "../session";
import { getQuote } from "../api/client";

export function ChatPage() {
  const { quote, setQuote } = useApp();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState(() => consumePrefill());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const sending = useRef(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const id = getActiveQuoteId();
    if (!id) {
      return;
    }
    let cancelled = false;
    void getQuote(id).then(
      (loaded) => {
        if (!cancelled) {
          setQuote(loaded);
        }
      },
      () => {
        if (!cancelled) {
          setQuote(null);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [setQuote]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const root = drawerRef.current;
    const closer = root?.querySelector<HTMLElement>("button");
    closer?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    const toggle = toggleRef.current;
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [drawerOpen]);

  async function send(text: string, echo = true, attempt = 0) {
    const trimmed = text.trim();
    if (!trimmed || sending.current) {
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    if (echo) {
      setEntries((current) => [...current, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    }
    try {
      const response = await postChat({ message: trimmed, quoteId: quote?.id });
      setEntries((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: response.reply,
          toolEvents: response.toolEvents,
        },
      ]);
      if (response.quote) {
        setQuote(response.quote);
      }
      setDraft("");
      setStatus(null);
    } catch (caught) {
      if (isApiError(caught) && caught.code === "LLM_RATE_LIMITED" && attempt === 0) {
        setStatus(COPY.busy);
        const seconds = caught.retryAfterSeconds ?? 3;
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000));
        sending.current = false;
        await send(trimmed, false, 1);
        return;
      }
      setDraft(trimmed);
      setError(isApiError(caught) ? caught.message : "We could not reach the server. Please try again.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const panel = quote ? (
    <QuoteDraftPanel quote={quote} editable onQuote={setQuote} showReviewLink />
  ) : (
    <EmptyState title="No quote yet" body="Ask for research, security, or marketing work to draft one." />
  );

  return (
    <main id="main" className="page" tabIndex={-1}>
      <div className="chat-layout">
        <section className="chat-column" aria-labelledby="chat-title">
          <h1 id="chat-title" tabIndex={-1}>
            Chat with the assistant
          </h1>
          <p>Tell the assistant what you need. It can draft a quote. It cannot charge you.</p>
          <ChatThread entries={entries} busy={busy} />
          {entries.length === 0 ? <SuggestedPrompts disabled={busy} onPick={(prompt) => void send(prompt)} /> : null}
          {status ? <p role="status">{status}</p> : null}
          {error ? <ErrorBanner message={error} onRetry={() => void send(draft, false)} /> : null}
          <ChatComposer value={draft} onChange={setDraft} disabled={busy} onSend={() => void send(draft)} />
        </section>
        {desktop ? (
          <aside className="quote-aside" aria-label="Quote draft">
            {panel}
          </aside>
        ) : (
          <>
            <button
              ref={toggleRef}
              type="button"
              className="btn btn-secondary drawer-toggle"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              {COPY.viewQuote}
            </button>
            {drawerOpen ? (
              <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
                <div
                  ref={drawerRef}
                  className="drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="quote-drawer-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="drawer-bar">
                    <h2 id="quote-drawer-title">Quote draft</h2>
                    <button type="button" className="btn btn-secondary" onClick={() => setDrawerOpen(false)}>
                      {COPY.closeQuote}
                    </button>
                  </div>
                  {panel}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
