export function SandboxBuyerHelp() {
  return (
    <details className="help">
      <summary>How to pay with a sandbox test account</summary>
      <ol>
        <li>Use a PayPal sandbox personal buyer, not a live PayPal login.</li>
        <li>When the PayPal window opens, sign in with that sandbox buyer and approve the order.</li>
        <li>This page never marks a payment as paid unless the server reports the quote as captured.</li>
      </ol>
    </details>
  );
}
