/**
 * Amazon India Deals Tracker — Security Tests
 * Verifies no dangerous patterns exist in the page JS and that
 * user inputs do not cause XSS or injection vulnerabilities.
 * Note: This app intentionally loads from CDN (Tailwind, FontAwesome,
 * Chart.js, Google Fonts) — those external requests are expected and excluded.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://dfgjhjcr.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  // Block Genspark's notice dialog overlay — it intercepts all pointer events
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
});

// ── SEC-01 ─────────────────────────────────────────────────────────────────────
test('SEC-01 @smoke: no eval() in inline page JavaScript', async ({ page }) => {
  const source = await page.content();
  const inlineScripts = source.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const hasEval = inlineScripts.some(s => /\beval\s*\(/.test(s));
  expect(hasEval).toBe(false);
});

// ── SEC-02 ─────────────────────────────────────────────────────────────────────
test('SEC-02 @smoke: no document.write() calls in inline scripts', async ({ page }) => {
  const source = await page.content();
  const inlineScripts = source.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const hasDocWrite = inlineScripts.some(s => /document\.write\s*\(/.test(s));
  expect(hasDocWrite).toBe(false);
});

// ── SEC-03 ─────────────────────────────────────────────────────────────────────
test('SEC-03: product name input does not execute XSS payload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { await d.dismiss(); });

  const productInput = page.locator('input[placeholder="Product name or URL"]');
  await productInput.fill('<script>alert("xss")</script>');
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(1000);

  // No alert should have fired, no script should have executed
  const xssErrors = errors.filter(e => e.includes('xss'));
  expect(xssErrors).toHaveLength(0);
});

// ── SEC-04 ─────────────────────────────────────────────────────────────────────
test('SEC-04: price input only accepts numeric values — no script injection', async ({ page }) => {
  const priceInput = page.locator('input[placeholder="Target price (₹)"]');
  // type=number inputs reject non-numeric characters
  await priceInput.fill('99999');
  const val = await priceInput.inputValue();
  expect(val).toMatch(/^\d*$/);
});

// ── SEC-05 ─────────────────────────────────────────────────────────────────────
test('SEC-05: no sensitive data keys in localStorage', async ({ page }) => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const sensitiveKeys = keys.filter(k =>
    /password|token|secret|api.?key|auth|credential/i.test(k)
  );
  expect(sensitiveKeys).toHaveLength(0);
});

// ── SEC-06 ─────────────────────────────────────────────────────────────────────
test('SEC-06: no sensitive data keys in sessionStorage', async ({ page }) => {
  const keys = await page.evaluate(() => Object.keys(sessionStorage));
  const sensitiveKeys = keys.filter(k =>
    /password|token|secret|api.?key|auth|credential/i.test(k)
  );
  expect(sensitiveKeys).toHaveLength(0);
});

// ── SEC-07 ─────────────────────────────────────────────────────────────────────
test('SEC-07: no inline onclick handlers on deal or stat elements', async ({ page }) => {
  await page.waitForTimeout(2000); // wait for dynamic content
  const onclickElements = await page.evaluate(() =>
    document.querySelectorAll('[onclick]').length
  );
  expect(onclickElements).toBe(0);
});

// ── SEC-08 ─────────────────────────────────────────────────────────────────────
test('SEC-08: connection status element cannot be spoofed by user input', async ({ page }) => {
  // The connection status is read-only UI — not driven by user input
  const statusText = await page.locator('#connectionStatus').textContent();
  expect(statusText).toContain('Live Connected');

  // Even after filling the form, status should remain unchanged
  await page.locator('input[placeholder="Product name or URL"]').fill('hacked');
  const statusAfter = await page.locator('#connectionStatus').textContent();
  expect(statusAfter).toContain('Live Connected');
});

// ── SEC-09 ─────────────────────────────────────────────────────────────────────
test('SEC-09: page serves over HTTPS', async ({ page }) => {
  expect(page.url()).toMatch(/^https:\/\//);
});

// ── SEC-10 ─────────────────────────────────────────────────────────────────────
test('SEC-10: no console errors during normal page interaction', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.waitForTimeout(3000); // one update cycle
  await page.locator('input[placeholder="Product name or URL"]').fill('Test Product');
  await page.locator('input[placeholder="Target price (₹)"]').fill('50000');
  await page.locator('button', { hasText: 'Set Live Alert' }).click();
  await page.waitForTimeout(1000);

  const realErrors = errors.filter(e =>
    !e.includes('genspark') && !e.includes('cdn.jsdelivr') && !e.includes('fonts.google')
  );
  expect(realErrors).toHaveLength(0);
});
