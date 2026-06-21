import { Page, Locator, expect } from '@playwright/test';

export class SpeedtestPage {
  readonly page: Page;
  readonly goButton: Locator;
  readonly ispName: Locator;
  readonly changeServerLink: Locator;
  readonly downloadSpeed: Locator;
  readonly uploadSpeed: Locator;
  readonly pingValue: Locator;
  readonly resultCard: Locator;
  readonly resultId: Locator;
  readonly jitterValue: Locator;

  constructor(page: Page) {
    this.page = page;
    this.goButton = page.locator('.js-starttest');
    this.ispName = page.locator('[data-testid="host-isp-name"]');
    this.changeServerLink = page.getByRole('link', { name: /Change Server/i });
    this.downloadSpeed = page.locator('[data-testid="download-speed"], .download-speed').first();
    this.uploadSpeed = page.locator('[data-testid="upload-speed"], .upload-speed').first();
    this.pingValue = page.locator('[data-testid="ping-value"], .ping-speed').first();
    this.resultCard = page.locator('.result-card, [data-testid="result-card"]').first();
    this.resultId = page.locator('.result-id').first();
    this.jitterValue = page.locator('[class*="jitter"], [data-testid*="jitter"]').first();
  }

  async blockAds(): Promise<void> {
    await this.page.route('**/*doubleclick.net*', route => route.abort());
    await this.page.route('**/*googlesyndication.com*', route => route.abort());
  }

  async goto(): Promise<void> {
    await this.page.goto('https://www.speedtest.net/', { waitUntil: 'networkidle', timeout: 60000 });
  }

  async clickGo(): Promise<void> {
    await expect(this.goButton).toBeEnabled();
    await this.goButton.click();
  }

  async waitForResultCard(timeout = 120000): Promise<void> {
    await expect(this.resultCard).toBeVisible({ timeout });
  }
}
