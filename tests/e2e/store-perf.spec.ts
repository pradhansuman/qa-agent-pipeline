/**
 * ShopNow — Performance Tests
 * All timing measured via performance.now() inside page.evaluate() to avoid
 * Playwright RPC round-trip overhead inflating the numbers.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const URL = `file://${path.resolve(__dirname, '../../store.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
});

// ── TC-STORE-PERF-01 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-01: renderProducts() completes in under 50ms', async ({ page }) => {
  const ms = await page.evaluate(() => {
    const grid = document.getElementById('product-grid')!;
    grid.innerHTML = '';
    const t0 = performance.now();
    (window as any).renderProducts();
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(50);
});

// ── TC-STORE-PERF-02 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-02: addToCart() executes in under 5ms (JIT-warm)', async ({ page }) => {
  // Warm up V8 JIT with one call before measuring steady-state performance
  const ms = await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).removeItem(1);
    const t0 = performance.now();
    (window as any).addToCart(2);
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(5);
});

// ── TC-STORE-PERF-03 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-03: updateCartUI() with 10-item cart executes in under 20ms', async ({ page }) => {
  const ms = await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    const t0 = performance.now();
    (window as any).updateCartUI();
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(20);
});

// ── TC-STORE-PERF-04 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-04: adding all 10 products completes in under 100ms total', async ({ page }) => {
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(100);
});

// ── TC-STORE-PERF-05 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-05: localStorage write completes in under 5ms', async ({ page }) => {
  const ms = await page.evaluate(() => {
    (window as any).addToCart(1);
    const data = JSON.stringify((window as any).cart);
    const t0 = performance.now();
    localStorage.setItem('shopnow-cart', data);
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(5);
});

// ── TC-STORE-PERF-06 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-06: DOM node count stays under 400 with full cart open', async ({ page }) => {
  await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    (window as any).toggleCart();
  });

  const count = await page.evaluate(() => document.querySelectorAll('*').length);
  expect(count).toBeLessThan(400);
});

// ── TC-STORE-PERF-07 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-07: updateCartUI() on a 10-item × 3-qty cart completes in under 5ms', async ({ page }) => {
  // PRODUCTS is a const — not on window; measure updateCartUI() (which does the calculation)
  const ms = await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) {
      (window as any).addToCart(id);
      (window as any).changeQty(id, 1);
      (window as any).changeQty(id, 1);
    }
    const t0 = performance.now();
    (window as any).updateCartUI();
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(5);
});

// ── TC-STORE-PERF-08 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-08: showToast() executes in under 5ms', async ({ page }) => {
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    (window as any).showToast('Performance test toast');
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(5);
});

// ── TC-STORE-PERF-09 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-09: removeItem() on a 10-item cart executes in under 10ms', async ({ page }) => {
  const ms = await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    const t0 = performance.now();
    (window as any).removeItem(1);
    return performance.now() - t0;
  });

  expect(ms).toBeLessThan(10);
});

// ── TC-STORE-PERF-10 ──────────────────────────────────────────────────────────
test('TC-STORE-PERF-10: page renders all 10 product cards within 1000ms of navigation', async ({ page }) => {
  const { cardCount, domReadyMs } = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      cardCount: document.querySelectorAll('.card').length,
      domReadyMs: nav ? nav.domContentLoadedEventEnd - nav.fetchStart : -1,
    };
  });

  expect(cardCount).toBe(10);
  if (domReadyMs > 0) expect(domReadyMs).toBeLessThan(1000);
});
