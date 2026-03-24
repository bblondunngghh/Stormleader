#!/bin/bash
# Monitor the overnight run — email Brandon if it finishes under 100 turns
cd /c/Projects/stormleads

export $(grep RESEND_API_KEY .env | xargs) 2>/dev/null

TODAY=$(date +%Y%m%d)

# Wait for the run to produce output (check every 60 seconds)
while true; do
  LATEST_JSON=$(ls -t claude-overnight-${TODAY}-attempt*.json 2>/dev/null | head -1)

  if [ -n "$LATEST_JSON" ]; then
    # Check if the file has a complete JSON result (contains "num_turns")
    if grep -q "num_turns" "$LATEST_JSON" 2>/dev/null; then
      TURNS=$(node -e "try{const d=require('./$LATEST_JSON');console.log(d.num_turns||0)}catch{console.log(0)}")
      DURATION_MS=$(node -e "try{const d=require('./$LATEST_JSON');console.log(d.duration_ms||0)}catch{console.log(0)}")
      DURATION_HR=$(node -e "const m=$DURATION_MS/60000;console.log(m>=60?Math.floor(m/60)+'h '+Math.round(m%60)+'m':Math.round(m)+'m')")
      STOP_REASON=$(node -e "try{const d=require('./$LATEST_JSON');console.log(d.stop_reason||'unknown')}catch{console.log('unknown')}")

      echo "Run finished: $TURNS turns in $DURATION_HR (stop: $STOP_REASON)"

      if [ "$TURNS" -lt 100 ] 2>/dev/null; then
        echo "UNDER 100 TURNS — sending alert email"
        node -e "
const apiKey = process.env.RESEND_API_KEY;
const turns = process.argv[1];
const duration = process.argv[2];
const stop = process.argv[3];

const html = \`<div style=\"font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#111827;color:#d1d5db;padding:32px;border-radius:12px;\">
<h1 style=\"color:#ef4444;margin-top:0;\">⚠️ Overnight Run Alert</h1>
<p>The overnight agent finished too early again.</p>
<div style=\"background:#1f2937;border-radius:8px;padding:20px;margin:16px 0;\">
  <p><strong style=\"color:#f0f0f0;\">Turns:</strong> \${turns} (minimum expected: 100)</p>
  <p><strong style=\"color:#f0f0f0;\">Duration:</strong> \${duration}</p>
  <p><strong style=\"color:#f0f0f0;\">Stop reason:</strong> \${stop}</p>
</div>
<p>The agent is still shortcutting the plan. May need to investigate the overnight-plan.txt or how the prompt is being passed.</p>
<p style=\"color:#6b7280;font-size:12px;\">Review: run <code style=\"background:#1f2937;padding:2px 6px;border-radius:4px;\">claude --continue</code></p>
</div>\`;

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'StormLeads <reports@accessvaletparking.com>',
    to: ['brandon@accessvaletparking.com'],
    subject: '⚠️ Overnight Run Alert — Only ' + turns + ' turns',
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Alert sent (id: ' + d.id + ')' : 'Send failed: ' + JSON.stringify(d));
}).catch(e => console.error('Send failed:', e.message));
" "$TURNS" "$DURATION_HR" "$STOP_REASON"
      else
        echo "Run completed with $TURNS turns — looks good, no alert needed"
      fi

      exit 0
    fi
  fi

  echo "Still running... ($(date))"
  sleep 60
done
