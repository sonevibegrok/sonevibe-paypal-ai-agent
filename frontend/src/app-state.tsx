import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { AppConfig, Health, Quote } from "@sonevibe/shared";
import { shouldUseMockCheckout } from "./paypal/sdk";
import { getSessionId, setActiveQuoteId } from "./session";

type AppState = {
  health: Health;
  config: AppConfig;
  mockCheckout: boolean;
  sessionId: string;
  quote: Quote | null;
  setQuote: (quote: Quote | null) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppStateProvider({
  health,
  config,
  children,
}: {
  health: Health;
  config: AppConfig;
  children: ReactNode;
}) {
  const [quote, setQuoteState] = useState<Quote | null>(null);
  const mockCheckout = shouldUseMockCheckout({
    dev: import.meta.env.DEV,
    useMock: import.meta.env.VITE_USE_MOCK,
  });

  const setQuote = useCallback((next: Quote | null) => {
    setQuoteState(next);
    setActiveQuoteId(next?.id ?? null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        health,
        config,
        mockCheckout,
        sessionId: getSessionId(),
        quote,
        setQuote,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useApp must be used inside AppStateProvider");
  }
  return value;
}
