// bank - CWV: FCP, LCP, CLS, JS errors
import { test, expect } from '@playwright/test';
import { PerfThresholds, QAAnnotate } from '../shared/strategy';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

test('BANK-CWV-01 @smoke: FCP within budget', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);
  QAAnnotate.perf('FCP=' + fcp.toFixed(0) + 'ms');
  if (fcp > 0) expect(fcp).toBeLessThan(PerfThresholds.FCP);
});

test('BANK-CWV-02: LCP within budget', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const lcp = await page.evaluate(() => new Promise<number>(res => {
    new PerformanceObserver(l => res(l.getEntries().at(-1)?.startTime ?? 0))
      .observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => res(0), 3000);
  }));
  QAAnnotate.perf('LCP=' + lcp.toFixed(0) + 'ms');
  if (lcp > 0) expect(lcp).toBeLessThan(PerfThresholds.LCP);
});

test('BANK-CWV-03: CLS under ${PerfThresholds.CLS}', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const cls = await page.evaluate(() => new Promise<number>(res => {
    let t = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) t += (e as any).value ?? 0; })
      .observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => res(t), 2000);
  }));
  QAAnnotate.perf('CLS=' + cls.toFixed(4));
  expect(cls).toBeLessThan(PerfThresholds.CLS);
});

test('BANK-CWV-04: no JS errors on load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});
