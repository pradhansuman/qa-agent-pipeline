"""
Agent 1 — Analyzer
───────────────────
PRD text + app URL  →  PRDAnalysis + TestPlan

Responsibilities:
  • Parse the PRD and extract every testable feature.
  • Identify UI selectors / DOM landmarks from the PRD description.
  • Produce a structured, prioritised TestPlan.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from anthropic import Anthropic
from agents.base import Agent            # reuse existing base
from mcp_framework.contracts import (
    PRDInput, PRDAnalysis, AppFeature,
    TestPlan, TestScenario, Severity,
)


_ANALYSIS_PROMPT = """\
You are a Senior QA Architect. Analyse the PRD/requirements below and return
ONLY a valid JSON object matching this schema (no prose, no markdown fences):

{{
  "app_name": "<short name>",
  "app_url": "<url provided>",
  "app_type": "<e-commerce|spa|saas|portal|other>",
  "tech_stack": ["<framework>", ...],
  "test_coverage_recommendation": "<one sentence>",
  "notes": "<optional>",
  "features": [
    {{
      "name": "<feature name>",
      "description": "<what it does>",
      "selectors": ["<CSS selector or descriptive hint>", ...],
      "user_actions": ["click", "fill form", "assert text", ...],
      "acceptance_criteria": ["<criterion>", ...]
    }}
  ]
}}

Rules:
- Extract EVERY distinct user-facing feature that should be tested.
- selectors can be CSS ids ("#btn-1"), classes (".cart-sidebar"), or
  descriptive labels ("Add to Cart button") if the PRD doesn't give exact selectors.
- List realistic user_actions that a Playwright test would perform.
- acceptance_criteria must be verifiable assertions, not vague statements.

APP URL: {app_url}

PRD / REQUIREMENTS:
{prd_text}
"""

_PLAN_PROMPT = """\
You are a Senior QA Lead. Given the feature analysis below, generate a
comprehensive test plan. Return ONLY a valid JSON object (no prose, no fences):

{{
  "app_name": "<name>",
  "total_scenarios": <N>,
  "coverage_summary": "<one paragraph>",
  "scenarios": [
    {{
      "id": "TC-001",
      "feature": "<feature name>",
      "title": "<concise test title>",
      "priority": "P0|P1|P2|P3",
      "preconditions": ["<condition>"],
      "steps": ["1. Navigate to ...", "2. Click ...", "3. Verify ..."],
      "expected_outcome": "<what should happen>",
      "selectors_needed": ["#id", ".class", ...]
    }}
  ]
}}

Rules:
- P0 = smoke / critical path.  P1 = important flows.  P2/P3 = edge cases.
- Every feature must have at least one P0 or P1 test.
- Steps must be concrete Playwright actions (navigate, click, fill, expect).
- Generate between 10 and 20 test scenarios — enough for real coverage without truncation.

FEATURE ANALYSIS:
{analysis_json}
"""


class AnalyzerAgent(Agent):
    NAME   = "Analyzer"
    SYSTEM = "You are a Senior QA Architect. Output only valid JSON."

    def __init__(self, model: str):
        super().__init__(client=Anthropic(), model=model)

    # ── public API ────────────────────────────────────────────────────────
    def analyze(self, inp: PRDInput) -> PRDAnalysis:
        prompt = _ANALYSIS_PROMPT.format(
            app_url=inp.app_url,
            prd_text=inp.prd_text,
        )
        raw = self._complete_json(prompt, _AnalysisRaw, max_tokens=4096)
        return PRDAnalysis(
            app_name=raw.app_name or inp.app_name,
            app_url=inp.app_url,
            app_type=raw.app_type,
            features=[
                AppFeature(**f.model_dump()) for f in raw.features
            ],
            tech_stack=raw.tech_stack,
            test_coverage_recommendation=raw.test_coverage_recommendation,
            notes=raw.notes,
        )

    def plan(self, analysis: PRDAnalysis) -> TestPlan:
        import json
        prompt = _PLAN_PROMPT.format(
            analysis_json=analysis.model_dump_json(indent=2)
        )
        raw = self._complete_json(prompt, _PlanRaw, max_tokens=12000)
        scenarios = [
            TestScenario(
                id=s.id,
                feature=s.feature,
                title=s.title,
                priority=Severity(s.priority),
                preconditions=s.preconditions,
                steps=s.steps,
                expected_outcome=s.expected_outcome,
                selectors_needed=s.selectors_needed,
            )
            for s in raw.scenarios
        ]
        return TestPlan(
            app_name=analysis.app_name,
            total_scenarios=len(scenarios),
            scenarios=scenarios,
            coverage_summary=raw.coverage_summary,
        )


# ── internal Pydantic models for JSON parsing ─────────────────────────────
from pydantic import BaseModel
from typing import Optional

class _FeatureRaw(BaseModel):
    name: str
    description: str
    selectors: list[str] = []
    user_actions: list[str] = []
    acceptance_criteria: list[str] = []

class _AnalysisRaw(BaseModel):
    app_name: str = ""
    app_url: str  = ""
    app_type: str = "web"
    tech_stack: list[str] = []
    test_coverage_recommendation: str = ""
    notes: str = ""
    features: list[_FeatureRaw]

class _ScenarioRaw(BaseModel):
    id: str
    feature: str
    title: str
    priority: str = "P2"
    preconditions: list[str] = []
    steps: list[str]
    expected_outcome: str
    selectors_needed: list[str] = []

class _PlanRaw(BaseModel):
    app_name: str = ""
    total_scenarios: int = 0
    coverage_summary: str = ""
    scenarios: list[_ScenarioRaw]
