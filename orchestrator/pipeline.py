"""
orchestrator/pipeline.py
────────────────────────
Chains the seven agents into one pipeline and enforces the hand-off contracts.

    IssueRef
       │  IngestorAgent           (GitHub API, deterministic — no LLM)
       ▼
    IssuePayload
       │  StrategistAgent         (LLM — risk assessment + AC mapping → TestPlan)
       │  ─── OR ───
       │  TestDesignerAgent       (LLM — formal-technique derivation → SDETTestPlan)
       │                                └─ .to_test_plan() ──────────────────────┐
       ▼                                                                          │
    TestPlan ◀───────────────────────────────────────────────────────────────────┘
       │  GeneratorAgent          (LLM — Playwright TypeScript)
       ▼
    GeneratedSuite ──────────────────────────────────────────────┐
       │  ReviewerAgent           (LLM — quality audit, advisory)│
       ▼                                                         │
    ReviewReport                                                 │
       │  RunnerAgent  ◀────────────────────────────────────────┘
       ▼               (GeneratedSuite passes straight through)
    RunResults
       │  HealerAgent             (rule-based triage + LLM selector repair)
       ▼
    RunResults (patched)
       │  ReporterAgent           (LLM narrative + rule-based gate)
       ▼
    ReportArtifact

Each arrow is a Pydantic model. If any stage emits something off-contract,
validation raises *there* — you always know which agent broke.

The Reviewer is advisory. Its verdict does NOT gate the pipeline — that
authority stays in ReporterAgent._gate(), which is pure rule-based code.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from openai import OpenAI

from contracts.schemas import (
    IssueRef, IssuePayload, TestPlan, GeneratedSuite, RunResults, ReportArtifact,
    HealingAttempt, ReviewReport, SDETTestPlan,
)
from agents.ingestor import IngestorAgent
from agents.strategist import StrategistAgent
from agents.designer import TestDesignerAgent
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
    generation_passes: int = 1      # 1 = first pass only; 2 = reviewer triggered revision


class QAPipeline:
    def __init__(self, real_run: bool = False, client: OpenAI | None = None,
                 self_heal: bool = True, review: bool = True, sdet: bool = False,
                 demo: bool = False, offline: bool = False):
        # in demo mode we don't need a real key — use a dummy client so the
        # SDK constructs, then stubs replace every call before it's used.
        if client is None:
            _key = "demo-no-key-needed" if demo else os.environ.get("OPENROUTER_API_KEY", "")
            client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=_key)
        self.ingestor   = IngestorAgent()
        self.strategist = StrategistAgent(client=client)
        self.designer   = TestDesignerAgent(client=client) if sdet else None
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
        if self.designer:
            sdet_plan = self.designer.run(payload)
            plan      = sdet_plan.to_test_plan()   # downcast for Generator compat
            emit("designed", sdet_plan)
            emit("planned",  plan)
        else:
            plan = self.strategist.run(payload);   emit("planned",  plan)

        suite = self.generator.run(plan);          emit("generated", suite)

        # ── quality review → iterative refinement (max 1 revision pass) ──
        review: Optional[ReviewReport] = None
        generation_passes = 1
        if self.reviewer:
            review_plan = sdet_plan.to_test_plan() if sdet_plan else plan
            review = self.reviewer.run(review_plan, suite)
            emit("reviewed", review)

            # If the reviewer flags gaps, give the generator one refinement pass.
            # The verdict never gates execution — that authority stays in ReporterAgent.
            if review.verdict in ("revise", "reject") and review.top_3_fixes:
                suite = self.generator.run(plan, reviewer_feedback=review.top_3_fixes)
                generation_passes = 2
                emit("generated", suite)   # emit revised suite so on_stage sees it
                review = self.reviewer.run(review_plan, suite)
                emit("reviewed", review)   # emit revised review for audit trail

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
            payload, plan, sdet_plan, suite, review, results, report,
            healing_log, generation_passes,
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
                    help="use TestDesignerAgent (formal test-design techniques) instead of StrategistAgent")
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
        p0s       = sum(1 for t in sp.test_cases if t.priority == "P0")
        techniques = sorted({t.technique for t in sp.test_cases})
        types_used = sorted({t.type      for t in sp.test_cases})
        print(f"Designer : {len(sp.test_cases)} cases  P0={p0s}  gaps={len(sp.coverage_gaps)}")
        print(f"           techniques: {', '.join(techniques)}")
        print(f"           types     : {', '.join(types_used)}")
        if sp.coverage_gaps:
            for g in sp.coverage_gaps:
                print(f"           GAP {g.requirement_ref}: {g.reason}")
    else:
        plan = trace.plan
        pos = sum(1 for s in plan.scenarios if s.coverage_type == "happy")
        neg = sum(1 for s in plan.scenarios
                  if s.coverage_type in ("negative", "boundary", "security"))
        print(f"Strategist: {len(plan.scenarios)} scenarios  "
              f"positive={pos}  negative/boundary/security={neg}  "
              f"risk={plan.risk_level.value}")
        if plan.test_approach:
            print(f"            approach: {plan.test_approach}")

    if trace.review:
        rv = trace.review
        scores = rv.scores
        passes_note = f"  [generation_passes={trace.generation_passes}]" if trace.generation_passes > 1 else ""
        print(f"Review: verdict={rv.verdict}  weighted={rv.weighted_total}/5.0{passes_note}")
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
