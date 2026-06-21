#!/usr/bin/env python3
"""
mcp_framework/run.py — CLI entry point

Usage:
  python -m mcp_framework.run --prd path/to/prd.txt --url https://myapp.com
  python -m mcp_framework.run --prd prd.txt --url file:///path/to/store.html \\
      --name ShopNow --out ./qa-shopnow --workers 2

Environment variables (all optional):
  ANTHROPIC_API_KEY   Required for LLM agents
  GITHUB_TOKEN        GitHub PR creation
  GITHUB_REPO         owner/repo for the PR
  JIRA_URL            Jira base URL
  JIRA_EMAIL          Jira user email
  JIRA_API_TOKEN      Jira API token
  JIRA_PROJECT        Jira project key (default: QA)
  SLACK_WEBHOOK       Incoming webhook URL
"""
from __future__ import annotations
import argparse, os, sys, textwrap, time
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from mcp_framework.config      import MCPConfig
from mcp_framework.contracts   import PRDInput
from mcp_framework.orchestrator import MCPOrchestrator


# ── ANSI colours ──────────────────────────────────────────────────────────────
def _c(code: str, text: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"\033[{code}m{text}\033[0m"

G  = lambda t: _c("32", t)
B  = lambda t: _c("34;1", t)
Y  = lambda t: _c("33", t)
R  = lambda t: _c("31;1", t)
DIM= lambda t: _c("2", t)


# ── stage observer ────────────────────────────────────────────────────────────
def _on_stage(stage: str, artifact: object) -> None:
    ICONS = {
        "analysis":   ("🔍", "PRD Analysis"),
        "plan":       ("📋", "Test Plan"),
        "scaffold":   ("🏗 ", "Scaffold"),
        "execution":  ("▶ ", "Test Execution"),
        "healing":    ("🔧", "Self-Healing"),
        "gitops":     ("🐙", "GitOps"),
        "gitops_error":("⚠ ", "GitOps skipped"),
        "jira":       ("🐛", "Jira"),
        "complete":   ("✅", "Pipeline complete"),
    }
    icon, label = ICONS.get(stage, ("·", stage))

    if stage == "analysis":
        from mcp_framework.contracts import PRDAnalysis
        a: PRDAnalysis = artifact  # type: ignore
        print(f"  {icon} {B(label)}: {a.app_name} · {a.app_type} · "
              f"{len(a.features)} features")

    elif stage == "plan":
        from mcp_framework.contracts import TestPlan
        p: TestPlan = artifact  # type: ignore
        print(f"  {icon} {B(label)}: {p.total_scenarios} scenarios")

    elif stage == "scaffold":
        from mcp_framework.contracts import ScaffoldResult
        s: ScaffoldResult = artifact  # type: ignore
        print(f"  {icon} {B(label)}: {s.test_count} tests · "
              f"{len(s.files_created)} files → {s.output_dir}")

    elif stage == "execution":
        from mcp_framework.contracts import ExecutionResult
        e: ExecutionResult = artifact  # type: ignore
        colour = G if e.pass_rate >= 90 else R
        print(f"  {icon} {B(label)}: "
              f"{colour(f'{e.passed}/{e.total}')} passed "
              f"({colour(f'{e.pass_rate}%')}) "
              f"in {e.duration_s:.1f}s")

    elif stage == "healing":
        from mcp_framework.contracts import ExecutionResult
        e: ExecutionResult = artifact  # type: ignore
        print(f"  {icon} {B(label)}: "
              f"{e.self_healed} healed · "
              f"{e.failed} remaining failures")

    elif stage == "gitops":
        from mcp_framework.contracts import GitOpsResult
        g: GitOpsResult = artifact  # type: ignore
        pr = f" → {g.pr_url}" if g.pr_url else ""
        print(f"  {icon} {B(label)}: {g.branch} [{g.commit_hash}]{pr}")

    elif stage == "gitops_error":
        print(f"  {icon} {Y(label)}: {artifact}")

    elif stage == "jira":
        from mcp_framework.contracts import JiraResult
        j: JiraResult = artifact  # type: ignore
        if j.total_filed:
            keys = ", ".join(b.key or "?" for b in j.bugs_filed if b.key)
            print(f"  {icon} {B(label)}: {j.total_filed} tickets filed "
                  f"{'(' + keys + ')' if keys else ''}")
        else:
            print(f"  {icon} {B(label)}: no bugs to file")

    elif stage == "complete":
        from mcp_framework.contracts import OrchestratorResult
        r: OrchestratorResult = artifact  # type: ignore
        colour = G if r.overall_status == "PASS" else R
        print()
        print(colour(f"  {'─'*54}"))
        print(colour(f"  GATE: {r.overall_status}"))
        print(colour(f"  {'─'*54}"))


# ── CLI ───────────────────────────────────────────────────────────────────────
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m mcp_framework.run",
        description="Autonomous PRD → E2E test pipeline (MCP Orchestrator)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python -m mcp_framework.run --prd prd.txt --url http://localhost:3000
              python -m mcp_framework.run --prd prd.txt --url file:///tmp/store.html \\
                  --name ShopNow --out ./qa-shopnow --workers 2 --headed
        """),
    )
    p.add_argument("--prd",     required=True, help="Path to PRD / requirements file")
    p.add_argument("--url",     required=True, help="URL of the app under test")
    p.add_argument("--name",    default="MyApp", help="Short project name")
    p.add_argument("--out",     default="./qa-generated",
                   help="Output directory for the generated project")
    p.add_argument("--workers", type=int, default=2, help="Playwright worker count")
    p.add_argument("--headed",  action="store_true", help="Run browser in headed mode")
    p.add_argument("--verbose", action="store_true", help="Print Playwright stdout")
    p.add_argument("--no-git",  action="store_true", help="Skip GitOps stage")
    p.add_argument("--no-jira", action="store_true", help="Skip Jira filing")
    p.add_argument("--no-slack",action="store_true", help="Skip Slack notifications")
    return p


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args   = parser.parse_args(argv)

    # ── load PRD ──────────────────────────────────────────────────────────
    prd_path = Path(args.prd).expanduser()
    if not prd_path.exists():
        print(R(f"Error: PRD file not found: {prd_path}"))
        return 1
    prd_text = prd_path.read_text(encoding="utf-8")

    # ── build config ──────────────────────────────────────────────────────
    cfg = MCPConfig(verbose=args.verbose)

    # ── disable integrations if requested ────────────────────────────────
    if args.no_git:
        cfg.github_token = None
        cfg.github_repo  = None
    if args.no_jira:
        cfg.jira_token = None
    if args.no_slack:
        cfg.slack_webhook = None

    if not cfg.anthropic_api_key:
        print(R("Error: ANTHROPIC_API_KEY is not set."))
        return 1

    # ── print header ─────────────────────────────────────────────────────
    print()
    print(B("  ╔═══════════════════════════════════════════╗"))
    print(B("  ║  MCP QA Orchestrator — Autonomous E2E    ║"))
    print(B("  ╚═══════════════════════════════════════════╝"))
    print(f"  App  : {args.url}")
    print(f"  PRD  : {prd_path.name} ({len(prd_text)} chars)")
    print(f"  Out  : {args.out}")
    print(f"  Mode : {cfg.summary()}")
    print()

    # ── run pipeline ─────────────────────────────────────────────────────
    inp = PRDInput(
        prd_text   = prd_text,
        app_url    = args.url,
        app_name   = args.name,
        output_dir = args.out,
        headless   = not args.headed,
        workers    = args.workers,
    )

    t0 = time.time()
    orchestrator = MCPOrchestrator(cfg)
    result = orchestrator.run(inp, on_stage=_on_stage)
    elapsed = time.time() - t0

    print(DIM(f"\n  Total wall time: {elapsed:.1f}s"))
    print()

    return 0 if result.overall_status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
