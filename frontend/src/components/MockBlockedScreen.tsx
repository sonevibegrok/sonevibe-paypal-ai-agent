import { COPY } from "../copy";

export function MockBlockedScreen() {
  return (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>{COPY.mockBlockedTitle}</h1>
      <p className="code-label">{COPY.mockBlockedCode}</p>
      <p>{COPY.mockBlockedBody}</p>
    </main>
  );
}
