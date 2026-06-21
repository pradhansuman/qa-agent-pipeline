# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt
npm i -D @playwright/test allure-playwright

# Run the full pipeline against a real GitHub issue
export ANTHROPIC_API_KEY=sk-ant-...
python -m orchestrator.pipeline facebook/react 28000

# With a GitHub token + real Playwright execution
python -m orchestrator.pipeline myorg/app 1042 --token ghp_xxx --real

# Offline demo — no API key, no credit, no internet required
python -m orchestrator.pipeline --demo --offline

# Demo mode that still hits GitHub (no API key needed)
python -m orchestrator.pipeline demo/app 1042 --demo
```

## Architecture

The pipeline is a linear chain of five agents. Every hand-off is a **Pydantic model** defined in `contracts/schemas.py` — that file is the single source of truth for what each stage consumes and emits.

```
IssueRef → [Ingestor] → IssuePayload
         → [Planner]   → TestPlan
         → [Generator] → GeneratedSuite
         → [Runner]    → RunResults
         → [Healer]    → RunResults (patched) + list[HealingAttempt]
         → [Reporter]  → ReportArtifact
```

`orchestrator/pipeline.py` wires the chain. `QAPipeline.run()` calls each agent in order; the `on_stage` callback lets callers observe each artifact as it's produced (used by the CLI for progress output and by CI to surface intermediate artifacts).

### Agent responsibilities

| Agent | LLM? | Key design rule |
|---|---|---|
| `IngestorAgent` | No | Ground truth only — hits the GitHub REST API, infers priority/type/component from labels via rules, never a model |
| `PlannerAgent` | Yes | Decides *what* to test; may escalate priority beyond the issue label |
| `GeneratorAgent` | Yes | Emits runnable Playwright + TypeScript with Allure annotations; security-guarded prompt |
| `RunnerAgent` | No | Executes Playwright CLI, parses the JSON reporter; `real=False` runs a deterministic simulation |
| `HealerAgent` | Yes (selectively) | Triage is rule-based (`classify_failure`); LLM is called only for **locator** failures to repair selectors grounded in the live DOM |
| `ReporterAgent` | Yes (narrative only) | Gate decision (`_gate`) is rule-based: any P0 failure or pass rate < 90% → FAIL; the LLM writes the human summary around it |

### Base class (`agents/base.py`)

All LLM agents extend `Agent`. Key methods:
- `_complete()` — raw Claude call, returns `(text, stop_reason)`
- `_complete_json(prompt, schema, max_tokens)` — calls `_complete`, strips markdown fences, validates against a Pydantic model; retries once with doubled token budget if the response is truncated
- `_extract_json()` — static; strips fences and slices to outermost `{}` if the model adds prose

The model is controlled by the `QA_AGENT_MODEL` environment variable (default: `claude-sonnet-4-20250514`).

### Self-healing design

`HealerAgent` sits between Runner and Reporter. It only acts on `FailureKind.LOCATOR` failures — selector drift from UI changes. Assertion failures (`FailureKind.ASSERTION`) are **never healed** by design; they represent real bugs. A heal only counts if the re-run passes after the selector patch. Every attempt is recorded in `HealingAttempt` with `old_selector`, `new_selector`, `rationale`, and `confidence`.

### Demo / offline mode

`agents/demo_stubs.py` monkey-patches the four LLM agents on a live `QAPipeline` instance with canned responses. The Healer stub replaces only `_complete_json`, so all real triage, patch, and re-run logic still executes. This is the right pattern for testing new pipeline stages without spending API credit.

### CI (`qa-pipeline.yml`)

Triggers on `issues: [labeled]` when label is `qa-ready`. Runs inside the official Playwright Docker image (`mcr.microsoft.com/playwright:v1.44.0-jammy`). The gate decision is surfaced as a job output (`gate=pass|fail`) and `exit 1` enforces it. Allure results are published to GitHub Pages via `simple-elf/allure-report-action`.

## Store UI (`store.html`)

A standalone dark-mode HTML/CSS/JS storefront (no build step, open directly in a browser). It displays 10 products in a responsive grid with an emoji thumbnail, price, and "Add to Cart" button. A slide-in cart sidebar handles quantity controls, item removal, a running total, and a checkout confirmation. All state is in-memory (page reload resets the cart). No backend — intended as a demo UI only.

## Key constraints

- **Never let the LLM make the gate decision.** `ReporterAgent._gate()` must remain rule-based code.
- **Never heal assertion failures.** `FailureKind.ASSERTION` must always be `healable=False`.
- **Contracts are the only shared interface.** Agents must not import each other's internals — only `contracts/schemas.py` types cross agent boundaries.
- The `HealerAgent.min_confidence` threshold (default 0.6) is a safety lever; patches below it are skipped and the failure remains red for a human to review.
