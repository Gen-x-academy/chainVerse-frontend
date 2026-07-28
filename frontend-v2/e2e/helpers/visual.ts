import { expect, type Page, type BrowserContext } from "@playwright/test"

/** Stable course fixtures for catalog + detail screenshots. */
export const mockCourses = [
  {
    id: "1",
    title: "Stellar Blockchain Fundamentals",
    description:
      "Learn the foundations of the Stellar network, accounts, and assets.",
    category: "Blockchain",
    level: "Beginner",
    price: 100,
    instructor: "Alex Johnson",
    rating: 4.8,
    studentCount: 1200,
  },
  {
    id: "2",
    title: "Smart Contracts with Soroban",
    description: "Build and deploy Soroban smart contracts on Stellar.",
    category: "Smart Contracts",
    level: "Intermediate",
    price: 250,
    instructor: "Maria Garcia",
    rating: 4.6,
    studentCount: 860,
  },
  {
    id: "3",
    title: "Web3 Development Masterclass",
    description: "End-to-end Web3 app development on Stellar.",
    category: "Web3 Development",
    level: "Advanced",
    price: 400,
    instructor: "David Chen",
    rating: 4.9,
    studentCount: 540,
  },
]

export const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
} as const

export type ViewportName = keyof typeof VIEWPORTS
export type ThemeName = "light" | "dark"

/**
 * Session cookie so middleware lets journeys through without a real backend login.
 */
export async function seedSession(context: BrowserContext) {
  await context.addCookies([
    {
      name: "session",
      value: "e2e-visual-session",
      domain: "localhost",
      path: "/",
    },
  ])
}

/**
 * Force light/dark before first paint. ThemeToggle writes the same `theme` key
 * and `dark` class on <html>.
 */
export async function applyTheme(page: Page, theme: ThemeName) {
  await page.addInitScript((selected) => {
    localStorage.setItem("theme", selected)
    if (selected === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, theme)
}

/**
 * Hide environment-dependent chrome and freeze motion for deterministic pixels.
 */
export async function stabilizePage(page: Page) {
  await page.addStyleTag({
    content: `
      [data-testid="maintenance-banner"] { display: none !important; }
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0s !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  })
}

/**
 * Mock health + course list/detail APIs used by critical journeys.
 * Pass `loading: true` to leave courses pending (catalog loading state).
 */
export async function mockApis(
  page: Page,
  options: { loading?: boolean; courseError?: boolean } = {}
) {
  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route("**/courses/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue()
      return
    }

    if (options.courseError) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Course not found." }),
      })
      return
    }

    const url = new URL(route.request().url())
    const id = url.pathname.split("/").filter(Boolean).pop()
    const course = mockCourses.find((c) => c.id === id) ?? mockCourses[0]

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(course),
    })
  })

  await page.route("**/courses**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue()
      return
    }

    // Detail routes are handled above; skip if path looks like /courses/:id
    const path = new URL(route.request().url()).pathname
    if (/\/courses\/[^/]+$/.test(path)) {
      await route.fallback()
      return
    }

    if (options.loading) {
      // Never resolve so the catalog stays on skeletons.
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: mockCourses, total: mockCourses.length }),
    })
  })
}

export async function prepareVisualPage(
  page: Page,
  context: BrowserContext,
  options: {
    theme?: ThemeName
    loading?: boolean
    courseError?: boolean
  } = {}
) {
  await seedSession(context)
  await applyTheme(page, options.theme ?? "light")
  await mockApis(page, {
    loading: options.loading,
    courseError: options.courseError,
  })
}

export async function gotoReady(
  page: Page,
  path: string,
  ready: () => Promise<void>
) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await stabilizePage(page)
  await ready()
}

export async function assertScreenshot(
  page: Page,
  name: string,
  viewport: ViewportName,
  theme: ThemeName = "light"
) {
  await expect(page).toHaveScreenshot(`${name}-${viewport}-${theme}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  })
}
