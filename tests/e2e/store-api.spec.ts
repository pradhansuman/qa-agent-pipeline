/**
 * ShopNow — Page Contract Tests
 * Since store.html is a local static file (no HTTP server), these tests
 * validate the page's data contracts: DOM structure, PRODUCTS schema,
 * localStorage interface, and self-containment guarantees.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const URL = `file://${path.resolve(__dirname, '../../store.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
});

// ── TC-STORE-API-01 ───────────────────────────────────────────────────────────
test('TC-STORE-API-01: page loads and product grid is visible', async ({ page }) => {
  await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();
});

// ── TC-STORE-API-02 ───────────────────────────────────────────────────────────
test('TC-STORE-API-02: document title is "Online Store"', async ({ page }) => {
  await expect(page).toHaveTitle('Online Store');
});

// ── TC-STORE-API-03 ───────────────────────────────────────────────────────────
test('TC-STORE-API-03: all required data-testid attributes are present exactly once', async ({ page }) => {
  const required = [
    'cart-button', 'cart-count', 'product-grid',
    'cart-sidebar', 'cart-items', 'cart-total', 'checkout-btn',
  ];

  for (const id of required) {
    await expect(page.locator(`[data-testid="${id}"]`)).toHaveCount(1);
  }
});

// ── TC-STORE-API-04 ───────────────────────────────────────────────────────────
test('TC-STORE-API-04: product grid renders exactly 10 product cards', async ({ page }) => {
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(10);
});

// ── TC-STORE-API-05 ───────────────────────────────────────────────────────────
test('TC-STORE-API-05: every product card exposes name, price, and add-to-cart testids', async ({ page }) => {
  const cards = page.locator('[data-testid="product-card"]');

  for (let i = 0; i < 10; i++) {
    const card = cards.nth(i);
    await expect(card.locator('[data-testid="product-name"]')).toBeVisible();
    await expect(card.locator('[data-testid="product-price"]')).toBeVisible();
    await expect(card.locator('[data-testid="add-to-cart"]')).toBeVisible();
  }
});

// ── TC-STORE-API-06 ───────────────────────────────────────────────────────────
test('TC-STORE-API-06: PRODUCTS array has exactly 10 items with valid schema', async ({ page }) => {
  // PRODUCTS is a const — not on window. Validate via rendered DOM instead.
  const { count, names, prices } = await page.evaluate(() => ({
    count: document.querySelectorAll('[data-testid="product-card"]').length,
    names: Array.from(document.querySelectorAll('[data-testid="product-name"]'))
      .map(el => el.textContent?.trim() || ''),
    prices: Array.from(document.querySelectorAll('[data-testid="product-price"]'))
      .map(el => el.textContent?.trim() || ''),
  }));

  expect(count).toBe(10);
  for (const name of names) expect(name.length).toBeGreaterThan(0);
  for (const price of prices) {
    expect(price).toMatch(/^\$\d+\.\d{2}$/);
    expect(parseFloat(price.replace('$', ''))).toBeGreaterThan(0);
  }
});

// ── TC-STORE-API-07 ───────────────────────────────────────────────────────────
test('TC-STORE-API-07: all product data-product-id values are unique', async ({ page }) => {
  // product-card elements carry data-product-id rendered from PRODUCTS[].id
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="product-card"]'))
      .map(el => el.getAttribute('data-product-id'))
  );

  expect(ids.length).toBe(10);
  expect(new Set(ids).size).toBe(10);
});

// ── TC-STORE-API-08 ───────────────────────────────────────────────────────────
test('TC-STORE-API-08: cart initialises as empty in a fresh browser context', async ({ page }) => {
  // updateCartUI() always writes to localStorage (even on load), so the key
  // will exist but must parse to an empty object — never pre-populated items
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shopnow-cart') || 'null')
  );
  expect(stored).toEqual({});
  await expect(page.locator('#cart-count')).toHaveText('0');
  await expect(page.locator('#checkout-btn')).toBeDisabled();
});

// ── TC-STORE-API-09 ───────────────────────────────────────────────────────────
test('TC-STORE-API-09: page is self-contained — no external script or link[rel=stylesheet] sources', async ({ page }) => {
  const external = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map(el => (el as HTMLScriptElement).src)
      .filter(src => src && !src.startsWith('file://'));

    const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(el => (el as HTMLLinkElement).href)
      .filter(href => href && !href.startsWith('file://'));

    return [...scripts, ...sheets];
  });

  expect(external).toHaveLength(0);
});

// ── TC-STORE-API-10 ───────────────────────────────────────────────────────────
test('TC-STORE-API-10: cart data written to localStorage matches expected schema after adding items', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).addToCart(1);
    (window as any).addToCart(3);
  });

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shopnow-cart') || '{}')
  );

  expect(stored['1']).toBe(2);
  expect(stored['3']).toBe(1);
  expect(Object.keys(stored)).toHaveLength(2);
});

// ── TC-STORE-API-11 ───────────────────────────────────────────────────────────
test('TC-STORE-API-11: product prices in DOM are valid and adding all 10 gives correct total', async ({ page }) => {
  // DOM prices must match $X.XX format
  const domPrices = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="product-price"]'))
      .map(el => el.textContent?.trim() || '')
  );
  expect(domPrices).toHaveLength(10);
  for (const p of domPrices) expect(p).toMatch(/^\$\d+\.\d{2}$/);

  // Adding all 10 must produce the exact sum rendered from those prices
  const total = await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    return document.getElementById('cart-total')!.textContent;
  });
  expect(total).toBe('$545.85');
});

// ── TC-STORE-API-12 ───────────────────────────────────────────────────────────
test('TC-STORE-API-12: cart count in header matches actual cart item count at all times', async ({ page }) => {
  const results = await page.evaluate(() => {
    const log: boolean[] = [];

    for (let id = 1; id <= 10; id++) {
      (window as any).addToCart(id);
      const badge = parseInt(document.getElementById('cart-count')!.textContent || '0', 10);
      // cart is a const — read via localStorage instead of window.cart
      const stored = JSON.parse(localStorage.getItem('shopnow-cart') || '{}') as Record<string, number>;
      const actual = Object.values(stored).reduce((s: number, v: number) => s + v, 0);
      log.push(badge === actual);
    }
    return log;
  });

  expect(results.every(v => v)).toBe(true);
});
