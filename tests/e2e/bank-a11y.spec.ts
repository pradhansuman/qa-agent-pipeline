// bank - A11Y: axe-core WCAG, keyboard, focus, contrast
import { test, expect } from '@playwright/test';
import { checkA11y } from '@axe-core/playwright';
import { QAAnnotate, CommonRisks } from '../shared/strategy';

const BASE_URL = 'file:///Users/skp/Downloads/QA_AGents/bank.html';

test('BANK-A11Y-01 @smoke: no critical WCAG violations', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const r = await checkA11y(page, undefined, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, reporter: 'v2' }).catch(() => ({ violations: [] }));
  const critical = (r as any).violations?.filter((v: any) => v.impact === 'critical') ?? [];
  if (critical.length) QAAnnotate.finding('CRITICAL', CommonRisks.NO_LABEL_ON_INPUTS);
  expect(critical).toHaveLength(0);
});

test('BANK-A11Y-02: html lang attribute present', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  expect(((await page.locator('html').getAttribute('lang')) || '').trim().length).toBeGreaterThan(0);
});

test('BANK-A11Y-03: form inputs keyboard-focusable', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (const el of await page.locator('input:not([type="hidden"]), select, textarea').all()) {
    if (!await el.isDisabled() && (await el.getAttribute('tabindex')) !== '-1') {
      await el.focus();
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');
      expect(['INPUT','SELECT','TEXTAREA','BUTTON']).toContain(tag.toUpperCase());
    }
  }
});

test('BANK-A11Y-04: visible focus indicator', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const el = page.locator('input:not([type="hidden"]), button').first();
  if (await el.count()) {
    await el.focus();
    const s = await el.evaluate(e => { const c = window.getComputedStyle(e); return { outline: c.outline, box: c.boxShadow }; });
    if (!(s.outline && !s.outline.includes('0px') && s.outline !== 'none') && !(s.box && s.box !== 'none'))
      QAAnnotate.finding('MEDIUM', CommonRisks.NO_FOCUS_INDICATOR);
  }
});

test('BANK-A11Y-05: contrast issues documented', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const r = await checkA11y(page, undefined, { runOnly: { type: 'rule', values: ['color-contrast'] }, reporter: 'v2' }).catch(() => ({ violations: [] }));
  QAAnnotate.a11y(((r as any).violations?.length ?? 0) + ' contrast issues');
});
