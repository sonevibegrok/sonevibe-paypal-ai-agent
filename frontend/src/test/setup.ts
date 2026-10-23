import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "../mocks/handlers";
import { resetMockStore } from "../mocks/store";
import { timing } from "../timing";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockStore();
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#/";
  timing.wakeBaseMs = 800;
  timing.wakeMaxMs = 8000;
  timing.pendingPollMs = 3000;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("1024"),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

Element.prototype.scrollIntoView = () => {};

export { server };
