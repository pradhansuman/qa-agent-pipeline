import { test, expect, Page } from '@playwright/test';
import path from 'path';

const FILE_URL = `file://${path.resolve(__dirname, '..', 'store.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(FILE_URL);
});

// ── TC-001 ───────────────────────────────────────────────────────
test('TC-001: page renders exactly 10 product cards', async ({ page }) => {
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(10);
});

// ── TC-002 ───────────────────────────────────────────────────────
test('TC-002: cart count starts at 0 and checkout button is disabled', async ({ page }) => {
  await expect(page.locator('#cart-count')).toHaveText('0');
  await expect(page.locator('#checkout-btn')).toBeDisabled();
});

// ── TC-003 ───────────────────────────────────────────────────────
test('TC-003: cart sidebar is closed on page load', async ({ page }) => {
  const sidebar = page.locator('#cart-sidebar');
  await expect(sidebar).not.toHaveClass(/open/);
});

// ── TC-004 ───────────────────────────────────────────────────────
test('TC-004: cart sidebar opens and closes via the cart button', async ({ page }) => {
  const sidebar = page.locator('#cart-sidebar');

  await page.click('#cart-btn');
  await expect(sidebar).toHaveClass(/open/);

  await page.locator('.close-btn').click();
  await expect(sidebar).not.toHaveClass(/open/);
});

// ── TC-005 ───────────────────────────────────────────────────────
test('TC-005: adding a product increments the cart count and enables checkout', async ({ page }) => {
  await page.click('#btn-1');
  await expect(page.locator('#cart-count')).toHaveText('1');
  await expect(page.locator('#checkout-btn')).toBeEnabled();
});

// ── TC-006 ───────────────────────────────────────────────────────
test('TC-006: toast notification appears with the product name after adding to cart', async ({ page }) => {
  await page.click('#btn-1');
  const toast = page.locator('#toast');
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toContainText('Wireless Headphones');
});

// ── TC-007 ───────────────────────────────────────────────────────
test('TC-007: Buy Now button temporarily shows "Added!" then reverts', async ({ page }) => {
  const btn = page.locator('#btn-1');
  await btn.click();
  await expect(btn).toHaveText('Added!');
  await expect(btn).toHaveText('Buy Now', { timeout: 2000 });
});

// ── TC-008 ───────────────────────────────────────────────────────
test('TC-008: cart shows the correct item name and total after adding a product', async ({ page }) => {
  await page.click('#btn-3'); // Portable Charger — $39.95
  await page.click('#cart-btn');

  await expect(page.locator('.cart-item-name')).toContainText('Portable Charger');
  await expect(page.locator('#cart-total')).toHaveText('$39.95');
});

// ── TC-009 ───────────────────────────────────────────────────────
test('TC-009: quantity controls increase and decrease item count in cart', async ({ page }) => {
  await page.click('#btn-2'); // Gaming Keyboard
  await page.click('#cart-btn');

  const qtySpan = page.locator('.qty-ctrl span');
  await expect(qtySpan).toHaveText('1');

  await page.locator('.qty-ctrl button:nth-child(3)').click();
  await expect(qtySpan).toHaveText('2');
  await expect(page.locator('#cart-count')).toHaveText('2');

  await page.locator('.qty-ctrl button:nth-child(1)').click();
  await expect(qtySpan).toHaveText('1');
  await expect(page.locator('#cart-count')).toHaveText('1');
});

// ── TC-010 ───────────────────────────────────────────────────────
test('TC-010: removing an item empties the cart and disables checkout', async ({ page }) => {
  await page.click('#btn-5'); // Running Shoes
  await page.click('#cart-btn');

  await expect(page.locator('.cart-item')).toHaveCount(1);

  await page.locator('.remove-btn').click();

  await expect(page.locator('.cart-empty')).toBeVisible();
  await expect(page.locator('#cart-count')).toHaveText('0');
  await expect(page.locator('#checkout-btn')).toBeDisabled();
});
