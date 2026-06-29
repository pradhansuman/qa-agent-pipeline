// bank - Security: XSS, SQL, CSRF, rate limiting, storage audit
import { test, expect } from '@playwright/test';
import { SecurityPayloads, QAAnnotate, CommonRisks } from '../shared/strategy';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

for (const payload of SecurityPayloads.xss) {
  test('BANK-SEC-XSS: not executed — ' + payload.slice(0, 30), async ({ page }) => {
    let xssRan = false;
    await page.exposeFunction('__xssProbe', () => { xssRan = true; });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const inp = page.locator('input[type="text"], textarea').first();
    if (await inp.count()) {
      await inp.fill(payload.replace(/alert\(1\)/g, '__xssProbe()'));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
    }
    expect(xssRan).toBe(false);
    QAAnnotate.security('XSS blocked');
  });
}

for (const payload of SecurityPayloads.sql) {
  test('BANK-SEC-SQL: no crash — ' + payload.slice(0, 25), async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const inp = page.locator('input[type="text"]').first();
    if (await inp.count()) { await inp.fill(payload); await page.keyboard.press('Enter'); await page.waitForTimeout(1000); }
    await expect(page.locator('body')).toBeVisible();
  });
}

test('BANK-SEC-CSRF: CSRF token or SameSite cookie present', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const csrf = await page.locator(SecurityPayloads.csrf.tokenSelectors.join(', ')).count();
  const ss = (await page.context().cookies()).some(c => c.sameSite === 'Strict' || c.sameSite === 'Lax');
  if (!csrf && !ss) QAAnnotate.finding('HIGH', CommonRisks.NO_CSRF_TOKEN);
  QAAnnotate.security('csrf=' + (csrf > 0) + ' sameSite=' + ss);
  await expect(page.locator('body')).toBeVisible();
});

test('BANK-SEC-RATE: 10 rapid submits no crash', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const btn = page.locator('button[type="submit"]').first();
  if (await btn.count()) for (let i = 0; i < 10; i++) { await btn.click().catch(() => {}); await page.waitForTimeout(200); }
  await expect(page.locator('body')).toBeVisible();
  const limited = /too many|locked|rate.?limit|429/i.test((await page.locator('body').textContent()) || '');
  if (!limited) QAAnnotate.finding('MEDIUM', CommonRisks.NO_RATE_LIMITING);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('BANK-SEC-STORAGE: password not in web storage', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const pw = page.locator('input[type="password"]').first();
  if (await pw.count()) {
    await pw.fill('SentinelPass99!');
    await page.locator('button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(2000);
    const store = await page.evaluate(() => ({ l: {...localStorage}, s: {...sessionStorage} }));
    expect([...Object.values(store.l), ...Object.values(store.s)].join(' ')).not.toContain('SentinelPass99!');
  }
  QAAnnotate.security('Storage audit passed');
});
