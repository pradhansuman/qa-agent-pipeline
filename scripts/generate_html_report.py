#!/usr/bin/env python3
"""
Generate a professional standalone HTML QA report from Playwright JSON results.

Usage:
    python scripts/generate_html_report.py
    python scripts/generate_html_report.py path/to/results.json --output report.html
"""

import json
import argparse
import sys
from datetime import datetime
from pathlib import Path

# ── Suite display metadata ─────────────────────────────────────────────────────
SUITE_META = {
    'store-api':      {'label': 'Contract / API',    'icon': '📋', 'color': '#3b82f6'},
    'store-loop':     {'label': 'Endurance Loops',   'icon': '🔄', 'color': '#8b5cf6'},
    'store-perf':     {'label': 'Performance',       'icon': '⚡', 'color': '#f59e0b'},
    'store-security': {'label': 'Security',          'icon': '🔐', 'color': '#ef4444'},
    'store-visual':   {'label': 'Visual Regression', 'icon': '🎨', 'color': '#10b981'},
}

DEFAULT_RESULTS = Path('test-results-store/results.json')
DEFAULT_OUTPUT  = Path('store-qa-report.html')

# ── CSS ────────────────────────────────────────────────────────────────────────
CSS = """
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0d1117; --card: #161b22; --card2: #0d1117; --border: #30363d;
  --text: #c9d1d9; --muted: #8b949e; --hi: #e6edf3;
  --pass: #3fb950; --fail: #f85149; --flaky: #d29922; --skip: #8b949e;
  --accent: #7c3aed; --blue: #2563eb;
  --radius: 12px; --shadow: 0 8px 32px rgba(0,0,0,.5);
}
html { scroll-behavior: smooth; }
body {
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 14px; line-height: 1.5; min-height: 100vh;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
header {
  background: linear-gradient(135deg, #0d1117 0%, #161b22 40%, #1a1a3e 70%, #0f1a3d 100%);
  border-bottom: 1px solid var(--border);
  padding: 28px 40px 20px;
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(8px);
}
.hd-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.brand  { display: flex; align-items: center; gap: 16px; }
.brand-icon {
  width: 52px; height: 52px; border-radius: 14px; display: flex;
  align-items: center; justify-content: center; font-size: 26px;
  background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
  box-shadow: 0 4px 20px rgba(124,58,237,.5);
  flex-shrink: 0;
}
h1 { font-size: 22px; font-weight: 700; letter-spacing: -.4px; color: var(--hi); }
.run-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
.gate-badge {
  padding: 7px 22px; border-radius: 24px;
  font-weight: 700; font-size: 14px; letter-spacing: 1px;
  backdrop-filter: blur(4px);
}
.gate-pass { background: rgba(63,185,80,.12); color: var(--pass); border: 1.5px solid rgba(63,185,80,.35); }
.gate-fail { background: rgba(248,81,73,.12); color: var(--fail); border: 1.5px solid rgba(248,81,73,.35); }
.hd-tags {
  display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px;
  align-items: center;
}
.hd-tag {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--muted);
}
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pass); display: inline-block; }

/* ── Main layout ──────────────────────────────────────────────────────────── */
main { max-width: 1380px; margin: 0 auto; padding: 36px 40px; display: flex; flex-direction: column; gap: 36px; }
@media (max-width: 768px) { main { padding: 20px 16px; } header { padding: 20px 16px; } }

/* ── Section titles ───────────────────────────────────────────────────────── */
.stitle {
  font-size: 15px; font-weight: 600; color: var(--hi);
  display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
}
.stitle::before {
  content: ''; width: 3px; height: 18px; border-radius: 2px;
  background: linear-gradient(180deg, var(--accent), var(--blue));
  display: inline-block;
}

/* ── KPI grid ─────────────────────────────────────────────────────────────── */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 500px) { .kpi-grid { grid-template-columns: 1fr 1fr; } }

.kpi {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 22px 24px; position: relative; overflow: hidden;
  transition: transform .2s ease, box-shadow .2s ease;
}
.kpi:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
.kpi::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  border-radius: var(--radius) var(--radius) 0 0;
}
.kpi-total::before  { background: linear-gradient(90deg, var(--accent), var(--blue)); }
.kpi-pass::before   { background: var(--pass); }
.kpi-fail::before   { background: var(--fail); }
.kpi-flaky::before  { background: var(--flaky); }
.kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); }
.kpi-value { font-size: 44px; font-weight: 800; line-height: 1.1; margin: 6px 0 4px; }
.kpi-total  .kpi-value { color: var(--hi); }
.kpi-pass   .kpi-value { color: var(--pass); }
.kpi-fail   .kpi-value { color: var(--fail); }
.kpi-flaky  .kpi-value { color: var(--flaky); }
.kpi-sub { font-size: 12px; color: var(--muted); }
.kpi-icon { position: absolute; bottom: 14px; right: 16px; font-size: 32px; opacity: .1; }

/* ── Charts grid ──────────────────────────────────────────────────────────── */
.charts-grid { display: grid; grid-template-columns: 1fr 2.2fr 1fr; gap: 16px; align-items: start; }
@media (max-width: 1100px) { .charts-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px)  { .charts-grid { grid-template-columns: 1fr; } }

.cc {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 22px 24px;
}
.cc h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .7px;
  color: var(--muted); margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
}
.cc h3::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.chart-rel { position: relative; }
.chart-center {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  text-align: center; pointer-events: none;
}
.chart-center-val { font-size: 28px; font-weight: 800; color: var(--hi); line-height: 1; }
.chart-center-lbl { font-size: 11px; color: var(--muted); margin-top: 4px; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }

/* ── Suite cards ──────────────────────────────────────────────────────────── */
.suite-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }

.sc {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px 22px; transition: transform .2s, box-shadow .2s;
}
.sc:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.sc-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.sc-icon { font-size: 26px; line-height: 1; flex-shrink: 0; }
.sc-info { flex: 1; min-width: 0; }
.sc-name { font-size: 14px; font-weight: 600; color: var(--hi); }
.sc-file { font-size: 11px; color: var(--muted); margin-top: 2px; }
.sc-pct  { font-size: 24px; font-weight: 800; line-height: 1; flex-shrink: 0; }
.pb-track { height: 6px; background: rgba(255,255,255,.06); border-radius: 3px; overflow: hidden; margin-bottom: 12px; }
.pb-fill  { height: 100%; border-radius: 3px; transition: width .8s cubic-bezier(.16,1,.3,1); }
.sc-stats { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--muted); }
.sc-stats .pass { color: var(--pass); }
.sc-stats .fail { color: var(--fail); }

/* ── Table section ────────────────────────────────────────────────────────── */
.tc-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 12px; margin-bottom: 16px;
}
.filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

input[type="search"], select {
  background: #0d1117; border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); padding: 8px 12px; font-size: 13px;
  outline: none; transition: border-color .2s; appearance: none;
}
input[type="search"] { width: 240px; }
input[type="search"]::placeholder { color: var(--muted); }
input[type="search"]:focus, select:focus { border-color: var(--accent); }
select { padding-right: 28px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b949e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }

.tc-count { font-size: 12px; color: var(--muted); white-space: nowrap; align-self: center; }

.tw { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
thead th {
  padding: 11px 14px; font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .6px; color: var(--muted); background: rgba(255,255,255,.025);
  border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap;
  user-select: none; cursor: pointer;
}
thead th:last-child { text-align: right; }
thead th:hover { color: var(--hi); }
thead th.sort-asc::after  { content: ' ↑'; }
thead th.sort-desc::after { content: ' ↓'; }

td {
  padding: 10px 14px; border-bottom: 1px solid rgba(48,54,61,.4);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,.02); }
tr[data-status="failed"] td { background: rgba(248,81,73,.03); }
tr[data-status="flaky"]  td { background: rgba(210,153,34,.03); }

.status-dot {
  width: 22px; height: 22px; border-radius: 50%; display: inline-flex;
  align-items: center; justify-content: center; font-size: 11px;
  font-weight: 800; flex-shrink: 0;
}
.status-dot.passed  { background: rgba(63,185,80,.15);  color: var(--pass); }
.status-dot.failed  { background: rgba(248,81,73,.15);  color: var(--fail); }
.status-dot.flaky   { background: rgba(210,153,34,.15); color: var(--flaky); }
.status-dot.skipped { background: rgba(139,148,158,.1); color: var(--skip); }

.test-title { font-size: 12.5px; max-width: 480px; word-break: break-word; }
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 2px 8px; border-radius: 12px; border: 1px solid;
  white-space: nowrap; font-weight: 500;
}
.browser-cell { font-size: 12px; color: var(--muted); white-space: nowrap; }
.dur-cell     { font-size: 12px; color: var(--muted); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.retry-badge  {
  display: inline-block; font-size: 10px; padding: 1px 5px; border-radius: 4px;
  background: rgba(210,153,34,.2); color: var(--flaky); margin-left: 6px; font-weight: 700;
}
tr.hidden { display: none; }

/* ── Footer ───────────────────────────────────────────────────────────────── */
footer {
  text-align: center; padding: 24px 40px; color: var(--muted);
  border-top: 1px solid var(--border); font-size: 12px;
}
footer strong { color: var(--text); }

/* ── Animations ───────────────────────────────────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.kpi, .cc, .sc { animation: fadeUp .4s ease both; }
.kpi:nth-child(1) { animation-delay: .05s; }
.kpi:nth-child(2) { animation-delay: .10s; }
.kpi:nth-child(3) { animation-delay: .15s; }
.kpi:nth-child(4) { animation-delay: .20s; }
"""

# ── JavaScript ─────────────────────────────────────────────────────────────────
JS = """
// ── KPI counter animation ────────────────────────────────────────────────────
function animateCount(id, target, delay) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const duration = 700;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(ease * target);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, delay);
}
animateCount('kv-total', DATA.kpi.total, 100);
animateCount('kv-pass',  DATA.kpi.passed, 200);
animateCount('kv-fail',  DATA.kpi.failed, 200);
animateCount('kv-flaky', DATA.kpi.flaky,  200);

// ── Chart defaults ───────────────────────────────────────────────────────────
Chart.defaults.color = '#8b949e';
Chart.defaults.font.family = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
Chart.defaults.font.size = 12;

// ── Pass Rate Doughnut ───────────────────────────────────────────────────────
new Chart(document.getElementById('passChart'), {
  type: 'doughnut',
  data: {
    labels: ['Passed', 'Failed', 'Flaky'],
    datasets: [{
      data: [DATA.passRate.passed, DATA.passRate.failed, DATA.passRate.flaky],
      backgroundColor: [
        'rgba(63,185,80,.85)',
        'rgba(248,81,73,.85)',
        'rgba(210,153,34,.85)',
      ],
      borderColor: ['#3fb950', '#f85149', '#d29922'],
      borderWidth: 2,
      hoverOffset: 8,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#161b22',
        borderColor: '#30363d',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `  ${ctx.label}: ${ctx.parsed} tests`
        }
      }
    }
  }
});

// ── Suite Horizontal Bar ─────────────────────────────────────────────────────
new Chart(document.getElementById('suiteChart'), {
  type: 'bar',
  data: {
    labels: DATA.suites.labels,
    datasets: [
      {
        label: 'Passed',
        data: DATA.suites.passed,
        backgroundColor: DATA.suites.colors.map(c => c + 'bb'),
        borderColor: DATA.suites.colors,
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Failed',
        data: DATA.suites.failed,
        backgroundColor: 'rgba(248,81,73,.7)',
        borderColor: '#f85149',
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 14, color: '#8b949e' }
      },
      tooltip: {
        backgroundColor: '#161b22',
        borderColor: '#30363d',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `  ${ctx.dataset.label}: ${ctx.parsed.x} tests`
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        grid: { color: 'rgba(48,54,61,.5)' },
        ticks: { stepSize: 5, color: '#8b949e' },
        border: { color: '#30363d' },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 12 }, color: '#c9d1d9' },
        border: { color: '#30363d' },
      }
    }
  }
});

// ── Browser Doughnut ─────────────────────────────────────────────────────────
new Chart(document.getElementById('browserChart'), {
  type: 'doughnut',
  data: {
    labels: DATA.browsers.labels,
    datasets: [{
      data: DATA.browsers.passed,
      backgroundColor: ['rgba(124,58,237,.85)', 'rgba(37,99,235,.85)'],
      borderColor: ['#7c3aed', '#2563eb'],
      borderWidth: 2,
      hoverOffset: 8,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 12, color: '#8b949e' }
      },
      tooltip: {
        backgroundColor: '#161b22',
        borderColor: '#30363d',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `  ${ctx.label}: ${ctx.parsed} tests`
        }
      }
    }
  }
});

// ── Table filter ─────────────────────────────────────────────────────────────
function filterTable() {
  const q     = document.getElementById('srch').value.toLowerCase();
  const suite = document.getElementById('sfilt').value;
  const brow  = document.getElementById('bfilt').value;
  const stat  = document.getElementById('stfilt').value;
  const rows  = document.querySelectorAll('#tbody tr');
  let vis = 0;
  rows.forEach(row => {
    const title  = row.querySelector('.test-title').textContent.toLowerCase();
    const show   = (!q    || title.includes(q))
                && (!suite || row.dataset.suite === suite)
                && (!brow  || row.dataset.browser === brow)
                && (!stat  || row.dataset.status === stat);
    row.classList.toggle('hidden', !show);
    if (show) vis++;
  });
  document.getElementById('tc-count').textContent = `Showing ${vis} of ${rows.length}`;
}

// ── Table sort ───────────────────────────────────────────────────────────────
let _sortCol = -1, _sortAsc = true;
function sortTable(col) {
  const ths  = document.querySelectorAll('thead th');
  if (_sortCol === col) { _sortAsc = !_sortAsc; } else { _sortCol = col; _sortAsc = true; }
  ths.forEach((th, i) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (i === col) th.classList.add(_sortAsc ? 'sort-asc' : 'sort-desc');
  });
  const tbody = document.getElementById('tbody');
  const rows  = Array.from(tbody.querySelectorAll('tr'));
  rows.sort((a, b) => {
    const av = a.cells[col].textContent.trim();
    const bv = b.cells[col].textContent.trim();
    const cmp = av.localeCompare(bv, undefined, { numeric: true });
    return _sortAsc ? cmp : -cmp;
  });
  tbody.append(...rows);
}
"""


# ── Parser ─────────────────────────────────────────────────────────────────────

def _walk(suite: dict, file_key: str = '') -> list:
    title = suite.get('title', '')
    if title.endswith('.spec.ts'):
        file_key = title.split('/')[-1].replace('.spec.ts', '')
    records = []
    for spec in suite.get('specs', []):
        for test in spec.get('tests', []):
            results = test.get('results', [])
            if not results:
                continue
            last  = results[-1]
            flaky = len(results) > 1 and last.get('status') == 'passed'
            records.append({
                'suite_key':   file_key,
                'title':       spec.get('title', ''),
                'browser':     test.get('projectName', ''),
                'status':      last.get('status', 'unknown'),
                'duration_ms': last.get('duration', 0),
                'flaky':       flaky,
                'retries':     len(results) - 1,
            })
    for child in suite.get('suites', []):
        records.extend(_walk(child, file_key))
    return records


def parse_results(json_path: Path) -> dict:
    raw   = json.loads(json_path.read_text(encoding='utf-8'))
    stats = raw.get('stats', {})

    tests: list = []
    for s in raw.get('suites', []):
        tests.extend(_walk(s))

    # Suite aggregation
    suite_data: dict = {}
    for t in tests:
        k = t['suite_key']
        if k not in suite_data:
            suite_data[k] = {'passed': 0, 'failed': 0, 'flaky': 0, 'total': 0, 'duration_ms': 0}
        d = suite_data[k]
        d['total']       += 1
        d['duration_ms'] += t['duration_ms']
        if t['flaky']:              d['flaky']  += 1
        elif t['status'] == 'passed': d['passed'] += 1
        else:                       d['failed'] += 1

    # Browser aggregation
    browser_data: dict = {}
    for t in tests:
        b = t['browser']
        if b not in browser_data:
            browser_data[b] = {'passed': 0, 'failed': 0, 'total': 0}
        d = browser_data[b]
        d['total'] += 1
        if t['status'] == 'passed': d['passed'] += 1
        else:                       d['failed'] += 1

    total  = len(tests)
    passed = sum(1 for t in tests if t['status'] == 'passed' and not t['flaky'])
    flaky  = sum(1 for t in tests if t['flaky'])
    failed = sum(1 for t in tests if t['status'] not in ('passed', 'skipped'))

    try:
        dt = datetime.fromisoformat(stats.get('startTime', '').replace('Z', '+00:00'))
        start_str = dt.strftime('%B %d, %Y at %H:%M UTC')
    except Exception:
        start_str = stats.get('startTime', 'Unknown')

    dur_ms  = stats.get('duration', 0)
    m, s    = divmod(dur_ms // 1000, 60)
    dur_str = f'{m}m {s}s' if m else f'{s}s'
    pass_pct = round(100 * (passed + flaky) / total) if total else 0

    return {
        'tests':        tests,
        'suite_data':   suite_data,
        'browser_data': browser_data,
        'total':        total,
        'passed':       passed,
        'failed':       failed,
        'flaky':        flaky,
        'pass_pct':     pass_pct,
        'gate':         'PASS' if failed == 0 else 'FAIL',
        'start_str':    start_str,
        'dur_str':      dur_str,
    }


# ── HTML builders ──────────────────────────────────────────────────────────────

def _ms(ms: int) -> str:
    return f'{ms / 1000:.1f}s' if ms >= 1000 else f'{ms}ms'


def _status_cls(status: str, flaky: bool) -> str:
    if flaky:               return 'flaky'
    if status == 'passed':  return 'passed'
    if status == 'failed':  return 'failed'
    return 'skipped'


def _status_icon(status: str, flaky: bool) -> str:
    if flaky:               return '⚠'
    if status == 'passed':  return '✓'
    if status == 'failed':  return '✗'
    return '○'


def _suite_cards(suite_data: dict, order: list) -> str:
    parts = []
    for key in order:
        if key not in suite_data:
            continue
        d    = suite_data[key]
        meta = SUITE_META.get(key, {'label': key, 'icon': '🧪', 'color': '#6b7280'})
        pct  = round(100 * (d['passed'] + d['flaky']) / d['total']) if d['total'] else 0
        avg  = d['duration_ms'] // d['total'] if d['total'] else 0
        c    = meta['color']
        fail_span = f'<span class="fail">✗ {d["failed"]} failed</span>' if d['failed'] else ''
        parts.append(
            f'<div class="sc">'
            f'<div class="sc-hd">'
            f'<span class="sc-icon">{meta["icon"]}</span>'
            f'<div class="sc-info"><div class="sc-name">{meta["label"]}</div>'
            f'<div class="sc-file">{key}.spec.ts</div></div>'
            f'<div class="sc-pct" style="color:{c}">{pct}%</div>'
            f'</div>'
            f'<div class="pb-track"><div class="pb-fill" style="width:{pct}%;background:{c}"></div></div>'
            f'<div class="sc-stats">'
            f'<span>{d["total"]} tests</span>'
            f'<span class="pass">✓ {d["passed"] + d["flaky"]} passed</span>'
            f'{fail_span}'
            f'<span style="color:var(--muted)">avg {_ms(avg)}</span>'
            f'</div>'
            f'</div>'
        )
    return '\n'.join(parts)


def _test_rows(tests: list) -> str:
    rows = []
    for t in tests:
        meta  = SUITE_META.get(t['suite_key'], {'label': t['suite_key'], 'icon': '🧪', 'color': '#6b7280'})
        sc    = _status_cls(t['status'], t['flaky'])
        icon  = _status_icon(t['status'], t['flaky'])
        retry = '<span class="retry-badge">retry</span>' if t['retries'] else ''
        rows.append(
            f'<tr data-suite="{t["suite_key"]}" data-browser="{t["browser"]}" data-status="{sc}">'
            f'<td><span class="status-dot {sc}" title="{sc}">{icon}</span></td>'
            f'<td class="test-title">{t["title"]}{retry}</td>'
            f'<td><span class="chip" style="border-color:{meta["color"]};color:{meta["color"]}">'
            f'{meta["icon"]} {meta["label"]}</span></td>'
            f'<td class="browser-cell">{t["browser"]}</td>'
            f'<td class="dur-cell">{_ms(t["duration_ms"])}</td>'
            f'</tr>'
        )
    return '\n'.join(rows)


# ── Main generator ─────────────────────────────────────────────────────────────

def generate(data: dict) -> str:
    # Suite ordering: follow SUITE_META order, then any extras
    so = [k for k in SUITE_META if k in data['suite_data']]
    so += [k for k in data['suite_data'] if k not in so]

    bd = data['browser_data']
    bl = list(bd.keys())

    # Chart data object injected as JSON
    chart_data = {
        'kpi': {
            'total':  data['total'],
            'passed': data['passed'],
            'failed': data['failed'],
            'flaky':  data['flaky'],
        },
        'passRate': {
            'passed': data['passed'] + data['flaky'],
            'failed': data['failed'],
            'flaky':  0,
        },
        'suites': {
            'labels':  [SUITE_META.get(k, {'label': k})['label'] for k in so],
            'colors':  [SUITE_META.get(k, {'color': '#6b7280'})['color'] for k in so],
            'passed':  [(data['suite_data'][k]['passed'] + data['suite_data'][k]['flaky']) for k in so],
            'failed':  [data['suite_data'][k]['failed'] for k in so],
        },
        'browsers': {
            'labels': bl,
            'passed': [bd[b]['passed'] for b in bl],
        },
    }
    chart_json = json.dumps(chart_data, indent=2)

    gate_cls   = 'gate-pass' if data['gate'] == 'PASS' else 'gate-fail'
    cards_html = _suite_cards(data['suite_data'], so)
    rows_html  = _test_rows(data['tests'])

    # Filter dropdown options
    suite_opts   = '\n'.join(
        f'<option value="{k}">{SUITE_META.get(k, {"label":k})["label"]}</option>'
        for k in so
    )
    browser_opts = '\n'.join(f'<option value="{b}">{b}</option>' for b in bl)

    total = data['total']
    p     = data['passed']
    f_    = data['failed']
    fl    = data['flaky']
    pct   = data['pass_pct']

    kpi_sub_pass  = f'{pct}% pass rate'
    kpi_sub_fail  = 'All clear ✓' if f_ == 0 else f'{f_} need attention'
    kpi_sub_flaky = 'Zero flakiness ✓' if fl == 0 else f'Passed on retry'

    html = (
        '<!DOCTYPE html>\n'
        '<html lang="en">\n'
        '<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        f'<title>ShopNow QA Report — {data["gate"]}</title>\n'
        '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>\n'
        '<style>\n' + CSS + '\n</style>\n'
        '</head>\n'
        '<body>\n'

        # ─── Header ────────────────────────────────────────────────────
        '<header>\n'
        '  <div class="hd-top">\n'
        '    <div class="brand">\n'
        '      <div class="brand-icon">🧪</div>\n'
        '      <div>\n'
        f'        <h1>ShopNow QA Report</h1>\n'
        f'        <div class="run-meta">{data["start_str"]} &nbsp;·&nbsp; {data["dur_str"]}</div>\n'
        '      </div>\n'
        '    </div>\n'
        f'    <div class="gate-badge {gate_cls}">{data["gate"]}</div>\n'
        '  </div>\n'
        '  <div class="hd-tags">\n'
        '    <span class="hd-tag"><span class="dot"></span>'
        f'{total} tests</span>\n'
        '    <span class="hd-tag">·</span>\n'
        '    <span class="hd-tag">Desktop Chrome + Mobile Chrome (Pixel 7)</span>\n'
        '    <span class="hd-tag">·</span>\n'
        '    <span class="hd-tag">zero-to-test-ai</span>\n'
        '  </div>\n'
        '</header>\n'

        '<main>\n'

        # ─── KPI Cards ─────────────────────────────────────────────────
        '<section>\n'
        '<div class="kpi-grid">\n'
        '  <div class="kpi kpi-total">\n'
        '    <div class="kpi-label">Total Tests</div>\n'
        '    <div class="kpi-value" id="kv-total">0</div>\n'
        '    <div class="kpi-sub">across 5 suites · 2 browsers</div>\n'
        '    <div class="kpi-icon">🧪</div>\n'
        '  </div>\n'
        '  <div class="kpi kpi-pass">\n'
        '    <div class="kpi-label">Passed</div>\n'
        '    <div class="kpi-value" id="kv-pass">0</div>\n'
        f'    <div class="kpi-sub">{kpi_sub_pass}</div>\n'
        '    <div class="kpi-icon">✓</div>\n'
        '  </div>\n'
        '  <div class="kpi kpi-fail">\n'
        '    <div class="kpi-label">Failed</div>\n'
        '    <div class="kpi-value" id="kv-fail">0</div>\n'
        f'    <div class="kpi-sub">{kpi_sub_fail}</div>\n'
        '    <div class="kpi-icon">✗</div>\n'
        '  </div>\n'
        '  <div class="kpi kpi-flaky">\n'
        '    <div class="kpi-label">Flaky</div>\n'
        '    <div class="kpi-value" id="kv-flaky">0</div>\n'
        f'    <div class="kpi-sub">{kpi_sub_flaky}</div>\n'
        '    <div class="kpi-icon">⚠</div>\n'
        '  </div>\n'
        '</div>\n'
        '</section>\n'

        # ─── Charts ────────────────────────────────────────────────────
        '<section>\n'
        '<div class="stitle">Test Analytics</div>\n'
        '<div class="charts-grid">\n'

        '  <div class="cc">\n'
        '    <h3>Overall Pass Rate</h3>\n'
        '    <div class="chart-rel" style="height:180px">\n'
        '      <canvas id="passChart"></canvas>\n'
        '      <div class="chart-center">\n'
        f'        <div class="chart-center-val">{pct}%</div>\n'
        '        <div class="chart-center-lbl">pass rate</div>\n'
        '      </div>\n'
        '    </div>\n'
        '    <div class="legend" style="margin-top:14px">\n'
        f'      <div class="legend-item"><div class="legend-dot" style="background:#3fb950"></div>Passed ({p + fl})</div>\n'
        f'      <div class="legend-item"><div class="legend-dot" style="background:#f85149"></div>Failed ({f_})</div>\n'
        '    </div>\n'
        '  </div>\n'

        '  <div class="cc">\n'
        '    <h3>Tests by Suite</h3>\n'
        '    <div class="chart-rel" style="height:210px">\n'
        '      <canvas id="suiteChart"></canvas>\n'
        '    </div>\n'
        '  </div>\n'

        '  <div class="cc">\n'
        '    <h3>By Browser</h3>\n'
        '    <div class="chart-rel" style="height:180px">\n'
        '      <canvas id="browserChart"></canvas>\n'
        '    </div>\n'
        '  </div>\n'

        '</div>\n'
        '</section>\n'

        # ─── Suite breakdown ────────────────────────────────────────────
        '<section>\n'
        '<div class="stitle">Suite Breakdown</div>\n'
        '<div class="suite-grid">\n'
        + cards_html + '\n'
        '</div>\n'
        '</section>\n'

        # ─── Test table ─────────────────────────────────────────────────
        '<section>\n'
        '<div class="tc-header">\n'
        '  <div class="stitle" style="margin-bottom:0">All Tests</div>\n'
        '  <div class="filters">\n'
        '    <input type="search" id="srch" placeholder="🔍  Search tests…" oninput="filterTable()">\n'
        '    <select id="sfilt" onchange="filterTable()">\n'
        '      <option value="">All Suites</option>\n'
        + suite_opts + '\n'
        '    </select>\n'
        '    <select id="bfilt" onchange="filterTable()">\n'
        '      <option value="">All Browsers</option>\n'
        + browser_opts + '\n'
        '    </select>\n'
        '    <select id="stfilt" onchange="filterTable()">\n'
        '      <option value="">All Status</option>\n'
        '      <option value="passed">Passed</option>\n'
        '      <option value="failed">Failed</option>\n'
        '      <option value="flaky">Flaky</option>\n'
        '    </select>\n'
        '  </div>\n'
        f'  <div class="tc-count" id="tc-count">Showing {total} of {total}</div>\n'
        '</div>\n'
        '<div class="tw">\n'
        '<table>\n'
        '<thead><tr>\n'
        '  <th onclick="sortTable(0)">Status</th>\n'
        '  <th onclick="sortTable(1)">Test</th>\n'
        '  <th onclick="sortTable(2)">Suite</th>\n'
        '  <th onclick="sortTable(3)">Browser</th>\n'
        '  <th onclick="sortTable(4)" style="text-align:right">Duration</th>\n'
        '</tr></thead>\n'
        '<tbody id="tbody">\n'
        + rows_html + '\n'
        '</tbody>\n'
        '</table>\n'
        '</div>\n'
        '</section>\n'

        '</main>\n'

        # ─── Footer ─────────────────────────────────────────────────────
        '<footer>\n'
        f'<p>Generated by <strong>zero-to-test-ai</strong> · ShopNow Store QA Suite · {data["start_str"]}</p>\n'
        '</footer>\n'

        # ─── Data injection ──────────────────────────────────────────────
        '<script>\n'
        'const DATA = ' + chart_json + ';\n'
        '</script>\n'
        '<script>\n'
        + JS + '\n'
        '</script>\n'
        '</body>\n'
        '</html>\n'
    )

    return html


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description='Generate a professional HTML QA report from Playwright JSON results.'
    )
    ap.add_argument(
        'results', nargs='?', type=Path, default=DEFAULT_RESULTS,
        help=f'Path to Playwright JSON results (default: {DEFAULT_RESULTS})',
    )
    ap.add_argument(
        '--output', '-o', type=Path, default=DEFAULT_OUTPUT,
        help=f'Output HTML path (default: {DEFAULT_OUTPUT})',
    )
    args = ap.parse_args()

    if not args.results.exists():
        print(f'Error: results file not found: {args.results}', file=sys.stderr)
        print('Run first:  npx playwright test --config playwright.store.config.ts', file=sys.stderr)
        sys.exit(1)

    print(f'Parsing {args.results} …')
    data = parse_results(args.results)

    print(f'Building report ({data["total"]} tests, {data["pass_pct"]}% pass rate) …')
    html = generate(data)

    args.output.write_text(html, encoding='utf-8')
    print(f'✓  Report written → {args.output}')
    print(f'   Gate: {data["gate"]}  |  {data["passed"] + data["flaky"]}/{data["total"]} passed  |  {data["dur_str"]}')


if __name__ == '__main__':
    main()
