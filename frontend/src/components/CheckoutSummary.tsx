import type { Quote } from "@sonevibe/shared";
import { COPY } from "../copy";
import { MoneyText } from "./MoneyText";
import { PlaceholderValue } from "./PlaceholderValue";
import { QuoteStatusBadge } from "./QuoteStatusBadge";

export function CheckoutSummary({ quote }: { quote: Quote }) {
  return (
    <section className="summary" aria-label="Checkout summary">
      <div className="quote-head">
        <h2>Quote {quote.id}</h2>
        <QuoteStatusBadge status={quote.status} />
      </div>
      <p className="notice">{COPY.sandboxBanner}</p>
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
        Total <MoneyText value={quote.total} currency={quote.currency} />
      </p>
    </section>
  );
}
