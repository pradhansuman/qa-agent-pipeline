/**
 * DemoApps User Management — Visual Regression Tests
 * Run with --update-snapshots on first pass to create baselines.
 */
import { test, expect, Browser } from '@playwright/test';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';
let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `vis_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('Visual Test');
  await page.locator('#email').fill(`vis${ts}@qatest.com`);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await page.close();
});

test('VIS-01 @smoke: login page matches visual baseline', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('demoapps-login.png', {
    maxDiffPixelRatio: 0.05, animations: 'disabled',
  });
});

test('VIS-02: registration page matches visual baseline', async ({ page }) => {
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('demoapps-register.png', {
    maxDiffPixelRatio: 0.05, animations: 'disabled',
  });
});

test('VIS-03: dashboard matches visual baseline', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveScreenshot('demoapps-dashboard.png', {
    maxDiffPixelRatio: 0.05, animations: 'disabled',
    mask: [page.getByText(testUser.username)],
  });
});

test('VIS-04: Add User panel matches visual baseline', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('demoapps-add-user.png', {
    maxDiffPixelRatio: 0.05, animations: 'disabled',
  });
});
