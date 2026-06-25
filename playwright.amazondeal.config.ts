import { defineConfig, devices } from '@playwright/test';

export const APP_URL = 'https://dfgjhjcr.gensparkspace.com/';

export default defineConfig({
  globalTeardown: './scripts/auto-report',
  testDir: './tests/e2e',
  testMatch: ['amazondeal-*.spec.ts'],
  fullyParallel: true,
  workers: 3,
  retries: 1,
  timeout: 30_000,
  outputDir: 'test-results-amazondeal/',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-amazondeal', open: 'never' }],
    ['json', { outputFile: 'test-results-amazondeal/results.json' }],
  ],
  snapshotDir: './tests/e2e/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{projectName}/{arg}{ext}',
  use: {
    baseURL: APP_URL,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    // Network is required — app loads Tailwind, Chart.js, FontAwesome from CDN
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 }, // 5% — dynamic content can shift slightly
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome',  use: { ...devices['Pixel 7'] } },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/amazondeal-visual.spec.ts'],
    },
  ],
});
