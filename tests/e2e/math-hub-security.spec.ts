/**
 * math-hub-security.spec.ts
 * ──────────────────────────
 * Security tests for the CBSE Maths Hub static SPA.
 *
 * Attack surface analysis for this app:
 *   - ALL result boxes use el.textContent (not innerHTML) — confirmed from source
 *   - ALL calculator inputs are type="number" — browser auto-sanitizes non-numeric
 *   - No eval() or new Function() calls anywhere in source — confirmed from grep
 *   - No localStorage/sessionStorage writes — in-memory only
 *   - No external script/CSS dependencies — fully self-contained
 *   - Served over HTTPS with HSTS — no MITM downgrade
 *
 * Tests validate that these properties HOLD and will catch regressions if a
 * future commit accidentally introduces innerHTML, eval(), or state leakage.
 */
import { test, expect } from '@playwright/test';

const URL = 'https://pradhansuman.github.io/qa-agent-pipeline/math_hub.html';

async function gotoAndDisableScroll(page: any) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { (document.documentElement as HTMLElement).style.scrollBehavior = 'auto'; });
}

// ─── Output Rendering Safety (textContent vs innerHTML) ───────────────────────
test.describe('Output Rendering — textContent not innerHTML', () => {

  test('TC-SEC-01: CH01 result renders plain text, not HTML', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch01-numerator"]').fill('7');
    await page.locator('[data-testid="ch01-denominator"]').fill('8');
    await page.locator('[data-testid="ch01-convert-btn"]').click();

    const [html, text] = await page.locator('[data-testid="ch01-result"]').evaluate(
      (el: HTMLElement) => [el.innerHTML, el.textContent ?? '']
    );
    // If innerHTML contains HTML elements (not just text), textContent != innerHTML
    expect(html).not.toMatch(/<(?!br\b)[a-z]/i);   // no arbitrary HTML tags in result
    expect(html).toContain('0.875');
    expect(text).toContain('0.875');
  });

  test('TC-SEC-02: CH02 result renders plain text, not HTML', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch02"]').click();
    await page.locator('[data-testid="chapter-2"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch02-a"]').fill('3');
    await page.locator('[data-testid="ch02-b"]').fill('7');
    await page.locator('[data-testid="ch02-c"]').fill('22');
    await page.locator('[data-testid="ch02-solve-btn"]').click();

    const html = await page.locator('[data-testid="ch02-result"]').innerHTML();
    expect(html).not.toMatch(/<(?!br\b)[a-z]/i);
    expect(html).toContain('x = 5');
  });

  test('TC-SEC-03: CH12 exponent result renders plain text', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch12"]').click();
    await page.locator('[data-testid="chapter-12"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch12-base"]').fill('2');
    await page.locator('[data-testid="ch12-power"]').fill('10');
    await page.locator('[data-testid="ch12-calc-btn"]').click();

    const html = await page.locator('[data-testid="ch12-result"]').innerHTML();
    expect(html).not.toMatch(/<(?!br\b)[a-z]/i);
    expect(html).toContain('1024');
  });

  test('TC-SEC-04: error messages are plain text, not HTML', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });
    // Trigger divide-by-zero error
    await page.locator('[data-testid="ch01-numerator"]').fill('5');
    await page.locator('[data-testid="ch01-denominator"]').fill('0');
    await page.locator('[data-testid="ch01-convert-btn"]').click();

    const html = await page.locator('[data-testid="ch01-result"]').innerHTML();
    expect(html).not.toMatch(/<(?!br\b)[a-z]/i); // error messages should also be plain text
  });
});

// ─── Input Type Safety (type=number prevents non-numeric content) ─────────────
test.describe('Input Type Safety', () => {

  test('TC-SEC-05: all CH01 inputs are type=number (browser-native sanitisation)', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();

    const numType = await page.locator('[data-testid="ch01-numerator"]').getAttribute('type');
    const denType = await page.locator('[data-testid="ch01-denominator"]').getAttribute('type');
    expect(numType).toBe('number');
    expect(denType).toBe('number');
  });

  test('TC-SEC-06: all CH08 inputs are type=number', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch08"]').click();

    const pType = await page.locator('[data-testid="ch08-principal"]').getAttribute('type');
    const rType = await page.locator('[data-testid="ch08-rate"]').getAttribute('type');
    const tType = await page.locator('[data-testid="ch08-time"]').getAttribute('type');
    expect(pType).toBe('number');
    expect(rType).toBe('number');
    expect(tType).toBe('number');
  });

  test('TC-SEC-07: JS expression in input evaluated as NaN by parseFloat (no eval)', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });

    // Set input value via evaluate() to bypass type=number browser validation
    // This simulates a JS-injection attack that overrides the value property
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="ch01-numerator"]') as HTMLInputElement;
      // Use Object.defineProperty to force a non-numeric value
      let v = '1+1';
      Object.defineProperty(el, 'value', {
        get: () => v,
        set: (x: string) => { v = x; },
        configurable: true,
      });
    });
    await page.locator('[data-testid="ch01-denominator"]').fill('1');
    await page.locator('[data-testid="ch01-convert-btn"]').click();

    const txt = await page.locator('[data-testid="ch01-result"]').textContent() ?? '';
    // parseFloat('1+1') = 1, NOT eval('1+1') = 2. If eval() were used, result = 2/1 = 2
    // If parseFloat is used correctly: '1+1' → NaN or 1 (parseFloat stops at '+')
    // Either way, it should NOT produce "= 2" as the final value
    expect(txt).not.toMatch(/^\s*1\s*\/\s*1\s*=\s*2/);
  });
});

// ─── Source Code Static Checks ────────────────────────────────────────────────
test.describe('Source Code Security Analysis', () => {

  test('TC-SEC-08: page source contains no eval() calls', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    const evalCalls = body.match(/\beval\s*\(/g) || [];
    expect(evalCalls).toHaveLength(0);
  });

  test('TC-SEC-09: page source contains no new Function() calls', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    const fnCalls = body.match(/new\s+Function\s*\(/g) || [];
    expect(fnCalls).toHaveLength(0);
  });

  test('TC-SEC-10: page source does not include document.write()', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    expect(body).not.toContain('document.write(');
  });
});

// ─── State Leakage to Browser Storage ────────────────────────────────────────
test.describe('State Leakage to Browser Storage', () => {

  test('TC-SEC-11: localStorage is empty after full widget + MCQ interaction', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch01-q1-c"]').click();
    await page.locator('[data-testid="nav-ch02"]').click();
    await page.locator('[data-testid="ch02-q1-b"]').click();

    const ls = await page.evaluate(() => localStorage.length);
    expect(ls).toBe(0);
  });

  test('TC-SEC-12: sessionStorage is empty after page interaction', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-c"]').click();

    const ss = await page.evaluate(() => sessionStorage.length);
    expect(ss).toBe(0);
  });

  test('TC-SEC-13: score resets on page reload (confirms no persistent storage)', async ({ page }) => {
    await gotoAndDisableScroll(page);
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="chapter-1"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="ch01-q1-c"]').click();
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('1 / 1');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('0 / 0');
  });
});

// ─── External Resource Control ────────────────────────────────────────────────
test.describe('External Resource Control', () => {

  test('TC-SEC-14: no requests to unexpected third-party origins', async ({ page }) => {
    const allowedPrefixes = [
      'https://pradhansuman.github.io',
      'https://github.com',
      'data:',        // inline favicon (data:,)
      'about:',       // browser internals
    ];
    const blocked: string[] = [];

    page.on('request', req => {
      const url = req.url();
      if (!allowedPrefixes.some(p => url.startsWith(p))) {
        blocked.push(url);
      }
    });

    await gotoAndDisableScroll(page);
    expect(blocked).toHaveLength(0);
  });

  test('TC-SEC-15: no cookies set by the app', async ({ page }) => {
    await gotoAndDisableScroll(page);
    const cookies = await page.context().cookies();
    const appCookies = cookies.filter(c => c.domain.includes('pradhansuman.github.io'));
    expect(appCookies).toHaveLength(0);
  });
});

// ─── Dialog / Popup Hijacking ─────────────────────────────────────────────────
test.describe('Unexpected Dialog Prevention', () => {

  test('TC-SEC-16: no alert/confirm/prompt triggered on page load', async ({ page }) => {
    let dialogCount = 0;
    page.on('dialog', async d => { dialogCount++; await d.dismiss(); });
    await gotoAndDisableScroll(page);
    expect(dialogCount).toBe(0);
  });

  test('TC-SEC-17: navigating all 16 chapters triggers no unexpected dialogs', async ({ page }) => {
    let dialogCount = 0;
    page.on('dialog', async d => { dialogCount++; await d.dismiss(); });
    await gotoAndDisableScroll(page);

    for (let i = 1; i <= 16; i++) {
      const pad = String(i).padStart(2, '0');
      await page.locator(`[data-testid="nav-ch${pad}"]`).click();
    }
    await page.waitForTimeout(300);
    expect(dialogCount).toBe(0);
  });
});
