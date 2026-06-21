"""
Agent 5 — GitOps  (GitHub MCP)
───────────────────────────────
After a clean test run:
  1. git init (if not already a repo)
  2. Create feature branch
  3. Stage + commit all generated files
  4. Push to remote (if GITHUB_TOKEN + GITHUB_REPO configured)
  5. Open a Pull Request via GitHub REST API
"""
from __future__ import annotations
import os, subprocess, sys
from datetime import datetime
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from mcp_framework.contracts import GitOpsResult
from mcp_framework.config    import MCPConfig


class GitOpsAgent:
    NAME = "GitOps"

    def __init__(self, cfg: MCPConfig):
        self.cfg = cfg

    # ── public API ────────────────────────────────────────────────────────
    def run(
        self,
        output_dir: str,
        app_name: str,
        pass_rate: float,
        total_tests: int,
        prd_ref: str = "",
    ) -> GitOpsResult:
        ts     = datetime.now().strftime("%Y%m%d-%H%M")
        branch = f"feature/qa-e2e-{app_name.lower().replace(' ','-')}-{ts}"
        commit_msg = (
            f"feat(qa): autonomous E2E suite for {app_name}\n\n"
            f"- {total_tests} Playwright/TypeScript tests generated\n"
            f"- Pass rate: {pass_rate}%\n"
            f"- Worker-scoped fixture, POM architecture\n"
            f"- Self-healing enabled\n"
            f"\nPRD-REF: {prd_ref or 'see README'}\n"
            f"AGENT: MCP QA Orchestrator v1.0"
        )

        try:
            self._git_init(output_dir)
            self._checkout_branch(output_dir, branch)
            self._stage_all(output_dir)
            commit_hash = self._commit(output_dir, commit_msg)

            pushed  = False
            pr_url  = None
            if self.cfg.has_github:
                pushed = self._push(output_dir, branch)
                if pushed:
                    pr_url = self._open_pr(
                        branch      = branch,
                        app_name    = app_name,
                        total_tests = total_tests,
                        pass_rate   = pass_rate,
                        prd_ref     = prd_ref,
                    )

            return GitOpsResult(
                branch=branch,
                commit_hash=commit_hash,
                commit_message=commit_msg,
                pushed=pushed,
                pr_url=pr_url,
            )
        except Exception as exc:
            return GitOpsResult(
                branch=branch,
                commit_hash="ERROR",
                commit_message=commit_msg,
                error=str(exc),
            )

    # ── private git helpers ───────────────────────────────────────────────
    def _git(self, args: list[str], cwd: str, check: bool = True) -> str:
        r = subprocess.run(
            ["git"] + args, cwd=cwd,
            capture_output=True, text=True,
        )
        if check and r.returncode != 0:
            raise RuntimeError(f"git {args[0]} failed: {r.stderr.strip()}")
        return r.stdout.strip()

    def _git_init(self, cwd: str) -> None:
        git_dir = os.path.join(cwd, ".git")
        if not os.path.isdir(git_dir):
            self._git(["init"], cwd)
            self._git(["config", "user.email", "qa-agent@mcp.ai"], cwd)
            self._git(["config", "user.name",  "MCP QA Orchestrator"], cwd)
            # Create .gitignore
            ignore = "node_modules/\nplaywright-report/\ntest-results/\ndist/\n"
            with open(os.path.join(cwd, ".gitignore"), "w") as fh:
                fh.write(ignore)

    def _checkout_branch(self, cwd: str, branch: str) -> None:
        # Check if we have any commits yet (fresh repo)
        status = self._git(["status", "--porcelain"], cwd, check=False)
        log    = self._git(["log", "--oneline", "-1"], cwd, check=False)
        if not log:
            # No commits yet — stage everything so HEAD exists
            self._git(["add", "-A"], cwd)
            self._git(["commit", "--allow-empty", "-m", "chore: init"], cwd, check=False)
        self._git(["checkout", "-b", branch], cwd)

    def _stage_all(self, cwd: str) -> None:
        self._git(["add",
                   "playwright.config.ts", "tsconfig.json", "package.json",
                   "pages/", "tests/", "utils/", ".gitignore",
                   ], cwd, check=False)

    def _commit(self, cwd: str, msg: str) -> str:
        self._git(["commit", "-m", msg], cwd)
        return self._git(["rev-parse", "--short", "HEAD"], cwd)

    def _push(self, cwd: str, branch: str) -> bool:
        try:
            remote_url = (
                f"https://{self.cfg.github_token}@github.com/"
                f"{self.cfg.github_repo}.git"
            )
            self._git(["remote", "add", "origin", remote_url], cwd, check=False)
            self._git(["push", "-u", "origin", branch], cwd)
            return True
        except RuntimeError:
            return False

    def _open_pr(
        self,
        branch: str,
        app_name: str,
        total_tests: int,
        pass_rate: float,
        prd_ref: str,
    ) -> Optional[str]:
        import requests, json

        owner, repo = (self.cfg.github_repo or "/").split("/", 1)
        body = (
            f"## Autonomous QA Suite — {app_name}\n\n"
            f"### Summary\n"
            f"- {total_tests} Playwright / TypeScript tests generated from PRD\n"
            f"- Pass rate: **{pass_rate}%** on local run\n"
            f"- Architecture: worker-scoped shared page, POM pattern\n"
            f"- Self-healing: enabled (selector / timeout)\n\n"
            f"### Test Plan Reference\n{prd_ref or 'See commits for full test plan.'}\n\n"
            f"### Checklist\n"
            f"- [x] All tests green locally\n"
            f"- [ ] CI run passes\n"
            f"- [ ] Peer review\n\n"
            f"🤖 *Generated by MCP QA Orchestrator*"
        )
        resp = requests.post(
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            headers={
                "Authorization": f"Bearer {self.cfg.github_token}",
                "Accept": "application/vnd.github+json",
            },
            json={
                "title": f"feat(qa): Autonomous E2E suite — {app_name}",
                "body":  body,
                "head":  branch,
                "base":  self.cfg.github_base_branch,
            },
            timeout=15,
        )
        if resp.status_code == 201:
            return resp.json().get("html_url")
        return None
