#!/bin/bash
# StormLeads Overnight Build Script
# Scheduled to run at 5:00 AM daily for 10 days
# Auto-retries on rate limit (waits 30 min between attempts)

cd /c/Projects/stormleads

# Create safety checkpoint — commit and tag current state before agent makes changes
# Brandon can revert with: git reset --hard pre-overnight-YYYYMMDD
git add -A
git commit -m "checkpoint: pre-overnight-run $(date +%Y-%m-%d)" --allow-empty
git tag -f "pre-overnight-$(date +%Y%m%d)"
git tag -f "overnight-checkpoint-$(date +%Y%m%d)"
git push origin HEAD --force-with-lease 2>/dev/null
git push origin "pre-overnight-$(date +%Y%m%d)" --force 2>/dev/null

MAX_RETRIES=5
RETRY_WAIT=14400  # 4 hours between retries (rate limit cooldown)

for attempt in $(seq 1 $MAX_RETRIES); do
  echo "=== Attempt $attempt of $MAX_RETRIES at $(date) ==="

  PLAN_CONTENT=$(cat overnight-plan.txt)

  claude -p "$PLAN_CONTENT" \
    --dangerously-skip-permissions \
    --max-turns 1000 \
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
export $(grep RESEND_API_KEY .env | xargs) 2>/dev/null

REPORT_FILE="OVERNIGHT-REPORT.md"
if [ -f "$REPORT_FILE" ]; then
  REPORT_CONTENT=$(cat "$REPORT_FILE")
else
  REPORT_CONTENT="No OVERNIGHT-REPORT.md was generated. Check the JSON output logs."
fi

GIT_SUMMARY=$(git log --oneline "overnight-checkpoint-$(date +%Y%m%d)"..HEAD 2>/dev/null || echo "No new commits")
TODAY=$(date '+%A, %B %d, %Y')
TAG_DATE=$(date +%Y%m%d)

# Extract run stats from the most recent JSON output
LATEST_JSON=$(ls -t claude-overnight-$(date +%Y%m%d)-attempt*.json 2>/dev/null | head -1)
if [ -n "$LATEST_JSON" ]; then
  RUN_TURNS=$(node -e "try{const d=require('./$LATEST_JSON');console.log(d.num_turns||'?')}catch{console.log('?')}")
  RUN_DURATION_MS=$(node -e "try{const d=require('./$LATEST_JSON');console.log(d.duration_ms||0)}catch{console.log(0)}")
  RUN_DURATION_MIN=$(node -e "console.log(Math.round($RUN_DURATION_MS/60000))")
  RUN_DURATION_HR=$(node -e "const m=$RUN_DURATION_MS/60000;console.log(m>=60?Math.floor(m/60)+'h '+Math.round(m%60)+'m':Math.round(m)+'m')")
else
  RUN_TURNS="?"
  RUN_DURATION_HR="?"
fi

# Build a clean, readable HTML email from OVERNIGHT-REPORT.md using node
node -e "
const fs = require('fs');
const report = fs.existsSync('OVERNIGHT-REPORT.md') ? fs.readFileSync('OVERNIGHT-REPORT.md','utf8') : 'No report generated.';
const commits = process.argv[1];
const today = process.argv[2];
const tagDate = process.argv[3];
const runTurns = process.argv[4];
const runDuration = process.argv[5];
const apiKey = process.env.RESEND_API_KEY;

// Convert markdown to styled HTML sections
function mdToHtml(md) {
  let html = md
    .replace(/</g, '&lt;')
    // H2 headers — section dividers
    .replace(/^## (.+)$/gm, '<h2 style=\"color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;\">\$1</h2>')
    // H3 headers
    .replace(/^### (.+)$/gm, '<h3 style=\"color:#a882ff;margin-top:20px;font-size:16px;\">\$1</h3>')
    // Bold text
    .replace(/\*\*(.+?)\*\*/g, '<strong style=\"color:#f0f0f0;\">\$1</strong>')
    // Bullet points
    .replace(/^- (.+)$/gm, '<li style=\"margin:4px 0;line-height:1.6;\">\$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style=\"padding-left:20px;margin:8px 0;\">\$1</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li style=\"margin:4px 0;line-height:1.6;\">\$1</li>')
    // Paragraphs (non-empty lines not already tagged)
    .replace(/^(?!<[hul]|<li|<strong)(.+)$/gm, '<p style=\"margin:8px 0;line-height:1.6;\">\$1</p>');
  return html;
}

const commitCount = commits.split('\\n').filter(l => l.trim()).length;

const html = \`
<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#111827;color:#d1d5db;padding:40px;border-radius:16px;\">

  <div style=\"text-align:center;margin-bottom:32px;\">
    <h1 style=\"color:#0ea5e9;margin:0;font-size:28px;\">StormLeads Overnight Report</h1>
    <p style=\"color:#6b7280;margin:8px 0 0;font-size:14px;\">\${today}</p>
    <div style=\"display:flex;justify-content:center;gap:24px;margin-top:12px;\">
      <div style=\"text-align:center;\">
        <div style=\"color:#0ea5e9;font-size:24px;font-weight:bold;\">\${runDuration}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Duration</div>
      </div>
      <div style=\"text-align:center;\">
        <div style=\"color:#22c55e;font-size:24px;font-weight:bold;\">\${runTurns}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Turns</div>
      </div>
      <div style=\"text-align:center;\">
        <div style=\"color:#f59e0b;font-size:24px;font-weight:bold;\">\${commitCount}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Commits</div>
      </div>
    </div>
  </div>

  <div style=\"background:#1f2937;border-radius:12px;padding:24px;margin-bottom:24px;\">
    \${mdToHtml(report)}
  </div>

  <details style=\"margin-top:16px;\">
    <summary style=\"color:#6b7280;cursor:pointer;font-size:13px;\">Technical Details (commits)</summary>
    <pre style=\"background:#0d1117;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;margin-top:8px;color:#8b949e;\">\${commits.replace(/</g,'&lt;')}</pre>
  </details>

  <hr style=\"border:1px solid #2a2a4a;margin:24px 0;\">
  <p style=\"color:#6b7280;font-size:12px;text-align:center;\">
    To review in detail: run <code style=\"background:#1f2937;padding:2px 6px;border-radius:4px;\">claude --continue</code> and ask what was done
  </p>
  <p style=\"color:#6b7280;font-size:12px;text-align:center;margin-top:8px;\">
    Don't like the changes? Revert with: <code style=\"background:#1f2937;padding:2px 6px;border-radius:4px;\">git reset --hard pre-overnight-\${tagDate}</code>
  </p>
</div>\`;

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'StormLeads <reports@accessvaletparking.com>',
    to: ['brandon@accessvaletparking.com'],
    subject: 'StormLeads Overnight Report - ' + today,
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Email sent to brandon@accessvaletparking.com (id: ' + d.id + ')' : 'Email failed: ' + JSON.stringify(d));
}).catch(e => console.error('Email send failed:', e.message));
" "$GIT_SUMMARY" "$TODAY" "$TAG_DATE" "$RUN_TURNS" "$RUN_DURATION_HR"
