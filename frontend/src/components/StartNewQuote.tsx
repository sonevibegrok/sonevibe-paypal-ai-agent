import { setActiveQuoteId } from "../session";

export function StartNewQuote() {
  return (
    <a
      className="btn btn-primary"
      href="#/"
      onClick={() => {
        setActiveQuoteId(null);
      }}
    >
      Start a new quote
    </a>
  );
}
