import { defineConfig, devices } from "@playwright/test"

/**
 * Visual regression baselines are platform-sensitive (font rendering).
 * CI runs on Linux — commit Linux snapshots, or regenerate in CI with
 * `npm run test:e2e:visual:update` when layouts intentionally change.
 *
 * Workspace user-journey specs (CAPSTONE-070/071/073/075) live in
 * `./e2e/workspace.spec.ts` and intercept all API calls via `page.route`,
 * so they do not require a live backend. The `webServer` block below only
 * boots the Next.js dev server for rendering.
 *
 * Project user-journey specs (CAPSTONE-063/065/068 — timeline/roadmap,
 * collaboration workspace, resource library) live in
 * `./e2e/projects.spec.ts` and likewise intercept all API calls via
 * `page.route`, so no live backend is required.
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
    {
      // Keyboard-only + screen-reader assertions for the workspace journeys.
      name: "workspace-a11y",
      testMatch: /workspace\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Force reduced motion so live-region announcements are deterministic.
        reducedMotion: "reduce",
      },
    },
    {
      // Responsive checks: mobile viewport for the workspace journeys.
      name: "workspace-mobile",
      testMatch: /workspace\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        reducedMotion: "reduce",
      },
    },
    {
      // Keyboard-only + screen-reader assertions for the project journeys
      // (timeline/roadmap, collaboration workspace, resource library).
      name: "projects-a11y",
      testMatch: /projects\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Force reduced motion so live-region announcements are deterministic.
        reducedMotion: "reduce",
      },
    },
    {
      // Responsive checks: mobile viewport for the project journeys.
      name: "projects-mobile",
      testMatch: /projects\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        reducedMotion: "reduce",
      },
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