import { test, expect } from '@playwright/test';

test.describe('public marketplace', () => {
  test('home states the demonstration position', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /work your time/i })).toBeVisible();
    await expect(page.getByText(/simulated/i).first()).toBeVisible();
  });

  test('home keeps the exact ₹20,000 worked example', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('₹20,000').first()).toBeVisible();
    await expect(page.getByText('₹9,301').first()).toBeVisible();
    await expect(page.getByText('₹10,000').first()).toBeVisible();
    await expect(page.getByText('₹19,301').first()).toBeVisible();
  });

  test('pricing repeats the same example without drift', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /see every rupee/i })).toBeVisible();
    await expect(page.getByText('₹9,301').first()).toBeVisible();
    await expect(page.getByText('₹10,000').first()).toBeVisible();
    await expect(page.getByText('₹19,301').first()).toBeVisible();
  });

  test('the marketplace lists verified professionals', async ({ page }) => {
    await page.goto('/professionals');
    await expect(page.getByText(/Aarav Mehta/i).first()).toBeVisible();
  });

  test('an unknown route renders the public not-found page', async ({ page }) => {
    const response = await page.goto('/does-not-exist');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText(/not found|page/i);
  });
});
