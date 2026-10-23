const SESSION_KEY = "sonevibe.sessionId";
const QUOTE_KEY = "sonevibe.activeQuoteId";
const PREFILL_KEY = "sonevibe.prefill";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memorySessionId: string | null = null;

export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && UUID_V4.test(existing)) {
      return existing;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}

export function getActiveQuoteId(): string | null {
  try {
    return sessionStorage.getItem(QUOTE_KEY);
  } catch {
    return null;
  }
}

export function setActiveQuoteId(quoteId: string | null): void {
  try {
    if (quoteId) {
      sessionStorage.setItem(QUOTE_KEY, quoteId);
    } else {
      sessionStorage.removeItem(QUOTE_KEY);
    }
  } catch {
    /* storage may be blocked; the in-memory quote still works for this view */
  }
}

export function setPrefill(text: string): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, text);
  } catch {
    /* ignore */
  }
}

export function consumePrefill(): string {
  try {
    const value = sessionStorage.getItem(PREFILL_KEY) ?? "";
    sessionStorage.removeItem(PREFILL_KEY);
    return value;
  } catch {
    return "";
  }
}
