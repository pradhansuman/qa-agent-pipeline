import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalTeardown: './scripts/auto-report',
  testDir: './tests/e2e',
  testMatch: 'demoapps-*.spec.ts',
  outputDir: 'test-results-demoapps',
  fullyParallel: true,
  retries: 1,
  timeout: 40000,
  reporter: [
    ['json', { outputFile: 'test-results-demoapps/results.json' }],
    ['html',  { outputFolder: 'playwright-report-demoapps', open: 'never' }],
    ['line'],
  ],
  use: {
    baseURL: 'https://demoapps.qspiders.com',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  projects: [
    { name: 'Desktop Chrome',  use: { ...devices['Desktop Chrome']  } },
    { name: 'Mobile Chrome',   use: { ...devices['Pixel 7']         } },
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
