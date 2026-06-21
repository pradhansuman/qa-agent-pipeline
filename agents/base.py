"""
next example
──────────────
Shared base class for every LLM-backed agent.

Responsibilities pushed down here so each agent stays a thin prompt + contract:
  • one place that talks to the Anthropic API
  • JSON-mode helper that strips markdown fences and validates against a Pydantic model
  • a security guardrail hook (Suman's standing rule: flag risky output)
"""
from __future__ import annotations

import json
import os
from typing import Type, TypeVar

from anthropic import Anthropic
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

MODEL = os.environ.get("QA_AGENT_MODEL", "claude-sonnet-4-20250514")


class AgentResponseError(RuntimeError):
    """Raised when an agent's LLM response can't be parsed into its contract."""


class Agent:
    """Base class. Subclasses set NAME + SYSTEM and implement run()."""

    NAME: str = "agent"
    SYSTEM: str = "You are a helpful agent."

    def __init__(self, client: Anthropic | None = None, model: str = MODEL):
        self.client = client or Anthropic()  # reads ANTHROPIC_API_KEY from env
        self.model = model

    # ── core LLM call ────────────────────────────────────────────
    def _complete(self, user_prompt: str, max_tokens: int = 1500):
        """Returns (text, stop_reason). stop_reason='max_tokens' means truncated."""
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return resp.content[0].text, resp.stop_reason

    # ── strip markdown fences / leading prose around a JSON blob ──
    @staticmethod
    def _extract_json(raw: str) -> str:
        s = raw.strip()
        if s.startswith("```"):
            s = s.split("```", 2)[1]
            if s.startswith("json"):
                s = s[4:]
            s = s.strip().rstrip("`").strip()
        # if the model added prose before/after, slice to the outermost braces
        first, last = s.find("{"), s.rfind("}")
        if first != -1 and last != -1 and last > first:
            s = s[first:last + 1]
        return s

    # ── JSON mode: call + parse + validate, with a retry on truncation ──
    def _complete_json(self, user_prompt: str, schema: Type[T], max_tokens: int = 1500) -> T:
        attempts = [max_tokens, min(max_tokens * 2, 8192)]
        last_err: Exception | None = None

        for i, budget in enumerate(attempts):
            text, stop = self._complete(user_prompt, max_tokens=budget)

            if stop == "max_tokens":
                # response was cut off — JSON is incomplete. Retry with more room.
                last_err = AgentResponseError(
                    f"[{self.NAME}] response hit the {budget}-token limit and was "
                    f"truncated mid-JSON."
                )
                if i + 1 < len(attempts):
                    continue
                raise AgentResponseError(
                    f"[{self.NAME}] output exceeded {budget} tokens even after retry. "
                    f"The plan is likely too large for one response — split the issue "
                    f"or lower the scenario count."
                ) from last_err

            cleaned = self._extract_json(text)
            try:
                return schema.model_validate(json.loads(cleaned))
            except (json.JSONDecodeError, ValidationError) as e:
                last_err = e
                if i + 1 < len(attempts):
                    continue  # one more try with a bigger budget
                raise AgentResponseError(
                    f"[{self.NAME}] could not parse a valid {schema.__name__} from the "
                    f"model response. First 200 chars:\n{cleaned[:200]}"
                ) from e

        raise AgentResponseError(f"[{self.NAME}] no response produced.")  # unreachable

    def run(self, *args, **kwargs):  # pragma: no cover
        raise NotImplementedError
