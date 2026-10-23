import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, productionBuildError } from "../build-env";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const vitePackageJson = require.resolve("vite/package.json");
const viteBin = path.join(path.dirname(vitePackageJson), "bin/vite.js");
const frontendDir = path.resolve(process.cwd());

async function runBuild(extra: Record<string, string>, args: string[] = ["build"]): Promise<{ code: number; output: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  delete env.VITE_USE_MOCK;
  delete env.VITE_API_BASE;
  Object.assign(env, extra);
  try {
    const result = await execFileAsync(process.execPath, [viteBin, ...args], {
      cwd: frontendDir,
      env,
    });
    return { code: 0, output: `${result.stdout}\n${result.stderr}` };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string; message?: string };
    return {
      code: typeof failed.code === "number" ? failed.code : 1,
      output: `${failed.stdout ?? ""}\n${failed.stderr ?? ""}\n${failed.message ?? ""}`,
    };
  }
}

describe("production build guards", () => {
  it("rejects mock mode and a non-https API base before packaging", () => {
    expect(productionBuildError("build", { VITE_USE_MOCK: "true", VITE_API_BASE: "https://api.example.invalid/api" })).toMatch(
      /VITE_USE_MOCK/,
    );
    expect(productionBuildError("build", { VITE_USE_MOCK: "false" })).toMatch(/https/);
    expect(productionBuildError("build", { VITE_API_BASE: "http://localhost:8787/api" })).toMatch(/https/);
    expect(productionBuildError("serve", { VITE_USE_MOCK: "true", VITE_API_BASE: "http://localhost:8787/api" })).toBe(
      null,
    );
    const policy = contentSecurityPolicy("build", "https://api.example.invalid/api");
    expect(policy).toContain("https://api.example.invalid");
    expect(policy).toContain("https://www.sandbox.paypal.com");
    expect(policy).toContain("https://api-m.sandbox.paypal.com");
    expect(policy).not.toContain("www.paypal.com");
    expect(policy).not.toContain("localhost");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(contentSecurityPolicy("serve", "http://localhost:8787/api")).toContain("http://localhost:8787");
  });

  it("fails a production build when mock mode is on", async () => {
    const result = await runBuild({
      VITE_USE_MOCK: "true",
      VITE_API_BASE: "https://api.example.invalid/api",
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/VITE_USE_MOCK/);
  }, 120_000);

  it("fails a production build without an https API base", async () => {
    const missing = await runBuild({ VITE_USE_MOCK: "false" });
    expect(missing.code).not.toBe(0);
    expect(missing.output).toMatch(/VITE_API_BASE/);

    const httpBase = await runBuild({
      VITE_USE_MOCK: "false",
      VITE_API_BASE: "http://localhost:8787/api",
    });
    expect(httpBase.code).not.toBe(0);
    expect(httpBase.output).toMatch(/https/);
  }, 120_000);

  it("builds a production bundle that does not ship the mock worker", async () => {
    const result = await runBuild({
      VITE_USE_MOCK: "false",
      VITE_API_BASE: "https://api.example.invalid/api",
    });
    expect(result.code, result.output).toBe(0);
    const html = readFileSync(path.join(frontendDir, "dist/index.html"), "utf8");
    expect(html).toContain("https://api.example.invalid");
    expect(html).toContain("https://www.sandbox.paypal.com");
    expect(html).toContain("https://api-m.sandbox.paypal.com");
    expect(html).not.toContain("www.paypal.com");
    expect(html).not.toContain("localhost");
    expect(existsSync(path.join(frontendDir, "dist/mockServiceWorker.js"))).toBe(false);
    const assets = readdirSync(path.join(frontendDir, "dist/assets")).filter((name) => name.endsWith(".js"));
    const source = assets.map((name) => readFileSync(path.join(frontendDir, "dist/assets", name), "utf8")).join("\n");
    expect(source).not.toContain("mockServiceWorker");
    expect(source).not.toContain("setupWorker");
    expect(source).not.toContain("http://localhost:8787");
    expect(readdirSync(path.join(frontendDir, "dist")).join(" ")).not.toContain(".map");
  }, 120_000);

  it("applies the same guard and CSP to vite build --mode staging", async () => {
    const mockOn = await runBuild(
      { VITE_USE_MOCK: "true", VITE_API_BASE: "https://api.example.invalid/api" },
      ["build", "--mode", "staging"],
    );
    expect(mockOn.code).not.toBe(0);
    expect(mockOn.output).toMatch(/VITE_USE_MOCK/);

    const httpBase = await runBuild(
      { VITE_USE_MOCK: "false", VITE_API_BASE: "http://localhost:8787/api" },
      ["build", "--mode", "staging"],
    );
    expect(httpBase.code).not.toBe(0);
    expect(httpBase.output).toMatch(/https/);

    const built = await runBuild(
      { VITE_USE_MOCK: "false", VITE_API_BASE: "https://api.example.invalid/api" },
      ["build", "--mode", "staging"],
    );
    expect(built.code, built.output).toBe(0);
    const html = readFileSync(path.join(frontendDir, "dist/index.html"), "utf8");
    expect(html).toContain("https://api.example.invalid");
    expect(html).toContain("https://www.sandbox.paypal.com");
    expect(html).toContain("https://api-m.sandbox.paypal.com");
    expect(html).not.toContain("localhost");
    expect(html).not.toContain("ws:");
    expect(html).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(existsSync(path.join(frontendDir, "dist/mockServiceWorker.js"))).toBe(false);
  }, 120_000);
});
