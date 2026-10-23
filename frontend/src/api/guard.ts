const FORBIDDEN_KEYS = new Set([
  "amount",
  "amounts",
  "price",
  "unitPrice",
  "lineTotal",
  "subtotal",
  "total",
  "value",
  "unit_amount",
  "currency_code",
  "discount",
]);

export function assertNoMoneyFields(value: unknown, path = "body"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMoneyFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Refusing to send ${path}.${key}`);
    }
    assertNoMoneyFields(child, `${path}.${key}`);
  }
}
