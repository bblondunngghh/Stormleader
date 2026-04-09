#!/bin/bash
# StormLeads Overnight QA Script — TEST & FIX
# Each stage runs as a separate claude invocation using Playwright for browser testing.
# Stage 1: Backend API testing | Stage 2: Frontend feature testing
# Stage 3: UI consistency audit | Stage 4: Fix & re-verify | Stage 5: Report

cd /c/Projects/stormleads

TODAY=$(date +%Y%m%d)
TODAY_PRETTY=$(date '+%A, %B %d, %Y')
LOG="overnight-run.log"
TOTAL_TURNS=0
TOTAL_COST=0
STAGE_RESULTS=""

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

# --- Safety checkpoint ---
git add -A
git commit -m "checkpoint: pre-overnight-run $(date +%Y-%m-%d)" --allow-empty
git tag -f "pre-overnight-${TODAY}"
git tag -f "overnight-checkpoint-${TODAY}"
git push origin HEAD --force-with-lease 2>/dev/null
git push origin "pre-overnight-${TODAY}" --force 2>/dev/null

log "=== OVERNIGHT QA RUN STARTING ==="

# --- Start dev servers ---
cd /c/Projects/stormleads && npm run dev &>/dev/null &
BACKEND_PID=$!
sleep 3

cd /c/Projects/stormleads/client && npx vite --host 0.0.0.0 &>/dev/null &
VITE_PID=$!
sleep 5

cd /c/Projects/stormleads

# --- Helper: run a stage with retry ---
run_stage() {
  local name="$1"
  local max_turns="$2"
  local prompt_file="$3"
  local out_file="claude-overnight-${TODAY}-${name}.json"
  local retries=3
  local wait=300

  log "--- STAGE: $name (max $max_turns turns) ---"

  for attempt in $(seq 1 $retries); do
    log "  Attempt $attempt/$retries"

    claude -p - \
      --dangerously-skip-permissions \
      --max-turns "$max_turns" \
      --output-format json \
      < "$prompt_file" \
      > "$out_file" 2>&1

    STAGE_EXIT=$?

    if [ $STAGE_EXIT -ne 0 ] && grep -qi "rate.limit\|too many\|overloaded\|429" "$out_file" 2>/dev/null; then
      log "  Rate limited. Waiting ${wait}s..."
      sleep $wait
      wait=$((wait * 2))
      continue
    fi

    STAGE_TURNS=$(node -e "try{const d=require('./$out_file');console.log(d.num_turns||0)}catch{console.log(0)}" 2>/dev/null)
    STAGE_COST=$(node -e "try{const d=require('./$out_file');console.log(d.total_cost_usd||0)}catch{console.log(0)}" 2>/dev/null)
    STAGE_STOP=$(node -e "try{const d=require('./$out_file');console.log(d.stop_reason||'unknown')}catch{console.log('unknown')}" 2>/dev/null)

    TOTAL_TURNS=$((TOTAL_TURNS + STAGE_TURNS))
    TOTAL_COST=$(node -e "console.log(($TOTAL_COST + $STAGE_COST).toFixed(2))")

    log "  Completed: $STAGE_TURNS turns, \$$STAGE_COST, stop=$STAGE_STOP"
    STAGE_RESULTS="${STAGE_RESULTS}\n  $name: ${STAGE_TURNS} turns, \$${STAGE_COST}"
    return 0
  done

  log "  FAILED after $retries retries"
  return 1
}

# ============================================================
# PREAMBLE — included in every stage
# ============================================================
PREAMBLE=$(cat /c/Projects/stormleads/overnight-plan.txt)

# ============================================================
# STAGE 1: BACKEND API TESTING
# ============================================================
cat > /tmp/stage-1-api-test.txt << STAGE1
${PREAMBLE}

YOUR TASK: Systematically test every backend API endpoint. Verify each one returns
correct data, handles errors properly, and doesn't crash.

STEP 1: Inventory all API routes
- Read server/src/routes/*.js to find every endpoint
- Read server/src/index.js or server/src/app.js to see how routes are mounted
- Make a complete list of every route: method, path, what it does

STEP 2: Start testing each endpoint
Use curl to hit every endpoint. The backend runs on http://localhost:3000.

First, get an auth token:
curl -s -X POST http://localhost:3000/api/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"brandon","password":"1234","tenant":"waterloo"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))"

Then test each endpoint with that token:
curl -s http://localhost:3000/api/[route] -H 'Authorization: Bearer [TOKEN]'

For each endpoint, verify:
- Does it return a 200 (or appropriate status)?
- Does the response have the expected shape/fields?
- Does it handle missing/bad params gracefully (400, not 500)?
- Test POST/PUT/PATCH endpoints with valid data
- Test with missing required fields — should return 400, not crash

STEP 3: Document results
Create /tmp/api-test-results.txt with:
| Endpoint | Method | Status | Result | Issue |
For broken endpoints, note the exact error.

STEP 4: Fix broken endpoints
For each endpoint that returns 500, crashes, or returns wrong data:
- Read the route handler code
- Identify the bug
- Fix it
- Re-test to verify the fix
- Commit: git commit -m "fix(api): [endpoint] [what was wrong]"

DO NOT add new endpoints. DO NOT refactor working code. Only fix what's broken.

DELIVERABLE: All API endpoints tested. Broken ones fixed and committed.
STAGE1

# ============================================================
# STAGE 2: FRONTEND FEATURE TESTING
# ============================================================
cat > /tmp/stage-2-frontend-test.txt << STAGE2
${PREAMBLE}

YOUR TASK: Systematically test every frontend page and feature using Playwright.
Verify each page renders correctly, handles user interactions, and has no console errors.

The app is at: http://localhost:5173
Login: Email=brandon, Password=1234, Tenant=waterloo

STEP 1: Log into the app with Playwright
- browser_navigate to http://localhost:5173
- browser_snapshot to see the login form
- browser_fill_form to enter credentials
- browser_click to submit
- browser_snapshot to verify you're on the dashboard

STEP 2: Test each page systematically
For EACH page below:
  a) browser_navigate to the page
  b) browser_snapshot — verify all elements rendered
  c) browser_console_messages — check for errors/warnings
  d) browser_take_screenshot — save visual evidence
  e) Test interactions: click buttons, open modals, fill forms, submit
  f) Document what works and what's broken

PAGES TO TEST (in order):

/dashboard — Do stat cards show real data? Funnel chart? Activity feed?
  Tasks due today? Team leaderboard? Click on stat cards — do they navigate?

/storm-map — Does the map render? Storm swaths load? Layer panel toggle each layer.
  Address search works? Honey Holes layer? DO NOT test FEMA properties.

/pipeline — Kanban board renders with stages? Lead cards present?
  Drag a card between stages. Click a card — does detail open?

/leads — Table renders? Test each filter (status, source, date).
  Search works? CSV export? Pagination? Sort columns?

/leads/:id — Detail page loads? Test every tab.
  Edit a field and save. Open activity modal. Score breakdown popup.

/estimates — List loads? Create new estimate. Builder renders?
  Add line items. Live preview updates? Save works?

/invoices — List loads? Create invoice. Record payment.

/work-orders — Kanban renders? Create work order. Milestones? Checklists?

/tasks — List loads? Create task. Filter tabs. Toggle complete.

/calendar — Renders? Events shown? Click date/event?

/reports — Charts render? Date range picker? Report type switching?

/canvassing — Map renders? Pin dropping? Territories?

/content-studio — Page loads? Content type selection? Generation?

/settings — Test EVERY tab:
  Profile, Company, Team, Storm Alerts, Notifications,
  Email/SMTP, Financing, Integrations, Drip Sequences,
  Custom Fields, Contracts, Reviews

STEP 3: Fix broken features as you find them
For each broken feature:
- Read the component code
- Identify the bug
- Fix it
- Build check: cd /c/Projects/stormleads/client && npx vite build
- Re-test with Playwright
- Commit: git commit -m "fix(ui): [page] [what was wrong]"

DO NOT add new features. DO NOT improve working features. Only fix what's broken.

DELIVERABLE: All pages tested. Broken features fixed and committed.
STAGE2

# ============================================================
# STAGE 3: UI CONSISTENCY AUDIT
# ============================================================
cat > /tmp/stage-3-ui-audit.txt << STAGE3
${PREAMBLE}

YOUR TASK: Perform a detailed UI consistency audit across the entire app using Playwright.
You are checking that every visual element follows the same standards everywhere.
Fix any inconsistencies you find.

The app is at: http://localhost:5173
You should already be logged in from the previous stage. If not, log in first.

=== AUDIT 1: ICON CONSISTENCY ===

The app uses @heroicons/react/24/outline EXCLUSIVELY.
No other icon library, no solid variants, no inline SVGs used as icons.

Code check:
- Read every component file in client/src/components/
- Verify every icon import is from '@heroicons/react/24/outline'
- Flag any icon from '@heroicons/react/24/solid' or any other library
- Flag any inline <svg> being used as a UI icon (decorative SVGs in maps are OK)

Browser check with Playwright on every page:
- browser_evaluate: document.querySelectorAll('svg') — count SVG icons
- Verify they all come from Heroicons (check class names, viewBox patterns)
- Flag any FontAwesome classes (fa-*), Material Icons, or other foreign icons

Fix: Replace any non-Heroicon icons with the correct @heroicons/react/24/outline equivalent.

=== AUDIT 2: BUTTON CONSISTENCY ===

Every button in the app should have consistent sizing, padding, and styling.

Browser check on EVERY page with Playwright browser_evaluate:
- Collect all <button> elements and their computed styles:
  height, padding, fontSize, borderRadius, fontWeight
- Group buttons by apparent purpose:
  - Primary action buttons (submit, save, create)
  - Secondary buttons (cancel, back)
  - Icon-only buttons (toolbar actions)
  - Danger buttons (delete, remove)
- Flag any button that deviates from the majority in its group
- Check: Do all primary buttons use the same background color?
- Check: Do all buttons have the same border-radius?
- Check: Do all buttons have consistent padding?

Also check the code:
- Read the CSS (client/src/index.css or similar) for button class definitions
- Verify components use the standard button classes, not one-off inline styles

Fix: Standardize any outlier buttons to match the established pattern.

=== AUDIT 3: TOOLBAR & HEADER BAR CONSISTENCY ===

Every page should have a consistent top toolbar/header pattern.

Browser check on every page:
- browser_navigate to each page, browser_snapshot
- Check: Does every page have a header/toolbar?
- Check: Is the header height the same on every page?
- Check: Is the header layout consistent (title left, actions right)?
- Check: Do action buttons in headers use the same styling?
- browser_evaluate to measure header heights across pages — they should match

Fix: Standardize any inconsistent headers.

=== AUDIT 4: SIDEBAR & NAVIGATION CONSISTENCY ===

Check the sidebar navigation:
- browser_snapshot on multiple pages — is sidebar consistent?
- Are active states styled the same way?
- Do all nav items have icons? Are they all Heroicons outline?
- Is spacing between nav items consistent?
- Does collapse/expand work correctly?

=== AUDIT 5: FORM ELEMENT CONSISTENCY ===

Every form element must use the .form-input class and match the glassmorphism style.

Browser check on pages with forms (settings, estimates, lead detail, etc.):
- browser_evaluate: collect all <input>, <select>, <textarea> elements
- Check computed styles: height, padding, background, border, borderRadius
- Verify they all use the .form-input class (or equivalent standard class)
- Flag any native <select> elements — should use CustomSelect component
- Flag any native <input type="date"> — should use DatePicker component
- Check label styling is consistent

Fix: Replace non-standard form elements with the project's standard components.

=== AUDIT 6: SPACING & ALIGNMENT ===

Check consistent spacing between sections, cards, and elements:
- browser_evaluate to measure gaps between cards, sections, form fields
- Check: Is the gap between cards consistent across pages?
- Check: Are section headers styled the same way everywhere?
- Check: Is content padding consistent inside .glass panels?

=== AUDIT 7: MODAL CONSISTENCY ===

Open every modal in the app and verify:
- All modals use the modal-backdrop class
- All modals have the scale-in animation
- Modal header styling is consistent
- Close button (X) is positioned consistently
- Modal widths are appropriate and consistent for similar types

=== DOCUMENTING FINDINGS ===

Create /tmp/ui-audit-results.txt with a table:
| Page | Issue Type | Element | Expected | Actual | Fixed? |

For each fix:
- Build check: cd /c/Projects/stormleads/client && npx vite build
- Re-verify with Playwright
- Commit: git commit -m "fix(ui): [page] [consistency fix description]"

DELIVERABLE: Complete UI audit. All inconsistencies documented. Fixes committed.
STAGE3

# ============================================================
# STAGE 4: REGRESSION VERIFICATION
# ============================================================
cat > /tmp/stage-4-verify.txt << STAGE4
${PREAMBLE}

YOUR TASK: Re-verify all fixes from previous stages and test edge cases.

STEP 1: Check what was fixed
Run: git log --oneline overnight-checkpoint-\$(date +%Y%m%d)..HEAD
Read each commit to understand what was fixed.

STEP 2: Re-test every fix with Playwright
For each fix commit:
- Navigate to the affected page
- browser_snapshot and browser_take_screenshot
- Verify the fix actually works visually
- browser_console_messages — no new errors
- Test related functionality to make sure the fix didn't break something else

STEP 3: Test edge cases
- Empty states: What happens with no leads? No estimates? No tasks?
- Form validation: Submit forms with empty required fields
- Navigation: All sidebar links work? Browser back/forward?
- Responsive: browser_resize to mobile width (375px) — does it degrade gracefully?
- Build check: cd /c/Projects/stormleads/client && npx vite build

STEP 4: Fix any remaining issues
- Same process: identify bug, fix, build check, test, commit
- Commit: git commit -m "fix: [what was wrong]"

STEP 5: Final build verification
- cd /c/Projects/stormleads/client && npx vite build
- If it fails, fix until it passes

DELIVERABLE: All fixes verified. Edge cases tested. Build passes clean.
STAGE4

# ============================================================
# STAGE 5: QA REPORT
# ============================================================
cat > /tmp/stage-5-report.txt << 'STAGE5'
${PREAMBLE}

YOUR TASK: Write the QA test report and send it via email. This is your ONLY task.

1. Review ALL work done tonight:
   git log --oneline overnight-checkpoint-$(date +%Y%m%d)..HEAD

2. Read /tmp/api-test-results.txt, /tmp/frontend-test-results.txt,
   and /tmp/ui-audit-results.txt if they exist.

3. Create OVERNIGHT-REPORT.md with these sections:

   ## QA Test Summary
   Total pages tested, total API endpoints tested, total bugs found, total bugs fixed.

   ## Backend API Test Results
   For each endpoint category (auth, CRM, estimates, etc.):
   - How many endpoints tested
   - How many passed / failed
   - What was fixed (with commit hashes)

   ## Frontend Feature Test Results
   For each page:
   - What was tested
   - What passed
   - What was broken and how it was fixed
   - What still needs attention (if anything)

   ## UI Consistency Audit Results
   For each audit category:
   - Icons: Any non-Heroicon icons found? Fixed?
   - Buttons: Any sizing/styling inconsistencies? Fixed?
   - Toolbars/Headers: Consistent across pages?
   - Sidebar/Nav: Any issues?
   - Forms: Any non-standard elements? Fixed?
   - Spacing: Any alignment issues? Fixed?
   - Modals: All consistent?

   ## Bugs Fixed (numbered list)
   1. [Page/Endpoint] — [Bug description] — [How fixed]

   ## Known Issues (Not Fixed)
   Anything broken but couldn't be fixed (needs API key, DB migration, design decision).

   ## Test Coverage Gaps
   Any areas that couldn't be fully tested and why.

   Write it like a professional QA report — clear, factual, no fluff.

4. APPEND to docs/overnight-history.md (NEVER overwrite):
   ---
   ## QA Run: $(date +%Y-%m-%d)
   ### Test Results
   - Pages tested: [count]
   - API endpoints tested: [count]
   - Bugs found: [count]
   - Bugs fixed: [count]
   - UI inconsistencies found: [count]
   - UI inconsistencies fixed: [count]
   ### Fixes Made
   - [list each fix]
   ### UI Consistency Fixes
   - [list each UI fix]
   ### Known Issues Remaining
   - [list any unfixed issues]
   ---

5. Update overnight_resume.md with current progress.

6. Commit: git add OVERNIGHT-REPORT.md docs/ && git commit -m "docs: QA report $(date +%Y-%m-%d)"

7. Final build check: cd /c/Projects/stormleads/client && npx vite build

DELIVERABLE: OVERNIGHT-REPORT.md committed. History updated. Resume file updated.
STAGE5

# ============================================================
# RUN ALL STAGES
# ============================================================

log "Stage 1: Backend API Testing"
run_stage "s1-api-test" 50 /tmp/stage-1-api-test.txt
COMMITS_AFTER_S1=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S1"

log "Stage 2: Frontend Feature Testing"
run_stage "s2-frontend-test" 80 /tmp/stage-2-frontend-test.txt
COMMITS_AFTER_S2=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S2"

log "Stage 3: UI Consistency Audit"
run_stage "s3-ui-audit" 60 /tmp/stage-3-ui-audit.txt
COMMITS_AFTER_S3=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S3"

log "Stage 4: Regression Verification"
run_stage "s4-verify" 40 /tmp/stage-4-verify.txt
COMMITS_AFTER_S4=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S4"

log "Stage 5: QA Report"
run_stage "s5-report" 30 /tmp/stage-5-report.txt
FINAL_COMMITS=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Final commit count: $FINAL_COMMITS"

# ============================================================
# SUMMARY & EMAIL
# ============================================================

log "=== ALL STAGES COMPLETE ==="
log "Total turns: $TOTAL_TURNS"
log "Total cost: \$$TOTAL_COST"
log "Total commits: $FINAL_COMMITS"
log "Stage breakdown:$STAGE_RESULTS"

# Send email
export $(grep RESEND_API_KEY .env | xargs) 2>/dev/null

GIT_SUMMARY=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null || echo "No new commits")

node -e "
const fs = require('fs');
const report = fs.existsSync('OVERNIGHT-REPORT.md') ? fs.readFileSync('OVERNIGHT-REPORT.md','utf8') : 'No report generated.';
const commits = process.argv[1];
const today = process.argv[2];
const tagDate = process.argv[3];
const totalTurns = process.argv[4];
const totalCost = process.argv[5];
const stageBreakdown = process.argv[6];
const apiKey = process.env.RESEND_API_KEY;

function mdToHtml(md) {
  return md
    .replace(/</g, '&lt;')
    .replace(/^## (.+)$/gm, '<h2 style=\"color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;\">\$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style=\"color:#a882ff;margin-top:20px;font-size:16px;\">\$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style=\"color:#f0f0f0;\">\$1</strong>')
    .replace(/^- (.+)$/gm, '<li style=\"margin:4px 0;line-height:1.6;\">\$1</li>')
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style=\"padding-left:20px;margin:8px 0;\">\$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li style=\"margin:4px 0;line-height:1.6;\">\$1</li>')
    .replace(/^(?!<[hul]|<li|<strong)(.+)$/gm, '<p style=\"margin:8px 0;line-height:1.6;\">\$1</p>');
}

const commitCount = commits.split('\\n').filter(l => l.trim()).length;

const html = \`
<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#111827;color:#d1d5db;padding:40px;border-radius:16px;\">
  <div style=\"text-align:center;margin-bottom:32px;\">
    <h1 style=\"color:#0ea5e9;margin:0;font-size:28px;\">StormLeads QA Report</h1>
    <p style=\"color:#6b7280;margin:8px 0 0;font-size:14px;\">\${today}</p>
    <p style=\"color:#22c55e;margin:4px 0 0;font-size:12px;\">OVERNIGHT QA TEST & FIX RUN (5 stages)</p>
    <div style=\"display:flex;justify-content:center;gap:24px;margin-top:12px;\">
      <div style=\"text-align:center;\">
        <div style=\"color:#22c55e;font-size:24px;font-weight:bold;\">\${totalTurns}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Total Turns</div>
      </div>
      <div style=\"text-align:center;\">
        <div style=\"color:#f59e0b;font-size:24px;font-weight:bold;\">\${commitCount}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Fixes</div>
      </div>
      <div style=\"text-align:center;\">
        <div style=\"color:#ef4444;font-size:24px;font-weight:bold;\">\$\${totalCost}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Cost</div>
      </div>
    </div>
  </div>

  <div style=\"background:#1f2937;border-radius:8px;padding:16px;margin-bottom:24px;\">
    <h3 style=\"color:#a882ff;margin-top:0;font-size:14px;\">Stage Breakdown</h3>
    <pre style=\"color:#8b949e;font-size:12px;margin:0;\">\${stageBreakdown}</pre>
  </div>

  <div style=\"background:#1f2937;border-radius:12px;padding:24px;margin-bottom:24px;\">
    \${mdToHtml(report)}
  </div>

  <details style=\"margin-top:16px;\">
    <summary style=\"color:#6b7280;cursor:pointer;font-size:13px;\">Commits</summary>
    <pre style=\"background:#0d1117;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;margin-top:8px;color:#8b949e;\">\${commits.replace(/</g,'&lt;')}</pre>
  </details>

  <hr style=\"border:1px solid #2a2a4a;margin:24px 0;\">
  <p style=\"color:#6b7280;font-size:12px;text-align:center;\">
    Revert: <code style=\"background:#1f2937;padding:2px 6px;border-radius:4px;\">git reset --hard pre-overnight-\${tagDate}</code>
  </p>
</div>\`;

if (!apiKey) { console.log('No RESEND_API_KEY — skipping email'); process.exit(0); }

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'StormLeads <reports@accessvaletparking.com>',
    to: ['brandon@accessvaletparking.com'],
    subject: 'StormLeads QA Report \u2014 ' + commitCount + ' fixes \u2014 ' + today,
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Email sent (id: ' + d.id + ')' : 'Email failed: ' + JSON.stringify(d));
}).catch(e => console.error('Email send failed:', e.message));
" "$GIT_SUMMARY" "$TODAY_PRETTY" "$TODAY" "$TOTAL_TURNS" "$TOTAL_COST" "$STAGE_RESULTS"

# --- Cleanup ---
[ -n "$VITE_PID" ] && kill $VITE_PID 2>/dev/null
[ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null

log "=== OVERNIGHT QA RUN FINISHED ==="
