# AI-Assisted QA Framework — 5-Agent Pipeline

From a real GitHub issue to a passing/failing test report — fully automated.

```
IssueRef ─▶ Ingestor ─▶ Planner ─▶ Generator ─▶ Runner ─▶ Healer ─▶ Reporter ─▶ ReportArtifact
           (GitHub)     (LLM)       (LLM)        (Playwright) (LLM)    (LLM+rules)
```

Every arrow is a typed Pydantic contract (`contracts/schemas.py`). Agents
share nothing but these models, so any stage can be mocked, swapped, or re-run
in isolation.

---

## The six agents

| # | Agent | LLM? | Input → Output | Responsibility |
|---|-------|------|----------------|----------------|
| 1 | `IngestorAgent` | No | `IssueRef → IssuePayload` | Hit the GitHub REST API, normalise the issue, infer priority/type/component from labels (rule-based, auditable). |
| 2 | `PlannerAgent` | Yes | `IssuePayload → TestPlan` | Decide *what* to test. 3–6 prioritised scenarios with concrete steps. Escalates priority independently of the issue label. |
| 3 | `GeneratorAgent` | Yes | `TestPlan → GeneratedSuite` | Decide *how* to test. Emit runnable Playwright + TypeScript with Allure annotations. Security-guarded prompt. |
| 4 | `RunnerAgent` | No | `GeneratedSuite → RunResults` | Execute via the Playwright CLI, parse the JSON reporter, roll up pass/fail. `real=False` gives a deterministic simulation for demos. |
| 4.5 | `HealerAgent` | Yes | `RunResults → RunResults + log` | Triage each failure; repair stale **selectors** grounded in the live DOM, patch the file, re-run that one test. Never touches assertion failures. |
| 5 | `ReporterAgent` | Yes | `RunResults → ReportArtifact` | Write the PR-reviewer narrative. The **merge-gate decision is rule-based**, never left to model phrasing. |

### How self-healing works (and what it refuses to do)

The `HealerAgent` runs only when there are failures, and only acts on
**locator** failures — a selector that no longer matches the DOM because the UI
changed. For each one it:

1. classifies the failure (rule-based: locator / assertion / timeout / other),
2. pulls the broken selector and a snapshot of the **current DOM**,
3. asks Claude for a repaired selector *grounded in what actually exists*,
4. patches the test file and re-runs that single test,
5. logs the `old → new` selector, rationale, and confidence.

Three guardrails make this safe to put in CI:

- **Assertion failures are never healed.** A failing `expect()` means the code
  is wrong or the spec changed — silently "fixing" it would hide a real bug.
  The Healer marks it `healable=False`, leaves it red, and never even calls the
  LLM (verified by test).
- **A heal only counts if the re-run passes.** A repaired selector that still
  fails stays failed.
- **Nothing is rewritten invisibly.** Every heal is in `self_healing_log` with
  full before/after, so a reviewer can audit exactly what the agent changed.

### Why two agents don't use the LLM

Ingestion and execution must be **ground truth**. We never want a model to
invent an issue number or soften a failing test. The LLM is used only where
judgement adds value: deciding what to test, writing the test code, and
explaining the results.

### Why the gate is rule-based

`ReporterAgent._gate()` blocks merge if **any P0 fails** or the pass rate drops
below 90%. The LLM writes the human summary around that decision but cannot
override it — a hallucinated "looks good!" can never merge a broken build.

---

## Agent prompts & contracts at a glance

Each agent file is self-documenting: the module docstring states the I/O
contract, and the `SYSTEM` constant is the full prompt. Read them in order:

1. `agents/ingestor.py`  — no prompt; GitHub API + label inference
2. `agents/planner.py`   — "decide WHAT to test, never write code"
3. `agents/generator.py` — "convert plan to Playwright TS, never weaken security"
4. `agents/runner.py`    — no prompt; Playwright CLI + JSON parse
5. `agents/reporter.py`  — "write the PR summary"; gate lives in code

---

## Run it

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...

# pull a real public issue, plan + generate + simulate + heal + report
python -m orchestrator.pipeline facebook/react 28000

# with a GitHub token (private repos / rate limits) and a real Playwright run
python -m orchestrator.pipeline myorg/app 1042 --token ghp_xxx --real
```

### Offline demo mode (no API key, no credit)

Every LLM agent can be stubbed with canned, in-repo responses so the whole
six-stage pipeline runs with no Anthropic key, no credit, and (with `--offline`)
no internet. Same code paths, same contracts, same self-heal cycle — only the
model's judgement is pre-baked. Ideal for live demos and CI smoke tests.

```bash
# full pipeline, canned LLM output, still pulls the real GitHub issue
python -m orchestrator.pipeline demo/app 1042 --demo

# fully offline — also stubs the GitHub issue
python -m orchestrator.pipeline --demo --offline
```

Expected offline output:

```
  [ ingested] ok
  [  planned] ok
  [generated] ok
  [   tested] ok
  [   healed] ok
  [ reported] ok

Issue #1042: Login form allows empty email submission
Plan: 5 scenarios, risk=high
Run:  5/5 passed (100.0%)
Heal: 1 recovered by self-healing agent
        TC-002: [data-testid="submit-btn"] -> [data-testid="login-submit"] (conf 0.93)
Gate: PASS
```

---

## Deploy to CI

`.github/workflows/qa-pipeline.yml` triggers when an issue is labelled
`qa-ready`. Each agent is a job; the Planner's output flows to the Generator
via job outputs; the Runner job runs inside the official Playwright Docker
image; the Reporter posts its `issue_comment` back on the issue and the gate
decision sets the job's exit status.

```
issues: [labeled qa-ready]
  └─ plan ─▶ generate ─▶ test (Docker) ─▶ report ─▶ comment + gate
```

See `Dockerfile` for the test container and the workflow file for the wiring.

---

## Project layout

```
qa-agents/
├── contracts/
│   └── schemas.py              # all I/O models — the single source of truth
├── agents/
│   ├── base.py                 # shared Claude plumbing + JSON-mode validation
│   ├── ingestor.py             # 1 · GitHub API
│   ├── planner.py              # 2 · what to test
│   ├── generator.py            # 3 · how to test
│   ├── runner.py               # 4 · Playwright execution + DOM provider
│   ├── healer.py               # 4.5 · self-healing selector repair
│   ├── reporter.py             # 5 · summary + gate
│   └── demo_stubs.py           # canned LLM responses for offline demo mode
├── orchestrator/
│   └── pipeline.py             # chains all five, CLI entry point
├── mcp_framework/              # extended MCP pipeline (PRD → tests → Jira/Slack/Git)
│   ├── config.py               # all env-var config in one dataclass
│   ├── contracts.py            # Pydantic I/O contracts for MCP agents
│   ├── orchestrator.py         # 7-agent MCP router
│   ├── run.py                  # CLI entry point for MCP pipeline
│   └── agents/
│       ├── analyzer.py         # reads PRD → produces analysis + test plan
│       ├── scaffolder.py       # generates Playwright TS project on disk
│       ├── executor.py         # runs Playwright CLI, parses results
│       ├── healer.py           # self-healing for MCP-generated tests
│       ├── gitops.py           # commits tests, opens GitHub PR
│       ├── jira.py             # files Jira tickets for genuine failures
│       └── slack.py            # Slack notifications (start + result)
├── council.py                  # 5-agent deliberation system (Researcher · Creative
│                               # · Critic · Safety Guard · Synthesizer)
├── generated/                  # example AI-generated Playwright test suites
│   ├── shopnow/                # ShopNow e-commerce demo
│   └── speedtest/              # Speedtest.net feature coverage
├── store.html                  # standalone dark-mode storefront demo UI
├── Dockerfile
├── requirements.txt
└── .github/workflows/
    ├── qa-pipeline.yml         # triggers on issues: [labeled qa-ready]
    └── playwright.yml          # standard Playwright CI workflow
```

---

## Multi-Agent Council (`council.py`)

A standalone 5-agent deliberation system. Any question is debated across two rounds before a final answer is synthesised.

```
User question
  → Researcher  (Round 1 — facts)
  → Creative    (Round 1 — novel angles)
  → Critic      (Round 1 — challenges assumptions)
  → Researcher  (Round 2 — responds to peers)
  → Creative    (Round 2 — responds to peers)
  → Critic      (Round 2 — responds to peers)
  → Safety Guard (audits all 6 statements)
  → Synthesizer  (final unified answer)
```

```bash
# Live — real Claude API calls
export ANTHROPIC_API_KEY=sk-ant-...
python council.py

# Demo — no API key required, shows the full flow with sample responses
python council.py --demo
```
