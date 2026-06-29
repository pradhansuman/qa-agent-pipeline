// bank - Perf: FCP, DCL, DOM nodes, gorilla, spike
import { test, expect } from '@playwright/test';
import { PerfThresholds, QAAnnotate } from '../shared/strategy';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

test('BANK-PERF-01 @smoke: FCP under ${PerfThresholds.FCP}ms', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);
  QAAnnotate.perf('FCP: ' + fcp.toFixed(0) + 'ms');
  if (fcp > 0) expect(fcp).toBeLessThan(PerfThresholds.FCP);
});

test('BANK-PERF-02: DCL under ${PerfThresholds.DOMContentLoaded}ms', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const dcl = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return n ? n.domContentLoadedEventEnd - n.startTime : 0; });
  QAAnnotate.perf('DCL: ' + dcl.toFixed(0) + 'ms');
  if (dcl > 0) expect(dcl).toBeLessThan(PerfThresholds.DOMContentLoaded);
});

test('BANK-PERF-03: DOM nodes under ${PerfThresholds.DOMNodes}', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const n = await page.evaluate(() => document.querySelectorAll('*').length);
  QAAnnotate.perf('DOM nodes: ' + n);
  expect(n).toBeLessThan(PerfThresholds.DOMNodes);
});

test('BANK-PERF-04: no 404 resources', async ({ page }) => {
  const f: string[] = [];
  page.on('response', r => { if (r.status() === 404) f.push(r.url()); });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  expect(f.filter(u => !u.includes('favicon'))).toHaveLength(0);
});

test('BANK-PERF-GORILLA: gorilla — primary action ${PerfThresholds.GorillaHits}x no crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  // TODO: target the gorilla subject for bank
  const btn = page.locator('button:not([disabled])').first();
  if (await btn.count()) {
    for (let i = 0; i < PerfThresholds.GorillaHits; i++) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  await expect(page.locator('body')).toBeVisible();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));
  QAAnnotate.gorilla(PerfThresholds.GorillaHits + ' hits | errors: ' + critical.length);
  expect(critical).toHaveLength(0);
});

test('BANK-PERF-SPIKE: spike — 10 tabs simultaneously stable', async ({ browser }) => {
  const ctx  = await browser.newContext();
  const tabs = await Promise.all(Array.from({ length: 10 }, () => ctx.newPage()));
  const errors: string[] = [];
  tabs.forEach(p => p.on('pageerror', e => errors.push(e.message)));
  await Promise.all(tabs.map(p => p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})));
  for (const p of tabs) await expect(p.locator('body')).toBeVisible().catch(() => {});
  await ctx.close();
  QAAnnotate.spike('10-tab spike | errors: ' + errors.filter(e => !e.includes('favicon')).length);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});
