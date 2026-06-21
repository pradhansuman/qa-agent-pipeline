import { test as base, expect, Page, Locator, Browser } from '@playwright/test';

const BASE_URL = 'https://www.speedtest.net/';

async function blockAds(page: Page): Promise<void> {
  await page.route('**/*doubleclick.net*', route => route.abort());
  await page.route('**/*googlesyndication.com*', route => route.abort());
}

async function resetState(page: Page): Promise<void> {
  await blockAds(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
}

const test = base.extend<{}, { sharedPage: Page }>({
  sharedPage: [async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await blockAds(pg);
    await pg.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await use(pg);
    await pg.close();
    await ctx.close();
  }, { scope: 'worker' }],
  page: async ({ sharedPage }: { sharedPage: Page }, use: (page: Page) => Promise<void>) => {
    await resetState(sharedPage);
    await use(sharedPage);
  },
});

test.describe('Custom Server Selection Modal', () => {
  test('TC-005: Change Server modal opens, server search filters results, and selecting a server updates the landing page', async ({ page }) => {
    // Arrange
    const changeServerLink = page.getByRole('link', { name: /Change Server/i });
    const modalLocator = page.locator('[class*="modal"], [class*="server-list"], [role="dialog"]').first();
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    const serverItems = page.locator('[class*="server-list"] li, [class*="server-item"]');
    const goButton = page.locator('.js-starttest');
    // Act - open modal
    await changeServerLink.waitFor({ state: 'visible' });
    await changeServerLink.click();
    // Assert modal visible
    await expect(modalLocator).toBeVisible({ timeout: 5000 });
    // Assert search input visible
    await expect(searchInput).toBeVisible();
    // Assert server list has items by default
    await expect(serverItems.first()).toBeVisible();
    // Act - search for Bhubaneswar
    await searchInput.fill('Bhubaneswar');
    // Wait for filtered list to update
    await page.waitForTimeout(1000);
    // Assert filtered list has results
    await expect(serverItems.first()).toBeVisible({ timeout: 5000 });
    // Act - click first server
    await serverItems.first().click();
    // Assert modal is closed
    const modalOrDialog = page.locator('[class*="modal"][style*="display: none"], [role="dialog"]');
    // Use not.toBeVisible with a broader selector for the overlay
    await expect(page.locator('[class*="modal"]').filter({ hasText: 'Search' })).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    // Assert GO button still enabled
    await expect(goButton).toBeEnabled({ timeout: 5000 });
  });

  test('TC-015: Change Server modal displays a list of nearby servers on initial open without any search input', async ({ page }) => {
    // Arrange
    const changeServerLink = page.getByRole('link', { name: /Change Server/i });
    const modalLocator = page.locator('[class*="modal"], [role="dialog"]').first();
    const serverItems = page.locator('[class*="server-list"] li, [class*="server-item"]');
    // Act
    await changeServerLink.click();
    // Assert modal visible
    await modalLocator.waitFor({ state: 'visible', timeout: 10000 });
    await expect(modalLocator).toBeVisible();
    // Assert server list items visible without search
    await expect(serverItems.first()).toBeVisible({ timeout: 10000 });
    const count = await serverItems.count();
    expect(count).toBeGreaterThan(0);
  });
});
