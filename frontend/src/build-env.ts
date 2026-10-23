const PAYPAL_SANDBOX_PAGE = "https://www.sandbox.paypal.com";
const PAYPAL_SANDBOX_API = "https://api-m.sandbox.paypal.com";

export function resolveBuildEnv(fileEnv: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = { ...fileEnv };
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && key.startsWith("VITE_")) {
      merged[key] = value;
    }
  }
  return merged;
}

export function productionBuildError(command: string, env: Record<string, string | undefined>): string | null {
  if (command !== "build") {
    return null;
  }
  if (env.VITE_USE_MOCK === "true") {
    return "Production build refused: VITE_USE_MOCK must not be true.";
  }
  const apiBase = env.VITE_API_BASE?.trim() ?? "";
  if (!apiBase.startsWith("https://")) {
    return "Production build refused: VITE_API_BASE must be set to an https URL.";
  }
  try {
    const url = new URL(apiBase);
    if (url.protocol !== "https:") {
      return "Production build refused: VITE_API_BASE must be set to an https URL.";
    }
  } catch {
    return "Production build refused: VITE_API_BASE must be set to an https URL.";
  }
  return null;
}

export function contentSecurityPolicy(command: string, apiBase: string): string {
  const dev = command !== "build";
  const apiOrigin = new URL(apiBase).origin;
  const scriptSrc = ["'self'", PAYPAL_SANDBOX_PAGE, dev ? "'unsafe-inline'" : ""].filter(Boolean).join(" ");
  const connectSrc = [
    "'self'",
    apiOrigin,
    PAYPAL_SANDBOX_PAGE,
    PAYPAL_SANDBOX_API,
    dev ? "ws:" : "",
    dev ? "http://localhost:5173" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc}`,
    `frame-src ${PAYPAL_SANDBOX_PAGE}`,
    `img-src 'self' data: ${PAYPAL_SANDBOX_PAGE}`,
    `font-src 'self' ${PAYPAL_SANDBOX_PAGE}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${PAYPAL_SANDBOX_PAGE}`,
  ].join("; ");
}
