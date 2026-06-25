/**
 * ChatConnect — Visual Regression Tests
 * Run with --update-snapshots on first run to create baselines.
 * Firefox excluded (visual tests run on Desktop Chrome + Mobile Chrome only).
 *
 * beforeEach clears the chat so every screenshot starts from the stable
 * welcome-message state — avoiding pre-loaded demo-message timestamps.
 */

import { test, expect } from '@playwright/test';

const URL = 'https://hveouplw.gensparkspace.com/';

test.beforeEach(async ({ page }) => {
  await page.route('**/notice_dialog.js', r => r.abort());
  await page.goto(URL, { waitUntil: 'networkidle' });
  // Freeze animations + hide Genspark badge (covers send-button on mobile & pollutes screenshots)
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; } .genspark-badge-button { display: none !important; }',
  });
  // Start every visual test from a clean, deterministic state.
  // force:true bypasses Genspark badge overlay which covers bottom-area controls on mobile.
  await page.locator('#clearChat').click({ force: true });
  await page.waitForTimeout(300);
  // Stop JavaScript intervals (e.g. timestamp "just now" → "1s ago" updates) that cause
  // Playwright's consecutive-screenshot stability check to fail on slow Mobile Chrome.
  await page.evaluate(() => {
    const maxId = window.setInterval(() => {}, 0);
    for (let i = 0; i <= maxId; i++) window.clearInterval(i);
  });
});

// ── VIS-01 ─────────────────────────────────────────────────────────────────────
test('VIS-01: full page — welcome state', async ({ page }) => {
  await expect(page).toHaveScreenshot('chatconnect-welcome.png', {
    fullPage: true,
    mask: [page.locator('.genspark-badge-button')],
  });
});

// ── VIS-02 ─────────────────────────────────────────────────────────────────────
test('VIS-02: full page — after sending a message', async ({ page }) => {
  await page.locator('#messageInput').fill('Visual test message');
  await page.locator('#sendBtn').click({ force: true });
  await expect(page.locator('#messagesContainer')).toContainText('Visual test message');
  await page.waitForTimeout(400); // Let final render settle (one micro-update after message appears)
  // Clear any new intervals started by message rendering (timestamp "just now" updates)
  await page.evaluate(() => {
    const maxId = window.setInterval(() => {}, 0);
    for (let i = 0; i <= maxId; i++) window.clearInterval(i);
  });

  await expect(page).toHaveScreenshot('chatconnect-with-message.png', {
    fullPage: true,
    // Mask the timestamp on the sent message (changes every run)
    mask: [
      page.locator('.text-xs.text-gray-500'),
      page.locator('.genspark-badge-button'),
    ],
  });
});

// ── VIS-03 ─────────────────────────────────────────────────────────────────────
test('VIS-03: emoji picker — open state', async ({ page }) => {
  await page.locator('#emojiBtn').click({ force: true });
  await expect(page.locator('#emojiPicker')).toBeVisible();

  await expect(page).toHaveScreenshot('chatconnect-emoji-picker.png', {
    fullPage: true,
    mask: [page.locator('.genspark-badge-button')],
  });
});

// ── VIS-04 ─────────────────────────────────────────────────────────────────────
test('VIS-04: full page — User 2 active', async ({ page }) => {
  await page.locator('#userToggle').click({ force: true });
  await expect(page.locator('#userToggle')).toContainText('User 2');

  await expect(page).toHaveScreenshot('chatconnect-user2.png', {
    fullPage: true,
    mask: [page.locator('.genspark-badge-button')],
  });
});

// ── VIS-05 ─────────────────────────────────────────────────────────────────────
test('VIS-05: full page — two-user conversation', async ({ page }) => {
  await page.locator('#messageInput').fill('Message from User 1');
  await page.locator('#sendBtn').click({ force: true });

  await page.locator('#userToggle').click({ force: true });
  await page.locator('#messageInput').fill('Reply from User 2');
  await page.locator('#sendBtn').click({ force: true });

  await expect(page.locator('#messagesContainer')).toContainText('Reply from User 2');
  await page.waitForTimeout(400); // Let final render settle after last message
  // Clear any new intervals started by message rendering (timestamp "just now" updates)
  await page.evaluate(() => {
    const maxId = window.setInterval(() => {}, 0);
    for (let i = 0; i <= maxId; i++) window.clearInterval(i);
  });

  await expect(page).toHaveScreenshot('chatconnect-conversation.png', {
    fullPage: true,
    mask: [
      page.locator('.text-xs.text-gray-500'),
      page.locator('.genspark-badge-button'),
    ],
  });
});
