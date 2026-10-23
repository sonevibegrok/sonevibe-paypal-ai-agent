# SoneVibe services frontend

Quote and PayPal **sandbox** checkout for SoneVibe team services (research, security, marketing). Test payments only. No real money is charged. The browser never sends prices or amounts.

This package is the frontend. The backend lives in `backend/` and is owned separately. Shared request and response schemas are in `shared/`.

## Prerequisites

- Node.js 22.19 or newer
- npm 10

## Install

From the repository root:

```bash
npm install
```

## Mock mode (no backend)

Mock mode lets the screens run from `shared/fixtures` through [MSW](https://mswjs.io/). It does not call PayPal or a model. It is for `npm run dev` only. Do not use it for the demo video, judging, or a production build.

`frontend/.env.example` lists names only. Put local values in `frontend/.env.development.local` (gitignored). Vite loads that file for the dev server and does not load it for `vite build`.

```bash
cat > frontend/.env.development.local <<'EOF'
VITE_USE_MOCK=true
VITE_API_BASE=http://localhost:8787/api
EOF
npm run dev
```

Open http://localhost:5173 . The dev server listens on port 5173.

Do not put `VITE_USE_MOCK=true` in `frontend/.env`. Vite reads `.env` during `vite build` as well as `vite dev`. Every `vite build`, including `vite build --mode staging`, fails if `VITE_USE_MOCK` is `true` or if `VITE_API_BASE` is missing or not `https`. Those builds use the same CSP as `vite build` with no mode flag.

Mock checkout is available only when both `import.meta.env.DEV` and `VITE_USE_MOCK=true` are set. The **Approve (mock)** button then calls `POST /quotes/:id/paypal-order` and then `POST /quotes/:id/capture`. A production bundle does not register the mock worker. If that bundle sees `GET /api/health` with `"mock": true`, or `paypalClientId` equal to `MOCK`, it shows a blocked screen and does not render checkout.

While the dev flag is on, or when `GET /api/health` returns `"mock": true` in a dev session, a **MOCK MODE** banner is shown.

### Scenario triggers

Chat messages use a hash. Invoice emails use plus addressing, because an email address cannot contain `#`.

| Chat message | Invoice email | What the mock does |
|---|---|---|
| `#declined` | `sb-abc+declined@personal.example.com` | The next capture returns 422 `INSTRUMENT_DECLINED`. The quote stays `ordered`. |
| `#pending` | `sb-abc+pending@personal.example.com` | The next capture returns `PENDING` with a `MOCK-CAPTURE-NNNN` id. The next `GET /quotes/:id` returns `captured`. |
| `#capturefail` | `sb-abc+capturefail@personal.example.com` | The next capture returns `DECLINED` and the quote becomes `failed` (retryable). |
| `#paypaldown` | `sb-abc+paypaldown@business.example.com` | The next `paypal-order` returns 502 `PAYPAL_UNAVAILABLE`. |
| `#llm429` | chat only | The next chat call returns 429 `LLM_RATE_LIMITED` with `Retry-After`. |
| `#placeholder` | chat only | The quote uses the null-priced `svc_placeholder_mock` service. Accept returns `PRICING_NOT_CONFIGURED`. |

`+placeholder` is not an invoice trigger. The service is already chosen by the time an invoice is sent. The same sandbox domains work for both local parts: `personal.example.com` and `business.example.com`.

The mock agent is keyword-driven: `research`, `security`, or `marketing` drafts that service. The word `two` or `2` sets quantity 2. Anything else gets a clarifying question. Placeholder catalog rows show `[PLACEHOLDER]`. A null price shows `TBD`. The UI does not invent prices.

## With the backend

Leave `VITE_USE_MOCK` unset. For `npm run dev`, set `VITE_API_BASE` in `frontend/.env.development.local` to the API base, including the `/api` prefix (`http://localhost:8787/api` on a local server).

Any `vite build` requires `VITE_API_BASE` to be an absolute `https://` URL. There is no localhost fallback in that output. Example:

```bash
VITE_API_BASE=https://api.example.invalid/api npm run build
```

The app stays on the **NOT_SANDBOX** screen unless `GET /api/health` reports `environment` equal to `sandbox`. The PayPal sandbox client id is read from `GET /api/config`. The client secret and the model key stay on the server. They are not in this package.

If the host is asleep, the page shows "Waking up the demo server…" and retries `GET /api/health`.

Checkout loads the PayPal JS SDK v6 from `https://www.sandbox.paypal.com/web-sdk/v6/core`. `createOrder` returns `{ orderId }` from the backend and is passed to `session.start` without being awaited first, so the buyer tap still counts as the user gesture.

A receipt is rendered only when `GET /quotes/:id` returns `status` `captured`. Cancelling inside PayPal leaves the quote `ordered` and the pay button usable again.

`example.invalid` invoice links are clickable only in dev. A production build shows that URL as text. `https://www.sandbox.paypal.com` links stay clickable.

## Content Security Policy

The built `index.html` includes a Content-Security-Policy meta tag. The host must also send that policy as an HTTP response header. A meta tag cannot set `frame-ancestors`. The header should add `frame-ancestors 'none'`. Send `X-Frame-Options: DENY` as well.

Production `connect-src` is `'self'`, the origin of `VITE_API_BASE`, `https://www.sandbox.paypal.com`, and `https://api-m.sandbox.paypal.com`. The sandbox JS SDK v6 calls `https://api-m.sandbox.paypal.com/v2/payments/find-eligible-methods` from the browser, so that host stays in `connect-src`. `https://www.paypal.com` is not included. The sandbox script only mentions it in an error string that says the SDK must be loaded from `www.paypal.com` or `www.sandbox.paypal.com`. This app loads `https://www.sandbox.paypal.com/web-sdk/v6/core`.

Example header for an API origin of `https://api.example.invalid`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://www.sandbox.paypal.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.example.invalid https://www.sandbox.paypal.com https://api-m.sandbox.paypal.com; frame-src https://www.sandbox.paypal.com; img-src 'self' data: https://www.sandbox.paypal.com; font-src 'self' https://www.sandbox.paypal.com; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://www.sandbox.paypal.com; frame-ancestors 'none'
X-Frame-Options: DENY
```

## Scripts

Run these from `frontend/`, or from the repo root (the root scripts delegate here):

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run lint` | ESLint on `frontend/src` and `shared/src` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest component and flow tests |

## Accessibility

The layout is designed at 360px first. One `h1` per screen, visible focus, keyboard use on every control, 44px targets, and text that does not rely on color alone. Chat messages sit in a polite live region. Errors use `role="alert"`. `prefers-reduced-motion` turns off animation.

A fixed banner stays on every screen, including errors: "SANDBOX - test payments only. No real money is charged." It cannot be dismissed.

## Session

The browser stores a UUID v4 in `localStorage` under `sonevibe.sessionId`. Chat sends it as `sessionId`. Every `/quotes/*` call sends it as `X-Session-Id`.
