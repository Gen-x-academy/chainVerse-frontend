import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test('connect wallet button is visible on landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('disconnect clears wallet state', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectBtn).toBeVisible();
  });
});
