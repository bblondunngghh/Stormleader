#!/bin/bash
# StormLeads Overnight Build Script — COMPETITOR-DRIVEN IMPROVEMENT
# Each stage runs as a separate claude invocation.
# Stage 1: Inventory our app | Stage 2: Research competitors visually
# Stage 3: Compare & improve features | Stage 4: UI consistency check | Stage 5: Report

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

log "=== OVERNIGHT RUN STARTING (competitor-driven) ==="

# --- Ensure Firecrawl is available ---
if ! command -v firecrawl &>/dev/null; then
  log "ERROR: firecrawl CLI not found. Run: npm install -g firecrawl-cli"
  exit 1
fi
firecrawl --status >> "$LOG" 2>&1

# --- Start tunnel for local dev server ---
cd /c/Projects/stormleads && npm run dev &>/dev/null &
BACKEND_PID=$!
sleep 3

cd /c/Projects/stormleads/client && npx vite --host 0.0.0.0 &>/dev/null &
VITE_PID=$!
sleep 5

# Start localtunnel so Firecrawl (cloud-based) can reach localhost
npx -y localtunnel --port 5173 > /tmp/localtunnel-output.txt 2>&1 &
TUNNEL_PID=$!
sleep 10
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.loca\.lt' /tmp/localtunnel-output.txt | head -1)

if [ -z "$TUNNEL_URL" ]; then
  log "WARNING: Could not start tunnel. Firecrawl won't reach localhost."
  TUNNEL_URL="http://localhost:5173"
else
  log "Tunnel active: $TUNNEL_URL"
fi

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
cat > /tmp/overnight-preamble.txt << 'PREAMBLE'
You are working on the StormLeads application — a roofing CRM and storm lead generation tool.
Working directory: /c/Projects/stormleads
Frontend: client/ (React + Vite)
Backend: server/ (Node/Express + PostgreSQL)

CRITICAL CONSTRAINTS:
1. ZERO paid APIs. Only free public data sources (NOAA, FEMA NSI, Census, etc.).
2. ZERO bulk geocoding. Google geocoding API costs real money.
3. ZERO bulk DB writes. Production DB is Neon free tier (0.5 GB storage limit).
4. Follow existing patterns: oklch colors, .glass class, dark-mode-first, pool.query() from ../db/pool.js
5. Build check after EVERY change: cd /c/Projects/stormleads/client && npx vite build
6. Commit after EVERY completed task with a descriptive message.
7. All external data must be queried ON-DEMAND at runtime — never bulk import into the database.

WEB/BROWSER TOOLS — USE FIRECRAWL FOR EVERYTHING:
- Use ONLY the firecrawl skill/CLI for ALL web operations (search, scrape, screenshot, browse).
- Do NOT use Chrome MCP tools (mcp__claude-in-chrome__*) or Playwright (mcp__plugin_playwright_playwright__*).
- For web search: firecrawl search "query"
- For scraping pages: firecrawl scrape <url>
- For screenshots: firecrawl scrape <url> --format screenshot
- For interactive pages (login, clicking): firecrawl browser "open <url>", firecrawl browser "snapshot", etc.
- Store all firecrawl outputs in .firecrawl/ directory.
- Run independent scrapes in parallel with & and wait.

DONE LIST — DO NOT REDO THESE. THEY ARE FINISHED:
- Competitor research TEXT: docs/competitor-gap-analysis.md is comprehensive (updated 2026-03-26). DO NOT rewrite it. You may APPEND new findings only.
- oklch color migration: DONE. DO NOT audit or "find remaining" hex values.
- CSS animations system: DONE. --transition-fast/normal/slow/spring, modal-scale-in, etc.
- Security audit: DONE. All routes authed, queries parameterized, rate limiting, hashed tokens. DO NOT re-audit.
- Modal animations: DONE. All modals have modal-backdrop class and scale-in.
- FEMA map properties: DO NOT TOUCH. This code is being actively worked on by the developer. ANY changes to FEMA property loading, filtering, IndexedDB caching, or storm swath intersection logic WILL BE REVERTED. Leave it alone completely.
- Pricing recommendation: DONE. $29/$79/$149 tiers. DO NOT regenerate.
- PWA manifest/service worker: DONE.
- Photo annotation: DONE.
- Canvassing territories: DONE.
- Subcontractor management: DONE.
- Google review request: DONE.
- CSV Lead Import: DONE.
- FEMA Disaster Declarations API: DONE.
- Rate limiting + hashed tokens: DONE.
- Honey Hole Finder (NOAA SWDI hail history): DONE. Full backend + frontend heat map overlay.
- Lead Scoring: DONE. 7-factor algorithm, badges in LeadList + LeadDetail, score breakdown popup.
- Census ACS Demographics: DONE. Full service with caching, integrated into lead scoring.
- Drip Sequence Sending: DONE. 15-min cron, auto-enrollment, step progression, email sending.
- Financing (Hearth): DONE. Full adapter, webhook handler, Settings tab.
- Notifications: DONE. 10 categories, multi-channel, preferences, polling.

If you find yourself about to re-do any of the above, STOP. Move on to real improvements.

Read MEMORY.md at C:\Users\brand\.claude\projects\C--Projects-stormleads\memory\MEMORY.md first.
Read docs/overnight-history.md if it exists to understand prior work.

RESUME SUPPORT:
Check if C:\Users\brand\.claude\projects\C--Projects-stormleads\memory\overnight_resume.md exists.
If it does, read it — it has notes from a previous run about where to pick up.
Before your final turn, UPDATE that file with your current progress so the next run can resume.
PREAMBLE

# ============================================================
# STAGE 1: APP INVENTORY — Know what we have
# ============================================================
cat /tmp/overnight-preamble.txt > /tmp/stage-1-inventory.txt
cat >> /tmp/stage-1-inventory.txt << STAGE1

YOUR TASK: Do a complete functional inventory of the StormLeads app using Firecrawl.
You must understand what every page does, what works, what's broken, and what's missing.
This is NOT a visual polish session — it's a functional test.

The app is accessible at: ${TUNNEL_URL}
Login credentials: Email=brandon, Password=1234, Tenant=waterloo

STEP 1: Read prior history
- Read docs/overnight-history.md
- Read docs/competitor-gap-analysis.md — focus on the Feature Comparison Matrix
- Run: git log --oneline --since="7 days ago"

STEP 2: Log into the app using Firecrawl browser
- firecrawl browser "open ${TUNNEL_URL}"
- firecrawl browser "snapshot"
- Fill login form and submit
- Verify you're logged in

STEP 3: Scrape and test every page
For each page, use firecrawl to scrape it and note what exists:

firecrawl scrape "${TUNNEL_URL}/storm-map" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/pipeline" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/leads" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/estimates" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/invoices" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/work-orders" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/tasks" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/calendar" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/reports" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/canvassing" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/content-studio" --format screenshot &
firecrawl scrape "${TUNNEL_URL}/settings" --format screenshot &
wait

For EACH page, note:
- Does it load? What features are visible?
- What data/sections does it show?
- Any obvious broken elements or empty sections?
- What feels incomplete compared to a competitor's equivalent?

STEP 4: Write the inventory
Create docs/app-inventory-$(date +%Y%m%d).md with a table:
| Page | Features Present | Works? | Broken/Missing | Competitor Comparison Notes |

Cross-reference with the Feature Comparison Matrix from docs/competitor-gap-analysis.md.
For each "Missing" or "Worse" item, note whether it's actually been built since the matrix was written.

STEP 5: Identify the top improvement opportunities
Based on your inventory, list the top 10 features/pages that need the most improvement
to match competitors. Be specific: "Pipeline cards don't show revenue" not "Pipeline needs work."

Commit: git add docs/ && git commit -m "docs: app inventory $(date +%Y-%m-%d)"

DELIVERABLE: docs/app-inventory-$(date +%Y%m%d).md committed with complete inventory.
STAGE1

# ============================================================
# STAGE 2: COMPETITOR VISUAL RESEARCH — Study what they look like
# ============================================================
cat /tmp/overnight-preamble.txt > /tmp/stage-2-competitors.txt
cat >> /tmp/stage-2-competitors.txt << 'STAGE2'

YOUR TASK: Visually research how competitors implement their features using Firecrawl.
The text analysis already exists in docs/competitor-gap-analysis.md — DO NOT rewrite it.
Your job is to find VISUAL references: screenshots, UI patterns, layouts, workflows.

You MUST actually look at competitor UI, not just read text descriptions.

STEP 1: Read the app inventory
- Read docs/app-inventory-*.md (most recent) to know what our app has
- Read docs/competitor-gap-analysis.md for the feature list

STEP 2: Research each competitor's UI with Firecrawl
For each competitor, scrape their marketing/product/help pages to find UI screenshots and patterns:

HailTrace (storm mapping gold standard):
- firecrawl search "HailTrace storm map screenshot demo" --scrape
- firecrawl search "HailTrace honey hole finder screenshot" --scrape
- firecrawl search "HailTrace canvassing map demo" --scrape
- firecrawl scrape "https://www.hailtrace.com"
- firecrawl search "HailTrace tutorial YouTube 2025" --scrape
- firecrawl scrape "https://help.hailtrace.com" (if exists — help sites have annotated screenshots)

JobNimbus (CRM gold standard):
- firecrawl search "JobNimbus CRM pipeline screenshot demo" --scrape
- firecrawl search "JobNimbus estimate builder screenshot" --scrape
- firecrawl search "JobNimbus dashboard analytics screenshot" --scrape
- firecrawl scrape "https://www.jobnimbus.com/features"
- firecrawl scrape "https://www.jobnimbus.com/product"
- firecrawl search "JobNimbus demo walkthrough YouTube 2025" --scrape

RoofLink (production workflow gold standard):
- firecrawl search "RoofLink roofing CRM screenshot demo" --scrape
- firecrawl search "RoofLink work order production screenshot" --scrape
- firecrawl scrape "https://rooflink.com/features" (or similar product pages)

Rooftops.ai (AI content gold standard):
- firecrawl search "Rooftops.ai AI creator studio screenshot" --scrape
- firecrawl search "Rooftops.ai content generation demo" --scrape
- firecrawl scrape "https://rooftops.ai/products"

Also search review sites for UI descriptions:
- firecrawl search "JobNimbus review screenshot Capterra G2" --scrape
- firecrawl search "HailTrace review demo Capterra" --scrape

STEP 3: Write a visual comparison document
Create docs/competitor-ui-research.md with findings organized by feature area:

## Storm Map (compare to HailTrace)
- How HailTrace displays storm swaths (colors, labels, severity)
- How their Honey Hole Finder looks
- What their property popups show
- What their layer controls look like

## Pipeline/CRM (compare to JobNimbus)
- What info JobNimbus kanban cards show
- Revenue per stage? Lead counts? Conversion rates?
- Card design and layout

## Estimates (compare to JobNimbus SumoQuote + RoofLink)
- How their estimate builders look
- Line item editing UX
- Template systems

## Content/Marketing (compare to Rooftops.ai)
- What their AI creator studio looks like
- Content types available
- Generation workflow

## Work Orders/Production (compare to RoofLink)
- Their 7-step workflow visualization
- Milestone tracking UI
- Checklist and photo documentation

## Dashboard/Reports (compare to JobNimbus + RoofLink)
- What KPIs they show
- Chart types and layouts

For each area, include:
- What the competitor shows/does (be specific — describe the UI you found)
- What our app currently shows/does
- The specific gap to close
- Recommended improvements (concrete, actionable)

Commit: git add docs/ && git commit -m "docs: competitor UI research $(date +%Y-%m-%d)"

DELIVERABLE: docs/competitor-ui-research.md committed with specific, actionable visual comparisons.
STAGE2

# ============================================================
# STAGE 3: COMPARE & IMPROVE — The main event (most turns here)
# ============================================================
cat /tmp/overnight-preamble.txt > /tmp/stage-3-improve.txt
cat >> /tmp/stage-3-improve.txt << STAGE3

YOUR TASK: Improve StormLeads features to match or exceed competitors. This is the main stage.
You will read the research from previous stages and make real code changes.

The app is accessible at: ${TUNNEL_URL}

STEP 1: Read the research
- Read docs/app-inventory-*.md (most recent) — what our app has
- Read docs/competitor-ui-research.md — what competitors do better
- Read docs/competitor-gap-analysis.md — the feature comparison matrix

STEP 2: Work through feature areas in order
For each area in docs/competitor-ui-research.md:

A) Open our version with Firecrawl:
   firecrawl scrape "${TUNNEL_URL}/[page]" --format screenshot

B) Read what the competitor research found about this area

C) Make concrete code changes to close the gap:
   - Add missing data/fields/columns to views
   - Improve layouts and information density
   - Add missing interactions or workflows
   - Build features competitors have that we don't
   - Make our version more intuitive

D) Build check: cd /c/Projects/stormleads/client && npx vite build

E) Verify the improvement with Firecrawl:
   firecrawl scrape "${TUNNEL_URL}/[page]" --format screenshot

F) Commit: git commit -m "feat/fix: [area] [what was improved]"

PRIORITY ORDER:
1. Storm Map improvements (vs HailTrace) — EXCEPT FEMA property code, DO NOT TOUCH
2. Pipeline/CRM improvements (vs JobNimbus)
3. Estimates/Invoices improvements (vs SumoQuote/RoofLink)
4. Work Orders improvements (vs RoofLink)
5. Dashboard/Reports improvements (vs JobNimbus)
6. Content Studio improvements (vs Rooftops.ai)
7. Build net-new missing features:
   - QuickBooks sync (OAuth scaffolding + Settings Integrations tab + invoice push)
   - SMS/Twilio two-way messaging (messages table, chat UI in LeadDetail, Twilio scaffolding)
   - Dashboard loading skeleton
   - Any other gaps you can close

RULES:
- You MUST make at least 5 commits with real code changes
- You MUST improve at least 3 different feature areas
- Every change must be motivated by a specific competitor comparison
- Test every change in the browser via Firecrawl before committing
- Do NOT re-do anything on the Done List (oklch, security, FEMA, animations, etc.)
- Quality over quantity — a deeply improved pipeline is better than shallow tweaks to 8 areas
- If you run out of turns, note where you stopped in overnight_resume.md

DELIVERABLE: At least 5 commits with real improvements across 3+ feature areas.
STAGE3

# ============================================================
# STAGE 4: UI CONSISTENCY CHECK — Only changed pages
# ============================================================
cat /tmp/overnight-preamble.txt > /tmp/stage-4-ui-check.txt
cat >> /tmp/stage-4-ui-check.txt << STAGE4

YOUR TASK: Quick UI consistency check on pages that were modified in Stage 3.
This is NOT a full-app audit. Only check pages with new commits.

The app is accessible at: ${TUNNEL_URL}

STEP 1: Find what changed
Run: git log --oneline overnight-checkpoint-$(date +%Y%m%d)..HEAD
Identify which pages/components were modified.

STEP 2: For each modified page
- firecrawl scrape "${TUNNEL_URL}/[page]" --format screenshot
- Also scrape the reference page for comparison:
  firecrawl scrape "${TUNNEL_URL}/estimates" --format screenshot
- Compare: Do new elements match the existing glassmorphism style?
  - oklch colors (no hex or rgba in new CSS)
  - .glass class on panels
  - .form-input class on all form elements
  - Consistent button styling
  - Proper spacing and alignment
- Check the code directly: read the component file, verify CSS patterns
- Fix any inconsistencies

STEP 3: Check for console errors
- Read the component code for obvious issues
- Verify the build passes: cd /c/Projects/stormleads/client && npx vite build

Commit any fixes: git commit -m "fix(ui): [page] [consistency fix]"

Spend NO MORE than 20 minutes here. If it matches the style, move on.

DELIVERABLE: Modified pages verified for style consistency, fixes committed if needed.
STAGE4

# ============================================================
# STAGE 5: REPORT — What was improved and where we stopped
# ============================================================
cat /tmp/overnight-preamble.txt > /tmp/stage-5-report.txt
cat >> /tmp/stage-5-report.txt << 'STAGE5'

YOUR TASK: Write the overnight report and update history. This is your ONLY task.

1. Review ALL work done tonight:
   git log --oneline overnight-checkpoint-$(date +%Y%m%d)..HEAD

2. Read docs/app-inventory-*.md and docs/competitor-ui-research.md for context.

3. Create OVERNIGHT-REPORT.md with these sections:

   ## Executive Summary
   2-3 sentences: what features were improved tonight, what competitors were studied.

   ## Competitor Comparisons & Improvements Made
   For EACH feature area you improved:
   - What competitor you studied and what you found
   - What our version looked like before
   - What you changed to match/exceed them
   - Where to see it in the app

   ## New Features Built
   For any net-new features (QuickBooks, SMS, etc.):
   - What it does, where to find it, current status (working / needs API key)

   ## Features Still Behind Competitors
   - Which feature areas weren't reached yet
   - Specific gaps remaining (not vague)
   - Priority for next run

   ## Where I Stopped
   - Which feature area was in progress when time ran out
   - Next run should start here

   DO NOT INCLUDE: Competitor pricing rehash, free API lists, gap analysis text,
   anything from the Done List. Only report NEW work from tonight.

   Write it like a professional CEO briefing — NO code snippets, NO file paths.

4. APPEND to docs/overnight-history.md (NEVER overwrite):
   ---
   ## Run: $(date +%Y-%m-%d)
   ### What was done
   - List each feature improved and what competitor it was compared to
   - List any new features built
   ### Competitor areas covered
   - Areas completed: [list]
   - Stopped at: [area]
   - Next run should start at: [area]
   ### What was skipped and why
   ### Lessons learned
   ---

5. Update overnight_resume.md with current progress for the next run.

6. Commit: git add OVERNIGHT-REPORT.md docs/ && git commit -m "docs: overnight report $(date +%Y-%m-%d)"

7. Final build check: cd /c/Projects/stormleads/client && npx vite build

DELIVERABLE: OVERNIGHT-REPORT.md committed. History updated. Resume file updated.
STAGE5

# ============================================================
# RUN ALL STAGES
# ============================================================

log "Stage 1: App Inventory"
run_stage "s1-inventory" 40 /tmp/stage-1-inventory.txt
COMMITS_AFTER_S1=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S1"

log "Stage 2: Competitor Visual Research"
run_stage "s2-competitors" 50 /tmp/stage-2-competitors.txt
COMMITS_AFTER_S2=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S2"

log "Stage 3: Compare & Improve (main stage)"
run_stage "s3-improve" 80 /tmp/stage-3-improve.txt
COMMITS_AFTER_S3=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S3"

log "Stage 4: UI Consistency Check"
run_stage "s4-ui-check" 30 /tmp/stage-4-ui-check.txt
COMMITS_AFTER_S4=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S4"

log "Stage 5: Report"
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
    <h1 style=\"color:#0ea5e9;margin:0;font-size:28px;\">StormLeads Overnight Report</h1>
    <p style=\"color:#6b7280;margin:8px 0 0;font-size:14px;\">\${today}</p>
    <p style=\"color:#22c55e;margin:4px 0 0;font-size:12px;\">COMPETITOR-DRIVEN IMPROVEMENT (5 stages)</p>
    <div style=\"display:flex;justify-content:center;gap:24px;margin-top:12px;\">
      <div style=\"text-align:center;\">
        <div style=\"color:#22c55e;font-size:24px;font-weight:bold;\">\${totalTurns}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Total Turns</div>
      </div>
      <div style=\"text-align:center;\">
        <div style=\"color:#f59e0b;font-size:24px;font-weight:bold;\">\${commitCount}</div>
        <div style=\"color:#6b7280;font-size:11px;text-transform:uppercase;\">Commits</div>
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
    subject: 'StormLeads Overnight Report — ' + totalTurns + ' turns, ' + commitCount + ' commits — ' + today,
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Email sent (id: ' + d.id + ')' : 'Email failed: ' + JSON.stringify(d));
}).catch(e => console.error('Email send failed:', e.message));
" "$GIT_SUMMARY" "$TODAY_PRETTY" "$TODAY" "$TOTAL_TURNS" "$TOTAL_COST" "$STAGE_RESULTS"

# --- Cleanup ---
[ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null
[ -n "$VITE_PID" ] && kill $VITE_PID 2>/dev/null
[ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null

log "=== OVERNIGHT RUN FINISHED ==="
