import { useState } from "react";
import type { Quote } from "@sonevibe/shared";
import { COPY } from "../copy";
import { formatTimestamp } from "../format/money";
import { MoneyText } from "./MoneyText";
import { PlaceholderValue } from "./PlaceholderValue";
import { PrintButton } from "./PrintButton";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { StartNewQuote } from "./StartNewQuote";

function CopyId({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return (
      <div>
        <dt>{label}</dt>
        <dd>Not available</dd>
      </div>
    );
  }
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <code>{value}</code>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
              },
              () => setCopied(false),
            );
          }}
        >
          Copy {label}
        </button>
        {copied ? <span role="status">Copied.</span> : null}
      </dd>
    </div>
  );
}

export function ReceiptCard({ quote }: { quote: Quote }) {
  return (
    <article className="receipt">
      <p className="notice">{COPY.receiptLabel}</p>
      <div className="quote-head">
        <h2>Quote {quote.id}</h2>
        <QuoteStatusBadge status={quote.status} />
      </div>
      <dl className="receipt-ids">
        <CopyId label="PayPal order ID" value={quote.paypal.orderId} />
        <CopyId label="PayPal capture ID" value={quote.paypal.captureId} />
        <CopyId label="PayPal invoice ID" value={quote.paypal.invoiceId} />
      </dl>
      <p>
        Payment method: {quote.paymentMethod === "invoice" ? "Sandbox invoice" : "PayPal sandbox order"}
      </p>
      <ul className="summary-lines">
        {quote.items.map((item) => (
          <li key={item.serviceId}>
            <span>
              <PlaceholderValue value={item.name} /> × {item.quantity}
            </span>
            <MoneyText value={item.lineTotal} currency={quote.currency} />
          </li>
        ))}
      </ul>
      <p className="summary-total">
        Total <MoneyText value={quote.total} currency={quote.currency} /> {quote.currency}
      </p>
      <p className="meta">Updated {formatTimestamp(quote.updatedAt)} UTC</p>
      <div className="receipt-actions">
        <PrintButton />
        <StartNewQuote />
      </div>
    </article>
  );
}
