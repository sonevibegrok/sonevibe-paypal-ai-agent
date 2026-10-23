import type { QuoteItem } from "@sonevibe/shared";
import { MoneyText } from "./MoneyText";
import { PlaceholderValue } from "./PlaceholderValue";

export function QuoteLineItem({
  item,
  currency,
  editable,
  disableRemove,
  busy,
  onQuantity,
  onRemove,
}: {
  item: QuoteItem;
  currency: string;
  editable: boolean;
  disableRemove: boolean;
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="line-item">
      <div>
        <p className="line-name">
          <PlaceholderValue value={item.name} />
        </p>
        <p className="meta">
          <PlaceholderValue value={item.unit} />
        </p>
      </div>
      <div className="stepper" role="group" aria-label={`Quantity for ${item.name}`}>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={`Decrease quantity for ${item.name}`}
          disabled={!editable || busy || item.quantity <= 1}
          onClick={() => onQuantity(item.quantity - 1)}
        >
          −
        </button>
        <span className="qty" aria-live="polite">
          {item.quantity}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={`Increase quantity for ${item.name}`}
          disabled={!editable || busy || item.quantity >= 99}
          onClick={() => onQuantity(item.quantity + 1)}
        >
          +
        </button>
      </div>
      <p className="line-price">
        <MoneyText value={item.lineTotal} currency={currency} />
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        aria-label={`Remove ${item.name}`}
        disabled={!editable || busy || disableRemove}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
