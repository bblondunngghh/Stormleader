#!/bin/bash
# Monitor the staged overnight run — email Brandon if total turns < 100
cd /c/Projects/stormleads

export $(grep RESEND_API_KEY .env | xargs) 2>/dev/null

TODAY=$(date +%Y%m%d)
STAGES=("s1-competitors" "s2-features" "s3-ui-audit" "s4-stormmap" "s5-security" "s6-report")

while true; do
  # Check if the last stage (s6-report) has completed
  LAST_STAGE="claude-overnight-${TODAY}-s6-report.json"

  if [ -f "$LAST_STAGE" ] && grep -q "num_turns" "$LAST_STAGE" 2>/dev/null; then
    # All stages done — tally up
    TOTAL_TURNS=0
    BREAKDOWN=""

    for stage in "${STAGES[@]}"; do
      FILE="claude-overnight-${TODAY}-${stage}.json"
      if [ -f "$FILE" ]; then
        TURNS=$(node -e "try{const d=require('./$FILE');console.log(d.num_turns||0)}catch{console.log(0)}")
        TOTAL_TURNS=$((TOTAL_TURNS + TURNS))
        BREAKDOWN="${BREAKDOWN}  ${stage}: ${TURNS} turns\n"
      else
        BREAKDOWN="${BREAKDOWN}  ${stage}: MISSING\n"
      fi
    done

    echo "All stages finished. Total turns: $TOTAL_TURNS"
    echo -e "Breakdown:\n$BREAKDOWN"

    if [ "$TOTAL_TURNS" -lt 100 ] 2>/dev/null; then
      echo "UNDER 100 TURNS — sending alert email"
      node -e "
const apiKey = process.env.RESEND_API_KEY;
const turns = process.argv[1];
const breakdown = process.argv[2];

const html = \`<div style=\"font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#111827;color:#d1d5db;padding:32px;border-radius:12px;\">
<h1 style=\"color:#ef4444;margin-top:0;\">Overnight Run Alert</h1>
<p>The staged overnight run finished with only <strong>\${turns}</strong> total turns (minimum expected: 100).</p>
<div style=\"background:#1f2937;border-radius:8px;padding:20px;margin:16px 0;\">
  <h3 style=\"color:#a882ff;margin-top:0;\">Stage Breakdown</h3>
  <pre style=\"color:#8b949e;font-size:13px;\">\${breakdown}</pre>
</div>
<p>The agent may still be short-circuiting individual stages. Check the per-stage JSON files.</p>
<p style=\"color:#6b7280;font-size:12px;\">Review: <code style=\"background:#1f2937;padding:2px 6px;border-radius:4px;\">cat overnight-run.log</code></p>
</div>\`;

if (!apiKey) { console.log('No RESEND_API_KEY'); process.exit(0); }
fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'StormLeads <reports@accessvaletparking.com>',
    to: ['brandon@accessvaletparking.com'],
    subject: 'Overnight Alert — Only ' + turns + ' total turns across 6 stages',
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Alert sent (id: ' + d.id + ')' : 'Send failed: ' + JSON.stringify(d));
}).catch(e => console.error('Send failed:', e.message));
" "$TOTAL_TURNS" "$BREAKDOWN"
    else
      echo "Run completed with $TOTAL_TURNS total turns — looks good, no alert needed"
    fi

    exit 0
  fi

  # Show progress — which stages have completed so far
  PROGRESS=""
  for stage in "${STAGES[@]}"; do
    FILE="claude-overnight-${TODAY}-${stage}.json"
    if [ -f "$FILE" ] && grep -q "num_turns" "$FILE" 2>/dev/null; then
      TURNS=$(node -e "try{const d=require('./$FILE');console.log(d.num_turns||0)}catch{console.log(0)}")
      PROGRESS="${PROGRESS} ${stage}=${TURNS}"
    elif [ -f "$FILE" ]; then
      PROGRESS="${PROGRESS} ${stage}=running"
    fi
  done

  echo "Still running... ($(date))${PROGRESS:+ |$PROGRESS}"
  sleep 60
done
