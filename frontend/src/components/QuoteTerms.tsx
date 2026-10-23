import { COPY } from "../copy";

export function QuoteTerms({ terms }: { terms: string | null }) {
  return (
    <section className="terms" aria-label="Terms">
      <h2>Terms</h2>
      <p>{COPY.sandboxBanner}</p>
      {terms ? <p>{terms}</p> : <p>Terms have not been supplied yet.</p>}
    </section>
  );
}
