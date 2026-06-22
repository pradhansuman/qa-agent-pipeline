#!/usr/bin/env bash
# Usage: ./rerun.sh 4
# Re-triggers the QA pipeline on the given issue number without touching labels.

ISSUE=${1:-4}
REPO="pradhansuman/qa-agent-pipeline"

echo "Triggering QA pipeline on issue #$ISSUE ..."
gh workflow run qa-pipeline.yml \
  --repo "$REPO" \
  --field issue_number="$ISSUE"

echo "Done. Watch progress at: https://github.com/$REPO/actions"
