import { formatMoney } from "../format/money";

export function MoneyText({ value, currency }: { value: string | null; currency: string }) {
  const text = formatMoney(value, currency);
  return <span className={value === null ? "tbd" : "money"}>{text}</span>;
}
