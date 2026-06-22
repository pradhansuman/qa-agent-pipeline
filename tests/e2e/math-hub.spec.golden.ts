import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';

const URL = 'https://pradhansuman.github.io/qa-agent-pipeline/math_hub.html';

test.describe('CBSE Class 8 Maths Hub', () => {

  test('TC-001: Page loads and renders all 16 chapters', async ({ page }) => {
    await allure.severity('blocker');
    await allure.story('Page Load');
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    expect(errors).toHaveLength(0);
    expect(await page.locator('[data-testid^="chapter-"]').count()).toBe(16);
  });

  test('TC-002: Chapter navigation links scroll to correct sections', async ({ page }) => {
    await allure.severity('high');
    await allure.story('Navigation');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch05"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="chapter-5"]')).toBeVisible();
  });

  test('TC-003: Fraction to Decimal converter produces correct result', async ({ page }) => {
    await allure.severity('high');
    await allure.story('CH01 Calculator');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-numerator"]').fill('7');
    await page.locator('[data-testid="ch01-denominator"]').fill('8');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    await expect(page.locator('[data-testid="ch01-result"]')).toContainText('0.875');
  });

  test('TC-004: Equation solver correctly solves ax+b=c', async ({ page }) => {
    await allure.severity('high');
    await allure.story('CH02 Solver');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch02"]').click();
    await page.locator('[data-testid="ch02-a"]').fill('3');
    await page.locator('[data-testid="ch02-b"]').fill('7');
    await page.locator('[data-testid="ch02-c"]').fill('22');
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    await expect(page.locator('[data-testid="ch02-result"]')).toContainText('x = 5');
  });

  test('TC-005: Quadrilateral viewer displays correct shape properties', async ({ page }) => {
    await allure.severity('high');
    await allure.story('CH03 Viewer');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch03"]').click();
    await page.locator('[data-testid="ch03-card-square"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="ch03-properties"]')).toContainText('All 4 sides equal');
  });

  test('TC-006: HTML5 canvas pre-renders on page load', async ({ page }) => {
    await allure.severity('high');
    await allure.story('CH05 Canvas');
    await page.goto(URL, { waitUntil: 'networkidle' });
    const canvas = page.locator('[data-testid="ch05-canvas"]');
    expect(await canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeGreaterThan(0);
    expect(await canvas.evaluate((el: HTMLCanvasElement) => el.height)).toBeGreaterThan(0);
  });

  test('TC-007: MCQ wrong answer shows incorrect styling', async ({ page }) => {
    await allure.severity('high');
    await allure.story('MCQ');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    const btn = page.locator('[data-testid="ch01-q1-a"]');
    await btn.click();
    await expect(btn).toHaveClass(/incorrect/);
  });

  test('TC-008: MCQ correct answer shows correct styling', async ({ page }) => {
    await allure.severity('high');
    await allure.story('MCQ');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    const btn = page.locator('[data-testid="ch01-q1-c"]');
    await btn.click();
    await expect(btn).toHaveClass(/correct/);
  });

  test('TC-009: Score bar increments after correct MCQ answer', async ({ page }) => {
    await allure.severity('high');
    await allure.story('MCQ Score');
    await page.goto(URL, { waitUntil: 'networkidle' });
    const bar = page.locator('[data-testid="score-bar"]');
    const initial = parseInt(await bar.getAttribute('data-score') ?? '0');
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-q1-c"]').click();
    await page.waitForTimeout(300);
    const updated = parseInt(await bar.getAttribute('data-score') ?? '0');
    expect(updated).toBeGreaterThan(initial);
  });

  test('TC-010: Fraction converter handles zero denominator', async ({ page }) => {
    await allure.severity('medium');
    await allure.story('CH01 Boundary');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch01"]').click();
    await page.locator('[data-testid="ch01-numerator"]').fill('5');
    await page.locator('[data-testid="ch01-denominator"]').fill('0');
    await page.locator('[data-testid="ch01-convert-btn"]').click();
    const result = await page.locator('[data-testid="ch01-result"]').textContent();
    expect(result).toMatch(/undefined|error|cannot|0/i);
  });

  test('TC-011: Equation solver handles zero coefficient', async ({ page }) => {
    await allure.severity('medium');
    await allure.story('CH02 Boundary');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="nav-ch02"]').click();
    await page.locator('[data-testid="ch02-a"]').fill('0');
    await page.locator('[data-testid="ch02-b"]').fill('5');
    await page.locator('[data-testid="ch02-c"]').fill('10');
    await page.locator('[data-testid="ch02-solve-btn"]').click();
    const result = await page.locator('[data-testid="ch02-result"]').textContent();
    expect(result).toMatch(/error|no solution|cannot/i);
  });

});
