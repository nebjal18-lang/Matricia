import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "artifacts/test-results/playwright-report", open: "never" }]]
    : "line",
  outputDir: "artifacts/test-results/playwright",
  use: {
    baseURL,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.PLAYWRIGHT_VIDEO === "off" ? "off" : "retain-on-failure",
    locale: "fr-MA",
    timezoneId: "Africa/Casablanca",
  },
  projects: [
    {
      name: "chromium-mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(process.env.E2E_EXTERNAL_SERVER
    ? {}
    : { webServer: {
        command: "corepack pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI && process.env.E2E_LOCAL_ISOLATED !== "1",
        timeout: 120_000,
        env: {
          ...(process.env.E2E_LOCAL_ISOLATED === "1" ? {
            APP_ENV: "development",
            PAYMENT_PROVIDER: "DEMO",
            PAYMENT_PROVIDER_ALLOWLIST: "DEMO",
            PAYMENT_LIVE_ENABLED: "false",
            EMAIL_DELIVERY_MODE: "DEMO",
            EMAIL_LIVE_DELIVERY_ENABLED: "false",
            MARKETING_PUBLISH_MODE: "sandbox",
            MARKETING_LIVE_PUBLISHING_ENABLED: "false",
            MARKETING_CONTENT_PROVIDER_URL: "",
            MARKETING_CONTENT_PROVIDER_API_KEY: "",
            MARKETING_CONTENT_PROVIDER_ENDPOINT_ALLOWLIST: "",
          } : {}),
          ...(process.env.E2E_CRON_SECRET ? { CRON_SECRET: process.env.E2E_CRON_SECRET } : {}),
          ...(process.env.E2E_DELIVERY_PROOF_SCANNER_MODE === "SANDBOX" ? { DELIVERY_PROOF_SCANNER_MODE: "SANDBOX" } : {}),
        },
      } }),
});
