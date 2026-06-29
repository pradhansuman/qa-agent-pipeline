// bank - Visual: screenshot baselines (desktop + mobile)
import { test, expect } from '@playwright/test';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

// Update: npx playwright test bank-visual --update-snapshots

test('BANK-VIS-01 @smoke: default state matches baseline', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot('bank-default.png', { maxDiffPixelRatio: 0.02 });
});

test('BANK-VIS-02: mobile viewport matches baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot('bank-mobile.png', { maxDiffPixelRatio: 0.02 });
});
