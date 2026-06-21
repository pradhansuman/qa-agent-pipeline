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

from agents.base import Agent
from contracts.schemas import TestPlan, GeneratedSuite


class GeneratorAgent(Agent):
    NAME = "generator"

    SYSTEM = """You are the Generator Agent in an automated QA pipeline.

Convert a structured test plan into production-ready Playwright TypeScript.

Rules:
- One e2e spec file for all e2e/integ scenarios; one unit test file if any
  unit scenarios exist; always emit a playwright.config.ts.
- Prefer data-testid selectors; fall back to role/label. Never use brittle
  nth-child or text selectors for critical assertions.
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
        scenarios = "\n\n".join(
            f"{s.id} [{s.type.value}/{s.priority.value}] {s.name}\n"
            f"  desc: {s.description}\n"
            f"  steps: {' -> '.join(s.steps)}\n"
            f"  expected: {s.expected}"
            for s in plan.scenarios
        )
        prompt = (
            f"Issue #{plan.issue_number}\n"
            f"Plan summary: {plan.summary}\n"
            f"Risk: {plan.risk_level.value} — {plan.risk_rationale}\n\n"
            f"Scenarios to implement:\n{scenarios}\n"
        )
        suite = self._complete_json(prompt, GeneratedSuite, max_tokens=8000)
        suite.issue_number = plan.issue_number
        if not suite.total_tests:
            suite.total_tests = len(plan.scenarios)
        return suite
