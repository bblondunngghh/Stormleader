# Competitor UI Research — Visual Comparison & Actionable Gaps

**Date:** 2026-04-06 (refreshed — builds on April 3-4 research with updated app inventory cross-reference)
**Method:** Firecrawl scrapes of competitor websites, help centers, YouTube tutorials, review sites (Capterra, G2, Software Advice), and integration partner pages. Cross-referenced with `.firecrawl/` archives (April 2-4 research) and `docs/app-inventory-20260406.md`.
**Companion doc:** `docs/competitor-gap-analysis.md` has the full text/feature analysis. This document focuses on **visual UI patterns, layouts, and actionable design gaps**.

---

## 1. Storm Map (StormLeads vs HailTrace)

### What HailTrace Shows

**Map is the entire product.** Full-screen interactive map with storm swath polygons overlaid. Key visual elements:

- **Color graduation for hail severity:** Light/pale colors for smaller hail, progressively darker/more intense for larger. Gradient makes severity scannable at a glance without reading labels.
- **Hatched-pattern overlay:** Unique cross-hatch pattern on isolated storm swaths to distinguish from confirmed/larger swaths. No other competitor does this.
- **Star rating badges (1-5):** Every storm rated by: properties impacted, max hail size, probability of damage. Free users see only 1-star storms.
- **Multiple map layers toggled independently:**
  - Meteorologist Hail Maps (hand-drawn, primary)
  - Algorithm Hail Maps (computer-generated, secondary)
  - Wind Speed Maps (58+ MPH areas)
  - Tornado Path Maps (with EF rating)
  - NOAA Reports (dark icons, hover for details)
  - Social Media Images (camera icons at photo location)
- **Layer control panel:** Gear button → toggle satellite/hybrid, NOAA reports, social media images. Separate icon for saved events.
- **Storm finding — 3 methods:**
  1. Recent storms list (chronological)
  2. Calendar picker (year → month → day)
  3. Radius filter search (adjustable radius, filter by hail size, wind speed, tornado EF, star level)
- **Multi-swath overlay ("Honey Holes"):** Load multiple storm dates onto same map. Overlapping areas = zones hit by multiple storms = highest damage probability.
- **Storm listing page (`/hail-maps`):** Cards with CDN thumbnail, date, affected states, top 5 cities, "Hail"/"Wind"/"Tornado" badges, "More Info" link.

**Image references:**
- Dashboard: `cdn.hailtrace.com/images/home/dashboards.png`
- Hail maps: `cdn.hailtrace.com/images/home/hail-maps.png`
- Territory Mapping: `lirp.cdn-website.com/074b5fee/dms3rep/multi/opt/Territory+Mapping-1920w.png`

### What StormLeads Currently Shows (as of 2026-04-06)

- Google Maps with NOAA-sourced hail/wind/tornado/thunderstorm polygons ✅
- Hail severity color graduation (green→yellow→orange→red by size) ✅
- Wind severity color graduation (blue→green→orange→red by mph) ✅
- Tornado severity color graduation (yellow→orange→red→purple by EF) ✅
- 6-layer toggle panel (hail/wind/tornado/tstorm/drift/properties) ✅
- Transparency slider ✅
- FEMA NSI property overlay with Supercluster ✅
- Honey Hole heatmap (NOAA SWDI historical circles) ✅
- Time range filter (24h/3d/7d/14d/30d) ✅
- Address search bar ✅
- Storm Archive catalog with 5-star ratings and severity badges ✅
- "DAMAGE LIKELY" badge for hail >= 1.5" ✅
- Generate Canvassing List (50 pins from storm properties) ✅

### Gaps to Close

| Gap | HailTrace Has | StormLeads Status | Effort | Priority |
|-----|---------------|-------------------|--------|----------|
| Hatched pattern for isolated swaths | Cross-hatch overlay | Not implemented | Medium | Low |
| Social media/photo icons on map | Camera icons at locations | Not implemented | High (data source needed) | Low |
| Calendar-based storm search | Year→month→day drill-down | Time range pills only | Medium | Medium |
| Storm preview thumbnails | CDN static map images per storm | Text-only storm cards | Medium | Medium |
| Multi-swath overlay UX | Explicit "load multiple dates" | Heatmap only | Medium | Medium |

### Recommended Improvements

1. **Calendar-based storm search** in StormCatalog — date picker, queries existing storms API.
2. **Static storm preview thumbnails** — use Mapbox Static Images API (free tier: 50k/month) when storms load.
3. **Improve Honey Hole UX** — allow "pinning" multiple storm dates to see overlapping swath polygons (vs current heatmap).

---

## 2. Pipeline / CRM (StormLeads vs JobNimbus)

### What JobNimbus Shows

**Navigation:** Top nav bar (NOT sidebar) — Home, Contacts, Jobs, Calendar, Boards, Insights. Reviewers describe the web app as "functional but dated."

**Three separate board types (same kanban UI):**
1. **Sales Boards** — New Inquiry → Estimate Sent → Signed Contract → Job Won
2. **Production Boards** — Material Order → Scheduled → In Production → Quality Check → Complete
3. **Billing Boards** — completed jobs through payment collection

**Board card details:**
- At-a-glance status info
- Lead source tags (Facebook, Billboard, Google Ads)
- Connected to full job folder (photos, notes, docs, timeline)
- Drag-and-drop across stages
- Estimated totals per column
- Count per column
- Custom sub-statuses within stages

**Canonical workflow stages:** Lead → Estimating → Sold → Production → A/R → Completed

**Quick actions button** in nav — add jobs/tasks from anywhere.

**Image references:**
- Board view: `images.g2crowd.com/uploads/attachment/file/1319946/jobnimbus-board-softwaresuggest.png`
- Home UI: `connecteam.com/wp-content/uploads/2025/06/Home-UI.png`
- Mobile: `cdn.prod.website-files.com/.../Group%201077242793.avif` (3 phones: board, photo annotation, calendar)

### What StormLeads Currently Shows

- 3 board tabs (Sales/Production/Billing) ✅
- Drag-and-drop kanban with optimistic updates ✅
- Deal value on cards + column revenue totals ✅
- Lead score badges (color-coded 80+/60+/40+) ✅
- Source labels, task progress badges, days-in-stage badges ✅
- Conversion rate between columns ✅
- Column collapse toggle (localStorage-persisted) ✅
- Priority/Source/Rep filter dropdowns with active pills ✅
- Mobile list view with deal values + priority dots ✅
- Sidebar lead preview with stage change + activity feed ✅
- CreateLeadModal ✅

### Gaps to Close

| Gap | JobNimbus Has | StormLeads Status | Effort | Priority |
|-----|---------------|-------------------|--------|----------|
| Custom workflow stages per job type | Separate workflows for residential vs insurance | Stages are global | High | Medium |
| Sub-statuses within stages | "Door Knock #1", "Followup", etc. | Single stage assignment | Medium | Medium |
| Photo thumbnail on cards | From CompanyCam | No photo on cards | Medium | Low |

### Assessment

**StormLeads pipeline is already competitive.** We show MORE data per card than JobNimbus (score badges, days-in-stage, task progress, conversion rates between columns). Our glass design is significantly more modern than JN's dated web UI. Consider custom stage workflows per job type as a future enhancement.

---

## 3. Estimates (StormLeads vs JobNimbus/SumoQuote + RoofLink)

### What JobNimbus/SumoQuote Shows

**Multi-page document builder with drag-and-drop page ordering:**
1. **Cover Page** — customer name, date, primary home photo, certification badges, auto-populated CRM data
2. **Introduction** — About Us, testimonials, scope. Rich text. Saveable as template
3. **Inspection** — photos and notes (CompanyCam)
4. **Estimate Details** — pricing/line items (see below)
5. **Signing & Upgrades** — signature + optional upgrade pricing
6. **Terms and Conditions**
7. **Warranty**
8. **Custom Pages**

**Estimate Details page:**
- Up to 3 tabs for Good/Better/Best or multi-trade
- Sections with editable names
- Line items from Products & Services catalog
- Drag-and-drop reorder (6-dot handle)
- Add Item / Section / Discount buttons
- Tax rate + **profit margin slider** (drag to adjust %)
- Override Total Price link
- Save as Template

**Stats:** $2,078 avg upgrades per signed quote, 64% close rate increase.

### What RoofLink Shows

**"3 Estimates in 3 Minutes":**
- Drawing roof auto-generates estimate + material order + work order
- Toggle categories: Work Doing / Work Not Doing / Supplements / Change Orders / Discounts / Upgrades
- **Real-time Gross Profit always visible** — material + labor costs separate
- Profit margin selector shows how discounts affect commission
- Up to **6 estimate options** per job (renamable)
- **Side-by-side comparison table**
- Multi-page branded PDF: cover → per-estimate pages → "Compare Estimates" summary
- Insurance-specific: ACV, depreciation, O&P fields

### What StormLeads Currently Shows

- Estimate list with KPI stats (Total/Draft/Sent/Accepted) ✅
- Rich multi-section editor with drag-and-drop line items ✅
- Rich text editor (bold, italic, underline, lists, links) ✅
- Section image uploader ✅
- Tax rate + discounts, multi-signer, profit margin input ✅
- Financing toggle (Hearth), template system ✅
- Review mode with live preview ✅
- Send for signing (email) ✅
- SRS Catalog material selection ✅
- **AI tier generation (Good/Better/Best)** ✅
- **Tier comparison modal (side-by-side)** ✅
- Estimate-to-invoice conversion ✅
- **Server-side PDF generation (pdfmake branded)** ✅
- **In-person signing (canvas modal, auto-creates work order)** ✅

### Gaps to Close

| Gap | Competitors Have | StormLeads Status | Effort | Priority |
|-----|------------------|-------------------|--------|----------|
| Multi-page document (cover, intro, inspection, terms, warranty) | SumoQuote: 7+ page types | Single-page estimate | High | **High** |
| Cover page with property photo + branding | JN auto-populates | Not implemented | Medium | **High** |
| Signing & Upgrades page (upsells at signing) | SumoQuote dedicated page | No upsell section | Medium | **High** |
| Insurance-specific fields (depreciation, ACV, O&P) | RoofLink full insurance flow | Not implemented | Medium | **High** |
| Profit margin slider (interactive) | Both JN and RoofLink | Static input field | Low | Medium |
| Change order management | JobNimbus | Not implemented | Medium | Medium |

### Recommended Improvements

1. **Multi-page estimate structure** — Cover Page (logo, property photo, date) + Scope + Estimate Details (current builder) + Terms + Signing. Biggest gap vs SumoQuote.
2. **Upgrades section** below main estimate — optional add-ons at signing time. SumoQuote claims $2,078 avg upsell.
3. **Insurance fields** — ACV, depreciation, O&P, insurance proceeds. Critical for storm restoration.
4. **Interactive profit margin slider** instead of text input.

---

## 4. Content / Marketing (StormLeads vs Rooftops.ai)

### What Rooftops.ai Shows

**AI Creator Studio — tool-picker grid layout:**
- Social Media Ads, Landing Page Builder, Cold Call Scripts, Email Marketing, Translate Anything (80+ languages), Legal Docs, Meeting Strategies, Website Generator
- AI Social Media Manager (schedules posts, tracks engagement)
- Interface: grid of tool cards, each opening its own generation module

**AI Roof Reports:**
- Address search + Google Places autocomplete
- Satellite imagery at 640×640
- Report sections: General Metrics (facets, squares, area, sunshine, panels) → Roof Pitch (angle, %) → Building Details
- Material selection: 5 horizontal image-backed buttons (Asphalt, Premium Asphalt, Clay, Metal, Wood Shake)
- Measuring tool, PDF export
- Processing status rotates phrases ("Gathering property details...")

**Solar Analysis (embedded in report):**
- Panel count, specs (watts, dimensions), annual savings
- 20-year projections: cost without solar vs with solar

**AI Employees (Q2 2026):** Marcus (Sales), Aisha (Marketing), Elena (Estimating), Ryan (Insurance). $169/month tier.

**Pricing:** Free → Pro $25/mo → Business $84/mo → AI Employee Pro $169/mo

### What StormLeads Currently Shows

- Content Studio: 7 types (social, door hangers, emails, blog, ad copy, scripts, landing pages) ✅
- 10 variable inputs (company, city, storm date, hail size, etc.) ✅
- Batch mode (8 variations) ✅
- Live preview panel (Facebook, email, door hanger, blog mockups) ✅
- Results grid with copy/save/delete ✅
- Library with search/filter + database persistence ✅

### Gaps to Close

| Gap | Rooftops.ai Has | StormLeads Status | Effort | Priority |
|-----|-----------------|-------------------|--------|----------|
| AI roof reports (satellite) | Core product, 300/mo | Not implemented | Very High | Medium |
| Solar analysis | Embedded in reports | Not implemented | Medium (Google Solar API free tier) | Medium |
| Social post scheduling | Schedules posts, tracks engagement | Generation only | High | Low |
| Tool-picker grid layout | Visual grid of content types | Dropdown selector | Low | Low |

### Assessment

**StormLeads Content Studio is already competitive** — 7 content types with batch mode, live preview, and storm-specific variables. Rooftops.ai has more types but lacks our storm context. Convert type selector to visual grid for better discoverability. Solar analysis is achievable with Google Solar API free tier.

---

## 5. Work Orders / Production (StormLeads vs RoofLink)

### What RoofLink Shows

**7-step linear workflow (NOT kanban):**
Target → Measure → Estimate → Approve → Order → Install → Collect

**Marketing:** Tab-based interactive section — each step clickable with screenshot. Blueprint page: step number, monochrome icon, "Old Way" vs "RoofLink Way."

**In-app vertical checklist IS the workflow:**
- ~15 steps from "Send welcome email" to "Submit warranties / close out job"
- Color indicator on completion
- Step action types: scheduling (calendar), uploading (requires photo), checkbox, document creation (e-signable)
- **Hard stops** — cannot advance without required photos (tear-off, underlayment, nail pattern)
- Contextual hints about next action

**Work orders:**
- Auto-generated from approved estimate
- Auto-separated by trade (roofing, gutters)
- Crew login ($30/mo) — photos/notes/calendar/work orders only, no profit visibility
- Smart crew assignment by availability
- SRS Distribution one-click ordering

**Map pin colors:** Green=approved, Purple=prospects, Orange=denied, Blue=completed, Gray=deleted

### What StormLeads Currently Shows

- 4-column kanban (Pending/Scheduled/In Progress/Completed) ✅
- Cards with milestone progress bar ✅
- Detail modal (full CRUD) ✅
- Milestone checklist (add/delete/toggle) ✅
- Photo upload per milestone with camera badge ✅
- **Photo-required enforcement** ✅
- Editable line items with running total ✅
- 8 milestone templates ✅
- Create from estimate (EstimatePicker) ✅
- Team member assignment ✅

### Gaps to Close

| Gap | RoofLink Has | StormLeads Status | Effort | Priority |
|-----|-------------|-------------------|--------|----------|
| Linear progress visualization (7-step) | Vertical checklist with hard stops | Kanban + milestone checklist | Medium | Medium |
| Step-type variety (schedule/upload/checkbox/doc) | Different UI per action type | All steps = checkbox + optional photo | Medium | Medium |
| Crew-limited login | Separate role, no cost visibility | Everyone sees everything | Medium | Medium |
| Auto-separation by trade | Work orders split by trade | Single work order per job | Medium | Low |
| Contextual next-step hints | Shows what to do next | No guidance | Low | Low |

### Recommended Improvements

1. **Horizontal step indicator** on work orders (Target→Estimate→Approve→Order→Install→Collect). Complements existing kanban.
2. **Enhance step types** — each milestone can be: checkbox, photo-required, schedule-pick, or document-generation.
3. **Crew role** with limited visibility — field workers see only work orders, photos, notes, calendar.

---

## 6. Dashboard / Reports (StormLeads vs JobNimbus + RoofLink)

### What JobNimbus Insights Shows

**Business Overview:**
- 4 stat cards: Leads, Sold, Close Rates, Estimating Conversion
- 3 filter dropdowns: Sales Rep, Lead Source, Job Type
- 4 charts: Top 5 Lead Sources (bar), Top 5 Reps (bar), Lead Flow (line, YoY), Historical Sales (line, YoY)

**Sub-sections (sidebar nav):**
- Leads/Close Rate — charts, scorecards by Rep/Source/Type, "Leads by Area" map
- Estimating Conversion — rate %, breakdowns
- Sales Pipeline — funnel by stage, outstanding estimates with $
- **Workflow Dashboard** — "Days in Stage" cards (avg days per stage, clickable green numbers for drill-down)
- Accounts Receivable — outstanding, overdue, by category
- **Profit Tracker** — Planned vs Actual Gross/Net, Revenue Trending, Variance by Salesperson/Type, Commissions

**UI patterns:** Eye icon for column customization, three-dot menu for export, raw data tables at bottom of every section.

### What RoofLink Shows

- Widget-based, fully customizable grid with renamable tabs
- Role-based dashboard templates (6+ roles)
- ~150 pre-built reports + custom builder
- Stale job alerts (3/7 day triggers)

### What StormLeads Currently Shows

- 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) ✅
- Revenue goal progress bar ✅
- Pipeline conversion funnel ✅
- Mini storm map with live radar ✅
- Tasks due today + Follow-ups ✅
- Activity feed ✅
- Team leaderboard (8 columns, clickable) ✅
- Conversion by storm, Estimate summary, A/R aging (5 buckets) ✅
- Estimating conversion cards ✅
- Filter dropdowns (Rep, Source, Period) with comparison period + trend arrows ✅
- **Reports (6 types):** Revenue (area), Pipeline (bar), Conversion (radar), Leaderboard, Lead Sources (donut), Stage Duration (line) ✅
- CSV export on all charts ✅
- Chart drill-down to filtered leads ✅

### Gaps to Close

| Gap | Competitors Have | StormLeads Status | Effort | Priority |
|-----|------------------|-------------------|--------|----------|
| Days-in-Stage cards (dashboard) | JN: avg days per stage, drill-down | Stage Duration chart in Reports only | Low | **Medium** |
| Profit summary dashboard | JN: Planned vs Actual, Variance | Per-lead profit only | High | Medium |
| Stale job alerts | RoofLink: 3/7 day triggers | Not implemented | Low | **Medium** |
| Year-over-year comparison | JN: this year vs last year lines | Current vs prior period | Medium | Low |
| Customizable widget layout | RoofLink: drag-and-drop | Fixed layout | High | Low |

### Recommended Improvements

1. **Days-in-Stage cards** on dashboard — avg time per pipeline stage, clickable to drill into stuck jobs. Low effort, high insight.
2. **Stale job alerts** — notify when a lead untouched for X days. Simple cron + existing notification system.
3. **StormLeads dashboard is already strong** — we show more than JN's default Home (they show only Tasks, Jobs, Contacts). Our mini storm map is unique.

---

## 7. Canvassing (StormLeads vs HailTrace + RoofLink)

### What HailTrace Shows (Enterprise Tier)

**Canvassing mode:**
- Row of customizable marker buttons at bottom
- Drop markers on rooftops (satellite view)
- **Custom status colors + icons:** Gray=Unknown (auto-downloads contact info), Yellow #1=No Answer (1st), Yellow #2=No Answer (2nd), custom: New Roof, Interested, etc.
- Visit numbers increment per attempt
- **Contact popup** — tapping Unknown marker auto-shows homeowner name, cell, email. Toggleable "heads-up display"
- "Track Me" GPS mode
- Notes per marker with full history
- Campaigns with territory assignment
- GPS verification (50ft)

**Canvassing leaderboard:** Per-rep stats (markers, contacts, prospects, leads, qualified, sales), date-filterable, location verification.

### What RoofLink Shows

- Color-coded pins with legend (green/purple/orange/blue/gray)
- Freehand territory polygons with rep assignment, overlap prevention
- County boundary overlay
- On-click property data (name, value, sqft, sale date)
- Bulk email/SMS from map by ZIP + status
- Weather overlay: hail dots with **diameter inside dot**, wind dots, "T" markers

### What StormLeads Currently Shows

- Google Maps dark/hybrid ✅
- Stats bar (doors, interested, scheduled) ✅
- Drop Pin mode (crosshair, tap to place) ✅
- Bottom sheet modal ✅
- GPS coordinates, 6 outcome options, notes ✅
- Convert to Lead ✅
- Territory Manager (polygon drawing, color, assignee) ✅
- Marker click → details ✅

### Gaps to Close

| Gap | Competitors Have | StormLeads Status | Effort | Priority |
|-----|------------------|-------------------|--------|----------|
| Auto-contact-data on pin | HailTrace: name, cell, email | No contact data | Very High (data source) | High |
| Custom pin statuses | HailTrace: unlimited colors/icons | 6 fixed outcomes | Medium | Medium |
| Visit counter (1st/2nd/3rd) | HailTrace: increments | Single outcome per pin | Medium | Medium |
| Canvassing leaderboard | HailTrace: per-rep metrics | No canvassing reporting | Medium | Medium |
| Weather overlay on canvassing | RoofLink: storm data toggle | Separate from storm map | Medium | Medium |

### Recommended Improvements

1. **Customizable pin statuses** — user-defined labels, colors, icons.
2. **Visit counter** — increment attempt number on re-visits.
3. **Canvassing leaderboard** — per-rep stats using existing leaderboard pattern.
4. **Storm data toggle** on canvassing map — show swaths alongside pins.

---

## 8. Communication (StormLeads vs JobNimbus)

### What JobNimbus Shows

- Shared SMS inbox (multiple numbers, Twilio-powered)
- Automated texting + emailing with triggers/delays
- Caller ID (iOS/Android), @mentions in notes
- Review request automation on completion
- Job share (live customer status link)
- **Engage pricing:** $49-249/mo

### What StormLeads Currently Shows

- Activity logging (Call, Email, SMS, Visit, Insurance) ✅
- SMS → `window.open('sms:...')` (native device, not in-app) ⚠️
- Drip sequences with auto-enrollment + email sending ✅
- Google review request link generation ✅
- Client status page (shareable) ✅
- Notifications (10 categories, multi-channel) ✅

### Gaps

| Gap | Effort | Priority |
|-----|--------|----------|
| In-app SMS (Twilio) — UI exists, needs wiring | Medium | **High** |
| Email inbox/thread view | High | High |
| Automated review requests (on stage change) | Low | **Medium** |
| @mentions in activity notes | Medium | Low |

---

## 9. Profit Tracking (StormLeads vs JobNimbus)

### What JobNimbus Shows

- **Per-job tab:** Revenue, Planned Total, Actual Total, Gross Margin, Net Margin
- Drag-and-drop metric card favorites (top 5)
- Grouped cost items (Material vs Labor auto-sort)
- Import from Estimates, Material Orders, Work Orders
- Commission tracking (revenue %, profit %, flat fee)
- **Dashboard:** Planned vs Actual graphs, Variance Analysis, Commissions report

### What StormLeads Shows

- Estimate total - expenses = profit (LeadDetail) ✅
- Expenses tracking (category, amount, date, notes) ✅

### Gaps

1. No Planned vs Actual comparison
2. No commission tracking
3. No Material vs Labor cost breakdown
4. No dashboard-level profit summary
5. No variance analysis

### Recommendations

1. **"Planned Cost" field on expenses** — budget vs actual per line item.
2. **Profit summary on dashboard** — aggregate total revenue, cost, gross margin %.
3. Commission tracking as future feature.

---

## 10. Mobile (StormLeads vs All)

### Competitors

- **JobNimbus:** Native iOS + Android, 4.8 stars, kanban/photo annotation/calendar
- **HailTrace:** Native apps, full map + canvassing + GPS tracking
- **RoofLink:** Mobile-first, crew login, work orders on phone

### StormLeads

- Mobile responsive layout ✅
- Bottom tab bar (5 tabs) ✅
- Mobile list/mission views ✅
- PWA manifest + service worker ✅
- No native app ❌

### Recommendation

Continue PWA approach. Focus on excellent mobile web UX rather than native apps. Cost of native development doesn't align with "affordable alternative" mission.

---

## Summary: Top 10 Actionable Improvements (Prioritized by Impact)

| # | Improvement | Competitor Reference | Effort | Impact |
|---|-------------|---------------------|--------|--------|
| 1 | **Multi-page estimate structure** (cover + scope + details + terms + signing) | SumoQuote 7+ pages | High | Very High |
| 2 | **Upgrades/upsell section** on estimates | SumoQuote ($2,078 avg upsell) | Medium | High |
| 3 | **Insurance estimate fields** (ACV, depreciation, O&P) | RoofLink | Medium | High |
| 4 | **In-app SMS via Twilio** (UI exists, needs backend) | JobNimbus Engage | Medium | High |
| 5 | **Days-in-Stage cards** on dashboard | JobNimbus Insights | Low | Medium |
| 6 | **Stale job alerts** (lead untouched X days) | RoofLink | Low | Medium |
| 7 | **Customizable canvassing pins + visit counter** | HailTrace | Medium | Medium |
| 8 | **Interactive profit margin slider** on estimates | JN + RoofLink | Low | Medium |
| 9 | **Calendar-based storm search** in Archive | HailTrace | Low | Medium |
| 10 | **Canvassing leaderboard** (per-rep stats) | HailTrace | Medium | Medium |

### Where StormLeads Already Wins

- **Pipeline UI** — more data per card than JN (score badges, days-in-stage, task progress, conversion rates)
- **Modern design** — glass/oklch system is far more contemporary than JN's dated UI or RoofLink's traditional SaaS
- **Storm + CRM in one app** — no competitor combines both
- **Content Studio** — 7 types, batch mode, live preview, storm-specific variables
- **Pricing** — $29-149/mo vs JN $349-1,254/mo vs RoofLink $400/user/mo
- **Work order milestones** — photo-required, 8 templates
- **A/R aging** — 5-bucket on dashboard + invoices
- **Free storm data** — NOAA/SWDI at $0 vs HailTrace $50-300+/mo
- **Mini storm map on dashboard** — unique feature no competitor offers

---

## Appendix: Image Reference URLs

### HailTrace
- Dashboard: `https://cdn.hailtrace.com/images/home/dashboards.png`
- Hail maps: `https://cdn.hailtrace.com/images/home/hail-maps.png`
- Flexibility: `https://cdn.hailtrace.com/images/home/flexibility.png`
- Weather Radar: `https://lirp.cdn-website.com/074b5fee/dms3rep/multi/opt/Weather+Radar-1920w.png`
- Territory Mapping: `https://lirp.cdn-website.com/074b5fee/dms3rep/multi/opt/Territory+Mapping-1920w.png`
- Storm Reports: `https://lirp.cdn-website.com/074b5fee/dms3rep/multi/opt/Storm+Reports-1920w.png`
- HailTrace vs Hail Recon: `https://useproline.com/wp-content/uploads/2025/10/image-3-1024x574.jpeg`

### JobNimbus
- Board view: `https://images.g2crowd.com/uploads/attachment/file/1319946/jobnimbus-board-softwaresuggest.png`
- Insights: `https://images.g2crowd.com/uploads/attachment/file/1319954/Insights.png`
- Home UI: `https://connecteam.com/wp-content/uploads/2025/06/Home-UI.png`
- Mobile: `https://cdn.prod.website-files.com/6787de296c2d0f1df5b0c942/67fcf8a6852d5264ccdd1e68_Group%201077242793.avif`

### RoofLink
- Tab-based 7-step interactive sections on marketing site
- Blueprint page: monochrome icons per step
- Color-coded map pins: green/purple/orange/blue/gray

### Rooftops.ai
- Satellite reports at 640x640 resolution
- Material selection: 5 horizontal image-backed buttons
- 4-tier pricing cards with monthly/annual toggle
- Dark/light mode toggle

---

*Sources: hailtrace.com, jobnimbus.com, rooflink.com, rooftops.ai, help.hailtrace.com, support.jobnimbus.com, sumoquote.com, learn.hailtrace.com, Capterra, G2, Software Advice, App Store, Knockbase integration docs, ProLine comparison articles, YouTube tutorials (2025-2026), SalesRabbit/Roofle acquisition docs, .firecrawl/ research archives (April 2-6, 2026)*
