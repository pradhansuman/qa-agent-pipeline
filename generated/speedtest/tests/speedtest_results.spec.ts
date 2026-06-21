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

async function runFullTest(page: Page): Promise<void> {
  await expect(page.locator('.js-starttest')).toBeEnabled();
  await page.locator('.js-starttest').click();
  await expect(page.locator('.result-card, [data-testid="result-card"]').first()).toBeVisible({ timeout: 120000 });
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

test.describe('Results Presentation & Result Card', () => {
  test('TC-003: Full speed test completes and result card displays all valid non-zero metrics within 120 seconds', async ({ page }) => {
    // Arrange & Act
    await runFullTest(page);
    // Assert download
    const dlLocator = page.locator('[data-testid="download-speed"], .download-speed').first();
    const dlText = ((await dlLocator.textContent()) ?? '0').trim();
    expect(parseFloat(dlText)).toBeGreaterThan(0);
    // Assert upload
    const ulLocator = page.locator('[data-testid="upload-speed"], .upload-speed').first();
    const ulText = ((await ulLocator.textContent()) ?? '0').trim();
    expect(parseFloat(ulText)).toBeGreaterThan(0);
    // Assert ping
    const pingLocator = page.locator('[data-testid="ping-value"], .ping-speed').first();
    const pingText = ((await pingLocator.textContent()) ?? '0').trim();
    expect(parseInt(pingText, 10)).toBeGreaterThan(0);
    // Assert result ID
    const resultIdLocator = page.locator('.result-id').first();
    await expect(resultIdLocator).not.toHaveText('');
  });

  test('TC-011: Result ID is reflected in the page URL after test completion', async ({ page }) => {
    // Arrange & Act
    await runFullTest(page);
    // Assert result ID in DOM
    const resultIdLocator = page.locator('.result-id').first();
    const resultIdText = ((await resultIdLocator.textContent()) ?? '').trim();
    expect(resultIdText.length).toBeGreaterThan(0);
    // Assert URL contains result ID
    const currentUrl = page.url();
    expect(currentUrl).toContain(resultIdText);
  });

  test('TC-012: Result card metric values remain immutable and do not change after final display', async ({ page }) => {
    // Arrange & Act
    await runFullTest(page);
    // Capture initial values
    const dlLocator = page.locator('[data-testid="download-speed"], .download-speed').first();
    const ulLocator = page.locator('[data-testid="upload-speed"], .upload-speed').first();
    const pingLocator = page.locator('[data-testid="ping-value"], .ping-speed').first();
    const finalDownload = ((await dlLocator.textContent()) ?? '').trim();
    const finalUpload = ((await ulLocator.textContent()) ?? '').trim();
    const finalPing = ((await pingLocator.textContent()) ?? '').trim();
    // Wait for stability check (acceptable post-result)
    await page.waitForTimeout(3000);
    // Assert values unchanged
    const reDownload = ((await dlLocator.textContent()) ?? '').trim();
    expect(reDownload).toBe(finalDownload);
    const reUpload = ((await ulLocator.textContent()) ?? '').trim();
    expect(reUpload).toBe(finalUpload);
    const rePing = ((await pingLocator.textContent()) ?? '').trim();
    expect(rePing).toBe(finalPing);
  });

  test('TC-017: Final jitter value on result card is a positive numeric value greater than zero', async ({ page }) => {
    // Arrange & Act
    await runFullTest(page);
    // Assert jitter
    const jitterLocator = page.locator('[class*="jitter"], [data-testid*="jitter"]').first();
    await jitterLocator.waitFor({ state: 'visible', timeout: 10000 });
    const jitterText = ((await jitterLocator.textContent()) ?? '').trim();
    expect(jitterText.length).toBeGreaterThan(0);
    expect(parseFloat(jitterText)).toBeGreaterThan(0);
  });
});
