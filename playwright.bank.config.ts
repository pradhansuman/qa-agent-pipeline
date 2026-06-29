import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['bank-*.spec.ts'],
  fullyParallel: true,
  workers: 2,
  retries: 1,
  outputDir: 'test-results-bank/',
  globalTeardown: './scripts/auto-report',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-bank', open: 'never' }],
    ['json', { outputFile: 'test-results-bank/results.json' }],
  ],
  snapshotDir: './tests/e2e/__snapshots__',
  use: { screenshot: 'only-on-failure', video: 'off', trace: 'off' },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  projects: [
    { name: 'Desktop Chrome',  use: { ...devices['Desktop Chrome']  } },
    { name: 'Mobile Chrome',   use: { ...devices['Pixel 7']         } },
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: ['**/bank-visual.spec.ts'] },
  ],
});
