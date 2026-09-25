import { expect, test } from "@playwright/test";

test.describe("Scholarship security journey", () => {
  test("shows the permission boundary at a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/scholarships");

    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(
      /do not have permission/i,
    );
  });

  test("keeps the permission boundary keyboard and screen-reader reachable", async ({
    page,
  }) => {
    await page.goto("/scholarships");

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await expect(alert).toHaveAttribute("role", "alert");
  });
});
