import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'Flamingo@2026';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
}

test.describe('sign-in and role isolation', () => {
  test('a professional lands on the professional dashboard', async ({ page }) => {
    await signIn(page, 'candidate@flamingo.work');
    await expect(page).toHaveURL(/\/portal\/professional$/);
    await expect(page.getByRole('heading', { name: /welcome back, aarav/i })).toBeVisible();
    await expect(page.getByText(/demo/i).first()).toBeVisible();
  });

  test('an employer lands on the employer dashboard', async ({ page }) => {
    await signIn(page, 'employer@flamingo.work');
    await expect(page).toHaveURL(/\/portal\/employer$/);
    await expect(page.getByRole('heading', { name: /meridian technologies/i })).toBeVisible();
  });

  test('an administrator lands on the platform overview', async ({ page }) => {
    await signIn(page, 'admin@flamingo.work');
    await expect(page).toHaveURL(/\/portal\/admin$/);
    await expect(page.getByRole('heading', { name: /platform overview/i })).toBeVisible();
  });

  test('a professional cannot open the admin portal', async ({ page }) => {
    await signIn(page, 'candidate@flamingo.work');
    await expect(page).toHaveURL(/\/portal\/professional$/);
    await page.goto('/portal/admin');
    await expect(page).toHaveURL(/\/portal\/professional$/);
    await expect(page.getByRole('heading', { name: /platform overview/i })).toHaveCount(0);
  });

  test('a bad password does not create a session', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('candidate@flamingo.work');
    await page.getByLabel('Password').fill('not-the-password');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/sign-in failed/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a signed-in session survives a reload', async ({ page }) => {
    await signIn(page, 'candidate@flamingo.work');
    await expect(page).toHaveURL(/\/portal\/professional$/);
    await page.reload();
    await expect(page).toHaveURL(/\/portal\/professional$/);
    await expect(page.getByRole('heading', { name: /welcome back, aarav/i })).toBeVisible();
  });

  test('demo credentials fill the form but do not submit it', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Professional' }).click();
    await expect(page.getByLabel('Email address')).toHaveValue('candidate@flamingo.work');
    await expect(page.getByLabel('Password')).toHaveValue(PASSWORD);
    await expect(page).toHaveURL(/\/login/);
  });
});
