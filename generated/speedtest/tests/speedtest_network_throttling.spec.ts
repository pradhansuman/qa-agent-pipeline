import { test as base, expect, Page, Locator, Browser } from '@playwright/test';

const BASE_URL = 'https://www.speedtest.net/';

async function blockAds(page: Page): Promise<void> {
  await page.route('**/*doubleclick.net*', route => route.abort());
  await page.route('**/*googlesyndication.com*', route => route.abort());
}

// For throttling tests, we create a fresh context per test (not worker-shared)
// because CDP throttling should not bleed across tests
const test = base.extend<{ throttledPage: Page }, {}>({  
  throttledPage: async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await blockAds(pg);
    // Set up CDP session for network throttling
    const client = await pg.context().newCDPSession(pg);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50000,
      uploadThroughput: 20000,
      latency: 2000,
    });
    await pg.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
    await use(pg);
    await pg.close();
    await ctx.close();
  },
});

test.describe('Network Throttling & Slow Network Graceful Handling', () => {
  test('TC-013: Speed test completes without timeout errors under simulated Slow 3G network conditions', async ({ throttledPage: page }) => {
    // Arrange - already set up in fixture
    const goButton = page.locator('.js-starttest');
    const resultCard = page.locator('.result-card, [data-testid="result-card"]').first();
    const downloadLocator = page.locator('[data-testid="download-speed"], .download-speed').first();
    const uploadLocator = page.locator('[data-testid="upload-speed"], .upload-speed').first();
    // Assert GO button visible and enabled under throttle
    await expect(goButton).toBeVisible({ timeout: 30000 });
    await expect(goButton).toBeEnabled();
    // Act
    await goButton.click();
    // Assert result card appears within 120s
    await expect(resultCard).toBeVisible({ timeout: 120000 });
    // Assert metric values are numeric
    const dl = ((await downloadLocator.textContent()) ?? '0').trim();
    expect(parseFloat(dl)).toBeGreaterThanOrEqual(0);
    const ul = ((await uploadLocator.textContent()) ?? '0').trim();
    expect(parseFloat(ul)).toBeGreaterThanOrEqual(0);
  });
});
