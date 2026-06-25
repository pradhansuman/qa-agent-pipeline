/**
 * tests/e2e/shared/strategy.ts
 * 7-Loop / 100-Point QA Framework — reusable utilities for any project.
 */
import { test } from '@playwright/test';

// ── LOOP 2: Coverage Techniques ─────────────────────────────────────────────

export const BVA = {
  numeric: (min: number, max: number) => [min-1, min, min+1, max-1, max, max+1],
  string:  (maxLen: number) => ({
    empty: '', one: 'a',
    belowMax: 'a'.repeat(Math.max(0, maxLen - 1)),
    atMax:    'a'.repeat(maxLen),
    aboveMax: 'a'.repeat(maxLen + 1),
  }),
  price: (unit: number) => ({
    zero: 0, one: unit, two: +(unit*2).toFixed(2),
    negative: -unit, fraction: +(unit*0.1).toFixed(2),
  }),
};

export const EP = {
  email:    [
    { label: 'empty',      value: '',               valid: false },
    { label: 'alpha-only', value: 'notanemail',     valid: false },
    { label: 'partial-at', value: 'user@',          valid: false },
    { label: 'valid',      value: 'test@valid.com', valid: true  },
  ],
  password: [
    { label: 'empty',      value: '',            valid: false },
    { label: 'whitespace', value: '   ',         valid: false },
    { label: 'too-short',  value: 'ab1',         valid: false },
    { label: 'valid',      value: 'ValidPass1!', valid: true  },
  ],
  quantity: [
    { label: 'negative', value: -1, valid: false },
    { label: 'zero',     value:  0, valid: false },
    { label: 'one',      value:  1, valid: true  },
    { label: 'typical',  value:  5, valid: true  },
    { label: 'max',      value: 99, valid: true  },
  ],
};

export function pairwiseCombos<T extends Record<string, readonly unknown[]>>(d: T): Array<{[K in keyof T]: T[K][number]}> {
  const keys = Object.keys(d) as (keyof T)[];
  const maxLen = Math.max(...keys.map(k => d[k].length));
  return Array.from({ length: maxLen }, (_, i) => {
    const c = {} as {[K in keyof T]: T[K][number]};
    for (const k of keys) c[k] = d[k][i % d[k].length] as T[typeof k][number];
    return c;
  });
}

// ── LOOP 1: Monkey / Gorilla helpers ─────────────────────────────────────────

export function randomStr(len = 20): string {
  return Array.from({ length: len }, () => String.fromCharCode(33 + Math.floor(Math.random() * 94))).join('');
}

export const MonkeyPayloads = [
  '', '   ', '<script>alert(1)</script>', "' OR '1'='1",
  'a'.repeat(500), '\u4F60\u597D\u4E16\u754C', '\n\r\t\0', '%s %d %n',
  '../../../etc/passwd', 'null', 'undefined', '0', '-1', '9999999999',
  '!@#$%^&*()_+-=[]{}|;:,.<>?', '\uD83D\uDE00'.repeat(5),
];

// ── LOOP 3: Security Payloads ────────────────────────────────────────────────

export const SecurityPayloads = {
  xss: [
    '<script>document.body.dataset.xss="1"</script>',
    '<img src=x onerror="document.body.dataset.xss=\'1\'">' ,
    '"><svg onload="document.body.dataset.xss=\'1\'">',
  ],
  sql: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1 UNION SELECT * FROM users--",
    "admin'--",
  ],
  boundary: {
    long:       'a'.repeat(10000),
    unicode:    '\u4F60\u597D\u4E16\u754C \uD83C\uDFAF',
    whitespace: '   ',
    script:     '<script>alert(1)</script>',
    newline:    'line1\nline2\r\nline3',
  },
  csrf: {
    tokenSelectors: [
      'input[name*="csrf"]', 'input[name*="token"]', 'input[name*="_token"]',
      'input[name*="authenticity"]', 'meta[name*="csrf"]',
    ],
  },
};

// ── LOOP 6: Localization payloads ────────────────────────────────────────────

export const L10nPayloads = {
  rtl:        '\u0645\u0631\u062D\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645',
  cjk:        '\u3053\u3093\u306B\u3061\u306F\u4E16\u754C',
  mixed:      'Hello \u0645\u0631\u062D\u0628\u0627 \u4E16\u754C \uD83C\uDF0D',
  currencies: ['$1,234.56', '\u20AC1.234,56', '\u00A31,234.56', '\u20B91,234.56', '\u00A51,234'],
  dates:      ['2024-01-15', '15/01/2024', '01-15-2024', '15 Jan 2024'],
};

// ── LOOP 4: Annotation helpers ────────────────────────────────────────────────

export const QAAnnotate = {
  risk:        (msg: string) => test.info().annotations.push({ type: 'risk',     description: msg }),
  bva:         (msg: string) => test.info().annotations.push({ type: 'bva',      description: msg }),
  ep:          (msg: string) => test.info().annotations.push({ type: 'ep',       description: msg }),
  security:    (msg: string) => test.info().annotations.push({ type: 'security', description: msg }),
  perf:        (msg: string) => test.info().annotations.push({ type: 'perf',     description: msg }),
  a11y:        (msg: string) => test.info().annotations.push({ type: 'a11y',     description: msg }),
  pairwise:    (msg: string) => test.info().annotations.push({ type: 'pairwise', description: msg }),
  decision:    (msg: string) => test.info().annotations.push({ type: 'decision', description: msg }),
  monkey:      (msg: string) => test.info().annotations.push({ type: 'monkey',   description: msg }),
  gorilla:     (msg: string) => test.info().annotations.push({ type: 'gorilla',  description: msg }),
  l10n:        (msg: string) => test.info().annotations.push({ type: 'l10n',     description: msg }),
  chaos:       (msg: string) => test.info().annotations.push({ type: 'chaos',    description: msg }),
  spike:       (msg: string) => test.info().annotations.push({ type: 'spike',    description: msg }),
  requirement: (id: string, desc: string) =>
    test.info().annotations.push({ type: 'requirement', description: id + ' \u2014 ' + desc }),
  finding: (sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', msg: string) =>
    test.info().annotations.push({ type: 'finding-' + sev.toLowerCase(), description: sev + ': ' + msg }),
};

// ── LOOP 5: Performance thresholds ───────────────────────────────────────────

export const PerfThresholds = {
  FCP: 1800, LCP: 4000, CLS: 0.1, TTFB: 800,
  DOMContentLoaded: 3000, NetworkIdle: 5000, TBT: 200,
  PageLoad: 3000, UIInteraction: 1000, FormSubmit: 3000, APIResponse: 2000,
  DOMNodes: 1500, JSHeapMB: 50, JSPayloadKB: 500, RequestCount: 50,
  GorillaHits: 30,
  SpikeCount:  50,
};

// ── Common Risks ─────────────────────────────────────────────────────────────

export const CommonRisks = {
  NO_LABEL_ON_INPUTS:  'WCAG Level A (4.1.2): form inputs missing <label>',
  NO_CSRF_TOKEN:       'No CSRF token or SameSite cookie detected',
  NO_RATE_LIMITING:    'No rate limiting on auth endpoint — brute force possible',
  XSS_VIA_OUTPUT:      'User input rendered without HTML encoding — XSS risk',
  PASSWORD_IN_STORAGE: 'Password found in localStorage/sessionStorage',
  NO_SESSION_EXPIRY:   'No session timeout detected',
  DOUBLE_SUBMIT:       'Rapid double-click may create duplicate records',
  SHARED_TEST_DATA:    'Tests share persistent state — parallel runs may conflict',
  NO_TABLE_HEADERS:    'Table uses <td> not <th> — WCAG 1.3.1 violation',
  NO_FOCUS_INDICATOR:  'No visible focus outline — WCAG 2.4.7 violation',
  NO_L10N_HANDLING:    'No RTL or locale-specific rendering — L10n gap',
};

export const CoverageMap: Record<string, string> = {
  '1.1-smoke':           '@smoke tag in every spec file',
  '1.5-monkey':          '<prefix>-error.spec.ts (ERR-MONKEY)',
  '1.6-gorilla':         '<prefix>-perf.spec.ts (PERF-GORILLA)',
  '2.1-bva':             '<prefix>-api.spec.ts',
  '2.2-ep':              '<prefix>-api.spec.ts',
  '2.3-decision-table':  '<prefix>-error.spec.ts',
  '2.4-state-transition':'<prefix>-ui.spec.ts',
  '2.5-pairwise':        '<prefix>-ui.spec.ts',
  '3.3-spike':           '<prefix>-perf.spec.ts (PERF-SPIKE)',
  '4.5-api':             '<prefix>-api.spec.ts',
  '4.6-e2e':             '<prefix>-ui.spec.ts (E2E)',
  '5.1-vuln-scan':       '<prefix>-security.spec.ts',
  '6.1-a11y':            '<prefix>-a11y.spec.ts',
  '6.2-l10n':            '<prefix>-error.spec.ts (ERR-L10N)',
  '6.5-cross-browser':   'playwright.<prefix>.config.ts projects[]',
  '6.7-chaos':           '<prefix>-error.spec.ts (ERR-CHAOS)',
  'visual-regression':   '<prefix>-visual.spec.ts',
};
