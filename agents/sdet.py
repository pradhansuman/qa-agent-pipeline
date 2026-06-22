"""
agents/sdet.py
──────────────
STAGE 2 (alt) — SDET Agent.

A rigorous replacement for the PlannerAgent. Instead of producing a handful of
high-level scenarios, it applies six formal test-design techniques to derive a
complete, high-signal test suite with technique attribution, concrete test data,
and a coverage-gap manifest.

Downstream contracts are preserved: SDETTestPlan.to_test_plan() downcasts to
the standard TestPlan so the Generator, Runner, and Reporter are all unchanged.

I/O CONTRACT
    in : IssuePayload
    out: SDETTestPlan
"""
from __future__ import annotations

import textwrap

from agents.base import Agent
from contracts.schemas import IssuePayload, SDETTestPlan


class SDETAgent(Agent):
    NAME = "sdet"

    SYSTEM = textwrap.dedent("""\
        You are a Senior SDET with deep expertise in test design. Given a feature
        specification, derive a complete, high-signal set of test cases.

        DERIVATION RULES — apply each where relevant and NAME the technique per case:
        1. Equivalence Partitioning — one representative per valid/invalid class.
        2. Boundary Value Analysis — for every bounded input cover min-1, min, min+1,
           max-1, max, max+1, and a nominal value.
        3. Decision Table — enumerate combinations for any rule with >= 2 conditions.
        4. State Transition — valid transitions, invalid transitions, self-loops.
        5. Pairwise — for >= 3 independent parameters use pairwise coverage, not full
           Cartesian.
        6. Error Guessing / Negative — malformed, null/empty, type-mismatched,
           oversized, out-of-order, and duplicate inputs.

        COVERAGE DIMENSIONS — include where applicable:
        happy path; negative/invalid; boundary/edge; security (authn, authz, injection,
        sensitive-data exposure, IDOR); error handling & recovery; idempotency & retries;
        concurrency/race; data integrity & persistence; localization/i18n & accessibility
        (UI only); observability (correct logs/metrics/errors emitted).

        QUALITY BAR:
        - Every acceptance criterion maps to >= 1 positive AND >= 1 negative case.
        - Each case is atomic (one behavior), independent (no ordering dependency),
          and deterministic (single unambiguous expected result).
        - Test data is concrete — never "valid input".
        - Expected results are observable and assertable.
        - No two cases cover the same condition.

        PRIORITIZE P0 (critical path / data loss / security) -> P3 (cosmetic), each
        with a one-line risk rationale.

        Return ONLY a valid JSON object — no markdown, no prose before or after it:
        {
          "issue_number": <int>,
          "test_cases": [
            {
              "id": "TC-001",
              "title": "...",
              "requirement_ref": "AC-1",
              "type": "positive|negative|boundary|security|state|concurrency|idempotency|accessibility|observability",
              "technique": "Boundary Value Analysis",
              "priority": "P0|P1|P2|P3",
              "risk_rationale": "one-line risk statement",
              "preconditions": ["..."],
              "test_data": {"field": "concrete value"},
              "steps": ["1. ...", "2. ..."],
              "expected_result": "observable, assertable outcome"
            }
          ],
          "coverage_gaps": [
            {"requirement_ref": "AC-2", "reason": "spec ambiguous on ..."}
          ]
        }
    """)

    def run(self, issue: IssuePayload) -> SDETTestPlan:
        requirement_block = self._format_requirement(issue)
        context_block     = self._format_context(issue)

        prompt = (
            f"<requirement>\n{requirement_block}\n</requirement>\n\n"
            f"<context>\n{context_block}\n</context>"
        )

        # SDET output is verbose — bump token budget to fit 20-40 test cases.
        plan = self._complete_json(prompt, SDETTestPlan, max_tokens=6000)
        plan.issue_number = issue.issue_number  # always matches input

        print(
            f"[sdet] {len(plan.test_cases)} cases derived  "
            f"gaps={len(plan.coverage_gaps)}  "
            f"P0s={sum(1 for t in plan.test_cases if t.priority == 'P0')}"
        )
        return plan

    # ── prompt formatters ────────────────────────────────────────────────────
    @staticmethod
    def _format_requirement(issue: IssuePayload) -> str:
        lines = [
            f"Issue #{issue.issue_number} — {issue.title}",
            f"Repository: {issue.repo}",
            f"Type: {issue.type}   Priority: {issue.priority.value}",
        ]
        if issue.component:
            lines.append(f"Component: {issue.component}")
        if issue.labels:
            lines.append(f"Labels: {', '.join(issue.labels)}")
        if issue.body.strip():
            lines += ["", issue.body.strip()]
        return "\n".join(lines)

    @staticmethod
    def _format_context(issue: IssuePayload) -> str:
        component = issue.component or "UI"

        # Infer constraints from labels and issue type
        constraints: list[str] = []
        label_lower = {l.lower() for l in issue.labels}
        if any(k in label_lower for k in ("auth", "login", "jwt", "oauth")):
            constraints.append("authentication required")
        if any(k in label_lower for k in ("rate-limit", "throttle")):
            constraints.append("rate limiting applies")
        if any(k in label_lower for k in ("api", "rest", "graphql")):
            constraints.append("REST/JSON API")
        if issue.priority.value == "P0":
            constraints.append("SLA: zero downtime tolerance")
        if not constraints:
            constraints.append("no special auth or rate-limit constraints identified")

        return (
            f"- Component: {component}\n"
            f"- Constraints: {'; '.join(constraints)}\n"
            f"- Out of scope: performance/load testing, third-party integrations "
            f"unless directly referenced in the issue body"
        )
