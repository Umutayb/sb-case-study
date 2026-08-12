import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * A headed run exists to be watched. Detected from the CLI flag as well as the
 * env var, so `npx playwright test --headed` behaves the same as
 * `npm run test:headed` without anyone having to remember the variable.
 */
const headed = process.argv.includes('--headed') || Boolean(process.env.HEADED);

/** Pace of a headed run, in ms per action. Override with SLOW_MO. */
const slowMo = Number(process.env.SLOW_MO ?? 250);

/**
 * The suite targets a hosted Shiftbase demo environment, so there is no
 * `webServer` block — nothing local to boot.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Headed runs go one at a time: parallel workers throw several windows on
  // screen at once, which is unwatchable and exactly what a headed run is for.
  fullyParallel: !headed,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI || headed ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://app.sb036c506.demo.shiftbase.co',
    headless: !headed,
    video: 'on-first-retry',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /**
     * The demo environment serves a certificate from a private CA
     * (`DifferentLab TLS CA (sales)`) that Chromium rejects outright. This is
     * a property of the sandbox, not of the product — see README.
     */
    ignoreHTTPSErrors: true,
    // Only paced when headed — slowMo on a headless run is pure wasted time.
    launchOptions: headed ? { slowMo } : {},
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      grepInvert: /@mobile/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
      grep: /@mobile/,
    },
  ],
});
