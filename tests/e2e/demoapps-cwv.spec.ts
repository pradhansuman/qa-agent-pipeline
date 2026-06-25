/**
 * DemoApps User Management — Core Web Vitals
 */
import { test, expect } from '@playwright/test';

const LOGIN_URL = 'https://demoapps.qspiders.com/user-management';

test('CWV-01 @smoke: FCP under 5000ms', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'PaintTiming unreliable in Firefox');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const fcp = await page.evaluate(() =>
    performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
  );
  if (fcp !== null) expect(fcp).toBeLessThan(5000);
});

test('CWV-02: LCP under 4000ms', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'LCP observer unreliable in Firefox');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  const lcp = await page.evaluate(() =>
    new Promise<number>(resolve => {
      let v = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) v = (e as any).startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(v), 1500);
    })
  );
  if (lcp > 0) expect(lcp).toBeLessThan(4000);
});

test('CWV-03: DOMContentLoaded within 8000ms', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  expect(Date.now() - t0).toBeLessThan(8000);
});

test('CWV-04: full networkidle load within 15000ms', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 20000 });
  expect(Date.now() - t0).toBeLessThan(15000);
});

test('CWV-05: TTFB under 3000ms', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  const ttfb = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return nav ? nav.responseStart - nav.requestStart : 0;
  });
  if (ttfb > 0) expect(ttfb).toBeLessThan(3000);
});

test('CWV-06: no render-blocking JS errors on load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('CWV-07: total network requests under 50', async ({ page }) => {
  let count = 0;
  page.on('request', () => count++);
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 20000 });
  expect(count).toBeLessThan(50);
});

test('CWV-08: JS payload under 3MB', async ({ page }) => {
  let totalJS = 0;
  page.on('response', async resp => {
    const ct = resp.headers()['content-type'] ?? '';
    if (ct.includes('javascript')) {
      try { totalJS += (await resp.body()).length; } catch { /* skip */ }
    }
  });
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 20000 });
  expect(totalJS).toBeLessThan(3 * 1024 * 1024);
});
