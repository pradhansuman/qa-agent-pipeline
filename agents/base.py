"""
agents/base.py
──────────────
Shared base class for every LLM-backed agent.

Responsibilities:
  • One place that talks to the Anthropic API
  • Structured logging with per-run trace IDs
  • Token usage accumulation for cost visibility
  • JSON-mode helper: strip fences → validate Pydantic → retry on truncation
  • Prompt registry: load SYSTEM from prompts/{name}/{version}.md when present
  • Typed exceptions: raises LLMError / TruncatedResponseError, never bare RuntimeError
"""
from __future__ import annotations

import json
import logging
import logging.config
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Type, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from contracts.exceptions import LLMError, TruncatedResponseError
from config.settings import settings

T = TypeVar("T", bound=BaseModel)

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s [%(levelname)-5s] %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


# ── Token tracking ────────────────────────────────────────────────────────────
@dataclass
class TokenUsage:
    input_tokens:  int = 0
    output_tokens: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def estimated_cost_usd(self) -> float:
        # Haiku 4.5: $0.80/M input, $4.00/M output (update if model changes)
        return (self.input_tokens * 0.80 + self.output_tokens * 4.00) / 1_000_000

    def __add__(self, other: "TokenUsage") -> "TokenUsage":
        return TokenUsage(
            self.input_tokens  + other.input_tokens,
            self.output_tokens + other.output_tokens,
        )


# ── Base agent ────────────────────────────────────────────────────────────────
class Agent:
    """Base class. Subclasses set NAME + SYSTEM and implement run()."""

    NAME:           str = "agent"
    SYSTEM:         str = "You are a helpful agent."
    PROMPT_VERSION: str = "v1"

    # Class-level cache so we only read each prompt file once per process
    _prompt_cache: dict[str, str] = {}

    def __init__(
        self,
        client:   OpenAI | None = None,
        model:    str = settings.qa_agent_model,
        trace_id: str | None = None,
    ):
        self.client   = client or OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
        self.model    = model
        self.trace_id = trace_id or "--------"
        self.usage    = TokenUsage()
        self.log      = logging.getLogger(self.NAME)

    # ── Prompt registry ───────────────────────────────────────────────────────
    @classmethod
    def _get_system(cls) -> str:
        """
        Load SYSTEM from prompts/{name}/{version}.md when it exists,
        fall back to the class SYSTEM attribute otherwise.
        This allows prompt changes without touching Python code.
        """
        cache_key = f"{cls.NAME}/{cls.PROMPT_VERSION}"
        if cache_key not in cls._prompt_cache:
            prompt_path = (
                Path(__file__).parent.parent
                / "prompts" / cls.NAME / f"{cls.PROMPT_VERSION}.md"
            )
            if prompt_path.exists():
                cls._prompt_cache[cache_key] = prompt_path.read_text(encoding="utf-8").strip()
                logging.getLogger(cls.NAME).debug(
                    "prompt loaded from file path=%s", prompt_path
                )
            else:
                cls._prompt_cache[cache_key] = cls.SYSTEM
        return cls._prompt_cache[cache_key]

    # ── Core LLM call ─────────────────────────────────────────────────────────
    def _complete(self, user_prompt: str, max_tokens: int = 1500) -> tuple[str, str]:
        """Returns (text, stop_reason). Accumulates token usage."""
        resp = self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=0,
            messages=[
                {"role": "system", "content": self._get_system()},
                {"role": "user",   "content": user_prompt},
            ],
        )
        usage = resp.usage
        if usage:
            self.usage.input_tokens  += usage.prompt_tokens
            self.usage.output_tokens += usage.completion_tokens
        choice = resp.choices[0]
        stop = "max_tokens" if choice.finish_reason == "length" else choice.finish_reason
        self.log.debug(
            "trace=%s llm_call in=%d out=%d stop=%s",
            self.trace_id,
            usage.prompt_tokens  if usage else 0,
            usage.completion_tokens if usage else 0,
            stop,
        )
        return choice.message.content or "", stop

    # ── JSON extraction ───────────────────────────────────────────────────────
    @staticmethod
    def _extract_json(raw: str) -> str:
        """Strip markdown fences and slice to outermost {} braces."""
        s = raw.strip()
        if s.startswith("```"):
            s = s.split("```", 2)[1]
            if s.startswith("json"):
                s = s[4:]
            s = s.strip().rstrip("`").strip()
        first, last = s.find("{"), s.rfind("}")
        if first != -1 and last != -1 and last > first:
            s = s[first : last + 1]
        return s

    # ── JSON mode: call → parse → validate, retry once on truncation ──────────
    def _complete_json(self, user_prompt: str, schema: Type[T], max_tokens: int = 1500) -> T:
        budgets = [max_tokens, min(max_tokens * 2, 8192)]

        for attempt, budget in enumerate(budgets):
            text, stop = self._complete(user_prompt, max_tokens=budget)

            if stop == "max_tokens":
                if attempt + 1 < len(budgets):
                    self.log.warning(
                        "trace=%s agent=%s truncated at %d tokens, retrying with %d",
                        self.trace_id, self.NAME, budget, budgets[attempt + 1],
                    )
                    continue
                raise TruncatedResponseError(self.NAME, budget)

            cleaned = self._extract_json(text)
            try:
                return schema.model_validate(json.loads(cleaned))
            except (json.JSONDecodeError, ValidationError) as exc:
                if attempt + 1 < len(budgets):
                    self.log.warning(
                        "trace=%s agent=%s parse error (%s), retrying",
                        self.trace_id, self.NAME, type(exc).__name__,
                    )
                    continue
                raise LLMError(
                    self.NAME,
                    f"Could not parse a valid {schema.__name__} from model response. "
                    f"First 200 chars:\n{cleaned[:200]}",
                ) from exc

        raise LLMError(self.NAME, "No response produced.")  # unreachable

    def run(self, *args, **kwargs):  # pragma: no cover
        raise NotImplementedError
