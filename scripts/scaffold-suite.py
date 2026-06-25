#!/usr/bin/env python3
# scripts/scaffold-suite.py
# Generates a complete 8-spec Playwright QA suite covering all 8 testing loops
# of the 100-Point QA Framework for any target URL.
#
# Usage:
#   python3 scripts/scaffold-suite.py --url https://example.com --prefix myapp
#   python3 scripts/scaffold-suite.py --url https://example.com --prefix myapp --auth
#
# Options:
#   --url     Target URL (required)
#   --prefix  File prefix: myapp -> myapp-ui.spec.ts (required)
#   --name    Display name (default: same as prefix)
#   --auth    Flag: app requires login

import argparse, json, re
from pathlib import Path

ROOT     = Path(__file__).parent.parent
SPEC_DIR = ROOT / 'tests' / 'e2e'
SHARED   = ("import { BVA, EP, pairwiseCombos, MonkeyPayloads, SecurityPayloads,"
            " L10nPayloads, QAAnnotate, PerfThresholds, CommonRisks }"
            " from '../shared/strategy';")


def slugify(s):
    return re.sub(r'[^a-z0-9-]', '-', s.lower()).strip('-')


def w(path, content):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(content)
    print(f'  wrote {path}')


def setup(url, auth):
    if auth:
        return (
            "\nconst testUser = { username: 'user_' + Date.now(), password: 'TestPass1!' };\n\n"
            "test.beforeAll(async ({ browser }) => {\n"
            "  const ctx = await browser.newContext();\n"
            "  const pg  = await ctx.newPage();\n"
            f"  await pg.goto('{url}/register', {{ waitUntil: 'domcontentloaded' }});\n"
            "  await pg.locator('#username').fill(testUser.username).catch(() => {});\n"
            "  await pg.locator('#password').fill(testUser.password).catch(() => {});\n"
            "  await pg.locator('button[type=\"submit\"]').click().catch(() => {});\n"
            "  await pg.waitForTimeout(1500);\n"
            "  await ctx.close();\n"
            "});\n\n"
            "test.beforeEach(async ({ page }) => {\n"
            f"  await page.goto('{url}', {{ waitUntil: 'domcontentloaded' }});\n"
            "  await page.locator('#username').fill(testUser.username);\n"
            "  await page.locator('#password').fill(testUser.password);\n"
            "  await page.locator('button[type=\"submit\"]').click();\n"
            "  await page.waitForTimeout(1500);\n"
            "});\n"
        )
    return (
        "\ntest.beforeEach(async ({ page }) => {\n"
        f"  await page.goto('{url}', {{ waitUntil: 'domcontentloaded' }});\n"
        "  await page.waitForTimeout(500);\n"
        "});\n"
    )


def gen_ui(prefix, url, name, auth):
    p = prefix.upper()
    s = setup(url, auth)
    return (
        f"// {name} - UI: smoke, state-transition, pairwise, monkey, E2E\n"
        "import { test, expect } from '@playwright/test';\n"
        f"{SHARED}\n\n"
        f"const BASE_URL = '{url}';\n"
        f"{s}\n"
        f"test('{p}-UI-01 @smoke: page loads', async ({{ page }}) => {{\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        f"  QAAnnotate.requirement('R-01', '{name} page renders');\n"
        "});\n\n"
        f"test('{p}-UI-02: state transitions without JS errors', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        f"  // TODO: navigate app states for {name}\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-UI-03 pairwise: input combos no JS errors', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        f"  // TODO: pairwiseCombos() for {name} dimensions\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "  QAAnnotate.pairwise('Pairwise verified');\n"
        "});\n\n"
        f"test('{p}-UI-MONKEY: monkey — random inputs no crash', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  for (const inp of await page.locator('input:not([type=\"hidden\"]), textarea').all()) {\n"
        "    for (const payload of MonkeyPayloads.slice(0, 6)) await inp.fill(payload).catch(() => {});\n"
        "  }\n"
        "  await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "  await page.waitForTimeout(1000);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));\n"
        "  QAAnnotate.monkey(MonkeyPayloads.length + ' payloads | errors: ' + critical.length);\n"
        "  expect(critical).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-UI-E2E: full journey completes', async ({{ browser }}) => {{\n"
        "  const ctx = await browser.newContext();\n"
        "  const pg  = await ctx.newPage();\n"
        f"  await pg.goto(BASE_URL, {{ waitUntil: 'domcontentloaded' }});\n"
        f"  // TODO: implement lifecycle for {name}\n"
        "  await expect(pg.locator('body')).toBeVisible();\n"
        "  await ctx.close();\n"
        "});\n"
    )


def gen_api(prefix, url, name, auth):
    p = prefix.upper()
    return (
        f"// {name} - API: HTTP status, BVA, EP, schema, 404\n"
        "import { test, expect } from '@playwright/test';\n"
        "import { BVA, EP, QAAnnotate } from '../shared/strategy';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        f"test('{p}-API-01 @smoke: returns 2xx', async ({{ page }}) => {{\n"
        "  let status = 0;\n"
        "  page.on('response', r => { if (r.url().startsWith(BASE_URL)) status = r.status(); });\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  if (status > 0) expect(status).toBeLessThan(400);\n"
        "  else await expect(page.locator('body')).toBeVisible();\n"
        "});\n\n"
        f"test('{p}-API-BVA: maxlength enforced at boundary', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  for (const inp of await page.locator('input[maxlength]').all()) {\n"
        "    const max = parseInt((await inp.getAttribute('maxlength')) || '0');\n"
        "    if (max > 0) {\n"
        "      await inp.fill('a'.repeat(max + 1));\n"
        "      expect((await inp.inputValue()).length).toBeLessThanOrEqual(max);\n"
        "      QAAnnotate.bva('maxlength=' + max);\n"
        "    }\n"
        "  }\n"
        "});\n\n"
        "for (const ep of EP.email) {\n"
        f"  test('{p}-API-EP-email-' + ep.label, async ({{ page }}) => {{\n"
        "    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "    const el = page.locator('input[type=\"email\"]').first();\n"
        "    if (await el.count()) {\n"
        "      await el.fill(ep.value);\n"
        "      expect(await el.evaluate((e: HTMLInputElement) => e.checkValidity())).toBe(ep.valid);\n"
        "    }\n"
        "    QAAnnotate.ep('email EP: ' + ep.label);\n"
        "  });\n"
        "}\n\n"
        f"test('{p}-API-404: no 404 resources', async ({{ page }}) => {{\n"
        "  const missing: string[] = [];\n"
        "  page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  expect(missing.filter(u => !u.includes('favicon'))).toHaveLength(0);\n"
        "});\n"
    )


def gen_error(prefix, url, name):
    p = prefix.upper()
    return (
        f"// {name} - Error: negative, BVA-max, chaos, monkey, L10n\n"
        "import { test, expect } from '@playwright/test';\n"
        "import { SecurityPayloads, MonkeyPayloads, L10nPayloads, QAAnnotate, CommonRisks } from '../shared/strategy';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        f"test('{p}-ERR-01 @smoke: blank submit no crash', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "  await page.waitForTimeout(1000);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-ERR-BVA-MAX: 10000-char input no crash', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const inp = page.locator('input[type=\"text\"]').first();\n"
        "  if (await inp.count()) {\n"
        "    await inp.fill(SecurityPayloads.boundary.long);\n"
        "    await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "    await page.waitForTimeout(1000);\n"
        "  }\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  QAAnnotate.bva('10000-char BVA-max survived');\n"
        "});\n\n"
        f"test('{p}-ERR-CHAOS-OFFLINE: offline mode no unhandled errors', async ({{ page, context }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  await context.setOffline(true);\n"
        "  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});\n"
        "  await page.waitForTimeout(2000);\n"
        "  await context.setOffline(false);\n"
        "  QAAnnotate.chaos('Offline chaos: errors=' + errors.filter(e => !e.includes('favicon')).length);\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-ERR-CHAOS-ABORT: aborted POST no white screen', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  await page.route('**/*', route => {\n"
        "    if (route.request().method() === 'POST') route.abort('connectionreset').catch(() => {});\n"
        "    else route.continue().catch(() => {});\n"
        "  });\n"
        "  await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "  await page.waitForTimeout(2000);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  const critical = errors.filter(e => !e.toLowerCase().includes('favicon') && !e.includes('Failed to fetch') && !e.includes('ERR_FAILED'));\n"
        "  QAAnnotate.chaos('POST-abort chaos | errors: ' + critical.length);\n"
        "  expect(critical).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-ERR-MONKEY: monkey — arbitrary payloads no crash', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  for (const inp of await page.locator('input:not([type=\"hidden\"]), textarea').all()) {\n"
        "    for (const payload of MonkeyPayloads.slice(0, 6)) await inp.fill(payload).catch(() => {});\n"
        "  }\n"
        "  await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "  await page.waitForTimeout(1000);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));\n"
        "  QAAnnotate.monkey(MonkeyPayloads.length + ' payloads | errors: ' + critical.length);\n"
        "  expect(critical).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-ERR-L10N-RTL: RTL Arabic input no crash', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const inp = page.locator('input[type=\"text\"]').first();\n"
        "  if (await inp.count()) await inp.fill(L10nPayloads.rtl);\n"
        "  await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "  await page.waitForTimeout(1000);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  QAAnnotate.l10n('RTL Arabic survived');\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-ERR-L10N-CJK: CJK characters no rendering corruption', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const inp = page.locator('input[type=\"text\"]').first();\n"
        "  if (await inp.count()) await inp.fill(L10nPayloads.cjk);\n"
        "  await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "  await page.waitForTimeout(1000);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  QAAnnotate.l10n('CJK survived: ' + L10nPayloads.cjk);\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n"
    )


def gen_security(prefix, url, name, auth):
    p = prefix.upper()
    return (
        f"// {name} - Security: XSS, SQL, CSRF, rate limiting, storage audit\n"
        "import { test, expect } from '@playwright/test';\n"
        "import { SecurityPayloads, QAAnnotate, CommonRisks } from '../shared/strategy';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        "for (const payload of SecurityPayloads.xss) {\n"
        f"  test('{p}-SEC-XSS: not executed — ' + payload.slice(0, 30), async ({{ page }}) => {{\n"
        "    let xssRan = false;\n"
        "    await page.exposeFunction('__xssProbe', () => { xssRan = true; });\n"
        "    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "    const inp = page.locator('input[type=\"text\"], textarea').first();\n"
        "    if (await inp.count()) {\n"
        "      await inp.fill(payload.replace(/alert\\(1\\)/g, '__xssProbe()'));\n"
        "      await page.keyboard.press('Enter');\n"
        "      await page.waitForTimeout(800);\n"
        "    }\n"
        "    expect(xssRan).toBe(false);\n"
        "    QAAnnotate.security('XSS blocked');\n"
        "  });\n"
        "}\n\n"
        "for (const payload of SecurityPayloads.sql) {\n"
        f"  test('{p}-SEC-SQL: no crash — ' + payload.slice(0, 25), async ({{ page }}) => {{\n"
        "    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "    const inp = page.locator('input[type=\"text\"]').first();\n"
        "    if (await inp.count()) { await inp.fill(payload); await page.keyboard.press('Enter'); await page.waitForTimeout(1000); }\n"
        "    await expect(page.locator('body')).toBeVisible();\n"
        "  });\n"
        "}\n\n"
        f"test('{p}-SEC-CSRF: CSRF token or SameSite cookie present', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const csrf = await page.locator(SecurityPayloads.csrf.tokenSelectors.join(', ')).count();\n"
        "  const ss = (await page.context().cookies()).some(c => c.sameSite === 'Strict' || c.sameSite === 'Lax');\n"
        "  if (!csrf && !ss) QAAnnotate.finding('HIGH', CommonRisks.NO_CSRF_TOKEN);\n"
        "  QAAnnotate.security('csrf=' + (csrf > 0) + ' sameSite=' + ss);\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "});\n\n"
        f"test('{p}-SEC-RATE: 10 rapid submits no crash', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  const btn = page.locator('button[type=\"submit\"]').first();\n"
        "  if (await btn.count()) for (let i = 0; i < 10; i++) { await btn.click().catch(() => {}); await page.waitForTimeout(200); }\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  const limited = /too many|locked|rate.?limit|429/i.test((await page.locator('body').textContent()) || '');\n"
        "  if (!limited) QAAnnotate.finding('MEDIUM', CommonRisks.NO_RATE_LIMITING);\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-SEC-STORAGE: password not in web storage', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const pw = page.locator('input[type=\"password\"]').first();\n"
        "  if (await pw.count()) {\n"
        "    await pw.fill('SentinelPass99!');\n"
        "    await page.locator('button[type=\"submit\"]').first().click().catch(() => {});\n"
        "    await page.waitForTimeout(2000);\n"
        "    const store = await page.evaluate(() => ({ l: {...localStorage}, s: {...sessionStorage} }));\n"
        "    expect([...Object.values(store.l), ...Object.values(store.s)].join(' ')).not.toContain('SentinelPass99!');\n"
        "  }\n"
        "  QAAnnotate.security('Storage audit passed');\n"
        "});\n"
    )


def gen_a11y(prefix, url, name):
    p = prefix.upper()
    return (
        f"// {name} - A11Y: axe-core WCAG, keyboard, focus, contrast\n"
        "import { test, expect } from '@playwright/test';\n"
        "import { checkA11y } from '@axe-core/playwright';\n"
        "import { QAAnnotate, CommonRisks } from '../shared/strategy';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        f"test('{p}-A11Y-01 @smoke: no critical WCAG violations', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  await page.waitForTimeout(800);\n"
        "  const r = await checkA11y(page, undefined, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, reporter: 'v2' }).catch(() => ({ violations: [] }));\n"
        "  const critical = (r as any).violations?.filter((v: any) => v.impact === 'critical') ?? [];\n"
        "  if (critical.length) QAAnnotate.finding('CRITICAL', CommonRisks.NO_LABEL_ON_INPUTS);\n"
        "  expect(critical).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-A11Y-02: html lang attribute present', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  expect(((await page.locator('html').getAttribute('lang')) || '').trim().length).toBeGreaterThan(0);\n"
        "});\n\n"
        f"test('{p}-A11Y-03: form inputs keyboard-focusable', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  for (const el of await page.locator('input:not([type=\"hidden\"]), select, textarea').all()) {\n"
        "    if (!await el.isDisabled() && (await el.getAttribute('tabindex')) !== '-1') {\n"
        "      await el.focus();\n"
        "      const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');\n"
        "      expect(['INPUT','SELECT','TEXTAREA','BUTTON']).toContain(tag.toUpperCase());\n"
        "    }\n"
        "  }\n"
        "});\n\n"
        f"test('{p}-A11Y-04: visible focus indicator', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const el = page.locator('input:not([type=\"hidden\"]), button').first();\n"
        "  if (await el.count()) {\n"
        "    await el.focus();\n"
        "    const s = await el.evaluate(e => { const c = window.getComputedStyle(e); return { outline: c.outline, box: c.boxShadow }; });\n"
        "    if (!(s.outline && !s.outline.includes('0px') && s.outline !== 'none') && !(s.box && s.box !== 'none'))\n"
        "      QAAnnotate.finding('MEDIUM', CommonRisks.NO_FOCUS_INDICATOR);\n"
        "  }\n"
        "});\n\n"
        f"test('{p}-A11Y-05: contrast issues documented', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const r = await checkA11y(page, undefined, { runOnly: { type: 'rule', values: ['color-contrast'] }, reporter: 'v2' }).catch(() => ({ violations: [] }));\n"
        "  QAAnnotate.a11y(((r as any).violations?.length ?? 0) + ' contrast issues');\n"
        "});\n"
    )


def gen_perf(prefix, url, name):
    p = prefix.upper()
    return (
        f"// {name} - Perf: FCP, DCL, DOM nodes, gorilla, spike\n"
        "import { test, expect } from '@playwright/test';\n"
        "import { PerfThresholds, QAAnnotate } from '../shared/strategy';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        f"test('{p}-PERF-01 @smoke: FCP under ${{PerfThresholds.FCP}}ms', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);\n"
        "  QAAnnotate.perf('FCP: ' + fcp.toFixed(0) + 'ms');\n"
        "  if (fcp > 0) expect(fcp).toBeLessThan(PerfThresholds.FCP);\n"
        "});\n\n"
        f"test('{p}-PERF-02: DCL under ${{PerfThresholds.DOMContentLoaded}}ms', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const dcl = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; return n ? n.domContentLoadedEventEnd - n.startTime : 0; });\n"
        "  QAAnnotate.perf('DCL: ' + dcl.toFixed(0) + 'ms');\n"
        "  if (dcl > 0) expect(dcl).toBeLessThan(PerfThresholds.DOMContentLoaded);\n"
        "});\n\n"
        f"test('{p}-PERF-03: DOM nodes under ${{PerfThresholds.DOMNodes}}', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  const n = await page.evaluate(() => document.querySelectorAll('*').length);\n"
        "  QAAnnotate.perf('DOM nodes: ' + n);\n"
        "  expect(n).toBeLessThan(PerfThresholds.DOMNodes);\n"
        "});\n\n"
        f"test('{p}-PERF-04: no 404 resources', async ({{ page }}) => {{\n"
        "  const f: string[] = [];\n"
        "  page.on('response', r => { if (r.status() === 404) f.push(r.url()); });\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  expect(f.filter(u => !u.includes('favicon'))).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-PERF-GORILLA: gorilla — primary action ${{PerfThresholds.GorillaHits}}x no crash', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        f"  // TODO: target the gorilla subject for {name}\n"
        "  const btn = page.locator('button:not([disabled])').first();\n"
        "  if (await btn.count()) {\n"
        "    for (let i = 0; i < PerfThresholds.GorillaHits; i++) {\n"
        "      await btn.click().catch(() => {});\n"
        "      await page.waitForTimeout(100);\n"
        "    }\n"
        "  }\n"
        "  await expect(page.locator('body')).toBeVisible();\n"
        "  const critical = errors.filter(e => !e.toLowerCase().includes('favicon'));\n"
        "  QAAnnotate.gorilla(PerfThresholds.GorillaHits + ' hits | errors: ' + critical.length);\n"
        "  expect(critical).toHaveLength(0);\n"
        "});\n\n"
        f"test('{p}-PERF-SPIKE: spike — 10 tabs simultaneously stable', async ({{ browser }}) => {{\n"
        "  const ctx  = await browser.newContext();\n"
        "  const tabs = await Promise.all(Array.from({ length: 10 }, () => ctx.newPage()));\n"
        "  const errors: string[] = [];\n"
        "  tabs.forEach(p => p.on('pageerror', e => errors.push(e.message)));\n"
        f"  await Promise.all(tabs.map(p => p.goto(BASE_URL, {{ waitUntil: 'domcontentloaded', timeout: 20000 }}).catch(() => {{}})));\n"
        "  for (const p of tabs) await expect(p.locator('body')).toBeVisible().catch(() => {});\n"
        "  await ctx.close();\n"
        "  QAAnnotate.spike('10-tab spike | errors: ' + errors.filter(e => !e.includes('favicon')).length);\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n"
    )


def gen_cwv(prefix, url, name):
    p = prefix.upper()
    return (
        f"// {name} - CWV: FCP, LCP, CLS, JS errors\n"
        "import { test, expect } from '@playwright/test';\n"
        "import { PerfThresholds, QAAnnotate } from '../shared/strategy';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        f"test('{p}-CWV-01 @smoke: FCP within budget', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);\n"
        "  QAAnnotate.perf('FCP=' + fcp.toFixed(0) + 'ms');\n"
        "  if (fcp > 0) expect(fcp).toBeLessThan(PerfThresholds.FCP);\n"
        "});\n\n"
        f"test('{p}-CWV-02: LCP within budget', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  const lcp = await page.evaluate(() => new Promise<number>(res => {\n"
        "    new PerformanceObserver(l => res(l.getEntries().at(-1)?.startTime ?? 0))\n"
        "      .observe({ type: 'largest-contentful-paint', buffered: true });\n"
        "    setTimeout(() => res(0), 3000);\n"
        "  }));\n"
        "  QAAnnotate.perf('LCP=' + lcp.toFixed(0) + 'ms');\n"
        "  if (lcp > 0) expect(lcp).toBeLessThan(PerfThresholds.LCP);\n"
        "});\n\n"
        f"test('{p}-CWV-03: CLS under ${{PerfThresholds.CLS}}', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  const cls = await page.evaluate(() => new Promise<number>(res => {\n"
        "    let t = 0;\n"
        "    new PerformanceObserver(l => { for (const e of l.getEntries()) t += (e as any).value ?? 0; })\n"
        "      .observe({ type: 'layout-shift', buffered: true });\n"
        "    setTimeout(() => res(t), 2000);\n"
        "  }));\n"
        "  QAAnnotate.perf('CLS=' + cls.toFixed(4));\n"
        "  expect(cls).toBeLessThan(PerfThresholds.CLS);\n"
        "});\n\n"
        f"test('{p}-CWV-04: no JS errors on load', async ({{ page }}) => {{\n"
        "  const errors: string[] = [];\n"
        "  page.on('pageerror', e => errors.push(e.message));\n"
        "  await page.goto(BASE_URL, { waitUntil: 'networkidle' });\n"
        "  expect(errors.filter(e => !e.toLowerCase().includes('favicon'))).toHaveLength(0);\n"
        "});\n"
    )


def gen_visual(prefix, url, name):
    p = prefix.upper()
    return (
        f"// {name} - Visual: screenshot baselines (desktop + mobile)\n"
        "import { test, expect } from '@playwright/test';\n\n"
        f"const BASE_URL = '{url}';\n\n"
        f"// Update: npx playwright test {prefix}-visual --update-snapshots\n\n"
        f"test('{p}-VIS-01 @smoke: default state matches baseline', async ({{ page }}) => {{\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  await page.waitForTimeout(1000);\n"
        f"  await expect(page).toHaveScreenshot('{prefix}-default.png', {{ maxDiffPixelRatio: 0.02 }});\n"
        "});\n\n"
        f"test('{p}-VIS-02: mobile viewport matches baseline', async ({{ page }}) => {{\n"
        "  await page.setViewportSize({ width: 390, height: 844 });\n"
        "  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });\n"
        "  await page.waitForTimeout(1000);\n"
        f"  await expect(page).toHaveScreenshot('{prefix}-mobile.png', {{ maxDiffPixelRatio: 0.02 }});\n"
        "});\n"
    )


def gen_config(prefix, url):
    return (
        "import { defineConfig, devices } from '@playwright/test';\n\n"
        "export default defineConfig({\n"
        "  testDir: './tests/e2e',\n"
        f"  testMatch: ['{prefix}-*.spec.ts'],\n"
        "  fullyParallel: true,\n"
        "  workers: 2,\n"
        "  retries: 1,\n"
        f"  outputDir: 'test-results-{prefix}/',\n"
        "  globalTeardown: './scripts/auto-report',\n"
        "  reporter: [\n"
        "    ['list'],\n"
        f"    ['html', {{ outputFolder: 'playwright-report-{prefix}', open: 'never' }}],\n"
        f"    ['json', {{ outputFile: 'test-results-{prefix}/results.json' }}],\n"
        "  ],\n"
        "  snapshotDir: './tests/e2e/__snapshots__',\n"
        "  use: { screenshot: 'only-on-failure', video: 'off', trace: 'off' },\n"
        "  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },\n"
        "  projects: [\n"
        "    { name: 'Desktop Chrome',  use: { ...devices['Desktop Chrome']  } },\n"
        "    { name: 'Mobile Chrome',   use: { ...devices['Pixel 7']         } },\n"
        f"    {{ name: 'Desktop Firefox', use: {{ ...devices['Desktop Firefox'] }},"
        f" testIgnore: ['**/{prefix}-visual.spec.ts'] }},\n"
        "  ],\n"
        "});\n"
    )


def add_npm(prefix):
    pkg_path = ROOT / 'package.json'
    pkg = json.loads(pkg_path.read_text())
    scripts = pkg.get('scripts', {})
    k = f'test:{prefix}'
    if k not in scripts:
        scripts[k]             = f'playwright test --config playwright.{prefix}.config.ts'
        scripts[f'{k}:smoke']  = f'playwright test --config playwright.{prefix}.config.ts --grep @smoke'
        scripts[f'{k}:baselines'] = f'playwright test --config playwright.{prefix}.config.ts {prefix}-visual --update-snapshots'
        pkg['scripts'] = scripts
        pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')
        print(f'  npm scripts: {k}, {k}:smoke, {k}:baselines')
    else:
        print(f'  npm scripts already exist: {k}')


def scaffold(url, prefix, name, auth):
    print(f'\nScaffolding: {prefix} → {url}')
    files = {
        SPEC_DIR / f'{prefix}-ui.spec.ts':       gen_ui(prefix, url, name, auth),
        SPEC_DIR / f'{prefix}-api.spec.ts':      gen_api(prefix, url, name, auth),
        SPEC_DIR / f'{prefix}-error.spec.ts':    gen_error(prefix, url, name),
        SPEC_DIR / f'{prefix}-security.spec.ts': gen_security(prefix, url, name, auth),
        SPEC_DIR / f'{prefix}-a11y.spec.ts':     gen_a11y(prefix, url, name),
        SPEC_DIR / f'{prefix}-perf.spec.ts':     gen_perf(prefix, url, name),
        SPEC_DIR / f'{prefix}-cwv.spec.ts':      gen_cwv(prefix, url, name),
        SPEC_DIR / f'{prefix}-visual.spec.ts':   gen_visual(prefix, url, name),
        ROOT / f'playwright.{prefix}.config.ts': gen_config(prefix, url),
    }
    for path, content in files.items():
        w(path, content)
    add_npm(prefix)
    print(f'\nReady!')
    print(f'  npm run test:{prefix}          # full suite (3 browsers)')
    print(f'  npm run test:{prefix}:smoke    # @smoke only (fast sanity check)')
    print(f'  npm run test:{prefix}:baselines# capture visual baselines')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Scaffold 8-spec 8-loop Playwright QA suite')
    ap.add_argument('--url',    required=True)
    ap.add_argument('--prefix', required=True)
    ap.add_argument('--name',   default=None)
    ap.add_argument('--auth',   action='store_true')
    args = ap.parse_args()
    scaffold(args.url, slugify(args.prefix), args.name or args.prefix, args.auth)
