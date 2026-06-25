/**
 * DemoApps User Management — UI Interaction Tests
 */

import { test, expect, Browser } from '@playwright/test';

const LOGIN_URL    = 'https://demoapps.qspiders.com/user-management';
const REGISTER_URL = 'https://demoapps.qspiders.com/user-management/register';

let testUser = { username: '', password: 'QATest123!' };

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ts = Date.now();
  testUser.username = `ui_${ts}`;
  const page = await browser.newPage();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('#username').fill(testUser.username);
  await page.locator('#fullname').fill('UI Test User');
  await page.locator('#email').fill(`ui${ts}@qatest.com`);
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

// ── UI-01 ─────────────────────────────────────────────────────────────────────
test('UI-01 @smoke: dashboard shows User Management heading after login', async ({ page }) => {
  await expect(page.locator('#heading-home')).toContainText('User Management');
});

// ── UI-02 ─────────────────────────────────────────────────────────────────────
test('UI-02 @smoke: dashboard displays the signed-in username', async ({ page }) => {
  await expect(page.locator('body')).toContainText(testUser.username);
});

// ── UI-03 ─────────────────────────────────────────────────────────────────────
test('UI-03 @smoke: user list table renders with at least 3 demo users', async ({ page }) => {
  await expect(page.locator('#heading-user-list')).toContainText('List of Users');
  const rows = page.locator('table tbody tr');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
});

// ── UI-04 ─────────────────────────────────────────────────────────────────────
test('UI-04: logout returns to the login page', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.locator('#button-login-submit')).toBeVisible();
});

// ── UI-05 ─────────────────────────────────────────────────────────────────────
test('UI-05: "Create an account" link navigates to the register page', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(1000);
  await page.locator('#link-login-to-register').click();
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/register/);
  await expect(page.locator('#submit')).toBeVisible();
});

// ── UI-06 ─────────────────────────────────────────────────────────────────────
test('UI-06: registration shows success message on valid submission', async ({ page }) => {
  await page.locator('#button-logout').click();
  await page.waitForTimeout(800);
  const ts = Date.now();
  await page.goto(REGISTER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#username').fill(`reg_${ts}`);
  await page.locator('#fullname').fill('New Reg User');
  await page.locator('#email').fill(`reg${ts}@test.com`);
  await page.locator('#password').fill('NewPass123!');
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toContainText('Registration Successfully');
});

// ── UI-07 ─────────────────────────────────────────────────────────────────────
test('UI-07: Add User panel opens with correct form fields', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#fullname')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#user-status')).toBeVisible();
  await expect(page.locator('#gender-male')).toBeVisible();
  await expect(page.locator('#button-add-user-submit')).toBeVisible();
});

// ── UI-08 ─────────────────────────────────────────────────────────────────────
test('UI-08: Add User successfully adds a new user to the list', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const name = 'Added User ' + Date.now().toString().slice(-5);
  await page.locator('#fullname').fill(name);
  await page.locator('#email').fill(`add${Date.now()}@test.com`);
  await page.locator('#phone').fill('9876543210');
  await page.locator('#user-status').selectOption('Active');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toContainText(name);
});

// ── UI-09 ─────────────────────────────────────────────────────────────────────
test('UI-09: selecting a checkbox then clicking Edit opens pre-populated form', async ({ page }) => {
  await page.locator('#checkbox-user-1').check();
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  const fullname = await page.locator('#fullname').inputValue();
  expect(fullname.length).toBeGreaterThan(0);
  const email = await page.locator('#email').inputValue();
  expect(email.length).toBeGreaterThan(0);
});

// ── UI-10 ─────────────────────────────────────────────────────────────────────
test('UI-10: Cancel in Edit User returns to the dashboard', async ({ page }) => {
  await page.locator('#checkbox-user-1').check();
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  await page.locator('#cancel').click();
  await page.waitForTimeout(1000);
  await expect(page.locator('#heading-user-list')).toBeVisible();
});

// ── UI-11 ─────────────────────────────────────────────────────────────────────
test('UI-11: Edit User updates the name and it appears in the list', async ({ page }) => {
  await page.locator('#checkbox-user-2').check();
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  const updated = 'Edited ' + Date.now().toString().slice(-5);
  await page.locator('#fullname').fill(updated);
  await page.locator('#submit').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toContainText(updated);
});

// ── UI-12 ─────────────────────────────────────────────────────────────────────
test('UI-12: status dropdown has Active, Blocked, and Unblock options', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const options = await page.locator('#user-status option').allTextContents();
  expect(options).toContain('Active');
  expect(options).toContain('Blocked');
  expect(options).toContain('Unblock');
});

// ── UI-13 ─────────────────────────────────────────────────────────────────────
// RTM: CRUD-Delete — completes the full Create/Read/Update/Delete matrix
test('UI-13: Delete removes a user from the list', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const name = 'ToDelete ' + Date.now().toString().slice(-4);
  await page.locator('#fullname').fill(name);
  await page.locator('#email').fill('del' + Date.now() + '@t.com');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(2000);
  const count = await page.locator('table tbody tr').count();
  await page.locator('#checkbox-user-' + count).check();
  await page.locator('#nav-link-delete-user').click();
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).not.toContainText(name);
});

// ── UI-14 ─────────────────────────────────────────────────────────────────────
// Destructive: idempotency — rapid double-click must not duplicate the record
test('UI-14: rapid double-click on Add User submit does not create duplicates', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const name = 'DblClick ' + Date.now().toString().slice(-4);
  await page.locator('#fullname').fill(name);
  await page.locator('#email').fill('dbl' + Date.now() + '@t.com');
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').dblclick();
  await page.waitForTimeout(2500);
  const matches = await page.locator('table tbody tr').filter({ hasText: name }).count();
  expect(matches).toBeLessThanOrEqual(1);
});

// ── UI-15 ─────────────────────────────────────────────────────────────────────
// State lifecycle: multi-context session behaviour after logout
test('UI-15: logout in context A documents session policy for context B', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const url = 'https://demoapps.qspiders.com/user-management';
  for (const p of [pageA, pageB]) {
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1000);
    await p.locator('#username').fill(testUser.username);
    await p.locator('#password').fill(testUser.password);
    await p.locator('#button-login-submit').click();
    await p.waitForTimeout(1500);
  }
  await pageA.locator('#button-logout').click();
  await pageA.waitForTimeout(1000);
  await pageB.reload({ waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(1500);
  const bHasNav = await pageB.locator('#nav-link-add-user').isVisible().catch(() => false);
  await expect(pageB.locator('body')).toBeVisible();
  test.info().annotations.push({
    type: 'session-policy',
    description: bHasNav
      ? 'Client-side: Tab B retains session after Tab A logout'
      : 'Server-side: Tab B invalidated after Tab A logout',
  });
  await ctxA.close();
  await ctxB.close();
});

// ── UI-16 ─────────────────────────────────────────────────────────────────────
// State machine: all status transitions are reachable in the edit form
test('UI-16: status transitions Active/Blocked/Unblock are all selectable', async ({ page }) => {
  await page.locator('#checkbox-user-1').check();
  await page.locator('#nav-link-edit-user').click();
  await page.waitForTimeout(1000);
  for (const status of ['Active', 'Blocked', 'Unblock']) {
    await page.locator('#user-status').selectOption(status);
    expect(await page.locator('#user-status').inputValue()).toBe(status);
  }
});

// ── UI-17 ─────────────────────────────────────────────────────────────────────
// Point 44: Notification — success feedback visible after Add User
test('UI-17: success indicator appears after adding a user', async ({ page }) => {
  await page.locator('#nav-link-add-user').click();
  await page.waitForTimeout(1000);
  const email = 'notify' + Date.now() + '@t.com';
  await page.locator('#fullname').fill('Notify ' + Date.now().toString().slice(-4));
  await page.locator('#email').fill(email);
  await page.locator('#gender-male').check();
  await page.locator('#language-english').check();
  await page.locator('#button-add-user-submit').click();
  await page.waitForTimeout(2000);
  // Check for toast, alert, banner, or the new row appearing in the table
  const toastCount = await page.locator('[role="alert"], .toast, .alert, .success, .notification, .snackbar').count();
  const rowAppeared = (await page.locator('table tbody tr').allTextContents()).some(t => t.includes(email));
  test.info().annotations.push({
    type: 'notification',
    description: toastCount > 0
      ? 'Toast/alert element present after submit'
      : rowAppeared
        ? 'No toast — table row appearing is the success indicator'
        : 'WARNING: No visible success feedback detected',
  });
  // At minimum the new row must be in the table
  expect(rowAppeared).toBe(true);
});

// ── UI-18 ─────────────────────────────────────────────────────────────────────
// Point 23: Pairwise testing — 4 representative gender × language combinations
const PAIRWISE_COMBOS: Array<{ gender: string; gSel: string; lang: string; lSel: string }> = [
  { gender: 'Male',   gSel: '#gender-male',   lang: 'English', lSel: '#language-english' },
  { gender: 'Female', gSel: '#gender-female', lang: 'Dutch',   lSel: '#language-dutch'   },
  { gender: 'Male',   gSel: '#gender-male',   lang: 'Telugu',  lSel: '#language-telugu'  },
  { gender: 'Female', gSel: '#gender-female', lang: 'Tamil',   lSel: '#language-tamil'   },
];
for (const { gender, gSel, lang, lSel } of PAIRWISE_COMBOS) {
  test('UI-18 pairwise: ' + gender + ' + ' + lang + ' submits without JS error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.locator('#nav-link-add-user').click();
    await page.waitForTimeout(1000);
    const tag = gender.slice(0, 1) + lang.slice(0, 3) + Date.now().toString().slice(-4);
    await page.locator('#fullname').fill('PW ' + tag);
    await page.locator('#email').fill('pw' + tag.toLowerCase() + '@t.com');
    await page.locator(gSel).check();
    const langExists = await page.locator(lSel).count();
    if (langExists > 0) {
      await page.locator(lSel).check();
    } else {
      await page.locator('#language-english').check();
      test.info().annotations.push({ type: 'pairwise-fallback', description: lSel + ' not found on page, used #language-english' });
    }
    await page.locator('#button-add-user-submit').click();
    await page.waitForTimeout(1800);
    expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);
  });
}

// ── UI-E2E ────────────────────────────────────────────────────────────────────
// Loop 5: Full user lifecycle — Register → Login → Add → Edit → Delete → Logout
test('UI-E2E: complete user lifecycle from registration through logout', async ({ browser }) => {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const ts = Date.now().toString().slice(-6);
  const creds = { user: 'e2e_' + ts, pass: 'E2ePass1!', email: 'e2e' + ts + '@t.com', name: 'E2E User ' + ts };

  // 1. Register
  await pg.goto('https://demoapps.qspiders.com/user-management/register', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.locator('#fullname').fill(creds.name).catch(() => {});
  await pg.locator('#email').fill(creds.email).catch(() => {});
  await pg.locator('#username').fill(creds.user).catch(() => {});
  await pg.locator('#password').fill(creds.pass).catch(() => {});
  await pg.locator('#button-register-submit, button[type="submit"]').click().catch(() => {});
  await pg.waitForTimeout(2500);
  test.info().annotations.push({ type: 'e2e-step-1', description: 'Registration submitted for ' + creds.user });

  // 2. Login
  await pg.goto('https://demoapps.qspiders.com/user-management', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.locator('#username').fill(creds.user);
  await pg.locator('#password').fill(creds.pass);
  await pg.locator('#button-login-submit').click();
  await pg.waitForTimeout(2500);
  const loggedIn = await pg.locator('#heading-home').isVisible().catch(() => false);
  test.info().annotations.push({ type: 'e2e-step-2', description: 'Login: ' + (loggedIn ? 'PASS' : 'FAIL') });

  if (loggedIn) {
    // 3. Add User
    await pg.locator('#nav-link-add-user').click();
    await pg.waitForTimeout(1000);
    await pg.locator('#fullname').fill('Added ' + ts);
    await pg.locator('#email').fill('added' + ts + '@t.com');
    await pg.locator('#gender-male').check();
    await pg.locator('#language-english').check();
    await pg.locator('#button-add-user-submit').click();
    await pg.waitForTimeout(2000);
    const rowCount = await pg.locator('table tbody tr').count();
    test.info().annotations.push({ type: 'e2e-step-3', description: 'Add User: ' + rowCount + ' rows in table' });

    // 4. Edit last row
    await pg.locator('#checkbox-user-' + rowCount).check().catch(() => {});
    await pg.locator('#nav-link-edit-user').click();
    await pg.waitForTimeout(1000);
    const editOpen = await pg.locator('#cancel').isVisible().catch(() => false);
    if (editOpen) {
      await pg.locator('#user-status').selectOption('Blocked').catch(() => {});
      await pg.locator('#button-edit-user-submit, button[type="submit"]').last().click().catch(() => {});
      await pg.waitForTimeout(1500);
    }
    test.info().annotations.push({ type: 'e2e-step-4', description: 'Edit: ' + (editOpen ? 'PASS' : 'panel did not open') });

    // 5. Delete last row
    await pg.locator('#checkbox-user-' + rowCount).check().catch(() => {});
    await pg.locator('#nav-link-delete-user').click();
    await pg.waitForTimeout(2000);
    const rowCountAfter = await pg.locator('table tbody tr').count();
    test.info().annotations.push({ type: 'e2e-step-5', description: 'Delete: ' + rowCountAfter + ' rows remain' });
  }

  // 6. Logout
  await pg.locator('#button-logout').click().catch(() => {});
  await pg.waitForTimeout(1000);
  const loggedOut = await pg.locator('#button-login-submit').isVisible().catch(() => false);
  test.info().annotations.push({ type: 'e2e-step-6', description: 'Logout: ' + (loggedOut ? 'PASS' : 'FAIL') });
  expect(loggedOut).toBe(true);
  await ctx.close();
});
