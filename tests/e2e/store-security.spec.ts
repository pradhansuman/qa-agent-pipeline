/**
 * ShopNow — Security Tests
 * Validates: no eval(), localStorage hygiene, XSS resistance,
 * no external requests, cart state integrity, no console errors.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const URL = `file://${path.resolve(__dirname, '../../store.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
});

// ── TC-STORE-SEC-01 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-01: no eval() call in page JavaScript source', async ({ page }) => {
  const source = await page.evaluate(() => document.documentElement.outerHTML);
  // match the dangerous call form, not substrings like "evaluate"
  expect(source).not.toMatch(/\beval\s*\(/);
});

// ── TC-STORE-SEC-02 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-02: only "shopnow-cart" key written to localStorage after full interaction', async ({ page }) => {
  await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
  });

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(['shopnow-cart']);
});

// ── TC-STORE-SEC-03 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-03: localStorage cart values are positive integers only (no strings or objects)', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).addToCart(1);
    (window as any).addToCart(2);
  });

  const cartData = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shopnow-cart') || '{}')
  );

  for (const val of Object.values(cartData)) {
    expect(typeof val).toBe('number');
    expect(Number.isInteger(val as number)).toBe(true);
    expect(val as number).toBeGreaterThan(0);
  }
});

// ── TC-STORE-SEC-04 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-04: cart total is always a valid dollar amount (never NaN or Infinity)', async ({ page }) => {
  const totals = await page.evaluate(() => {
    const results: string[] = [];
    for (let id = 1; id <= 10; id++) {
      (window as any).addToCart(id);
      results.push(document.getElementById('cart-total')!.textContent || '');
    }
    return results;
  });

  for (const total of totals) {
    expect(total).toMatch(/^\$\d+\.\d{2}$/);
    expect(total).not.toContain('NaN');
    expect(total).not.toContain('Infinity');
  }
});

// ── TC-STORE-SEC-05 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-05: checkout clears all items from the localStorage cart', async ({ page }) => {
  // updateCartUI() always rewrites localStorage (even as '{}'), so the key
  // stays but must be an empty object — never contain stale items after checkout
  page.on('dialog', d => d.accept());
  await page.evaluate(() => (window as any).addToCart(1));
  await page.click('#cart-btn');
  await page.click('#checkout-btn');

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shopnow-cart') || 'null')
  );
  expect(stored).toEqual({});
  await expect(page.locator('#cart-count')).toHaveText('0');
});

// ── TC-STORE-SEC-06 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-06: no console errors during normal add/remove/checkout flow', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(URL);
  await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).addToCart(2);
    (window as any).toggleCart();
    (window as any).changeQty(1, 2);
    (window as any).removeItem(2);
  });

  const appErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('CORS') &&
    !e.includes('net::ERR_FILE_NOT_FOUND')
  );
  expect(appErrors).toHaveLength(0);
});

// ── TC-STORE-SEC-07 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-07: no external network requests are made by the page', async ({ page }) => {
  const external: string[] = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.startsWith('file://') && !url.startsWith('data:')) external.push(url);
  });

  await page.goto(URL);
  await page.evaluate(() => (window as any).addToCart(1));

  expect(external).toHaveLength(0);
});

// ── TC-STORE-SEC-08 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-08: checkout() is a no-op when cart is empty — internal guard prevents corruption', async ({ page }) => {
  // checkout() has: if (ids.length === 0) return; — calling on empty cart must not crash
  await page.evaluate(() => (window as any).checkout());

  // Page must remain fully functional after the no-op call
  await page.evaluate(() => (window as any).addToCart(2));
  await expect(page.locator('#cart-count')).toHaveText('1');
  await expect(page.locator('#checkout-btn')).toBeEnabled();
});

// ── TC-STORE-SEC-09 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-09: product names in the DOM contain no script tags or event handlers', async ({ page }) => {
  const names = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="product-name"]'))
      .map(el => el.textContent || '')
  );

  for (const name of names) {
    expect(name).not.toContain('<script>');
    expect(name).not.toContain('javascript:');
    expect(name).not.toContain('onerror');
    expect(name).not.toContain('onload');
  }
});

// ── TC-STORE-SEC-10 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-10: cart item HTML contains no injected script markup', async ({ page }) => {
  await page.evaluate(() => {
    for (let id = 1; id <= 5; id++) (window as any).addToCart(id);
    (window as any).toggleCart();
  });

  const itemHtml = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cart-item-name'))
      .map(el => el.innerHTML)
  );

  for (const html of itemHtml) {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/on\w+=/i);
  }
});

// ── TC-STORE-SEC-11 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-11: page is self-contained — no external script or stylesheet sources', async ({ page }) => {
  const external = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map(el => (el as HTMLScriptElement).src)
      .filter(src => src && !src.startsWith('file://'));

    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
      .map(el => (el as HTMLLinkElement).href)
      .filter(href => href && !href.startsWith('file://'));

    return [...scripts, ...links];
  });

  expect(external).toHaveLength(0);
});

// ── TC-STORE-SEC-12 ───────────────────────────────────────────────────────────
test('TC-STORE-SEC-12: cart count badge always shows a non-negative integer throughout add/remove cycle', async ({ page }) => {
  const counts = await page.evaluate(() => {
    const results: string[] = [];

    for (let id = 1; id <= 5; id++) {
      (window as any).addToCart(id);
      results.push(document.getElementById('cart-count')!.textContent || '');
    }
    for (let id = 1; id <= 5; id++) {
      (window as any).removeItem(id);
      results.push(document.getElementById('cart-count')!.textContent || '');
    }
    return results;
  });

  for (const count of counts) {
    const num = parseInt(count, 10);
    expect(Number.isNaN(num)).toBe(false);
    expect(num).toBeGreaterThanOrEqual(0);
  }
});
