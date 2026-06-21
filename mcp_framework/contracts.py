"""
mcp_framework/contracts.py
──────────────────────────
Single source of truth for every data contract in the MCP pipeline.

Flow:
  PRDInput
    → [Analyzer]   → PRDAnalysis
    → [Scaffolder] → ScaffoldResult
    → [Executor]   → ExecutionResult
    → [Healer]     → ExecutionResult (patched)
    → [GitOps]     → GitOpsResult
    → [Jira]       → JiraResult
    → [Slack]      → (broadcast)
    → OrchestratorResult
"""
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── enums ──────────────────────────────────────────────────────────────────
class Severity(str, Enum):
    P0 = "P0"   # Critical — blocks release
    P1 = "P1"   # High
    P2 = "P2"   # Medium
    P3 = "P3"   # Low


class FailureKind(str, Enum):
    SELECTOR  = "selector"    # element not found / selector stale — healable
    ASSERTION = "assertion"   # wrong value — genuine bug, never healed
    TIMEOUT   = "timeout"     # potential flake
    SCRIPT    = "script"      # syntax / import error — healable
    OTHER     = "other"


# ── stage 0 — user input ───────────────────────────────────────────────────
class PRDInput(BaseModel):
    """Raw input passed by the user or CLI."""
    prd_text: str = Field(..., description="Full PRD / user-story / requirements text")
    app_url: str  = Field(..., description="URL or file:// path of the app under test")
    app_name: str = Field("MyApp", description="Short project name used in file paths")
    output_dir: str = Field("./qa-generated", description="Where to write the generated project")
    headless: bool = True
    workers: int = 2


# ── stage 1 — PRD analysis ─────────────────────────────────────────────────
class AppFeature(BaseModel):
    name: str                              # e.g. "Product Catalog"
    description: str
    selectors: list[str] = Field(default_factory=list,
        description="CSS/id selectors or descriptive hints for Playwright")
    user_actions: list[str] = Field(default_factory=list,
        description="click, fill, select, navigate …")
    acceptance_criteria: list[str] = Field(default_factory=list)


class PRDAnalysis(BaseModel):
    """OUTPUT of the Analyzer agent."""
    app_name: str
    app_url: str
    app_type: str                          # e2e-web | spa | e-commerce | saas …
    features: list[AppFeature]
    tech_stack: list[str] = Field(default_factory=list)
    test_coverage_recommendation: str = ""
    notes: str = ""


# ── stage 2 — test plan ────────────────────────────────────────────────────
class TestScenario(BaseModel):
    id: str                                # TC-001
    feature: str
    title: str
    priority: Severity
    preconditions: list[str] = Field(default_factory=list)
    steps: list[str]
    expected_outcome: str
    selectors_needed: list[str] = Field(default_factory=list)


class TestPlan(BaseModel):
    """OUTPUT of the Planner agent."""
    app_name: str
    total_scenarios: int
    scenarios: list[TestScenario]
    coverage_summary: str


# ── stage 3 — scaffolding ──────────────────────────────────────────────────
class GeneratedFile(BaseModel):
    path: str                              # relative to output_dir
    content: str
    kind: str = "spec"                     # spec | pom | config | util | fixture


class ScaffoldResult(BaseModel):
    """OUTPUT of the Scaffolder agent."""
    output_dir: str
    files_created: list[str]
    test_count: int
    spec_files: list[str] = Field(default_factory=list)


# ── stage 4 — test execution ───────────────────────────────────────────────
class TestCaseResult(BaseModel):
    name: str
    file: str
    passed: bool
    duration_ms: int
    error: Optional[str] = None
    failure_kind: Optional[FailureKind] = None


class ExecutionResult(BaseModel):
    """OUTPUT of the Executor / Healer agents."""
    total: int
    passed: int
    failed: int
    pass_rate: float
    duration_s: float
    results: list[TestCaseResult]
    html_report_path: str = ""
    raw_output: str = ""
    self_healed: int = 0
    heal_log: list[HealAttempt] = Field(default_factory=list)


# ── stage 4.5 — self-healing ───────────────────────────────────────────────
class HealAttempt(BaseModel):
    test_name: str
    failure_kind: FailureKind
    healable: bool
    original_error: str = ""
    patched_code: str = ""
    rationale: str = ""
    confidence: float = 0.0               # 0–1
    rerun_passed: Optional[bool] = None


# forward-ref fix
ExecutionResult.model_rebuild()


# ── stage 5 — git ops ─────────────────────────────────────────────────────
class GitOpsResult(BaseModel):
    """OUTPUT of the GitOps agent."""
    branch: str
    commit_hash: str
    commit_message: str
    pr_url: Optional[str] = None
    pushed: bool = False
    error: Optional[str] = None


# ── stage 6 — jira ────────────────────────────────────────────────────────
class JiraBug(BaseModel):
    summary: str
    severity: Severity
    steps: list[str]
    expected: str
    actual: str
    test_name: str
    key: Optional[str] = None             # PROJ-123 once filed


class JiraResult(BaseModel):
    """OUTPUT of the Jira agent."""
    bugs_filed: list[JiraBug]
    total_filed: int
    jira_base_url: Optional[str] = None
    error: Optional[str] = None


# ── final orchestrator output ──────────────────────────────────────────────
class OrchestratorResult(BaseModel):
    app_name: str
    app_url: str
    prd_source: str
    analysis: PRDAnalysis
    plan: TestPlan
    scaffold: ScaffoldResult
    execution: ExecutionResult
    gitops: Optional[GitOpsResult] = None
    jira: Optional[JiraResult]   = None
    slack_sent: bool = False
    overall_status: str                   # PASS | FAIL
