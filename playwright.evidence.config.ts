import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Evidence run — captures video and screenshots for the known defects.
 *
 * Separate from the main config on purpose: recording video on every run is
 * slow and produces artefacts nobody reads. This config exists to regenerate
 * `defect-evidence/` when a defect's behaviour changes.
 *
 *   npm run evidence
 */
export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  grep: /@known-defect/,
  // One worker: parallel recordings interleave and retries overwrite the
  // artefact we actually want to keep.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: './defect-evidence/raw',
  reporter: [['list']],
  use: {
    ...base.use,
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    screenshot: 'on',
    trace: 'on',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'evidence',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      dependencies: ['setup'],
    },
  ],
});
