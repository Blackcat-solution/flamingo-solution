import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end suite for the critical journeys.
 *
 * The web server is started by Playwright against a throwaway database and
 * storage directory, seeded with the documented demo accounts. No real data or
 * money is involved.
 *
 * Run:
 *   npm run e2e            # headless
 *   npm run e2e:ui         # interactive
 *   npm run e2e:report     # open the last HTML report
 */

const PORT = Number(process.env.E2E_PORT || 4310);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node e2e/server.mjs',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'test',
      PORT: String(PORT),
      DEMO_MODE: 'true',
      SECURE_COOKIES: 'false',
      MALWARE_SCAN_MODE: 'eicar',
      FLAMINGO_DATA_DIR: '.e2e/data',
      FLAMINGO_DB: '.e2e/data/flamingo.db',
      FLAMINGO_STORAGE: '.e2e/storage',
      DOCUMENT_ENCRYPTION_KEY: 'e2e-only-document-key-not-for-any-real-data-0001'
    }
  }
});
