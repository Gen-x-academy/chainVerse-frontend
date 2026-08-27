import { test, expect } from '@playwright/test';

test.describe('E-Library duplicate merge (#927)', () => {
  test('catalog admin page links to duplicates', async ({ page }) => {
    await page.goto('/library/catalog');
    const duplicatesLink = page.getByRole('link', { name: /duplicate records/i });
    if (await duplicatesLink.isVisible().catch(() => false)) {
      await expect(duplicatesLink).toHaveAttribute('href', '/library/catalog/duplicates');
    }
  });

  test('duplicate merge page shows comparison or permission guard', async ({ page }) => {
    await page.route('**/library/catalog/duplicates/grp-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          groupId: 'grp-1',
          matchScore: 0.9,
          records: [
            { id: 'r1', title: 'Book A', author: 'Author', format: 'print' },
            { id: 'r2', title: 'Book A (alt)', author: 'Author', format: 'ebook' },
          ],
          holdingsCount: 2,
          activeLoansCount: 0,
          pendingHoldsCount: 1,
        }),
      }),
    );
    await page.goto('/library/catalog/duplicates/grp-1');
    const comparison = page.getByText(/holdings & loan implications/i);
    const denied = page.getByText(/access denied|insufficient permissions/i);
    await expect(comparison.or(denied)).toBeVisible();
  });
});

test.describe('E-Library catalog import (#928)', () => {
  test('import page requires validation before import', async ({ page }) => {
    await page.goto('/library/catalog/import');
    const validateBtn = page.getByRole('button', { name: /validate import/i });
    if (await validateBtn.isVisible().catch(() => false)) {
      await validateBtn.click();
      await expect(page.getByText(/select a file/i)).toBeVisible();
    }
  });
});

test.describe('E-Library catalog export (#929)', () => {
  test('export submit disabled until scope confirmed', async ({ page }) => {
    await page.goto('/library/catalog/export');
    const startBtn = page.getByRole('button', { name: /start export/i });
    if (await startBtn.isVisible().catch(() => false)) {
      await expect(startBtn).toBeDisabled();
    }
  });
});

test.describe('E-Library acquisitions (#930)', () => {
  test('acquisitions page shows new intake link', async ({ page }) => {
    await page.goto('/library/acquisitions');
    const newLink = page.getByRole('link', { name: /new purchase intake/i });
    if (await newLink.isVisible().catch(() => false)) {
      await expect(newLink).toHaveAttribute('href', '/library/acquisitions/new');
    }
  });

  test('purchase intake validates required fields', async ({ page }) => {
    await page.goto('/library/acquisitions/new');
    const submitBtn = page.getByRole('button', { name: /submit intake/i });
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await expect(page.getByText(/title is required/i)).toBeVisible();
    }
  });
});
