"""
orchestrator/pipeline.py
────────────────────────
Chains the six agents into one pipeline and enforces the hand-off contracts.

    IssueRef
       │  IngestorAgent          (GitHub API, deterministic)
       ▼
    IssuePayload
       │  PlannerAgent           (LLM — what to test)
       ▼
    TestPlan
       │  GeneratorAgent         (LLM — how to test)
       ▼
    GeneratedSuite ──────────────────────────────────────────────┐
       │  ReviewerAgent          (LLM — audit quality, advisory) │
       ▼                                                         │
    ReviewReport                                                 │
       │  RunnerAgent  ◀────────────────────────────────────────┘
       ▼               (GeneratedSuite passes straight through)
    RunResults
       │  HealerAgent            (rule-based triage + LLM selector repair)
       ▼
    RunResults (patched)
       │  ReporterAgent          (LLM narrative + rule-based gate)
       ▼
    ReportArtifact

Each arrow is a Pydantic model. If any stage emits something off-contract,
validation raises *there* — you always know which agent broke.

The Reviewer is advisory. Its verdict does NOT gate the pipeline — that
authority stays with ReporterAgent._gate(), which operates on real results.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from anthropic import Anthropic

from contracts.schemas import (
    IssueRef, IssuePayload, TestPlan, GeneratedSuite, RunResults, ReportArtifact,
    HealingAttempt, ReviewReport, SDETTestPlan,
)
from agents.ingestor import IngestorAgent
from agents.planner import PlannerAgent
from agents.sdet import SDETAgent
from agents.generator import GeneratorAgent
from agents.reviewer import ReviewerAgent
from agents.runner import RunnerAgent
from agents.healer import HealerAgent
from agents.reporter import ReporterAgent


@dataclass
class PipelineTrace:
    """Every intermediate artifact, kept for audit / debugging / CI logs."""
    payload:    IssuePayload
    plan:       TestPlan           # always present (may be downcast from sdet_plan)
    sdet_plan:  Optional[SDETTestPlan]  # present only when --sdet was used
    suite:      GeneratedSuite
    review:     Optional[ReviewReport]
    results:    RunResults
    report:     ReportArtifact
    healing_log: list[HealingAttempt] = field(default_factory=list)


class QAPipeline:
    def __init__(self, real_run: bool = False, client: Anthropic | None = None,
                 self_heal: bool = True, review: bool = True, sdet: bool = False,
                 demo: bool = False, offline: bool = False):
        # in demo mode we don't need a real key — use a dummy client so the
        # SDK constructs, then stubs replace every call before it's used.
        if client is None:
            if demo:
                client = Anthropic(api_key="demo-no-key-needed")
            else:
                client = Anthropic()
        self.ingestor   = IngestorAgent()
        self.planner    = PlannerAgent(client=client)
        self.sdet_agent = SDETAgent(client=client) if sdet else None
        self.generator  = GeneratorAgent(client=client)
        self.reviewer   = ReviewerAgent(client=client) if review else None
        self.runner     = RunnerAgent(real=real_run)
        self.healer     = HealerAgent(client=client) if self_heal else None
        self.reporter   = ReporterAgent(client=client)

        if demo:
            from agents.demo_stubs import install_demo_stubs
            install_demo_stubs(self, offline=offline)

    def run(self, ref: IssueRef, on_stage=None) -> PipelineTrace:
        def emit(stage: str, artifact):
            if on_stage:
                on_stage(stage, artifact)

        payload = self.ingestor.run(ref);        emit("ingested",  payload)

        # ── planning stage: SDET agent (formal techniques) or standard Planner ──
        sdet_plan: Optional[SDETTestPlan] = None
        if self.sdet_agent:
            sdet_plan = self.sdet_agent.run(payload)
            plan      = sdet_plan.to_test_plan()   # downcast for Generator compat
            emit("sdet",    sdet_plan)
            emit("planned", plan)
        else:
            plan = self.planner.run(payload);      emit("planned",  plan)

        suite = self.generator.run(plan);          emit("generated", suite)

        # ── quality review (uses richer sdet_plan when available) ──
        review: Optional[ReviewReport] = None
        if self.reviewer:
            review_plan = sdet_plan.to_test_plan() if sdet_plan else plan
            review = self.reviewer.run(review_plan, suite)
            emit("reviewed", review)

        results = self.runner.run(suite);          emit("tested",   results)

        healing_log: list[HealingAttempt] = []
        if self.healer and results.failed:
            results, healing_log = self.healer.run(
                results, suite, self.runner.dom_provider
            )
            emit("healed", healing_log)

        report = self.reporter.run(results)
        report.healed = sum(1 for h in healing_log if h.rerun_passed)
        report.self_healing_log = healing_log
        emit("reported", report)

        return PipelineTrace(
            payload, plan, sdet_plan, suite, review, results, report, healing_log
        )


# ── CLI entry point ─────────────────────────────────────────────
if __name__ == "__main__":
    import argparse, sys

    ap = argparse.ArgumentParser(description="AI-Assisted QA pipeline")
    ap.add_argument("repo", nargs="?", default="demo/frontend-app",
                    help="owner/name, e.g. mui/material-ui (optional in --demo)")
    ap.add_argument("issue", nargs="?", type=int, default=1042,
                    help="issue number (optional in --demo)")
    ap.add_argument("--token", help="GitHub PAT (optional)")
    ap.add_argument("--real", action="store_true", help="run real Playwright")
    ap.add_argument("--demo", action="store_true",
                    help="offline demo — canned LLM responses, no API key/credit needed")
    ap.add_argument("--offline", action="store_true",
                    help="with --demo, also stub the GitHub issue (fully offline)")
    ap.add_argument("--no-review", action="store_true",
                    help="skip the ReviewerAgent quality audit (saves one LLM call)")
    ap.add_argument("--sdet", action="store_true",
                    help="use SDETAgent (formal test-design techniques) instead of Planner")
    args = ap.parse_args()

    def log(stage, art):
        print(f"  [{stage:>9}] ok", file=sys.stderr)

    ref = IssueRef(repo=args.repo, issue_number=args.issue, github_token=args.token)
    trace = QAPipeline(
        real_run=args.real, demo=args.demo, offline=args.offline,
        review=not args.no_review, sdet=args.sdet,
    ).run(ref, on_stage=log)

    print(f"\nIssue #{trace.payload.issue_number}: {trace.payload.title}")
    if trace.sdet_plan:
        sp = trace.sdet_plan
        p0s  = sum(1 for t in sp.test_cases if t.priority == "P0")
        techniques = sorted({t.technique for t in sp.test_cases})
        types_used = sorted({t.type for t in sp.test_cases})
        print(f"SDET: {len(sp.test_cases)} cases  P0={p0s}  "
              f"techniques=[{', '.join(techniques)}]")
        print(f"      types=[{', '.join(types_used)}]  gaps={len(sp.coverage_gaps)}")
        if sp.coverage_gaps:
            for g in sp.coverage_gaps:
                print(f"      GAP {g.requirement_ref}: {g.reason}")
    else:
        print(f"Plan: {len(trace.plan.scenarios)} scenarios, risk={trace.plan.risk_level.value}")

    if trace.review:
        rv = trace.review
        scores = rv.scores
        print(f"Review: verdict={rv.verdict}  weighted={rv.weighted_total}/5.0")
        print(f"  Scores  cov={scores.coverage} corr={scores.correctness} "
              f"edge={scores.edge_negative} atom={scores.atomicity} "
              f"repr={scores.reproducibility} trace={scores.traceability} "
              f"redu={scores.non_redundancy} prio={scores.prioritization}")
        if rv.critical_gaps:
            print(f"  Gaps:   " + " | ".join(rv.critical_gaps[:3]))
        if rv.redundant_cases:
            print(f"  Redund: " + ", ".join(rv.redundant_cases))
        if rv.top_3_fixes:
            for i, fix in enumerate(rv.top_3_fixes, 1):
                print(f"  Fix {i}: {fix}")

    print(f"Run:  {trace.results.passed}/{trace.results.total} passed "
          f"({trace.results.pass_rate}%)")
    if trace.healing_log:
        healed = sum(1 for h in trace.healing_log if h.rerun_passed)
        print(f"Heal: {healed} recovered by self-healing agent")
        for h in trace.healing_log:
            if h.rerun_passed:
                print(f"        {h.test_id}: {h.old_selector} -> {h.new_selector} "
                      f"(conf {h.confidence})")
    print(f"Gate: {trace.report.gate_decision}")
    print(f"\n{trace.report.headline}\n")
    print(trace.report.issue_comment)
