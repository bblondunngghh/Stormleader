# Competitor UI Research — Visual Patterns & Actionable Gaps

**Date:** 2026-03-26
**Method:** Firecrawl scrapes of competitor marketing pages, help centers, YouTube transcripts, product pages, and review sites
**Companion doc:** `docs/competitor-gap-analysis.md` (text/feature analysis — not duplicated here)

---

## 1. Storm Map (StormLeads vs HailTrace)

### What HailTrace Shows

**Map Gallery Page (hailtrace.com/hail-maps):**
- Grid of dated storm cards, each with a thumbnail map preview image hosted on `cdn.hailtrace.com/storm-image-previews/{date}/preview.png`
- Each card shows: date, affected states, affected cities list, storm type badges (Hail / Wind / Tornado), and a "More Info" link
- Cards are filterable by state multi-select and date range picker
- Clicking a card opens a dedicated storm page with reports, related events, and impacted locations sorted by state and city

**Interactive Map (from homepage + help docs):**
- Storm swaths drawn as colored polygons over a satellite/road map
- Dashboard screenshot on hailtrace.com shows: revenue tracking panel, weekly performance stats, and "all your leads in a single place"
- Image reference: `cdn.hailtrace.com/images/home/hail-maps.png` — shows color-coded swath polygons on a dark-themed map with residential property pins
- Image reference: `cdn.hailtrace.com/images/home/dashboards.png` — analytics dashboard alongside the map

**Honey Hole Finder:**
- Listed as a key feature with its own callout section on the homepage
- Described as finding "hidden areas that have a higher risk for damage from severe weather"
- No public screenshots of the actual UI — it's behind their paywall

**Property Popups:**
- From knowledge base: assets (properties) have customizable data fields, opportunity pipeline status, price, stage, priority, and trades
- Properties are called "Assets" with associated "Opportunities" that move through stages: Prospect → Lead → Open → Closed → Lost

### What StormLeads Shows
- Hail/wind/tornado/thunderstorm layer polygons on Mapbox
- FEMA NSI property pins at zoom 14+ with popups showing address, owner, value, year built
- Honey Hole heatmap overlay using NOAA SWDI historical data
- Time range filter (30d–all), layer toggles, transparency slider
- Click-to-add-lead from property pins

### The Gap
1. **No storm gallery/index page** — HailTrace has a browsable, searchable archive of every mapped storm with preview thumbnails. StormLeads has a map but no way to browse historical storms as a catalog.
2. **No per-storm detail view** — HailTrace links each storm to a detail page with affected cities, reports, and statistics. StormLeads shows swaths on the map but no dedicated storm pages.
3. **No meteorologist verification badge** — HailTrace prominently badges their storms as "meteorologist-verified." StormLeads uses raw NOAA data without any verification messaging.
4. **Property pipeline integration** — HailTrace properties ("assets") have built-in opportunity stages (Prospect→Closed). StormLeads has click-to-add-lead but no pipeline status visible on the map.

### Recommended Improvements
- **Storm Archive Page**: Add a `/storm-archive` route with a filterable grid of past storms (date, states, type badges, affected count). Data source: existing NOAA SWDI queries grouped by date.
- **Storm Detail View**: When clicking a swath polygon, show a sidebar with storm stats (hail size, wind speed, affected properties count, affected cities).
- **"NOAA Verified" Badge**: Add subtle badge on storm layers noting "Data: NOAA Storm Prediction Center" — builds trust without needing meteorologists.
- **Map-visible Pipeline Status**: Color-code property pins by their CRM stage when the user is logged in (e.g., green = closed, yellow = lead, red = prospect).

---

## 2. Pipeline / CRM (StormLeads vs JobNimbus)

### What JobNimbus Shows

**Sales Boards (from product page):**
- Kanban-style boards with columns per stage
- Marketing copy: "See all your leads and jobs on one board, with **estimated totals** and more"
- Mobile app screenshot (alt text): "The left phone shows a **sales board with leads**" — compact card layout on mobile
- Custom sales workflows: users can "create the perfect workflow for your sales team"
- Sales automation: "When a proposal is signed, move the job to 'Sold'" — trigger-based stage transitions

**Production Boards:**
- Separate board for jobs in production: "See all your jobs in production on one board—including **where they're getting stuck**"
- Custom job workflows per job type (e.g., residential retail vs insurance roofing)

**Profit Tracker:**
- "See **real-time job profits and cost breakdowns**" — per-job profitability
- "Ensuring profitability by comparing projected costs with actual costs" (Budgets feature)

**Insights Reporting:**
- "Visualize trends and stats with custom reports"
- "Detailed insights on your team's performance, lead sources, and more"

### What HailTrace Shows (Pipeline)

**Opportunity Pipeline (from YouTube transcript + knowledge base):**
- Dashboard shows 5 stages: Prospect, Lead, Open, Closed, Lost
- Each stage displays: **revenue total** and **opportunity count**
- **Percentage change** from previous period shown next to each stage
- Can click a stage to jump directly to its opportunities
- Leaderboard section showing sub-user productivity by stage
- Gross revenue chart over selected date range
- "Impacted Assets" count — properties affected by weather events
- "Created Opportunities" total
- "Recently Impacted Asset Revenue" — potential revenue from weather-impacted properties

### What StormLeads Shows
- Kanban drag-drop by stage with mobile board/list toggle
- Collapsible columns, filter by priority/source/rep
- Cards show: name, address, priority badge, source badge
- No revenue/deal value on cards
- No stage-level revenue totals
- No conversion rate percentages between stages

### The Gap
1. **No deal value on kanban cards** — Both JobNimbus and HailTrace show dollar amounts per card and per stage column. StormLeads cards show name/address/priority/source only.
2. **No column-level revenue totals** — HailTrace shows total revenue per stage. JobNimbus shows "estimated totals." StormLeads columns have no financial summary.
3. **No conversion funnel metrics** — HailTrace shows percentage change from previous period. StormLeads has no conversion rates between stages.
4. **No separate production board** — JobNimbus has distinct Sales and Production boards with different workflows. StormLeads has one pipeline.
5. **No trigger-based automation on stage change** — JobNimbus auto-moves jobs when proposals are signed. StormLeads has basic automations but no visual indication in pipeline.

### Recommended Improvements
- **Add deal value to cards**: Show estimated total from linked estimate on each pipeline card. Display as a prominent dollar figure below the lead name.
- **Column revenue headers**: Show sum of deal values per stage column, plus lead count (e.g., "$45,200 · 12 leads").
- **Stage conversion rates**: Show a small percentage between columns indicating conversion rate from previous stage.
- **Production board**: Add a toggle or separate view for "Production" pipeline with stages like: Approved → Materials Ordered → Scheduled → In Progress → Completed → Collected.

---

## 3. Estimates (StormLeads vs JobNimbus SumoQuote + RoofLink)

### What JobNimbus Shows

**Estimate/Proposal Builder (SumoQuote, now built-in):**
- "Create fast, accurate estimates every time"
- "One-click estimates" — auto-populate from measurements
- "Professional proposal templates" with e-signatures
- "Plug in measurements to create a detailed estimate in seconds" (Smart Estimating)
- Estimate → Invoice conversion in one click
- Digital signatures via email or in-app
- Change order management for scope adjustments

### What RoofLink Shows

**"3 Estimates in 3 Minutes" (rooflink.com/roofing-estimate-software/):**
- **Good/Better/Best model**: Present distinct estimate options (Silver, Gold, Platinum) from a single measurement
- Screenshot shows three side-by-side estimate cards with different tiers
- Image: mobile phone showing estimate generation in the field
- **Real-time profit margin display**: "RoofLink calculates your Gross Profit in real-time" — reps see exactly how price drops affect their commission
- Screenshot: dashboard with profit margin percentages prominently displayed
- **Living file**: "An estimate in RoofLink isn't a dead-end document. Once approved, that data converts into a Material Order and Work Order instantly."
- Estimate → Material Order → Work Order is automatic, no re-entry
- Built on live material pricing and labor rates, not guesswork

### What StormLeads Shows
- Full estimate builder with 10+ sections, templates, merge fields
- Discounts, profit margin calculation, multiple signers
- Financing integration (Hearth), materials catalog
- Print, send, duplicate
- Public estimate page with e-signature canvas

### The Gap
1. **No Good/Better/Best workflow** — RoofLink's killer feature is generating multiple estimate tiers from a single measurement. StormLeads creates one estimate at a time.
2. **No real-time profit visibility during editing** — RoofLink shows gross profit margin updating live as reps adjust prices. StormLeads has profit margin calc but it's not as prominently featured.
3. **No estimate → work order auto-conversion** — RoofLink auto-generates material orders and work orders from approved estimates. StormLeads has "create from estimate" but it's manual.
4. **No measurement auto-population** — JobNimbus plugs in EagleView/Hover measurements to auto-fill estimate line items. StormLeads has roof measurement data but doesn't auto-populate estimates.

### Recommended Improvements
- **Multi-tier estimates**: Add a "Create Good/Better/Best" button that duplicates an estimate into 3 variants with different material grades. Show them side-by-side on the public estimate page.
- **Prominent profit margin display**: Show a real-time "Gross Profit: $X,XXX (XX%)" bar at the top of the estimate builder that updates as line items change.
- **Auto-create work order on approval**: When a customer signs/accepts an estimate, auto-generate a work order with the line items pre-populated.
- **Roof measurement → estimate shortcut**: When roof measurement data exists on a lead, offer a "Generate Estimate from Measurements" button that pre-fills square footage line items.

---

## 4. Content / Marketing (StormLeads vs Rooftops.ai + JobNimbus)

### What Rooftops.ai Shows

**AI Roof Reports (rooftops.ai):**
- Pivoted from "Creator Studio" to **AI Roof Reports** as primary product
- "Search any address — get roof area, pitch, and cost estimates in 30 seconds"
- 3-step workflow: Enter Address → Get Instant Report → Send & Close
- Features: AI Roof Measurements, Instant Cost Estimates, One-Click Proposals, AI Assistant, Lead Follow-up, Solar Analysis (coming soon)
- **AI Employees** (waitlist, $199/mo): Named personas — Marcus (Sales), Aisha (Marketing), Elena (Estimating), Ryan (Insurance)
- Automated: lead follow-up, content & SEO creation, social media management, 24/7 customer responses
- Consulting: 5-week program ($5,000) covering AI audit, property analysis, estimating, marketing automation

**Key UI Pattern:**
- Address search bar as primary interface — type address, get instant report
- Clean, minimal design with prominent call-to-action
- Report-centric workflow: generate → customize → send to homeowner

### What JobNimbus Shows (Marketing)

- SEO services, paid ads management, Google Business Profile optimization, website building
- "Smart Forms" — AI-powered form builder
- All through Roofer Marketers subsidiary (acquired 2023)
- Marketing is a managed service, not a self-serve tool

### What StormLeads Shows
- Content Studio: 5 content types (social/door hangers/email/blog/ads)
- 4 tones, 10 configurable variables, batch generation (5 variations)
- Copy-to-clipboard for manual posting
- No direct publishing, no analytics, no templates saved

### The Gap
1. **No AI roof report generation** — Rooftops.ai's primary feature is instant roof reports from an address. StormLeads has roof measurement via Google Solar API but doesn't package it as a shareable report.
2. **No address-based instant analysis** — Rooftops.ai's UX centers on a search bar. StormLeads requires navigating to a lead detail to see property data.
3. **No content templates/saved library** — Generated content disappears after copy. No way to save, categorize, or reuse content.
4. **No publishing integration** — Content is copy-paste only. No scheduling or direct social posting.

### Recommended Improvements
- **Property Report Generator**: Bundle existing data (Google Solar roof measurement, weather history, FEMA flood zone, Census demographics) into a professional PDF/page that reps can send to homeowners. Use existing data — zero new API costs.
- **Quick Property Lookup**: Add a search bar on Dashboard or Content Studio that takes an address and shows a consolidated property brief (roof data + storm history + demographics).
- **Content Templates Library**: Add save/favorite to Content Studio. Let users build a library of their best generated content with tags.
- **Scheduled Content Queue**: Simple queue where generated content can be scheduled for future copy-to-clipboard reminders via notifications.

---

## 5. Work Orders / Production (StormLeads vs RoofLink)

### What RoofLink Shows

**7-Step Production Pipeline (rooflink.com/production/):**
- Linear workflow: Target → Measure → Estimate → Approve → Order → Install → Collect
- Each step is a discrete stage with specific requirements before advancing
- **Approve Stage**: Back-office team checks accuracy, identifies issues, then approves — acts as a financial checkpoint before materials are ordered
- **Order Stage**: "Approval automatically triggers supplier POs and crew work orders" — no manual re-entry
- **Install Stage**:
  - "Templated checklists and photo prompts reduce wasted time"
  - "Require crews to upload photos of the tear-off, the underlayment, and the final nail pattern before they can request payment"
  - Photo verification is gating — can't complete the job without it
- **Smart Scheduling**: "Assign crews based on availability and job type"
- **Real-Time Updates**: "See when materials drop and when crews work"
- Image shows production pipeline as a horizontal flow from Sales → Approve checkpoint
- Single-interface rep model: "The rep who makes the promise keeps the promise" — one person from first knock to final collection

### What StormLeads Shows
- 4-column work order kanban: Pending → Scheduled → In Progress → Completed
- Drag-drop, detail modal, milestones with % tracking
- Create from estimate, team assignment, line items from estimates
- **Photo upload is a stub** ("coming soon" toast)
- Milestones are read-only (can't create/edit)
- No crew scheduling or capacity planning

### The Gap
1. **Photo verification is a stub** — RoofLink requires photo uploads at specific milestones before payment. StormLeads has "coming soon" toast on photo upload.
2. **No approval/checkpoint gate** — RoofLink has an explicit "Approve" step between estimate and production. StormLeads goes straight from estimate to work order.
3. **No automatic material ordering** — RoofLink auto-generates supplier POs from approved estimates. StormLeads has Materials page but no estimate-to-order flow.
4. **No templated checklists** — RoofLink forces reps through checklist items per job type. StormLeads milestones are read-only.
5. **No crew scheduling** — RoofLink assigns crews by availability. StormLeads has team assignment but no scheduling view.

### Recommended Improvements
- **Fix photo upload**: This is the #1 priority — the stub exists, just needs backend wiring. Allow photo upload per milestone, make certain photos required before stage advancement.
- **Editable milestones/checklists**: Convert read-only milestones to interactive checkboxes. Let users create milestone templates per job type.
- **Approval gate**: Add an optional "Approval Required" toggle on work orders. When enabled, a manager must approve before the job moves to "Scheduled."
- **Estimate → Material Order flow**: Add a "Generate Material Order" button on approved work orders that pre-fills the Materials page cart from estimate line items.

---

## 6. Dashboard / Reports (StormLeads vs JobNimbus + HailTrace)

### What JobNimbus Shows

**Dashboard:**
- "Profit Tracker" — real-time per-job profitability with cost breakdowns
- "Budgets" — compare projected costs vs actual costs per job
- "Efficiency reports" — find production bottlenecks
- "Insights reporting" — custom visualizations of trends and stats

**Reports Features:**
- Custom report builder with drag-and-drop widgets
- "Classic Reports" (legacy) + "Insights" (new, visualized)
- Performance metrics by rep, source, time period
- Industry benchmarking via "Peak Performance" annual report

### What HailTrace Shows (from YouTube transcript)

**Dashboard Layout:**
- **Date range selector** in top-right corner (quarter, month, custom)
- **Opportunity Pipeline overview**: 5 stage cards showing revenue + opportunity count + percentage change from previous period
- **Leaderboard**: Sub-user productivity ranked by stage, filterable by stage
- **Gross Revenue chart**: Line/bar chart over selected date range
- **Assets Impacted**: Count of properties hit by weather events (with downloadable report)
- **Created Opportunities**: Total new opportunities created
- **Recently Impacted Asset Revenue**: Potential revenue from weather-impacted properties
- **Recent Storms**: Quick links to jump to latest storm maps

### What StormLeads Shows
- 4 stat cards: pipeline value, new leads, close rate, avg days to close
- Pipeline funnel bar chart
- Mini storm map (non-interactive)
- Storm activity panel (24h/7d/30d)
- Today's tasks, activity feed
- Storm conversion panel, estimates summary
- Team leaderboard

### The Gap
1. **No per-job profitability tracking** — JobNimbus shows real-time profit per job. StormLeads has job cost summary in LeadDetail but no dashboard-level profit view.
2. **No budget vs actual comparison** — JobNimbus compares projected vs actual costs. StormLeads tracks expenses but doesn't compare to estimates.
3. **No period-over-period comparison** — HailTrace shows percentage change from previous quarter. StormLeads shows current stats only.
4. **No drill-down from dashboard** — Clicking a stat card should navigate to a filtered view. Currently dashboard panels are display-only.
5. **Non-interactive mini map** — The dashboard storm map is static. HailTrace's dashboard links directly to storm maps.

### Recommended Improvements
- **Profit Dashboard Card**: Add a "Gross Profit" stat card showing total profit (revenue - expenses) across all jobs. Click to drill into per-job profit list.
- **Period Comparison**: Add a small "vs previous period" percentage change indicator on each stat card (e.g., "+12% vs last month").
- **Drill-down Links**: Make each dashboard panel clickable — stat cards link to filtered lead lists, funnel bars link to pipeline view, tasks link to tasks page.
- **Interactive Mini Map**: Make the dashboard storm map clickable to navigate to the full Storm Map page, pre-filtered to the displayed time range.
- **Budget vs Actual Widget**: Add a panel comparing estimated revenue (from estimates) vs actual revenue (from invoices/payments) per time period.

---

## 7. Communication & Automation (StormLeads vs JobNimbus)

### What JobNimbus Shows

**Communication:**
- **Engage Texting**: Shared inbox with multiple phone numbers, automated + manual SMS
- **Automated Texting**: Trigger-based SMS (e.g., "when appointment is set, send confirmation text")
- **Caller ID**: Know who's calling before you answer (iOS + Android)
- **@mentions**: Tag team members in notes for notification
- **Job Share**: Live link customers can visit to see their job status
- **AssistAI ($298/mo)**: 24/7 AI phone answering, books appointments, captures leads, auto-syncs to CRM
- **Scout (beta)**: Voice/text AI assistant for creating jobs, contacts, tasks, estimates from mobile

**Automation:**
- Trigger-based: "When X happens, do Y" with visual workflow builder
- Email + SMS automation
- Stage-change triggers
- Review request automation on job completion

### What StormLeads Shows
- SMTP email configuration, drip sequences with 3 triggers and 3 actions
- Email modal in lead detail
- No SMS, no phone integration, no caller ID
- Basic automations (stage change triggers)
- Browser confirm() dialogs on drip sequence actions

### The Gap
1. **No SMS/texting** — JobNimbus's Engage texting is a core sales tool. StormLeads has email only.
2. **No phone integration** — No caller ID, no call logging, no AI answering.
3. **No real-time customer status sharing** — JobNimbus has "Job Share" live links. StormLeads has `/status/:token` but it's minimal.
4. **Crude UI for drip sequences** — Browser confirm() dialogs, no conditional logic, no merge fields in emails.

### Recommended Improvements
- **SMS integration is expensive** — Twilio costs real money. Instead: improve the `/status/:token` public page to show rich job progress (milestones completed, next steps, photos). This gives customers visibility without SMS costs.
- **Enhanced Drip Sequence UI**: Replace browser confirm() with proper modal dialogs. Add merge field insertion ({{first_name}}, {{company}}, etc.) to email templates.
- **Conditional Drip Logic**: Add "if/else" branching in drip sequences (e.g., if estimate viewed → send follow-up, else → send reminder).
- **Activity-based notifications**: Ensure all customer-facing actions (estimate viewed, payment received, contract signed) trigger push notifications to the rep.

---

## 8. Payment & Invoicing (StormLeads vs JobNimbus + RoofLink)

### What JobNimbus Shows
- Online payment via credit/debit cards and ACH/eCheck
- **Text-to-Pay**: Send payment link via SMS
- **Next-day funding**: Fast access to collected payments
- **Financing** via Sunlight Financial integration
- Billing boards: See all completed jobs, collect final payment from one view
- Invoice from estimate in one click
- QuickBooks Online/Desktop/Server sync

### What RoofLink Shows
- Stripe integration for field collection
- "Same rep finishes the job and processes payment"
- Payment is the final step in the 7-step workflow
- QuickBooks Online sync

### What StormLeads Shows
- Invoice creation with line items, tax, discounts
- Stripe Connect for online payment (card 2.9%, bank 0.8%)
- Create invoice from estimate
- Manual payment recording
- No Text-to-Pay, no payment reminders, no recurring invoices
- Hearth financing integration

### The Gap
1. **No payment reminders** — No automated "you have an unpaid invoice" emails/notifications.
2. **No recurring invoices** — Can't set up monthly payment plans.
3. **No Text-to-Pay** — Requires SMS integration (expensive).
4. **No QuickBooks sync** — Both competitors offer this as standard.

### Recommended Improvements
- **Invoice payment reminders**: Add automated email reminders for overdue invoices (3 days, 7 days, 14 days). Uses existing email infrastructure — zero new costs.
- **Payment plan support**: Allow splitting an invoice into multiple installments with scheduled dates. Track partial payments against the total.
- **Invoice PDF export**: Add PDF generation for invoices (currently print-only). Use existing estimate PDF logic.
- **QuickBooks sync**: This is a significant integration effort but high competitive impact. Consider as a Phase 3 feature.

---

## Summary: Top 10 Visual/UI Improvements by Impact

| Priority | Improvement | Competitor Reference | Effort | Impact |
|----------|------------|---------------------|--------|--------|
| 1 | **Deal value on pipeline cards + column totals** | JobNimbus, HailTrace | Low | Critical — every CRM shows this |
| 2 | **Fix work order photo upload stub** | RoofLink | Medium | Critical — production tracking is broken without it |
| 3 | **Good/Better/Best estimate tiers** | RoofLink | Medium | High — proven to increase close rates |
| 4 | **Dashboard drill-down + period comparison** | HailTrace, JobNimbus | Low | High — makes dashboard actually useful |
| 5 | **Property Report Generator** | Rooftops.ai | Medium | High — bundles existing free data into sales tool |
| 6 | **Editable work order checklists** | RoofLink | Medium | High — enables structured production workflows |
| 7 | **Invoice payment reminders** | JobNimbus | Low | High — reduces missed payments |
| 8 | **Estimate → Work Order auto-creation** | RoofLink | Low | Medium — eliminates manual step |
| 9 | **Storm archive/catalog page** | HailTrace | Medium | Medium — unique browsing experience |
| 10 | **Enhanced drip sequence UI** | JobNimbus | Medium | Medium — merge fields + conditional logic |

---

*Generated 2026-03-26 via Firecrawl scrapes of hailtrace.com, jobnimbus.com, rooflink.com, rooftops.ai, and associated help centers/YouTube channels.*
