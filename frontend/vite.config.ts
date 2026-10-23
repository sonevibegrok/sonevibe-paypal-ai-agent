import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { contentSecurityPolicy, productionBuildError, resolveBuildEnv } from "./src/build-env.ts";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const DEV_API_BASE = "http://localhost:8787/api";

function sandboxCsp(command: string, env: Record<string, string>): Plugin {
  return {
    name: "sandbox-csp",
    transformIndexHtml(html) {
      const apiBase = command === "build" ? (env.VITE_API_BASE ?? "") : env.VITE_API_BASE || DEV_API_BASE;
      return html.replaceAll("__CSP__", contentSecurityPolicy(command, apiBase));
    },
  };
}

function devMockWorker(): Plugin {
  const workerPath = path.resolve(rootDir, "mock-public/mockServiceWorker.js");
  return {
    name: "dev-mock-worker",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/mockServiceWorker.js") {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(readFileSync(workerPath));
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = resolveBuildEnv(loadEnv(mode, rootDir, ""));
  const buildError = productionBuildError(command, env);
  if (buildError) {
    throw new Error(buildError);
  }
  return {
    plugins: [react(), sandboxCsp(command, env), devMockWorker()],
    resolve: {
      alias: {
        "@sonevibe/shared": path.resolve(rootDir, "../shared/src/index.ts"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
      env: {
        VITE_API_BASE: "http://localhost:8787/api",
        VITE_USE_MOCK: "true",
      },
    },
  };
});
