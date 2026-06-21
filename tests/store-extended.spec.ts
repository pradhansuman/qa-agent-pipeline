import { test, expect, Page } from '@playwright/test';
import path from 'path';

const FILE_URL = `file://${path.resolve(__dirname, '..', 'store.html')}`;

async function openCart(page: Page) {
  await page.click('#cart-btn');
}

async function addProduct(page: Page, id: number) {
  await page.click(`#btn-${id}`);
}

test.beforeEach(async ({ page }) => {
  await page.goto(FILE_URL);
});

// ── CATEGORY 1: Product Display (TC-011 – TC-033) ─────────────────────────────

test.describe('Product Display', () => {
  test('TC-011: page has document title "Online Store"', async ({ page }) => {
    await expect(page).toHaveTitle('Online Store');
  });

  test('TC-012: header brand is "ShopNow"', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('ShopNow');
  });

  test('TC-013: subtitle reads "Shop Our Collection"', async ({ page }) => {
    await expect(page.locator('main h2')).toHaveText('Shop Our Collection');
  });

  test('TC-014: product 1 name is Wireless Headphones', async ({ page }) => {
    await expect(page.locator('.card-name').nth(0)).toHaveText('Wireless Headphones');
  });

  test('TC-015: product 2 name is Gaming Keyboard', async ({ page }) => {
    await expect(page.locator('.card-name').nth(1)).toHaveText('Gaming Keyboard');
  });

  test('TC-016: product 3 name is Portable Charger', async ({ page }) => {
    await expect(page.locator('.card-name').nth(2)).toHaveText('Portable Charger');
  });

  test('TC-017: product 4 name is Desk Lamp', async ({ page }) => {
    await expect(page.locator('.card-name').nth(3)).toHaveText('Desk Lamp');
  });

  test('TC-018: product 5 name is Running Shoes', async ({ page }) => {
    await expect(page.locator('.card-name').nth(4)).toHaveText('Running Shoes');
  });

  test('TC-019: product 6 name is Stainless Water Bottle', async ({ page }) => {
    await expect(page.locator('.card-name').nth(5)).toHaveText('Stainless Water Bottle');
  });

  test('TC-020: product 7 name is Yoga Mat', async ({ page }) => {
    await expect(page.locator('.card-name').nth(6)).toHaveText('Yoga Mat');
  });

  test('TC-021: product 8 name is Bluetooth Speaker', async ({ page }) => {
    await expect(page.locator('.card-name').nth(7)).toHaveText('Bluetooth Speaker');
  });

  test('TC-022: product 9 name is UV Sunglasses', async ({ page }) => {
    await expect(page.locator('.card-name').nth(8)).toHaveText('UV Sunglasses');
  });

  test('TC-023: product 10 name is Notebook Set', async ({ page }) => {
    await expect(page.locator('.card-name').nth(9)).toHaveText('Notebook Set');
  });

  test('TC-024: product 1 price is $79.99', async ({ page }) => {
    await expect(page.locator('.card-price').nth(0)).toHaveText('$79.99');
  });

  test('TC-025: product 2 price is $119.00', async ({ page }) => {
    await expect(page.locator('.card-price').nth(1)).toHaveText('$119.00');
  });

  test('TC-026: product 3 price is $39.95', async ({ page }) => {
    await expect(page.locator('.card-price').nth(2)).toHaveText('$39.95');
  });

  test('TC-027: product 4 price is $34.99', async ({ page }) => {
    await expect(page.locator('.card-price').nth(3)).toHaveText('$34.99');
  });

  test('TC-028: product 5 price is $89.00', async ({ page }) => {
    await expect(page.locator('.card-price').nth(4)).toHaveText('$89.00');
  });

  test('TC-029: product 6 price is $24.99', async ({ page }) => {
    await expect(page.locator('.card-price').nth(5)).toHaveText('$24.99');
  });

  test('TC-030: product 7 price is $49.99', async ({ page }) => {
    await expect(page.locator('.card-price').nth(6)).toHaveText('$49.99');
  });

  test('TC-031: product 8 price is $59.99', async ({ page }) => {
    await expect(page.locator('.card-price').nth(7)).toHaveText('$59.99');
  });

  test('TC-032: product 9 price is $29.95', async ({ page }) => {
    await expect(page.locator('.card-price').nth(8)).toHaveText('$29.95');
  });

  test('TC-033: product 10 price is $18.00', async ({ page }) => {
    await expect(page.locator('.card-price').nth(9)).toHaveText('$18.00');
  });
});

// ── CATEGORY 2: Initial Cart State (TC-034 – TC-040) ─────────────────────────

test.describe('Initial Cart State', () => {
  test('TC-034: cart total is $0.00 on load', async ({ page }) => {
    await expect(page.locator('#cart-total')).toHaveText('$0.00');
  });

  test('TC-035: cart sidebar heading is "Shopping Cart"', async ({ page }) => {
    await expect(page.locator('.cart-header h3')).toHaveText('Shopping Cart');
  });

  test('TC-036: cart shows empty message on load', async ({ page }) => {
    await openCart(page);
    await expect(page.locator('.cart-empty')).toBeVisible();
  });

  test('TC-037: cart overlay does not have class "open" on load', async ({ page }) => {
    await expect(page.locator('#overlay')).not.toHaveClass(/open/);
  });

  test('TC-038: all 10 Buy Now buttons are present', async ({ page }) => {
    await expect(page.locator('.add-btn')).toHaveCount(10);
  });

  test('TC-039: every Buy Now button shows correct label text', async ({ page }) => {
    const buttons = page.locator('.add-btn');
    for (let i = 0; i < 10; i++) {
      await expect(buttons.nth(i)).toHaveText('Buy Now');
    }
  });

  test('TC-040: header cart button shows "🛒 (0)" on load', async ({ page }) => {
    await expect(page.locator('#cart-btn')).toContainText('🛒');
    await expect(page.locator('#cart-count')).toHaveText('0');
  });
});

// ── CATEGORY 3: Add to Cart (TC-041 – TC-060) ────────────────────────────────

test.describe('Add to Cart', () => {
  test('TC-041: adding product 2 sets cart count to 1', async ({ page }) => {
    await addProduct(page, 2);
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-042: adding product 4 sets cart count to 1', async ({ page }) => {
    await addProduct(page, 4);
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-043: adding products 1 and 2 sets cart count to 2', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 2);
    await expect(page.locator('#cart-count')).toHaveText('2');
  });

  test('TC-044: adding product 1 twice sets cart count to 2', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 1);
    await expect(page.locator('#cart-count')).toHaveText('2');
  });

  test('TC-045: adding all 10 products sets cart count to 10', async ({ page }) => {
    for (let i = 1; i <= 10; i++) await addProduct(page, i);
    await expect(page.locator('#cart-count')).toHaveText('10');
  });

  test('TC-046: adding product 1 shows $79.99 cart total', async ({ page }) => {
    await addProduct(page, 1);
    await expect(page.locator('#cart-total')).toHaveText('$79.99');
  });

  test('TC-047: adding product 10 shows $18.00 cart total', async ({ page }) => {
    await addProduct(page, 10);
    await expect(page.locator('#cart-total')).toHaveText('$18.00');
  });

  test('TC-048: adding products 1 and 10 shows $97.99 total', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 10);
    await expect(page.locator('#cart-total')).toHaveText('$97.99');
  });

  test('TC-049: cart item shows price per unit label', async ({ page }) => {
    await addProduct(page, 3);
    await openCart(page);
    await expect(page.locator('.cart-item-price')).toContainText('$39.95 each');
  });

  test('TC-050: newly added item starts with qty of 1', async ({ page }) => {
    await addProduct(page, 5);
    await openCart(page);
    await expect(page.locator('.qty-ctrl span')).toHaveText('1');
  });

  test('TC-051: adding same item twice shows qty 2 in a single row', async ({ page }) => {
    await addProduct(page, 6);
    await addProduct(page, 6);
    await openCart(page);
    await expect(page.locator('.cart-item')).toHaveCount(1);
    await expect(page.locator('.qty-ctrl span')).toHaveText('2');
  });

  test('TC-052: two different items appear as separate cart rows', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 2);
    await openCart(page);
    await expect(page.locator('.cart-item')).toHaveCount(2);
  });

  test('TC-053: checkout button is enabled after adding product 3', async ({ page }) => {
    await addProduct(page, 3);
    await expect(page.locator('#checkout-btn')).toBeEnabled();
  });

  test('TC-054: checkout button is enabled after adding product 7', async ({ page }) => {
    await addProduct(page, 7);
    await expect(page.locator('#checkout-btn')).toBeEnabled();
  });

  test('TC-055: adding product 4 shows Desk Lamp in sidebar', async ({ page }) => {
    await addProduct(page, 4);
    await openCart(page);
    await expect(page.locator('.cart-item-name')).toContainText('Desk Lamp');
  });

  test('TC-056: adding product 6 shows Stainless Water Bottle in sidebar', async ({ page }) => {
    await addProduct(page, 6);
    await openCart(page);
    await expect(page.locator('.cart-item-name')).toContainText('Stainless Water Bottle');
  });

  test('TC-057: cart total is $34.99 after adding product 4', async ({ page }) => {
    await addProduct(page, 4);
    await expect(page.locator('#cart-total')).toHaveText('$34.99');
  });

  test('TC-058: cart total is $49.99 after adding product 7', async ({ page }) => {
    await addProduct(page, 7);
    await expect(page.locator('#cart-total')).toHaveText('$49.99');
  });

  test('TC-059: cart item row contains quantity controls', async ({ page }) => {
    await addProduct(page, 8);
    await openCart(page);
    await expect(page.locator('.qty-ctrl')).toBeVisible();
  });

  test('TC-060: cart item row contains a remove button', async ({ page }) => {
    await addProduct(page, 9);
    await openCart(page);
    await expect(page.locator('.remove-btn')).toBeVisible();
  });
});

// ── CATEGORY 4: Cart Sidebar (TC-061 – TC-070) ───────────────────────────────

test.describe('Cart Sidebar', () => {
  test('TC-061: overlay gets class "open" when cart opens', async ({ page }) => {
    await openCart(page);
    await expect(page.locator('#overlay')).toHaveClass(/open/);
  });

  test('TC-062: clicking the overlay closes the sidebar', async ({ page }) => {
    await openCart(page);
    await page.click('#overlay');
    await expect(page.locator('#cart-sidebar')).not.toHaveClass(/open/);
  });

  test('TC-063: cart sidebar has a close button', async ({ page }) => {
    await openCart(page);
    await expect(page.locator('.close-btn')).toBeVisible();
  });

  test('TC-064: cart button opens the sidebar', async ({ page }) => {
    await openCart(page);
    await expect(page.locator('#cart-sidebar')).toHaveClass(/open/);
  });

  test('TC-065: × button closes the sidebar', async ({ page }) => {
    await openCart(page);
    await page.click('.close-btn');
    await expect(page.locator('#cart-sidebar')).not.toHaveClass(/open/);
  });

  test('TC-066: sidebar loses class "open" after clicking ×', async ({ page }) => {
    await openCart(page);
    await page.click('.close-btn');
    await expect(page.locator('#cart-sidebar')).not.toHaveClass(/open/);
  });

  test('TC-067: overlay loses class "open" after closing cart', async ({ page }) => {
    await openCart(page);
    await page.click('.close-btn');
    await expect(page.locator('#overlay')).not.toHaveClass(/open/);
  });

  test('TC-068: header cart button shows 🛒 with updated item count', async ({ page }) => {
    await addProduct(page, 1);
    await expect(page.locator('#cart-btn')).toContainText('🛒');
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-069: cart can be opened and closed multiple times', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await openCart(page);
      await expect(page.locator('#cart-sidebar')).toHaveClass(/open/);
      await page.click('.close-btn');
      await expect(page.locator('#cart-sidebar')).not.toHaveClass(/open/);
    }
  });

  test('TC-070: cart sidebar heading reads "Shopping Cart"', async ({ page }) => {
    await openCart(page);
    await expect(page.locator('.cart-header h3')).toHaveText('Shopping Cart');
  });
});

// ── CATEGORY 5: Quantity Controls (TC-071 – TC-080) ──────────────────────────

test.describe('Quantity Controls', () => {
  test('TC-071: + increases quantity from 1 to 2', async ({ page }) => {
    await addProduct(page, 1);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await expect(page.locator('.qty-ctrl span')).toHaveText('2');
  });

  test('TC-072: + increases quantity from 2 to 3', async ({ page }) => {
    await addProduct(page, 1);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await page.locator('.qty-ctrl button').last().click();
    await expect(page.locator('.qty-ctrl span')).toHaveText('3');
  });

  test('TC-073: − decreases quantity from 2 to 1', async ({ page }) => {
    await addProduct(page, 1);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await page.locator('.qty-ctrl button').first().click();
    await expect(page.locator('.qty-ctrl span')).toHaveText('1');
  });

  test('TC-074: − removes item when quantity reaches 0', async ({ page }) => {
    await addProduct(page, 2);
    await openCart(page);
    await page.locator('.qty-ctrl button').first().click();
    await expect(page.locator('.cart-empty')).toBeVisible();
  });

  test('TC-075: cart count reflects quantity increase', async ({ page }) => {
    await addProduct(page, 3);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await expect(page.locator('#cart-count')).toHaveText('2');
  });

  test('TC-076: cart count reflects quantity decrease', async ({ page }) => {
    await addProduct(page, 3);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await page.locator('.qty-ctrl button').first().click();
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-077: total doubles when qty goes 1 → 2 for product 10 ($18 → $36)', async ({ page }) => {
    await addProduct(page, 10);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await expect(page.locator('#cart-total')).toHaveText('$36.00');
  });

  test('TC-078: total halves when qty goes 2 → 1 for product 10 ($36 → $18)', async ({ page }) => {
    await addProduct(page, 10);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await page.locator('.qty-ctrl button').first().click();
    await expect(page.locator('#cart-total')).toHaveText('$18.00');
  });

  test('TC-079: 3× product 3 at $39.95 shows total of $119.85', async ({ page }) => {
    await addProduct(page, 3);
    await openCart(page);
    await page.locator('.qty-ctrl button').last().click();
    await page.locator('.qty-ctrl button').last().click();
    await expect(page.locator('#cart-total')).toHaveText('$119.85');
  });

  test('TC-080: qty span shows 5 after four consecutive increments', async ({ page }) => {
    await addProduct(page, 4);
    await openCart(page);
    for (let i = 0; i < 4; i++) {
      await page.locator('.qty-ctrl button').last().click();
    }
    await expect(page.locator('.qty-ctrl span')).toHaveText('5');
  });
});

// ── CATEGORY 6: Remove Item (TC-081 – TC-090) ────────────────────────────────

test.describe('Remove Item', () => {
  test('TC-081: removing the only item shows the empty cart message', async ({ page }) => {
    await addProduct(page, 5);
    await openCart(page);
    await page.locator('.remove-btn').click();
    await expect(page.locator('.cart-empty')).toBeVisible();
  });

  test('TC-082: removing one of two items leaves one row', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 2);
    await openCart(page);
    await page.locator('.remove-btn').first().click();
    await expect(page.locator('.cart-item')).toHaveCount(1);
  });

  test('TC-083: cart count decreases after removing an item', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 2);
    await openCart(page);
    await page.locator('.remove-btn').first().click();
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-084: total drops to $0.00 after removing the only item', async ({ page }) => {
    await addProduct(page, 6);
    await openCart(page);
    await page.locator('.remove-btn').click();
    await expect(page.locator('#cart-total')).toHaveText('$0.00');
  });

  test('TC-085: checkout button is disabled after removing all items', async ({ page }) => {
    await addProduct(page, 7);
    await openCart(page);
    await page.locator('.remove-btn').click();
    await expect(page.locator('#checkout-btn')).toBeDisabled();
  });

  test('TC-086: empty message reads "No items in cart yet."', async ({ page }) => {
    await addProduct(page, 8);
    await openCart(page);
    await page.locator('.remove-btn').click();
    await expect(page.locator('.cart-empty')).toContainText('No items in cart yet.');
  });

  test('TC-087: remaining item has correct total after removing one of two', async ({ page }) => {
    await addProduct(page, 9);  // $29.95
    await addProduct(page, 10); // $18.00
    await openCart(page);
    await page.locator('.remove-btn').first().click();
    await expect(page.locator('#cart-total')).toHaveText('$18.00');
  });

  test('TC-088: can add an item back after removing it', async ({ page }) => {
    await addProduct(page, 1);
    await openCart(page);
    await page.locator('.remove-btn').click();
    await page.click('.close-btn');
    await addProduct(page, 1);
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-089: remove button has title attribute "Delete item"', async ({ page }) => {
    await addProduct(page, 2);
    await openCart(page);
    await expect(page.locator('.remove-btn')).toHaveAttribute('title', 'Delete item');
  });

  test('TC-090: cart count shows 0 after removing all items one by one', async ({ page }) => {
    await addProduct(page, 3);
    await addProduct(page, 4);
    await openCart(page);
    await page.locator('.remove-btn').first().click();
    await page.locator('.remove-btn').first().click();
    await expect(page.locator('#cart-count')).toHaveText('0');
  });
});

// ── CATEGORY 7: Toast Notifications (TC-091 – TC-097) ────────────────────────

test.describe('Toast Notifications', () => {
  test('TC-091: toast appears when adding product 4 (Desk Lamp)', async ({ page }) => {
    await addProduct(page, 4);
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('TC-092: toast appears when adding product 7 (Yoga Mat)', async ({ page }) => {
    await addProduct(page, 7);
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('TC-093: toast appears when adding product 9 (UV Sunglasses)', async ({ page }) => {
    await addProduct(page, 9);
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('TC-094: toast element with class "show" is visible after adding', async ({ page }) => {
    await addProduct(page, 1);
    await expect(page.locator('#toast.show')).toBeVisible();
  });

  test('TC-095: toast text contains product 2 name (Gaming Keyboard)', async ({ page }) => {
    await addProduct(page, 2);
    await expect(page.locator('#toast')).toContainText('Gaming Keyboard');
  });

  test('TC-096: toast text contains product 8 name (Bluetooth Speaker)', async ({ page }) => {
    await addProduct(page, 8);
    await expect(page.locator('#toast')).toContainText('Bluetooth Speaker');
  });

  test('TC-097: toast loses class "show" after the 2-second timeout', async ({ page }) => {
    await addProduct(page, 5);
    await expect(page.locator('#toast')).toHaveClass(/show/);
    await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 3500 });
  });
});

// ── CATEGORY 8: Checkout (TC-098 – TC-110) ───────────────────────────────────

test.describe('Checkout', () => {
  test('TC-098: checkout button text is "Complete Purchase"', async ({ page }) => {
    await expect(page.locator('#checkout-btn')).toHaveText('Complete Purchase');
  });

  test('TC-099: checkout clears cart count to 0', async ({ page }) => {
    await addProduct(page, 1);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('#cart-count')).toHaveText('0');
  });

  test('TC-100: checkout closes the cart sidebar', async ({ page }) => {
    await addProduct(page, 2);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('#cart-sidebar')).not.toHaveClass(/open/);
  });

  test('TC-101: cart shows empty state after checkout', async ({ page }) => {
    await addProduct(page, 3);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('.cart-empty')).toBeVisible();
  });

  test('TC-102: checkout button is disabled after completing checkout', async ({ page }) => {
    await addProduct(page, 4);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('#checkout-btn')).toBeDisabled();
  });

  test('TC-103: cart total resets to $0.00 after checkout', async ({ page }) => {
    await addProduct(page, 5);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('#cart-total')).toHaveText('$0.00');
  });

  test('TC-104: can add items again after checkout', async ({ page }) => {
    await addProduct(page, 1);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await addProduct(page, 2);
    await expect(page.locator('#cart-count')).toHaveText('1');
  });

  test('TC-105: checkout with multiple items clears the entire cart', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 2);
    await addProduct(page, 3);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('#cart-count')).toHaveText('0');
  });

  test('TC-106: checkout dialog message contains the item name', async ({ page }) => {
    await addProduct(page, 1); // Wireless Headphones
    await openCart(page);
    let capturedMsg = '';
    page.on('dialog', async d => { capturedMsg = d.message(); await d.accept(); });
    await page.click('#checkout-btn');
    await expect(page.locator('#cart-count')).toHaveText('0');
    expect(capturedMsg).toContain('Wireless Headphones');
  });

  test('TC-107: checkout dialog message contains the total price', async ({ page }) => {
    await addProduct(page, 1); // $79.99
    await openCart(page);
    let capturedMsg = '';
    page.on('dialog', async d => { capturedMsg = d.message(); await d.accept(); });
    await page.click('#checkout-btn');
    await expect(page.locator('#cart-count')).toHaveText('0');
    expect(capturedMsg).toContain('$79.99');
  });

  test('TC-108: adding 5 different products results in cart count of 5', async ({ page }) => {
    for (let i = 1; i <= 5; i++) await addProduct(page, i);
    await expect(page.locator('#cart-count')).toHaveText('5');
  });

  test('TC-109: three different items show three rows in the cart', async ({ page }) => {
    await addProduct(page, 1);
    await addProduct(page, 5);
    await addProduct(page, 9);
    await openCart(page);
    await expect(page.locator('.cart-item')).toHaveCount(3);
  });

  test('TC-110: cart overlay closes after checkout completes', async ({ page }) => {
    await addProduct(page, 2);
    await openCart(page);
    page.on('dialog', d => d.accept());
    await page.click('#checkout-btn');
    await expect(page.locator('#overlay')).not.toHaveClass(/open/);
  });
});
