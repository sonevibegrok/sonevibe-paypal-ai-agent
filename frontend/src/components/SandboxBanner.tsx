import { COPY } from "../copy";

export function SandboxBanner() {
  return (
    <p className="sandbox-banner" role="status">
      {COPY.sandboxBanner}
    </p>
  );
}
