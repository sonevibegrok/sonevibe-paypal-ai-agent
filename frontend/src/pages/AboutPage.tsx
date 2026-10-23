import { useApp } from "../app-state";
import { MoneyText } from "../components/MoneyText";
import { PlaceholderValue } from "../components/PlaceholderValue";
import { COPY } from "../copy";

export function AboutPage() {
  const { config, health } = useApp();
  return (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>How it works</h1>
      <p>
        SoneVibe Services is a quote-and-pay assistant for research, security, and marketing work. Payments use the
        PayPal sandbox only. {COPY.sandboxBanner}
      </p>
      <h2>What you do</h2>
      <ol>
        <li>Describe the work in the chat. The assistant drafts a quote from the server catalog.</li>
        <li>Review the lines. Change quantities while the quote is still a draft.</li>
        <li>Choose Accept quote. That step does not move money.</li>
        <li>Approve the order in the PayPal sandbox, or ask for a sandbox invoice.</li>
        <li>The receipt appears only when the server says the quote is captured.</li>
      </ol>
      <h2>What stays on the server</h2>
      <ul>
        <li>Prices, totals, and the PayPal client secret.</li>
        <li>Order creation, capture, and invoices.</li>
        <li>The model key. The assistant cannot set a price or charge a card by itself.</li>
      </ul>
      <p>The browser sends quote ids, service ids, and quantities. It does not send amounts.</p>
      <h2>Catalog</h2>
      <p>Catalog {config.catalogVersion}. A null price is shown as TBD until it is configured.</p>
      <ul className="catalog">
        {config.services.map((service) => (
          <li key={service.id}>
            <strong>
              <PlaceholderValue value={service.name} />
            </strong>
            <span>
              {" "}
              · {service.category} · <PlaceholderValue value={service.unit} /> ·{" "}
              <MoneyText value={service.price} currency={config.currency} />
            </span>
          </li>
        ))}
      </ul>
      {config.terms ? <p>{config.terms}</p> : <p>Terms have not been supplied yet.</p>}
      <h2>Try it</h2>
      <p>
        Local mock mode needs no backend: set <code>VITE_USE_MOCK=true</code> in <code>.env.development.local</code> and
        run <code>npm run dev</code>. Mock mode is for development only, not for a production build, the demo video, or
        judging.
      </p>
      <p>
        With the backend running, leave mock mode off. This screen stays closed unless health reports sandbox
        {health.environment === "sandbox" ? " (it does right now)." : "."}
      </p>
      <p>
        PayPal checkout loads the JavaScript SDK v6 from the sandbox. Use a PayPal sandbox buyer when the PayPal
        window opens. Live logins are not accepted by this app.
      </p>
      <p>
        If the demo host is asleep, the first view says it is waking the server and retries the health check.
      </p>
    </main>
  );
}
