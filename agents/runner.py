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
import os
import re
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
        self.workspace.mkdir(parents=True, exist_ok=True)
        for f in suite.files:
            if "playwright.config" in f.path:
                continue
            dest = self.workspace / f.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(f.content, encoding="utf-8")
            # Print first spec so we can see selectors + navigation in CI output
            if dest.suffix == ".ts" and "spec" in dest.name:
                print(f"[runner] spec ({f.path}):\n{f.content[:1000]}\n---")

    # ── patch spec files: fix goto URLs and allure imports ──────────────────────
    def _fix_goto_urls(self, target_url: str) -> None:
        for spec in self.workspace.rglob("*.spec.ts"):
            content = spec.read_text(encoding="utf-8")
            original = content

            # Fix relative page.goto() calls
            content = re.sub(
                r"""page\.goto\(\s*['"](?:/\.?/?|\./?|)['"]""",
                f"page.goto('{target_url}'",
                content,
            )

            # Normalise common testid variations the LLM uses inconsistently
            testid_aliases = {
                "cart-btn":       "cart-button",
                "cart-icon":      "cart-button",
                "cart-toggle":    "cart-button",
                "open-cart":      "cart-button",
                "cart-sidebar-total": "cart-total",
                "sidebar-total":  "cart-total",
                "total-price":    "cart-total",
                "add-to-cart-btn": "add-to-cart",
                "add-cart":       "add-to-cart",
            }
            for wrong, right in testid_aliases.items():
                content = content.replace(f'data-testid="{wrong}"', f'data-testid="{right}"')
                content = content.replace(f"data-testid='{wrong}'", f"data-testid='{right}'")
                content = content.replace(f'[data-testid="{wrong}"]', f'[data-testid="{right}"]')
                content = content.replace(f"[data-testid='{wrong}']", f"[data-testid='{right}']")
                content = content.replace(f'getByTestId("{wrong}")', f'getByTestId("{right}")')
                content = content.replace(f"getByTestId('{wrong}')", f"getByTestId('{right}')")

            # Fix allure import — must be named import { allure }, not namespace import
            content = re.sub(
                r"import\s+\*\s+as\s+allure\s+from\s+['\"]allure-(?:js-commons|playwright)['\"]",
                "import { allure } from 'allure-playwright'",
                content,
            )
            # Also fix plain allure-js-commons named imports
            content = content.replace(
                "from 'allure-js-commons'", "from 'allure-playwright'",
            ).replace(
                'from "allure-js-commons"', 'from "allure-playwright"',
            )

            if content != original:
                print(f"[runner] patched {spec.name}")
                spec.write_text(content, encoding="utf-8")

    # ── real Playwright run ─────────────────────────────────────
    def _run_real(self, suite: GeneratedSuite) -> RunResults:
        self._materialise(suite)

        # Run from project root (where node_modules lives) — avoids all symlink issues
        project_root = Path.cwd()
        test_dir     = (self.workspace / "tests").resolve()
        results_path = (self.workspace / "results.json").resolve()
        target_url   = os.environ.get("QA_TARGET_URL", "https://demoqa.com")
        self._fix_goto_urls(target_url)

        # Write a temp config at project root so Playwright resolves @playwright/test
        tmp_cfg = project_root / "pw-qa-runner.config.ts"
        tmp_cfg.write_text(
            f"""import {{ defineConfig }} from '@playwright/test';
export default defineConfig({{
  testDir: '{test_dir}',
  timeout: 30_000,
  retries: 1,
  use: {{ headless: true, baseURL: '{target_url}' }},
  reporter: [['json', {{ outputFile: '{results_path}' }}]],
}});
""",
            encoding="utf-8",
        )

        try:
            # Pre-flight: list discovered tests
            list_result = subprocess.run(
                ["npx", "playwright", "test", "--config", str(tmp_cfg), "--list"],
                cwd=project_root, capture_output=True, text=True, check=False,
            )
            print(f"[runner] discovered tests:\n{list_result.stdout[:600] or '(none)'}")
            if list_result.stderr.strip():
                print(f"[runner] discovery stderr:\n{list_result.stderr[:400]}")

            # Run tests
            result = subprocess.run(
                ["npx", "playwright", "test", "--config", str(tmp_cfg)],
                cwd=project_root, capture_output=True, text=True, check=False,
            )
            print(f"[runner] exit={result.returncode}")
            if result.stderr.strip():
                print(f"[runner] stderr:\n{result.stderr[:600]}")
        finally:
            tmp_cfg.unlink(missing_ok=True)

        if not results_path.exists():
            raise RuntimeError(
                f"Playwright produced no results.json (exit {result.returncode}).\n"
                f"stdout: {result.stdout[:400]}\nstderr: {result.stderr[:800]}"
            )
        report = json.loads(results_path.read_text())

        # Playwright nests specs inside describe() blocks as sub-suites — traverse recursively
        def collect_specs(node: dict) -> list[dict]:
            specs = list(node.get("specs", []))
            for child in node.get("suites", []):
                specs.extend(collect_specs(child))
            return specs

        results: list[TestResult] = []
        for top_suite in report.get("suites", []):
            for case in collect_specs(top_suite):
                if not case.get("tests"):
                    continue
                t   = case["tests"][0]
                res = t["results"][0] if t.get("results") else {}
                results.append(TestResult(
                    id=case["title"].split(":")[0].strip(),
                    name=case["title"],
                    type=TestType.E2E,
                    priority=Priority.P1,
                    passed=res.get("status") == "passed",
                    duration_ms=res.get("duration", 0),
                    retries=len(t.get("results", [])) - 1,
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
