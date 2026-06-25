/**
 * Amazon India Deals Tracker — Contract / Structure Tests
 * Validates the structural contract of the page — if any of these fail,
 * the app is broken for all users regardless of dynamic data.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://dfgjhjcr.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
});

// ── API-01 ────────────────────────────────────────────────────────────────────
test('API-01 @smoke: page loads with correct title', async ({ page }) => {
  await expect(page).toHaveTitle(/Amazon India Deals/i);
});

// ── API-02 ────────────────────────────────────────────────────────────────────
test('API-02 @smoke: header is visible with correct heading', async ({ page }) => {
  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();
  await expect(h1).toContainText('Real-Time Amazon India Deals');
});

// ── API-03 ────────────────────────────────────────────────────────────────────
test('API-03 @smoke: connection status indicator is visible', async ({ page }) => {
  const status = page.locator('#connectionStatus');
  await expect(status).toBeVisible();
  await expect(status).toContainText('Live Connected');
});

// ── API-04 ────────────────────────────────────────────────────────────────────
test('API-04 @smoke: live statistics bar shows 4 metrics', async ({ page }) => {
  await expect(page.locator('#liveUsers')).toBeVisible();
  await expect(page.locator('#activeDeals')).toBeVisible();
  await expect(page.locator('#priceDrops')).toBeVisible();
  await expect(page.locator('#alertsSent')).toBeVisible();
});

// ── API-05 ────────────────────────────────────────────────────────────────────
test('API-05: live statistics values are non-empty numbers', async ({ page }) => {
  const metrics = ['#liveUsers', '#activeDeals', '#priceDrops', '#alertsSent'];
  for (const id of metrics) {
    const text = await page.locator(id).textContent();
    expect(text?.replace(/,/g, '')).toMatch(/\d+/);
  }
});

// ── API-06 ────────────────────────────────────────────────────────────────────
test('API-06: LIVE TRACKING badge is present in header', async ({ page }) => {
  const badge = page.locator('.real-time-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('LIVE TRACKING');
});

// ── API-07 ────────────────────────────────────────────────────────────────────
test('API-07: live notification banner is present', async ({ page }) => {
  const notification = page.locator('#liveNotifications');
  await expect(notification).toBeVisible();
  const text = await page.locator('#notificationText').textContent();
  expect(text?.trim().length).toBeGreaterThan(10);
});

// ── API-08 ────────────────────────────────────────────────────────────────────
test('API-08 @smoke: price alert form has product input, price input, and button', async ({ page }) => {
  const productInput = page.locator('input[placeholder="Product name or URL"]');
  const priceInput   = page.locator('input[placeholder="Target price (₹)"]');
  const alertButton  = page.locator('button', { hasText: 'Set Live Alert' });

  await expect(productInput).toBeVisible();
  await expect(priceInput).toBeVisible();
  await expect(alertButton).toBeVisible();
});

// ── API-09 ────────────────────────────────────────────────────────────────────
test('API-09: all 3 Chart.js canvas elements are present in DOM', async ({ page }) => {
  await page.waitForSelector('#priceChart',   { state: 'attached' });
  await page.waitForSelector('#iphoneChart',  { state: 'attached' });
  await page.waitForSelector('#samsungChart', { state: 'attached' });

  expect(await page.locator('#priceChart').count()).toBe(1);
  expect(await page.locator('#iphoneChart').count()).toBe(1);
  expect(await page.locator('#samsungChart').count()).toBe(1);
});

// ── API-10 ────────────────────────────────────────────────────────────────────
test('API-10: trending deals section is present', async ({ page }) => {
  await expect(page.locator('#trendingDeals')).toBeAttached();
  await expect(page.getByText('Trending Deals')).toBeVisible();
});

// ── API-11 ────────────────────────────────────────────────────────────────────
test('API-11: activity feed section is present', async ({ page }) => {
  await expect(page.locator('#activityFeed')).toBeAttached();
  await expect(page.getByText('Live Activity Feed')).toBeVisible();
});

// ── API-12 ────────────────────────────────────────────────────────────────────
test('API-12: category deals section is present', async ({ page }) => {
  await expect(page.locator('#categoryDeals')).toBeAttached();
  await expect(page.getByText('Live Category Deals')).toBeVisible();
});

// ── API-13 ────────────────────────────────────────────────────────────────────
test('API-13: live deal stream section is present', async ({ page }) => {
  await expect(page.locator('#dealStream')).toBeAttached();
  await expect(page.getByText('Live Deal Stream')).toBeVisible();
});

// ── API-14 ────────────────────────────────────────────────────────────────────
test('API-14: footer is rendered with copyright text', async ({ page }) => {
  const footer = page.locator('footer');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('Amazon India Deals Tracker');
});

// ── API-15 ────────────────────────────────────────────────────────────────────
test('API-15: "Last updated" timestamp is visible in header', async ({ page }) => {
  const updateTime = page.locator('#updateTime');
  await expect(updateTime).toBeVisible();
  const text = await updateTime.textContent();
  expect(text?.trim().length).toBeGreaterThan(0);
});
