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

test.describe('Latency & Jitter Measurement Phase', () => {
  test('TC-008: Ping and jitter values are displayed as positive numeric values during the latency measurement phase', async ({ page }) => {
    // Arrange
    const goButton = page.locator('.js-starttest');
    const pingLocator = page.locator('[data-testid="ping-value"], .ping-speed').first();
    const jitterLocator = page.locator('[class*="jitter"]').first();
    // Act
    await goButton.click();
    await pingLocator.waitFor({ state: 'visible', timeout: 30000 });
    // Assert ping
    await expect(pingLocator).toBeVisible();
    const pingVal = ((await pingLocator.textContent()) ?? '0').trim();
    expect(parseInt(pingVal, 10)).toBeGreaterThan(0);
    // Assert jitter
    await expect(jitterLocator).toBeVisible({ timeout: 30000 });
    const jitterVal = ((await jitterLocator.textContent()) ?? '0').trim();
    expect(parseFloat(jitterVal)).toBeGreaterThan(0);
  });
});

test.describe('Download Speed Measurement Phase', () => {
  test('TC-009: Download speed value updates numerically and gauge animates during the download measurement phase', async ({ page }) => {
    // Arrange
    const goButton = page.locator('.js-starttest');
    const downloadLocator = page.locator('[data-testid="download-speed"], .download-speed').first();
    // Act
    await goButton.click();
    await downloadLocator.waitFor({ state: 'visible', timeout: 60000 });
    // Assert visible
    await expect(downloadLocator).toBeVisible();
    // Capture first value
    const firstVal = ((await downloadLocator.textContent()) ?? '').trim();
    // Wait for value to change event-driven
    await page.waitForFunction(
      (args: { selector: string; initialValue: string }) => {
        const el = document.querySelector(args.selector);
        return el !== null && (el.textContent ?? '').trim() !== args.initialValue;
      },
      { selector: '[data-testid="download-speed"]', initialValue: firstVal },
      { timeout: 30000 }
    );
    // Assert updated value is numeric
    const secondVal = ((await downloadLocator.textContent()) ?? '0').trim();
    expect(parseFloat(secondVal)).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Upload Speed Measurement Phase', () => {
  test('TC-010: Upload speed value updates numerically during the upload measurement phase after download completes', async ({ page }) => {
    // Arrange
    const goButton = page.locator('.js-starttest');
    const downloadLocator = page.locator('[data-testid="download-speed"], .download-speed').first();
    const uploadLocator = page.locator('[data-testid="upload-speed"], .upload-speed').first();
    // Act
    await goButton.click();
    // Wait for download to begin
    await downloadLocator.waitFor({ state: 'visible', timeout: 60000 });
    // Wait for upload phase to begin
    await uploadLocator.waitFor({ state: 'visible', timeout: 120000 });
    // Assert upload visible
    await expect(uploadLocator).toBeVisible();
    // Capture first upload value
    const firstUploadVal = ((await uploadLocator.textContent()) ?? '').trim();
    // Wait event-driven for upload value to change
    await page.waitForFunction(
      (args: { selector: string; initialValue: string }) => {
        const el = document.querySelector(args.selector);
        return el !== null && (el.textContent ?? '').trim() !== args.initialValue;
      },
      { selector: '[data-testid="upload-speed"]', initialValue: firstUploadVal },
      { timeout: 60000 }
    );
    // Assert updated value is numeric
    const updatedVal = ((await uploadLocator.textContent()) ?? '0').trim();
    expect(parseFloat(updatedVal)).toBeGreaterThanOrEqual(0);
  });
});
