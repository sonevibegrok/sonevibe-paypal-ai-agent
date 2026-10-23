import type { QuoteStatus } from "@sonevibe/shared";
import { COPY } from "../copy";

const LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  accepted: "Accepted",
  ordered: "Paying",
  captured: COPY.paid,
  invoiced: "Invoice sent",
  failed: "Failed",
  expired: "Expired",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
