# AI-Assisted QA Pipeline

[![Playwright Tests](https://github.com/pradhansuman/qa-agent-pipeline/actions/workflows/playwright.yml/badge.svg)](https://github.com/pradhansuman/qa-agent-pipeline/actions/workflows/playwright.yml)
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

## Quick Start

### Prerequisites

| Tool | Min version | Check |
|---|---|---|
| Python | 3.10 | `python3 --version` |
| Node.js | 18 | `node --version` |
| k6 (load tests) | any | `k6 version` · `brew install k6` |

### Install

```bash
git clone https://github.com/pradhansuman/qa-agent-pipeline.git
cd qa-agent-pipeline

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
      "args": ["/absolute/path/to/qa-agent-pipeline/mcp_server/server.py"],
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

## Project Layout

```
qa-agent-pipeline/
├── contracts/schemas.py            # all Pydantic I/O models — single source of truth
├── agents/
│   ├── base.py                     # Claude _complete() / _complete_json() / retry logic
│   ├── ingestor.py                 # GitHub REST API, no LLM
│   ├── designer.py                 # SDET formal test design (EP, BVA, pairwise…)
│   ├── strategist.py               # risk-based planner (alternative to designer)
│   ├── generator.py                # TestPlan → Playwright TS; accepts reviewer_feedback
│   ├── reviewer.py                 # 8-dimension audit; verdict + top_3_fixes
│   ├── runner.py                   # Playwright CLI + multi-project config generation
│   ├── healer.py                   # classify_failure() + LLM selector repair
│   ├── reporter.py                 # narrative + rule-based gate
│   └── demo_stubs.py               # canned offline responses
├── orchestrator/pipeline.py        # chains all agents; iterative critic loop; CLI
├── mcp_server/server.py            # real MCP stdio server (5 tools)
├── mcp_framework/                  # extended PRD→tests→Jira/Slack/Git pipeline
├── scripts/prioritize_tests.py     # git-diff → Playwright --grep pattern
├── tests/
│   ├── e2e/
│   │   ├── math-hub.spec.golden.ts     # 98 E2E tests (golden spec)
│   │   ├── math-hub-api.spec.ts        # 19 API/HTTP contract tests
│   │   ├── math-hub-perf.spec.ts       # 16 performance tests
│   │   ├── math-hub-security.spec.ts   # 17 security tests
│   │   ├── math-hub-loop.spec.ts       # 12 endurance / loop tests
│   │   ├── math-hub-visual.spec.ts     # 14 visual regression tests
│   │   └── __snapshots__/              # committed baseline PNGs
│   ├── load/math-hub.k6.js             # k6 load test (5 scenarios)
│   └── unit/                           # Python unit tests (pytest)
├── playwright.math-hub.config.ts   # multi-browser config for math hub suites
├── playwright.config.ts            # default Playwright config
├── math_hub.html                   # CBSE Class 8 demo SPA (live on GitHub Pages)
├── store.html                      # standalone e-commerce demo UI
├── council.py                      # 5-agent deliberation system
├── Dockerfile                      # Playwright container for CI
├── requirements.txt
└── .github/workflows/
    ├── playwright.yml              # full test pyramid CI (push + PR)
    └── qa-pipeline.yml             # issue-label trigger (qa-ready)
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
