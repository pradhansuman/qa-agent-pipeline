/**
 * Amazon India Deals Tracker — Error & Edge Case Tests
 * Validates graceful handling of slow networks, missing data,
 * form edge cases, and unusual user inputs.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://dfgjhjcr.gensparkspace.com/';

// ── ERR-01 ────────────────────────────────────────────────────────────────────
test('ERR-01 @smoke: page loads and renders on a throttled network (Slow 3G)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only');

  const client = await (page.context() as any).newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (500 * 1024) / 8,  // 500 kbps
    uploadThroughput: (500 * 1024) / 8,
    latency: 200,
  });

  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
});

// ── ERR-02 ────────────────────────────────────────────────────────────────────
test('ERR-02: clicking "Set Live Alert" with empty fields does not crash the page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(1000);

  const realErrors = errors.filter(e =>
    !e.includes('genspark') && !e.includes('cdn')
  );
  expect(realErrors).toHaveLength(0);
  // Page is still functional
  await expect(page.locator('#connectionStatus')).toBeVisible();
});

// ── ERR-03 ────────────────────────────────────────────────────────────────────
test('ERR-03: extremely long product name does not break layout', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const input = page.locator('input[placeholder="Product name or URL"]');
  await input.fill('A'.repeat(500));
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(500);

  // Header should still be visible — layout not broken
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#connectionStatus')).toBeVisible();
});

// ── ERR-04 ────────────────────────────────────────────────────────────────────
test('ERR-04: negative target price is handled without crash', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  const priceInput = page.locator('input[placeholder="Target price (₹)"]');
  await priceInput.fill('-5000');
  const val = await priceInput.inputValue();
  // type=number may accept or reject — the page should not crash either way
  expect(['-5000', '']).toContain(val);

  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await expect(page.locator('#connectionStatus')).toBeVisible();
});

// ── ERR-05 ────────────────────────────────────────────────────────────────────
test('ERR-05: zero as target price is accepted without crash', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  await page.locator('input[placeholder="Product name or URL"]').fill('Test Item');
  await page.locator('input[placeholder="Target price (₹)"]').fill('0');
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#connectionStatus')).toBeVisible();
});

// ── ERR-06 ────────────────────────────────────────────────────────────────────
test('ERR-06: very large price value does not overflow layout', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  await page.locator('input[placeholder="Target price (₹)"]').fill('999999999');
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('h1')).toBeVisible();
});

// ── ERR-07 ────────────────────────────────────────────────────────────────────
test('ERR-07: page remains functional after 30 seconds of live updates', async ({ page }) => {
  test.setTimeout(50000); // 30s wait + navigation overhead
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(30000); // 10 full update cycles

  // Core elements still present and functional
  await expect(page.locator('#connectionStatus')).toBeVisible();
  await expect(page.locator('#liveUsers')).toBeVisible();
  const users = await page.locator('#liveUsers').textContent();
  expect(users?.replace(/,/g, '')).toMatch(/\d+/);
});

// ── ERR-08 ────────────────────────────────────────────────────────────────────
test('ERR-08: special characters in product name do not cause console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const specialChars = '!@#$%^&*()_+{}|:<>?[];,./`~\'"\\';
  await page.locator('input[placeholder="Product name or URL"]').fill(specialChars);
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(500);

  const realErrors = errors.filter(e =>
    !e.includes('genspark') && !e.includes('cdn')
  );
  expect(realErrors).toHaveLength(0);
});

// ── ERR-09 ────────────────────────────────────────────────────────────────────
test('ERR-09: page handles rapid multiple alert button clicks without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const button = page.locator('button', { hasText: 'Set Live Alert' });

  for (let i = 0; i < 5; i++) {
    await button.click({ delay: 50 });
  }
  await page.waitForTimeout(500);

  const realErrors = errors.filter(e => !e.includes('genspark') && !e.includes('cdn'));
  expect(realErrors).toHaveLength(0);
});

// ── ERR-10 ────────────────────────────────────────────────────────────────────
test('ERR-10: Unicode and emoji in product name field does not crash', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="Product name or URL"]').fill('📱 iPhone 🇮🇳 ₹99,999');
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('h1')).toBeVisible();
});
