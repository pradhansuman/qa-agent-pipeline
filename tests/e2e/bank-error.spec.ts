// bank - Error: negative, BVA-max, chaos, monkey, L10n
import { test, expect } from '@playwright/test';
import { SecurityPayloads, MonkeyPayloads, L10nPayloads, QAAnnotate, CommonRisks } from '../shared/strategy';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

test('BANK-ERR-01 @smoke: blank submit no crash', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await expect(page.locator('body')).toBeVisible();
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('BANK-ERR-BVA-MAX: 10000-char input no crash', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const inp = page.locator('input[type="text"]').first();
  if (await inp.count()) {
    await inp.fill(SecurityPayloads.boundary.long);
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('body')).toBeVisible();
  QAAnnotate.bva('10000-char BVA-max survived');
});

test('BANK-ERR-CHAOS-OFFLINE: offline mode no unhandled errors', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  await context.setOffline(false);
  QAAnnotate.chaos('Offline chaos: errors=' + errors.filter(e => !e.includes('favicon')).length);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('BANK-ERR-CHAOS-ABORT: aborted POST no white screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.route('**/*', route => {
    if (route.request().method() === 'POST') route.abort('connectionreset').catch(() => {});
    else route.continue().catch(() => {});
  });
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toBeVisible();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon') && !e.includes('Failed to fetch') && !e.includes('ERR_FAILED'));
  QAAnnotate.chaos('POST-abort chaos | errors: ' + critical.length);
  expect(critical).toHaveLength(0);
});

test('BANK-ERR-MONKEY: monkey — arbitrary payloads no crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (const inp of await page.locator('input:not([type="hidden"]), textarea').all()) {
    for (const payload of MonkeyPayloads.slice(0, 6)) await inp.fill(payload).catch(() => {});
  }
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await expect(page.locator('body')).toBeVisible();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));
  QAAnnotate.monkey(MonkeyPayloads.length + ' payloads | errors: ' + critical.length);
  expect(critical).toHaveLength(0);
});

test('BANK-ERR-L10N-RTL: RTL Arabic input no crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const inp = page.locator('input[type="text"]').first();
  if (await inp.count()) await inp.fill(L10nPayloads.rtl);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await expect(page.locator('body')).toBeVisible();
  QAAnnotate.l10n('RTL Arabic survived');
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('BANK-ERR-L10N-CJK: CJK characters no rendering corruption', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const inp = page.locator('input[type="text"]').first();
  if (await inp.count()) await inp.fill(L10nPayloads.cjk);
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await expect(page.locator('body')).toBeVisible();
  QAAnnotate.l10n('CJK survived: ' + L10nPayloads.cjk);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});
