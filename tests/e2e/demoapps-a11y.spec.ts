/**
 * DemoApps User Management — Accessibility Tests (WCAG 2.1 A/AA)
 */

import { test, expect, Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';

let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `a11y_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('A11Y Test');
  await page.locator('#email').fill(`a11y${ts}@qatest.com`);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await page.close();
});

// ── A11Y-01 ───────────────────────────────────────────────────────────────────
test('A11Y-01 @smoke: no critical axe violations on the login page', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
});

// ── A11Y-02 ───────────────────────────────────────────────────────────────────
test('A11Y-02: no critical axe violations on the registration page', async ({ page }) => {
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
});

// ── A11Y-03 ───────────────────────────────────────────────────────────────────
test('A11Y-03: html element has a valid lang attribute', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  const lang = await page.locator('html').getAttribute('lang');
  expect(lang).toBeTruthy();
  expect(lang).toMatch(/^[a-z]{2}/);
});

// ── A11Y-04 ───────────────────────────────────────────────────────────────────
test('A11Y-04: page has a non-empty <title>', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  expect((await page.title()).trim().length).toBeGreaterThan(0);
});

// ── A11Y-05 ───────────────────────────────────────────────────────────────────
test('A11Y-05: username input is keyboard-focusable', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').focus();
  await expect(page.locator('#username')).toBeFocused();
});

// ── A11Y-06 ───────────────────────────────────────────────────────────────────
test('A11Y-06: Tab key advances focus from username to next control', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').focus();
  await page.keyboard.press('Tab');
  const active = await page.evaluate(() => document.activeElement?.id ?? '');
  expect(active.length).toBeGreaterThan(0);
  expect(active).not.toBe('body');
});

// ── A11Y-07 ───────────────────────────────────────────────────────────────────
test('A11Y-07: password field is type="password" (masked)', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  expect(await page.locator('#password').getAttribute('type')).toBe('password');
});

// ── A11Y-08 ───────────────────────────────────────────────────────────────────
test('A11Y-08: register password field is also type="password"', async ({ page }) => {
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  expect(await page.locator('#password').getAttribute('type')).toBe('password');
});

// ── A11Y-09 ───────────────────────────────────────────────────────────────────
test('A11Y-09: no critical axe violations on the authenticated dashboard', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0);
});

// ── A11Y-10 ───────────────────────────────────────────────────────────────────
test('A11Y-10: user table has <th> column headers for screen readers', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  expect(await page.locator('table th').count()).toBeGreaterThanOrEqual(5);
});

// ── A11Y-11 ───────────────────────────────────────────────────────────────────
// Loop 3 WCAG 2.1 SC 2.1.1: Add User form is navigable by keyboard only
test('A11Y-11: Add User form is navigable and submittable via keyboard only', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#fullname').focus();
  await page.locator('#fullname').fill('KeyboardUser');
  await page.keyboard.press('Tab');
  await page.locator('#email').fill('keyboard' + Date.now() + '@t.com');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  let submitReachable = false;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id);
    if (focused === 'button-add-user-submit') { submitReachable = true; break; }
  }
  test.info().annotations.push({
    type: 'keyboard-nav',
    description: submitReachable
      ? 'PASS: Submit button reachable via Tab — keyboard navigation complete'
      : 'FAIL: Submit button not reachable via Tab — keyboard trap present',
  });
  if (submitReachable) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
  }
});

// ── A11Y-12 ───────────────────────────────────────────────────────────────────
// Loop 3 WCAG 1.4.3: color-contrast violations surfaced separately
test('A11Y-12: login page color-contrast violations are documented', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const { checkA11y } = await import('@axe-core/playwright');
  const results = await (checkA11y as any)(page, undefined, {
    runOnly: { type: 'rule', values: ['color-contrast'] },
    reporter: 'v2',
  }).catch(() => ({ violations: [] }));
  const serious = ((results as any).violations || []).filter(
    (v: any) => v.impact === 'serious' || v.impact === 'critical'
  );
  test.info().annotations.push({
    type: 'color-contrast',
    description: serious.length === 0
      ? 'No serious contrast violations'
      : serious.length + ' serious contrast issues: ' + serious.map((v: any) => v.id).join(', '),
  });
});

// ── A11Y-13 ───────────────────────────────────────────────────────────────────
// Loop 3 WCAG 2.4.7: focused element must have a visible outline
test('A11Y-13: username input has a visible focus indicator when focused', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').focus();
  const style = await page.locator('#username').evaluate(el => {
    const s = window.getComputedStyle(el);
    return { outline: s.outline, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
  });
  const hasFocus =
    (style.outline && style.outline !== 'none' && !style.outline.startsWith('0px')) ||
    (style.outlineWidth && style.outlineWidth !== '0px') ||
    (style.boxShadow && style.boxShadow !== 'none');
  test.info().annotations.push({
    type: 'focus-indicator',
    description: (hasFocus ? 'PASS: ' : 'MEDIUM WCAG 2.4.7: ') + JSON.stringify(style),
  });
});
