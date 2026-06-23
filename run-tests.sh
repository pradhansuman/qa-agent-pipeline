#!/usr/bin/env bash
# run-tests.sh
# One command: run ShopNow tests → generate HTML report → commit → push
#
# Usage:
#   ./run-tests.sh                    # run full suite (all projects)
#   ./run-tests.sh --smoke            # run only @smoke tests on Desktop Chrome
#   ./run-tests.sh --no-push          # run + report + commit, but skip push
#   ./run-tests.sh --report-only      # regenerate report from last results.json

set -uo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
C_CYAN='\033[0;36m'; C_GREEN='\033[0;32m'; C_RED='\033[0;31m'
C_YELLOW='\033[0;33m'; C_BOLD='\033[1m'; C_DIM='\033[2m'; NC='\033[0m'

log()   { echo -e "${C_CYAN}▶${NC}  $*"; }
ok()    { echo -e "${C_GREEN}✓${NC}  $*"; }
warn()  { echo -e "${C_YELLOW}⚠${NC}  $*"; }
fail()  { echo -e "${C_RED}✗${NC}  $*"; }
hr()    { echo -e "${C_DIM}──────────────────────────────────────────────${NC}"; }

# ── Parse args ─────────────────────────────────────────────────────────────────
NO_PUSH=false
REPORT_ONLY=false
SMOKE=false
for arg in "${@:-}"; do
  case "$arg" in
    --no-push)     NO_PUSH=true ;;
    --report-only) REPORT_ONLY=true ;;
    --smoke)       SMOKE=true ;;
  esac
done

hr
echo -e "${C_BOLD}  🧪 ShopNow QA Pipeline${NC}"
echo -e "  ${C_DIM}$(date '+%Y-%m-%d %H:%M')${NC}"
if [ "$SMOKE" = true ]; then
  echo -e "  ${C_YELLOW}Mode: SMOKE  (@smoke tests only, Desktop Chrome)${NC}"
fi
hr

PW_EXIT=0
STATS=""

# ── 1. Run Playwright ──────────────────────────────────────────────────────────
if [ "$REPORT_ONLY" = false ]; then
  if [ "$SMOKE" = true ]; then
    log "Running @smoke tests only (Desktop Chrome)…"
    npx playwright test \
      --config playwright.store.config.ts \
      --project "Desktop Chrome" \
      --grep "@smoke" \
      --retries 0
  else
    log "Running full suite  (playwright.store.config.ts)…"
    npx playwright test --config playwright.store.config.ts
  fi
  PW_EXIT=$?
  echo ""
  if [ $PW_EXIT -eq 0 ]; then
    ok "All tests passed"
  else
    warn "Suite finished with failures (exit $PW_EXIT) — report will still be generated"
  fi
else
  log "--report-only: skipping test run, reusing last results.json"
fi

# ── 1b. Run Python unit tests ─────────────────────────────────────────────────
if [ "$REPORT_ONLY" = false ] && [ "$SMOKE" = false ]; then
  echo ""
  log "Running Python unit tests…"
  mkdir -p test-results-unit
  python -m pytest tests/unit/test_gate.py tests/unit/test_triage.py \
    tests/unit/test_contracts.py tests/unit/test_mobile.py \
    --json-report --json-report-file=test-results-unit/unit-results.json \
    -q --tb=short 2>&1 | grep -v "^$" || true
fi

# ── 2. Generate HTML report ────────────────────────────────────────────────────
echo ""
log "Generating HTML report…"

RESULTS_FILE="test-results-store/results.json"
if [ ! -f "$RESULTS_FILE" ]; then
  fail "results.json not found at $RESULTS_FILE"
  fail "Run without --report-only first to produce test results."
  exit 1
fi

REPORT_LOG=$(python scripts/generate_html_report.py 2>&1)
REPORT_EXIT=$?
echo "$REPORT_LOG"

if [ $REPORT_EXIT -eq 0 ]; then
  ok "Report written → store-qa-report.html"
  # Extract the stats line: "Gate: PASS  |  120/120 passed  |  1m 2s"
  STATS=$(echo "$REPORT_LOG" | grep "Gate:" | sed 's/^[[:space:]]*//')
else
  fail "Report generation failed"
fi

# ── 3. Stage + Commit ──────────────────────────────────────────────────────────
echo ""
log "Staging changes for git…"
git add .

TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')
if [ -n "$STATS" ]; then
  COMMIT_TITLE="ci(store): QA run ${TIMESTAMP} — ${STATS}"
else
  GATE=$( [ $PW_EXIT -eq 0 ] && echo "PASS" || echo "FAIL" )
  COMMIT_TITLE="ci(store): QA run ${TIMESTAMP} — ${GATE}"
fi

if git diff --cached --quiet; then
  log "Nothing new to commit — working tree unchanged since last run"
else
  git commit -m "$(cat <<EOF
${COMMIT_TITLE}

Auto-committed by run-tests.sh after test execution + HTML report generation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
  ok "Committed: ${COMMIT_TITLE}"
fi

# ── 4. Push ────────────────────────────────────────────────────────────────────
if [ "$NO_PUSH" = false ]; then
  echo ""
  log "Pushing to origin/main…"
  if git push origin main; then
    ok "Pushed to origin/main"
  else
    warn "Push failed — changes are committed locally, push manually when ready"
  fi
else
  warn "--no-push: skipping git push"
fi

# ── 5. Open report in browser ──────────────────────────────────────────────────
if [ -f "store-qa-report.html" ]; then
  echo ""
  log "Opening report in browser…"
  open "store-qa-report.html" 2>/dev/null \
    || xdg-open "store-qa-report.html" 2>/dev/null \
    || true
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
hr
if [ $PW_EXIT -eq 0 ]; then
  echo -e "  ${C_BOLD}${C_GREEN}PASS${NC}  ${STATS:-All tests passed}"
else
  echo -e "  ${C_BOLD}${C_RED}FAIL${NC}  ${STATS:-Some tests failed — check store-qa-report.html}"
fi
hr

# Re-emit playwright exit code so CI/CD sees the true pass/fail status
exit $PW_EXIT
