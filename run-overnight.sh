#!/bin/bash
# StormLeads Overnight Build Script
# Scheduled to run at 5:00 AM daily for 5 days
# Auto-retries on rate limit (waits 30 min between attempts)

cd /c/Projects/stormleads

# Create safety checkpoint
git add -A
git stash
git tag -f "overnight-checkpoint-$(date +%Y%m%d)"

# Restore working changes
git stash pop 2>/dev/null

MAX_RETRIES=5
RETRY_WAIT=1800  # 30 minutes between retries

for attempt in $(seq 1 $MAX_RETRIES); do
  echo "=== Attempt $attempt of $MAX_RETRIES at $(date) ==="

  claude -p < overnight-plan.txt \
    --dangerously-skip-permissions \
    --max-turns 100 \
    --output-format json \
    > "claude-overnight-$(date +%Y%m%d)-attempt${attempt}.json" 2>&1

  EXIT_CODE=$?

  # Check if it completed successfully (exit 0) or hit rate limit
  if [ $EXIT_CODE -eq 0 ]; then
    echo "Completed successfully at $(date)"
    break
  fi

  # Check output for rate limit indicators
  if grep -qi "rate.limit\|too many\|overloaded\|429" "claude-overnight-$(date +%Y%m%d)-attempt${attempt}.json" 2>/dev/null; then
    echo "Rate limited on attempt $attempt. Waiting ${RETRY_WAIT}s before retry..."
    sleep $RETRY_WAIT
  else
    echo "Failed with exit code $EXIT_CODE (not rate limit). Stopping."
    break
  fi
done

echo "Overnight run finished at $(date)"

# Send email summary to brandon via Resend API
source .env 2>/dev/null

REPORT_FILE="OVERNIGHT-REPORT.md"
if [ -f "$REPORT_FILE" ]; then
  REPORT_CONTENT=$(cat "$REPORT_FILE")
else
  REPORT_CONTENT="No OVERNIGHT-REPORT.md was generated. Check the JSON output logs."
fi

GIT_SUMMARY=$(git log --oneline "overnight-checkpoint-$(date +%Y%m%d)"..HEAD 2>/dev/null || echo "No new commits")
FILES_CHANGED=$(git diff --stat "overnight-checkpoint-$(date +%Y%m%d)"..HEAD 2>/dev/null || echo "Unable to diff")
TODAY=$(date '+%A, %B %d, %Y')

# Escape strings for JSON
escape_json() { python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$1"; }

COMMITS_JSON=$(escape_json "$GIT_SUMMARY")
FILES_JSON=$(escape_json "$FILES_CHANGED")
REPORT_JSON=$(escape_json "$REPORT_CONTENT")

HTML_BODY="<div style=\"font-family:-apple-system,sans-serif;max-width:700px;margin:0 auto;background:#1a1a2e;color:#e0e0e0;padding:32px;border-radius:12px;\"><h1 style=\"color:#0ea5e9;margin-top:0;\">StormLeads Overnight Report</h1><p style=\"color:#8a8a9a;\">$TODAY</p><h2 style=\"color:#22c55e;border-bottom:1px solid #333;padding-bottom:8px;\">Commits</h2><pre style=\"background:#0d0d1a;padding:16px;border-radius:8px;font-size:13px;overflow-x:auto;\">$GIT_SUMMARY</pre><h2 style=\"color:#f59e0b;border-bottom:1px solid #333;padding-bottom:8px;\">Files Changed</h2><pre style=\"background:#0d0d1a;padding:16px;border-radius:8px;font-size:13px;overflow-x:auto;\">$FILES_CHANGED</pre><h2 style=\"color:#a882ff;border-bottom:1px solid #333;padding-bottom:8px;\">Detailed Report</h2><div style=\"background:#0d0d1a;padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;\">$REPORT_CONTENT</div><hr style=\"border:1px solid #333;margin:24px 0;\"><p style=\"color:#8a8a9a;font-size:12px;\">Review changes: <code>claude --continue</code> then ask &quot;summarize everything you did&quot;</p></div>"

BODY_JSON=$(escape_json "$HTML_BODY")

curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"StormLeads <reports@accessvaletparking.com>\",\"to\":[\"brandon@accessvaletparking.com\"],\"subject\":\"StormLeads Overnight Report - $TODAY\",\"html\":$BODY_JSON}" \
  && echo "Email sent to brandon@accessvaletparking.com" \
  || echo "Email send failed"
