import { useEffect, useState, type ReactNode } from "react";
import type { AppConfig, Health } from "@sonevibe/shared";
import { getConfig, getHealth } from "../api/client";
import { isApiError } from "../api/errors";
import { AppStateProvider } from "../app-state";
import { COPY } from "../copy";
import { productionMockBlocked } from "../paypal/sdk";
import { timing } from "../timing";
import { ErrorBanner } from "./ErrorBanner";
import { MockBlockedScreen } from "./MockBlockedScreen";
import { MockModeBanner } from "./MockModeBanner";
import { NotSandboxScreen } from "./NotSandboxScreen";
import { SandboxBanner } from "./SandboxBanner";
import { Spinner } from "./Spinner";

type Phase =
  | { name: "checking" }
  | { name: "waking" }
  | { name: "blocked" }
  | { name: "mockBlocked" }
  | { name: "error"; message: string }
  | { name: "ready"; health: Health; config: AppConfig };

export function ServerWakeGate({
  envMock,
  production = import.meta.env.PROD,
  children,
}: {
  envMock: boolean;
  production?: boolean;
  children: (health: Health, config: AppConfig) => ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const controller = new AbortController();

    async function check(tryNumber: number) {
      try {
        const health = await getHealth(controller.signal);
        if (cancelled) {
          return;
        }
        if (health.environment !== "sandbox") {
          setPhase({ name: "blocked" });
          return;
        }
        const config = await getConfig(controller.signal);
        if (cancelled) {
          return;
        }
        if (config.environment !== "sandbox") {
          setPhase({ name: "blocked" });
          return;
        }
        if (
          productionMockBlocked({
            prod: production,
            healthMock: health.mock,
            clientId: config.paypalClientId,
          })
        ) {
          setPhase({ name: "mockBlocked" });
          return;
        }
        setPhase({ name: "ready", health, config });
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        const serverError = isApiError(error) && error.code !== "NETWORK";
        if (serverError) {
          setPhase({ name: "error", message: error.message });
          return;
        }
        setPhase({ name: "waking" });
        const wait = Math.min(timing.wakeMaxMs, timing.wakeBaseMs * 2 ** Math.max(0, tryNumber - 1));
        timer = window.setTimeout(() => void check(tryNumber + 1), wait);
      }
    }

    void check(1);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [attempt, production]);

  const showMock = envMock || (phase.name === "ready" && phase.health.mock);
  return (
    <div className="app-frame">
      <div className="banner-stack">
        <SandboxBanner />
        {showMock ? <MockModeBanner /> : null}
      </div>
      {phase.name === "checking" ? (
        <main id="main" className="page" tabIndex={-1}>
          <Spinner label="Checking the sandbox server." />
        </main>
      ) : null}
      {phase.name === "waking" ? (
        <main id="main" className="page" tabIndex={-1}>
          <h1 tabIndex={-1}>{COPY.waking}</h1>
          <p>The demo server may be asleep. This page will keep trying.</p>
          <Spinner label={COPY.waking} />
        </main>
      ) : null}
      {phase.name === "blocked" ? <NotSandboxScreen /> : null}
      {phase.name === "mockBlocked" ? <MockBlockedScreen /> : null}
      {phase.name === "error" ? (
        <main id="main" className="page" tabIndex={-1}>
          <h1 tabIndex={-1}>The sandbox server did not respond</h1>
          <ErrorBanner message={phase.message} onRetry={() => setAttempt((value) => value + 1)} />
        </main>
      ) : null}
      {phase.name === "ready" ? (
        <AppStateProvider health={phase.health} config={phase.config}>
          {children(phase.health, phase.config)}
        </AppStateProvider>
      ) : null}
    </div>
  );
}
