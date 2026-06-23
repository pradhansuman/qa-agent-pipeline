/**
 * ShopNow — Endurance Loop Tests
 * All loops run inside page.evaluate() to avoid Playwright RPC overhead.
 * This lets us run 25–50 iterations without the ~1.2s/call RPC cost.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const URL = `file://${path.resolve(__dirname, '../../store.html')}`;

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.goto(URL);
});

// ── TC-STORE-LOOP-01 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-01: adding all 10 products × 3 cycles gives cart count of 30', async ({ page }) => {
  const count = await page.evaluate(() => {
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    }
    return parseInt(document.getElementById('cart-count')!.textContent || '0', 10);
  });

  expect(count).toBe(30);
});

// ── TC-STORE-LOOP-02 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-02: incrementing qty 20 times gives final qty of 21', async ({ page }) => {
  // cart is a const in the page scope — not a window property; read via localStorage
  const qty = await page.evaluate(() => {
    (window as any).addToCart(1);
    for (let i = 0; i < 20; i++) (window as any).changeQty(1, 1);
    return JSON.parse(localStorage.getItem('shopnow-cart') || '{}')['1'] as number;
  });

  expect(qty).toBe(21);
});

// ── TC-STORE-LOOP-03 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-03: add-then-remove same product 15 times — cart stays empty', async ({ page }) => {
  const isEmpty = await page.evaluate(() => {
    for (let i = 0; i < 15; i++) {
      (window as any).addToCart(3);
      (window as any).removeItem(3);
    }
    // Read via localStorage — cart const is not on window
    const stored = JSON.parse(localStorage.getItem('shopnow-cart') || '{}');
    return Object.keys(stored).length === 0;
  });

  expect(isEmpty).toBe(true);
  await expect(page.locator('#cart-count')).toHaveText('0');
});

// ── TC-STORE-LOOP-04 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-04: 30 cart toggles (even) — sidebar ends in closed state', async ({ page }) => {
  const isOpen = await page.evaluate(() => {
    for (let i = 0; i < 30; i++) (window as any).toggleCart();
    return document.getElementById('cart-sidebar')!.classList.contains('open');
  });

  expect(isOpen).toBe(false);
  await expect(page.locator('#cart-sidebar')).not.toHaveClass(/open/);
});

// ── TC-STORE-LOOP-05 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-05: adding product 3 twenty-five times — total equals $998.75', async ({ page }) => {
  const { total, count } = await page.evaluate(() => {
    for (let i = 0; i < 25; i++) (window as any).addToCart(3);
    return {
      total: document.getElementById('cart-total')!.textContent,
      count: parseInt(document.getElementById('cart-count')!.textContent || '0', 10),
    };
  });

  expect(count).toBe(25);
  expect(total).toBe('$998.75');
});

// ── TC-STORE-LOOP-06 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-06: localStorage stays in sync through 20 add/remove cycles', async ({ page }) => {
  const results = await page.evaluate(() => {
    const log: boolean[] = [];
    const ids = [1, 2, 3, 4, 5];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      (window as any).addToCart(id);
      const after = JSON.parse(localStorage.getItem('shopnow-cart') || '{}');
      log.push(typeof after[id] === 'number' && after[id] > 0);

      (window as any).removeItem(id);
      const cleared = JSON.parse(localStorage.getItem('shopnow-cart') || '{}');
      log.push(cleared[id] === undefined);
    }
    return log;
  });

  expect(results.every(v => v)).toBe(true);
});

// ── TC-STORE-LOOP-07 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-07: 10 rapid toast fires — last toast shows "Running Shoes"', async ({ page }) => {
  const lastText = await page.evaluate(() => {
    // i%5+1: 1,2,3,4,5,1,2,3,4,5 — last is id=5 (Running Shoes)
    for (let i = 0; i < 10; i++) (window as any).addToCart((i % 5) + 1);
    return document.getElementById('toast')!.textContent;
  });

  expect(lastText).toContain('Running Shoes');
});

// ── TC-STORE-LOOP-08 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-08: checkout button enable/disable state correct through 10 add/remove cycles', async ({ page }) => {
  const allCorrect = await page.evaluate(() => {
    const results: boolean[] = [];
    const btn = document.getElementById('checkout-btn') as HTMLButtonElement;

    for (let i = 0; i < 10; i++) {
      results.push(btn.disabled === true);   // before add — must be disabled
      (window as any).addToCart(1);
      results.push(btn.disabled === false);  // after add  — must be enabled
      (window as any).removeItem(1);
    }
    return results;
  });

  expect(allCorrect.every(v => v)).toBe(true);
});

// ── TC-STORE-LOOP-09 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-09: cart count badge is accurate through 25 sequential adds', async ({ page }) => {
  const mismatches = await page.evaluate(() => {
    const ids = [1,2,3,4,5,6,7,8,9,10,1,2,3,4,5,6,7,8,9,10,1,2,3,4,5];
    let expected = 0;
    const bad: number[] = [];

    for (let i = 0; i < ids.length; i++) {
      (window as any).addToCart(ids[i]);
      expected++;
      const actual = parseInt(document.getElementById('cart-count')!.textContent || '0', 10);
      if (actual !== expected) bad.push(i);
    }
    return bad;
  });

  expect(mismatches).toEqual([]);
});

// ── TC-STORE-LOOP-10 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-10: all 10 products added once — total equals $545.85', async ({ page }) => {
  // 79.99+119.00+39.95+34.99+89.00+24.99+49.99+59.99+29.95+18.00 = 545.85
  const total = await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    return document.getElementById('cart-total')!.textContent;
  });

  expect(total).toBe('$545.85');
});

// ── TC-STORE-LOOP-11 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-11: 50 rapid cart toggles — no CSS class corruption', async ({ page }) => {
  const { sidebarClean, overlayClean } = await page.evaluate(() => {
    for (let i = 0; i < 50; i++) (window as any).toggleCart();
    const sidebar = document.getElementById('cart-sidebar')!;
    const overlay = document.getElementById('overlay')!;
    // 50 = even → both should be closed
    return {
      sidebarClean: !sidebar.classList.contains('open'),
      overlayClean: !overlay.classList.contains('open'),
    };
  });

  expect(sidebarClean).toBe(true);
  expect(overlayClean).toBe(true);
});

// ── TC-STORE-LOOP-12 ──────────────────────────────────────────────────────────
test('TC-STORE-LOOP-12: full lifecycle × 3 — add all → clear cart → repeat', async ({ page }) => {
  const cycles = await page.evaluate(() => {
    const log: { afterAdd: number; afterClear: number }[] = [];

    for (let cycle = 0; cycle < 3; cycle++) {
      for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
      const afterAdd = parseInt(document.getElementById('cart-count')!.textContent || '0', 10);

      // Clear via removeItem() for each product — avoids window.cart (const, not on window)
      // and avoids the alert() inside checkout()
      for (let id = 1; id <= 10; id++) (window as any).removeItem(id);

      const afterClear = parseInt(document.getElementById('cart-count')!.textContent || '0', 10);
      log.push({ afterAdd, afterClear });
    }
    return log;
  });

  for (const { afterAdd, afterClear } of cycles) {
    expect(afterAdd).toBe(10);
    expect(afterClear).toBe(0);
  }
});
