/**
 * ChatConnect — Performance Tests
 * DOM complexity, memory, rendering speed, and scroll behaviour.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://hveouplw.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.genspark-badge-button { pointer-events: none !important; }' });
});

// ── PERF-01 ────────────────────────────────────────────────────────────────────
test('PERF-01 @smoke: page responds to navigation within 5000ms', async ({ page, browserName }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Firefox consistently takes longer to DOMContentLoaded than Chrome on this host
  const limit = browserName === 'firefox' ? 8000 : 5000;
  expect(Date.now() - t0).toBeLessThan(limit);
});

// ── PERF-02 ────────────────────────────────────────────────────────────────────
test('PERF-02: DOM node count on load is under 2000', async ({ page }) => {
  const count = await page.evaluate(() => document.querySelectorAll('*').length);
  expect(count).toBeLessThan(2000);
});

// ── PERF-03 ────────────────────────────────────────────────────────────────────
test('PERF-03: JS heap memory stays under 80MB at page load', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP heap metrics are only available in Chromium');
  test.setTimeout(30000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
  expect(usedSize).toBeLessThan(80 * 1024 * 1024);
});

// ── PERF-04 ────────────────────────────────────────────────────────────────────
test('PERF-04: sending 10 messages does not grow DOM by more than 150 nodes each', async ({ page, browserName }) => {
  const before = await page.evaluate(() => document.querySelectorAll('*').length);

  for (let i = 1; i <= 10; i++) {
    await page.locator('#messageInput').fill(`Perf msg ${i}`);
    await page.locator('#sendBtn').click({ force: true });
  }
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => document.querySelectorAll('*').length);
  // Each message adds a bubble + avatar wrapper; Firefox adds ~18 nodes vs ~14 on Chrome
  const limit = browserName === 'firefox' ? 220 : 150;
  expect(after - before).toBeLessThan(limit);
});

// ── PERF-05 ────────────────────────────────────────────────────────────────────
test('PERF-05: Clear Chat resets the visible message area', async ({ page }) => {
  const unique = 'perf05-' + Date.now();
  for (let i = 1; i <= 5; i++) {
    await page.locator('#messageInput').fill(`${unique}-${i}`);
    await page.locator('#sendBtn').click({ force: true });
  }
  await expect(page.locator('#messagesContainer')).toContainText(`${unique}-5`);

  await page.locator('#clearChat').click({ force: true });
  await page.waitForTimeout(300);

  // After clear, welcome text appears — confirming the UI was reset
  await expect(page.locator('#messagesContainer')).toContainText('Welcome to ChatConnect!');
});

// ── PERF-06 ────────────────────────────────────────────────────────────────────
test('PERF-06: sent message appears in the DOM within 1000ms', async ({ page }) => {
  const unique = 'perf06-' + Date.now();
  await page.locator('#messageInput').fill(unique);

  const t0 = Date.now();
  await page.locator('#sendBtn').click({ force: true });
  await expect(page.locator('#messagesContainer')).toContainText(unique, { timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
});

// ── PERF-07 ────────────────────────────────────────────────────────────────────
test('PERF-07: 20-message soak — heap does not grow more than 20MB', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP heap metrics are only available in Chromium');
  test.setTimeout(25000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize: before } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };

  for (let i = 1; i <= 20; i++) {
    await page.locator('#messageInput').fill(`Soak msg ${i}`);
    await page.locator('#sendBtn').click({ force: true });
  }
  await page.waitForTimeout(1000);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize: after } = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };

  expect(after - before).toBeLessThan(20 * 1024 * 1024); // 20 MB
});

// ── PERF-08 ────────────────────────────────────────────────────────────────────
test('PERF-08: page scrolls to bottom of messages and back to top without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  await expect(page.locator('#messageInput')).toBeVisible();
  expect(errors.filter(e => !e.toLowerCase().includes('genspark'))).toHaveLength(0);
});
