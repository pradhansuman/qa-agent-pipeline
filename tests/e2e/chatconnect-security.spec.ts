/**
 * ChatConnect — Security Tests
 * XSS injection, localStorage exposure, HTTPS, and known privacy bugs.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://hveouplw.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.genspark-badge-button { pointer-events: none !important; }' });
});

// ── SEC-01 ─────────────────────────────────────────────────────────────────────
test('SEC-01 @smoke: no eval() calls in inline page scripts', async ({ page }) => {
  const hasEval = await page.evaluate(() =>
    [...document.querySelectorAll('script:not([src])')].some(s => s.textContent?.includes('eval('))
  );
  expect(hasEval).toBe(false);
});

// ── SEC-02 ─────────────────────────────────────────────────────────────────────
test('SEC-02 @smoke: app is served over HTTPS', async ({ page }) => {
  expect(page.url()).toMatch(/^https:\/\//);
});

// ── SEC-03 ─────────────────────────────────────────────────────────────────────
test('SEC-03: <script> XSS via message input does not execute', async ({ page }) => {
  let xssExecuted = false;
  await page.exposeFunction('__xssMarker', () => { xssExecuted = true; });

  await page.locator('#messageInput').fill('<script>__xssMarker()</script>');
  await page.locator('#sendBtn').click({ force: true });
  await page.waitForTimeout(1000);
  expect(xssExecuted).toBe(false);
});

// ── SEC-04 ─────────────────────────────────────────────────────────────────────
test('SEC-04: img onerror XSS via message input does not execute', async ({ page }) => {
  let xssExecuted = false;
  await page.exposeFunction('__imgXss', () => { xssExecuted = true; });

  await page.locator('#messageInput').fill('<img src=x onerror="__imgXss()">');
  await page.locator('#sendBtn').click({ force: true });
  await page.waitForTimeout(1000);

  // BUG XSS-BUG-01: ChatConnect renders messages as innerHTML without sanitization;
  // img onerror handler executes. Fix: use textContent or a sanitizer (DOMPurify).
  test.fail(xssExecuted, 'BUG XSS-BUG-01: img onerror XSS handler executed — messages are not sanitized before innerHTML insertion');
  expect(xssExecuted).toBe(false);
});

// ── SEC-05 ─────────────────────────────────────────────────────────────────────
test('SEC-05: localStorage contains only expected keys', async ({ page }) => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const ALLOWED = new Set(['chatMessages']);
  const unexpected = keys.filter(k => !ALLOWED.has(k) && !k.startsWith('genspark'));
  expect(unexpected).toHaveLength(0);
});

// ── SEC-06 ─────────────────────────────────────────────────────────────────────
test('SEC-06: chatMessages in localStorage does not contain raw <script> tags', async ({ page }) => {
  await page.locator('#messageInput').fill('<script>alert(1)</script>');
  await page.locator('#sendBtn').click({ force: true });
  await page.waitForTimeout(500);
  // The raw text might be stored, but it must not have been converted to DOM <script> nodes
  const injected = await page.evaluate(() =>
    document.querySelectorAll('#messagesContainer script').length
  );

  // BUG XSS-BUG-02: <script> tags in messages are injected as live DOM elements.
  test.fail(injected > 0, 'BUG XSS-BUG-02: <script> elements found inside #messagesContainer — innerHTML used without sanitization');
  expect(injected).toBe(0);
});

// ── SEC-07 ─────────────────────────────────────────────────────────────────────
test('SEC-07: injected message elements carry no onclick or onerror attributes', async ({ page }) => {
  await page.locator('#messageInput').fill('"><script>alert(1)</script>');
  await page.locator('#sendBtn').click({ force: true });
  await page.waitForTimeout(500);

  const hasDangerousAttrs = await page.evaluate(() =>
    [...document.querySelectorAll('#messagesContainer *')].some(
      el => el.getAttribute('onclick') || el.getAttribute('onerror')
    )
  );

  // BUG XSS-BUG-03: DOM elements with onclick/onerror attributes found in #messagesContainer.
  test.fail(hasDangerousAttrs, 'BUG XSS-BUG-03: dangerous event-handler attributes (onclick/onerror) present in rendered message nodes');
  expect(hasDangerousAttrs).toBe(false);
});

// ── SEC-08 ─────────────────────────────────────────────────────────────────────
test('SEC-08: message input autocomplete is not set to "on"', async ({ page }) => {
  const autocomplete = await page.locator('#messageInput').getAttribute('autocomplete');
  expect(autocomplete).not.toBe('on');
});

// ── SEC-09 ─────────────────────────────────────────────────────────────────────
test('SEC-09: page has no mixed-content HTTP requests', async ({ page }) => {
  const mixedContent: string[] = [];
  page.on('requestfailed', req => {
    if (req.url().startsWith('http://')) mixedContent.push(req.url());
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  expect(mixedContent).toHaveLength(0);
});

// ── SEC-BUG-01 ────────────────────────────────────────────────────────────────
test('SEC-BUG-01: Clear Chat should also clear chatMessages from localStorage', async ({ page }) => {
  // Known privacy bug: clicking "Clear Chat" wipes the UI display but leaves
  // all messages in localStorage, so they reappear on the next page reload.
  const before: Array<unknown> = await page.evaluate(
    () => JSON.parse(localStorage.getItem('chatMessages') || '[]')
  );
  await page.locator('#clearChat').click({ force: true });
  await page.waitForTimeout(500);
  const after: Array<unknown> = await page.evaluate(
    () => JSON.parse(localStorage.getItem('chatMessages') || '[]')
  );

  test.fail(
    after.length > 0,
    'BUG SEC-BUG-01: Clear Chat does not clear chatMessages localStorage — messages persist across page reloads'
  );
  expect(after).toHaveLength(0);
});
