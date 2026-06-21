"""
agents/ingestor.py
──────────────────
STAGE 1 — GitHub Issue Ingestion.

This agent is deterministic — it does NOT call the LLM. It hits the real
GitHub REST API, pulls the issue, and normalises it into an IssuePayload that
every downstream agent can rely on.

I/O CONTRACT
    in : IssueRef(repo, issue_number, github_token?)
    out: IssuePayload

Why no LLM here: ingestion must be exact and cheap. Inferring priority from
labels is rule-based and auditable; we don't want a model hallucinating an
issue number or inventing a label.
"""
from __future__ import annotations

import re
import requests

from contracts.schemas import IssueRef, IssuePayload, Priority

GITHUB_API = "https://api.github.com"

# label → priority precedence (first match wins)
_PRIORITY_MAP = {
    r"\bp0\b|critical|blocker": Priority.P0,
    r"\bp1\b|high": Priority.P1,
    r"\bp2\b|medium|low": Priority.P2,
}


def _infer_priority(labels: list[str]) -> Priority:
    joined = " ".join(labels).lower()
    for pattern, pri in _PRIORITY_MAP.items():
        if re.search(pattern, joined):
            return pri
    return Priority.P2


def _infer_type(labels: list[str]) -> str:
    joined = " ".join(labels).lower()
    if "bug" in joined or "defect" in joined:
        return "bug"
    if "feature" in joined or "enhancement" in joined:
        return "feature"
    return "chore"


def _infer_component(labels: list[str]) -> str | None:
    # convention: labels like "area:auth" or "component/checkout"
    for lab in labels:
        m = re.match(r"(?:area|component)[:/](.+)", lab.lower())
        if m:
            return m.group(1)
    return None


class IngestorAgent:
    NAME = "ingestor"

    def run(self, ref: IssueRef) -> IssuePayload:
        headers = {"Accept": "application/vnd.github+json"}
        if ref.github_token:
            headers["Authorization"] = f"Bearer {ref.github_token}"

        url = f"{GITHUB_API}/repos/{ref.repo}/issues/{ref.issue_number}"
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()

        labels = [l["name"] for l in data.get("labels", [])]

        return IssuePayload(
            issue_number=data["number"],
            repo=ref.repo,
            state=data.get("state", "open"),
            title=data.get("title", ""),
            body=(data.get("body") or "").strip(),
            labels=labels,
            priority=_infer_priority(labels),
            type=_infer_type(labels),
            component=_infer_component(labels),
            milestone=(data.get("milestone") or {}).get("title"),
            author=(data.get("user") or {}).get("login"),
            comments_count=data.get("comments", 0),
            url=data.get("html_url", ""),
            pipeline_stage="ingested",
            ready_for_planner=True,
        )
