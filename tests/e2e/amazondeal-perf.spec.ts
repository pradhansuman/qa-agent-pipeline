/**
 * Amazon India Deals Tracker — Performance & Endurance Tests
 * Validates chart rendering speed, memory stability during live updates,
 * and network resource efficiency.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://dfgjhjcr.gensparkspace.com/';

// ── PERF-01 ───────────────────────────────────────────────────────────────────
test('PERF-01 @smoke: page responds to navigation in under 5000ms', async ({ page }) => {
  const start = Date.now();
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(5000);
});

// ── PERF-02 ───────────────────────────────────────────────────────────────────
test('PERF-02: all 3 charts are initialised within 4000ms', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'load' });

  await page.waitForFunction(() => {
    const charts = ['priceChart', 'iphoneChart', 'samsungChart'];
    return charts.every(id => {
      const c = document.getElementById(id) as HTMLCanvasElement;
      return c && c.width > 0 && c.height > 0;
    });
  }, { timeout: 4000 });
});

// ── PERF-03 ───────────────────────────────────────────────────────────────────
test('PERF-03: JS heap does not grow unboundedly over 5 update cycles', async ({ page, browserName }) => {
  test.setTimeout(30000);
  test.skip(browserName !== 'chromium', 'CDP memory API is Chromium-only');

  const client = await (page.context() as any).newCDPSession(page);
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });

  await client.send('Performance.enable');
  const before = (await client.send('Performance.getMetrics')).metrics.find(
    (m: any) => m.name === 'JSHeapUsedSize'
  )?.value ?? 0;

  await page.waitForTimeout(15000); // 5 x 3s update cycles

  const after = (await client.send('Performance.getMetrics')).metrics.find(
    (m: any) => m.name === 'JSHeapUsedSize'
  )?.value ?? 0;

  // Allow up to 20 MB growth — the app is doing real-time DOM updates
  const growthMB = (after - before) / (1024 * 1024);
  expect(growthMB).toBeLessThan(20);
});

// ── PERF-04 ───────────────────────────────────────────────────────────────────
test('PERF-04: no failed network requests for critical resources', async ({ page }) => {
  const failures: string[] = [];
  page.on('requestfailed', req => failures.push(`${req.failure()?.errorText} — ${req.url()}`));

  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Only care about the application page itself, not third-party tracking
  const appFailures = failures.filter(f =>
    f.includes('dfgjhjcr.gensparkspace.com') ||
    f.includes('cdn.jsdelivr.net') ||
    f.includes('fonts.googleapis')
  );
  expect(appFailures).toHaveLength(0);
});

// ── PERF-05 ───────────────────────────────────────────────────────────────────
test('PERF-05: dynamic content renders without freezing the main thread', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Measure if JS can respond to evaluation quickly after page load
  const start = Date.now();
  await page.evaluate(() => {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  const rafMs = Date.now() - start;

  // If main thread is blocked, rAF won't fire for a long time
  expect(rafMs).toBeLessThan(2000);
});

// ── PERF-06 ───────────────────────────────────────────────────────────────────
test('PERF-06: activity feed does not exceed 50 entries (DOM bloat guard)', async ({ page }) => {
  test.setTimeout(25000);
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(12000); // 4 update cycles

  const entryCount = await page.evaluate(() =>
    document.querySelector('#activityFeed')?.children.length ?? 0
  );
  // Feed should cap entries to avoid unbounded DOM growth
  expect(entryCount).toBeLessThanOrEqual(50);
});

// ── PERF-07 ───────────────────────────────────────────────────────────────────
test('PERF-07: deal stream does not exceed 50 entries', async ({ page }) => {
  test.setTimeout(25000);
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(12000);

  const entryCount = await page.evaluate(() =>
    document.querySelector('#dealStream')?.children.length ?? 0
  );
  expect(entryCount).toBeLessThanOrEqual(50);
});

// ── PERF-08 ───────────────────────────────────────────────────────────────────
test('PERF-08: page scroll performance — page remains interactive after scrolling', async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Scroll to the bottom in chunks
  for (let i = 0; i < 5; i++) {
    await page.evaluate(y => window.scrollBy(0, y), 600);
    await page.waitForTimeout(150);
  }

  // Footer should be visible after scrolling to the bottom
  const footer = page.locator('footer');
  await expect(footer).toBeVisible();

  // Scroll back to top — stats bar should be visible again
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#liveUsers')).toBeVisible();
});
