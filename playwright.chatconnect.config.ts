import { defineConfig, devices } from '@playwright/test';

export const APP_URL = 'https://hveouplw.gensparkspace.com/';

export default defineConfig({
  globalTeardown: './scripts/auto-report',
  testDir: './tests/e2e',
  testMatch: ['chatconnect-*.spec.ts'],
  fullyParallel: true,
  workers: 3,
  retries: 1,
  timeout: 30_000,
  outputDir: 'test-results-chatconnect/',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-chatconnect', open: 'never' }],
    ['json', { outputFile: 'test-results-chatconnect/results.json' }],
  ],
  snapshotDir: './tests/e2e/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{projectName}/{arg}{ext}',
  use: {
    baseURL: APP_URL,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome',  use: { ...devices['Pixel 7'] } },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/chatconnect-visual.spec.ts'],
    },
  ],
});
