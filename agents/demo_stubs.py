"""
agents/demo_stubs.py
────────────────────
Offline demo mode. Swaps the four LLM agents' Claude calls for canned, in-repo
responses so the ENTIRE six-stage pipeline runs with:
  • no Anthropic API key
  • no API credit
  • no internet (except the Ingestor's GitHub call — see note below)

This is for demos / interviews / CI smoke tests. It exercises every contract,
the self-heal cycle, and the merge gate — exactly the same code paths as a real
run — but the LLM "judgement" is pre-baked instead of live.

Wire it in with the --demo flag (see orchestrator/pipeline.py).

NOTE on the Ingestor: by default --demo still hits GitHub (it's free and needs
no key). Pass --demo --offline to also stub the issue so nothing leaves the box.
"""
from __future__ import annotations

from contracts.schemas import (
    IssuePayload, TestPlan, TestScenario, GeneratedSuite, GeneratedFile,
    Priority, TestType, RiskLevel,
)
from agents.planner import PlannerAgent
from agents.generator import GeneratorAgent
from agents.reporter import ReporterAgent
from agents.healer import HealerAgent, _Repair


# ── canned issue (for --offline, skips GitHub too) ──────────────
def demo_issue() -> IssuePayload:
    return IssuePayload(
        issue_number=1042,
        repo="demo/frontend-app",
        state="open",
        title="Login form allows empty email submission",
        body=("Users can click Sign In without entering an email. The form "
              "should validate email is not empty and show an error. Invalid "
              "formats like 'user@' must be rejected before submission."),
        labels=["bug", "P0", "ui", "validation"],
        priority=Priority.P0, type="bug", component="auth",
        milestone="v2.4.0", author="demo-user", comments_count=3,
        url="https://github.com/demo/frontend-app/issues/1042",
    )


# ── canned Planner output ───────────────────────────────────────
def _demo_plan(issue_number: int) -> TestPlan:
    return TestPlan(
        issue_number=issue_number,
        summary="Validate login email field: empty, malformed, and recovery paths.",
        scenarios=[
            TestScenario(
                id="TC-001", name="Empty email triggers inline error",
                type=TestType.E2E, priority=Priority.P0,
                description="Submitting with an empty email shows an inline error and no navigation.",
                steps=["go to /login", "leave email empty", "click submit",
                       "assert error visible", "assert url unchanged"],
                expected="Inline 'Email is required' shown; no submission."),
            TestScenario(
                id="TC-002", name="Invalid formats rejected, zero API calls",
                type=TestType.E2E, priority=Priority.P0,
                description="Malformed emails are rejected client-side before any /api/auth call.",
                steps=["attach request spy", "enter 'user@'", "submit",
                       "assert error", "assert 0 api calls"],
                expected="Error per invalid input; no network request fired."),
            TestScenario(
                id="TC-003", name="Valid email clears error and submits",
                type=TestType.E2E, priority=Priority.P1,
                description="A valid email clears the error and allows the POST.",
                steps=["trigger error", "type valid email", "assert error gone",
                       "submit", "assert POST /api/auth"],
                expected="Error clears; form submits."),
            TestScenario(
                id="TC-004", name="aria-invalid and role=alert present",
                type=TestType.E2E, priority=Priority.P1,
                description="Error state exposes correct ARIA attributes for screen readers.",
                steps=["submit empty", "assert aria-invalid=true",
                       "assert role=alert", "assert aria-describedby links error"],
                expected="Screen reader can announce the error."),
            TestScenario(
                id="TC-005", name="validateEmail() boundary cases",
                type=TestType.UNIT, priority=Priority.P2,
                description="Unit-test the validator with valid and invalid boundaries.",
                steps=["call with ''", "call with 'user@'", "call with 'a@b.co'",
                       "call with null"],
                expected="false for invalid, true for valid, no throw on null."),
        ],
        coverage_areas=["form validation", "client-side guard", "accessibility",
                        "email utility", "error recovery"],
        risk_level=RiskLevel.HIGH,
        risk_rationale="Login is a P0 auth path; a validation bypass is a security + UX regression.",
    )


# ── canned Generator output ─────────────────────────────────────
def _demo_suite(issue_number: int) -> GeneratedSuite:
    spec = (
        "import { test, expect } from '@playwright/test';\n\n"
        "test.describe('Login email validation (#1042)', () => {\n"
        "  test.beforeEach(async ({ page }) => { await page.goto('/login'); });\n\n"
        "  test('TC-001: empty email triggers inline error', async ({ page }) => {\n"
        "    const url = page.url();\n"
        "    await page.click('[data-testid=\"submit-btn\"]');\n"
        "    await expect(page.locator('[data-testid=\"email-error\"]')).toBeVisible();\n"
        "    expect(page.url()).toBe(url);\n"
        "  });\n"
        "});\n"
    )
    unit = (
        "import { validateEmail } from '../../src/utils/validators';\n\n"
        "describe('validateEmail()', () => {\n"
        "  test.each([['',false],['user@',false],['a@b.co',true]])(\n"
        "    'validateEmail(%s) === %s', (input, exp) => {\n"
        "      expect(validateEmail(input as string)).toBe(exp);\n"
        "  });\n"
        "});\n"
    )
    return GeneratedSuite(
        issue_number=issue_number, framework="playwright", total_tests=5,
        notes="No security flags. Credentials via process.env only.",
        files=[
            GeneratedFile(path="tests/e2e/login.spec.ts", content=spec,
                          covers=["TC-001", "TC-002", "TC-003", "TC-004"]),
            GeneratedFile(path="tests/unit/validators.test.ts", content=unit,
                          covers=["TC-005"]),
        ],
    )


# ── canned Healer repair ────────────────────────────────────────
def _demo_repair(prompt: str, schema, max_tokens: int = 500) -> _Repair:
    return _Repair(
        new_selector='[data-testid="login-submit"]',
        rationale="The submit button's data-testid was renamed from submit-btn to login-submit in the current DOM.",
        confidence=0.93,
    )


# ── canned Reporter narrative ───────────────────────────────────
def _demo_narrative(prompt: str, schema, max_tokens: int = 800):
    # schema is reporter._Narrative
    return schema(
        headline="All tests green after one self-heal — safe to merge.",
        summary_md=("The suite passed after the self-healing agent repaired a "
                    "stale selector (`submit-btn` -> `login-submit`). No P0 "
                    "regressions remain."),
        issue_comment=("### AI-Assisted QA result\n"
                       "- Pass rate: see run summary\n"
                       "- 1 test auto-healed (selector drift)\n"
                       "- Gate: see decision\n"),
    )


def install_demo_stubs(pipeline, offline: bool = False) -> None:
    """Monkey-patch the four LLM agents on a QAPipeline instance to run offline."""
    # Planner
    pipeline.planner.run = lambda issue: _demo_plan(issue.issue_number)
    # Generator
    pipeline.generator.run = lambda plan: _demo_suite(plan.issue_number)
    # Healer — stub only the LLM call, keep all the real triage/patch/rerun logic
    if pipeline.healer is not None:
        pipeline.healer._complete_json = _demo_repair
    # Reporter — stub only the narrative call, keep the rule-based gate
    pipeline.reporter._complete_json = _demo_narrative
    # Ingestor (optional — only when fully offline)
    if offline:
        pipeline.ingestor.run = lambda ref: demo_issue()
