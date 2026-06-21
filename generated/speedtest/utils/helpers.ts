import { Page } from '@playwright/test';

/** Wait for the page to be in a stable, interactive state. */
export async function waitForStable(page: Page, ms = 300): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

/** Accept the next browser dialog and return its message. */
export async function acceptNextDialog(page: Page): Promise<string> {
  return new Promise(resolve => {
    page.once('dialog', async d => {
      resolve(d.message());
      await d.accept();
    });
  });
}
