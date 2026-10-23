export type Route =
  | { name: "chat" }
  | { name: "about" }
  | { name: "quote"; quoteId: string }
  | { name: "checkout"; quoteId: string }
  | { name: "receipt"; quoteId: string }
  | { name: "notfound" };

export function parseHash(hash: string): Route {
  const raw = (hash || "#/").replace(/^#/, "") || "/";
  const path = raw.split("?")[0] || "/";
  if (path === "/" || path === "") {
    return { name: "chat" };
  }
  if (path === "/about") {
    return { name: "about" };
  }
  const quote = path.match(/^\/quote\/([^/]+)$/);
  if (quote?.[1]) {
    return { name: "quote", quoteId: decodeURIComponent(quote[1]) };
  }
  const checkout = path.match(/^\/checkout\/([^/]+)$/);
  if (checkout?.[1]) {
    return { name: "checkout", quoteId: decodeURIComponent(checkout[1]) };
  }
  const receipt = path.match(/^\/receipt\/([^/]+)$/);
  if (receipt?.[1]) {
    return { name: "receipt", quoteId: decodeURIComponent(receipt[1]) };
  }
  return { name: "notfound" };
}

export function routeKey(route: Route): string {
  if (route.name === "quote" || route.name === "checkout" || route.name === "receipt") {
    return `${route.name}:${route.quoteId}`;
  }
  return route.name;
}

export function go(hash: string): void {
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (window.location.hash === next) {
    return;
  }
  window.location.hash = next;
}
