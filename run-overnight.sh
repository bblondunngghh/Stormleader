#!/bin/bash
# StormLeads Overnight Build Script — STAGED EXECUTION
# Each stage runs as a separate claude invocation with validation gates.
# The agent cannot short-circuit — each stage must produce real output
# before the next stage begins.

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

log "=== STAGED OVERNIGHT RUN STARTING ==="

# --- Ensure Firecrawl is available ---
if ! command -v firecrawl &>/dev/null; then
  log "ERROR: firecrawl CLI not found. Run: npm install -g firecrawl-cli"
  exit 1
fi
firecrawl --status >> "$LOG" 2>&1

# --- Start tunnel for local dev server ---
# Firecrawl is cloud-based and cannot access localhost.
# Start vite + localtunnel so Firecrawl can reach the dev server.
cd /c/Projects/stormleads/client && npx vite --host 0.0.0.0 &>/dev/null &
VITE_PID=$!
sleep 5

# Start localtunnel
npx -y localtunnel --port 5173 > /tmp/localtunnel-output.txt 2>&1 &
TUNNEL_PID=$!
sleep 10
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.loca\.lt' /tmp/localtunnel-output.txt | head -1)

if [ -z "$TUNNEL_URL" ]; then
  log "WARNING: Could not start tunnel. UI audit stage will be limited."
  TUNNEL_URL="http://localhost:5173"
else
  log "Tunnel active: $TUNNEL_URL"
fi

cd /c/Projects/stormleads

# --- Helper: run a stage with retry ---
# Usage: run_stage <stage_name> <max_turns> <prompt_file>
# Writes JSON output to claude-overnight-YYYYMMDD-<stage_name>.json
# Sets STAGE_TURNS and STAGE_EXIT after completion
run_stage() {
  local name="$1"
  local max_turns="$2"
  local prompt_file="$3"
  local out_file="claude-overnight-${TODAY}-${name}.json"
  local retries=3
  local wait=300  # 5 min between retries

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

    # Check for rate limit
    if [ $STAGE_EXIT -ne 0 ] && grep -qi "rate.limit\|too many\|overloaded\|429" "$out_file" 2>/dev/null; then
      log "  Rate limited. Waiting ${wait}s..."
      sleep $wait
      wait=$((wait * 2))
      continue
    fi

    # Extract stats
    STAGE_TURNS=$(node -e "try{const d=require('./$out_file');console.log(d.num_turns||0)}catch{console.log(0)}" 2>/dev/null)
    STAGE_COST=$(node -e "try{const d=require('./$out_file');console.log(d.total_cost_usd||0)}catch{console.log(0)}" 2>/dev/null)
    STAGE_STOP=$(node -e "try{const d=require('./$out_file');console.log(d.stop_reason||'unknown')}catch{console.log('unknown')}" 2>/dev/null)
    STAGE_RESULT=$(node -e "try{const d=require('./$out_file');console.log((d.result||'').substring(0,200))}catch{console.log('')}" 2>/dev/null)

    TOTAL_TURNS=$((TOTAL_TURNS + STAGE_TURNS))
    TOTAL_COST=$(node -e "console.log(($TOTAL_COST + $STAGE_COST).toFixed(2))")

    log "  Completed: $STAGE_TURNS turns, \$$STAGE_COST, stop=$STAGE_STOP"
    STAGE_RESULTS="${STAGE_RESULTS}\n  $name: ${STAGE_TURNS} turns, \$${STAGE_COST}"
    return 0
  done

  log "  FAILED after $retries retries"
  return 1
}

# --- Create stage prompt files ---
# Each stage gets a focused, scoped prompt that can't be short-circuited.

# PREAMBLE included in every stage
cat > /tmp/overnight-preamble.txt << 'PREAMBLE'
You are working on the StormLeads application — a roofing CRM and storm lead generation tool.
Working directory: /c/Projects/stormleads
Frontend: client/ (React + Vite at http://localhost:5173)
Backend: server/ (Node/Express + PostgreSQL)

CRITICAL CONSTRAINTS:
1. ZERO paid APIs. Only free public data sources (NOAA, FEMA NSI).
2. ZERO bulk geocoding. Google geocoding API costs real money.
3. ZERO bulk DB writes. Production DB is Neon free tier (0.5 GB storage limit).
4. Follow existing patterns: oklch colors, .glass class, dark-mode-first, pool.query() from ../db/pool.js
5. Build check after EVERY change: cd /c/Projects/stormleads/client && npx vite build
6. Commit after EVERY completed task with a descriptive message.

DATABASE STORAGE RULES (NEON FREE TIER = 0.5 GB):
- Do NOT import bulk historical data (NOAA Storm Events CSVs, SPC SVRGIS archive, etc.)
- Do NOT create tables that store large datasets (millions of geometry rows, weather history, etc.)
- All storm/weather data must be fetched ON-DEMAND from free APIs, never pre-loaded into our DB
- Only store user-generated data in our DB: leads, estimates, tasks, notes, etc.
- If a feature needs external data, query the external API at runtime and cache briefly in memory
- Before creating ANY new migration, estimate the row count and avg row size — reject if total > 50 MB

WEB TOOLS:
- Use ONLY the firecrawl CLI for ALL web operations (search, scrape, browse).
- Do NOT use Chrome MCP tools (mcp__claude-in-chrome__*) or Playwright (mcp__plugin_playwright_playwright__*).
- For web search: firecrawl search "query" -o .firecrawl/result.json
- For scraping pages: firecrawl scrape <url> -o .firecrawl/page.md
- For screenshots: firecrawl scrape <url> --format screenshot -o .firecrawl/screenshot.json
- For interactive pages: firecrawl browser "open <url>" then firecrawl browser "snapshot"
- Store all firecrawl outputs in .firecrawl/ directory.
- Run independent scrapes in parallel with & and wait.

Read MEMORY.md at C:\Users\brand\.claude\projects\C--Projects-stormleads\memory\MEMORY.md first.
Read docs/overnight-history.md if it exists to understand prior work.

RESUME SUPPORT:
Check if C:\Users\brand\.claude\projects\C--Projects-stormleads\memory\overnight_resume.md exists.
If it does, read it — it contains notes from a previous run that hit its turn limit,
describing what was already completed and where to pick up. Use it to skip finished work
and continue from where the last run left off. After you finish (or are about to hit your
turn limit), UPDATE that file with your current progress so the next run can resume.

TURN LIMIT WARNING:
You have a LIMITED number of turns. If you are running low on turns and cannot finish
your full task, you MUST before your final turn:
1. Commit any uncommitted work: git add -A && git commit -m "wip: [stage] partial progress"
2. Write your progress to C:\Users\brand\.claude\projects\C--Projects-stormleads\memory\overnight_resume.md
   Include:
   - Which stage you were working on
   - What you completed
   - What still needs to be done (be specific — list exact pages/features/files)
   - Any context the next run needs to pick up seamlessly
3. Update MEMORY.md index if the resume file is new
This ensures NO work is lost between runs.
PREAMBLE

# STAGE 1: Competitor Research
cat /tmp/overnight-preamble.txt > /tmp/stage-1-competitors.txt
cat >> /tmp/stage-1-competitors.txt << 'STAGE1'

YOUR TASK: Deep competitor research using Firecrawl. This is your ONLY task — do NOT implement features or fix UI.

IMPORTANT: Use ONLY the firecrawl CLI for all web research. Do NOT use WebSearch, WebFetch, Chrome MCP, or Playwright.

DO NOT STOP until you have completed ALL of the following:

1. Check if docs/competitor-gap-analysis.md exists and is recent (< 3 days old via git log).
   - If recent: UPDATE it with any new findings. Still do the research below.
   - If missing or stale: create it from scratch.

2. Create .firecrawl/competitor-research/ directory for storing results.

3. Research ALL 4 competitors using firecrawl search and scrape IN PARALLEL:
   Run these in parallel with & and wait:
   - firecrawl search "JobNimbus CRM features pricing 2026" --scrape -o .firecrawl/competitor-research/jobnimbus-search.json
   - firecrawl search "HailTrace storm leads features pricing" --scrape -o .firecrawl/competitor-research/hailtrace-search.json
   - firecrawl search "RoofLink rooflink.com roofing platform features" --scrape -o .firecrawl/competitor-research/rooflink-search.json
   - firecrawl search "Rooftops.ai roofing AI features pricing" --scrape -o .firecrawl/competitor-research/rooftopsai-search.json

4. Scrape each competitor's main pages directly (in parallel):
   - firecrawl scrape "https://www.jobnimbus.com/features" -o .firecrawl/competitor-research/jobnimbus-features.md
   - firecrawl scrape "https://www.jobnimbus.com/pricing" -o .firecrawl/competitor-research/jobnimbus-pricing.md
   - firecrawl scrape "https://www.hailtrace.com" -o .firecrawl/competitor-research/hailtrace-main.md
   - firecrawl scrape "https://rooflink.com" -o .firecrawl/competitor-research/rooflink-main.md
   - firecrawl scrape "https://rooftops.ai" -o .firecrawl/competitor-research/rooftopsai-main.md

5. For EACH competitor, find EXACT pricing from the scraped data:
   - Base price per month
   - Per-user costs
   - What a 5-person and 10-person roofing company actually pays total
   - Add-on costs (texting, marketing, data, etc.)

6. Write a feature comparison table to docs/competitor-gap-analysis.md:
   Feature | JobNimbus | HailTrace | RoofLink | Rooftops.ai | StormLeads | Status

7. Write a pricing recommendation: what should StormLeads charge?
   - 2-3 tiers with specific prices
   - Savings vs competitors at each company size

8. Commit your work: git add docs/competitor-gap-analysis.md && git commit -m "docs: update competitor analysis"

DELIVERABLE: docs/competitor-gap-analysis.md must exist with a complete feature table and pricing analysis.
You are DONE when you have committed this file. Do not do anything else.
STAGE1

# STAGE 2: Feature Implementation
cat /tmp/overnight-preamble.txt > /tmp/stage-2-features.txt
cat >> /tmp/stage-2-features.txt << 'STAGE2'

YOUR TASK: Implement missing or broken features. This is your ONLY task — do NOT do UI polish or research.

1. Read docs/competitor-gap-analysis.md to see what's missing.
2. Read docs/overnight-history.md to see what previous runs recommended for "next session."
3. Read docs/superpowers/specs/2026-03-23-nav-consolidation-new-features-design.md for the current feature spec.
4. Run: git log --oneline --since="7 days ago" to see what was already built recently.

5. For each feature that is BROKEN (exists but doesn't work):
   - Fix it
   - Test it compiles: cd /c/Projects/stormleads/client && npx vite build
   - Commit with: git commit -m "fix: [description]"

6. For each feature that is MISSING and can be built for free:
   - Build it following existing patterns
   - Test it compiles
   - Commit with: git commit -m "feat: [description]"

PRIORITY ORDER:
- Features ALL competitors have that we're missing (table stakes)
- Features from the nav-consolidation spec that haven't been built yet
- Features recommended by previous overnight runs

EXCLUDED — DO NOT BUILD THESE:
- Historical storm data import (NOAA Storm Events CSVs, SPC SVRGIS archive) — too much DB storage
- Bulk data ingestion pipelines — violates Neon free tier 0.5 GB limit
- Any feature that pre-loads large external datasets into our database
- Instead: if a feature needs external data, build it as an on-demand API proxy (fetch from source at runtime)

You must make AT LEAST 3 commits of real feature work. Do not stop after 1 quick fix.
Keep building until you've exhausted high-priority missing features or hit the turn limit.

DELIVERABLE: At least 3 new commits with real feature or fix work. Run this to verify:
git log --oneline overnight-checkpoint-$(date +%Y%m%d)..HEAD | wc -l
STAGE2

# STAGE 3: Visual UI Audit
cat /tmp/overnight-preamble.txt > /tmp/stage-3-ui-audit.txt
cat >> /tmp/stage-3-ui-audit.txt << STAGE3

YOUR TASK: Visual UI audit and polish. This is your ONLY task — do NOT implement new features.

UI CONSISTENCY IS THE #1 PRIORITY. Every button, modal, input, card, and table must be
identical across the entire app. Think like an Apple design reviewer.

BROWSER TOOLS — USE FIRECRAWL ONLY:
- Do NOT use Chrome MCP (mcp__claude-in-chrome__*) or Playwright (mcp__plugin_playwright_playwright__*)
- Use firecrawl scrape and firecrawl browser for all page inspection
- The dev server is accessible at: ${TUNNEL_URL}
  (This is a cloudflared tunnel to localhost:5173)

SETUP:
- The dev server and tunnel are already running (started by the overnight script).
- Log in using firecrawl browser:
  firecrawl browser "open ${TUNNEL_URL}"
  firecrawl browser "snapshot"
  (Find and fill login form: Email=brandon, Password=1234, Tenant=waterloo)
  firecrawl browser "fill @emailRef 'brandon'"
  firecrawl browser "fill @passwordRef '1234'"
  firecrawl browser "fill @tenantRef 'waterloo'"
  firecrawl browser "click @loginButton"

STEP 1: ESTABLISH REFERENCE
- Navigate to /estimates:
  firecrawl browser "open ${TUNNEL_URL}/estimates"
  firecrawl browser "snapshot"
  firecrawl scrape "${TUNNEL_URL}/estimates" --format screenshot -o .firecrawl/ui-audit/estimates-reference.json
- Read the snapshot output to identify glass cards, dropdowns, text inputs, buttons
- Note the exact styles from the code: border-radius, padding, font-size, colors, backdrop-filter
- These are the GOLD STANDARD. Everything else must match.

STEP 2: AUDIT EVERY PAGE using firecrawl scrape for screenshots + firecrawl browser for interaction:

Create .firecrawl/ui-audit/ directory first.

Pages to audit (scrape ALL in parallel first for screenshots):
  firecrawl scrape "${TUNNEL_URL}/storm-map" --format screenshot -o .firecrawl/ui-audit/storm-map.json &
  firecrawl scrape "${TUNNEL_URL}/pipeline" --format screenshot -o .firecrawl/ui-audit/pipeline.json &
  firecrawl scrape "${TUNNEL_URL}/leads" --format screenshot -o .firecrawl/ui-audit/leads.json &
  firecrawl scrape "${TUNNEL_URL}/estimates" --format screenshot -o .firecrawl/ui-audit/estimates.json &
  firecrawl scrape "${TUNNEL_URL}/invoices" --format screenshot -o .firecrawl/ui-audit/invoices.json &
  firecrawl scrape "${TUNNEL_URL}/reports" --format screenshot -o .firecrawl/ui-audit/reports.json &
  firecrawl scrape "${TUNNEL_URL}/calendar" --format screenshot -o .firecrawl/ui-audit/calendar.json &
  firecrawl scrape "${TUNNEL_URL}/work-orders" --format screenshot -o .firecrawl/ui-audit/work-orders.json &
  firecrawl scrape "${TUNNEL_URL}/canvassing" --format screenshot -o .firecrawl/ui-audit/canvassing.json &
  firecrawl scrape "${TUNNEL_URL}/tasks" --format screenshot -o .firecrawl/ui-audit/tasks.json &
  firecrawl scrape "${TUNNEL_URL}/settings" --format screenshot -o .firecrawl/ui-audit/settings.json &
  wait

Then for EACH page, also scrape the HTML to inspect styles:
  firecrawl scrape "${TUNNEL_URL}/[page]" --format markdown -o .firecrawl/ui-audit/[page]-content.md

For EACH page:
a) Review the screenshot and markdown content
b) Check every button matches reference (same height, border-radius, padding, color)
c) Check every input/select matches reference (same height, bg, border, font-size)
d) Check spacing and alignment
e) Use firecrawl browser to interact with modals: open them, take snapshots
f) If ANYTHING doesn't match: fix the code, rebuild, re-scrape to verify
g) Commit each fix: git commit -m "fix(ui): [page] [what was fixed]"

STEP 3: CODE-LEVEL AUDIT (supplement visual checks)
- Read the CSS/component source code directly for each page
- Verify CSS custom properties exist: --transition-fast, --transition-normal, --transition-slow
- Check buttons have hover/active transitions
- Check modals have open/close animations
- Cross-reference code styles against the reference page styles
- Add any missing animations

You must scrape AT LEAST 11 pages for screenshots.
You must make AT LEAST 2 commits fixing UI inconsistencies.
Do NOT stop after checking 2-3 pages — check ALL pages listed above.

DELIVERABLE: All pages visually audited via firecrawl, inconsistencies fixed and committed.
STAGE3

# STAGE 4: Storm Map Performance + Data Sources
cat /tmp/overnight-preamble.txt > /tmp/stage-4-stormmap.txt
cat >> /tmp/stage-4-stormmap.txt << 'STAGE4'

YOUR TASK: Fix storm map performance and research new free data sources. This is your ONLY task.

PART A — FEMA PROPERTY PERFORMANCE FIX:
1. Read client/src/components/StormMap.jsx
2. Read any related API endpoints in server/src/routes/
3. FEMA properties are currently loading EVERYWHERE on the map, not just within storm swaths.
   This causes massive lag. Fix it:
   - Properties must ONLY load within storm swath polygon boundaries
   - If no storm swaths are visible, do NOT fetch any FEMA properties
   - Use spatial intersection (point-in-polygon check)
4. Additional perf optimizations:
   - Debounce map move/zoom events
   - Only render properties in current viewport
   - Optimize Supercluster rebuilds
5. Build check: cd /c/Projects/stormleads/client && npx vite build
6. Commit: git commit -m "perf(map): [description]"

PART B — FREE DATA SOURCES RESEARCH (ON-DEMAND APIs ONLY):
Do EXTENSIVE web research to find free REST APIs for roofing companies.
CRITICAL: Only research APIs that can be queried ON-DEMAND (per-property or per-area lookups).
Do NOT recommend bulk data downloads, CSV imports, or anything that would be stored in our DB.
Our production DB is Neon free tier (0.5 GB) — all external data must stay external.

Research categories:
- Free building footprint APIs (query by lat/lng, not bulk download)
- Free property data APIs (roof age, material, owner info — per-address lookup)
- Free weather/hail damage APIs beyond NOAA (per-location queries)
- Free aerial/satellite imagery tile APIs
- Search: "free APIs for roofing contractors", "free GIS data layers roofing"
- Search: "free building footprint API", "free property data API"
- Look at what competitors use and find free API alternatives

Write findings to docs/free-data-sources.md with:
- Source name and URL
- What data it provides
- Whether it's truly free (rate limits, auth required?)
- API format: REST endpoint pattern, response format
- Implementation: on-demand query (YES) or bulk download (SKIP)
- Implementation difficulty (easy/medium/hard)
- Recommendation

Commit: git commit -m "docs: research free on-demand data APIs for storm map"

DELIVERABLE: At least 1 commit for perf fix, 1 commit for data source research.
STAGE4

# STAGE 5: Security + Error States + Polish
cat /tmp/overnight-preamble.txt > /tmp/stage-5-security-polish.txt
cat >> /tmp/stage-5-security-polish.txt << 'STAGE5'

YOUR TASK: Security review, error/empty states, and final polish. This is your ONLY task.

PART A — SECURITY REVIEW:
1. Check EVERY route in server/src/routes/ — does each use auth middleware?
2. Does tenant isolation (tenantScope) apply to ALL data queries?
3. Are all DB queries parameterized (pool.query with $1, $2)? Check for SQL injection.
4. Are there API keys or secrets in client-side code?
5. Are passwords hashed? Do JWTs expire?
6. Fix any vulnerabilities found. Commit each fix.
7. Write findings to docs/security-audit-$(date +%Y%m%d).md

PART B — ERROR & EMPTY STATES:
For each major page (/leads, /pipeline, /estimates, /invoices, /tasks, /work-orders):
1. What does it look like with zero data? Is there a helpful empty state message?
2. If no empty state exists, add one with a message and call-to-action button
3. Do pages show loading spinners while data loads?
4. Commit each improvement.

PART C — PERFORMANCE:
1. Check bundle: are new views lazy-loaded in App.jsx?
2. Check for N+1 query patterns in list endpoints
3. Check for missing database indexes on frequently queried columns
4. Fix what you find, commit each fix.

DELIVERABLE: Security audit doc committed, at least 1 empty state improvement committed.
STAGE5

# STAGE 6: Report Writing
cat /tmp/overnight-preamble.txt > /tmp/stage-6-report.txt
cat >> /tmp/stage-6-report.txt << 'STAGE6'

YOUR TASK: Write the overnight report and update history. This is your ONLY task.

1. Review ALL work done tonight:
   git log --oneline overnight-checkpoint-$(date +%Y%m%d)..HEAD

2. Read docs/competitor-gap-analysis.md for competitor findings.
3. Read docs/free-data-sources.md for data source findings.

4. Create OVERNIGHT-REPORT.md with these sections:

   ## Executive Summary
   2-3 sentence overview of tonight's work.

   ## Competitor Intelligence
   Key findings, what they charge vs what we could charge.

   ## Pricing Recommendation
   Suggested tiers with prices, savings comparison.

   ## New Features Added
   For EACH new feature: what it does, WHERE to find it, WHY it matters.

   ## UI Improvements
   For EACH visual fix: which page, what was wrong, what it looks like now.

   ## Product Recommendations
   Top 5 high-impact features to build next.
   Free on-demand APIs to integrate (must be runtime queries, NOT bulk DB imports).
   Remember: Neon free tier = 0.5 GB. All external data stays external.

   ## Still Needs Attention
   What couldn't be fixed and why. Priorities for next session.

   Write it like a professional CEO briefing — NO code snippets, NO file paths.

5. APPEND a summary to docs/overnight-history.md (create if needed, NEVER overwrite):
   ## Run: $(date +%Y-%m-%d)
   ### What was done
   ### What should be done next run
   ### Lessons learned

6. Commit: git add OVERNIGHT-REPORT.md docs/overnight-history.md && git commit -m "docs: overnight report $(date +%Y-%m-%d)"

7. Final build check: cd /c/Projects/stormleads/client && npx vite build

DELIVERABLE: OVERNIGHT-REPORT.md exists and is committed.
STAGE6

# ============================================================
# RUN ALL STAGES SEQUENTIALLY WITH VALIDATION
# ============================================================

log "Stage 1: Competitor Research"
run_stage "s1-competitors" 50 /tmp/stage-1-competitors.txt
COMMITS_AFTER_S1=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S1"

log "Stage 2: Feature Implementation"
run_stage "s2-features" 50 /tmp/stage-2-features.txt
COMMITS_AFTER_S2=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S2"

log "Stage 3: Visual UI Audit"
run_stage "s3-ui-audit" 50 /tmp/stage-3-ui-audit.txt
COMMITS_AFTER_S3=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S3"

log "Stage 4: Storm Map + Data Sources"
run_stage "s4-stormmap" 50 /tmp/stage-4-stormmap.txt
COMMITS_AFTER_S4=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S4"

log "Stage 5: Security + Polish"
run_stage "s5-security" 50 /tmp/stage-5-security-polish.txt
COMMITS_AFTER_S5=$(git log --oneline "overnight-checkpoint-${TODAY}"..HEAD 2>/dev/null | wc -l)
log "  Commits so far: $COMMITS_AFTER_S5"

log "Stage 6: Report Writing"
run_stage "s6-report" 50 /tmp/stage-6-report.txt
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
    <p style=\"color:#22c55e;margin:4px 0 0;font-size:12px;\">STAGED EXECUTION (6 stages)</p>
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

# --- Cleanup tunnel and dev server ---
[ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null
[ -n "$VITE_PID" ] && kill $VITE_PID 2>/dev/null

log "=== OVERNIGHT RUN FINISHED ==="
