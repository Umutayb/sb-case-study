import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * The suite targets a hosted Shiftbase demo environment, so there is no
 * `webServer` block — nothing local to boot.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://app.sb036c506.demo.shiftbase.co',
    headless: true,
    video: 'on-first-retry',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
  ],
});
