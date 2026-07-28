import { defineConfig, devices } from "@playwright/test"

/**
 * Visual regression baselines are platform-sensitive (font rendering).
 * CI runs on Linux — commit Linux snapshots, or regenerate in CI with
 * `npm run test:e2e:visual:update` when layouts intentionally change.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  expect: {
    toHaveScreenshot: {
      // Allow tiny antialiasing variance across machines/CI agents.
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Deterministic maintenance-banner behavior when no local API is running.
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL:
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1",
    },
  },
})
