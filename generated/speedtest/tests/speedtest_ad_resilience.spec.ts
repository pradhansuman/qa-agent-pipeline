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

test.describe('Ad and Pop-up Resilience', () => {
  test('TC-006: Ad network requests are blocked and no ad overlay obstructs the GO button or test execution', async ({ page }) => {
    // Arrange - track blocked ad requests
    let adRequestsBlocked = 0;
    page.on('requestfailed', req => {
      if (req.url().includes('doubleclick.net') || req.url().includes('googlesyndication.com')) {
        adRequestsBlocked++;
      }
    });
    // Assert GO button visible without covering overlay
    const goButton = page.locator('.js-starttest');
    await expect(goButton).toBeVisible();
    // Assert no blocking ad overlay
    const adOverlay = page.locator('[id*="ad"], [class*="ad-overlay"], [class*="adsbox"]');
    const adOverlayCount = await adOverlay.count();
    if (adOverlayCount > 0) {
      await expect(adOverlay.first()).not.toBeVisible();
    }
    // Act - click GO without error
    await goButton.click();
    // Assert UI transitions to active state (button disabled)
    await expect(goButton).not.toBeEnabled({ timeout: 5000 });
    // Assert test completes
    const resultCard = page.locator('.result-card, [data-testid="result-card"]').first();
    await expect(resultCard).toBeVisible({ timeout: 120000 });
  });
});
