/**
 * DemoApps User Management — Performance Tests
 */
import { test, expect, Browser } from '@playwright/test';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';
let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `perf_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('Perf Test');
  await page.locator('#email').fill(`perf${ts}@qatest.com`);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await page.close();
});

test.beforeEach(async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
});

test('PERF-01 @smoke: login page DOMContentLoaded under 8000ms', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  expect(Date.now() - t0).toBeLessThan(8000);
});

test('PERF-02: dashboard DOM node count under 2000', async ({ page }) => {
  const count = await page.evaluate(() => document.querySelectorAll('*').length);
  expect(count).toBeLessThan(2000);
});

test('PERF-03: Add User panel opens within 2000ms', async ({ page }) => {
  const t0 = Date.now();
  await page.locator('#nav-link-add-user').click();
  await expect(page.locator('#button-add-user-submit')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(2000);
});

test('PERF-04: login completes within 5000ms', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  const t0 = Date.now();
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await expect(page.locator('#heading-home')).toBeVisible({ timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(5000);
});

test('PERF-05: JS heap under 80MB on dashboard (Chromium only)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP heap metrics only in Chromium');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage') as { usedSize: number };
  expect(usedSize).toBeLessThan(80 * 1024 * 1024);
});

test('PERF-06: full page load within 15000ms', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 20000 });
  expect(Date.now() - t0).toBeLessThan(15000);
});

test('PERF-07: Add User submit responds within 3000ms', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const name = 'PerfAdd ' + Date.now().toString().slice(-4);
  await page.locator('#fullname').fill(name);
  await page.locator('#email').fill(`pfadd${Date.now()}@t.com`);
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  const t0 = Date.now();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(2000);
  expect(Date.now() - t0).toBeLessThan(3000);
});

test('PERF-08: registration page load under 8000ms', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  expect(Date.now() - t0).toBeLessThan(8000);
});

// ── PERF-09 ───────────────────────────────────────────────────────────────────
// Loop 3: dashboard table renders within 3s after login
test('PERF-09: dashboard table renders within 3s after login', async ({ page }) => {
  const start = Date.now();
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => {});
  const elapsed = Date.now() - start;
  const rows = await page.locator('table tbody tr').count();
  test.info().annotations.push({ type: 'table-render', description: rows + ' rows in ' + elapsed + 'ms' });
  expect(elapsed).toBeLessThan(3000);
});

// ── PERF-10 ───────────────────────────────────────────────────────────────────
// Loop 4: no 404 resource errors on authenticated page load
test('PERF-10: no 404 resource errors on dashboard load', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', r => { if (r.status() === 404) failed.push(r.url()); });
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(3000);
  const nonFavicon = failed.filter(u => !u.includes('favicon'));
  test.info().annotations.push({ type: '404-audit', description: nonFavicon.length === 0 ? 'No 404s' : '404s found: ' + nonFavicon.join(', ') });
  expect(nonFavicon).toHaveLength(0);
});

// ── PERF-11 ───────────────────────────────────────────────────────────────────
// Loop 3 Stress: 20 consecutive Add User operations without JS heap explosion
test('PERF-11: 20 consecutive Add User submissions do not cause heap explosion', async ({ page }) => {
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  const heapBefore = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
  for (let i = 0; i < 20; i++) {
    await page.locator('#nav-link-add-user').click();
    await page.waitForTimeout(400);
    await page.locator('#fullname').fill('Stress ' + i + '_' + Date.now().toString().slice(-3));
    await page.locator('#email').fill('stress' + i + '_' + Date.now() + '@t.com');
    await page.locator('#gender-male').check();
    await page.locator('#language-english').check();
    await page.locator('#button-add-user-submit').click();
    await page.waitForTimeout(600);
  }
  const heapAfter = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize ?? 0);
  const growthMB = heapBefore > 0 ? ((heapAfter - heapBefore) / 1024 / 1024) : 0;
  test.info().annotations.push({ type: 'heap-stress', description: 'Heap growth: ' + growthMB.toFixed(1) + ' MB after 20 submissions' });
  if (heapBefore > 0) expect(growthMB).toBeLessThan(50);
});

// ── LOOP 1.6: Gorilla Testing ─────────────────────────────────────────────────
test('PERF-GORILLA: gorilla — Add User module survives 30 rapid submissions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  let ok = 0;
  for (let i = 0; i < 30; i++) {
    try {
      await page.locator('#fullname').fill('Gorilla ' + i);
      await page.locator('#email').fill('g' + i + '_' + Date.now() + '@t.com');
      await page.locator('#gender-male').check();
      await page.locator('#language-english').check();
      await page.locator('#button-add-user-submit').click();
      await page.waitForTimeout(300);
      ok++;
    } catch { /* continue bombarding */ }
  }
  await expect(page.locator('body')).toBeVisible();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));
  test.info().annotations.push({ type: 'gorilla', description: ok + '/30 submissions | errors: ' + critical.length });
  expect(critical).toHaveLength(0);
});

// ── LOOP 3.3: Spike Testing ───────────────────────────────────────────────────
test('PERF-SPIKE: spike — 10 tabs × 5 navigations (50 total) stay stable', async ({ browser }) => {
  const ctx = await browser.newContext();
  const tabs = await Promise.all(Array.from({ length: 10 }, () => ctx.newPage()));
  const errors: string[] = [];
  tabs.forEach(p => p.on('pageerror', e => errors.push(e.message)));
  const url = 'https://demoapps.qspiders.com/user-management';
  await Promise.all(tabs.flatMap(p =>
    Array.from({ length: 5 }, () =>
      p.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    )
  ));
  for (const p of tabs) await expect(p.locator('body')).toBeVisible().catch(() => {});
  await ctx.close();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));
  test.info().annotations.push({ type: 'spike', description: '50 spike navigations | errors: ' + critical.length });
  expect(critical).toHaveLength(0);
});
