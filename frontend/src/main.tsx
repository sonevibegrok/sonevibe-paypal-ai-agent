import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

async function boot(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === "true") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker();
  }
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Missing #root");
  }
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
