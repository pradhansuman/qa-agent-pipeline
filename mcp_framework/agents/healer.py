"""
Agent 4 — Self-Healing Agent  (Playwright MCP)
───────────────────────────────────────────────
For each SELECTOR / SCRIPT / TIMEOUT failure the LLM proposes a code patch.
ASSERTION failures are NEVER healed — they indicate real product bugs.

Healing loop:
  1. Classify failure kind.
  2. If healable: ask LLM for a patch.
  3. Apply the patch to the spec file.
  4. Re-run only the affected test.
  5. Record the outcome.
"""
from __future__ import annotations
import os, re, sys, subprocess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from anthropic import Anthropic
from agents.base import Agent
from mcp_framework.contracts import (
    ExecutionResult, TestCaseResult, HealAttempt, FailureKind,
)
from mcp_framework.config import MCPConfig

_HEAL_PROMPT = """\
You are an expert Playwright engineer performing self-healing.

A Playwright test has FAILED due to a {failure_kind} error.

FAILING TEST NAME: {test_name}
ERROR MESSAGE    : {error}

CURRENT SPEC FILE ({file_path}):
```typescript
{file_content}
```

Your job:
1. Identify the root cause of the failure.
2. Propose a minimal fix — change ONLY the failing selector, action, or syntax.
3. NEVER modify test assertions or expected values (those represent real bugs).
4. Return ONLY valid JSON (no prose, no markdown fences):

{{
  "can_heal": true,
  "confidence": 0.85,
  "rationale": "<why this fix works>",
  "patched_content": "<FULL corrected file content>"
}}

If you cannot safely fix the issue set "can_heal": false and confidence: 0.
"""

# Failure kinds the healer is allowed to fix
_HEALABLE = {FailureKind.SELECTOR, FailureKind.TIMEOUT, FailureKind.SCRIPT}


class HealerAgent(Agent):
    NAME   = "Healer"
    SYSTEM = "You are a Playwright self-healing engineer. Output only valid JSON."

    def __init__(self, cfg: MCPConfig):
        super().__init__(client=Anthropic(), model=cfg.model)
        self.cfg = cfg

    # ── public API ────────────────────────────────────────────────────────
    def heal(
        self,
        result: ExecutionResult,
        output_dir: str,
        max_cycles: int | None = None,
    ) -> ExecutionResult:
        """
        Attempt to heal every healable failure in `result`.
        Returns an updated ExecutionResult with self_healed count and heal_log.
        """
        cycles = max_cycles or self.cfg.max_heal_cycles
        for _ in range(cycles):
            failures = [r for r in result.results if not r.passed]
            if not failures:
                break
            healed_any = False
            for failure in failures:
                if failure.failure_kind not in _HEALABLE:
                    continue  # assertion / other → genuine bug, skip
                attempt = self._try_heal(failure, output_dir)
                result.heal_log.append(attempt)
                if attempt.rerun_passed:
                    failure.passed = True
                    failure.error  = None
                    result.self_healed += 1
                    healed_any = True
            if not healed_any:
                break

        # recompute aggregates
        result.passed    = sum(1 for r in result.results if r.passed)
        result.failed    = len(result.results) - result.passed
        result.pass_rate = round(result.passed / max(result.total, 1) * 100, 1)
        return result

    # ── private ───────────────────────────────────────────────────────────
    def _try_heal(self, failure: TestCaseResult, output_dir: str) -> HealAttempt:
        spec_path = self._find_spec(failure, output_dir)
        attempt   = HealAttempt(
            test_name    = failure.name,
            failure_kind = failure.failure_kind or FailureKind.OTHER,
            healable     = True,
            original_error = failure.error or "",
        )

        if not spec_path:
            attempt.healable = False
            attempt.rationale = "Could not locate the spec file on disk."
            return attempt

        with open(spec_path, encoding="utf-8") as fh:
            content = fh.read()

        prompt = _HEAL_PROMPT.format(
            failure_kind = (failure.failure_kind or FailureKind.OTHER).value,
            test_name    = failure.name,
            error        = (failure.error or "")[:600],
            file_path    = spec_path,
            file_content = content[:6000],
        )

        try:
            raw = self._complete_json(prompt, _HealRaw, max_tokens=6000)
        except Exception as e:
            attempt.healable  = False
            attempt.rationale = f"LLM parse error: {e}"
            return attempt

        attempt.rationale  = raw.rationale
        attempt.confidence = raw.confidence
        attempt.patched_code = raw.patched_content

        if not raw.can_heal or raw.confidence < self.cfg.min_heal_confidence:
            attempt.healable = False
            attempt.rationale = (
                raw.rationale
                or f"Confidence too low ({raw.confidence:.2f} < {self.cfg.min_heal_confidence})"
            )
            return attempt

        # Apply patch
        with open(spec_path, "w", encoding="utf-8") as fh:
            fh.write(raw.patched_content)

        # Re-run only this test
        attempt.rerun_passed = self._rerun(failure.name, spec_path, output_dir)
        if not attempt.rerun_passed:
            # Restore original
            with open(spec_path, "w", encoding="utf-8") as fh:
                fh.write(content)

        return attempt

    @staticmethod
    def _find_spec(failure: TestCaseResult, output_dir: str) -> str | None:
        if failure.file:
            candidate = os.path.join(output_dir, failure.file)
            if os.path.exists(candidate):
                return candidate
        # Scan all spec files
        for root, _, files in os.walk(os.path.join(output_dir, "tests")):
            for f in files:
                if f.endswith(".spec.ts"):
                    return os.path.join(root, f)   # return first spec
        return None

    @staticmethod
    def _rerun(test_name: str, spec_path: str, output_dir: str) -> bool:
        safe_name = re.sub(r"[^\w\s\-]", ".", test_name)[:80]
        proc = subprocess.run(
            ["npx", "playwright", "test", "--grep", safe_name,
             os.path.relpath(spec_path, output_dir),
             "--reporter=line"],
            cwd=output_dir,
            capture_output=True, text=True, timeout=60,
        )
        return proc.returncode == 0


# ── schema ────────────────────────────────────────────────────────────────────
from pydantic import BaseModel

class _HealRaw(BaseModel):
    can_heal: bool = False
    confidence: float = 0.0
    rationale: str = ""
    patched_content: str = ""
