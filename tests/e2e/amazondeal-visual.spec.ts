/**
 * Amazon India Deals Tracker — Visual Regression Tests
 * Screenshot baselines for key UI sections.
 * First run: npx playwright test --config playwright.amazondeal.config.ts amazondeal-visual --update-snapshots
 * Subsequent runs compare against those committed baselines.
 *
 * NOTE: Dynamic counters and charts change on every render.
 * We clip to static structural areas to avoid flaky diffs.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://dfgjhjcr.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  // Use a fixed viewport for consistent visual baselines
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Freeze animations so screenshots are stable
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.waitForTimeout(1000); // Allow initial render to settle
});

// ── VIS-01 ────────────────────────────────────────────────────────────────────
test('VIS-01 @smoke: header section matches baseline', async ({ page }) => {
  const header = page.locator('header');
  await expect(header).toHaveScreenshot('deals-header.png', {
    maxDiffPixelRatio: 0.05,
    mask: [page.locator('#updateTime')], // timestamp changes every load
  });
});

// ── VIS-02 ────────────────────────────────────────────────────────────────────
test('VIS-02: live statistics bar matches baseline', async ({ page }) => {
  const statsBar = page.locator('.bg-white.border-b.shadow-sm');
  await expect(statsBar).toHaveScreenshot('deals-stats-bar.png', {
    maxDiffPixelRatio: 0.05,
    // Mask all 4 number values — they update every 3s
    mask: [
      page.locator('#liveUsers'),
      page.locator('#activeDeals'),
      page.locator('#priceDrops'),
      page.locator('#alertsSent'),
    ],
  });
});

// ── VIS-03 ────────────────────────────────────────────────────────────────────
test('VIS-03: price alert form matches baseline', async ({ page }) => {
  // Scroll to the alert form area
  const alertSection = page.locator('h2', { hasText: 'Price Alert Setup' }).locator('..');
  await alertSection.scrollIntoViewIfNeeded();
  await expect(alertSection).toHaveScreenshot('deals-alert-form.png', {
    maxDiffPixelRatio: 0.03,
  });
});

// ── VIS-04 ────────────────────────────────────────────────────────────────────
test('VIS-04: footer matches baseline', async ({ page }) => {
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toHaveScreenshot('deals-footer.png', {
    maxDiffPixelRatio: 0.02,
  });
});

// ── VIS-05 ────────────────────────────────────────────────────────────────────
test('VIS-05: full page screenshot on mobile (375px) matches baseline', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; }',
  });
  await page.waitForTimeout(500);

  await expect(page).toHaveScreenshot('deals-mobile-375.png', {
    maxDiffPixelRatio: 0.05,
    fullPage: false,
    mask: [
      page.locator('#liveUsers'),
      page.locator('#activeDeals'),
      page.locator('#priceDrops'),
      page.locator('#alertsSent'),
      page.locator('#updateTime'),
      page.locator('#notificationText'),
    ],
  });
});
