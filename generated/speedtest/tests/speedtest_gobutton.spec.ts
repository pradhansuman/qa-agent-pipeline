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

test.describe('Guest Speed Test Execution - GO Button Initiation', () => {
  test('TC-002: Clicking GO button transitions UI from idle to active test state and disables re-initiation', async ({ page }) => {
    // Arrange
    const goButton = page.locator('.js-starttest');
    await expect(goButton).toBeEnabled();
    // Act
    await goButton.click();
    // Assert
    await expect(goButton).not.toBeEnabled({ timeout: 5000 });
  });

  test('TC-018: GO button cannot be clicked a second time once test is already in progress', async ({ page }) => {
    // Arrange
    const goButton = page.locator('.js-starttest');
    await expect(goButton).toBeEnabled();
    // Act
    await goButton.click();
    // Assert - button disabled after first click
    await expect(goButton).not.toBeEnabled({ timeout: 5000 });
    // Act - attempt second click (force: false means it won't click if not actionable)
    await goButton.click({ force: false }).catch(() => {});
    // Assert - test still progresses to a single result card
    const resultCard = page.locator('.result-card, [data-testid="result-card"]').first();
    await expect(resultCard).toBeVisible({ timeout: 120000 });
    // Assert single result card
    const resultCardCount = await page.locator('.result-card, [data-testid="result-card"]').count();
    expect(resultCardCount).toBeLessThanOrEqual(1);
  });
});
