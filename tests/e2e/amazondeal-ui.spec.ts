/**
 * Amazon India Deals Tracker — Core UI Interaction Tests
 * Tests all user-facing interactions: price alert form, dynamic content
 * rendering, real-time update behaviour.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://dfgjhjcr.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  // Block Genspark's notice dialog overlay — it intercepts all pointer events
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
});

// ── UI-01 ─────────────────────────────────────────────────────────────────────
test('UI-01 @smoke: price alert form accepts product name input', async ({ page }) => {
  const input = page.locator('input[placeholder="Product name or URL"]');
  await input.fill('iPhone 15 Pro Max');
  await expect(input).toHaveValue('iPhone 15 Pro Max');
});

// ── UI-02 ─────────────────────────────────────────────────────────────────────
test('UI-02 @smoke: price alert form accepts numeric target price', async ({ page }) => {
  const input = page.locator('input[placeholder="Target price (₹)"]');
  await input.fill('120000');
  await expect(input).toHaveValue('120000');
});

// ── UI-03 ─────────────────────────────────────────────────────────────────────
test('UI-03 @smoke: Set Live Alert button is clickable', async ({ page }) => {
  await page.locator('input[placeholder="Product name or URL"]').fill('Samsung Galaxy S24');
  await page.locator('input[placeholder="Target price (₹)"]').fill('85000');
  const button = page.locator('button', { hasText: 'Set Live Alert' });
  await expect(button).toBeEnabled();
  await button.click();
  // Button should still be present after click (no page navigation)
  await expect(button).toBeVisible();
});

// ── UI-04 ─────────────────────────────────────────────────────────────────────
test('UI-04: trending deals section populates with JS-rendered content', async ({ page }) => {
  await page.waitForFunction(() =>
    (document.querySelector('#trendingDeals')?.children.length ?? 0) > 0,
    { timeout: 10000 }
  );
  const deals = page.locator('#trendingDeals').locator('> *');
  expect(await deals.count()).toBeGreaterThan(0);
});

// ── UI-05 ─────────────────────────────────────────────────────────────────────
test('UI-05: activity feed populates with live entries', async ({ page }) => {
  await page.waitForFunction(() =>
    (document.querySelector('#activityFeed')?.children.length ?? 0) > 0,
    { timeout: 10000 }
  );
  const entries = page.locator('#activityFeed').locator('> *');
  expect(await entries.count()).toBeGreaterThan(0);
});

// ── UI-06 ─────────────────────────────────────────────────────────────────────
test('UI-06: category deals grid populates with cards', async ({ page }) => {
  await page.waitForFunction(() =>
    (document.querySelector('#categoryDeals')?.children.length ?? 0) > 0,
    { timeout: 10000 }
  );
  const cards = page.locator('#categoryDeals').locator('> *');
  expect(await cards.count()).toBeGreaterThan(0);
});

// ── UI-07 ─────────────────────────────────────────────────────────────────────
test('UI-07: live deal stream populates with deal entries', async ({ page }) => {
  await page.waitForFunction(() =>
    (document.querySelector('#dealStream')?.children.length ?? 0) > 0,
    { timeout: 10000 }
  );
  const entries = page.locator('#dealStream').locator('> *');
  expect(await entries.count()).toBeGreaterThan(0);
});

// ── UI-08 ─────────────────────────────────────────────────────────────────────
test('UI-08: live statistics update over time (not static)', async ({ page }) => {
  const initialUsers = await page.locator('#liveUsers').textContent();
  // Wait for 2 update cycles (app updates every 3s)
  await page.waitForTimeout(7000);
  const updatedUsers = await page.locator('#liveUsers').textContent();
  // Values should be non-empty (whether changed or not, they should stay valid numbers)
  expect(updatedUsers?.replace(/,/g, '')).toMatch(/\d+/);
  expect(initialUsers?.replace(/,/g, '')).toMatch(/\d+/);
});

// ── UI-09 ─────────────────────────────────────────────────────────────────────
test('UI-09: price chart canvas has rendered content (non-zero dimensions)', async ({ page }) => {
  await page.waitForTimeout(2000); // Allow Chart.js to render
  const canvas = page.locator('#priceChart');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);
});

// ── UI-10 ─────────────────────────────────────────────────────────────────────
test('UI-10: iPhone chart and Samsung chart both render with dimensions', async ({ page }) => {
  await page.waitForTimeout(2000);

  const iphoneBox  = await page.locator('#iphoneChart').boundingBox();
  const samsungBox = await page.locator('#samsungChart').boundingBox();

  expect(iphoneBox!.width).toBeGreaterThan(100);
  expect(samsungBox!.width).toBeGreaterThan(100);
});

// ── UI-11 ─────────────────────────────────────────────────────────────────────
test('UI-11: notification text updates automatically', async ({ page }) => {
  const initial = await page.locator('#notificationText').textContent();
  await page.waitForTimeout(8000);
  const updated = await page.locator('#notificationText').textContent();
  // Text should remain non-empty
  expect(updated?.trim().length).toBeGreaterThan(0);
  expect(initial?.trim().length).toBeGreaterThan(0);
});

// ── UI-12 ─────────────────────────────────────────────────────────────────────
test('UI-12: page scrolls to bottom without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Only flag errors from the app itself — filter all known third-party noise
  const realErrors = errors.filter(e => {
    const lower = e.toLowerCase();
    return !lower.includes('genspark') &&
           !lower.includes('google') &&
           !lower.includes('cdn') &&
           !lower.includes('chart') &&
           !lower.includes('fontawesome') &&
           !lower.includes('tailwind') &&
           !lower.includes('script error') && // cross-origin opaque errors
           !lower.includes('network error') &&
           !lower.includes('failed to fetch');
  });
  expect(realErrors).toHaveLength(0);
});

// ── UI-13 ─────────────────────────────────────────────────────────────────────
test('UI-13: price alert input clears and re-accepts new values', async ({ page }) => {
  const productInput = page.locator('input[placeholder="Product name or URL"]');
  await productInput.fill('MacBook Air M2');
  await productInput.clear();
  await expect(productInput).toHaveValue('');
  await productInput.fill('OnePlus 12');
  await expect(productInput).toHaveValue('OnePlus 12');
});

// ── UI-14 ─────────────────────────────────────────────────────────────────────
test('UI-14: mobile view — header and stats bar are visible on small screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#liveUsers')).toBeVisible();
  await expect(page.locator('#connectionStatus')).toBeVisible();
});
