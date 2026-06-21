"""
contracts/schemas.py
─────────────────────
The typed I/O contract for every agent in the AI-Assisted QA pipeline.

Each agent declares exactly what it consumes and what it emits. These models
are the *only* thing agents share — no agent reaches into another's internals.
This is what makes the pipeline composable: any stage can be swapped, mocked,
or re-run in isolation as long as it honours the contract.

    IssueRef ─▶ [Ingestor] ─▶ IssuePayload
    IssuePayload ─▶ [Planner] ─▶ TestPlan
    TestPlan ─▶ [Generator] ─▶ GeneratedSuite
    GeneratedSuite ─▶ [Runner] ─▶ RunResults
    RunResults ─▶ [Reporter] ─▶ ReportArtifact
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ─────────────────────────── shared enums ───────────────────────────
class Priority(str, Enum):
    P0 = "P0"   # critical — blocks release
    P1 = "P1"   # high — must fix this sprint
    P2 = "P2"   # medium — backlog


class TestType(str, Enum):
    E2E = "e2e"
    UNIT = "unit"
    API = "api"
    INTEG = "integ"


class RiskLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ─────────────── stage 1 — GitHub Issue Ingestion ───────────────
class IssueRef(BaseModel):
    """INPUT to the Ingestor — a pointer to a real GitHub issue."""
    repo: str = Field(..., description="owner/name, e.g. 'mui/material-ui'")
    issue_number: int
    github_token: Optional[str] = Field(
        None, description="PAT for private repos / higher rate limits"
    )


class IssuePayload(BaseModel):
    """OUTPUT of the Ingestor — normalised, agent-ready issue object."""
    issue_number: int
    repo: str
    state: str
    title: str
    body: str
    labels: list[str] = []
    priority: Priority = Priority.P2
    type: str = "bug"                 # bug | feature | chore
    component: Optional[str] = None
    milestone: Optional[str] = None
    author: Optional[str] = None
    comments_count: int = 0
    url: str = ""
    pipeline_stage: str = "ingested"
    ready_for_planner: bool = True


# ─────────────── stage 2 — Planner Agent ───────────────
class TestScenario(BaseModel):
    id: str = Field(..., description="TC-001, TC-002, ...")
    name: str
    type: TestType
    priority: Priority
    description: str
    steps: list[str]
    expected: str


class TestPlan(BaseModel):
    """OUTPUT of the Planner — a structured, prioritised test plan."""
    issue_number: int
    summary: str
    scenarios: list[TestScenario]
    coverage_areas: list[str]
    risk_level: RiskLevel
    risk_rationale: str


# ─────────────── stage 3 — Generator Agent ───────────────
class GeneratedFile(BaseModel):
    path: str = Field(..., description="relative path, e.g. tests/e2e/login.spec.ts")
    language: str = "typescript"
    content: str
    covers: list[str] = Field(default_factory=list, description="TC ids covered")


class GeneratedSuite(BaseModel):
    """OUTPUT of the Generator — runnable test files + config."""
    issue_number: int
    files: list[GeneratedFile]
    framework: str = "playwright"
    total_tests: int = 0
    notes: Optional[str] = None


# ─────────────── stage 4 — Test Runner (Layers) ───────────────
class TestResult(BaseModel):
    id: str
    name: str
    type: TestType
    priority: Priority
    passed: bool
    duration_ms: int
    retries: int = 0
    error: Optional[str] = None


class RunResults(BaseModel):
    """OUTPUT of the Runner — per-test results + roll-up."""
    issue_number: int
    results: list[TestResult]
    total: int
    passed: int
    failed: int
    pass_rate: float
    total_duration_ms: int
    browsers: list[str] = ["chromium"]


# ─────────────── stage 5 — Reporter Agent ───────────────
class ReportArtifact(BaseModel):
    """OUTPUT of the Reporter — the human-facing summary."""
    issue_number: int
    headline: str
    summary_md: str
    pass_rate: float
    allure_path: str = "allure-report/index.html"
    gate_decision: str = Field(..., description="PASS | FAIL — CI merge gate")
    issue_comment: str = Field(..., description="markdown posted back to the GH issue")
    healed: int = 0          # tests recovered by the Healer before reporting
    self_healing_log: list["HealingAttempt"] = Field(default_factory=list)


# ─────────────── stage 4.5 — Self-Healing Agent ───────────────
class FailureKind(str, Enum):
    LOCATOR = "locator"        # element not found / not visible — healable
    ASSERTION = "assertion"    # logic wrong — NOT healable, this is a real bug
    TIMEOUT = "timeout"        # may be flaky — heal via wait, retry once
    OTHER = "other"


class HealingAttempt(BaseModel):
    """One self-heal cycle on one failing test."""
    test_id: str
    failure_kind: FailureKind
    healable: bool
    old_selector: Optional[str] = None
    new_selector: Optional[str] = None
    rationale: Optional[str] = None        # why Claude chose the new selector
    confidence: float = 0.0                # 0–1, from the Healer
    rerun_passed: Optional[bool] = None    # result after patch + re-run
    file_path: Optional[str] = None        # file that was patched
