/**
 * ChatConnect — Contract / Structure Tests
 * Validates DOM contracts: every element the app promises to expose
 * must be present, visible, and carry the right attributes.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://hveouplw.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  // Block Genspark's notice dialog overlay — it intercepts all pointer events
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Genspark badge sits over the send-button area on mobile viewports
  await page.addStyleTag({ content: '.genspark-badge-button { pointer-events: none !important; }' });
});

// ── API-01 ─────────────────────────────────────────────────────────────────────
test('API-01 @smoke: page title is correct', async ({ page }) => {
  await expect(page).toHaveTitle('ChatConnect - Real-Time Messaging Application');
});

// ── API-02 ─────────────────────────────────────────────────────────────────────
test('API-02 @smoke: h1 heading "ChatConnect" is visible', async ({ page }) => {
  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();
  await expect(h1).toContainText('ChatConnect');
});

// ── API-03 ─────────────────────────────────────────────────────────────────────
test('API-03 @smoke: subheading shows "Real-time messaging"', async ({ page }) => {
  // The subtitle is a styled <div>, not a semantic <h2>
  const subtitle = page.getByText('Real-time messaging', { exact: false });
  await expect(subtitle).toBeVisible();
});

// ── API-04 ─────────────────────────────────────────────────────────────────────
test('API-04 @smoke: current user name shows "Alex Johnson"', async ({ page }) => {
  await expect(page.locator('#currentChatUser')).toContainText('Alex Johnson');
  await expect(page.locator('#currentChatUser')).toBeVisible();
});

// ── API-05 ─────────────────────────────────────────────────────────────────────
test('API-05 @smoke: message input has correct placeholder text', async ({ page }) => {
  await expect(page.locator('#messageInput')).toHaveAttribute('placeholder', 'Type your message...');
  await expect(page.locator('#messageInput')).toBeVisible();
});

// ── API-06 ─────────────────────────────────────────────────────────────────────
test('API-06 @smoke: messages container is visible with content', async ({ page }) => {
  // App pre-loads a demo conversation from localStorage; container is never empty on load
  const container = page.locator('#messagesContainer');
  await expect(container).toBeVisible();
  const childCount = await container.locator('> *').count();
  expect(childCount).toBeGreaterThan(0);
});

// ── API-07 ─────────────────────────────────────────────────────────────────────
test('API-07 @smoke: Clear Chat button is visible and enabled', async ({ page }) => {
  const btn = page.locator('#clearChat');
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
  await expect(btn).toContainText('Clear Chat');
});

// ── API-08 ─────────────────────────────────────────────────────────────────────
test('API-08 @smoke: User toggle button shows "User 1" on fresh load', async ({ page }) => {
  const toggle = page.locator('#userToggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText('User 1');
});

// ── API-09 ─────────────────────────────────────────────────────────────────────
test('API-09 @smoke: emoji picker button is present in the toolbar', async ({ page }) => {
  await expect(page.locator('#emojiBtn')).toBeVisible();
});

// ── API-10 ─────────────────────────────────────────────────────────────────────
test('API-10 @smoke: send button is visible and enabled', async ({ page }) => {
  await expect(page.locator('#sendBtn')).toBeVisible();
  await expect(page.locator('#sendBtn')).toBeEnabled();
});

// ── API-11 ─────────────────────────────────────────────────────────────────────
test('API-11: all four quick reply shortcut buttons are visible', async ({ page }) => {
  const shortcuts = ['👋 Hello!', '👍 Sounds good!', '❤️ Thank you!', '😂 Haha!'];
  for (const text of shortcuts) {
    await expect(page.locator('button', { hasText: text })).toBeVisible();
  }
});

// ── API-12 ─────────────────────────────────────────────────────────────────────
test('API-12: chatMessages key exists in localStorage on page load', async ({ page }) => {
  // Wait up to 5s for the app JS to initialise localStorage (Firefox can be slow)
  await page.waitForFunction(
    () => localStorage.getItem('chatMessages') !== null,
    { timeout: 5000 }
  ).catch(() => {});
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain('chatMessages');
});
