import { defineConfig, devices } from "@playwright/test";

/**
 * Two targets:
 * - Public pages (landing, performance) run against the production build,
 *   which is what real visitors get: `pnpm build`, then the server on :3100.
 * - Signed-in flows (organizer, member links) run against the dev server on
 *   :8080, which offers "Continue as local dev" sign-in.
 */
const PUBLIC_URL = process.env.E2E_PUBLIC_URL ?? "http://localhost:3100"; // guard:allow-env-credential — test runner setting, not a credential
const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:8080"; // guard:allow-env-credential — test runner setting, not a credential
// Bundled Chromium by default; set E2E_CHANNEL=msedge or chrome to use a system browser.
const ch = process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}; // guard:allow-env-credential — test runner setting, not a credential

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "e2e/.report/results.json" }], ["html", { open: "never", outputFolder: "e2e/.report/html" }]],
  outputDir: "e2e/.results",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "public-desktop", testMatch: /landing|perf/, use: { ...devices["Desktop Chrome"], ...ch, baseURL: PUBLIC_URL } },
    { name: "public-mobile", testMatch: /landing/, use: { ...devices["Pixel 7"], ...ch, baseURL: PUBLIC_URL } },
    { name: "app", testMatch: /app|member|api/, timeout: 600_000, use: { ...devices["Desktop Chrome"], ...ch, baseURL: APP_URL } },
  ],
  webServer: [
    {
      command: "pnpm build && node .output/server/index.mjs",
      url: PUBLIC_URL,
      env: { PORT: "3100", NODE_ENV: "production" },
      reuseExistingServer: true,
      timeout: 600_000,
    },
    { command: "npx agent-native dev", url: APP_URL, reuseExistingServer: true, timeout: 180_000 },
  ],
});
