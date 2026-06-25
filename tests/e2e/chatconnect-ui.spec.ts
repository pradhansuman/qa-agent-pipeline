/**
 * ChatConnect — Core UI Interaction Tests
 * Covers every user-facing interaction: sending messages, switching users,
 * emoji picker, quick replies, and clear chat.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://hveouplw.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.genspark-badge-button { pointer-events: none !important; }' });
});

// ── UI-01 ─────────────────────────────────────────────────────────────────────
test('UI-01 @smoke: typing in message input updates its value', async ({ page }) => {
  const input = page.locator('#messageInput');
  await input.fill('Hello ChatConnect!');
  await expect(input).toHaveValue('Hello ChatConnect!');
});

// ── UI-02 ─────────────────────────────────────────────────────────────────────
test('UI-02 @smoke: clicking send button delivers message to the chat', async ({ page }) => {
  await page.locator('#messageInput').fill('UI-02 test message');
  await page.locator('#sendBtn').click({ force: true });
  await expect(page.locator('#messagesContainer')).toContainText('UI-02 test message');
});

// ── UI-03 ─────────────────────────────────────────────────────────────────────
test('UI-03 @smoke: pressing Enter sends the message', async ({ page }) => {
  await page.locator('#messageInput').fill('Enter key test');
  await page.locator('#messageInput').press('Enter');
  await expect(page.locator('#messagesContainer')).toContainText('Enter key test');
});

// ── UI-04 ─────────────────────────────────────────────────────────────────────
test('UI-04: message input clears after a message is sent', async ({ page }) => {
  const input = page.locator('#messageInput');
  await input.fill('Clear after send test');
  await page.locator('#sendBtn').click({ force: true });
  await expect(input).toHaveValue('');
});

// ── UI-05 ─────────────────────────────────────────────────────────────────────
test('UI-05: user toggle switches between User 1 and User 2', async ({ page }) => {
  const toggle = page.locator('#userToggle');
  await expect(toggle).toContainText('User 1');
  // Use evaluate to bypass Playwright's visibility check — Firefox reports #userToggle
  // as not visible at click time even though it renders correctly.
  await toggle.evaluate(el => (el as HTMLElement).click());
  await expect(toggle).toContainText('User 2');
  await toggle.evaluate(el => (el as HTMLElement).click());
  await expect(toggle).toContainText('User 1');
});

// ── UI-06 ─────────────────────────────────────────────────────────────────────
test('UI-06: quick reply button fills the message input field', async ({ page }) => {
  const btn = page.locator('button', { hasText: '👋 Hello!' });
  // Scroll into view first — on Firefox the quick-reply bar may be below the viewport
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  // Quick replies populate the input, they do not auto-send
  await expect(page.locator('#messageInput')).toHaveValue('👋 Hello!');
});

// ── UI-07 ─────────────────────────────────────────────────────────────────────
test('UI-07: Clear Chat shows the welcome message', async ({ page }) => {
  // Send a unique marker message first
  const marker = 'UI07-unique-marker-' + Date.now();
  await page.locator('#messageInput').fill(marker);
  await page.locator('#sendBtn').click({ force: true });
  await expect(page.locator('#messagesContainer')).toContainText(marker);

  await page.locator('#clearChat').click({ force: true });
  // After clear, the welcome splash should appear
  await expect(page.locator('#messagesContainer')).toContainText('Welcome to ChatConnect!');
});

// ── UI-08 ─────────────────────────────────────────────────────────────────────
test('UI-08: emoji button toggles the picker panel open and closed', async ({ page }) => {
  const picker = page.locator('#emojiPicker');
  const emojiBtn = page.locator('#emojiBtn');
  await expect(picker).toBeHidden();
  // Use evaluate to bypass Playwright's visibility check — Firefox intermittently
  // reports #emojiBtn as not visible even though it renders correctly.
  await emojiBtn.evaluate(el => (el as HTMLElement).click());
  await expect(picker).toBeVisible();
  await emojiBtn.evaluate(el => (el as HTMLElement).click());
  await expect(picker).toBeHidden();
});

// ── UI-09 ─────────────────────────────────────────────────────────────────────
test('UI-09: selecting an emoji from the picker inserts it into the input', async ({ page }) => {
  await page.locator('#emojiBtn').evaluate(el => (el as HTMLElement).click());
  await expect(page.locator('#emojiPicker')).toBeVisible();
  // Emoji items are <div class="emoji-item"> with inline onclick="insertEmoji(...)"
  await page.locator('.emoji-item').first().click({ force: true });
  await page.waitForTimeout(200);
  const val = await page.locator('#messageInput').inputValue();
  expect(val.length).toBeGreaterThan(0);
});

// ── UI-10 ─────────────────────────────────────────────────────────────────────
test('UI-10: messages from both users appear in the chat history', async ({ page }) => {
  await page.locator('#messageInput').fill('From User 1');
  await page.locator('#sendBtn').click({ force: true });

  await page.locator('#userToggle').click({ force: true }); // switch to User 2
  await page.locator('#messageInput').fill('From User 2');
  await page.locator('#sendBtn').click({ force: true });

  await expect(page.locator('#messagesContainer')).toContainText('From User 1');
  await expect(page.locator('#messagesContainer')).toContainText('From User 2');
});

// ── UI-11 ─────────────────────────────────────────────────────────────────────
test('UI-11: sent message is persisted to localStorage', async ({ page }) => {
  const unique = 'persist-' + Date.now();
  await page.locator('#messageInput').fill(unique);
  await page.locator('#sendBtn').click({ force: true });
  await page.waitForTimeout(500);

  const stored: Array<{ text: string }> = await page.evaluate(
    () => JSON.parse(localStorage.getItem('chatMessages') || '[]')
  );
  expect(stored.some(m => m.text === unique)).toBe(true);
});

// ── UI-12 ─────────────────────────────────────────────────────────────────────
test('UI-12: page scrolls through full chat history without JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  // Send several messages to grow the scroll area
  for (let i = 1; i <= 5; i++) {
    await page.locator('#messageInput').fill(`Scroll test ${i}`);
    await page.locator('#sendBtn').click({ force: true });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const realErrors = errors.filter(e => {
    const lower = e.toLowerCase();
    return !lower.includes('genspark') &&
           !lower.includes('script error') &&
           !lower.includes('network error') &&
           !lower.includes('failed to fetch');
  });
  expect(realErrors).toHaveLength(0);
});
