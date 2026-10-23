import { COPY } from "../copy";

export function NotSandboxScreen() {
  return (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>{COPY.notSandboxTitle}</h1>
      <p className="code-label">{COPY.notSandboxCode}</p>
      <p>
        This app only runs when the server reports a PayPal sandbox environment. Checkout is closed, and no
        payment was attempted.
      </p>
    </main>
  );
}
