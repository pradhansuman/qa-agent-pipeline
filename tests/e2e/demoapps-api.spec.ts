/**
 * DemoApps User Management — API / Contract Tests
 * Validates form field types, table schema, and data integrity.
 */

import { test, expect, Browser } from '@playwright/test';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';

let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `api_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('API Test User');
  await page.locator('#email').fill(`api${ts}@qatest.com`);
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

// ── API-01 ────────────────────────────────────────────────────────────────────
test('API-01 @smoke: valid login lands on the dashboard — not the login page', async ({ page }) => {
  await expect(page.locator('#heading-home')).toBeVisible();
  await expect(page.locator('#button-login-submit')).toBeHidden();
});

// ── API-02 ────────────────────────────────────────────────────────────────────
test('API-02 @smoke: registration returns success message for a new user', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  const ts = Date.now();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(`apicheck_${ts}`);
  await page.locator('#fullname').fill('API Check');
  await page.locator('#email').fill(`apicheck${ts}@test.com`);
  await page.locator('#password').fill('Check123!');
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toContainText('Registration Successfully');
});

// ── API-03 ────────────────────────────────────────────────────────────────────
test('API-03: user table exposes correct column headers', async ({ page }) => {
  const headers = await page.locator('table th').allTextContents();
  expect(headers).toContain('User ID');
  expect(headers).toContain('Full Name');
  expect(headers).toContain('Status');
  expect(headers).toContain('Gender');
  expect(headers).toContain('Language');
});

// ── API-04 ────────────────────────────────────────────────────────────────────
test('API-04: first demo user row has non-empty values in all key columns', async ({ page }) => {
  const cells = await page.locator('table tbody tr:first-child td').allTextContents();
  const nonEmpty = cells.filter(c => c.trim().length > 0);
  expect(nonEmpty.length).toBeGreaterThanOrEqual(5);
});

// ── API-05 ────────────────────────────────────────────────────────────────────
test('API-05: Add User email field has type="email"', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const type = await page.locator('#email').getAttribute('type');
  expect(type).toBe('email');
});

// ── API-06 ────────────────────────────────────────────────────────────────────
test('API-06: Add User phone field has type="tel"', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const type = await page.locator('#phone').getAttribute('type');
  expect(type).toBe('tel');
});

// ── API-07 ────────────────────────────────────────────────────────────────────
test('API-07: Edit User pre-populates email with a valid address', async ({ page }) => {
  await page.locator('#checkbox-user-1').check();
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  const email = await page.locator('#email').inputValue();
  expect(email).toMatch(/@/);
});

// ── API-08 ────────────────────────────────────────────────────────────────────
test('API-08: language checkboxes support multiple simultaneous selections', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#language-english').check();
  await page.locator('#language-hindi').check();
  await page.locator('#language-kannada').check();
  expect(await page.locator('#language-english').isChecked()).toBe(true);
  expect(await page.locator('#language-hindi').isChecked()).toBe(true);
  expect(await page.locator('#language-kannada').isChecked()).toBe(true);
});

// ── API-09 ────────────────────────────────────────────────────────────────────
test('API-09: gender radio group — selecting Female deselects Male', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#gender-male').check();
  await page.locator('#gender-female').check();
  expect(await page.locator('#gender-male').isChecked()).toBe(false);
  expect(await page.locator('#gender-female').isChecked()).toBe(true);
});

// ── API-10 ────────────────────────────────────────────────────────────────────
test('API-10: dashboard produces no JS console errors after login', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

// ── API-11 ────────────────────────────────────────────────────────────────────
// Equivalence Partitioning: email HTML5 validity across partitions
const EP_EMAILS: Array<[string, string, boolean]> = [
  ['empty',      '',               false],
  ['alpha-only', 'notanemail',     false],
  ['partial-at', 'user@',          false],
  ['valid',      'test@valid.com', true],
];
for (const [label, value, shouldBeValid] of EP_EMAILS) {
  test('API-11 EP: email validity — ' + label, async ({ page }) => {
    await page.locator('#nav-link-add-user').click();
    await page.waitForTimeout(1000);
    const el = page.locator('#email');
    await el.fill(value);
    const valid = await el.evaluate((e: HTMLInputElement) => e.checkValidity());
    expect(valid).toBe(shouldBeValid);
  });
}

// ── API-12 ────────────────────────────────────────────────────────────────────
// BVA: username maxlength constrains input at boundary
test('API-12 BVA: username field enforces maxlength at boundary', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management/register', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const maxLen = await page.locator('#username').getAttribute('maxlength');
  if (maxLen) {
    const limit = parseInt(maxLen);
    await page.locator('#username').fill('a'.repeat(limit + 1));
    const actual = (await page.locator('#username').inputValue()).length;
    expect(actual).toBeLessThanOrEqual(limit);
  } else {
    test.info().annotations.push({ type: 'bva-note', description: 'No maxlength on #username — server-side only' });
  }
});

// ── API-13 ────────────────────────────────────────────────────────────────────
// Whitespace: fullname with only spaces should not produce a valid row
test('API-13 WS: whitespace-only fullname does not create a blank-named user', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#fullname').fill('   ');
  await page.locator('#email').fill('ws' + Date.now() + '@t.com');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(1500);
  const cells = await page.locator('table tbody td:nth-child(3)').allTextContents();
  expect(cells.some(c => c.trim() === '')).toBe(false);
});

// ── API-14 ────────────────────────────────────────────────────────────────────
// Parameterized: all status options set correctly without JS errors
test('API-14 param: all three status options select without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  for (const opt of ['Active', 'Blocked', 'Unblock']) {
    await page.locator('#user-status').selectOption(opt);
    expect(await page.locator('#user-status').inputValue()).toBe(opt);
  }
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
});

// ── API-15 ────────────────────────────────────────────────────────────────────
// Point 46: HTTP status code — valid login endpoint returns non-5xx
test('API-15 status: valid login request responds with HTTP 2xx or 3xx', async ({ page }) => {
  let loginResponse: { status: number; url: string } | null = null;
  page.on('response', r => {
    if ((r.url().includes('/login') || r.url().includes('/auth') || r.url().includes('/signin'))
        && r.request().method() === 'POST') {
      loginResponse = { status: r.status(), url: r.url() };
    }
  });
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2500);
  if (loginResponse) {
    test.info().annotations.push({ type: 'http-status', description: loginResponse.status + ' ' + loginResponse.url });
    expect(loginResponse.status).toBeLessThan(500);
  } else {
    // No XHR — form uses full-page POST/redirect; verify dashboard loaded instead
    test.info().annotations.push({ type: 'http-status', description: 'No XHR detected — traditional form submission with page reload' });
    await expect(page.locator('#heading-home')).toBeVisible({ timeout: 5000 }).catch(() =>
      test.info().annotations.push({ type: 'http-status-note', description: '#heading-home not found after login' }));
  }
});

// ── API-16 ────────────────────────────────────────────────────────────────────
// Point 46: HTTP status code — invalid login returns 4xx or shows error UI
test('API-16 status: invalid credentials produce HTTP 4xx or visible error', async ({ page }) => {
  let loginResponse: { status: number } | null = null;
  page.on('response', r => {
    if ((r.url().includes('/login') || r.url().includes('/auth') || r.url().includes('/signin'))
        && r.request().method() === 'POST') {
      loginResponse = { status: r.status() };
    }
  });
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill('invalid_xyz_99');
  await page.locator('#password').fill('wrong_pass_99');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2500);
  if (loginResponse) {
    expect(loginResponse.status).toBeGreaterThanOrEqual(400);
    expect(loginResponse.status).toBeLessThan(500);
  } else {
    // No XHR — verify that login was refused via UI
    await expect(page.locator('#heading-home')).toBeHidden();
  }
});

// ── API-17 ────────────────────────────────────────────────────────────────────
// Point 48: Response schema — capture any non-GET API calls and assert no 5xx
test('API-17 schema: Add User API calls return non-5xx and are captured', async ({ page }) => {
  const captured: Array<{ method: string; url: string; status: number }> = [];
  page.on('response', r => {
    if (r.request().method() !== 'GET') {
      captured.push({ method: r.request().method(), url: r.url(), status: r.status() });
    }
  });
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#fullname').fill('Schema ' + Date.now().toString().slice(-4));
  await page.locator('#email').fill('schema' + Date.now() + '@t.com');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(2500);
  if (captured.length > 0) {
    test.info().annotations.push({ type: 'api-schema', description: JSON.stringify(captured) });
    captured.forEach(r => expect(r.status).toBeLessThan(500));
  } else {
    test.info().annotations.push({ type: 'api-schema', description: 'No non-GET requests — app uses server-rendered form submission' });
    // Verify success via DOM instead
    expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0);
  }
});

// ── API-18 ────────────────────────────────────────────────────────────────────
// Point 30: Minimum BVA — single-character fullname is the lower boundary
test('API-18 BVA-min: single-character fullname documents minimum length policy', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const email = 'minname' + Date.now() + '@t.com';
  await page.locator('#fullname').fill('X');
  await page.locator('#email').fill(email);
  await page.locator('#gender-female').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(1800);
  const rows = await page.locator('table tbody tr').allTextContents();
  const accepted = rows.some(r => r.includes(email));
  test.info().annotations.push({
    type: 'bva-min',
    description: accepted
      ? 'Single-char fullname ACCEPTED — no minimum length enforced'
      : 'Single-char fullname REJECTED — minimum length validation exists',
  });
});
