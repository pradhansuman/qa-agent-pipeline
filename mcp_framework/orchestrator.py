"""
mcp_framework/orchestrator.py
──────────────────────────────
Wires all 7 agents in the pipeline and surfaces each stage result
via an optional `on_stage` callback (same pattern as the existing
orchestrator/pipeline.py in this repo).

Pipeline order:
  [Slack:start] → Analyzer → Scaffolder → Executor → Healer →
  GitOps → Jira → [Slack:result]
  → OrchestratorResult
"""
from __future__ import annotations
import sys, os
from typing import Callable, Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from mcp_framework.config import MCPConfig
from mcp_framework.contracts import (
    PRDInput, PRDAnalysis, TestPlan, ScaffoldResult,
    ExecutionResult, GitOpsResult, JiraResult, OrchestratorResult,
)
from mcp_framework.agents.analyzer   import AnalyzerAgent
from mcp_framework.agents.scaffolder import ScaffolderAgent
from mcp_framework.agents.executor   import ExecutorAgent
from mcp_framework.agents.healer     import HealerAgent
from mcp_framework.agents.gitops     import GitOpsAgent
from mcp_framework.agents.jira       import JiraAgent
from mcp_framework.agents.slack      import SlackAgent

StageCallback = Callable[[str, Any], None]


def _noop(stage: str, artifact: Any) -> None:
    pass


class MCPOrchestrator:
    """
    Usage:
        cfg   = MCPConfig()
        pipe  = MCPOrchestrator(cfg)
        result = pipe.run(prd_input, on_stage=lambda s, a: print(s, a))
    """

    def __init__(self, cfg: MCPConfig | None = None):
        self.cfg = cfg or MCPConfig()

    # ── main entry-point ──────────────────────────────────────────────────
    def run(
        self,
        inp: PRDInput,
        on_stage: StageCallback = _noop,
    ) -> OrchestratorResult:
        cfg = self.cfg

        # ── override headless/workers from input ──────────────────────────
        cfg.headless = inp.headless
        cfg.workers  = inp.workers

        slack    = SlackAgent(cfg)
        analyzer = AnalyzerAgent(cfg.model)
        scaffold = ScaffolderAgent(cfg.model)
        executor = ExecutorAgent(verbose=cfg.verbose)
        healer   = HealerAgent(cfg)
        gitops   = GitOpsAgent(cfg)
        jira     = JiraAgent(cfg)

        # ── STAGE 0: announce ─────────────────────────────────────────────
        slack.notify_start(inp.app_name, inp.app_url)

        # ── STAGE 1: analyze PRD ─────────────────────────────────────────
        analysis = analyzer.analyze(inp)
        on_stage("analysis", analysis)

        plan = analyzer.plan(analysis)
        on_stage("plan", plan)

        # ── STAGE 2: scaffold project on disk ─────────────────────────────
        scaffold_result = scaffold.scaffold(inp, analysis, plan)
        on_stage("scaffold", scaffold_result)

        # ── STAGE 3: execute tests ────────────────────────────────────────
        exec_result = executor.run(scaffold_result.output_dir)
        on_stage("execution", exec_result)

        # ── STAGE 4: self-healing ─────────────────────────────────────────
        if exec_result.failed > 0:
            exec_result = healer.heal(exec_result, scaffold_result.output_dir)
            on_stage("healing", exec_result)

        # ── STAGE 5: git commit + optional PR ────────────────────────────
        gitops_result: GitOpsResult | None = None
        try:
            gitops_result = gitops.run(
                output_dir  = scaffold_result.output_dir,
                app_name    = inp.app_name,
                pass_rate   = exec_result.pass_rate,
                total_tests = exec_result.total,
                prd_ref     = inp.prd_text[:120] + "…",
            )
            on_stage("gitops", gitops_result)
        except Exception as e:
            on_stage("gitops_error", str(e))

        # ── STAGE 6: file Jira tickets for genuine bugs ───────────────────
        jira_result = jira.file_bugs(exec_result, inp.app_name, inp.app_url)
        on_stage("jira", jira_result)

        # ── gate: PASS if pass rate >= 90 % and no P0 failures ───────────
        p0_failures = sum(
            1 for r in exec_result.results
            if not r.passed
        )
        overall = "PASS" if (exec_result.pass_rate >= 90.0 and p0_failures == 0) else "FAIL"

        result = OrchestratorResult(
            app_name       = inp.app_name,
            app_url        = inp.app_url,
            prd_source     = inp.prd_text[:200] + ("…" if len(inp.prd_text) > 200 else ""),
            analysis       = analysis,
            plan           = plan,
            scaffold       = scaffold_result,
            execution      = exec_result,
            gitops         = gitops_result,
            jira           = jira_result,
            slack_sent     = slack.notify_result(
                OrchestratorResult(
                    app_name=inp.app_name,
                    app_url=inp.app_url,
                    prd_source="",
                    analysis=analysis,
                    plan=plan,
                    scaffold=scaffold_result,
                    execution=exec_result,
                    gitops=gitops_result,
                    jira=jira_result,
                    slack_sent=False,
                    overall_status=overall,
                )
            ),
            overall_status = overall,
        )
        on_stage("complete", result)
        return result
