import { test, expect } from "@playwright/test"
import {
  VIEWPORTS,
  type ViewportName,
  type ThemeName,
  prepareVisualPage,
  gotoReady,
  assertScreenshot,
  mockCourses,
} from "./helpers/visual"

const journeys: {
  name: string
  path: string
  ready: (page: import("@playwright/test").Page) => Promise<void>
  themes?: ThemeName[]
}[] = [
  {
    name: "landing",
    path: "/",
    themes: ["light", "dark"],
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: /learn blockchain\. earn crypto\./i })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: /featured courses/i })
      ).toBeVisible()
    },
  },
  {
    name: "auth-login",
    path: "/login",
    themes: ["light", "dark"],
    ready: async (page) => {
      await expect(page.getByText("Welcome Back")).toBeVisible()
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible()
    },
  },
  {
    name: "auth-register",
    path: "/register",
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: /create account/i })
      ).toBeVisible()
    },
  },
  {
    name: "catalog",
    path: "/courses",
    themes: ["light", "dark"],
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: /explore courses/i })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", {
          name: /stellar blockchain fundamentals/i,
        })
      ).toBeVisible()
    },
  },
  {
    name: "course-detail",
    path: "/courses/1",
    ready: async (page) => {
      await expect(
        page.getByRole("heading", {
          name: /stellar blockchain fundamentals/i,
        })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: /enroll/i }).first()
      ).toBeVisible()
    },
  },
  {
    name: "dashboard",
    path: "/dashboard",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    },
  },
  {
    name: "instructor-dashboard",
    path: "/instructors/dashboard",
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: /instructor dashboard/i })
      ).toBeVisible()
    },
  },
  {
    name: "wallet",
    path: "/dashboard/student/wallet",
    ready: async (page) => {
      await expect(page.getByText(/no wallet connected/i)).toBeVisible()
      await expect(
        page.getByRole("button", { name: /connect wallet/i })
      ).toBeVisible()
    },
  },
  {
    name: "payment-checkout",
    path: "/checkout",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible()
      await expect(page.getByText(/your cart is empty/i)).toBeVisible()
    },
  },
  {
    name: "error-not-found",
    path: "/this-route-does-not-exist-visual",
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: /page not found/i })
      ).toBeVisible()
    },
  },
]

for (const [viewportName, viewport] of Object.entries(VIEWPORTS) as [
  ViewportName,
  (typeof VIEWPORTS)[ViewportName],
][]) {
  test.describe(`visual @ ${viewportName}`, () => {
    test.use({ viewport })

    for (const journey of journeys) {
      const themes = journey.themes ?? (["light"] as ThemeName[])

      for (const theme of themes) {
        test(`${journey.name} (${theme})`, async ({ page, context }) => {
          await prepareVisualPage(page, context, { theme })
          await gotoReady(page, journey.path, () => journey.ready(page))
          await assertScreenshot(page, journey.name, viewportName, theme)
        })
      }
    }

    test("catalog loading state", async ({ page, context }) => {
      await prepareVisualPage(page, context, { loading: true })
      await page.goto("/courses", { waitUntil: "domcontentloaded" })
      await page.addStyleTag({
        content: `
          [data-testid="maintenance-banner"] { display: none !important; }
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
          }
        `,
      })
      await expect(
        page.getByRole("heading", { name: /explore courses/i })
      ).toBeVisible()
      // Skeletons use animate-pulse; freeze styles above so pixels stay stable.
      await expect(page.locator(".animate-pulse").first()).toBeVisible({
        timeout: 10_000,
      })
      await assertScreenshot(page, "catalog-loading", viewportName)
    })

    test("course detail error state", async ({ page, context }) => {
      await prepareVisualPage(page, context, { courseError: true })
      await gotoReady(page, "/courses/missing-id", async () => {
        await expect(page.getByText(/course not found/i)).toBeVisible()
      })
      await assertScreenshot(page, "course-detail-error", viewportName)
    })

    test("auth login validation error state", async ({ page, context }) => {
      await prepareVisualPage(page, context)
      await gotoReady(page, "/login", async () => {
        await expect(page.getByText("Welcome Back")).toBeVisible()
      })
      await page.getByRole("button", { name: "Login" }).click()
      await expect(page.getByText("Email is required")).toBeVisible()
      await expect(page.getByText("Password is required")).toBeVisible()
      await assertScreenshot(page, "auth-login-validation", viewportName)
    })
  })
}

// Sanity: fixtures stay aligned with mock helpers (guards accidental drift).
test("visual fixtures include critical catalog courses", () => {
  expect(mockCourses.map((c) => c.id)).toEqual(["1", "2", "3"])
})
