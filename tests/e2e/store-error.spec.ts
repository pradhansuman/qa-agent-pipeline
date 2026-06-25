/**
 * ShopNow — Negative / Error-Path Tests
 *
 * Tests every meaningful error condition, boundary, and guard that the happy-path
 * suite intentionally skips. If any of these fail it means a defensive guard was
 * removed or regressed.
 *
 * Coverage philosophy: for every public function verify what happens when the
 * inputs are wrong, the state is unexpected, or the operation is called out of
 * the normal sequence.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const URL = `file://${path.resolve(__dirname, '../../store.html')}`;

async function load(page: any) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.card');
}

// ── ERR-STORE-01 ──────────────────────────────────────────────────────────────
test('ERR-STORE-01 @smoke: addToCart() with unknown product ID is a no-op — no crash', async ({ page }) => {
  await load(page);

  // ID 999 does not exist in PRODUCTS — must not throw
  await page.evaluate(() => (window as any).addToCart(999));

  // Cart count stays 0, total stays $0.00
  expect(await page.locator('#cart-count').textContent()).toBe('0');
  const total = await page.locator('#cart-total').textContent();
  expect(total).toBe('$0.00');
  // No JS error thrown (page is still interactive)
  expect(await page.locator('.card').count()).toBe(10);
});

// ── ERR-STORE-02 ──────────────────────────────────────────────────────────────
test('ERR-STORE-02: removeItem() on an ID not in the cart is a no-op', async ({ page }) => {
  await load(page);
  await page.evaluate(() => (window as any).addToCart(1));

  // Remove an ID that was never added
  await page.evaluate(() => (window as any).removeItem(99));

  // Product 1 is still in the cart
  expect(await page.locator('#cart-count').textContent()).toBe('1');
});

// ── ERR-STORE-03 ──────────────────────────────────────────────────────────────
test('ERR-STORE-03: double removeItem() on the same ID is safe', async ({ page }) => {
  await load(page);
  await page.evaluate(() => (window as any).addToCart(2));

  await page.evaluate(() => (window as any).removeItem(2));
  // Second call on a deleted key must not crash
  await page.evaluate(() => (window as any).removeItem(2));

  expect(await page.locator('#cart-count').textContent()).toBe('0');
  expect(await page.locator('#cart-total').textContent()).toBe('$0.00');
});

// ── ERR-STORE-04 ──────────────────────────────────────────────────────────────
test('ERR-STORE-04: changeQty() with unknown product ID is a no-op — no NaN in total', async ({ page }) => {
  await load(page);

  // This would previously inject an unknown key and render $NaN
  await page.evaluate(() => (window as any).changeQty(999, 1));

  expect(await page.locator('#cart-count').textContent()).toBe('0');
  const total = await page.locator('#cart-total').textContent();
  expect(total).not.toContain('NaN');
  expect(total).toBe('$0.00');
});

// ── ERR-STORE-05 ──────────────────────────────────────────────────────────────
test('ERR-STORE-05: changeQty() decrement below zero removes item — count never goes negative', async ({ page }) => {
  await load(page);
  await page.evaluate(() => (window as any).addToCart(3)); // qty = 1

  // Decrement by 100 — should remove the item, not set qty to -99
  await page.evaluate(() => (window as any).changeQty(3, -100));

  expect(await page.locator('#cart-count').textContent()).toBe('0');
  expect(await page.locator('#cart-total').textContent()).toBe('$0.00');
});

// ── ERR-STORE-06 ──────────────────────────────────────────────────────────────
test('ERR-STORE-06: changeQty() to exactly zero removes item', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    (window as any).addToCart(4);
    (window as any).addToCart(4); // qty = 2
  });

  await page.evaluate(() => (window as any).changeQty(4, -2)); // qty → 0 → deleted

  expect(await page.locator('#cart-count').textContent()).toBe('0');
});

// ── ERR-STORE-07 ──────────────────────────────────────────────────────────────
test('ERR-STORE-07: checkout() on an empty cart is a no-op — no dialog, no crash', async ({ page }) => {
  await load(page);

  // Ensure no dialog fires (if checkout() didn't guard, alert() would hang the test)
  let dialogFired = false;
  page.on('dialog', async d => { dialogFired = true; await d.dismiss(); });

  await page.evaluate(() => (window as any).checkout());

  expect(dialogFired).toBe(false);
  expect(await page.locator('#cart-count').textContent()).toBe('0');
});

// ── ERR-STORE-08 ──────────────────────────────────────────────────────────────
test('ERR-STORE-08: double checkout() — second call is a no-op after cart is cleared', async ({ page }) => {
  await load(page);

  page.on('dialog', async d => d.accept());
  await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).toggleCart();
  });
  await page.evaluate(() => (window as any).checkout()); // clears cart
  await page.evaluate(() => (window as any).checkout()); // second call — must not crash

  expect(await page.locator('#cart-count').textContent()).toBe('0');
});

// ── ERR-STORE-09 ──────────────────────────────────────────────────────────────
test('ERR-STORE-09: cart total is never NaN after full add-then-remove sequence', async ({ page }) => {
  await load(page);

  await page.evaluate(() => {
    for (let id = 1; id <= 10; id++) (window as any).addToCart(id);
    for (let id = 1; id <= 10; id++) (window as any).removeItem(id);
  });

  const total = await page.locator('#cart-total').textContent();
  expect(total).not.toContain('NaN');
  expect(total).toBe('$0.00');
  expect(await page.locator('#cart-count').textContent()).toBe('0');
});

// ── ERR-STORE-10 ──────────────────────────────────────────────────────────────
test('ERR-STORE-10: adding same product 50 times accumulates qty correctly — price stays valid', async ({ page }) => {
  await load(page);

  // Add 1 item first to read the unit price from DOM, then add 49 more
  await page.evaluate(() => (window as any).addToCart(1));
  const unitTotalText = await page.locator('#cart-total').textContent() ?? '$0.00';
  const unitPrice = parseFloat(unitTotalText.replace('$', ''));

  await page.evaluate(() => {
    for (let i = 0; i < 49; i++) (window as any).addToCart(1);
  });

  const count = await page.locator('#cart-count').textContent();
  expect(Number(count)).toBe(50);

  const total = await page.locator('#cart-total').textContent();
  expect(total).not.toContain('NaN');
  expect(total).not.toContain('Infinity');
  const expectedTotal = `$${(unitPrice * 50).toFixed(2)}`;
  expect(total).toBe(expectedTotal);
});

// ── ERR-STORE-11 ──────────────────────────────────────────────────────────────
test('ERR-STORE-11: rapid toggleCart() calls leave cart in a consistent open/closed state', async ({ page }) => {
  await load(page);
  await page.evaluate(() => (window as any).addToCart(1));

  // 4 toggles (even) → should end closed
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) (window as any).toggleCart();
  });

  const sidebar = page.locator('#cart-sidebar');
  await expect(sidebar).not.toHaveClass(/open/);
  // aria-expanded must match visual state
  const expanded = await page.locator('#cart-btn').getAttribute('aria-expanded');
  expect(expanded).toBe('false');
});

// ── ERR-STORE-12 ──────────────────────────────────────────────────────────────
test('ERR-STORE-12: add → checkout → add again works correctly — cart is not permanently broken', async ({ page }) => {
  await load(page);

  // First purchase
  page.on('dialog', async d => d.accept());
  await page.evaluate(() => {
    (window as any).addToCart(5);
    (window as any).toggleCart();
  });
  await page.evaluate(() => (window as any).checkout());

  // Second purchase cycle
  await page.evaluate(() => (window as any).addToCart(6));

  expect(await page.locator('#cart-count').textContent()).toBe('1');
  expect(await page.locator('#cart-total').textContent()).not.toBe('$0.00');
  expect(await page.locator('#cart-total').textContent()).not.toContain('NaN');
});

// ── ERR-STORE-13 ──────────────────────────────────────────────────────────────
// BVA min: decrement from qty 1 removes item — count never goes below 0
test('ERR-STORE-13 BVA-min: decrement from qty 1 removes item completely', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const shop = new ShopNow(page);
  await shop.addToCart(0);
  await shop.openCart();
  expect(await shop.cartItems.count()).toBe(1);
  // Click the qty-decrease (or first button in cart item)
  await page.locator('.cart-item').first().locator('button').first().click();
  await page.waitForTimeout(500);
  expect(await shop.cartItems.count()).toBe(0);
  const badge = (await shop.cartBadge.textContent() || '').trim();
  expect(['0', '']).toContain(badge);
});

// ── ERR-STORE-14 ──────────────────────────────────────────────────────────────
// BVA max: 100 increments via JS — total must stay a valid finite number
test('ERR-STORE-14 BVA-max: qty incremented 100x keeps a finite, valid total', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const shop = new ShopNow(page);
  await shop.addToCart(0);
  await page.evaluate(() => {
    const id = (window as any).cart?.[0]?.id;
    if (!id) return;
    for (let i = 0; i < 99; i++) (window as any).changeQty(id, 1);
    if ((window as any).updateCartUI) (window as any).updateCartUI();
    else if ((window as any).renderCart) (window as any).renderCart();
  });
  await shop.openCart();
  await page.waitForTimeout(400);
  const totalText = (await shop.cartTotal.textContent() || '').replace(/[^0-9.]/g, '');
  const totalNum = parseFloat(totalText);
  expect(isNaN(totalNum)).toBe(false);
  expect(isFinite(totalNum)).toBe(true);
  expect(totalNum).toBeGreaterThan(0);
});

// ── ERR-STORE-15 ──────────────────────────────────────────────────────────────
// Decision table: checkout cycle × 2 — each cycle starts and ends clean
test('ERR-STORE-15 decision: two full checkout cycles each leave cart empty', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const shop = new ShopNow(page);
  for (let cycle = 1; cycle <= 2; cycle++) {
    await shop.addToCart(0);
    await shop.addToCart(1);
    await shop.openCart();
    await shop.checkout();
    await page.waitForTimeout(600);
    const badge = (await shop.cartBadge.textContent() || '').trim();
    expect(['0', '']).toContain(badge);
    const total = (await shop.cartTotal.textContent() || '');
    expect(total).toMatch(/\$0\.00|\$0/);
  }
});

// ── ERR-STORE-16 ──────────────────────────────────────────────────────────────
// Pairwise: 4 product × quantity pairs — total price matches unit × qty
for (const { idx, qty } of [{ idx: 0, qty: 1 }, { idx: 4, qty: 3 }, { idx: 9, qty: 2 }, { idx: 2, qty: 5 }]) {
  test('ERR-STORE-16 pairwise: product[' + idx + '] × qty ' + qty + ' total is accurate', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const shop = new ShopNow(page);
    const priceText = (await page.locator('[data-testid^="product-price-"]').nth(idx).textContent() || '0');
    const unitPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    // Add qty times
    for (let i = 0; i < qty; i++) {
      await page.locator('[data-testid^="add-to-cart-"]').nth(idx).click();
      await page.waitForTimeout(100);
    }
    await shop.openCart();
    await page.waitForTimeout(300);
    const totalText = (await shop.cartTotal.textContent() || '').replace(/[^0-9.]/g, '');
    const totalNum = parseFloat(totalText);
    const expected = Math.round(unitPrice * qty * 100) / 100;
    expect(Math.abs(totalNum - expected)).toBeLessThan(0.02);
  });
}
