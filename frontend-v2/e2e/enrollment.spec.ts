import { test, expect } from '@playwright/test';

test.describe('Course Enrollment', () => {
  test('browse courses page loads', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /explore courses/i })).toBeVisible();
  });

  test('login form is accessible from enrollment flow', async ({ page }) => {
    await page.goto('/courses');
    const enrollLink = page.getByRole('link', { name: /sign in/i });
    if (await enrollLink.isVisible()) {
      await enrollLink.click();
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });
});
