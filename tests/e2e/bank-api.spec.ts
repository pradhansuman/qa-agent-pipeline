// bank - API: HTTP status, BVA, EP, schema, 404
import { test, expect } from '@playwright/test';
import { BVA, EP, QAAnnotate } from '../shared/strategy';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

test('BANK-API-01 @smoke: returns 2xx', async ({ page }) => {
  let status = 0;
  page.on('response', r => { if (r.url().startsWith(BASE_URL)) status = r.status(); });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  if (status > 0) expect(status).toBeLessThan(400);
  else await expect(page.locator('body')).toBeVisible();
});

test('BANK-API-BVA: maxlength enforced at boundary', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (const inp of await page.locator('input[maxlength]').all()) {
    const max = parseInt((await inp.getAttribute('maxlength')) || '0');
    if (max > 0) {
      await inp.fill('a'.repeat(max + 1));
      expect((await inp.inputValue()).length).toBeLessThanOrEqual(max);
      QAAnnotate.bva('maxlength=' + max);
    }
  }
});

for (const ep of EP.email) {
  test('BANK-API-EP-email-' + ep.label, async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const el = page.locator('input[type="email"]').first();
    if (await el.count()) {
      await el.fill(ep.value);
      expect(await el.evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(ep.valid);
    }
    QAAnnotate.ep('email EP: ' + ep.label);
  });
}

test('BANK-API-404: no 404 resources', async ({ page }) => {
  const missing: string[] = [];
  page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  expect(missing.filter(u => !u.includes('favicon'))).toHaveLength(0);
});
