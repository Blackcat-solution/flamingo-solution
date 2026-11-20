import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const PASSWORD = 'Flamingo@2026';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/portal\//);
}

test.describe('document upload controls', () => {
  test('rejects a file that fails the malware scan', async ({ page }) => {
    await signIn(page, 'candidate@flamingo.work');
    await page.goto('/portal/professional/profile');
    await page.getByRole('tab', { name: /documents/i }).click();

    await page.locator('#doc-file').setInputFiles(
      path.join(process.cwd(), 'e2e', 'fixtures', 'eicar.pdf')
    );
    await page.getByRole('button', { name: /encrypt & upload/i }).click();

    await expect(page.locator('.toast-error')).toContainText(/security scan/i);
  });

  test('rejects content that does not match its declared type', async ({ page }) => {
    await signIn(page, 'candidate@flamingo.work');
    await page.goto('/portal/professional/profile');
    await page.getByRole('tab', { name: /documents/i }).click();

    await page.locator('#doc-file').setInputFiles({
      name: 'disguised.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('<html><script>alert(1)</script></html>')
    });
    await page.getByRole('button', { name: /encrypt & upload/i }).click();

    await expect(page.locator('.toast-error')).toContainText(/valid PDF/i);
  });
});
