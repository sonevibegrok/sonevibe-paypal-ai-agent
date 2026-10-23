import { Component, type ReactNode } from "react";
import { ServerWakeGate } from "./components/ServerWakeGate";
import { Pages } from "./pages/Pages";

type BoundaryState = { failed: boolean };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main id="main" className="page" tabIndex={-1}>
          <h1>Something went wrong</h1>
          <p>Reload the page and try again. No payment was marked as paid.</p>
        </main>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const envMock = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === "true";
  return (
    <AppErrorBoundary>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ServerWakeGate envMock={envMock}>{() => <Pages />}</ServerWakeGate>
    </AppErrorBoundary>
  );
}
