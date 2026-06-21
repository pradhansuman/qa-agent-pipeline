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

test.describe('Landing Page Load & Pre-Test State', () => {
  test('TC-001: Landing page loads with GO button, ISP name, server info and Change Server link visible', async ({ page }) => {
    // Assert
    await expect(page).toHaveTitle(/Speedtest/i);
    await expect(page.locator('.js-starttest')).toBeVisible();
    await expect(page.locator('.js-starttest')).toBeEnabled();
    const ispLocator = page.locator('[data-testid="host-isp-name"]');
    await expect(ispLocator).toBeVisible();
    const ispText = await ispLocator.textContent();
    expect((ispText ?? '').trim().length).toBeGreaterThan(0);
    await expect(page.getByRole('link', { name: /Change Server/i })).toBeVisible();
  });

  test('TC-016: Detected test server name is non-empty and visible before test initiation', async ({ page }) => {
    // Arrange
    const serverNameLocator = page.locator('[class*="host-name"], [class*="server-name"], [data-testid*="server"]').first();
    // Act
    await serverNameLocator.waitFor({ state: 'visible', timeout: 15000 });
    // Assert
    await expect(serverNameLocator).toBeVisible();
    const serverNameText = ((await serverNameLocator.textContent()) ?? '').trim();
    expect(serverNameText.length).toBeGreaterThan(0);
    await expect(page.getByRole('link', { name: /Change Server/i })).toBeVisible();
  });
});

test.describe('ISP Name Display Verification', () => {
  test('TC-004: Detected ISP name is visible, non-empty, and free of placeholder error text on page load', async ({ page }) => {
    // Arrange
    const ispLocator = page.locator('[data-testid="host-isp-name"]');
    // Act
    await ispLocator.waitFor({ state: 'visible' });
    // Assert
    await expect(ispLocator).toBeVisible();
    const ispText = ((await ispLocator.textContent()) ?? '').trim();
    expect(ispText.length).toBeGreaterThan(0);
    expect(ispText).not.toMatch(/unknown/i);
    expect(ispText).not.toMatch(/n\/a/i);
    // Act - click GO and assert ISP persists
    await page.locator('.js-starttest').click();
    await expect(ispLocator).toBeVisible({ timeout: 5000 });
  });

  test('TC-014: ISP name does not display placeholder text Unknown or N/A on page load', async ({ page }) => {
    // Arrange
    const ispLocator = page.locator('[data-testid="host-isp-name"]');
    // Act
    await ispLocator.waitFor({ state: 'visible', timeout: 15000 });
    const ispText = ((await ispLocator.textContent()) ?? '').trim();
    // Assert
    expect(ispText.length).toBeGreaterThan(0);
    expect(ispText.toLowerCase()).not.toContain('unknown');
    expect(ispText.toLowerCase()).not.toContain('n/a');
    expect(ispText.toLowerCase()).not.toContain('null');
    expect(ispText.toLowerCase()).not.toContain('undefined');
  });
});
