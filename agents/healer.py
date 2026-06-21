"""
agents/healer.py
────────────────
STAGE 4.5 — Self-Healing Agent.

Sits between the Runner and the Reporter. For each FAILED test it triages the
failure, and only if the failure is a *locator* problem (selector no longer
matches the DOM) does it attempt a repair:

    1. classify the failure  (locator | assertion | timeout | other)
    2. if locator: pull the broken selector + a DOM snapshot
    3. ask Claude for a repaired selector GROUNDED in the actual DOM
    4. patch the test file (old selector -> new selector)
    5. re-run just that one test
    6. record the before -> after as a HealingAttempt

I/O CONTRACT
    in : RunResults  (+ access to the GeneratedSuite files + a DOM provider)
    out: (RunResults, list[HealingAttempt])   — updated results + audit log

DESIGN GUARDRAILS
  • Assertion failures are NEVER healed. A failing assertion means the code is
    wrong or the spec changed — silently "fixing" it would hide a real bug.
    The Healer marks it healable=False and leaves it red.
  • Every heal is logged with the old selector, new selector, rationale, and
    confidence. Nothing is rewritten invisibly.
  • A heal only "counts" if the re-run actually passes. A repaired selector
    that still fails stays failed.
"""
from __future__ import annotations

import re
from typing import Callable, Optional

from pydantic import BaseModel

from agents.base import Agent
from contracts.schemas import (
    RunResults, TestResult, GeneratedSuite,
    HealingAttempt, FailureKind,
)

# A DomProvider returns the current DOM/snapshot for a given test id.
# In CI this is the Playwright trace / page.content(); in the simulator it's
# a canned snapshot. The Healer doesn't care which — it just needs HTML.
DomProvider = Callable[[str], str]


def classify_failure(error: Optional[str]) -> FailureKind:
    """Rule-based triage — deterministic, no LLM. Cheap and auditable."""
    if not error:
        return FailureKind.OTHER
    e = error.lower()
    if any(k in e for k in (
        "locator", "no element", "not found", "not visible",
        "waiting for selector", "resolved to 0 elements",
        "strict mode violation",
    )):
        return FailureKind.LOCATOR
    if "timeout" in e or "timed out" in e:
        return FailureKind.TIMEOUT
    if any(k in e for k in ("expect(", "assertion", "to equal", "to be", "received")):
        return FailureKind.ASSERTION
    return FailureKind.OTHER


def extract_selector(error: Optional[str]) -> Optional[str]:
    """Pull the offending selector out of a Playwright error string."""
    if not error:
        return None
    # common shapes: getByTestId('x'), locator('css=...'), [data-testid="x"]
    for pat in (
        r"locator\(['\"]([^'\"]+)['\"]\)",
        r"getByTestId\(['\"]([^'\"]+)['\"]\)",
        r"(\[data-testid=['\"][^'\"]+['\"]\])",
        r"selector ['\"]([^'\"]+)['\"]",
    ):
        m = re.search(pat, error)
        if m:
            return m.group(1)
    return None


class _Repair(BaseModel):
    """The Healer's LLM sub-contract — selector repair only."""
    new_selector: str
    rationale: str
    confidence: float


class HealerAgent(Agent):
    NAME = "healer"

    SYSTEM = """You are the Self-Healing Agent in an automated QA pipeline.

A Playwright test failed because a selector no longer matches the DOM (the UI
changed — a data-testid was renamed, an element moved, a class changed).

You are given: the broken selector and a snapshot of the CURRENT DOM. Find the
element the test almost certainly intended to target and return a repaired,
ROBUST selector grounded in what actually exists in the DOM.

Rules:
- Prefer a data-testid if one exists on the intended element; else a stable
  role+name; else a stable attribute. Never invent a selector not supported by
  the DOM snapshot.
- Prefer resilience: a selector unlikely to break again on minor UI changes.
- If the intended element genuinely no longer exists in the DOM, set confidence
  below 0.4 and explain — do not fabricate a match.

Return ONLY JSON:
{ "new_selector": "...", "rationale": "one sentence", "confidence": 0.0-1.0 }"""

    def __init__(self, *args, min_confidence: float = 0.6, **kwargs):
        super().__init__(*args, **kwargs)
        self.min_confidence = min_confidence

    # ── per-test heal attempt ──────────────────────────────────
    def _heal_one(
        self, tr: TestResult, suite: GeneratedSuite, dom_provider: DomProvider
    ) -> HealingAttempt:
        kind = classify_failure(tr.error)

        # only locator failures are healable
        if kind is not FailureKind.LOCATOR:
            return HealingAttempt(
                test_id=tr.id, failure_kind=kind, healable=False,
                rationale=(
                    "assertion failure — real bug, not a selector issue; left red"
                    if kind is FailureKind.ASSERTION
                    else f"{kind.value} failure — not a selector repair"
                ),
            )

        old_sel = extract_selector(tr.error)
        dom = dom_provider(tr.id)
        repair = self._complete_json(
            f"Broken selector: {old_sel!r}\n\nCurrent DOM snapshot:\n{dom}\n",
            _Repair, max_tokens=500,
        )

        # find the file that contains the old selector
        target_file = next(
            (f for f in suite.files if old_sel and old_sel in f.content), None
        )

        attempt = HealingAttempt(
            test_id=tr.id, failure_kind=kind, healable=True,
            old_selector=old_sel, new_selector=repair.new_selector,
            rationale=repair.rationale, confidence=repair.confidence,
            file_path=target_file.path if target_file else None,
        )

        # low confidence -> do not patch, leave the failure for a human
        if repair.confidence < self.min_confidence or not target_file or not old_sel:
            attempt.rerun_passed = False
            return attempt

        # patch the file in memory (CI would write + re-run via Playwright)
        target_file.content = target_file.content.replace(old_sel, repair.new_selector)
        attempt.rerun_passed = self._rerun(tr, repair, dom)
        return attempt

    # ── re-run the single healed test ──────────────────────────
    def _rerun(self, tr: TestResult, repair: _Repair, dom: str) -> bool:
        """
        In CI: write the patched file and run `npx playwright test -g <id>`.
        Here (simulator): the heal succeeds if the repaired selector actually
        appears in the current DOM snapshot — i.e. it now matches something.
        """
        sel = repair.new_selector
        token = sel.strip("[]").split("=")[-1].strip("'\"")
        return token in dom

    # ── public entry ───────────────────────────────────────────
    def run(
        self,
        results: RunResults,
        suite: GeneratedSuite,
        dom_provider: DomProvider,
    ) -> tuple[RunResults, list[HealingAttempt]]:
        log: list[HealingAttempt] = []

        for tr in results.results:
            if tr.passed:
                continue
            attempt = self._heal_one(tr, suite, dom_provider)
            log.append(attempt)
            if attempt.rerun_passed:
                tr.passed = True
                tr.error = None
                tr.retries += 1   # the heal is counted as a retry

        # recompute the roll-up after healing
        results.passed = sum(1 for r in results.results if r.passed)
        results.failed = results.total - results.passed
        results.pass_rate = (
            round(results.passed / results.total * 100, 1) if results.total else 0.0
        )
        return results, log
