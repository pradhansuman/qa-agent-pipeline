"""
Agent 2 — Scaffolder  (Filesystem MCP)
────────────────────────────────────────
PRDAnalysis + TestPlan  →  full Playwright TypeScript project on disk

Creates:
  <output_dir>/
  ├── playwright.config.ts
  ├── tsconfig.json
  ├── package.json
  ├── pages/
  │   └── <FeatureName>Page.ts   (one POM per feature)
  ├── tests/
  │   └── <feature>.spec.ts      (one spec per feature group)
  └── utils/
      └── helpers.ts
"""
from __future__ import annotations
import json, os, sys, textwrap
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from anthropic import Anthropic
from agents.base import Agent
from mcp_framework.contracts import (
    PRDInput, PRDAnalysis, TestPlan, TestScenario,
    ScaffoldResult, GeneratedFile,
)

# ── code-generation prompt ────────────────────────────────────────────────────
_GEN_PROMPT = """\
You are a world-class Playwright/TypeScript automation engineer.

Generate a COMPLETE, RUNNABLE Playwright test suite from the analysis and plan
below.  Return ONLY a valid JSON object with this exact shape:

{{
  "files": [
    {{
      "path": "pages/CartPage.ts",
      "kind": "pom",
      "content": "<full TypeScript source>"
    }},
    {{
      "path": "tests/cart.spec.ts",
      "kind": "spec",
      "content": "<full TypeScript source>"
    }}
  ]
}}

STRICT RULES — these are non-negotiable:
1.  Import ONLY from '@playwright/test'. NO relative local imports (they fail
    with this toolchain). Inline all POM classes and helpers inside each spec
    file that needs them.
2.  Every spec file must start with:
        import {{ test, expect, Page, Locator }} from '@playwright/test';
3.  Use worker-scoped shared page fixture to navigate ONCE per worker and
    reset state via page.evaluate() between tests — this is the performance
    pattern in use.  Template:
        const test = base.extend<{{}}, {{ sharedPage: Page }}>({{
          sharedPage: [async ({{ browser }}, use) => {{
            const ctx  = await browser.newContext();
            const pg   = await ctx.newPage();
            await pg.goto(BASE_URL, {{ waitUntil: 'domcontentloaded' }});
            await use(pg);
            await pg.close(); await ctx.close();
          }}, {{ scope: 'worker' }}],
          page: async ({{ sharedPage }}, use) => {{
            await resetState(sharedPage);
            await use(sharedPage);
          }},
        }});
4.  Keep POM classes inline in the same spec file — no cross-file imports.
5.  Every test must follow Arrange-Act-Assert.
6.  Use page.locator(), getByText(), getByRole() where natural.
7.  Add test.describe() grouping that mirrors the test plan features.
8.  Checkouts / dialogs must use page.once('dialog', …).
9.  Generate EXACTLY the test scenarios from the plan — one test per scenario.
10. Generate a pages/ POM file AND a tests/ spec file for each DISTINCT feature
    group in the plan. Keep the spec self-contained per rule 1.
11. Do NOT generate playwright.config.ts or tsconfig.json — those are handled
    separately.

APP URL  : {app_url}
APP NAME : {app_name}

TEST PLAN:
{plan_json}

PRD ANALYSIS (selector hints):
{analysis_json}
"""


class ScaffolderAgent(Agent):
    NAME   = "Scaffolder"
    SYSTEM = "You are a Playwright/TypeScript expert. Output only valid JSON."

    def __init__(self, model: str):
        super().__init__(client=Anthropic(), model=model)

    # ── public API ────────────────────────────────────────────────────────
    def scaffold(self, inp: PRDInput, analysis: PRDAnalysis, plan: TestPlan) -> ScaffoldResult:
        out_dir = os.path.abspath(inp.output_dir)
        os.makedirs(out_dir, exist_ok=True)

        # 1. Write static config files
        static_files = self._static_files(inp, analysis)
        for f in static_files:
            self._write(out_dir, f)

        # 2. LLM generates test code
        generated = self._generate_code(inp, analysis, plan)
        for f in generated:
            self._write(out_dir, f)

        all_files  = static_files + generated
        spec_files = [f.path for f in all_files if f.kind == "spec"]
        test_count = self._count_tests(generated)

        return ScaffoldResult(
            output_dir=out_dir,
            files_created=[f.path for f in all_files],
            test_count=test_count,
            spec_files=spec_files,
        )

    # ── private helpers ───────────────────────────────────────────────────
    def _generate_code(
        self, inp: PRDInput, analysis: PRDAnalysis, plan: TestPlan
    ) -> list[GeneratedFile]:
        prompt = _GEN_PROMPT.format(
            app_url     = inp.app_url,
            app_name    = inp.app_name,
            plan_json   = plan.model_dump_json(indent=2),
            analysis_json = analysis.model_dump_json(indent=2),
        )
        raw = self._complete_json(prompt, _CodeGenRaw, max_tokens=16000)
        return [
            GeneratedFile(path=f.path, content=f.content, kind=f.kind)
            for f in raw.files
        ]

    def _static_files(self, inp: PRDInput, analysis: PRDAnalysis) -> list[GeneratedFile]:
        headless_str = str(inp.headless).lower()
        return [
            GeneratedFile(
                path="playwright.config.ts", kind="config",
                content=textwrap.dedent(f"""\
                    import {{ defineConfig, devices }} from '@playwright/test';

                    export default defineConfig({{
                      testDir: './tests',
                      fullyParallel: false,
                      workers: {inp.workers},
                      retries: 1,
                      timeout: 10000,
                      expect: {{ timeout: 3000 }},
                      reporter: [
                        ['list'],
                        ['html', {{ outputFolder: 'playwright-report', open: 'never' }}],
                      ],
                      use: {{
                        baseURL: '{inp.app_url}',
                        headless: {headless_str},
                        trace: 'on-first-retry',
                        screenshot: 'only-on-failure',
                        video: 'off',
                        actionTimeout: 5000,
                        navigationTimeout: 8000,
                        launchOptions: {{
                          args: ['--no-sandbox', '--disable-dev-shm-usage'],
                        }},
                      }},
                      projects: [
                        {{ name: 'chromium', use: {{ ...devices['Desktop Chrome'] }} }},
                      ],
                    }});
                    """),
            ),
            GeneratedFile(
                path="tsconfig.json", kind="config",
                content=json.dumps({
                    "compilerOptions": {
                        "target": "ES2020",
                        "module": "commonjs",
                        "moduleResolution": "node",
                        "strict": True,
                        "esModuleInterop": True,
                        "resolveJsonModule": True,
                        "outDir": "dist",
                        "baseUrl": "."
                    },
                    "include": ["tests/**/*.ts", "pages/**/*.ts",
                                "utils/**/*.ts", "playwright.config.ts"]
                }, indent=2),
            ),
            GeneratedFile(
                path="package.json", kind="config",
                content=json.dumps({
                    "name": inp.app_name.lower().replace(" ", "-") + "-e2e",
                    "version": "1.0.0",
                    "private": True,
                    "scripts": {
                        "test": "npx playwright test",
                        "test:headed": "npx playwright test --headed",
                        "report": "npx playwright show-report"
                    },
                    "devDependencies": {
                        "@playwright/test": "^1.44.0",
                        "typescript": "^5.4.0"
                    }
                }, indent=2),
            ),
            GeneratedFile(
                path="utils/helpers.ts", kind="util",
                content=textwrap.dedent("""\
                    import { Page } from '@playwright/test';

                    /** Wait for the page to be in a stable, interactive state. */
                    export async function waitForStable(page: Page, ms = 300): Promise<void> {
                      await page.waitForLoadState('domcontentloaded');
                      await page.waitForTimeout(ms);
                    }

                    /** Accept the next browser dialog and return its message. */
                    export async function acceptNextDialog(page: Page): Promise<string> {
                      return new Promise(resolve => {
                        page.once('dialog', async d => {
                          resolve(d.message());
                          await d.accept();
                        });
                      });
                    }
                    """),
            ),
        ]

    @staticmethod
    def _write(out_dir: str, f: GeneratedFile) -> None:
        abs_path = os.path.join(out_dir, f.path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as fh:
            fh.write(f.content)

    @staticmethod
    def _count_tests(files: list[GeneratedFile]) -> int:
        total = 0
        for f in files:
            if f.kind == "spec":
                total += f.content.count("\ntest(") + f.content.count("\n  test(")
        return max(total, 1)


# ── internal schema ───────────────────────────────────────────────────────────
from pydantic import BaseModel

class _FileMeta(BaseModel):
    path: str
    kind: str = "spec"
    content: str

class _CodeGenRaw(BaseModel):
    files: list[_FileMeta]
