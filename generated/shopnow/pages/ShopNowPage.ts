import { Page, Locator } from '@playwright/test';

export class ShopNowPage {
  readonly page: Page;

  // Product Catalog
  readonly productGrid: Locator;
  readonly productCards: Locator;

  // Cart
  readonly cartToggle: Locator;
  readonly cartSidebar: Locator;
  readonly cartItems: Locator;
  readonly cartTotal: Locator;
  readonly checkoutBtn: Locator;
  readonly cartBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productGrid = page.locator('.product-grid');
    this.productCards = page.locator('.product-card');
    this.cartToggle = page.locator('.cart-toggle, button.open-cart').first();
    this.cartSidebar = page.locator('.cart-sidebar, .cart-panel, #cart').first();
    this.cartItems = page.locator('.cart-item');
    this.cartTotal = page.locator('.cart-total, #cart-total, .total-price, .cart-summary .total').first();
    this.checkoutBtn = page.locator('.checkout-btn, button.checkout, #checkout-button, .cart-footer button').first();
    this.cartBadge = page.locator('.cart-badge, .cart-count, #cart-item-count, span.cart-quantity-badge').first();
  }

  getProductCardBtn(index: number): Locator {
    return this.page.locator('.product-card').nth(index).locator('.add-to-cart, .product-card button').first();
  }

  getProductName(index: number): Locator {
    return this.page.locator('.product-card').nth(index).locator('.product-name');
  }

  getProductPrice(index: number): Locator {
    return this.page.locator('.product-card').nth(index).locator('.product-price');
  }

  getCartItemName(index: number): Locator {
    return this.page.locator('.cart-item').nth(index).locator('.cart-item-name');
  }

  getCartItemQty(index: number): Locator {
    return this.page.locator('.cart-item').nth(index).locator('.cart-item-qty, .item-quantity');
  }

  getCartItemIncBtn(index: number): Locator {
    return this.page.locator('.cart-item').nth(index).locator('.quantity-increase, button.qty-plus, button[aria-label="Increase quantity"]').first();
  }

  getCartItemDecBtn(index: number): Locator {
    return this.page.locator('.cart-item').nth(index).locator('.quantity-decrease, button.qty-minus, button[aria-label="Decrease quantity"]').first();
  }

  getCartItemRemoveBtn(index: number): Locator {
    return this.page.locator('.cart-item').nth(index).locator('.remove-item, button.remove, .cart-item-remove, button[aria-label="Remove item"], .close-btn, button.delete-item').first();
  }

  async parsePrice(index: number): Promise<number> {
    const text = await this.getProductPrice(index).textContent();
    return parseFloat((text ?? '0').replace(/[^0-9.]/g, ''));
  }
}
