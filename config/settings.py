"""
config/settings.py
───────────────────
Single source of truth for all runtime configuration.

Reads from environment variables (and an optional .env file).
Replaces the scattered os.environ.get() calls across agents.

Usage:
    from config.settings import settings
    model = settings.qa_agent_model
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()  # reads .env from cwd or any parent directory


@dataclass(frozen=True)
class Settings:
    # ── LLM ─────────────────────────────────────────────────────────────────
    openrouter_api_key: str        = field(default_factory=lambda: os.environ.get("OPENROUTER_API_KEY", ""))
    qa_agent_model: str            = field(default_factory=lambda: os.environ.get("QA_AGENT_MODEL", "anthropic/claude-haiku-4.5"))

    # ── Target app ───────────────────────────────────────────────────────────
    qa_target_url: str             = field(default_factory=lambda: os.environ.get("QA_TARGET_URL", "https://demoqa.com"))

    # ── GitHub ───────────────────────────────────────────────────────────────
    github_token: str | None       = field(default_factory=lambda: os.environ.get("GITHUB_TOKEN"))

    # ── Healer ───────────────────────────────────────────────────────────────
    healer_min_confidence: float   = field(default_factory=lambda: float(os.environ.get("HEALER_MIN_CONFIDENCE", "0.6")))

    # ── Runner ───────────────────────────────────────────────────────────────
    runner_real: bool              = field(default_factory=lambda: os.environ.get("RUNNER_REAL", "").lower() in ("1", "true"))
    runner_workers: int            = field(default_factory=lambda: int(os.environ.get("RUNNER_WORKERS", "4")))

    # ── Mobile / cross-browser (all free — Playwright bundled browsers) ──────
    mobile_enabled: bool           = field(default_factory=lambda: os.environ.get("MOBILE_ENABLED", "true").lower() != "false")
    # Set MOBILE_ENABLED=false to restrict to desktop-only (faster local runs)

    # ── Observability ────────────────────────────────────────────────────────
    log_level: str                 = field(default_factory=lambda: os.environ.get("LOG_LEVEL", "INFO").upper())
    prompt_version: str            = field(default_factory=lambda: os.environ.get("PROMPT_VERSION", "v1"))


# Module-level singleton — import and use directly.
# Tests can override by constructing a fresh Settings() with explicit values.
settings = Settings()
