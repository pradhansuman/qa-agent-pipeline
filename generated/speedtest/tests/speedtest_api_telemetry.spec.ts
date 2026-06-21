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

test.describe('API Telemetry Result Validation', () => {
  test('TC-007: GET /api/v1/results/{resultId} returns HTTP 200 with metrics matching the UI result card values', async ({ page }) => {
    // Arrange & Act - complete full test
    await runFullTest(page);
    // Extract result ID from DOM
    const resultIdLocator = page.locator('.result-id').first();
    const resultId = ((await resultIdLocator.textContent()) ?? '').trim();
    expect(resultId.length).toBeGreaterThan(0);
    // Extract UI metrics
    const uiDownload = parseFloat(((await page.locator('[data-testid="download-speed"], .download-speed').first().textContent()) ?? '0').trim());
    const uiUpload = parseFloat(((await page.locator('[data-testid="upload-speed"], .upload-speed').first().textContent()) ?? '0').trim());
    const uiPing = parseInt(((await page.locator('[data-testid="ping-value"], .ping-speed').first().textContent()) ?? '0').trim(), 10);
    // Act - API request
    const response = await page.request.get(`/api/v1/results/${resultId}`);
    // Assert HTTP 200
    expect(response.status()).toBe(200);
    // Assert response body
    const body = await response.json();
    expect(body.resultId).toBe(resultId);
    expect(body.status).toBe('completed');
    expect(body.metrics.downloadMbps).toBeCloseTo(uiDownload, 1);
    expect(body.metrics.uploadMbps).toBeCloseTo(uiUpload, 1);
    expect(body.metrics.pingMs).toBe(uiPing);
    expect(body.metrics.downloadMbps).toBeGreaterThan(0);
    expect(body.metrics.uploadMbps).toBeGreaterThan(0);
    expect(body.metrics.pingMs).toBeGreaterThan(0);
  });
});
