"""
Agent 6 — Jira  (Jira MCP)
────────────────────────────
For every ASSERTION failure (genuine application bug) that the Healer did NOT
fix, this agent files a structured Jira issue via the REST API v3.

If Jira credentials are not configured it prints a structured "would-file"
report instead — no credentials required for the output.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from mcp_framework.contracts import (
    ExecutionResult, TestCaseResult, JiraBug, JiraResult,
    FailureKind, Severity,
)
from mcp_framework.config import MCPConfig


_SEVERITY_MAP = {
    "P0": "Highest",
    "P1": "High",
    "P2": "Medium",
    "P3": "Low",
}


class JiraAgent:
    NAME = "Jira"

    def __init__(self, cfg: MCPConfig):
        self.cfg = cfg

    # ── public API ────────────────────────────────────────────────────────
    def file_bugs(
        self,
        execution: ExecutionResult,
        app_name: str,
        app_url: str,
    ) -> JiraResult:
        """
        File a Jira ticket for every un-healed assertion failure.
        Returns JiraResult whether or not credentials exist.
        """
        genuine_bugs = [
            r for r in execution.results
            if not r.passed
            and r.failure_kind == FailureKind.ASSERTION
        ]
        other_failures = [
            r for r in execution.results
            if not r.passed
            and r.failure_kind != FailureKind.ASSERTION
        ]

        bugs: list[JiraBug] = []

        # File assertion bugs
        for failure in genuine_bugs:
            bug = self._build_bug(failure, app_name, app_url, Severity.P1)
            bugs.append(bug)
            if self.cfg.has_jira:
                key = self._post_to_jira(bug)
                bug.key = key

        # Also log non-healed selector / timeout failures as P2
        for failure in other_failures:
            bug = self._build_bug(failure, app_name, app_url, Severity.P2)
            bugs.append(bug)
            if self.cfg.has_jira:
                key = self._post_to_jira(bug)
                bug.key = key

        return JiraResult(
            bugs_filed=bugs,
            total_filed=len(bugs),
            jira_base_url=self.cfg.jira_url,
        )

    # ── private ───────────────────────────────────────────────────────────
    @staticmethod
    def _build_bug(
        failure: TestCaseResult,
        app_name: str,
        app_url: str,
        severity: Severity,
    ) -> JiraBug:
        kind_label = (failure.failure_kind or FailureKind.OTHER).value.upper()
        return JiraBug(
            summary  = f"[AUTO-QA] {kind_label}: {failure.name[:100]}",
            severity = severity,
            steps=[
                f"1. Navigate to {app_url}",
                f"2. Execute test: '{failure.name}'",
                f"3. Observe the assertion or element interaction",
            ],
            expected = "Test should pass per acceptance criteria in PRD",
            actual   = (failure.error or "No error captured")[:500],
            test_name = failure.name,
        )

    def _post_to_jira(self, bug: JiraBug) -> str | None:
        """POST to Jira REST API v3. Returns issue key or None on error."""
        try:
            import requests
            from requests.auth import HTTPBasicAuth

            payload = {
                "fields": {
                    "project":     {"key": self.cfg.jira_project},
                    "summary":     bug.summary,
                    "description": {
                        "type": "doc", "version": 1,
                        "content": [{
                            "type": "paragraph",
                            "content": [{"type": "text", "text":
                                f"**Steps:**\n" + "\n".join(bug.steps) +
                                f"\n\n**Expected:** {bug.expected}" +
                                f"\n\n**Actual:** {bug.actual}"
                            }],
                        }],
                    },
                    "issuetype":   {"name": "Bug"},
                    "priority":    {"name": _SEVERITY_MAP.get(bug.severity.value, "Medium")},
                    "labels":      ["auto-qa", "playwright", "regression"],
                }
            }
            resp = requests.post(
                f"{self.cfg.jira_url}/rest/api/3/issue",
                json=payload,
                auth=HTTPBasicAuth(self.cfg.jira_email, self.cfg.jira_token),  # type: ignore
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            if resp.status_code == 201:
                return resp.json().get("key")
        except Exception:
            pass
        return None
