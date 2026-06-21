"""
mcp_framework/config.py
────────────────────────
Single configuration object.  Every value is readable from an env-var so
the framework works both in local dev (export VAR=…) and in CI secrets.
"""
from __future__ import annotations
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class MCPConfig:
    # ── LLM ──────────────────────────────────────────────────────────────
    anthropic_api_key: str = field(
        default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    model: str = field(
        default_factory=lambda: os.getenv(
            "QA_AGENT_MODEL", "claude-sonnet-4-6"))

    # ── GitHub MCP ───────────────────────────────────────────────────────
    github_token:  Optional[str] = field(
        default_factory=lambda: os.getenv("GITHUB_TOKEN"))
    github_repo:   Optional[str] = field(
        default_factory=lambda: os.getenv("GITHUB_REPO"))   # owner/repo
    github_base_branch: str = field(
        default_factory=lambda: os.getenv("GITHUB_BASE_BRANCH", "main"))

    # ── Jira MCP ─────────────────────────────────────────────────────────
    jira_url:     Optional[str] = field(
        default_factory=lambda: os.getenv("JIRA_URL"))          # https://xyz.atlassian.net
    jira_email:   Optional[str] = field(
        default_factory=lambda: os.getenv("JIRA_EMAIL"))
    jira_token:   Optional[str] = field(
        default_factory=lambda: os.getenv("JIRA_API_TOKEN"))
    jira_project: str = field(
        default_factory=lambda: os.getenv("JIRA_PROJECT", "QA"))

    # ── Slack MCP ────────────────────────────────────────────────────────
    slack_webhook:  Optional[str] = field(
        default_factory=lambda: os.getenv("SLACK_WEBHOOK"))
    slack_channel:  str = field(
        default_factory=lambda: os.getenv("SLACK_CHANNEL", "#qa-automation"))
    slack_channel_alerts: str = field(
        default_factory=lambda: os.getenv("SLACK_CHANNEL_ALERTS", "#engineering-alerts"))

    # ── Playwright ───────────────────────────────────────────────────────
    headless: bool = True
    workers:  int  = 2
    timeout_ms: int = 10_000
    retries:    int = 1

    # ── Self-healer ──────────────────────────────────────────────────────
    min_heal_confidence: float = 0.60   # skip patches below this threshold
    max_heal_cycles:     int   = 2      # avoid infinite loops

    # ── Misc ─────────────────────────────────────────────────────────────
    verbose: bool = False

    # ── derived helpers ──────────────────────────────────────────────────
    @property
    def has_github(self) -> bool:
        return bool(self.github_token and self.github_repo)

    @property
    def has_jira(self) -> bool:
        return bool(self.jira_url and self.jira_email and self.jira_token)

    @property
    def has_slack(self) -> bool:
        return bool(self.slack_webhook)

    def summary(self) -> str:
        parts = ["LLM:✅"]
        parts.append("GitHub:✅" if self.has_github else "GitHub:⚠️(no token/repo)")
        parts.append("Jira:✅"   if self.has_jira   else "Jira:⚠️(no credentials)")
        parts.append("Slack:✅"  if self.has_slack  else "Slack:⚠️(no webhook)")
        return "  ".join(parts)
