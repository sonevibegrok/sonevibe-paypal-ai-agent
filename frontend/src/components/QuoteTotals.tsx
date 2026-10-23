import type { Quote } from "@sonevibe/shared";
import { MoneyText } from "./MoneyText";

export function QuoteTotals({ quote }: { quote: Quote }) {
  return (
    <dl className="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>
          <MoneyText value={quote.subtotal} currency={quote.currency} />
        </dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd>
          <MoneyText value={quote.total} currency={quote.currency} />
        </dd>
      </div>
      <p className="meta">Totals are calculated by the server. This page does not send amounts.</p>
    </dl>
  );
}
