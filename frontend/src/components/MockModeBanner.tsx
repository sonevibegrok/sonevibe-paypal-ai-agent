import { COPY } from "../copy";

export function MockModeBanner() {
  return (
    <p className="mock-banner" role="status">
      {COPY.mockBanner}
    </p>
  );
}
