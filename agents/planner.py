"""
agents/planner.py
─────────────────
STAGE 2 — Planner Agent.

Reads the normalised issue and reasons about *what to test*. Emits a typed,
prioritised TestPlan. The model never writes code here — separating "what to
test" (Planner) from "how to test it" (Generator) keeps each prompt focused
and each output independently reviewable.

I/O CONTRACT
    in : IssuePayload
    out: TestPlan
"""
from __future__ import annotations

from agents.base import Agent
from contracts.schemas import IssuePayload, TestPlan


class PlannerAgent(Agent):
    NAME = "planner"

    SYSTEM = """You are the Planner Agent in an automated QA pipeline.

Given a GitHub issue, decide WHAT to test — never write test code.

Rules:
- Produce 3–6 concrete test scenarios.
- Cover the happy path, negative/boundary paths, and any security or
  accessibility implications the issue implies.
- Escalate priority independently of the issue label when warranted. Example:
  an issue labelled P1 that exposes a replay/auth bypass contains a P0 scenario.
- Each step must be a concrete, executable action ("click the submit button"),
  not an abstraction ("verify the form works").
- `expected` must be a single assertable outcome the Generator can turn into
  one expect() call.

Return ONLY a JSON object matching this exact shape — no markdown, no prose:
{
  "issue_number": <int>,
  "summary": "<one line>",
  "scenarios": [
    {
      "id": "TC-001",
      "name": "<short name>",
      "type": "e2e|unit|api|integ",
      "priority": "P0|P1|P2",
      "description": "<what this verifies>",
      "steps": ["step 1", "step 2", "..."],
      "expected": "<single assertable outcome>"
    }
  ],
  "coverage_areas": ["area1", "area2"],
  "risk_level": "high|medium|low",
  "risk_rationale": "<one sentence>"
}"""

    def run(self, issue: IssuePayload) -> TestPlan:
        prompt = (
            f"Issue #{issue.issue_number} ({issue.repo})\n"
            f"Title: {issue.title}\n"
            f"Labels: {', '.join(issue.labels) or 'none'}\n"
            f"Priority: {issue.priority.value}  Type: {issue.type}  "
            f"Component: {issue.component or 'n/a'}\n\n"
            f"Body:\n{issue.body}\n"
        )
        plan = self._complete_json(prompt, TestPlan, max_tokens=2000)
        # contract guarantee: issue_number always matches input
        plan.issue_number = issue.issue_number
        return plan
