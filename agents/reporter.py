"""
agents/reporter.py
──────────────────
STAGE 5 — Reporter Agent.

Turns raw run results into a human-facing summary and a CI gate decision.
The LLM writes the narrative (what failed, what it means, what to do); the
gate decision itself is rule-based so the merge gate is never at the mercy of
a model's phrasing.

I/O CONTRACT
    in : RunResults
    out: ReportArtifact
"""
from __future__ import annotations

from agents.base import Agent
from contracts.schemas import RunResults, ReportArtifact


class ReporterAgent(Agent):
    NAME = "reporter"

    SYSTEM = """You are the Reporter Agent in an automated QA pipeline.

Given test run results, write a concise engineering summary for a pull-request
reviewer. Be factual, lead with the gate decision, and if anything failed name
the specific scenario and what a fix likely involves. No fluff.

Return ONLY JSON:
{
  "headline": "<one line, e.g. '5/5 passed — safe to merge'>",
  "summary_md": "<2-4 sentence markdown summary>",
  "issue_comment": "<markdown to post on the GitHub issue, includes pass rate and report link placeholder>"
}"""

    # gate policy lives in code, not in the prompt
    @staticmethod
    def _gate(run: RunResults) -> str:
        p0_failed = any(
            (not r.passed) and r.priority.value == "P0" for r in run.results
        )
        # any P0 failure blocks; otherwise require >=90% pass rate
        if p0_failed or run.pass_rate < 90.0:
            return "FAIL"
        return "PASS"

    def run(self, run: RunResults) -> ReportArtifact:
        failed = [r for r in run.results if not r.passed]
        failed_desc = "; ".join(f"{r.id} {r.name}" for r in failed) or "none"
        prompt = (
            f"Issue #{run.issue_number}\n"
            f"Total: {run.total}  Passed: {run.passed}  Failed: {run.failed}  "
            f"Pass rate: {run.pass_rate}%\n"
            f"Duration: {run.total_duration_ms} ms\n"
            f"Failed scenarios: {failed_desc}\n"
        )
        narrative = self._complete_json(prompt, _Narrative, max_tokens=800)
        gate = self._gate(run)
        return ReportArtifact(
            issue_number=run.issue_number,
            headline=narrative.headline,
            summary_md=narrative.summary_md,
            pass_rate=run.pass_rate,
            gate_decision=gate,
            issue_comment=narrative.issue_comment,
        )


# private narrative sub-contract (LLM writes only the prose fields)
from pydantic import BaseModel  # noqa: E402


class _Narrative(BaseModel):
    headline: str
    summary_md: str
    issue_comment: str
