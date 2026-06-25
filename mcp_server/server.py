"""
mcp_server/server.py
─────────────────────
A real Model Context Protocol (MCP) server that exposes the QA pipeline as
callable tools. Any MCP-compatible host (Claude desktop app, VS Code Copilot,
custom LLM agents) can invoke these tools via natural language.

Transport: stdio (stdin/stdout JSON-RPC). No network port, no auth headers.
The host launches this process and communicates over pipes.

Registration (Claude desktop — claude_desktop_config.json):
  {
    "mcpServers": {
      "qa-pipeline": {
        "command": "python",
        "args": ["/path/to/QA_AGents/mcp_server/server.py"],
        "env": { "OPENROUTER_API_KEY": "sk-or-v1-..." }
      }
    }
  }

Tools exposed:
  run_pipeline          — run the full AI QA pipeline against a GitHub issue
  run_playwright_tests  — execute Playwright tests and return results summary
  prioritize_tests      — compute --grep pattern from a git diff
  explain_failure       — classify a Playwright error string + get rationale
  list_test_suites      — enumerate available test spec files
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

# Ensure the repo root is on sys.path so we can import our agents
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

app = Server("qa-pipeline")

# ─── Tool: run_pipeline ────────────────────────────────────────────────────────
@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="run_pipeline",
            description=(
                "Run the full AI-assisted QA pipeline against a GitHub issue. "
                "Ingests the issue, plans test scenarios, generates Playwright "
                "TypeScript, executes tests, self-heals locator failures, and "
                "returns a structured report with gate decision (pass/fail)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "repo": {
                        "type": "string",
                        "description": "GitHub repo in owner/name format, e.g. 'mui/material-ui'",
                    },
                    "issue_number": {
                        "type": "integer",
                        "description": "GitHub issue number to test against",
                    },
                    "demo": {
                        "type": "boolean",
                        "description": "Use canned demo responses (no API credit, no GitHub API)",
                        "default": False,
                    },
                    "offline": {
                        "type": "boolean",
                        "description": "With demo=true, also stub the GitHub issue (fully offline)",
                        "default": False,
                    },
                    "sdet": {
                        "type": "boolean",
                        "description": "Use formal SDET test-design techniques (EP, BVA, pairwise)",
                        "default": False,
                    },
                },
                "required": ["repo", "issue_number"],
            },
        ),
        types.Tool(
            name="run_playwright_tests",
            description=(
                "Execute one or more Playwright test spec files against the math hub "
                "and return a JSON summary: pass count, fail count, pass rate, "
                "and the first 10 failure messages."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "suite": {
                        "type": "string",
                        "enum": ["golden", "api", "perf", "security", "loop", "visual", "all"],
                        "description": "Which test suite to run",
                        "default": "golden",
                    },
                    "browser": {
                        "type": "string",
                        "enum": ["Desktop Chrome", "Mobile Chrome", "all"],
                        "description": "Which browser project(s) to run",
                        "default": "Desktop Chrome",
                    },
                    "grep": {
                        "type": "string",
                        "description": "Optional --grep filter (regex) to run only matching tests",
                    },
                },
                "required": [],
            },
        ),
        types.Tool(
            name="prioritize_tests",
            description=(
                "Analyse a git diff and return the minimal Playwright --grep pattern "
                "that covers all tests at risk from the changed files. Reduces CI "
                "runtime from ~8 min to < 2 min for minor changes."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "base": {
                        "type": "string",
                        "description": "Git ref to diff against (default: HEAD~1)",
                        "default": "HEAD~1",
                    },
                    "full": {
                        "type": "boolean",
                        "description": "If true, always return empty pattern (run all tests)",
                        "default": False,
                    },
                },
                "required": [],
            },
        ),
        types.Tool(
            name="explain_failure",
            description=(
                "Classify a Playwright test failure message and return the failure "
                "category (locator | assertion | environment | flaky | timeout | other) "
                "with an actionable rationale explaining what to do next."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "error": {
                        "type": "string",
                        "description": "The full Playwright error message / stack trace",
                    },
                    "retries": {
                        "type": "integer",
                        "description": "Number of Playwright retries attempted (0 if first run failed)",
                        "default": 0,
                    },
                    "passed": {
                        "type": "boolean",
                        "description": "Whether the test ultimately passed (true if it passed on retry)",
                        "default": False,
                    },
                },
                "required": ["error"],
            },
        ),
        types.Tool(
            name="list_test_suites",
            description="List all available Playwright test spec files with their test counts.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name == "run_pipeline":
        return await _run_pipeline(arguments)
    elif name == "run_playwright_tests":
        return await _run_playwright_tests(arguments)
    elif name == "prioritize_tests":
        return await _prioritize_tests(arguments)
    elif name == "explain_failure":
        return await _explain_failure(arguments)
    elif name == "list_test_suites":
        return await _list_test_suites(arguments)
    else:
        return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


# ─── Tool implementations ──────────────────────────────────────────────────────

async def _run_pipeline(args: dict) -> list[types.TextContent]:
    repo         = args["repo"]
    issue_number = int(args["issue_number"])
    demo         = bool(args.get("demo", False))
    offline      = bool(args.get("offline", False))
    sdet         = bool(args.get("sdet", False))

    try:
        from contracts.schemas import IssueRef
        from orchestrator.pipeline import QAPipeline

        ref   = IssueRef(repo=repo, issue_number=issue_number)
        trace = QAPipeline(demo=demo, offline=offline, sdet=sdet).run(ref)

        summary = {
            "issue":     f"#{trace.payload.issue_number}: {trace.payload.title}",
            "gate":      trace.report.gate_decision,
            "pass_rate": f"{trace.results.pass_rate}%",
            "passed":    trace.results.passed,
            "failed":    trace.results.failed,
            "total":     trace.results.total,
            "healed":    sum(1 for h in trace.healing_log if h.rerun_passed),
            "generation_passes": trace.generation_passes,
            "verdict":   trace.review.verdict if trace.review else "no-review",
            "weighted_score": trace.review.weighted_total if trace.review else None,
            "headline":  trace.report.headline,
        }
        if trace.report.gate_decision == "FAIL":
            summary["failures"] = [
                {"id": r.id, "error": (r.error or "")[:200]}
                for r in trace.results.results if not r.passed
            ][:10]

        return [types.TextContent(type="text", text=json.dumps(summary, indent=2))]

    except Exception as exc:
        return [types.TextContent(type="text", text=f"Pipeline error: {exc}")]


async def _run_playwright_tests(args: dict) -> list[types.TextContent]:
    suite   = args.get("suite", "golden")
    browser = args.get("browser", "Desktop Chrome")
    grep    = args.get("grep", "")

    suite_map = {
        "golden":   "tests/e2e/math-hub.spec.golden.ts",
        "api":      "tests/e2e/math-hub-api.spec.ts",
        "perf":     "tests/e2e/math-hub-perf.spec.ts",
        "security": "tests/e2e/math-hub-security.spec.ts",
        "loop":     "tests/e2e/math-hub-loop.spec.ts",
        "visual":   "tests/e2e/math-hub-visual.spec.ts",
        "all":      "tests/e2e/",
    }
    spec_path = suite_map.get(suite, suite_map["golden"])

    cmd = [
        "npx", "playwright", "test",
        "--config", str(_REPO_ROOT / "playwright.math-hub.config.ts"),
        "--reporter", "json",
        spec_path,
    ]
    if browser != "all":
        cmd += ["--project", browser]
    if grep:
        cmd += ["--grep", grep]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(_REPO_ROOT),
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        raw = stdout.decode()

        # Parse JSON reporter output
        try:
            data   = json.loads(raw)
            passed = data.get("stats", {}).get("expected", 0)
            failed = data.get("stats", {}).get("unexpected", 0)
            total  = passed + failed
            rate   = round(passed / total * 100, 1) if total else 0.0
            failures = [
                {"title": s.get("title",""), "error": s.get("errors", [{}])[0].get("message","")[:200]}
                for suite_data in data.get("suites", [])
                for s in suite_data.get("specs", [])
                if not s.get("ok", True)
            ][:10]
            result = {
                "suite": suite, "browser": browser,
                "passed": passed, "failed": failed,
                "total": total, "pass_rate": f"{rate}%",
                "failures": failures,
            }
        except json.JSONDecodeError:
            # Fallback: count lines
            result = {"suite": suite, "raw_output": raw[-2000:], "stderr": stderr.decode()[-500:]}

        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    except asyncio.TimeoutError:
        return [types.TextContent(type="text", text="Playwright run timed out after 5 minutes.")]
    except Exception as exc:
        return [types.TextContent(type="text", text=f"Error running Playwright: {exc}")]


async def _prioritize_tests(args: dict) -> list[types.TextContent]:
    base = args.get("base", "HEAD~1")
    full = bool(args.get("full", False))

    script = str(_REPO_ROOT / "scripts" / "prioritize_tests.py")
    cmd    = [sys.executable, script, "--base", base, "--json"]
    if full:
        cmd.append("--full")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(_REPO_ROOT),
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        raw = stdout.decode().strip()
        if raw:
            return [types.TextContent(type="text", text=raw)]
        return [types.TextContent(type="text", text='{"grep_pattern": "", "note": "No changed files or full suite requested"}')]
    except Exception as exc:
        return [types.TextContent(type="text", text=f"prioritize_tests error: {exc}")]


async def _explain_failure(args: dict) -> list[types.TextContent]:
    from agents.healer import classify_failure, classify_flaky

    error   = args.get("error", "")
    retries = int(args.get("retries", 0))
    passed  = bool(args.get("passed", False))

    kind = classify_failure(error)
    is_flaky = classify_flaky(passed, retries)

    rationale_map = {
        "assertion":   "Real application bug — a test assertion failed. Inspect the expected vs. received values. Do NOT heal this; it represents a regression.",
        "environment": "Infrastructure failure — browser crash, network reset, or Docker OOM. Re-run the pipeline. If it persists, check CI resource limits and network connectivity.",
        "locator":     "Selector drift — the DOM changed and the selector no longer matches. The Self-Healing Agent will attempt to repair this automatically. Check if a data-testid was renamed.",
        "flaky":       "Flaky test — it failed on the first attempt but passed on retry. The test is timing-sensitive. Consider quarantining it and investigating root cause (race condition, animation timing).",
        "timeout":     "Wait exhaustion — a page/element took longer than the configured timeout. Consider increasing the timeout, or investigate whether the app is slower than expected under load.",
        "other":       "Unclassified failure. Inspect the full error log. Common causes: missing import, test setup error, or a configuration problem.",
    }

    result = {
        "failure_kind": "flaky" if is_flaky else kind.value,
        "is_flaky": is_flaky,
        "healable": kind.value == "locator" and not is_flaky,
        "rationale": rationale_map.get("flaky" if is_flaky else kind.value, "Unknown"),
        "next_action": (
            "Quarantine test, investigate timing issue"
            if is_flaky else {
                "assertion":   "Fix the application code or update the expected value in the test",
                "environment": "Re-run CI pipeline; check Docker resources and network",
                "locator":     "Self-Healing Agent will auto-repair; verify new selector",
                "timeout":     "Increase test timeout or investigate page performance",
                "other":       "Review full stack trace in Playwright report",
            }.get(kind.value, "Review error log")
        ),
    }
    return [types.TextContent(type="text", text=json.dumps(result, indent=2))]


async def _list_test_suites(args: dict) -> list[types.TextContent]:
    specs_dir = _REPO_ROOT / "tests" / "e2e"
    suites = []
    for spec in sorted(specs_dir.glob("math-hub*.spec.ts")):
        content = spec.read_text()
        test_count = content.count("test(") + content.count("test.only(")
        suites.append({
            "file": str(spec.relative_to(_REPO_ROOT)),
            "test_count": test_count,
        })

    # Add k6
    k6 = _REPO_ROOT / "tests" / "load" / "math-hub.k6.js"
    if k6.exists():
        suites.append({
            "file": "tests/load/math-hub.k6.js",
            "test_count": None,
            "note": "k6 load test — run with: k6 run tests/load/math-hub.k6.js [--env SCENARIO=spike]",
        })

    return [types.TextContent(type="text", text=json.dumps(suites, indent=2))]


# ─── Entrypoint ────────────────────────────────────────────────────────────────
async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
