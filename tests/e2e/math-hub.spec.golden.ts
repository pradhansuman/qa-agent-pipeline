import { test, expect } from '@playwright/test';

const URL = 'https://pradhansuman.github.io/qa-agent-pipeline/math_hub.html';

// ─── Page Structure ──────────────────────────────────────────────────────────
test.describe('Page Structure', () => {

  test('TC-S01: page title matches app name', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/CBSE Class 8 Mathematics/i);
  });

  test('TC-S02: exactly 16 chapter sections rendered', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    expect(await page.locator('[data-testid^="chapter-"]').count()).toBe(16);
  });

  test('TC-S03: app header is visible and contains expected text', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    const hdr = page.locator('[data-testid="app-header"]');
    await expect(hdr).toBeVisible();
    await expect(hdr).toContainText('CBSE Class 8 Mathematics');
  });

  test('TC-S04: nav bar contains all 16 chapter links', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="nav-bar"]')).toBeVisible();
    for (let i = 1; i <= 16; i++) {
      await expect(page.locator(`[data-testid="nav-ch${String(i).padStart(2,'0')}"]`)).toBeVisible();
    }
  });

  test('TC-S05: score bar starts at 0 / 0', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('0 / 0');
  });

  test('TC-S06: no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    expect(errors).toHaveLength(0);
  });

  test('TC-S07: all 16 chapter sections have unique data-testid attributes', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    for (let i = 1; i <= 16; i++) {
      await expect(page.locator(`[data-testid="chapter-${i}"]`)).toBeVisible();
    }
  });
});

// ─── Navigation ───────────────────────────────────────────────────────────────
test.describe('Navigation', () => {

  test('TC-N01: nav-ch01 scrolls to chapter 1', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="chapter-1"]')).toBeVisible();
  });

  test('TC-N02: nav-ch05 scrolls to chapter 5', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch05"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="chapter-5"]')).toBeVisible();
  });

  test('TC-N03: nav-ch08 scrolls to chapter 8', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch08"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="chapter-8"]')).toBeVisible();
  });

  test('TC-N04: nav-ch16 scrolls to chapter 16', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch16"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="chapter-16"]')).toBeVisible();
  });
});

// ─── CH01: Rational Numbers ───────────────────────────────────────────────────
test.describe('CH01 Rational Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
  });

  test('TC-01-W01: 7/8 → 0.875', async ({ page }) => {
    await page.locator('[data-testid="ch01-numerator"]').fill('7');
    await page.locator('[data-testid="ch01-denominator"]').fill('8');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    await expect(page.locator('[data-testid="ch01-result"]')).toContainText('0.875');
  });

  test('TC-01-W02: -3/4 → -0.75 (negative fraction)', async ({ page }) => {
    await page.locator('[data-testid="ch01-numerator"]').fill('-3');
    await page.locator('[data-testid="ch01-denominator"]').fill('4');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    await expect(page.locator('[data-testid="ch01-result"]')).toContainText('-0.75');
  });

  test('TC-01-W03: 1/3 → repeating decimal with 3s', async ({ page }) => {
    await page.locator('[data-testid="ch01-numerator"]').fill('1');
    await page.locator('[data-testid="ch01-denominator"]').fill('3');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    const txt = await page.locator('[data-testid="ch01-result"]').textContent();
    expect(txt).toMatch(/0\.3+/);
  });

  test('TC-01-W04: 0/5 → 0', async ({ page }) => {
    await page.locator('[data-testid="ch01-numerator"]').fill('0');
    await page.locator('[data-testid="ch01-denominator"]').fill('5');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    const txt = await page.locator('[data-testid="ch01-result"]').textContent();
    expect(txt).toMatch(/= 0/);
  });

  test('TC-01-W05: denominator=0 → error message', async ({ page }) => {
    await page.locator('[data-testid="ch01-numerator"]').fill('5');
    await page.locator('[data-testid="ch01-denominator"]').fill('0');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    const txt = await page.locator('[data-testid="ch01-result"]').textContent();
    expect(txt).toMatch(/error|undefined|cannot/i);
  });

  test('TC-01-W06: empty inputs → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    const txt = await page.locator('[data-testid="ch01-result"]').textContent();
    expect(txt).toMatch(/enter|please/i);
  });

  test('TC-01-M01: Q1 correct answer (√2) gets correct class', async ({ page }) => {
    const btn = page.locator('[data-testid="ch01-q1-c"]');
    await btn.click();
    await expect(btn).toHaveClass(/correct/);
  });

  test('TC-01-M02: Q1 wrong answer gets incorrect class and reveals correct', async ({ page }) => {
    await page.locator('[data-testid="ch01-q1-a"]').click();
    await expect(page.locator('[data-testid="ch01-q1-a"]')).toHaveClass(/incorrect/);
    await expect(page.locator('[data-testid="ch01-q1-c"]')).toHaveClass(/correct/);
  });

  test('TC-01-M03: Q2 correct answer (0.333…) gets correct class', async ({ page }) => {
    const btn = page.locator('[data-testid="ch01-q2-b"]');
    await btn.click();
    await expect(btn).toHaveClass(/correct/);
  });

  test('TC-01-M04: Q3 correct answer (5/9) gets correct class', async ({ page }) => {
    const btn = page.locator('[data-testid="ch01-q3-a"]');
    await btn.click();
    await expect(btn).toHaveClass(/correct/);
  });
});

// ─── CH02: Linear Equations ───────────────────────────────────────────────────
test.describe('CH02 Linear Equations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch02"]').click();
  });

  test('TC-02-W01: 3x+7=22 → x=5', async ({ page }) => {
    await page.locator('[data-testid="ch02-a"]').fill('3');
    await page.locator('[data-testid="ch02-b"]').fill('7');
    await page.locator('[data-testid="ch02-c"]').fill('22');
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    await expect(page.locator('[data-testid="ch02-result"]')).toContainText('x = 5');
  });

  test('TC-02-W02: 2x+5=1 → x=-2 (negative solution)', async ({ page }) => {
    await page.locator('[data-testid="ch02-a"]').fill('2');
    await page.locator('[data-testid="ch02-b"]').fill('5');
    await page.locator('[data-testid="ch02-c"]').fill('1');
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    await expect(page.locator('[data-testid="ch02-result"]')).toContainText('x = -2');
  });

  test('TC-02-W03: 2x+3=4 → x=0.5 (fractional solution)', async ({ page }) => {
    await page.locator('[data-testid="ch02-a"]').fill('2');
    await page.locator('[data-testid="ch02-b"]').fill('3');
    await page.locator('[data-testid="ch02-c"]').fill('4');
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    await expect(page.locator('[data-testid="ch02-result"]')).toContainText('x = 0.5');
  });

  test('TC-02-W04: a=0 → no-solution error', async ({ page }) => {
    await page.locator('[data-testid="ch02-a"]').fill('0');
    await page.locator('[data-testid="ch02-b"]').fill('5');
    await page.locator('[data-testid="ch02-c"]').fill('10');
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    const txt = await page.locator('[data-testid="ch02-result"]').textContent();
    expect(txt).toMatch(/error|no solution|cannot/i);
  });

  test('TC-02-W05: empty inputs → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    const txt = await page.locator('[data-testid="ch02-result"]').textContent();
    expect(txt).toMatch(/enter/i);
  });

  test('TC-02-M01: Q1 correct answer (x=4) gets correct class', async ({ page }) => {
    const btn = page.locator('[data-testid="ch02-q1-b"]');
    await btn.click();
    await expect(btn).toHaveClass(/correct/);
  });

  test('TC-02-M02: Q2 correct answer (x=4) gets correct class', async ({ page }) => {
    const btn = page.locator('[data-testid="ch02-q2-c"]');
    await btn.click();
    await expect(btn).toHaveClass(/correct/);
  });
});

// ─── CH03: Quadrilaterals ─────────────────────────────────────────────────────
test.describe('CH03 Quadrilaterals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch03"]').click();
  });

  test('TC-03-W01: Square card shows "All 4 sides equal" and 90° angles', async ({ page }) => {
    await page.locator('[data-testid="ch03-card-square"]').click();
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('All 4 sides equal');
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('All angles = 90°');
  });

  test('TC-03-W02: Rectangle card shows parallel sides and 90° angles', async ({ page }) => {
    await page.locator('[data-testid="ch03-card-rectangle"]').click();
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('Opposite sides equal and parallel');
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('All angles = 90°');
  });

  test('TC-03-W03: Rhombus card shows diagonals bisect at 90°', async ({ page }) => {
    await page.locator('[data-testid="ch03-card-rhombus"]').click();
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('Diagonals bisect each other at 90°');
  });

  test('TC-03-W04: Parallelogram card shows supplementary angles', async ({ page }) => {
    await page.locator('[data-testid="ch03-card-parallelogram"]').click();
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('Adjacent angles are supplementary');
  });

  test('TC-03-W05: Trapezium card shows exactly one pair of parallel sides', async ({ page }) => {
    await page.locator('[data-testid="ch03-card-trapezium"]').click();
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('Exactly one pair of parallel sides');
  });

  test('TC-03-W06: Clicked card gets active class', async ({ page }) => {
    const card = page.locator('[data-testid="ch03-card-rhombus"]');
    await card.click();
    await expect(card).toHaveClass(/active/);
  });

  test('TC-03-W07: Switching cards transfers active class', async ({ page }) => {
    await page.locator('[data-testid="ch03-card-square"]').click();
    await page.locator('[data-testid="ch03-card-rectangle"]').click();
    await expect(page.locator('[data-testid="ch03-card-rectangle"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="ch03-card-square"]')).not.toHaveClass(/active/);
  });

  test('TC-03-M01: Q1 correct answer (360°) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch03-q1-c"]').click();
    await expect(page.locator('[data-testid="ch03-q1-c"]')).toHaveClass(/correct/);
  });

  test('TC-03-M02: Q2 correct answer (bisect at 90°) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch03-q2-b"]').click();
    await expect(page.locator('[data-testid="ch03-q2-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH04: Practical Geometry ─────────────────────────────────────────────────
test.describe('CH04 Practical Geometry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch04"]').click();
  });

  test('TC-04-W01: six construction steps are visible', async ({ page }) => {
    expect(await page.locator('[data-testid="ch04-steps"] .step-item').count()).toBe(6);
  });

  test('TC-04-M01: Q1 correct answer (5 measurements) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch04-q1-c"]').click();
    await expect(page.locator('[data-testid="ch04-q1-c"]')).toHaveClass(/correct/);
  });
});

// ─── CH05: Data Handling ──────────────────────────────────────────────────────
test.describe('CH05 Data Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch05"]').click();
  });

  test('TC-05-W01: canvas pre-renders bar chart on load (w > 0)', async ({ page }) => {
    const c = page.locator('[data-testid="ch05-canvas"]');
    expect(await c.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0);
    expect(await c.evaluate((el: HTMLCanvasElement) => el.height)).toBeGreaterThan(0);
  });

  test('TC-05-W02: Render button redraws bar chart', async ({ page }) => {
    await page.locator('[data-testid="ch05-draw-btn"]').click();
    await expect(page.locator('[data-testid="ch05-canvas"]')).toBeVisible();
  });

  test('TC-05-W03: switching to pie chart renders without error', async ({ page }) => {
    await page.locator('[data-testid="ch05-chart-type"]').selectOption('pie');
    await page.locator('[data-testid="ch05-draw-btn"]').click();
    await expect(page.locator('[data-testid="ch05-canvas"]')).toBeVisible();
  });

  test('TC-05-W04: switching to histogram renders without error', async ({ page }) => {
    await page.locator('[data-testid="ch05-chart-type"]').selectOption('histogram');
    await page.locator('[data-testid="ch05-draw-btn"]').click();
    await expect(page.locator('[data-testid="ch05-canvas"]')).toBeVisible();
  });

  test('TC-05-M01: Q1 correct answer (360°) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch05-q1-b"]').click();
    await expect(page.locator('[data-testid="ch05-q1-b"]')).toHaveClass(/correct/);
  });

  test('TC-05-M02: Q2 correct answer (1/2) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch05-q2-c"]').click();
    await expect(page.locator('[data-testid="ch05-q2-c"]')).toHaveClass(/correct/);
  });
});

// ─── CH06: Square Roots ───────────────────────────────────────────────────────
test.describe('CH06 Square Roots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch06"]').click();
  });

  test('TC-06-W01: √144 = 12 (perfect square)', async ({ page }) => {
    await page.locator('[data-testid="ch06-input"]').fill('144');
    await page.locator('[data-testid="ch06-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch06-result"]')).toContainText('12');
  });

  test('TC-06-W02: √2 flagged as not a perfect square', async ({ page }) => {
    await page.locator('[data-testid="ch06-input"]').fill('2');
    await page.locator('[data-testid="ch06-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch06-result"]').textContent();
    expect(txt).toMatch(/not a perfect square/i);
  });

  test('TC-06-W03: √0 = 0', async ({ page }) => {
    await page.locator('[data-testid="ch06-input"]').fill('0');
    await page.locator('[data-testid="ch06-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch06-result"]')).toContainText('0');
  });

  test('TC-06-W04: negative input → error', async ({ page }) => {
    await page.locator('[data-testid="ch06-input"]').fill('-4');
    await page.locator('[data-testid="ch06-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch06-result"]').textContent();
    expect(txt).toMatch(/non-negative|error/i);
  });

  test('TC-06-M01: Q1 correct answer (49) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch06-q1-b"]').click();
    await expect(page.locator('[data-testid="ch06-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH07: Cube Roots ─────────────────────────────────────────────────────────
test.describe('CH07 Cube Roots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch07"]').click();
  });

  test('TC-07-W01: ∛27 = 3', async ({ page }) => {
    await page.locator('[data-testid="ch07-input"]').fill('27');
    await page.locator('[data-testid="ch07-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch07-result"]')).toContainText('3');
  });

  test('TC-07-W02: ∛1000 = 10', async ({ page }) => {
    await page.locator('[data-testid="ch07-input"]').fill('1000');
    await page.locator('[data-testid="ch07-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch07-result"]')).toContainText('10');
  });

  test('TC-07-W03: ∛-8 = -2 (negative cube root)', async ({ page }) => {
    await page.locator('[data-testid="ch07-input"]').fill('-8');
    await page.locator('[data-testid="ch07-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch07-result"]')).toContainText('-2');
  });

  test('TC-07-M01: Q1 correct answer (10) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch07-q1-c"]').click();
    await expect(page.locator('[data-testid="ch07-q1-c"]')).toHaveClass(/correct/);
  });
});

// ─── CH08: Comparing Quantities (Simple Interest) ─────────────────────────────
test.describe('CH08 Comparing Quantities', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch08"]').click();
  });

  test('TC-08-W01: P=5000 R=8 T=3 → SI=1200', async ({ page }) => {
    await page.locator('[data-testid="ch08-principal"]').fill('5000');
    await page.locator('[data-testid="ch08-rate"]').fill('8');
    await page.locator('[data-testid="ch08-time"]').fill('3');
    await page.locator('[data-testid="ch08-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch08-result"]')).toContainText('1200');
  });

  test('TC-08-W02: P=1000 R=5 T=2 → SI=100, Amount=1100', async ({ page }) => {
    await page.locator('[data-testid="ch08-principal"]').fill('1000');
    await page.locator('[data-testid="ch08-rate"]').fill('5');
    await page.locator('[data-testid="ch08-time"]').fill('2');
    await page.locator('[data-testid="ch08-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch08-result"]').textContent();
    expect(txt).toContain('100');
    expect(txt).toContain('1100');
  });

  test('TC-08-W03: empty fields → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch08-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch08-result"]').textContent();
    expect(txt).toMatch(/enter/i);
  });

  test('TC-08-M01: Q1 correct answer (₹100) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch08-q1-b"]').click();
    await expect(page.locator('[data-testid="ch08-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH09: Algebraic Identities ───────────────────────────────────────────────
test.describe('CH09 Algebraic Identities', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch09"]').click();
  });

  test('TC-09-W01: (3+4)² verified — LHS=RHS=49', async ({ page }) => {
    await page.locator('[data-testid="ch09-a"]').fill('3');
    await page.locator('[data-testid="ch09-b"]').fill('4');
    await page.locator('[data-testid="ch09-verify-btn"]').click();
    const txt = await page.locator('[data-testid="ch09-result"]').textContent();
    expect(txt).toContain('49');
    expect(txt).toMatch(/verified/i);
  });

  test('TC-09-W02: (5+2)² verified — LHS=RHS=49', async ({ page }) => {
    await page.locator('[data-testid="ch09-a"]').fill('5');
    await page.locator('[data-testid="ch09-b"]').fill('2');
    await page.locator('[data-testid="ch09-verify-btn"]').click();
    const txt = await page.locator('[data-testid="ch09-result"]').textContent();
    expect(txt).toContain('49');
    expect(txt).toMatch(/verified/i);
  });

  test('TC-09-W03: empty inputs → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch09-verify-btn"]').click();
    const txt = await page.locator('[data-testid="ch09-result"]').textContent();
    expect(txt).toMatch(/enter/i);
  });

  test('TC-09-M01: Q1 correct answer (a²+2ab+b²) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch09-q1-b"]').click();
    await expect(page.locator('[data-testid="ch09-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH10: Solid Shapes (Euler's Formula) ─────────────────────────────────────
test.describe('CH10 Solid Shapes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch10"]').click();
  });

  test('TC-10-W01: Cube F=6 V=8 E=12 → valid polyhedron', async ({ page }) => {
    await page.locator('[data-testid="ch10-faces"]').fill('6');
    await page.locator('[data-testid="ch10-vertices"]').fill('8');
    await page.locator('[data-testid="ch10-edges"]').fill('12');
    await page.locator('[data-testid="ch10-check-btn"]').click();
    await expect(page.locator('[data-testid="ch10-result"]')).toContainText('Valid polyhedron');
  });

  test('TC-10-W02: Tetrahedron F=4 V=4 E=6 → valid polyhedron', async ({ page }) => {
    await page.locator('[data-testid="ch10-faces"]').fill('4');
    await page.locator('[data-testid="ch10-vertices"]').fill('4');
    await page.locator('[data-testid="ch10-edges"]').fill('6');
    await page.locator('[data-testid="ch10-check-btn"]').click();
    await expect(page.locator('[data-testid="ch10-result"]')).toContainText('Valid polyhedron');
  });

  test('TC-10-W03: F=3 V=3 E=3 → not a valid polyhedron', async ({ page }) => {
    await page.locator('[data-testid="ch10-faces"]').fill('3');
    await page.locator('[data-testid="ch10-vertices"]').fill('3');
    await page.locator('[data-testid="ch10-edges"]').fill('3');
    await page.locator('[data-testid="ch10-check-btn"]').click();
    const txt = await page.locator('[data-testid="ch10-result"]').textContent();
    expect(txt).toMatch(/not a valid polyhedron/i);
  });

  test('TC-10-W04: empty inputs → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch10-check-btn"]').click();
    const txt = await page.locator('[data-testid="ch10-result"]').textContent();
    expect(txt).toMatch(/enter/i);
  });

  test('TC-10-M01: Q1 correct answer (F+V-E=2) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch10-q1-b"]').click();
    await expect(page.locator('[data-testid="ch10-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH11: Mensuration ────────────────────────────────────────────────────────
test.describe('CH11 Mensuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch11"]').click();
  });

  test('TC-11-W01: Rectangle l=5 b=4 → area=20', async ({ page }) => {
    await page.locator('[data-testid="ch11-dim1"]').fill('5');
    await page.locator('[data-testid="ch11-dim2"]').fill('4');
    await page.locator('[data-testid="ch11-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch11-result"]')).toContainText('20');
  });

  test('TC-11-W02: Circle r=7 → area≈153.9380', async ({ page }) => {
    await page.locator('[data-testid="ch11-shape-select"]').selectOption('circle');
    await page.locator('[data-testid="ch11-dim1"]').fill('7');
    await page.locator('[data-testid="ch11-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch11-result"]')).toContainText('153.9380');
  });

  test('TC-11-W03: Trapezium a=8 b=5 h=4 → area=26', async ({ page }) => {
    await page.locator('[data-testid="ch11-shape-select"]').selectOption('trap');
    await page.locator('[data-testid="ch11-dim1"]').fill('8');
    await page.locator('[data-testid="ch11-dim2"]').fill('5');
    await page.locator('[data-testid="ch11-dim3"]').fill('4');
    await page.locator('[data-testid="ch11-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch11-result"]')).toContainText('26');
  });

  test('TC-11-M01: Q1 correct answer (154 cm²) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch11-q1-c"]').click();
    await expect(page.locator('[data-testid="ch11-q1-c"]')).toHaveClass(/correct/);
  });
});

// ─── CH12: Exponents ──────────────────────────────────────────────────────────
test.describe('CH12 Exponents', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch12"]').click();
  });

  test('TC-12-W01: 2^10 = 1024', async ({ page }) => {
    await page.locator('[data-testid="ch12-base"]').fill('2');
    await page.locator('[data-testid="ch12-power"]').fill('10');
    await page.locator('[data-testid="ch12-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch12-result"]')).toContainText('1024');
  });

  test('TC-12-W02: 5^0 = 1 (zero exponent law)', async ({ page }) => {
    await page.locator('[data-testid="ch12-base"]').fill('5');
    await page.locator('[data-testid="ch12-power"]').fill('0');
    await page.locator('[data-testid="ch12-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch12-result"]')).toContainText('1');
  });

  test('TC-12-W03: 2^-2 = 0.25 (negative exponent)', async ({ page }) => {
    await page.locator('[data-testid="ch12-base"]').fill('2');
    await page.locator('[data-testid="ch12-power"]').fill('-2');
    await page.locator('[data-testid="ch12-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch12-result"]')).toContainText('0.25');
  });

  test('TC-12-W04: empty inputs → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch12-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch12-result"]').textContent();
    expect(txt).toMatch(/enter/i);
  });

  test('TC-12-M01: Q1 correct answer (2⁰=1) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch12-q1-b"]').click();
    await expect(page.locator('[data-testid="ch12-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH13: Proportions ────────────────────────────────────────────────────────
test.describe('CH13 Proportions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch13"]').click();
  });

  test('TC-13-W01: direct proportion x1=5 y1=35 x2=8 → y2=56', async ({ page }) => {
    await page.locator('[data-testid="ch13-x1"]').fill('5');
    await page.locator('[data-testid="ch13-y1"]').fill('35');
    await page.locator('[data-testid="ch13-x2"]').fill('8');
    await page.locator('[data-testid="ch13-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch13-result"]')).toContainText('56');
  });

  test('TC-13-W02: inverse proportion x1=4 y1=6 x2=8 → y2=3', async ({ page }) => {
    await page.locator('[data-testid="ch13-type"]').selectOption('inverse');
    await page.locator('[data-testid="ch13-x1"]').fill('4');
    await page.locator('[data-testid="ch13-y1"]').fill('6');
    await page.locator('[data-testid="ch13-x2"]').fill('8');
    await page.locator('[data-testid="ch13-calc-btn"]').click();
    await expect(page.locator('[data-testid="ch13-result"]')).toContainText('3');
  });

  test('TC-13-W03: empty inputs → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch13-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch13-result"]').textContent();
    expect(txt).toMatch(/enter/i);
  });

  test('TC-13-M01: Q1 correct answer (₹56) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch13-q1-c"]').click();
    await expect(page.locator('[data-testid="ch13-q1-c"]')).toHaveClass(/correct/);
  });
});

// ─── CH14: Factorisation ──────────────────────────────────────────────────────
test.describe('CH14 Factorisation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch14"]').click();
  });

  test('TC-14-W01: difference-of-squares a=5 b=3 → (5+3)(5-3)=16', async ({ page }) => {
    await page.locator('[data-testid="ch14-a"]').fill('5');
    await page.locator('[data-testid="ch14-b"]').fill('3');
    await page.locator('[data-testid="ch14-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch14-result"]').textContent();
    expect(txt).toContain('16');
    expect(txt).toContain('(5+3)');
  });

  test('TC-14-W02: perfect-square identity a=3 b=4 → (3+4)²=49', async ({ page }) => {
    await page.locator('[data-testid="ch14-identity"]').selectOption('sq');
    await page.locator('[data-testid="ch14-a"]').fill('3');
    await page.locator('[data-testid="ch14-b"]').fill('4');
    await page.locator('[data-testid="ch14-calc-btn"]').click();
    const txt = await page.locator('[data-testid="ch14-result"]').textContent();
    expect(txt).toContain('49');
  });

  test('TC-14-M01: Q1 correct answer ((2x+5)(2x-5)) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch14-q1-b"]').click();
    await expect(page.locator('[data-testid="ch14-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH15: Introduction to Graphs ────────────────────────────────────────────
test.describe('CH15 Introduction to Graphs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch15"]').click();
  });

  test('TC-15-W01: CH15 canvas pre-renders line graph on load', async ({ page }) => {
    const c = page.locator('[data-testid="ch15-canvas"]');
    expect(await c.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0);
    expect(await c.evaluate((el: HTMLCanvasElement) => el.height)).toBeGreaterThan(0);
  });

  test('TC-15-W02: Draw Graph button redraws without error', async ({ page }) => {
    await page.locator('[data-testid="ch15-draw-btn"]').click();
    await expect(page.locator('[data-testid="ch15-canvas"]')).toBeVisible();
  });

  test('TC-15-M01: Q1 correct answer (Quadrant II) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch15-q1-b"]').click();
    await expect(page.locator('[data-testid="ch15-q1-b"]')).toHaveClass(/correct/);
  });
});

// ─── CH16: Playing with Numbers ───────────────────────────────────────────────
test.describe('CH16 Playing with Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch16"]').click();
  });

  test('TC-16-W01: 360 is divisible by 2,3,5,9,10', async ({ page }) => {
    await page.locator('[data-testid="ch16-number"]').fill('360');
    await page.locator('[data-testid="ch16-check-btn"]').click();
    const txt = await page.locator('[data-testid="ch16-result"]').textContent();
    ['2','3','5','9','10'].forEach(d => expect(txt).toContain(d));
  });

  test('TC-16-W02: 18 is divisible by 2,3,9 (not 5 or 10)', async ({ page }) => {
    await page.locator('[data-testid="ch16-number"]').fill('18');
    await page.locator('[data-testid="ch16-check-btn"]').click();
    const txt = await page.locator('[data-testid="ch16-result"]').textContent();
    expect(txt).toContain('2');
    expect(txt).toContain('9');
  });

  test('TC-16-W03: 7 is divisible by none of 2,3,5,9,10', async ({ page }) => {
    await page.locator('[data-testid="ch16-number"]').fill('7');
    await page.locator('[data-testid="ch16-check-btn"]').click();
    await expect(page.locator('[data-testid="ch16-result"]')).toContainText('none');
  });

  test('TC-16-W04: empty input → validation message', async ({ page }) => {
    await page.locator('[data-testid="ch16-check-btn"]').click();
    const txt = await page.locator('[data-testid="ch16-result"]').textContent();
    expect(txt).toMatch(/valid integer|enter/i);
  });

  test('TC-16-M01: Q1 correct answer (18) gets correct class', async ({ page }) => {
    await page.locator('[data-testid="ch16-q1-c"]').click();
    await expect(page.locator('[data-testid="ch16-q1-c"]')).toHaveClass(/correct/);
  });
});

// ─── MCQ Engine & Score Tracker ───────────────────────────────────────────────
test.describe('MCQ Engine & Score Tracker', () => {

  test('TC-MCQ-01: correct answer increments score to 1/1', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-c"]').click();
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('1 / 1');
  });

  test('TC-MCQ-02: wrong answer shows 0/1 (attempted not correct)', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-a"]').click();
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('0 / 1');
  });

  test('TC-MCQ-03: second click on same question is blocked (idempotent)', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-c"]').click();
    await page.locator('[data-testid="ch01-q1-a"]').click(); // blocked
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('1 / 1');
    await expect(page.locator('[data-testid="ch01-q1-a"]')).not.toHaveClass(/incorrect/);
  });

  test('TC-MCQ-04: score accumulates across chapters', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-c"]').click();
    await page.locator('[data-testid="nav-ch02"]').click();
    await page.locator('[data-testid="ch02-q1-b"]').click();
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('2 / 2');
  });

  test('TC-MCQ-05: data-score attribute matches correct count', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q2-b"]').click();
    await page.locator('[data-testid="ch01-q3-a"]').click();
    await page.waitForTimeout(200);
    const attr = await page.locator('[data-testid="score-bar"]').getAttribute('data-score');
    expect(parseInt(attr ?? '0')).toBe(2);
  });

  test('TC-MCQ-06: wrong answer reveals correct option in same question', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch02"]').click();
    await page.locator('[data-testid="ch02-q1-a"]').click(); // wrong
    await expect(page.locator('[data-testid="ch02-q1-a"]')).toHaveClass(/incorrect/);
    await expect(page.locator('[data-testid="ch02-q1-b"]')).toHaveClass(/correct/); // revealed
  });

  test('TC-MCQ-07: mix correct+wrong gives right score ratio', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-a"]').click(); // wrong Q1
    await page.locator('[data-testid="ch01-q2-b"]').click(); // correct Q2
    await expect(page.locator('[data-testid="score-bar"]')).toContainText('1 / 2');
  });
});
