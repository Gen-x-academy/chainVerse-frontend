import { test, expect } from "@playwright/test"

test.describe("User Flow", () => {
  test("login page loads and shows required fields", async ({ page }) => {
    await page.goto("/auth/login")
    await expect(page.getByText("Welcome Back")).toBeVisible()
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible()
    await expect(page.getByPlaceholder("••••••••")).toBeVisible()
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible()
  })

  test("login form shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page.getByText("Email is required")).toBeVisible()
    await expect(page.getByText("Password is required")).toBeVisible()
  })

  test("login form shows invalid email error", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByPlaceholder("you@example.com").fill("notanemail")
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page.getByText("Please enter a valid email")).toBeVisible()
  })

  test("login form shows short password error", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByPlaceholder("you@example.com").fill("user@example.com")
    await page.getByPlaceholder("••••••••").fill("short")
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible()
  })

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/auth/login")
    const passwordInput = page.getByPlaceholder("••••••••")
    await expect(passwordInput).toHaveAttribute("type", "password")
    await page.getByRole("button").filter({ hasNot: page.getByRole("button", { name: "Login" }) }).first().click()
    await expect(passwordInput).toHaveAttribute("type", "text")
  })

  test("sign up link navigates to signup page", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByRole("link", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/signup/)
  })

  test("dashboard page loads after navigating directly", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL("/dashboard")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  })

  test("interactive elements have visible focus indicators", async ({ page }) => {
    await page.goto("/auth/login")
    await page.keyboard.press("Tab")
    const focused = page.locator(":focus")
    await expect(focused).toBeVisible()
  })
})
