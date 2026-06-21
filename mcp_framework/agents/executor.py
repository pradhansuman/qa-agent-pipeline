"""
Agent 3 — Executor  (Playwright MCP)
──────────────────────────────────────
Runs `npx playwright test` in the generated project directory, parses the
JSON reporter output, and returns a structured ExecutionResult.
"""
from __future__ import annotations
import json, os, re, subprocess, sys, time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from mcp_framework.contracts import (
    ExecutionResult, TestCaseResult, FailureKind,
)


_TIMEOUT_S = 1200  # 20-minute cap — speedtest.net tests take up to 120s each


class ExecutorAgent:
    NAME = "Executor"

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    # ── public API ────────────────────────────────────────────────────────
    def run(self, output_dir: str) -> ExecutionResult:
        """Install deps then run the full Playwright suite. Returns results."""
        abs_dir = os.path.abspath(output_dir)
        self._ensure_deps(abs_dir)

        json_path = os.path.join(abs_dir, "test-results", "results.json")
        os.makedirs(os.path.dirname(json_path), exist_ok=True)

        cmd = [
            "npx", "playwright", "test",
            "--reporter=json",
            f"--output={os.path.join(abs_dir, 'test-results')}",
        ]
        t0 = time.time()
        proc = subprocess.run(
            cmd, cwd=abs_dir,
            capture_output=True, text=True,
            timeout=_TIMEOUT_S,
        )
        elapsed = time.time() - t0

        if self.verbose:
            print(proc.stdout[-3000:] if len(proc.stdout) > 3000 else proc.stdout)

        results = self._parse(proc.stdout, proc.stderr, json_path)
        results.duration_s = round(elapsed, 2)
        results.raw_output = (proc.stdout + proc.stderr)[-4000:]
        results.html_report_path = os.path.join(abs_dir, "playwright-report", "index.html")
        return results

    # ── private helpers ───────────────────────────────────────────────────
    @staticmethod
    def _ensure_deps(project_dir: str) -> None:
        """Run `npm install` if node_modules doesn't exist yet."""
        nm = os.path.join(project_dir, "node_modules")
        if not os.path.isdir(nm):
            subprocess.run(
                ["npm", "install"], cwd=project_dir,
                capture_output=True, timeout=120,
            )
            subprocess.run(
                ["npx", "playwright", "install", "chromium", "--with-deps"],
                cwd=project_dir, capture_output=True, timeout=180,
            )

    @staticmethod
    def _parse(stdout: str, stderr: str, json_path: str) -> ExecutionResult:
        """Try JSON reporter first, fall back to stdout regex."""
        results: list[TestCaseResult] = []

        try:
            data = json.loads(stdout)
            for suite in data.get("suites", []):
                results.extend(ExecutorAgent._walk_suite(suite))
        except (json.JSONDecodeError, TypeError):
            # fallback: parse list-reporter text
            results = ExecutorAgent._parse_text(stdout + stderr)

        passed  = sum(1 for r in results if r.passed)
        failed  = sum(1 for r in results if not r.passed)
        total   = len(results) or 1
        return ExecutionResult(
            total=total, passed=passed, failed=failed,
            pass_rate=round(passed / total * 100, 1),
            duration_s=0.0,
            results=results,
        )

    @staticmethod
    def _walk_suite(suite: dict) -> list[TestCaseResult]:
        out: list[TestCaseResult] = []
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                err_msg = ""
                passed  = True
                dur     = 0
                for result in test.get("results", []):
                    dur  = result.get("duration", 0)
                    if result.get("status") not in ("passed", "skipped"):
                        passed  = False
                        err_msg = " ".join(
                            e.get("message", "") for e in result.get("errors", [])
                        )[:300]
                out.append(TestCaseResult(
                    name=spec.get("title", "unknown"),
                    file=suite.get("file", ""),
                    passed=passed,
                    duration_ms=dur,
                    error=err_msg or None,
                    failure_kind=ExecutorAgent._classify(err_msg) if err_msg else None,
                ))
        for child in suite.get("suites", []):
            out.extend(ExecutorAgent._walk_suite(child))
        return out

    @staticmethod
    def _parse_text(text: str) -> list[TestCaseResult]:
        """Parse list/dot reporter output as a fallback."""
        results: list[TestCaseResult] = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith(("✓", "✔", "×", "✘", "PASS", "FAIL")):
                passed = line.startswith(("✓", "✔", "PASS"))
                # extract ms timing if present
                m = re.search(r"\((\d+)ms\)", line)
                dur = int(m.group(1)) if m else 0
                name = re.sub(r"^[✓✔×✘]\s+\d+\s+\[.*?\]\s+›\s+", "", line)
                name = re.sub(r"\s+\(\d+ms\).*$", "", name).strip()
                results.append(TestCaseResult(
                    name=name or "test",
                    file="",
                    passed=passed,
                    duration_ms=dur,
                ))
        return results

    @staticmethod
    def _classify(error: str) -> FailureKind:
        low = error.lower()
        if any(k in low for k in ("locator", "selector", "not found",
                                   "not visible", "no element")):
            return FailureKind.SELECTOR
        if "timeout" in low:
            return FailureKind.TIMEOUT
        if any(k in low for k in ("expected", "assert", "to equal",
                                   "to have text", "to be")):
            return FailureKind.ASSERTION
        if any(k in low for k in ("syntaxerror", "import", "cannot find module")):
            return FailureKind.SCRIPT
        return FailureKind.OTHER
