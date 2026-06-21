/**
 * POM-based test suite — critical paths for ShopNow store.
 * Page Objects (StorePage + CartSidebar) are defined in this file
 * to avoid cross-directory import issues with this project's toolchain.
 */
import { test, expect, Page, Locator } from '@playwright/test';
import path from 'path';

// ── Test data ──────────────────────────────────────────────────────────────

const STORE_URL = `file://${path.resolve(__dirname, '..', 'store.html')}`;

interface Product { id: number; name: string; price: number; }

const PRODUCTS: Product[] = [
  { id: 1,  name: 'Wireless Headphones',   price: 79.99  },
  { id: 2,  name: 'Gaming Keyboard',        price: 119.00 },
  { id: 3,  name: 'Portable Charger',       price: 39.95  },
  { id: 4,  name: 'Desk Lamp',              price: 34.99  },
  { id: 5,  name: 'Running Shoes',          price: 89.00  },
  { id: 6,  name: 'Stainless Water Bottle', price: 24.99  },
  { id: 7,  name: 'Yoga Mat',               price: 49.99  },
  { id: 8,  name: 'Bluetooth Speaker',      price: 59.99  },
  { id: 9,  name: 'UV Sunglasses',          price: 29.95  },
  { id: 10, name: 'Notebook Set',           price: 18.00  },
];

function fmt(price: number): string {
  return `$${price.toFixed(2)}`;
}

// ── Page Objects ───────────────────────────────────────────────────────────

class CartSidebar {
  readonly sidebar:     Locator;
  readonly overlay:     Locator;
  readonly heading:     Locator;
  readonly closeBtn:    Locator;
  readonly emptyMsg:    Locator;
  readonly total:       Locator;
  readonly checkoutBtn: Locator;

  constructor(private readonly page: Page) {
    this.sidebar     = page.locator('#cart-sidebar');
    this.overlay     = page.locator('#overlay');
    this.heading     = page.locator('.cart-header h3');
    this.closeBtn    = page.locator('.close-btn');
    this.emptyMsg    = page.locator('.cart-empty');
    this.total       = page.locator('#cart-total');
    this.checkoutBtn = page.locator('#checkout-btn');
  }

  async open() {
    await this.page.click('#cart-btn');
    await expect(this.sidebar).toHaveClass(/open/);
  }

  async close() {
    await this.closeBtn.click();
    await expect(this.sidebar).not.toHaveClass(/open/);
  }

  async closeViaOverlay() {
    await this.overlay.click();
    await expect(this.sidebar).not.toHaveClass(/open/);
  }

  items()                { return this.page.locator('.cart-item'); }
  itemRow(n: number)     { return this.items().nth(n); }
  qtySpan(n: number)     { return this.itemRow(n).locator('.qty-ctrl span'); }
  incBtn(n: number)      { return this.itemRow(n).locator('.qty-ctrl button').last(); }
  decBtn(n: number)      { return this.itemRow(n).locator('.qty-ctrl button').first(); }
  removeBtn(n: number)   { return this.itemRow(n).locator('.remove-btn'); }

  async increment(row = 0) { await this.incBtn(row).click(); }
  async decrement(row = 0) { await this.decBtn(row).click(); }
  async removeItem(row = 0){ await this.removeBtn(row).click(); }

  async checkout(): Promise<string> {
    let msg = '';
    this.page.on('dialog', async d => { msg = d.message(); await d.accept(); });
    await this.checkoutBtn.click();
    await expect(this.page.locator('#cart-count')).toHaveText('0');
    return msg;
  }

  async expectTotal(v: string)  { await expect(this.total).toHaveText(v); }
  async expectItemCount(n: number) { await expect(this.items()).toHaveCount(n); }
  async expectEmpty() { await expect(this.emptyMsg).toBeVisible(); }
}

class StorePage {
  readonly cartCount: Locator;
  readonly toast:     Locator;
  readonly cart:      CartSidebar;

  constructor(private readonly page: Page) {
    this.cartCount = page.locator('#cart-count');
    this.toast     = page.locator('#toast');
    this.cart      = new CartSidebar(page);
  }

  async navigate()          { await this.page.goto(STORE_URL); }
  cards()                   { return this.page.locator('.card'); }
  cardNames()               { return this.page.locator('.card-name'); }
  cardPrices()              { return this.page.locator('.card-price'); }
  addButtons()              { return this.page.locator('.add-btn'); }
  addButtonById(id: number) { return this.page.locator(`#btn-${id}`); }

  async addProduct(id: number) { await this.addButtonById(id).click(); }
  async addAllProducts() { for (const p of PRODUCTS) await this.addProduct(p.id); }

  async expectCartCount(n: number) { await expect(this.cartCount).toHaveText(String(n)); }

  async expectToastVisible()               { await expect(this.toast).toHaveClass(/show/); }
  async expectToastText(text: string)      { await expect(this.toast).toContainText(text); }
  async expectToastDismissed(ms = 3500)    { await expect(this.toast).not.toHaveClass(/show/, { timeout: ms }); }

  async expectButtonFlash(id: number) {
    const btn = this.addButtonById(id);
    await expect(btn).toHaveText('Added!');
    await expect(btn).toHaveText('Buy Now', { timeout: 2000 });
  }
}

// ── Test fixture ───────────────────────────────────────────────────────────

const storeTest = test.extend<{ store: StorePage }>({
  store: async ({ page }, use) => {
    const s = new StorePage(page);
    await s.navigate();
    await use(s);
  },
});

// ── Test suites ────────────────────────────────────────────────────────────

storeTest.describe('POM — Product Grid', () => {
  storeTest('renders 10 product cards', async ({ store }) => {
    await expect(store.cards()).toHaveCount(10);
  });

  storeTest('all product names match catalog', async ({ store }) => {
    const names = store.cardNames();
    for (let i = 0; i < PRODUCTS.length; i++) {
      await expect(names.nth(i)).toHaveText(PRODUCTS[i].name);
    }
  });

  storeTest('all product prices match catalog', async ({ store }) => {
    const prices = store.cardPrices();
    for (let i = 0; i < PRODUCTS.length; i++) {
      await expect(prices.nth(i)).toHaveText(fmt(PRODUCTS[i].price));
    }
  });

  storeTest('all Buy Now buttons present with correct label', async ({ store }) => {
    const btns = store.addButtons();
    await expect(btns).toHaveCount(10);
    for (let i = 0; i < 10; i++) {
      await expect(btns.nth(i)).toHaveText('Buy Now');
    }
  });
});

storeTest.describe('POM — Initial State', () => {
  storeTest('cart count is 0 and checkout disabled', async ({ store }) => {
    await store.expectCartCount(0);
    await expect(store.cart.checkoutBtn).toBeDisabled();
  });

  storeTest('sidebar is closed', async ({ store }) => {
    await expect(store.cart.sidebar).not.toHaveClass(/open/);
  });

  storeTest('empty cart message visible when sidebar opened', async ({ store }) => {
    await store.cart.open();
    await store.cart.expectEmpty();
  });

  storeTest('cart heading reads "Shopping Cart"', async ({ store }) => {
    await expect(store.cart.heading).toHaveText('Shopping Cart');
  });

  storeTest('checkout button reads "Complete Purchase"', async ({ store }) => {
    await expect(store.cart.checkoutBtn).toHaveText('Complete Purchase');
  });
});

storeTest.describe('POM — Add to Cart', () => {
  storeTest('adding one product increments count and enables checkout', async ({ store }) => {
    await store.addProduct(1);
    await store.expectCartCount(1);
    await expect(store.cart.checkoutBtn).toBeEnabled();
  });

  storeTest('adding same product twice merges into one row with qty 2', async ({ store }) => {
    await store.addProduct(3);
    await store.addProduct(3);
    await store.cart.open();
    await store.cart.expectItemCount(1);
    await expect(store.cart.qtySpan(0)).toHaveText('2');
  });

  storeTest('two different products create two rows', async ({ store }) => {
    await store.addProduct(1);
    await store.addProduct(2);
    await store.cart.open();
    await store.cart.expectItemCount(2);
  });

  storeTest('single-product total is correct', async ({ store }) => {
    const p = PRODUCTS[0];
    await store.addProduct(p.id);
    await store.cart.expectTotal(fmt(p.price));
  });

  storeTest('two-product total is correct', async ({ store }) => {
    const [p1, p2] = [PRODUCTS[0], PRODUCTS[9]];
    await store.addProduct(p1.id);
    await store.addProduct(p2.id);
    await store.cart.expectTotal(fmt(+(p1.price + p2.price).toFixed(2)));
  });

  storeTest('all-10-products total matches catalog sum', async ({ store }) => {
    await store.addAllProducts();
    const sum = PRODUCTS.reduce((s, p) => s + p.price, 0);
    await store.cart.expectTotal(fmt(+sum.toFixed(2)));
  });
});

storeTest.describe('POM — Toast', () => {
  storeTest('toast is visible after adding a product', async ({ store }) => {
    await store.addProduct(1);
    await store.expectToastVisible();
  });

  storeTest('toast contains the product name', async ({ store }) => {
    const p = PRODUCTS[1];
    await store.addProduct(p.id);
    await store.expectToastText(p.name);
  });

  storeTest('toast auto-dismisses after 2 s', async ({ store }) => {
    await store.addProduct(5);
    await store.expectToastVisible();
    await store.expectToastDismissed();
  });
});

storeTest.describe('POM — Buy Now Flash', () => {
  storeTest('button shows "Added!" then reverts to "Buy Now"', async ({ store }) => {
    await store.addProduct(1);
    await store.expectButtonFlash(1);
  });
});

storeTest.describe('POM — Cart Sidebar', () => {
  storeTest('opens via cart button', async ({ store }) => {
    await store.cart.open();
    await expect(store.cart.sidebar).toHaveClass(/open/);
  });

  storeTest('closes via × button', async ({ store }) => {
    await store.cart.open();
    await store.cart.close();
    await expect(store.cart.sidebar).not.toHaveClass(/open/);
  });

  storeTest('closes via overlay click', async ({ store }) => {
    await store.cart.open();
    await store.cart.closeViaOverlay();
    await expect(store.cart.sidebar).not.toHaveClass(/open/);
  });

  storeTest('overlay hidden when sidebar closed', async ({ store }) => {
    await store.cart.open();
    await store.cart.close();
    await expect(store.cart.overlay).not.toHaveClass(/open/);
  });

  storeTest('badge count updates after adding item', async ({ store }) => {
    await store.addProduct(2);
    await store.expectCartCount(1);
  });
});

storeTest.describe('POM — Quantity Controls', () => {
  storeTest('increment increases qty and total', async ({ store }) => {
    const p = PRODUCTS[9];
    await store.addProduct(p.id);
    await store.cart.open();
    await store.cart.increment(0);
    await expect(store.cart.qtySpan(0)).toHaveText('2');
    await store.cart.expectTotal(fmt(+(p.price * 2).toFixed(2)));
  });

  storeTest('decrement decreases qty', async ({ store }) => {
    await store.addProduct(1);
    await store.cart.open();
    await store.cart.increment(0);
    await store.cart.decrement(0);
    await expect(store.cart.qtySpan(0)).toHaveText('1');
  });

  storeTest('decrement to 0 removes the item', async ({ store }) => {
    await store.addProduct(4);
    await store.cart.open();
    await store.cart.decrement(0);
    await store.cart.expectEmpty();
  });

  storeTest('3× qty total is float-safe', async ({ store }) => {
    const p = PRODUCTS[2]; // $39.95
    await store.addProduct(p.id);
    await store.cart.open();
    await store.cart.increment(0);
    await store.cart.increment(0);
    await store.cart.expectTotal(fmt(+(p.price * 3).toFixed(2)));
  });
});

storeTest.describe('POM — Remove Item', () => {
  storeTest('remove clears the only item', async ({ store }) => {
    await store.addProduct(7);
    await store.cart.open();
    await store.cart.removeItem(0);
    await store.cart.expectEmpty();
    await store.expectCartCount(0);
    await expect(store.cart.checkoutBtn).toBeDisabled();
  });

  storeTest('remove button has title "Delete item"', async ({ store }) => {
    await store.addProduct(2);
    await store.cart.open();
    await expect(store.cart.removeBtn(0)).toHaveAttribute('title', 'Delete item');
  });

  storeTest('empty message reads "No items in cart yet."', async ({ store }) => {
    await store.addProduct(8);
    await store.cart.open();
    await store.cart.removeItem(0);
    await expect(store.cart.emptyMsg).toContainText('No items in cart yet.');
  });

  storeTest('removing one of two items leaves correct total', async ({ store }) => {
    const [p1, p2] = [PRODUCTS[8], PRODUCTS[9]];
    await store.addProduct(p1.id);
    await store.addProduct(p2.id);
    await store.cart.open();
    await store.cart.removeItem(0);
    await store.cart.expectTotal(fmt(p2.price));
  });
});

storeTest.describe('POM — Checkout', () => {
  storeTest('checkout clears cart and closes sidebar', async ({ store }) => {
    await store.addProduct(1);
    await store.cart.open();
    await store.cart.checkout();
    await expect(store.cart.sidebar).not.toHaveClass(/open/);
    await expect(store.cart.overlay).not.toHaveClass(/open/);
    await store.expectCartCount(0);
    await store.cart.expectTotal('$0.00');
    await expect(store.cart.checkoutBtn).toBeDisabled();
  });

  storeTest('checkout dialog contains item name', async ({ store }) => {
    const p = PRODUCTS[0];
    await store.addProduct(p.id);
    await store.cart.open();
    const msg = await store.cart.checkout();
    expect(msg).toContain(p.name);
  });

  storeTest('checkout dialog contains correct total', async ({ store }) => {
    const p = PRODUCTS[0];
    await store.addProduct(p.id);
    await store.cart.open();
    const msg = await store.cart.checkout();
    expect(msg).toContain(fmt(p.price));
  });

  storeTest('can add items again after checkout', async ({ store }) => {
    await store.addProduct(1);
    await store.cart.open();
    await store.cart.checkout();
    await store.addProduct(2);
    await store.expectCartCount(1);
  });

  storeTest('checkout with multiple items clears all', async ({ store }) => {
    await store.addProduct(1);
    await store.addProduct(2);
    await store.addProduct(3);
    await store.cart.open();
    await store.cart.checkout();
    await store.expectCartCount(0);
  });
});
