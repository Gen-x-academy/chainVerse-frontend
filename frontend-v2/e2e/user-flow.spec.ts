import { test, expect } from "@playwright/test"

const mockCourses = [
  {
    id: "1",
    title: "Stellar Blockchain Fundamentals",
    category: "Blockchain",
    level: "Beginner",
    price: 100,
    instructor: "Alex Johnson",
  },
  {
    id: "2",
    title: "Smart Contracts with Soroban",
    category: "Smart Contracts",
    level: "Intermediate",
    price: 250,
    instructor: "Maria Garcia",
  },
  {
    id: "3",
    title: "Web3 Development Masterclass",
    category: "Web3 Development",
    level: "Advanced",
    price: 400,
    instructor: "David Chen",
  },
]

async function mockApis(page: import("@playwright/test").Page) {
  await page.route("**/health", async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
  })

  await page.route("**/courses**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: mockCourses, total: mockCourses.length }),
    })
  })

  await page.route("**/auth/login", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Set-Cookie": "session=e2e-session; Path=/; HttpOnly",
      },
      body: JSON.stringify({
        user: {
          id: "1",
          email: "user@example.com",
          firstName: "Test",
          lastName: "User",
          role: "student",
        },
        token: "e2e-token",
        expiresIn: 3600,
      }),
    })
  })
}

test.describe("User Flow", () => {
  test("landing → courses search → login → dashboard", async ({ page, context }) => {
    await mockApis(page)

    // Visit landing page → see hero and featured courses
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: /learn blockchain\. earn crypto\./i })
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: /featured courses/i })).toBeVisible()

    // Navigate to /courses → see course grid
    await page.goto("/courses")
    await expect(page.getByRole("heading", { name: /explore courses/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /stellar blockchain fundamentals/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /smart contracts with soroban/i })).toBeVisible()

    // Type in search box → see filtered results
    await page.getByPlaceholder(/search courses/i).fill("Soroban")
    await expect(page.getByRole("heading", { name: /smart contracts with soroban/i })).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /stellar blockchain fundamentals/i })
    ).not.toBeVisible()

    // Navigate to /login → fill and submit form
    await page.goto("/login")
    await expect(page.getByText("Welcome Back")).toBeVisible()
    await page.getByPlaceholder("you@example.com").fill("user@example.com")
    await page.getByPlaceholder("••••••••").fill("password123")

    // Ensure middleware lets us through after login
    await context.addCookies([
      {
        name: "session",
        value: "e2e-session",
        domain: "localhost",
        path: "/",
      },
    ])

    await page.getByRole("button", { name: "Login" }).click()

    // After login → redirect to /dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("login page loads and shows required fields", async ({ page }) => {
    await mockApis(page)
    await page.goto("/login")
    await expect(page.getByText("Welcome Back")).toBeVisible()
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible()
    await expect(page.getByPlaceholder("••••••••")).toBeVisible()
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible()
  })

  test("login form shows validation errors on empty submit", async ({ page }) => {
    await mockApis(page)
    await page.goto("/login")
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page.getByText("Email is required")).toBeVisible()
    await expect(page.getByText("Password is required")).toBeVisible()
  })
})
