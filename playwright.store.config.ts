import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export const STORE_URL = `file://${path.resolve(__dirname, 'store.html')}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['store-*.spec.ts'],
  fullyParallel: true,
  workers: 4,
  retries: 1,
  outputDir: 'test-results-store/',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-store', open: 'never' }],
    ['json', { outputFile: 'test-results-store/results.json' }],
  ],
  snapshotDir: './tests/e2e/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{projectName}/{arg}{ext}',
  use: {
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
