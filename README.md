# Zero to Test — AI-Powered QA Pipeline

[![Playwright Tests](https://github.com/pradhansuman/zero-to-test-ai/actions/workflows/playwright.yml/badge.svg)](https://github.com/pradhansuman/zero-to-test-ai/actions/workflows/playwright.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.44-green.svg)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, multi-agent QA framework that takes a GitHub issue and delivers a complete, executed, self-healing Playwright test suite — with zero human intervention in between.

```
GitHub Issue ──▶ Ingestor ──▶ SDET Designer ──▶ Generator ──▶ Reviewer ──▶ Runner ──▶ Healer ──▶ Reporter
                  (API)        (formal BVA/EP)    (LLM)       (LLM critic)  (PW CLI)   (LLM)      (rule gate)
```

---

## Features

| Capability | Details |
|---|---|
| **7-agent pipeline** | Ingestor → SDET Designer → Generator → Reviewer → Runner → Healer → Reporter |
| **Iterative critic loop** | Reviewer audits generated suite; if verdict is "revise/reject", Generator gets one refinement pass with `top_3_fixes` injected |
| **Self-healing locators** | Detects selector drift, repairs via LLM grounded in live DOM, re-runs patched test. Never heals assertion failures |
| **Richer failure classification** | `LOCATOR` · `ASSERTION` · `ENVIRONMENT` · `FLAKY` · `TIMEOUT` · `OTHER` — rule-based, auditable, no LLM |
| **Visual regression** | 14 `toHaveScreenshot()` tests with 2% pixel tolerance + committed PNG baselines |
| **Multi-browser** | Desktop Chrome · Mobile Chrome (Pixel 7) · Mobile Safari (iPhone 14 via CI) |
| **Full test pyramid** | 7 suites: golden E2E, API/HTTP, performance, security, endurance loops, visual, load (k6) |
| **Dynamic test prioritization** | `git diff` → grep pattern; cuts CI from ~8 min to < 2 min on minor changes |
| **MCP server** | Real stdio JSON-RPC server — register in Claude desktop to control the pipeline via natural language |
| **Rule-based gate** | `ReporterAgent._gate()`: any P0 fail or pass rate < 90% → FAIL. LLM writes the narrative, never makes the decision |

---

## What You Can Achieve

### 1. Zero-Touch QA from a GitHub Issue
Point it at any public repo and issue number — the pipeline ingests, plans, generates runnable Playwright tests, executes them, repairs broken selectors, and delivers a pass/fail gate with a written report. No human writes a single line of test code.

```bash
python -m orchestrator.pipeline facebook/react 28000 --token ghp_xxx --real
```

### 2. Formal SDET Test Design at Scale
Switch `--sdet` on and the `TestDesignerAgent` applies Boundary Value Analysis, Equivalence Partitioning, Decision Tables, Pairwise, and Error Guessing — the same techniques a senior SDET would use, derived automatically from acceptance criteria in seconds.

### 3. Self-Healing Test Maintenance
When the UI changes and a selector breaks, the `HealerAgent` detects it (locator failure, not assertion), consults the live DOM, asks Claude for a repaired selector, patches the file, and re-runs. The old→new selector and confidence score are logged for human audit. Broken builds due to CSS class renames or `data-testid` changes become automatic fixes.

### 4. Production-Grade Test Pyramid on a Live App
The math hub proves the framework works against a real deployed SPA — 196 E2E tests across 3 browsers, 19 HTTP/API contract tests, 16 performance tests (TTFB, in-browser widget timing), 17 security tests (no eval, XSS guards, storage leakage), 12 endurance loop tests (30-iteration accuracy drift, 50-click idempotency), 14 visual regression tests with pixel diff baselines, and a full k6 load test suite with 5 scenarios up to 200 VUs.

### 5. CI That Gets Smarter on Each PR
The prioritization script reads the git diff and tells CI exactly which test groups are at risk — if you only touched `math-hub-perf.spec.ts`, only the performance suite runs. A full 600+ test run becomes a targeted 30-test run on minor changes, without ever skipping something that could actually break.

### 6. Control the Entire QA Pipeline via Natural Language
Register `mcp_server/server.py` in Claude desktop and say: *"Run the security tests on Mobile Chrome and explain any failures"* — the MCP tools execute Playwright, parse results, classify each failure with rationale and next action, and return structured JSON, all without leaving the chat.

### 7. PRD → Tests → Jira → Slack → GitHub PR (Full Enterprise Loop)
The `mcp_framework/` extends the core pipeline: ingest a PRD, generate and scaffold a Playwright project on disk, execute it, file Jira tickets for genuine failures, open a GitHub PR with the test code, and post a Slack notification with the gate result.

### 8. Multi-Agent Deliberation on Any Question
`council.py` is a standalone 5-agent debate system — independent of the QA pipeline. It is useful for any structured decision-making, risk analysis, or architectural review where you want multiple AI perspectives pressure-tested by a Safety Guard before converging on a synthesised answer.

---

## Quick Start

### Prerequisites

| Tool | Min version | Check |
|---|---|---|
| Python | 3.10 | `python3 --version` |
| Node.js | 18 | `node --version` |
| k6 (load tests) | any | `k6 version` · `brew install k6` |

### Install

```bash
git clone https://github.com/pradhansuman/zero-to-test-ai.git
cd zero-to-test-ai

pip install -r requirements.txt
npm install
npx playwright install chromium
```

### Try it instantly — no API key needed

```bash
python -m orchestrator.pipeline --demo --offline
```

Expected output:
```
  [ ingested] ok   [ planned] ok   [generated] ok
  [  tested] ok   [  healed] ok   [ reported] ok

Issue #1042: Login form allows empty email submission
Run:  5/5 passed (100.0%)
Heal: 1 recovered  TC-002: [data-testid="submit-btn"] → [data-testid="login-submit"] (conf 0.93)
Gate: PASS
```

### Run against a real GitHub issue

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python -m orchestrator.pipeline facebook/react 28000 --token ghp_xxx
```

### Run with real Playwright execution

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python -m orchestrator.pipeline myorg/app 1042 --real
```

---

## Math Hub Test Suite (CBSE Class 8)

A complete test pyramid against a live GitHub Pages SPA — all suites run in CI.

### Run all suites

```bash
# Full pyramid — Desktop Chrome + Mobile Chrome
npx playwright test --config playwright.math-hub.config.ts

# Single suite
npx playwright test --config playwright.math-hub.config.ts tests/e2e/math-hub-api.spec.ts

# Headed (browser window visible)
npx playwright test --config playwright.math-hub.config.ts --headed
```

### Test pyramid

| Suite | File | Tests | What it validates |
|---|---|---|---|
| **Golden E2E** | `math-hub.spec.golden.ts` | 98 × 3 browsers | All 16 chapters, MCQ engine, widgets, navigation |
| **API / HTTP** | `math-hub-api.spec.ts` | 19 | Status codes, HTTPS/HSTS, ETag caching, self-containment |
| **Performance** | `math-hub-perf.spec.ts` | 16 | TTFB < 3s, widget latency < 50ms (in-browser), DOM complexity |
| **Security** | `math-hub-security.spec.ts` | 17 | No eval(), textContent vs innerHTML, no storage leakage |
| **Endurance loops** | `math-hub-loop.spec.ts` | 12 | 30-iter accuracy, 50-click idempotency, 30× canvas redraw |
| **Visual regression** | `math-hub-visual.spec.ts` | 14 | Screenshot diff, canvas charts, MCQ states, mobile layout |
| **Load (k6)** | `tests/load/math-hub.k6.js` | — | CDN p95 < 27ms, 0% error, 50% ETag cache hit |

### Visual regression baselines

Baselines are committed in `tests/e2e/__snapshots__/`. To regenerate after intentional UI changes:

```bash
npx playwright test --config playwright.math-hub.config.ts \
  tests/e2e/math-hub-visual.spec.ts --update-snapshots
```

### Load testing with k6

```bash
k6 run tests/load/math-hub.k6.js                         # smoke:  5 VUs / 20s
k6 run --env SCENARIO=steady tests/load/math-hub.k6.js   # steady: 50 VUs / 60s hold
k6 run --env SCENARIO=spike  tests/load/math-hub.k6.js   # spike:  burst to 100 VUs
k6 run --env SCENARIO=stress tests/load/math-hub.k6.js   # stress: ramp to 200 VUs
k6 run --env SCENARIO=soak   tests/load/math-hub.k6.js   # soak:   20 VUs / 10 min
```

### Dynamic test prioritization

Run only the tests at risk from your current diff — cuts CI time on minor PRs:

```bash
# Compute grep pattern from current diff and run
GREP=$(python scripts/prioritize_tests.py)
npx playwright test --config playwright.math-hub.config.ts --grep "$GREP"

# Full JSON report showing which rules fired and why
python scripts/prioritize_tests.py --json
```

---

## Agent Architecture

Every agent hand-off is a typed **Pydantic model** in `contracts/schemas.py` — the single source of truth. Agents never import each other's internals.

### Pipeline stages

| # | Agent | LLM? | Responsibility |
|---|---|---|---|
| 1 | `IngestorAgent` | No | GitHub REST API → normalise issue, infer priority/type from labels (rule-based) |
| 2 | `TestDesignerAgent` | Yes | Apply formal test-design: EP, BVA, Decision Table, Pairwise, Error Guessing |
| 2b | `StrategistAgent` | Yes | Alternative planner — risk-based scenario selection (default without `--sdet`) |
| 3 | `GeneratorAgent` | Yes | `TestPlan → GeneratedSuite`; accepts `reviewer_feedback` on revision pass |
| 3.5 | `ReviewerAgent` | Yes | 8-dimension audit; `verdict: ship \| revise \| reject`; feeds `top_3_fixes` back |
| 4 | `RunnerAgent` | No | Playwright CLI + multi-project config generation (Desktop/Mobile/Tablet) |
| 4.5 | `HealerAgent` | Selective | Classifies failures; LLM called only for `LOCATOR` to repair selectors |
| 5 | `ReporterAgent` | Yes | Narrative summary; gate is pure rule-based code — LLM never decides |

### Failure classification

`classify_failure()` in `agents/healer.py` is deterministic, rule-based, and ordering-critical:

```
ASSERTION   first — "expect(locator...)" messages contain "locator"; never heal these
ENVIRONMENT before TIMEOUT — ECONNREFUSED/OOM/browser-crash also say "timeout" but are infra
LOCATOR     — selector drifted; healable by the LLM
TIMEOUT     — pure wait exhaustion; retry candidate
FLAKY       — passed on retry; detected via classify_flaky(passed, retries > 0)
OTHER       — inspect full log
```

### Iterative critic refinement loop

```
Generator ──▶ Reviewer
                │
          verdict == "revise" or "reject"?
                │  yes
                ▼
          Generator (top_3_fixes injected as REVISION REQUIRED note)
                │
                ▼
          Reviewer (second pass — emitted for audit trail)
                │
                ▼
          Runner (suite always runs — verdict never gates execution)
```

`PipelineTrace.generation_passes` is `1` normally, `2` when a revision fired.

---

## MCP Server

Expose the full pipeline as tools callable from Claude desktop, VS Code, or any MCP-compatible host.

### Register in Claude desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa-pipeline": {
      "command": "python",
      "args": ["/absolute/path/to/zero-to-test-ai/mcp_server/server.py"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

### Available tools

| Tool | Example prompt |
|---|---|
| `run_pipeline` | "Run QA against facebook/react issue 28000" |
| `run_playwright_tests` | "Run the security test suite on Desktop Chrome" |
| `prioritize_tests` | "Which tests should I run for this PR?" |
| `explain_failure` | "What does this Playwright error mean and what should I do?" |
| `list_test_suites` | "What test suites are available?" |

---

## CLI Reference

```bash
# Real GitHub issue + simulated Playwright
python -m orchestrator.pipeline facebook/react 28000

# With GitHub token + real browser execution
python -m orchestrator.pipeline myorg/app 1042 --token ghp_xxx --real

# Formal SDET test-design techniques (EP, BVA, pairwise…)
python -m orchestrator.pipeline myorg/app 1042 --sdet

# Skip Reviewer audit (saves one LLM call)
python -m orchestrator.pipeline myorg/app 1042 --no-review

# Demo — canned LLM responses, still hits GitHub
python -m orchestrator.pipeline demo/app 1042 --demo

# Fully offline — no internet, no API key
python -m orchestrator.pipeline --demo --offline
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for real LLM calls |
| `QA_AGENT_MODEL` | `claude-sonnet-4-20250514` | Model used by all LLM agents |
| `QA_TARGET_URL` | `https://demoqa.com` | App URL injected into Generator prompt |
| `MOBILE_ENABLED` | `true` | Set `false` to disable mobile browser targets |

---

## Multi-Agent Council

A standalone 5-agent deliberation system for any open-ended question. Two debate rounds, a Safety Guard audit, then a synthesised final answer.

```
Question → Researcher → Creative → Critic (Round 1)
         → Researcher → Creative → Critic (Round 2 — responding to peers)
         → Safety Guard (audits all 6 statements)
         → Synthesizer (final unified answer)
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python council.py

# No API key:
python council.py --demo
```

---

## Repository Structure

```
zero-to-test-ai/
│
├── 📋 ROOT CONFIG & DOCS
│   ├── README.md                        ← Full project docs, badges, usage guide
│   ├── CLAUDE.md                        ← Claude Code instructions for this repo
│   ├── LICENSE                          ← MIT License
│   ├── requirements.txt                 ← Python deps (anthropic, pydantic, mcp, pytest…)
│   ├── pytest.ini                       ← pytest config (testpaths, markers)
│   ├── tsconfig.json                    ← TypeScript compiler config for Playwright
│   ├── types.d.ts                       ← Global TS type declarations
│   ├── rerun.sh                         ← Helper: trigger CI on a GitHub issue via gh CLI
│   ├── Dockerfile                       ← Playwright container image for CI
│   ├── playwright.config.ts             ← Default config (targets store.html demo)
│   └── playwright.math-hub.config.ts    ← Math hub config (6 suites, multi-browser)
│
├── 🤖 CORE AI PIPELINE
│   │
│   ├── contracts/
│   │   ├── schemas.py                   ← THE source of truth — every Pydantic model
│   │   │                                  (IssueRef, TestPlan, GeneratedSuite,
│   │   │                                   RunResults, FailureKind, HealingAttempt…)
│   │   └── exceptions.py               ← Custom exception types
│   │
│   ├── agents/
│   │   ├── base.py                      ← Shared Claude plumbing: _complete(),
│   │   │                                  _complete_json() with retry + JSON parsing
│   │   ├── ingestor.py                  ← Stage 1: GitHub REST API → IssuePayload
│   │   │                                  (no LLM; label→priority rules)
│   │   ├── designer.py                  ← Stage 2a: Formal SDET test design
│   │   │                                  (EP, BVA, Decision Table, Pairwise,
│   │   │                                   Error Guessing, State Transition)
│   │   ├── strategist.py                ← Stage 2b: Risk-based planner (default path)
│   │   ├── generator.py                 ← Stage 3: TestPlan → Playwright TypeScript
│   │   │                                  Accepts reviewer_feedback on revision pass
│   │   ├── reviewer.py                  ← Stage 3.5: 8-dimension suite audit
│   │   │                                  (verdict: ship | revise | reject + top_3_fixes)
│   │   ├── runner.py                    ← Stage 4: Playwright CLI executor
│   │   │                                  Multi-project config (Desktop/Mobile/Tablet)
│   │   ├── healer.py                    ← Stage 4.5: classify_failure() + LLM selector repair
│   │   │                                  LOCATOR|ASSERTION|ENVIRONMENT|FLAKY|TIMEOUT|OTHER
│   │   ├── reporter.py                  ← Stage 5: Narrative + rule-based gate
│   │   │                                  (LLM writes summary; Python decides PASS/FAIL)
│   │   └── demo_stubs.py               ← Canned LLM responses for offline demo mode
│   │
│   ├── orchestrator/
│   │   └── pipeline.py                  ← Chains all 7 agents; iterative critic loop;
│   │                                      CLI entry: python -m orchestrator.pipeline
│   │
│   └── config/
│       └── settings.py                  ← Env-var config dataclass
│                                          (model, mobile_enabled, target_url…)
│
├── 🔌 MCP SERVER
│   └── mcp_server/
│       └── server.py                    ← Real stdio JSON-RPC server (MCP SDK 1.28)
│                                          Tools: run_pipeline, run_playwright_tests,
│                                          prioritize_tests, explain_failure,
│                                          list_test_suites
│                                          Register in Claude desktop → control the
│                                          entire pipeline via natural language
│
├── 🏗️ EXTENDED MCP FRAMEWORK
│   └── mcp_framework/
│       ├── config.py                    ← All integration config (Jira, Slack, GitHub)
│       ├── contracts.py                 ← Pydantic models for the MCP pipeline
│       ├── orchestrator.py              ← 7-agent PRD→tests→Jira/Slack/Git pipeline
│       ├── run.py                       ← CLI for the MCP framework
│       └── agents/
│           ├── analyzer.py             ← Reads PRD → test analysis
│           ├── scaffolder.py           ← Writes Playwright project to disk
│           ├── executor.py             ← Runs Playwright CLI
│           ├── healer.py               ← Self-healing (MCP variant)
│           ├── gitops.py               ← Commits tests, opens GitHub PR
│           ├── jira.py                 ← Files Jira tickets for genuine failures
│           └── slack.py                ← Slack start/result notifications
│
├── 🧪 TEST SUITES
│   └── tests/
│       ├── e2e/
│       │   ├── math-hub.spec.golden.ts      ← 98 E2E tests × 3 browsers
│       │   │                                   All 16 CBSE chapters, MCQ engine,
│       │   │                                   calculators, navigation
│       │   ├── math-hub-api.spec.ts          ← 19 HTTP tests: status, HTTPS,
│       │   │                                   HSTS, ETag, self-containment
│       │   ├── math-hub-perf.spec.ts         ← 16 perf tests: TTFB, widget
│       │   │                                   latency (in-browser), DOM size
│       │   ├── math-hub-security.spec.ts     ← 17 security tests: no eval(),
│       │   │                                   textContent vs innerHTML,
│       │   │                                   no storage leakage, XSS guards
│       │   ├── math-hub-loop.spec.ts         ← 12 endurance tests: 30-iter
│       │   │                                   accuracy, 50-click idempotency,
│       │   │                                   30× canvas redraw stability
│       │   ├── math-hub-visual.spec.ts       ← 14 visual regression tests
│       │   │                                   (toHaveScreenshot, 2% tolerance)
│       │   └── __snapshots__/               ← 14 committed baseline PNGs
│       │       └── Desktop-Chrome/
│       │           ├── full-page-load.png
│       │           ├── nav-bar.png
│       │           ├── score-bar-*.png
│       │           ├── ch01-*.png
│       │           ├── ch03-square-selected.png
│       │           ├── ch05-bar-chart.png
│       │           ├── ch05-pie-chart.png
│       │           ├── ch15-line-graph.png
│       │           └── mcq-*.png
│       ├── load/
│       │   └── math-hub.k6.js               ← k6 load test (5 scenarios:
│       │                                       smoke/steady/spike/stress/soak)
│       │                                       ETag revalidation, custom metrics
│       ├── unit/
│       │   ├── test_contracts.py            ← Pydantic model validation tests
│       │   ├── test_gate.py                 ← ReporterAgent gate rule tests
│       │   ├── test_mobile.py               ← BrowserTarget enum + config tests
│       │   └── test_triage.py               ← classify_failure() tests
│       ├── data/
│       │   └── products.json                ← Test data for store tests
│       ├── store.spec.ts                    ← Store demo E2E (basic flows)
│       ├── store-pom.spec.ts                ← Store demo with Page Object Model
│       └── store-extended.spec.ts           ← Store demo extended edge cases
│
├── 🛠️ SCRIPTS
│   └── scripts/
│       └── prioritize_tests.py              ← git diff → --grep pattern
│                                              8 risk rules, P0/P1 priority
│                                              Cuts CI from ~8 min to < 2 min on minor PRs
│
├── 💬 PROMPT VERSIONING
│   └── prompts/
│       ├── designer/v1.md                   ← Prompt history for TestDesignerAgent
│       ├── reviewer/v1.md                   ← Prompt history for ReviewerAgent
│       └── strategist/v1.md                 ← Prompt history for StrategistAgent
│
├── 🖥️ DEMO UIs
│   ├── math_hub.html                        ← CBSE Class 8 Maths SPA (live on GitHub Pages)
│   │                                          16 chapters, interactive calculators,
│   │                                          MCQ engine, HTML5 canvas charts
│   └── store.html                           ← Dark-mode e-commerce storefront demo
│                                              Cart, quantities, checkout — all in-memory
│
├── 💡 EXAMPLE AI-GENERATED SUITES
│   └── generated/
│       ├── shopnow/                         ← Full POM-based suite for ShopNow app
│       │   ├── pages/ShopNowPage.ts
│       │   ├── tests/shopnow.spec.ts
│       │   └── utils/helpers.ts
│       └── speedtest/                       ← 8-spec suite for Speedtest.net
│           ├── pages/SpeedtestPage.ts
│           └── tests/speedtest_*.spec.ts    (8 files)
│
├── 🤝 MULTI-AGENT COUNCIL
│   └── council.py                           ← 5-agent deliberation system
│                                              Researcher → Creative → Critic (×2 rounds)
│                                              → Safety Guard → Synthesizer
│
└── ⚙️ CI / CD
    └── .github/workflows/
        ├── playwright.yml                   ← 4-job test pyramid CI
        │                                      prioritize → playwright (6-suite matrix)
        │                                      → pipeline-smoke → summary
        └── qa-pipeline.yml                  ← Issue-label trigger (qa-ready)
                                               Runs full pipeline on labeled issues
```

---

## Key Design Constraints

These are enforced by code, not convention:

- **LLM never makes the gate decision.** `ReporterAgent._gate()` is pure Python. Any P0 failure or pass rate < 90% → `FAIL`. The narrative is LLM; the verdict is code.
- **Assertion failures are never healed.** `FailureKind.ASSERTION` is always `healable=False`. A failing `expect()` is a real bug, not a selector problem.
- **Contracts are the only shared interface.** Agents import only from `contracts/schemas.py`, never each other's internals.
- **Reviewer verdict is advisory.** It triggers a refinement pass but never blocks execution — the runner always runs.
- **Environment failures are not timeouts.** `ENVIRONMENT` is classified before `TIMEOUT` in `classify_failure()` — ordering is safety-critical.

---

## License

MIT — see [LICENSE](LICENSE).
