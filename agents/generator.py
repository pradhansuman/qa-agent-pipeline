"""
agents/generator.py
───────────────────
STAGE 3 — Generator Agent.

Translates the TestPlan into runnable Playwright + TypeScript files. The
Planner already decided what to test; this agent only decides how to express
each scenario as code: selectors, assertions, fixtures, Allure annotations.

I/O CONTRACT
    in : TestPlan
    out: GeneratedSuite

Security note (standing instruction): the system prompt forbids emitting code
that disables TLS verification, hardcodes secrets, or weakens auth. If a test
must touch credentials it uses env vars and is flagged in `notes`.
"""
from __future__ import annotations

import json
import os

from agents.base import Agent
from contracts.schemas import TestPlan, GeneratedSuite

DEMOQA_BASE = "https://demoqa.com"


class GeneratorAgent(Agent):
    NAME = "generator"

    SYSTEM = """You are the Generator Agent in an automated QA pipeline.

Convert a structured test plan into production-ready Playwright TypeScript.

Rules:
- One e2e spec file for all e2e/integ scenarios; one unit test file if any
  unit scenarios exist; always emit a playwright.config.ts.
- Prefer data-testid selectors; fall back to role/label. Never use brittle
  nth-child or text selectors for critical assertions.
- NAVIGATION: ALWAYS call page.goto() with the FULL absolute URL from "Target app URL".
  Never use relative paths like '/', './', or '' in page.goto(). The baseURL in the
  config is a fallback only — rely on the explicit URL instead.
- ALLURE: import as `import { allure } from 'allure-playwright'` — never use
  `import * as allure` or import from `allure-js-commons`.
- CART/SIDEBAR APPS: if a sidebar or modal contains the element you need to read,
  always click the trigger button to open it first, then read the element.
- Add Allure annotations (allure.severity, allure.story) per test.
- Use Promise.all when racing a network request with a UI action.
- NEVER weaken security: no rejectUnauthorized:false, no hardcoded secrets,
  no auth bypass. Credentials come from process.env. If a scenario implies
  touching secrets, note it in `notes`.
- Zero TODOs, zero placeholder bodies. Every test must be runnable as written.
- Keep total output compact: at most 3 files, and keep each test body focused.
  Do not pad with comments or duplicated boilerplate — a truncated response is
  worse than a terse one.

Return ONLY JSON matching this shape — no markdown:
{
  "issue_number": <int>,
  "framework": "playwright",
  "total_tests": <int>,
  "notes": "<security flags or null>",
  "files": [
    {
      "path": "tests/e2e/<name>.spec.ts",
      "language": "typescript",
      "covers": ["TC-001","TC-002"],
      "content": "<full file source>"
    }
  ]
}"""

    def run(self, plan: TestPlan) -> GeneratedSuite:
        # Use staging URL from CI env var; fall back to DemoQA when not provided
        target_url = os.environ.get("QA_TARGET_URL", "").strip() or DEMOQA_BASE
        url_note = (
            f"Target app URL: {target_url}"
            if target_url != DEMOQA_BASE
            else f"Target app URL: {DEMOQA_BASE} (DemoQA demo environment — no staging URL was provided)"
        )

        scenarios = "\n\n".join(
            f"{s.id} [{s.type.value}/{s.priority.value}] {s.name}\n"
            f"  desc: {s.description}\n"
            f"  steps: {' -> '.join(s.steps)}\n"
            f"  expected: {s.expected}"
            for s in plan.scenarios
        )
        # For each app, inject the exact testid map so the LLM doesn't guess selectors
        store_hint = ""
        math_hub_hint = ""

        if "math_hub" in target_url or ("pradhansuman.github.io" in target_url and "math" in target_url):
            math_hub_hint = (
                "\nThis is the CBSE Class 8 Mathematics Interactive Learning Hub.\n"
                "Known data-testid attributes (use EXACTLY these — no variations):\n\n"
                "NAVIGATION:\n"
                "  [data-testid=\"chapter-nav\"]          — sticky nav bar containing all chapter links\n"
                "  [data-testid=\"nav-ch01\"] through [data-testid=\"nav-ch16\"] — anchor links\n"
                "  Clicking nav-chXX smooth-scrolls to the section with id=\"chXX\".\n"
                "  After clicking nav-ch03, verify the ch03 section is in viewport:\n"
                "    await page.locator('[data-testid=\"nav-ch03\"]').click();\n"
                "    await page.waitForFunction(() => {\n"
                "      const el = document.getElementById('ch03');\n"
                "      if (!el) return false;\n"
                "      const r = el.getBoundingClientRect();\n"
                "      return r.top >= -50 && r.top <= window.innerHeight;\n"
                "    });\n\n"
                "CHAPTER SECTIONS: [data-testid=\"chapter-1\"] through [data-testid=\"chapter-16\"]\n\n"
                "CH01 — Rational Numbers / Fraction→Decimal converter:\n"
                "  [data-testid=\"ch01-numerator\"]      — number input for p (numerator)\n"
                "  [data-testid=\"ch01-denominator\"]    — number input for q (denominator, must ≠ 0)\n"
                "  [data-testid=\"ch01-convert-btn\"]    — 'Convert' button\n"
                "  [data-testid=\"ch01-result\"]         — result div; shows 'p / q = decimal'\n"
                "    Example: fill p=7, q=8 → click Convert → result contains '0.875'\n"
                "    IMPORTANT: p/q decimal is computed with JavaScript Number division.\n"
                "    7/8 = 0.875 exactly. Use expect(text).toContain('0.875').\n\n"
                "CH02 — Linear Equations (ax + b = c):\n"
                "  [data-testid=\"ch02-a\"]              — number input for a (coefficient, must ≠ 0)\n"
                "  [data-testid=\"ch02-b\"]              — number input for b (constant)\n"
                "  [data-testid=\"ch02-c\"]              — number input for c (RHS)\n"
                "  [data-testid=\"ch02-solve-btn\"]      — 'Solve' button\n"
                "  [data-testid=\"ch02-result\"]         — result div; shows 'x = <value>'\n"
                "    Example: a=3, b=7, c=22 → x = (22-7)/3 = 5 → result contains 'x = 5'\n\n"
                "CH03 — Quadrilaterals:\n"
                "  [data-testid=\"ch03-card-square\"], [data-testid=\"ch03-card-rectangle\"],\n"
                "  [data-testid=\"ch03-card-rhombus\"], [data-testid=\"ch03-card-parallelogram\"],\n"
                "  [data-testid=\"ch03-card-trapezium\"]  — shape selector buttons\n"
                "  [data-testid=\"ch03-properties\"]     — panel showing bullet-list of properties\n"
                "    After clicking ch03-card-square, the panel shows 'All 4 sides equal'\n\n"
                "CH05 — Data Handling:\n"
                "  [data-testid=\"ch05-chart-type\"]     — <select>: 'bar', 'histogram', 'pie'\n"
                "  [data-testid=\"ch05-draw-btn\"]       — 'Render' button\n"
                "  [data-testid=\"ch05-canvas\"]         — HTML5 <canvas> (width=380, height=240)\n"
                "    Canvas is pre-drawn on page load. Assert non-zero dimensions:\n"
                "      const canvas = page.locator('[data-testid=\"ch05-canvas\"]');\n"
                "      expect(await canvas.evaluate(el => el.width)).toBeGreaterThan(0);\n"
                "      expect(await canvas.evaluate(el => el.height)).toBeGreaterThan(0);\n\n"
                "MCQ BUTTONS (pattern: [data-testid=\"chXX-qY-Z\"] where Z is a/b/c/d):\n"
                "  Example: [data-testid=\"ch01-q1-c\"] — Chapter 1, Question 1, option C\n"
                "  Clicking the WRONG option adds class 'incorrect' to that button.\n"
                "  Clicking the RIGHT option adds class 'correct' to that button.\n"
                "  Once answered, clicking again has no effect (guard prevents re-answering).\n"
                "  To assert wrong answer turns red:\n"
                "    await page.locator('[data-testid=\"ch01-q1-a\"]').click(); // option a is wrong for Q1\n"
                "    await expect(page.locator('[data-testid=\"ch01-q1-a\"]')).toHaveClass(/incorrect/);\n\n"
                "SCORE BAR: [data-testid=\"score-bar\"] — fixed bottom-right showing 'Score: X / Y'\n\n"
                "TEST ISOLATION: each Playwright test gets a fresh browser context. No cleanup needed.\n"
                "NAVIGATION NOTE: always call page.goto() with the FULL absolute URL.\n"
                "  Then scroll to the chapter being tested before interacting with its widgets:\n"
                "    await page.locator('[data-testid=\"nav-ch01\"]').click();\n"
                "    await page.locator('[data-testid=\"ch01-numerator\"]').scrollIntoViewIfNeeded();\n"
            )

        if "pradhansuman.github.io" in target_url or ("store.html" in target_url and "math" not in target_url):
            store_hint = (
                "\nKnown data-testid attributes for this app (use EXACTLY these, no variations):\n"
                "  [data-testid=\"cart-button\"]         — header button that opens/closes cart sidebar\n"
                "  [data-testid=\"cart-count\"]          — item count badge inside the cart button\n"
                "  [data-testid=\"cart-sidebar\"]        — the cart panel (has class 'open' when visible)\n"
                "  [data-testid=\"cart-items\"]          — container listing cart line items\n"
                "  [data-testid=\"cart-total\"]          — span showing running total, e.g. $79.99\n"
                "  [data-testid=\"checkout-btn\"]        — checkout button inside sidebar\n"
                "  [data-testid=\"product-grid\"]        — grid of product cards\n"
                "  [data-testid=\"product-card\"]        — individual product card (multiple)\n"
                "  [data-testid=\"product-name\"]        — product name text inside a card\n"
                "  [data-testid=\"product-price\"]       — price text, format $XX.XX inside a card\n"
                "  [data-testid=\"add-to-cart\"]         — 'Add to Cart' button inside each card\n"
                "  [data-testid=\"qty-increase\"]        — '+' quantity button inside cart sidebar\n"
                "  [data-testid=\"qty-decrease\"]        — '-' quantity button inside cart sidebar\n"
                "  [data-testid=\"remove-item\"]         — '✕ Remove' button inside cart sidebar\n"
                "Actual product prices: product 1=$79.99, product 2=$119.00, product 3=$39.95, "
                "product 4=$34.99, product 5=$89.00. NEVER hardcode price values — always read them "
                "dynamically from [data-testid=\"product-price\"] then use that variable in assertions.\n"
                "To open sidebar: click [data-testid=\"cart-button\"], then wait with "
                "page.waitForSelector('#cart-sidebar.open'). "
                "Do NOT use waitFor({ state: 'visible' }) on the sidebar — it is always in the DOM.\n"
                "\nTEST ISOLATION: each Playwright test gets a completely fresh browser context with\n"
                "empty localStorage. NEVER add cart-cleanup or clearCart logic in beforeEach —\n"
                "the cart is always empty at the start of every test. Never open the sidebar in\n"
                "beforeEach either — only open it when a specific test needs it.\n"
                "\nCRITICAL — adding a specific product to cart (use EXACTLY this pattern):\n"
                "  const cards = page.locator('[data-testid=\"product-card\"]');\n"
                "  await cards.nth(0).locator('[data-testid=\"add-to-cart\"]').click(); // product 1\n"
                "  await cards.nth(1).locator('[data-testid=\"add-to-cart\"]').click(); // product 2\n"
                "NEVER do these (both are wrong):\n"
                "  await cards.nth(0).click();  // clicking the card itself has NO effect (no handler)\n"
                "  await page.click('[data-testid=\"add-to-cart\"]');  // always clicks product 1 regardless of index\n"
                "To read a specific product's price: await cards.nth(0).locator('[data-testid=\"product-price\"]').textContent()\n"
                "\nCRITICAL — opening the cart sidebar safely:\n"
                "  const isSidebarOpen = await page.locator('[data-testid=\"cart-sidebar\"].open').count();\n"
                "  if (!isSidebarOpen) {\n"
                "    await page.click('[data-testid=\"cart-button\"]');\n"
                "    await page.waitForSelector('[data-testid=\"cart-sidebar\"].open');\n"
                "  }\n"
                "Do NOT click cart-button if sidebar is already open — it will toggle it closed and time out.\n"
                "\nCRITICAL — checkout behavior (NO navigation happens):\n"
                "  The checkout button triggers a browser window.alert() dialog — there is NO separate\n"
                "  checkout page and NO page navigation. Do NOT use page.waitForNavigation().\n"
                "  After the alert is accepted: cart is cleared, sidebar closes.\n"
                "  To test checkout, capture the alert BEFORE clicking, then compare text:\n"
                "    // Read sidebar total BEFORE checkout\n"
                "    const sidebarTotal = parseFloat((await page.locator('[data-testid=\"cart-total\"]').textContent())!.replace('$',''));\n"
                "    // Set up dialog listener BEFORE clicking (order matters)\n"
                "    const dialogPromise = page.waitForEvent('dialog');\n"
                "    await page.locator('[data-testid=\"checkout-btn\"]').click();\n"
                "    const dialog = await dialogPromise;\n"
                "    const alertText = dialog.message();\n"
                "    await dialog.accept();\n"
                "    // Assert the alert text contains the correct total\n"
                "    const alertTotal = parseFloat(alertText.match(/Total:\\s*\\$([\\d.]+)/)?.[1] || '0');\n"
                "    expect(alertTotal).toBeCloseTo(sidebarTotal, 2);\n"
            )

        app_hint = math_hub_hint or store_hint
        prompt = (
            f"Issue #{plan.issue_number}\n"
            f"Plan summary: {plan.summary}\n"
            f"Risk: {plan.risk_level.value} — {plan.risk_rationale}\n"
            f"{url_note}{app_hint}\n\n"
            f"Scenarios to implement:\n{scenarios}\n"
        )
        suite = self._complete_json(prompt, GeneratedSuite, max_tokens=8000)
        suite.issue_number = plan.issue_number
        if not suite.total_tests:
            suite.total_tests = len(plan.scenarios)
        return suite
