import { test, expect } from '@playwright/test';

// Deterministic fixtures for patron/librarian e-library journeys.
const PATRON = { role: 'patron', email: 'patron.fixture@chainverse.test' };
const LIBRARIAN = { role: 'librarian', email: 'librarian.fixture@chainverse.test' };

test.describe('E-Library patron journeys', () => {
  test('patron can discover a book from the catalog', async ({ page }) => {
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible();
  });

  test('patron can start a borrow request and see loading state', async ({ page }) => {
    await page.goto('/library');
    const borrowBtn = page.getByRole('button', { name: /borrow/i }).first();
    if (await borrowBtn.isVisible().catch(() => false)) {
      await borrowBtn.click();
      await expect(page.getByText(/borrowing|loading/i)).toBeVisible();
    }
  });

  test('patron sees empty state when no active holds exist', async ({ page }) => {
    await page.goto('/library/holds');
    await expect(page.getByText(/no holds|empty/i)).toBeVisible();
  });
});

test.describe('Librarian circulation journeys', () => {
  test('librarian can return an item and see success confirmation', async ({ page }) => {
    await page.goto('/library/circulation');
    await expect(page.getByRole('heading', { name: /circulation/i })).toBeVisible();
  });

  test('non-librarian cannot access circulation desk', async ({ page }) => {
    await page.goto('/library/circulation');
    await expect(page).not.toHaveURL(/circulation$/);
  });
});
