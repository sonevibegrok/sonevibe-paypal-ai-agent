import { useEffect, type ReactNode } from "react";
import { routeKey, useRoute } from "../router-state";

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  useEffect(() => {
    const heading = document.querySelector("h1");
    if (heading instanceof HTMLElement) {
      heading.focus();
    }
  }, [route]);

  const quoteId = route.name === "quote" || route.name === "checkout" || route.name === "receipt" ? route.quoteId : null;

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#/">
          SoneVibe
        </a>
        <nav aria-label="Primary">
          <a href="#/" aria-current={route.name === "chat" ? "page" : undefined}>
            Chat
          </a>
          {quoteId ? (
            <a href={`#/quote/${encodeURIComponent(quoteId)}`} aria-current={route.name === "quote" ? "page" : undefined}>
              Quote
            </a>
          ) : null}
          <a href="#/about" aria-current={route.name === "about" ? "page" : undefined}>
            How it works
          </a>
        </nav>
      </header>
      {children}
      <footer className="site-footer">
        <a href="https://github.com/sonevibegrok/sonevibe-paypal-ai-agent">Source</a>
        <a href="https://github.com/sonevibegrok/sonevibe-paypal-ai-agent/blob/main/LICENSE">MIT license</a>
        <a href="https://paypalaihackathon.devpost.com/">Built for the PayPal AI Hackathon</a>
      </footer>
      <span className="visually-hidden">{routeKey(route)}</span>
    </>
  );
}
