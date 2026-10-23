import { AppShell } from "../components/AppShell";
import { useRoute } from "../router-state";
import { AboutPage } from "./AboutPage";
import { ChatPage } from "./ChatPage";
import { CheckoutPage } from "./CheckoutPage";
import { QuotePage } from "./QuotePage";
import { ReceiptPage } from "./ReceiptPage";

export function Pages() {
  const route = useRoute();
  let page = (
    <main id="main" className="page" tabIndex={-1}>
      <h1 tabIndex={-1}>Page not found</h1>
      <p>
        <a href="#/">Back to chat</a>
      </p>
    </main>
  );
  if (route.name === "chat") {
    page = <ChatPage />;
  } else if (route.name === "about") {
    page = <AboutPage />;
  } else if (route.name === "quote") {
    page = <QuotePage key={route.quoteId} quoteId={route.quoteId} />;
  } else if (route.name === "checkout") {
    page = <CheckoutPage key={route.quoteId} quoteId={route.quoteId} />;
  } else if (route.name === "receipt") {
    page = <ReceiptPage key={route.quoteId} quoteId={route.quoteId} />;
  }
  return <AppShell>{page}</AppShell>;
}
