# Competitor UI Visual Research — StormLeads vs HailTrace + JobNimbus + RoofLink + Rooftops.ai

**Date:** 2026-04-04 (updated — 5 parallel research agents, 250+ sources across competitor sites, help centers, review sites, App Store, YouTube, and integration docs)
**Methodology:** Firecrawl scrapes + WebSearch of competitor websites, help centers, App Store listings, review sites (Capterra, G2), YouTube tutorials, integration partner docs, and blog articles
**Purpose:** Visual/UX comparison to identify specific UI gaps and actionable improvements for StormLeads
**Companion doc:** `docs/competitor-gap-analysis.md` (feature/pricing text analysis — DO NOT duplicate)

---

## 1. Storm Map (StormLeads vs HailTrace)

### What HailTrace Shows

HailTrace's map is the entire product — everything revolves around it. Built on Google Maps with three view modes (Standard, Satellite, Hybrid).

**Swath Display:**
- Storm swaths are filled polygon overlays with **light-to-dark color graduation** — lighter fill = smaller hail, darker fill = larger/more severe
- Highest-severity zones appear as **"Purple Zones"** (confirmed by SPOTIO integration docs) — these mark areas most likely to file insurance claims
- **Ten levels of hail size** in 1/4-inch increments using "Next Generation Hail Swath Colors"
- Unique **hatched cross-hatch pattern overlay** on isolated hail swaths — HailTrace claims to be the only platform with this, letting users distinguish isolated storms from confirmed broad swaths at a glance
- Each storm receives a **1-5 star rating** based on impacted properties, max hail size, and damage probability — free users only see 1-star maps

**Layer System (6 simultaneous layers):**
1. Meteorologist Hail Maps (hand-drawn polygons from dual-pol radar — the primary swaths)
2. Algorithm Hail Maps (computer-generated, QC'd by meteorologists — "second layer of tracking")
3. Wind Speed Maps (58+ MPH gusts)
4. Tornado Path Maps (tracks with EF ratings)
5. NOAA Reports (darker icons on map; hover shows NWS storm report data)
6. Social Media Images (camera icons pinned at geo-tagged photo locations showing real-world hail/damage photos)

**Map Controls (right-side toolbar):**
- Calendar button for date-based storm search (year > month > day drill-down)
- Radius filter with adjustable size, filterable by hail size range, wind speed, tornado EF rating, or star level
- Layer toggle icon for individual on/off
- Settings gear for satellite view, NOAA reports, social media toggles
- Saved events icon
- "View List" / "View Map" toggle button
- Download button per storm event

**Honey Hole Finder:** Not a separate tool — users load multiple storm swaths from different dates onto the same map. Overlapping polygons reveal repeatedly-hit areas as denser/darker layered regions. Historical data back to 2010 (hail) and 2020 (wind). The visual effect is a manual heat map — more overlapping = more color density = higher-value prospecting.

### What StormLeads Currently Shows

- Google Maps with hail/wind/tornado/thunderstorm swath polygons (NOAA data)
- Hail severity color graduation (green > yellow > orange > red by hail size)
- Wind severity color graduation (blue > green > orange > red by mph) — NEW
- Tornado severity color graduation (yellow > orange > red > purple by EF-scale) — NEW
- 6-layer toggle panel (Hail/Wind/Tornado/Thunderstorm/Drift/Properties)
- Swath transparency slider (0-100%)
- Honey Hole heatmap overlay (NOAA SWDI historical hail circles)
- Property popup with "Add to Pipeline" button
- Time range filter (24h/3d/7d/14d/30d)
- Address search bar
- Zoom level indicator + terrain toggle

### Specific Gaps to Close

| Gap | HailTrace | StormLeads | Priority |
|-----|-----------|------------|----------|
| Swath severity granularity | 10 levels per 1/4-inch with purple zones | 4 color steps per type | High — add more color stops |
| Star rating per storm | 1-5 stars based on impact/size/probability | None | Medium — add severity rating to Storm Archive cards |
| Hatched pattern for isolated storms | Cross-hatch overlay layer | None | Low — nice visual but niche |
| Social media damage photos on map | Camera icons at geo-tagged locations | None | Low — would need social API |
| Calendar-based storm search | Year > month > day drill-down | Time range pills (24h-30d) | Medium — add date picker to Storm Archive |
| Multi-swath date overlay | Load multiple dates on same map | Single time window | High — this IS the Honey Hole UX |
| View List / View Map toggle | Button to switch between map and table | Separate pages (Storm Map vs Storm Archive) | Medium — unify into one view |
| Saved filter presets | Named saved filters for reuse | None on Storm Map (Leads has saved filters) | Medium — port pattern from LeadList |

### Recommended Improvements

1. **Add more color stops to swath graduation** — go from 4 steps to 8-10 steps per hail size increment (0.25" granularity). HailTrace's 10-level system with purple zones for >2" hail is the benchmark.
2. **Add storm severity rating** — calculate a 1-5 star rating for each storm based on max hail size, estimated impacted structures, and wind speed. Display on Storm Archive cards and in map popups.
3. **Add date-based storm search** — add a DatePicker to Storm Archive allowing users to search storms by specific date, not just rolling time windows.
4. **Multi-date swath overlay** — allow selecting multiple storms from different dates to overlay simultaneously on the map. This recreates HailTrace's Honey Hole workflow natively.

---

## 2. Pipeline / CRM (StormLeads vs JobNimbus)

### What JobNimbus Shows

JobNimbus uses "Boards" in three flavors: Sales, Production, and Billing.

**Kanban Card Anatomy:**
- White card boxes with configurable title (via shortcodes from Contact/Job fields)
- Up to 3 customizable content rows (contact type, invoice totals, balance due)
- Fixed bottom row (cannot be adjusted): days-in-status badge, completed tasks ratio (e.g., "2/5"), attachment count (paperclip icon), due date, assignee initials/avatar
- Cards do NOT show thumbnails or photos
- Drag-and-drop between stages

**Column Headers:**
- Optional revenue totals: Estimate Total, Invoice Total, Outstanding Invoice Total per column
- Totals respect user permission levels (visibility-controlled)

**Board Sidebar (click-to-preview):**
- Clicking a card opens a **right-side panel** (not full page)
- Shows: job name, address with Maps integration, status change dropdown, "Open In Full Page / New Tab" options
- Job description, assignees, sales rep, subcontractors, related contacts, custom fields
- Users can assess jobs without leaving the board view

**Default Stages:**
Lead > Appointment > Schedule > Estimating > Pending Signature > Signed Contract > Job In Progress > Final Walkthrough > Pending Payments > Paid/Closed > Jobs Lost

**Navigation:** Top-positioned menu (not left sidebar). Profile icon dropdown for Settings/Team/Financials/Workflows.

**Design Language:** Navy blue primary (#152152), electric blue accents (#3968c6), light blue backgrounds (#ebf0fa). Plus Jakarta Sans typography. Light mode only — no dark mode. "Functional but dated" per reviewers. Documented complaint: blues are so similar that scrollbar sliders become nearly invisible.

### What StormLeads Currently Shows

- Kanban with HTML5 drag-and-drop, optimistic updates
- 3 board tabs (Sales/Production/Billing with stage filtering)
- Cards show: deal value, lead score badge (80+/60+/40+), source label, task progress badge, days-in-stage badge (color-coded)
- Column revenue totals (sum of estimated_value)
- Conversion rate between columns (color-coded percentages)
- Column collapse toggle (localStorage-persisted)
- Priority/Source/Rep filter dropdowns with active filter pills
- Mobile list view with deal value + priority dots
- CreateLeadModal button
- Grab-to-pan horizontal scroll

### Specific Gaps to Close

| Gap | JobNimbus | StormLeads | Priority |
|-----|-----------|------------|----------|
| Card click → sidebar preview | Right-side panel without leaving board | Must navigate to full LeadDetail page | High |
| Attachment count on cards | Paperclip icon with count | None | Low |
| Task completion ratio on cards | "2/5" tasks done | Task progress badge (percentage) | Already similar |
| Custom card content rows | Up to 3 configurable rows | Fixed layout | Medium |
| Board templates | Private/shared board templates | None | Low |
| Column totals: multiple types | Estimate, Invoice, Outstanding | Only estimated_value sum | Medium — add invoice totals |

### Recommended Improvements

1. **Add board sidebar preview** — clicking a pipeline card should open a right-side panel showing key lead info, quick status change, and "Open Full Detail" button. This is JobNimbus's best UX pattern — users can triage without losing board context.
2. **Add invoice/outstanding totals to columns** — show Estimate Total, Invoice Total, and Outstanding amounts per pipeline column, not just estimated_value.
3. **Migrate to @dnd-kit** — currently using HTML5 drag API which has limited mobile support. JobNimbus's mobile kanban works well with native touch gestures.

---

## 3. Estimates (StormLeads vs JobNimbus SumoQuote + RoofLink)

### What JobNimbus SumoQuote Shows

The most sophisticated estimate builder in the roofing CRM space.

**Multi-Page Proposal System:**
1. **Cover Page** — company branding, customer home photo (650x414px), certification images, date, auto-populated customer info
2. **Introduction** — rich text editor with bold/italic/lists/links, Insert Token dropdowns (e.g., `{{ACCOUNT_NAME}}`), saved templates
3. **Inspection** — photo sections with descriptions, multiple layout styles, drag-and-drop photo reorder
4. **Estimate Details** — the core pricing page:
   - Up to 3 tabs for Good/Better/Best or multi-trade (Roofing/Siding/Gutters)
   - "Include all items from" option to avoid double-entry between tiers
   - Sections with named groups (e.g., "Roofing Tear Off", "Materials and Labor")
   - Line items synced from Products & Services library
   - Drag-and-drop reorder with six-dot handles
   - Add Item / Add Section / Add Discount buttons
   - Tax rate + **profit margin slider**
   - Override Total Price option
   - Expandable total breakdown
5. **Signing & Upgrades** — signature capture, deposit toggle, up to 4 additional signers, product selections
6. **Terms & Conditions** — rich text or PDF upload, require customer acknowledgment toggle (turns blue when active)
7. **Warranty** — warranty start date, details, thank-you note, company signature
8. **Custom Pages** — PDF uploads, text pages with token auto-fill

**Layout Library:** Pre-configured template collections with filter/preview. Set default layout, copy/edit existing.

**Sending:** "Review and Share" generates PDF preview for e-signature or on-the-spot signing. Must be "Approved" or "Marked as Signed" to convert to Invoice/Work Order.

### What RoofLink Shows

**"3 Estimates in 3 Minutes"** — measurement-coupled system:
- Drawing a roof auto-generates estimate + material order + work order simultaneously
- "Work Doing" section with auto-populated line items from measurements
- Toggle categories: Work Doing, Work Not Doing, Supplements, Change Orders, Discounts, Upgrades
- **Real-time Gross Profit always visible** — material and labor costs displayed separately
- **Profit margin selector** shows commission impact for reps
- Up to **6 estimate options** per job with side-by-side comparison table
- "Set as Primary" required before ordering, "Export" compiles multi-page branded PDF
- Insurance-specific fields: proceeds input, recoverable depreciation, ACV auto-calculation, overhead/profit

### What StormLeads Currently Shows

- Rich multi-section editor with line items (description, qty, unit price, drag-and-drop)
- Bold/italic/underline/lists/links rich text editor
- Per-section image upload
- Tax rate + discounts + profit margin input
- Multi-signer authorization
- Financing options toggle (Hearth plan selection)
- Template system (save/load)
- Review mode with live preview
- Send for signing (email template selector)
- SRS Catalog material selection
- AI tier generation (Good/Better/Best) + tier comparison modal
- Server-side PDF generation (pdfmake branded PDF) — NEW
- Estimate-to-invoice conversion

### Specific Gaps to Close

| Gap | JN SumoQuote / RoofLink | StormLeads | Priority |
|-----|------------------------|------------|----------|
| Multi-page proposal (cover, intro, inspection photos, terms) | 8 page types with toggles | Single continuous builder | High |
| Token/merge field auto-fill | `{{ACCOUNT_NAME}}`, `{{ADDRESS}}` etc. | None | Medium |
| Inspection photo page with layout options | Multiple photo+description layouts | Per-section image only | Medium |
| Warranty page | Dedicated section with start date, signature | None | Low |
| 6 estimate options per job (RoofLink) | Side-by-side comparison table | Good/Better/Best (3 tiers) | Low — 3 tiers sufficient |
| Insurance-specific fields (RoofLink) | ACV, depreciation, proceeds, O&P | None | Medium — roofing-specific |
| Layout library with preview | Filter/preview template collections | Basic template list | Low |
| Profit margin slider (interactive) | Visual slider control | Text input field | Low — cosmetic |
| On-the-spot signing (in-person) | Sign immediately on screen | Email-only send | Medium |

### Recommended Improvements

1. **Add cover page to estimates** — allow uploading a hero photo (customer's home), company logo, and certification badges. This is SumoQuote's biggest visual differentiator.
2. **Add inspection photo page** — a dedicated section for before/after photos with descriptions, supporting StormLeads' existing photo annotation feature.
3. **Add token/merge fields** — auto-fill customer name, address, storm date, hail size into estimate text using `{{VARIABLE}}` syntax. Reduces manual entry.
4. **Add insurance-specific fields** — ACV, recoverable depreciation, insurance proceeds, overhead & profit. Critical for storm restoration contractors.
5. **Add in-person signing mode** — allow the customer to sign on-screen immediately (tablet/phone), not just via emailed link.

---

## 4. Content / Marketing (StormLeads vs Rooftops.ai)

### What Rooftops.ai Shows

**AI Creator Studio** — one of four primary navigation items (alongside Property Reports, Rooftops GPT, Dashboard, My Documents).

**Tool-Picker Grid (not a unified canvas):**
- Social Media Ads generator
- Landing Page Builder
- Cold Call Scripts
- Email Marketing
- Translate Anything (80+ languages)
- Legal Docs Creation
- Meeting Strategies
- Website Generator

**Additional features:**
- AI Social Media Manager — schedules posts across platforms, tracks engagement metrics
- Creator Library — identifies and mitigates negative social trends
- Each content type is its own generation module

**Design language:** Next.js framework. Dark/light mode toggle (localStorage-based, default light). Minimal marketing header (Sign In / Sign Up Free). Hero: "AI Roof Reports in 30 Seconds" with address search. Social proof strip: 4.9 rating, 2,000+ roofers, 15,000+ reports, 50 states. Technology badges: Google Maps, Solar API, Satellite Imagery, GPT-5.

**Pricing shift:** Legacy app was $12/month. New pricing: Pro $25/month, Business $84/month, AI Employee Pro $169/month (coming Q2 2026).

### What StormLeads Currently Shows

- Content Studio with Generate tab (type + tone dropdowns)
- 10 variable input fields (company, city, storm date, hail size, etc.)
- Batch mode (5 variations toggle)
- Live preview panel (Facebook, email, door hanger, blog mockups)
- Results grid with copy/save/delete
- Library tab with database-backed saved content (was localStorage, now DB-synced)
- Search + type filter in library

### Specific Gaps to Close

| Gap | Rooftops.ai | StormLeads | Priority |
|-----|-------------|------------|----------|
| Landing page builder | Generates full landing pages | None | Medium |
| Cold call scripts | AI-generated call scripts | None | Medium — easy to add as content type |
| Social media scheduling | Posts across platforms, tracks engagement | Generate only, no scheduling | Low ��� requires social API integrations |
| Multi-language translation | 80+ languages | None | Low |
| Website generator | AI-powered site builder | None | Low — different product |
| Legal document generation | Contracts, waivers, etc. | Contract templates exist (manual) | Low |

### Recommended Improvements

1. **Add "Cold Call Script" and "Landing Page" content types** — these are easy additions to the existing Content Studio generator with no new API costs.
2. **Add "Copy to Clipboard as HTML"** — for email content, let users copy formatted HTML directly to paste into their email client.
3. **Add content performance tracking** — simple: track which generated content was used (copied/sent) vs ignored, to improve generation quality.

---

## 5. Work Orders / Production (StormLeads vs RoofLink)

### What RoofLink Shows

RoofLink's core differentiator is a **linear, milestone-driven pipeline** — explicitly contrasted with kanban: "Most other CRMs have boards that customers manually move to and from, basically replicating digital post-it notes."

**7-Step Workflow (homepage tab-based interactive section):**
1. **Target** — territory mapping, storm-based leads, weather/radar data
2. **Measure** — satellite roof measurements (Hover/EagleView), auto-generates everything downstream
3. **Estimate** — auto-generated from measurements with real-time profit margin
4. **Approve** — back-office verification workflow
5. **Order** — automatic supplier POs to SRS Distribution (440+ locations), crew work order generation
6. **Install** — templated checklists, photo prompts, issue tracking
7. **Collect** — payment processing for retail and insurance jobs

**In-App Workflow:**
- Each job has a **vertical checklist** on the job profile page that IS the workflow
- Checklist items have different action types: scheduling (calendar picker), uploading (requires file/photo), checkbox (simple toggle), document creation (generates e-signable docs)
- Standard checklist: ~15 steps from "Send welcome email" through "Submit warranties / close out job"
- **Critical "hard stops"** — prevents advancement unless required photos (tear-off, underlayment, nail pattern) are uploaded and punch list checked off
- "If the photo isn't there, the rep doesn't get paid"
- Color indicator on completed items

**Crew Logins (~$30/mo):** Deliberately limited view — photos, notes, calendar, work orders only. No profit or material cost visibility.

**Production Scheduling:** Smart crew assignment based on availability. Calendar prevents double-booking. Real-time material delivery and crew status updates.

**SRS Distribution Integration:** One-click material ordering from approved bid to 440+ SRS locations. Instant order confirmation. Costs feed into profit calculations.

### What StormLeads Currently Shows

- 4-column kanban (Pending/Scheduled/In Progress/Completed) with drag-and-drop
- Cards with milestone progress bar (title, crew, date, address)
- Detail modal with full CRUD, all editable fields
- Milestone checklist (add/delete/toggle)
- Photo upload per milestone with camera badge + retake
- Photo-required enforcement (prevents completion without photo)
- Editable line items with running total
- 8 milestone templates (Shingle, Metal, Gutter, Siding, Storm Damage, Inspection, Flat Roof, Window/Door)
- Create from estimate (EstimatePicker modal)
- Team member assignment

### Specific Gaps to Close

| Gap | RoofLink | StormLeads | Priority |
|-----|----------|------------|----------|
| Auto-advance on checklist completion | Jobs advance automatically when steps done | Manual kanban drag | Medium |
| Action-typed checklist items | Schedule, upload, checkbox, document types | Simple toggle only | Medium |
| Hard stops blocking advancement | Cannot proceed without required photos | Photo-required enforcement exists | Already similar |
| Crew-limited view (no profit visibility) | $30/mo crew login with restricted data | Full access for all users | Medium |
| Material ordering from work order | One-click PO to SRS | SRS catalog browse only | High — but requires SRS API |
| Linear workflow visualization | Vertical step-by-step checklist | Kanban columns | Low — different paradigm, both valid |
| Auto-generated work orders from estimate | Measurement > estimate > WO > PO in one flow | Create from estimate (manual) | Medium |

### Recommended Improvements

1. **Add action-typed milestone items** — let milestones have types: "checkbox" (simple toggle), "photo required" (existing), "schedule" (opens date picker), "document" (generates/attaches a file). This makes the checklist smarter without abandoning kanban.
2. **Add crew role with limited visibility** — field crews shouldn't see profit margins or material costs. Add a "Crew" role that only shows work order details, photos, notes, and schedule.
3. **Auto-generate work order from approved estimate** — when an estimate is marked "Accepted", offer to auto-create a work order pre-populated with line items and the appropriate milestone template.

---

## 6. Dashboard / Reports (StormLeads vs JobNimbus + RoofLink)

### What JobNimbus Shows (Insights)

Six dashboard sections accessible via hamburger menu:

1. **Business Overview** — metric cards (Leads, Sold, Close Rate, Estimating Conversion), 4 graphs (Top 5 Lead Sources, Top 5 Sales Reps, Lead Flow year-over-year, Historical Sales year-over-year), drill-down on any data point
2. **Sales** — 5 sub-tabs: Leads/Close Rate, Estimating Conversion, Sales, Sales Pipeline (stage counts + outstanding estimate $), Sales Data (raw table with customizable columns via eye icon)
3. **Workflow** — Time in Stage cards showing average days per stage (Lead, Estimating, Sold, Production, A/R), clickable green numbers drill into contributing jobs
4. **Accounts Receivable** — outstanding invoices by status, overdue by 1-30/91+ days
5. **Completed Jobs** — bar charts by type/rep/source with scorecard tables, average revenue comparisons
6. **Profit Tracker** — 4 sub-tabs: Profitability Summary (planned vs actual gross/net margins, trended revenue), Profit & Loss (planned vs actual charts), Variance Analysis (by salesperson and job type), Sales & Commissions (profitability bar graph, commission payout tracking)

**Profit Tracker per Job:** Draggable metric cards (max 5 favorites), cost section with Material/Labor grouping, six-dot drag handles, blue link icons to source documents, commissions panel with payout status.

**Color:** Blues (#3968c6) and grays dominant. Card-based metric layout.

### What RoofLink Shows

**Widget-based, fully customizable grid:**
- Multiple reorderable/renamable groups (tabs): Sales Pipeline, Lead Generation, Production, Insurance, Job Closeout, Revenue, Leaderboard
- "Save as Template" duplicates dashboard configs to other roles
- Role-based templates for 6 role types (Sales Rep, Marketing Rep, Team Leader, RSM, Project Manager, Office/Admin)
- ~150 pre-built reports plus custom report builder
- Jobs untouched for 3/7 days trigger alert notifications

### What StormLeads Currently Shows

- 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with animated count-up
- Revenue goal progress bar (editable target, on-track/behind indicator)
- Pipeline conversion funnel chart (bar chart with stage progression)
- Mini storm map with active storms + live radar indicator
- Tasks due today with checkbox toggle
- Follow-ups section
- Activity feed with timestamps
- Team leaderboard (8-column table)
- Conversion by storm chart
- Estimate summary (accepted/pending/declined)
- A/R aging summary (5 buckets) — NEW
- Estimating conversion cards — NEW
- Filter dropdowns (Rep, Source, Period) + comparison period with trend arrows
- Reports page: revenue (area), pipeline (horizontal bar), conversion (radar), rep leaderboard, lead sources (donut), stage duration (line), date presets, custom range, CSV export, chart drill-down

### Specific Gaps to Close

| Gap | JobNimbus / RoofLink | StormLeads | Priority |
|-----|---------------------|------------|----------|
| Profit Tracker (planned vs actual) | Per-job cost tracking, variance analysis, commission payouts | Expenses + profit in LeadDetail only | High |
| Year-over-year comparison graphs | This year vs last year overlaid | Comparison period with deltas | Medium — extend comparison |
| Role-based dashboard templates | 6 role presets (RoofLink) | Same dashboard for all users | Low |
| Customizable widget grid | Drag-reorder, show/hide widgets | Fixed layout | Medium |
| Workflow time-in-stage analytics | Average days per stage with drill-down | Stage duration chart in Reports | Already similar |
| Commission tracking | Payout status, % of revenue/profit | None | Medium |
| Stale job alerts | 3/7-day untouched notifications | None | Medium — easy to add |

### Recommended Improvements

1. **Add Profit Tracker section** — show planned vs actual costs per job, with material/labor breakdown. Aggregate into profitability summary with gross/net margins by rep and job type. This is JobNimbus's newest premium feature.
2. **Add commission tracking** — per-rep commission rates, payout tracking, and commission as % of profit. Ties into the team leaderboard.
3. **Add stale lead alerts** — notify when leads haven't been touched in 3/7 days. RoofLink does this; easy to implement with existing notification system.
4. **Add customizable dashboard layout** — let users hide/show/reorder dashboard sections. RoofLink's widget grid and role-based templates are the gold standard.

---

## 7. AI Features (StormLeads vs JobNimbus + Rooftops.ai)

### What JobNimbus Shows

**AssistAI (AI Phone Receptionist):**
- Left sidebar with 4 tabs: Dashboard, Contacts, Logs, Settings
- Dashboard: Minutes Saved, Calls Answered, Appointments Booked, Booking Rate metrics
- Logs: data table with 7/14/30/60/90-day selector, column editor, CSV/JSON export
- Two agent types: Appointment Scheduler (books into JN calendar) and Message Taker
- Stats: 95%+ answer rate, $0.15/min, 50-70% faster lead-to-job time
- Cost: $298/agent/month

**Scout (Mobile AI Assistant, beta):**
- Voice or text input inside mobile app
- Performs real CRM actions: create/update jobs, contacts, tasks, estimates, invoices
- "Not just suggestions but actual execution" — differentiator vs chatbots

### What Rooftops.ai Shows

**AI Employees (coming Q2 2026, $169/mo):**
- Four named personas: Marcus (Sales), Aisha (Marketing), Elena (Estimating), Ryan (Insurance)
- 500 voice minutes, 1,000 SMS, 60-second lead response, unlimited follow-ups, crew scheduling, invoice generation, review requests
- Current chatbot available now with lead capture, custom branding, instant replies

**AI Roof Reports:**
- Google Maps explorer with address autocomplete
- Satellite view at 640x640 resolution with measuring tool
- Report sections: facet count, squares, roof area, ground area, pitch analysis, building details
- Five material buttons (Asphalt Shingles, Premium Asphalt, Clay Tile, Metal, Wood Shake)
- Solar analysis embedded: sunshine hours, panel counts, energy savings, 20-year financial projections

### What StormLeads Has

- Content Studio AI generation (10 content types with variable inputs)
- AI tier generation for estimates (Good/Better/Best)
- No AI assistant, no AI phone, no AI roof reports

### Recommended Improvements (cost-conscious)

1. **Add AI chat assistant (lightweight)** — use a cheap LLM (GPT-4o-mini at ~$0.0015/1K tokens) to answer questions about leads, generate follow-up emails, and summarize lead history. NOT phone answering (too expensive). Display as a chat panel in the sidebar.
2. **Add AI roof report from satellite** — use Google Solar API (free tier: 100 requests/month) to pull roof facet data, area, pitch. Display alongside lead detail. Rooftops.ai charges $25/mo for this; StormLeads can offer it free.
3. **Add voice-to-CRM notes** — use browser's Web Speech API (free, built into Chrome/Safari) to transcribe voice notes into lead activities. A lightweight version of JobNimbus Scout.

---

## 8. Canvassing (StormLeads vs HailTrace + RoofLink)

### What HailTrace Shows

**Pin/Marker System:**
- Row of customizable markers at bottom of screen in canvassing mode
- Markers dropped directly on rooftops in satellite view
- Each marker has status with color + icon:
  - Unknown/gray — auto-downloads resident contact info on drop
  - Yellow #1 — No Answer (first attempt)
  - Yellow #2 — No Answer (second attempt)
  - Custom: New Roof, Interested, Not Interested, etc.
- Status numbers auto-increment for repeat visits
- Tap marker > select new status > Save
- "Track Me" mode follows GPS (toggleable)
- Auto-enters satellite view and zooms to current location

**Contact Data Auto-Pull:** Tapping an Unknown marker on a rooftop auto-shows homeowner name, cell phone, email via "Heads-up Display" (HUD). Toggleable green=on, white=off. Expand button for full address marker view.

**Campaigns & Leaderboard:** Create campaigns with assigned territories. Leaderboard tracks: markers dropped, contact attempts, prospects contacted, leads generated, qualified leads, sales — all filterable by date range.

### What RoofLink Shows

- Google Maps with color-coded pins: green=approved, purple=prospect, orange=denied, blue=paid, gray=deleted
- Freehand polygon territory drawing with rep assignment, no overlap detection
- Clicking any house pulls **County Appraisal District data**: homeowner name, market value, sq ft, sale date, residency duration
- Weather overlay: hail diameter displayed **inside dots** (yellow/orange/red), wind speed (blue/white), tornado "T" markers
- Bulk email/SMS from map by ZIP code and lead status filter
- SalesRabbit bundle adds DataGrid AI buyer propensity scores (1-10)

### What StormLeads Currently Shows

- Google Maps with dark styling (hybrid view)
- Stats bar (Total doors, Interested, Scheduled)
- Drop Pin mode with crosshair cursor
- Bottom sheet modal (slide-up create/view)
- GPS coordinate display
- Outcome quick-select (6 options in 2-column grid)
- Notes textarea
- Convert to Lead button (interested/scheduled)
- Territory Manager: CRUD, PostGIS polygon drawing, color-coded, team assignment
- Marker click > view details

### Specific Gaps to Close

| Gap | HailTrace / RoofLink | StormLeads | Priority |
|-----|---------------------|------------|----------|
| Customizable pin status/colors | Multiple statuses per pin with custom colors | 6 fixed outcomes | Medium |
| Auto-increment visit tracking | Yellow #1, #2, etc. with repeat visit counting | None | Medium |
| Contact data auto-pull on pin drop | Homeowner name/phone/email (HailTrace) or CAD data (RoofLink) | GPS coordinates only | High — but requires paid data source |
| Canvassing campaigns | Named campaigns with territory assignment | Territory Manager exists | Low — similar concept |
| Canvassing leaderboard | Markers/contacts/leads/sales per rep | None in canvassing mode | Medium |
| Track Me GPS following | Auto-follow mode, toggleable | None | Medium |
| Hail size inside map dots (RoofLink) | Diameter number displayed in dot | Color gradient only | Medium |
| Bulk SMS from map | Filter by ZIP + status, bulk send | None (no SMS) | Blocked by SMS feature |

### Recommended Improvements

1. **Add customizable pin statuses** — let users create custom outcome types with colors and icons, replacing the fixed 6 outcomes. HailTrace's system is more flexible.
2. **Add visit counter per pin** — auto-increment "attempt #" when a pin's status changes to a follow-up type. Critical for door-knocking workflow.
3. **Add canvassing leaderboard** — show markers dropped, leads generated, and conversions per rep. Leverage existing team leaderboard pattern from Dashboard.
4. **Add GPS tracking mode** — "Track Me" that auto-follows the user's location on the canvassing map, with toggleable on/off.
5. **Display hail size in storm overlay dots** — when storm swaths are visible during canvassing, show the hail diameter inside the dots (RoofLink pattern).

---

## 9. Invoicing & Payments (StormLeads vs JobNimbus)

### What JobNimbus Shows

- One-click invoice generation from estimates (eliminates duplicate entry)
- **Billing Boards** — kanban-style view of completed jobs organized by payment status
- Automated invoice reminders for on-time collection
- **Text-to-Pay** — customer receives SMS, clicks link, opens secure green-themed payment page, enters credit card or ACH
- Engage texting interface: shared inbox, bubble conversation threads, compose area with 4 buttons (image attachment, templates, schedule, emoji picker), character counter (160 chars/credit)
- QuickBooks 2-way sync (Desktop and Online)
- Financing via Sunlight Financial with payment calculator

### What StormLeads Currently Shows

- Invoice list with KPI stats (Total Invoiced, Collected, Outstanding, Overdue)
- A/R aging summary (5 buckets)
- Filter tabs (All/Draft/Sent/Paid/Overdue)
- Invoice builder with line items (combobox, qty, unit price)
- Lead/customer selector with autocomplete
- Preview mode + send via email
- Record payment + void invoice
- Create from estimate (EstimatePicker)
- Stripe Card + ACH payments (free) on PublicEstimate page

### Specific Gaps

| Gap | JobNimbus | StormLeads | Priority |
|-----|-----------|------------|----------|
| Billing Board (kanban for payment status) | Dedicated payment-tracking board | Status filter tabs only | Low — filter tabs are sufficient |
| Text-to-Pay (SMS payment link) | SMS with secure payment link | Email-only payment requests | Blocked by SMS feature |
| Automated invoice reminders | Auto-send overdue reminders | None | High — easy to add with existing cron |
| QuickBooks sync | 2-way Desktop + Online | None | High — #1 missing integration |

### Recommended Improvements

1. **Add automated invoice reminders** — send email reminders at configurable intervals (3/7/14 days overdue). Use existing drip sequence cron infrastructure.
2. **Add QuickBooks Online sync** — QB API has a free tier for small apps. Push invoices and payments. This is the #1 most-requested missing integration across all roofing CRMs.

---

## 10. Overall Design Language Comparison

| Aspect | JobNimbus | HailTrace | RoofLink | Rooftops.ai | StormLeads |
|--------|-----------|-----------|----------|-------------|------------|
| **Primary Color** | Navy #152152 | Green #009344 | Navy blue | Dark (Next.js) | oklch dark-first |
| **Accent** | Blue #3968c6 | Dark #203431 | Amber #ffb606 | Gradient | oklch system |
| **Font** | Plus Jakarta Sans | Roboto | Inter + DM Sans | System | System |
| **Theme** | Light only | Dark nav + light content | Light | Light (dark toggle) | **Dark-first** |
| **Card Style** | White, subtle borders | White, 4px radius, minimal shadow | White, 20px shadow | Cards with toggle | **Glass (backdrop-filter)** |
| **Buttons** | Blue filled | Green #009344, 36px height | Dark #32373c, pill (9999px radius) | Standard | Glass buttons |
| **Icons** | Custom SVG | Minimal | Standard | Minimal | Lucide icons |
| **Layout** | Top nav | Left nav + map toolbar | Left sidebar + top nav | Top nav minimal | **Left sidebar (collapsible)** |
| **Mobile** | Bottom tab + floating action | Bottom tab bar | Mobile-first cards | Responsive web | Bottom tab bar |
| **Reviewer Verdict** | "Functional but dated" | "Easy to navigate" | "Clunky, unpolished" | No reviews yet | **Modern glass aesthetic** |

### StormLeads Design Advantage

StormLeads is the **only competitor using a modern dark-mode-first glassmorphism design language**. Every other competitor uses standard light-mode enterprise SaaS styling. This is a genuine visual differentiator that photographs well for marketing (dark UIs look premium in screenshots) and reduces eye strain for users working long hours.

**Key design principles to maintain:**
- oklch color system (avoids JobNimbus's "similar blues" problem)
- Glass card backgrounds (unique in the space)
- Dark mode first (no competitor offers this as default)
- Animated transitions (existing system with --transition-fast/normal/slow)

---

## 11. Mobile App Comparison

| Aspect | JobNimbus | HailTrace | RoofLink | Rooftops.ai | StormLeads |
|--------|-----------|-----------|----------|-------------|------------|
| **Platform** | Native iOS + Android | Native iOS + Android | Native iOS + Android | Web only | **Web only (PWA)** |
| **Rating** | 4.8/5 (5000+ reviews) | 4.8/5 (5000+ reviews) | 4.1/5 (39 ratings) | N/A | N/A |
| **Offline** | None (blank screen) | Unknown | Unknown | N/A | None |
| **Key Strength** | Voice search, quick-action FAB | Storm map on mobile | Mobile-first sales flow | N/A | Responsive layout |
| **Key Weakness** | Crashes, lag, slow sync | Not a CRM | "Not as polished" | N/A | Not a native app |

**Insight:** Mobile reliability is the #1 complaint across ALL competitors. JobNimbus has the best-rated app but users still report crashes and no offline mode. StormLeads' PWA approach could leapfrog native apps if it focuses on reliability and offline capability.

---

## 12. Job Detail View (StormLeads vs JobNimbus)

### What JobNimbus Shows (New Jobs Experience)

**Header:** Job name + primary contact (name, phone, email) with quick-action buttons for creating financial docs, notes, emails, tasks, text messages. Three-dot menu for admin options.

**Right Sidebar — Job Details Panel:**
- Cover photo upload area
- Address with directions/copy/edit
- Job overview with custom fields toggle
- Status indicators: current status, days in status, job type, lead source, assigned users, sales rep, subcontractors
- Tags section
- Related contacts with "Primary Contact" tag

**Left Navigation (12+ tabs):**
Dashboard, Activity (chronological with search/filter), Fields, Tasks, Photos (with descriptions + @user comments), Documents (bulk download), Estimates, Material & Work Orders, Payments & Invoices, Profit Tracker, Forms, Custom Documents

### What StormLeads Shows (LeadDetail)

StormLeads' LeadDetail (~2,922 lines) is actually MORE comprehensive than JobNimbus in many areas:
- Lead scoring (7-factor algorithm with breakdown popup)
- Financing section (Hearth integration)
- Contracts section
- Expenses/profit tracking
- Weather/storm history with PDF export
- Roof measurement tools (drawing + manual)
- Census demographics
- FEMA disaster declarations
- Skip trace
- Custom fields
- Review request generation
- Client status page link

### Gap: StormLeads LeadDetail lacks

| Missing vs JobNimbus | Priority |
|---------------------|----------|
| Cover photo upload | Low |
| @user mentions in photo comments | Medium |
| Bulk document download | Low |
| Profit Tracker with planned vs actual | Medium |

---

## Summary: Top 10 Actionable UI Improvements (Prioritized)

| # | Improvement | Benchmark | Effort | Impact |
|---|------------|-----------|--------|--------|
| 1 | **Pipeline card sidebar preview** | JobNimbus board sidebar | Medium | High — keeps users in flow |
| 2 | **More swath color stops (8-10 levels)** | HailTrace 10-level graduation | Low | High — matches industry standard |
| 3 | **Estimate cover page + inspection photos** | SumoQuote multi-page proposals | Medium | High — professional perception |
| 4 | **Automated invoice reminders** | JobNimbus auto-reminders | Low | High — direct revenue impact |
| 5 | **Storm severity star rating** | HailTrace 1-5 stars | Low | Medium — quick scanning |
| 6 | **Multi-date swath overlay** | HailTrace Honey Hole workflow | Medium | Medium — power user feature |
| 7 | **Customizable canvassing pin statuses** | HailTrace custom markers | Medium | Medium — field workflow |
| 8 | **Profit Tracker (planned vs actual)** | JobNimbus Profit Tracker | High | Medium — premium feature |
| 9 | **AI roof report from Google Solar API** | Rooftops.ai satellite reports | Medium | Medium — free differentiator |
| 10 | **In-person estimate signing** | SumoQuote on-the-spot signing | Low | Medium — field convenience |

---

*Sources: hailtrace.com, jobnimbus.com, rooflink.com, rooftops.ai, help.hailtrace.com, support.jobnimbus.com, sumoquote.com, Capterra, G2, App Store, SPOTIO integration docs, Knockbase integration docs, Connecteam reviews, Hook Agency comparisons, YouTube tutorials (2025-2026), SalesRabbit/Roofle acquisition docs, ProLine comparison articles*
