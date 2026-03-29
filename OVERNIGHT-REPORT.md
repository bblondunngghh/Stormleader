# Overnight Report — 2026-03-29

## Executive Summary

Tonight's session delivered five new features across Content Studio, Estimates, Pipeline, Reports, and Work Orders — each directly closing a competitive gap identified against Rooftops.ai, RoofLink, and JobNimbus. A comprehensive third-pass competitor UI research document was produced from 50+ sources via Firecrawl, alongside a full 22-page app inventory audit. All changes passed build verification and UI consistency review.

## Competitor Comparisons & Improvements Made

### 1. Live Preview Panel for Content Studio (vs Rooftops.ai)
- **What we found:** Rooftops.ai's Creator Studio shows a real-time Facebook post mockup or landing page preview as users fill out the content generation form. Our Content Studio generated text but had no visual preview of how it would look on the target platform.
- **What changed:** Added platform-specific mockup previews — Facebook post chrome (avatar, timestamp, engagement bar, Like/Message/Share buttons) for social posts and ads, email client preview with header/body/footer for emails, a front/back door hanger mockup with company branding, and a generic formatted preview for blog outlines. The preview updates live as content is generated.
- **Where to see it:** Content Studio — the right panel that appears after generating content.

### 2. Estimate Tier Comparison View (vs RoofLink)
- **What we found:** RoofLink compiles up to 6 estimates into a single branded PDF with a side-by-side Compare Estimates summary page, letting homeowners see Good/Better/Best options at a glance. Our estimates had tier generation but no comparison view.
- **What changed:** Added a comparison modal that activates automatically when tier estimates exist. Shows summary cards for each tier with total price and line-item count, a full line-by-line pricing comparison table, and per-tier totals. One-click comparison from the estimates list.
- **Where to see it:** Estimates page — the "Compare" button appears next to any estimate that has Good/Better/Best tiers generated.

### 3. Pipeline Cards: Lead Score + Source Badges (vs JobNimbus)
- **What we found:** JobNimbus pipeline cards display rich data including contact info, task progress, and status indicators. Our pipeline cards showed value and days-in-stage but lacked the lead intelligence data that helps reps prioritize at a glance.
- **What changed:** Added lead score badges with color-coded thresholds (green for 80+, amber for 60+, red for 40+, gray for below) and lead source labels to every desktop pipeline card. Increases information density while maintaining the glassmorphism card design.
- **Where to see it:** Pipeline page — every kanban card now shows the lead's score badge and source label.

### 4. Chart Drill-Down in Reports (vs JobNimbus)
- **What we found:** JobNimbus Insights lets users click any bar or data point in charts to drill into the contributing jobs. This is the key difference between reports that people look at and reports that people act on. Our charts were display-only.
- **What changed:** Pipeline bar chart bars and Lead Sources pie slices are now clickable — clicking navigates to the Leads page pre-filtered by that stage or source. Closes the #1 priority gap in the Reports feature area.
- **Where to see it:** Reports page — click any bar in the Pipeline report or any slice in the Lead Sources report.

### 5. Work Order Milestone Templates for 8 Job Types (vs RoofLink)
- **What we found:** RoofLink comes with pre-configured production checklists per job type — creating a shingle replacement job automatically populates 8-10 milestone steps including material delivery, tear-off, underlayment, and final inspection. Our work orders required manual milestone entry every time.
- **What changed:** Added 8 milestone templates (Shingle Replacement, Metal Roof, Gutter Install, Siding, Storm Damage Repair, Roof Inspection, Flat Roof, and Window/Door Replacement) with a template selector and live preview in the Create Work Order modal. Backend serves templates via API. Selecting a template auto-populates all milestones.
- **Where to see it:** Work Orders page — click "New Work Order" and select a job type template from the dropdown.

## New Features Built

No net-new feature categories were added tonight. All five improvements above enhance existing feature areas to match or exceed competitor functionality. The work was targeted gap-closing, not greenfield development.

## Features Still Behind Competitors

### High Priority (Tier 1 Remaining)
- **Server-side PDF estimates** — Both JobNimbus (SumoQuote) and RoofLink produce professional branded multi-page PDFs. We still use browser print. This is the single biggest quality gap in our estimate workflow.
- **Hail swath color graduation** — HailTrace's light-to-purple severity gradient by hail size is their signature visual. Our swaths are uniform color. Needs color scale (yellow for 1", orange for 1.5", red/purple for 2"+).
- **AI-powered content generation** — Rooftops.ai uses GPT for actual AI generation at $12/month. Our Content Studio is template-based. Needs LLM integration (local Ollama or rate-limited API).

### Medium Priority (Tier 2 Remaining)
- **Profit Tracker with Planned vs Actual margins** — JobNimbus tracks planned vs actual gross/net margins with variance analysis by rep and job type. We have basic profit calculation but no variance tracking.
- **Invoice aging analysis** — JobNimbus breaks overdue invoices into 1-30 day, 31-60, 61-90, 91+ day buckets. Our invoices page has basic overdue badges but no aging breakdown.
- **Photo-required milestone hard stops** — RoofLink blocks stage advancement without uploaded photos. Our milestones have optional photo upload but no enforcement.
- **In-app SMS threading** — JobNimbus has "Engage" for two-way SMS. We rely on native sms: protocol links.

### Lower Priority
- Property thumbnails on pipeline cards (RoofLink shows property images)
- GPS proximity verification for canvassing (HailTrace requires within 50 feet)
- Custom report builder (both competitors support this)
- Role-based dashboard templates (RoofLink feature)

## UI Consistency Fix

One additional fix was committed: two hex color gradients in the Content Studio preview panel were converted to oklch to maintain the application's consistent color system. This was caught during the Stage 4 UI consistency review.

## Where I Stopped

All five planned feature implementations from the competitor research prioritization were completed and verified. The UI consistency review (Stage 4) was also completed — all 5 modified pages were checked, one fix was committed.

**Next run should start at:**
1. **Server-side PDF export for estimates** — the #1 remaining quality gap. Use pdfmake to generate branded cover page + inspection photos + line items + signing section + terms.
2. **Profit Tracker / Variance Analysis** — planned vs actual margins per job, per rep, per job type. High value for business owners.
3. **Invoice aging buckets** — quick win, sort overdue invoices into 1-30, 31-60, 61-90, 91+ day categories with summary cards.
