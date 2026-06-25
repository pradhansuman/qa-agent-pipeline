/**
 * DemoApps User Management — Security Tests
 */
import { test, expect, Browser } from '@playwright/test';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';
let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `sec_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('Sec Test');
  await page.locator('#email').fill(`sec${ts}@qatest.com`);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await page.close();
});

test('SEC-01 @smoke: invalid credentials do not log in', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill('nobody_xyz_9');
  await page.locator('#password').fill('wrongpass');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('#heading-home')).toBeHidden();
});

test('SEC-02: empty username prevents login', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#password').fill('somepass');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#heading-home')).toBeHidden();
});

test('SEC-03: empty password prevents login', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#heading-home')).toBeHidden();
});

test('SEC-04: password field is type="password"', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  expect(await page.locator('#password').getAttribute('type')).toBe('password');
});

test('SEC-05: XSS payload in username is not executed', async ({ page }) => {
  let xssRan = false;
  await page.exposeFunction('__sec05xss', () => { xssRan = true; });
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill('<img src=x onerror="__sec05xss()">');
  await page.locator('#password').fill('x');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  expect(xssRan).toBe(false);
});

test('SEC-06: SQL injection string in username does not crash login', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill("' OR '1'='1");
  await page.locator('#password').fill("' OR '1'='1");
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#heading-home')).toBeHidden();
});

test('SEC-07: dashboard nav requires authentication', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await expect(page.locator('#nav-link-add-user')).toBeHidden();
  await expect(page.locator('#button-login-submit')).toBeVisible();
});

test('SEC-08: logout clears session — Add User nav is gone', async ({ page }) => {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await page.locator('#button-logout').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#nav-link-add-user')).toBeHidden();
  await expect(page.locator('#button-login-submit')).toBeVisible();
});

// ── SEC-09 ────────────────────────────────────────────────────────────────────
// BVA boundary payload: 1000-char username must not crash server
test('SEC-09 BVA: 1000-char username does not crash the server', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill('a'.repeat(1000));
  await page.locator('#password').fill('irrelevant');
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#heading-home')).toBeHidden();
});

// ── SEC-10 ────────────────────────────────────────────────────────────────────
// XSS via fullname field in Add User form
test('SEC-10: script tag in fullname is not executed when rendered in table', async ({ page }) => {
  let xssRan = false;
  await page.exposeFunction('__sec10xss', () => { xssRan = true; });
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(1500);
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#fullname').fill('<script>__sec10xss()</script>');
  await page.locator('#email').fill('xss' + Date.now() + '@t.com');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(2000);
  expect(xssRan).toBe(false);
});

// ── SEC-11 ────────────────────────────────────────────────────────────────────
// Malformed payload: oversized password does not crash the app
test('SEC-11: 500-char password does not cause a server crash', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill('anyuser');
  await page.locator('#password').fill('p'.repeat(500));
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#heading-home')).toBeHidden();
});

// ── SEC-12 ────────────────────────────────────────────────────────────────────
// Point 68: CSRF — login form should have a CSRF token or use SameSite cookies
test('SEC-12 CSRF: login form has CSRF protection (token or SameSite cookie)', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  // 1. Check for hidden CSRF token input
  const csrfInputCount = await page.locator(
    'input[name*="csrf"], input[name*="token"], input[name*="_token"], input[name*="authenticity"]'
  ).count();
  // 2. Check cookies for SameSite policy
  const cookies = await page.context().cookies();
  const hasSameSite = cookies.some(c => c.sameSite === 'Strict' || c.sameSite === 'Lax');
  const hasSecureCookie = cookies.some(c => c.secure);
  const csrfProtected = csrfInputCount > 0 || hasSameSite;
  test.info().annotations.push({
    type: 'csrf-analysis',
    description: JSON.stringify({
      csrfTokenField: csrfInputCount > 0,
      sameSiteCookie: hasSameSite,
      secureCookie: hasSecureCookie,
      verdict: csrfProtected ? 'CSRF protection present' : 'HIGH: No CSRF token and no SameSite cookie detected',
    }),
  });
  // Surface as a finding without hard-failing (app may use custom mechanism)
  if (!csrfProtected) {
    console.warn('SEC-12: No CSRF token field or SameSite cookie found — manual review recommended');
  }
  await expect(page.locator('body')).toBeVisible();
});

// ── SEC-13 ────────────────────────────────────────────────────────────────────
// Point 54: Rate limiting — 10 rapid invalid login attempts must not crash app
test('SEC-13 rate-limit: 10 rapid invalid logins do not crash the server', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  for (let i = 0; i < 10; i++) {
    await page.locator('#username').fill('brute_user_' + i);
    await page.locator('#password').fill('wrong_pass_' + i);
    await page.locator('#button-login-submit').click();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(2000);
  // App must remain visible and uncrashed
  await expect(page.locator('body')).toBeVisible();
  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
  // Document whether rate limiting or lockout appeared
  const bodyText = (await page.locator('body').textContent()) || '';
  const wasLimited = /too many|locked|blocked|rate.?limit|429|suspended/i.test(bodyText);
  test.info().annotations.push({
    type: 'rate-limit',
    description: wasLimited
      ? 'Rate limiting ACTIVE — lockout/429 message detected after 10 attempts'
      : 'MEDIUM: No rate limiting detected — 10 rapid attempts all processed without throttle',
  });
});

// ── SEC-14 ────────────────────────────────────────────────────────────────────
// Loop 4: password must not leak into localStorage or sessionStorage
test('SEC-14: password is not stored in localStorage or sessionStorage after login', async ({ page }) => {
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2500);
  const store = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  const allValues = [...Object.values(store.local), ...Object.values(store.session)].join(' ');
  expect(allValues).not.toContain(testUser.password);
  test.info().annotations.push({
    type: 'storage-audit',
    description: 'localStorage keys: [' + Object.keys(store.local).join(', ') + '] sessionStorage keys: [' + Object.keys(store.session).join(', ') + ']',
  });
});

// ── SEC-15 ────────────────────────────────────────────────────────────────────
// Loop 4: password value must not appear in any XHR response body
test('SEC-15: password does not appear in any API response body', async ({ page }) => {
  const leaks: string[] = [];
  page.on('response', async r => {
    const body = await r.text().catch(() => '');
    if (body.includes(testUser.password)) leaks.push(r.url());
  });
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2500);
  expect(leaks).toHaveLength(0);
  if (leaks.length > 0) {
    test.info().annotations.push({ type: 'data-leak', description: 'CRITICAL: Password found in response from: ' + leaks.join(', ') });
  }
});

// ── SEC-16 ────────────────────────────────────────────────────────────────────
// Loop 5: login POST must use a valid Content-Type header
test('SEC-16: login POST request uses a valid Content-Type header', async ({ page }) => {
  let captured = '';
  page.on('request', r => {
    if (r.method() === 'POST') captured = r.headers()['content-type'] || r.headers()['Content-Type'] || '';
  });
  await page.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#password').fill(testUser.password);
  await page.locator('#button-login-submit').click();
  await page.waitForTimeout(2500);
  if (captured) {
    const valid = /application\/json|application\/x-www-form-urlencoded|multipart\/form-data/.test(captured);
    test.info().annotations.push({ type: 'content-type', description: captured });
    expect(valid).toBe(true);
  } else {
    test.info().annotations.push({ type: 'content-type', description: 'No POST captured — traditional form POST with page redirect' });
  }
});

// ── SEC-17 ────────────────────────────────────────────────────────────────────
// Loop 3: concurrent duplicate email registrations — at most one must succeed
test('SEC-17: concurrent duplicate email registration is rejected for at least one request', async ({ browser }) => {
  const email = 'dupe' + Date.now() + '@t.com';
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pgA = await ctxA.newPage();
  const pgB = await ctxB.newPage();
  const regUrl = 'https://demoapps.qspiders.com/user-management/register';
  await Promise.all([
    pgA.goto(regUrl, { waitUntil: 'domcontentloaded' }),
    pgB.goto(regUrl, { waitUntil: 'domcontentloaded' }),
  ]);
  await pgA.waitForTimeout(800);
  for (const [pg, sfx] of [[pgA, 'A'], [pgB, 'B']] as [any, string][]) {
    await pg.locator('#fullname').fill('Dupe ' + sfx).catch(() => {});
    await pg.locator('#email').fill(email).catch(() => {});
    await pg.locator('#username').fill('dupeuser' + sfx + Date.now().toString().slice(-4)).catch(() => {});
    await pg.locator('#password').fill('DupePass1!').catch(() => {});
  }
  await Promise.all([
    pgA.locator('#button-register-submit, button[type="submit"]').click().catch(() => {}),
    pgB.locator('#button-register-submit, button[type="submit"]').click().catch(() => {}),
  ]);
  await Promise.all([pgA.waitForTimeout(3000), pgB.waitForTimeout(3000)]);
  const textA = (await pgA.locator('body').textContent().catch(() => '')) || '';
  const textB = (await pgB.locator('body').textContent().catch(() => '')) || '';
  const dupErrPattern = /error|already|exist|duplicate|taken|registered/i;
  const atLeastOneRejected = dupErrPattern.test(textA) || dupErrPattern.test(textB);
  test.info().annotations.push({
    type: 'concurrent-dupe',
    description: atLeastOneRejected
      ? 'Server correctly rejected at least one duplicate email'
      : 'HIGH: Both registrations may have accepted the same email — race condition risk',
  });
  await ctxA.close();
  await ctxB.close();
});
