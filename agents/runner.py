"""
agents/runner.py
────────────────
STAGE 4 — Test Layers / Runner.

Executes the generated suite and rolls results up into RunResults. Like the
Ingestor, this stage is deterministic — it shells out to the real Playwright
CLI and parses its JSON reporter. No LLM: test results must be ground truth.

I/O CONTRACT
    in : GeneratedSuite
    out: RunResults

Two modes:
  • real=True  → writes files to a workspace, runs `npx playwright test`,
                 parses results.json (use in CI).
  • real=False → deterministic simulation for local demos / unit tests of the
                 pipeline itself (no Node required).
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from contracts.schemas import (
    GeneratedSuite, RunResults, TestResult, TestType, Priority,
)


class RunnerAgent:
    NAME = "runner"

    def __init__(self, workspace: str = "./.qa-workspace", real: bool = False):
        self.workspace = Path(workspace)
        self.real = real

    # ── write generated files to disk ───────────────────────────
    def _materialise(self, suite: GeneratedSuite) -> None:
        for f in suite.files:
            dest = self.workspace / f.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(f.content, encoding="utf-8")

    # ── real Playwright run ─────────────────────────────────────
    def _run_real(self, suite: GeneratedSuite) -> RunResults:
        self._materialise(suite)
        result = subprocess.run(
            ["npx", "playwright", "test", "--reporter=json"],
            cwd=self.workspace,
            capture_output=True,
            text=True,
            check=False,
        )
        # Playwright JSON reporter writes to stdout — save it to a file
        results_path = self.workspace / "results.json"
        if result.stdout.strip():
            results_path.write_text(result.stdout, encoding="utf-8")
        if not results_path.exists():
            raise RuntimeError(
                f"Playwright produced no output (exit {result.returncode}).\n"
                f"Stderr: {result.stderr[:800]}"
            )
        report = json.loads(results_path.read_text())

        results: list[TestResult] = []
        for spec in report.get("suites", []):
            for case in spec.get("specs", []):
                t = case["tests"][0]
                res = t["results"][0]
                results.append(TestResult(
                    id=case["title"].split(":")[0],
                    name=case["title"],
                    type=TestType.E2E,
                    priority=Priority.P1,
                    passed=res["status"] == "passed",
                    duration_ms=res.get("duration", 0),
                    retries=len(t["results"]) - 1,
                    error=(res.get("error") or {}).get("message"),
                ))
        return self._rollup(suite.issue_number, results)

    # ── deterministic simulation (demo) ─────────────────────────
    def _run_sim(self, suite: GeneratedSuite) -> RunResults:
        results: list[TestResult] = []
        seed = suite.issue_number
        for i, f in enumerate(suite.files):
            for j, tc in enumerate(f.covers or [f"TC-{i+1:03d}"]):
                # deterministic pseudo-result: P0s occasionally retry
                idx = seed + i * 10 + j
                passed = (idx % 7) != 0
                # failed tests get a locator-style error so the Healer has
                # something realistic to repair in the demo
                err = None
                if not passed:
                    err = (
                        "locator('[data-testid=\"submit-btn\"]') resolved to 0 "
                        "elements — waiting for selector timed out"
                    )
                results.append(TestResult(
                    id=tc,
                    name=f"{tc} — {f.path}",
                    type=TestType.E2E if "spec" in f.path else TestType.UNIT,
                    priority=Priority.P0 if j == 0 else Priority.P1,
                    passed=passed,
                    duration_ms=300 + (idx % 5) * 240,
                    retries=1 if (idx % 5 == 0) else 0,
                    error=err,
                ))
        return self._rollup(suite.issue_number, results)

    # ── DOM snapshot provider (for the Self-Healing agent) ──────
    def dom_provider(self, test_id: str) -> str:
        """
        Return the current DOM for a failing test.
          • real mode: read the Playwright trace / page snapshot from the run.
          • sim mode : a canned snapshot where the button's testid has been
            RENAMED from 'submit-btn' to 'login-submit' — i.e. the UI changed,
            which is exactly the scenario self-healing exists for.
        """
        if self.real:
            snap = self.workspace / "snapshots" / f"{test_id}.html"
            if snap.exists():
                return snap.read_text(encoding="utf-8")
        return (
            '<form data-testid="login-form">'
            '<input data-testid="email-input" aria-invalid="true"/>'
            '<input data-testid="password-input" type="password"/>'
            '<span data-testid="email-error" role="alert">Email is required</span>'
            '<button data-testid="login-submit" type="submit">Sign in</button>'
            '</form>'
        )

    # ── roll-up ─────────────────────────────────────────────────
    @staticmethod
    def _rollup(issue_number: int, results: list[TestResult]) -> RunResults:
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        return RunResults(
            issue_number=issue_number,
            results=results,
            total=total,
            passed=passed,
            failed=total - passed,
            pass_rate=round(passed / total * 100, 1) if total else 0.0,
            total_duration_ms=sum(r.duration_ms for r in results),
        )

    def run(self, suite: GeneratedSuite) -> RunResults:
        return self._run_real(suite) if self.real else self._run_sim(suite)
