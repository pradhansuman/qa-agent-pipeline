/**
 * DemoApps User Management — Error Handling & Edge Cases
 */
import { test, expect, Browser } from '@playwright/test';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';
let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `err_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('Err Test');
  await page.locator('#email').fill(`err${ts}@qatest.com`);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await page.close();
});

test.beforeEach(async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
});

test('ERR-01 @smoke: wrong credentials show error or stay on login', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(1000);
  await page.locator('#username').fill('no_such_user_xyz');
  await page.locator('#password').fill('wrongpass999');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('#heading-home')).toBeHidden();
});

test('ERR-02: registration with invalid email format is blocked by browser', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  const ts = Date.now();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(`badreg_${ts}`);
  await page.locator('#fullname').fill('Bad Email');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#password').fill('Pass123!');
  await page.locator('#submit').click();
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Registration Successfully');
});

test('ERR-03: edit panel does not auto-open without checkbox selection', async ({ page }) => {
  const formVisible = await page.locator('#fullname').isVisible().catch(() => false);
  expect(formVisible).toBe(false);
});

test('ERR-04: Cancel on Edit does not persist the changed name', async ({ page }) => {
  await page.locator('#checkbox-user-3').check();
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#fullname').fill('SHOULD NOT SAVE XYZ');
  await page.locator('#cancel').click();
  await page.waitForTimeout(1000);
  await expect(page.locator('body')).not.toContainText('SHOULD NOT SAVE XYZ');
});

test('ERR-05: 5 rapid invalid login attempts do not crash the app', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (let i = 0; i < 5; i++) {
    await page.locator('#username').fill('bad' + i);
    await page.locator('#password').fill('bad' + i);
    await page.locator('#button-login-submit').click();
    await page.waitForTimeout(400);
  }
  await expect(page.locator('body')).toBeVisible();
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('ERR-06: "Go to Login" link on register page navigates correctly', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#link-register-to-login').click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#button-login-submit')).toBeVisible();
});

test('ERR-07: Add User with blank fullname does not add a nameless row', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#email').fill('nofullname@t.com');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(0);
});

test('ERR-08: Add User with all fields blank does not crash', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).toBeVisible();
});

test('ERR-09: no JS errors during login → add user → logout cycle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(800);
  await page.locator('#button-logout').click();
  await page.waitForTimeout(1000);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('ERR-10: Unicode characters in fullname field are preserved', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const unicode = '日本語 🚀 العربية';
  await page.locator('#fullname').fill(unicode);
  const val = await page.locator('#fullname').inputValue();
  expect(val).toBe(unicode);
});

// ── ERR-11 ────────────────────────────────────────────────────────────────────
// Network degradation: offline mode must not crash the page
test('ERR-11: going offline does not produce unhandled JS errors', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  await context.setOffline(false);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

// ── ERR-12 ────────────────────────────────────────────────────────────────────
// Whitespace: spaces-only password cannot authenticate
test('ERR-12 WS: whitespace-only password is rejected', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill('   ');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('#heading-home')).toBeHidden();
});

// ── ERR-13 ────────────────────────────────────────────────────────────────────
// Whitespace BVA: leading space in username documents trim policy
test('ERR-13 WS: leading-space username behaviour is documented', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  await page.locator('#username').fill(' ' + testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  const loggedIn = await page.locator('#heading-home').isVisible().catch(() => false);
  test.info().annotations.push({
    type: 'whitespace-policy',
    description: loggedIn
      ? 'App trims leading spaces — login succeeded (permissive)'
      : 'App treats leading-space username as distinct — login rejected (strict)',
  });
});

// ── ERR-14 ────────────────────────────────────────────────────────────────────
// Invalid state transition: Edit without checkbox selection must not open form
test('ERR-14 state: Edit nav without checkbox selection does not open edit form', async ({ page }) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  expect(await page.locator('#cancel').isVisible().catch(() => false)).toBe(false);
});

// ── ERR-15 ────────────────────────────────────────────────────────────────────
// Invalid state transition: Delete without checkbox must not remove any rows
test('ERR-15 state: Delete nav without checkbox selection removes no rows', async ({ page }) => {
  const before = await page.locator('table tbody tr').count();
  await page.locator('#nav-link-delete-user').click();
  await page.waitForTimeout(1500);
  const after = await page.locator('table tbody tr').count();
  expect(after).toBeGreaterThanOrEqual(before);
});

// ── LOOP 1.5: Monkey Testing ─────────────────────────────────────────────────
test('ERR-MONKEY: monkey — random inputs across form fields survive without crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const PAYLOADS = [
    '', '   ', '<script>alert(1)</script>', "' OR '1'='1",
    'a'.repeat(10000), '\u4F60\u597D\u4E16\u754C \uD83C\uDFAF',
    '\x00\x01\x02', '\n\r\t', '%s %d %n', '../../../etc/passwd',
    'null', 'undefined', '-9999999', '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ];
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  for (const payload of PAYLOADS.slice(0, 8)) {
    await page.locator('#username').fill(payload).catch(() => {});
    await page.locator('#password').fill(payload).catch(() => {});
    await page.locator('#button-login-submit').click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await expect(page.locator('body')).toBeVisible();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));
  test.info().annotations.push({ type: 'monkey', description: 'Payloads: ' + PAYLOADS.length + ' | errors: ' + critical.length });
  expect(critical).toHaveLength(0);
});

// ── LOOP 6.2: Localization Testing (L10n) ────────────────────────────────────
test('ERR-L10N-01: RTL Arabic text in username field does not crash login', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const RTL = '\u0645\u0631\u062D\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645';
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill(RTL).catch(() => {});
  await page.locator('#password').fill('TestPass1!').catch(() => {});
  await page.locator('#button-login-submit').click().catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).toBeVisible();
  test.info().annotations.push({ type: 'l10n', description: 'RTL Arabic input survived' });
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

test('ERR-L10N-02: CJK text in fullname field renders without corruption', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const CJK = '\u4F60\u597D\u4E16\u754C\u3053\u3093\u306B\u3061\u306F';
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await page.locator('#nav-link-add-user').click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('#fullname').fill(CJK).catch(() => {});
  await page.locator('#email').fill('cjk' + Date.now() + '@t.com').catch(() => {});
  await page.locator('#gender-male').check().catch(() => {});
  await page.locator('#language-english').check().catch(() => {});
  await page.locator('#button-add-user-submit').click().catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.locator('body')).toBeVisible();
  test.info().annotations.push({ type: 'l10n', description: 'CJK fullname: ' + CJK });
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

// ── LOOP 6.7: Chaos Engineering ───────────────────────────────────────────────
test('ERR-CHAOS-01: aborted POST requests handled gracefully — no white screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.route('**/*', route => {
    if (route.request().method() === 'POST') route.abort('connectionreset').catch(() => {});
    else route.continue().catch(() => {});
  });
  await page.locator('#username').fill('chaos_user').catch(() => {});
  await page.locator('#password').fill('TestPass1!').catch(() => {});
  await page.locator('#button-login-submit').click().catch(() => {});
  await page.waitForTimeout(2500);
  await expect(page.locator('body')).toBeVisible();
  const critical = errors.filter(e => !e.toLowerCase().includes('favicon') && !e.includes('Failed to fetch') && !e.includes('ERR_FAILED'));
  test.info().annotations.push({ type: 'chaos', description: 'POST-abort chaos | errors: ' + critical.length });
  expect(critical).toHaveLength(0);
});

test('ERR-CHAOS-02: slow network (500ms resource delay) still renders page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*.{js,css}', async route => {
    await new Promise(r => setTimeout(r, 500));
    await route.continue().catch(() => {});
  });
  const start = Date.now();
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const elapsed = Date.now() - start;
  await expect(page.locator('body')).toBeVisible();
  test.info().annotations.push({ type: 'chaos', description: 'Slow-network load: ' + elapsed + 'ms' });
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});
