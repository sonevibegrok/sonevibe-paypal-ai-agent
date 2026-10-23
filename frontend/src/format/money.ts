const MONEY = /^\d+\.\d{2}$/;

/** Display only. Never send the formatted string back to the server. */
export function formatMoney(value: string | null, currency = "USD"): string {
  if (value === null || !MONEY.test(value)) {
    return "TBD";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value));
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
