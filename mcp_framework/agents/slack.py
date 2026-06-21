"""
Agent 7 — Slack  (Slack MCP)
──────────────────────────────
Sends structured notifications to Slack via Incoming Webhooks.

Two notification types:
  • START  — "Pipeline kicked off for <app_name>"
  • RESULT — Rich attachment with pass/fail stats, PR link, Jira summary
"""
from __future__ import annotations
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from mcp_framework.config    import MCPConfig
from mcp_framework.contracts import (
    ExecutionResult, GitOpsResult, JiraResult, OrchestratorResult,
)


class SlackAgent:
    NAME = "Slack"

    def __init__(self, cfg: MCPConfig):
        self.cfg = cfg

    # ── public API ────────────────────────────────────────────────────────
    def notify_start(self, app_name: str, app_url: str) -> bool:
        if not self.cfg.has_slack:
            return False
        return self._post({
            "text": f":rocket: *MCP QA Orchestrator* started for *{app_name}*",
            "attachments": [{
                "color": "#2196F3",
                "fields": [
                    {"title": "App", "value": app_name, "short": True},
                    {"title": "URL", "value": app_url,  "short": True},
                    {"title": "Agents", "value":
                     "Analyzer → Scaffolder → Executor → Healer → GitOps → Jira",
                     "short": False},
                ],
                "footer": "MCP QA Orchestrator v1.0",
            }],
        })

    def notify_result(self, result: OrchestratorResult) -> bool:
        if not self.cfg.has_slack:
            return False

        ex    = result.execution
        color = "#4CAF50" if result.overall_status == "PASS" else "#F44336"
        emoji = ":white_check_mark:" if result.overall_status == "PASS" else ":x:"

        fields = [
            {"title": "Status",    "value": f"{emoji} {result.overall_status}", "short": True},
            {"title": "Pass Rate", "value": f"{ex.pass_rate}%",                 "short": True},
            {"title": "Tests",
             "value": f"{ex.passed}/{ex.total} passed | {ex.failed} failed | "
                      f"{ex.self_healed} self-healed",
             "short": False},
            {"title": "Duration",  "value": f"{ex.duration_s:.1f}s", "short": True},
        ]

        if result.gitops and result.gitops.pr_url:
            fields.append({
                "title": "Pull Request",
                "value": f"<{result.gitops.pr_url}|View PR>",
                "short": True,
            })

        if result.jira and result.jira.total_filed:
            keys = ", ".join(
                b.key for b in result.jira.bugs_filed if b.key
            ) or "(no keys)"
            fields.append({
                "title": f"Jira Bugs Filed ({result.jira.total_filed})",
                "value": keys,
                "short": False,
            })

        if ex.self_healed:
            fields.append({
                "title": "Self-Healing",
                "value": f":wrench: {ex.self_healed} selector failure(s) auto-repaired",
                "short": False,
            })

        payload = {
            "text": f"*MCP QA Orchestrator* run complete — *{result.app_name}*",
            "attachments": [{
                "color": color,
                "fields": fields,
                "footer": "MCP QA Orchestrator v1.0",
                "footer_icon":
                    "https://playwright.dev/img/playwright-logo.svg",
            }],
        }

        # Send to alerts channel if FAIL
        if result.overall_status == "FAIL" and self.cfg.slack_channel_alerts != self.cfg.slack_channel:
            self._post(payload, channel=self.cfg.slack_channel_alerts)

        return self._post(payload)

    # ── private ───────────────────────────────────────────────────────────
    def _post(self, payload: dict, channel: str | None = None) -> bool:
        try:
            import requests
            if channel:
                payload = {**payload, "channel": channel}
            resp = requests.post(
                self.cfg.slack_webhook,  # type: ignore
                data=json.dumps(payload),
                headers={"Content-Type": "application/json"},
                timeout=5,
            )
            return resp.status_code == 200
        except Exception:
            return False
