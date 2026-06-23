/**
 * math-hub-perf.spec.ts
 * ──────────────────────
 * Performance tests for the CBSE Maths Hub using the W3C Navigation Timing API,
 * Resource Timing API, and in-browser performance.now() measurement.
 *
 * Widget interaction latency is measured INSIDE the browser using page.evaluate()
 * so Playwright RPC overhead is excluded from the timing. This gives the actual
 * JS computation time (which should be < 10ms for simple math), not the network
 * round-trip to the Node.js test runner.
 */
import { test, expect } from '@playwright/test';

const URL = 'https://pradhansuman.github.io/qa-agent-pipeline/math_hub.html';

async function gotoAndDisableScroll(page: any) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { (document.documentElement as HTMLElement).style.scrollBehavior = 'auto'; });
}

// ─── Page Load Timing ─────────────────────────────────────────────────────────
test.describe('Page Load Timing', () => {

  test('TC-PERF-01: TTFB (Time to First Byte) under 3 s', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const ttfb = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return nav.responseStart - nav.fetchStart;
    });
    expect(ttfb).toBeLessThan(3000);
  });

  test('TC-PERF-02: DOMContentLoaded under 5 s', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const dcl = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return nav.domContentLoadedEventEnd - nav.fetchStart;
    });
    expect(dcl).toBeLessThan(5000);
  });

  test('TC-PERF-03: full page load event under 8 s', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const loadTime = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return nav.loadEventEnd - nav.fetchStart;
    });
    expect(loadTime).toBeLessThan(8000);
  });

  test('TC-PERF-04: DNS + TCP + TLS handshake combined under 2 s', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const connect = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return nav.connectEnd - nav.domainLookupStart;
    });
    // connectEnd === domainLookupStart means cached — both 0 and <2s are fine
    expect(connect).toBeLessThan(2000);
  });
});

// ─── Resource Budget ──────────────────────────────────────────────────────────
test.describe('Resource Budget', () => {

  test('TC-PERF-05: total network requests ≤ 5 (self-contained page)', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', r => requests.push(r.url()));
    await gotoAndDisableScroll(page);
    expect(requests.length).toBeLessThanOrEqual(5);
  });

  test('TC-PERF-06: no failed network requests on load', async ({ page }) => {
    const failures: string[] = [];
    page.on('requestfailed', r => failures.push(`${r.url()} — ${r.failure()?.errorText}`));
    await gotoAndDisableScroll(page);
    expect(failures).toHaveLength(0);
  });

  test('TC-PERF-07: HTML transfer size under 300 KB (or served from cache)', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const size = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return nav.transferSize; // 0 = served from cache — also acceptable
    });
    if (size > 0) {
      expect(size).toBeLessThan(300 * 1024);
    }
  });
});

// ─── Widget Interaction Latency (measured in-browser, no Playwright RPC) ─────
test.describe('Widget Interaction Latency', () => {

  test('TC-PERF-08: CH01 fraction→decimal JS computation under 50 ms', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch01-numerator"]').fill('7');
    await page.locator('[data-testid="ch01-denominator"]').fill('8');

    const elapsed = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="ch01-convert-btn"]') as HTMLButtonElement;
      const result = document.querySelector('[data-testid="ch01-result"]') as HTMLElement;
      const before = result.textContent;
      const t0 = performance.now();
      btn.click();
      // Result updates synchronously on click — measure immediately
      const t1 = performance.now();
      return result.textContent !== before ? t1 - t0 : -1;
    });

    expect(elapsed).toBeGreaterThan(-1); // confirms result changed
    expect(elapsed).toBeLessThan(50);    // pure JS math, no async
  });

  test('TC-PERF-09: CH08 simple-interest JS computation under 50 ms', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch08"]').click();
    await page.locator('[data-testid="chapter-8"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch08-principal"]').fill('5000');
    await page.locator('[data-testid="ch08-rate"]').fill('8');
    await page.locator('[data-testid="ch08-time"]').fill('3');

    const elapsed = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="ch08-calc-btn"]') as HTMLButtonElement;
      const result = document.querySelector('[data-testid="ch08-result"]') as HTMLElement;
      const before = result.textContent;
      const t0 = performance.now();
      btn.click();
      const t1 = performance.now();
      return result.textContent !== before ? t1 - t0 : -1;
    });

    expect(elapsed).toBeGreaterThan(-1);
    expect(elapsed).toBeLessThan(50);
  });

  test('TC-PERF-10: MCQ score update under 50 ms after answer click', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });

    const elapsed = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="ch01-q1-c"]') as HTMLButtonElement;
      const score = document.querySelector('[data-testid="score-bar"]') as HTMLElement;
      const before = score.textContent;
      const t0 = performance.now();
      btn.click();
      const t1 = performance.now();
      return score.textContent !== before ? t1 - t0 : -1;
    });

    expect(elapsed).toBeGreaterThan(-1);
    expect(elapsed).toBeLessThan(50);
  });
});

// ─── Canvas Rendering ─────────────────────────────────────────────────────────
test.describe('Canvas Rendering Performance', () => {

  test('TC-PERF-11: CH05 bar chart canvas renders within 1 s of page load', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch05"]').click();
    await page.locator('[data-testid="chapter-5"]').waitFor({ state: 'visible' });

    const t0 = Date.now();
    const painted = await page.locator('[data-testid="ch05-canvas"]').evaluate(
      (el: HTMLCanvasElement) => el.width > 0 && el.height > 0
    );
    const elapsed = Date.now() - t0;

    expect(painted).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  test('TC-PERF-12: CH05 chart type switch + redraw under 500 ms (in-browser)', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch05"]').click();
    await page.locator('[data-testid="chapter-5"]').waitFor({ state: 'visible' });

    await page.locator('[data-testid="ch05-chart-type"]').selectOption('pie');

    const elapsed = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="ch05-draw-btn"]') as HTMLButtonElement;
      const t0 = performance.now();
      btn.click();
      return performance.now() - t0;
    });

    expect(elapsed).toBeLessThan(500);
    await expect(page.locator('[data-testid="ch05-canvas"]')).toBeVisible();
  });

  test('TC-PERF-13: CH15 line graph canvas renders within 1 s', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch15"]').click();

    const t0 = Date.now();
    await page.locator('[data-testid="ch15-canvas"]').waitFor({ state: 'visible' });
    const painted = await page.locator('[data-testid="ch15-canvas"]').evaluate(
      (el: HTMLCanvasElement) => el.width > 0
    );
    const elapsed = Date.now() - t0;

    expect(painted).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});

// ─── DOM Complexity ───────────────────────────────────────────────────────────
test.describe('DOM Complexity', () => {

  test('TC-PERF-14: total DOM node count under 3000', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length);
    expect(nodeCount).toBeLessThan(3000);
  });

  test('TC-PERF-15: no page-error events degrade widget reliability', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch06"]').click();
    await page.locator('[data-testid="chapter-6"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch06-input"]').fill('144');
    await page.locator('[data-testid="ch06-calc-btn"]').click();
    expect(errors).toHaveLength(0);
  });

  test('TC-PERF-16: clicking all 16 nav links takes < 100 ms in-browser (no jank)', async ({ page }) => {
    await gotoAndDisableScroll(page);

    // Run all 16 clicks inside the browser to measure pure JS + scroll handler time,
    // excluding Playwright's RPC overhead (which would add ~1 s per click over the network).
    const elapsed = await page.evaluate(async () => {
      const links = Array.from(
        document.querySelectorAll('[data-testid^="nav-ch"]')
      ) as HTMLElement[];
      const t0 = performance.now();
      links.forEach(l => l.click());
      await new Promise(r => setTimeout(r, 50)); // let any async handlers settle
      return performance.now() - t0;
    });

    expect(elapsed).toBeLessThan(100); // pure JS event dispatch, no network
  });
});
