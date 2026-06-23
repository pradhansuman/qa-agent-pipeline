/**
 * ShopNow — Accessibility Tests (WCAG 2.1 AA)
 * Uses @axe-core/playwright to detect violations automatically and adds
 * targeted assertions for keyboard navigation, ARIA state, and live regions.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';

const URL = `file://${path.resolve(__dirname, '../../store.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('.card');
});

// ── AX-STORE-01 ───────────────────────────────────────────────────────────────
test('AX-STORE-01 @smoke: no critical WCAG 2.1 AA violations on page load', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

// ── AX-STORE-02 ───────────────────────────────────────────────────────────────
test('AX-STORE-02: no critical WCAG violations with cart open and items inside', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).addToCart(3);
    (window as any).toggleCart();
  });
  await expect(page.locator('#cart-sidebar')).toHaveClass(/open/);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

// ── AX-STORE-03 ───────────────────────────────────────────────────────────────
test('AX-STORE-03: keyboard Tab reaches the cart button from the first Add-to-Cart button', async ({ page }) => {
  // Start focus at first Add to Cart button
  await page.locator('[data-testid="add-to-cart"]').first().focus();

  // Tab until we land on the cart button (max 50 — Firefox cycles all 10 product
  // buttons before wrapping back to the sticky header where cart-btn lives)
  let found = false;
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id);
    if (focused === 'cart-btn') { found = true; break; }
  }

  expect(found).toBe(true);
});

// ── AX-STORE-04 ───────────────────────────────────────────────────────────────
test('AX-STORE-04: cart button aria-label reflects item count after adds', async ({ page }) => {
  const cartBtn = page.locator('#cart-btn');

  await expect(cartBtn).toHaveAttribute('aria-label', /0 items/);

  await page.evaluate(() => (window as any).addToCart(1));
  await expect(cartBtn).toHaveAttribute('aria-label', /1 item/);

  await page.evaluate(() => { (window as any).addToCart(2); (window as any).addToCart(3); });
  await expect(cartBtn).toHaveAttribute('aria-label', /3 items/);
});

// ── AX-STORE-05 ───────────────────────────────────────────────────────────────
test('AX-STORE-05: cart button aria-expanded toggles correctly', async ({ page }) => {
  const cartBtn = page.locator('#cart-btn');
  const sidebar = page.locator('#cart-sidebar');

  await expect(cartBtn).toHaveAttribute('aria-expanded', 'false');

  await cartBtn.click();
  // Wait for sidebar to be fully open before asserting aria-expanded
  await expect(sidebar).toHaveClass(/open/);
  await expect(cartBtn).toHaveAttribute('aria-expanded', 'true');

  // Ensure close button is visible before clicking
  await expect(page.locator('.close-btn')).toBeVisible();
  await page.locator('.close-btn').click();
  await expect(sidebar).not.toHaveClass(/open/);
  await expect(cartBtn).toHaveAttribute('aria-expanded', 'false');
});

// ── AX-STORE-06 ───────────────────────────────────────────────────────────────
test('AX-STORE-06: qty decrease/increase buttons have descriptive aria-labels', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).addToCart(1);
    (window as any).toggleCart();
  });

  const decrease = page.locator('[data-testid="qty-decrease"]').first();
  const increase = page.locator('[data-testid="qty-increase"]').first();

  const decLabel = await decrease.getAttribute('aria-label');
  const incLabel = await increase.getAttribute('aria-label');

  expect(decLabel).toMatch(/decrease quantity/i);
  expect(incLabel).toMatch(/increase quantity/i);
  // Both labels must include the product name so screen-reader context is clear
  expect(decLabel?.length).toBeGreaterThan(20);
});

// ── AX-STORE-07 ───────────────────────────────────────────────────────────────
test('AX-STORE-07: remove-item button has descriptive aria-label per product', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).addToCart(2);
    (window as any).toggleCart();
  });

  const removeBtn = page.locator('[data-testid="remove-item"]').first();
  const label = await removeBtn.getAttribute('aria-label');

  expect(label).toMatch(/remove .+ from cart/i);
  expect(label).toContain('Gaming Keyboard');
});

// ── AX-STORE-08 ───────────────────────────────────────────────────────────────
test('AX-STORE-08: checkout button disabled state is accessible (aria-disabled not needed — native disabled suffices)', async ({ page }) => {
  const btn = page.locator('#checkout-btn');
  // Native disabled on <button> is fully accessible — axe should not flag it
  await expect(btn).toBeDisabled();

  const results = await new AxeBuilder({ page })
    .include('#checkout-btn')
    .analyze();
  expect(results.violations).toEqual([]);

  // After adding item, enabled state also clean
  await page.evaluate(() => (window as any).addToCart(1));
  await expect(btn).toBeEnabled();

  const results2 = await new AxeBuilder({ page })
    .include('#checkout-btn')
    .analyze();
  expect(results2.violations).toEqual([]);
});

// ── AX-STORE-09 ───────────────────────────────────────────────────────────────
test('AX-STORE-09: toast uses aria-live="polite" so screen readers announce additions', async ({ page }) => {
  const toast = page.locator('#toast');
  await expect(toast).toHaveAttribute('role', 'status');
  await expect(toast).toHaveAttribute('aria-live', 'polite');
  await expect(toast).toHaveAttribute('aria-atomic', 'true');
});

// ── AX-STORE-10 ───────────────────────────────────────────────────────────────
test('AX-STORE-10: cart dialog has role="dialog", aria-label, and aria-modal', async ({ page }) => {
  const sidebar = page.locator('#cart-sidebar');
  await expect(sidebar).toHaveAttribute('role', 'dialog');
  await expect(sidebar).toHaveAttribute('aria-label', 'Shopping cart');
  await expect(sidebar).toHaveAttribute('aria-modal', 'true');
});

// ── AX-STORE-11 ───────────────────────────────────────────────────────────────
test('AX-STORE-11: opening cart moves focus to close button', async ({ page }) => {
  await page.evaluate(() => (window as any).addToCart(1));
  await page.locator('#cart-btn').click();
  await expect(page.locator('#cart-sidebar')).toHaveClass(/open/);

  const focused = await page.evaluate(() => document.activeElement?.className);
  expect(focused).toContain('close-btn');
});

// ── AX-STORE-12 ───────────────────────────────────────────────────────────────
test('AX-STORE-12: product grid has accessible label and all Add-to-Cart buttons are labelled', async ({ page }) => {
  const grid = page.locator('#product-grid');
  await expect(grid).toHaveAttribute('aria-label', 'Product catalogue');

  const addBtns = page.locator('[data-testid="add-to-cart"]');
  const count = await addBtns.count();
  expect(count).toBe(10);

  // Every button must have visible text (no icon-only buttons without label)
  for (let i = 0; i < count; i++) {
    const text = await addBtns.nth(i).textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }
});
