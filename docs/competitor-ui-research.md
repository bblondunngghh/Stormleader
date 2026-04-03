# Competitor UI Research — Visual Patterns & Actionable Gaps

**Date:** 2026-04-03 (comprehensive refresh — 50+ pages scraped via Firecrawl across 5 parallel research agents)
**Method:** Firecrawl scraping of competitor websites, help centers, review sites (Capterra, G2, Software Advice, Connecteam), training video transcripts, and marketing pages.
**Companion doc:** `docs/competitor-gap-analysis.md` (text/feature/pricing analysis — not duplicated here)

---

## 1. Storm Map (compare to HailTrace)

### What HailTrace Shows

HailTrace's entire product revolves around a single interactive map view with four toggleable data layers:

1. **Meteorologist Hail Maps** — hand-drawn in real-time from dual-pol radar by 15+ in-house meteorologists
2. **Algorithm Hail Maps** — computer-generated, meteorologist quality-controlled
3. **Wind Speed Maps** — 58 MPH+ severe wind zones
4. **Tornado Path Maps** — with EF rankings (EF0-EF5)

Plus two supplemental overlay types:
- **NOAA Report icons** — darker icons on the map; hovering shows NWS data
- **Social media/camera icons** — photos of actual hail placed at GPS locations from public posts

**Storm swath color system:** Colors graduate from light/pale (smaller hail, less damage) to dark/intense (severe impact, larger hail). They also use a unique **hatched cross-hatch pattern** overlay for "isolated" hail swaths — HailTrace claims to be the only platform with this visual distinction.

**Star rating system (1-5):**
- 1-star = small storm, few properties
- 5-star = major event, huge property count
- Factors: number of properties impacted, maximum hail size, probability of damage

**Three ways to find storms:**
1. **Recent events list** — Maps tab shows latest storms chronologically
2. **Calendar picker** — Select year > month > day to find storms on specific dates
3. **Radius search with filters** — Set a search radius, filter by hail size range, wind speed, tornado EF, or star level. Moving the map recenters the radius.

**Honey Hole Finder:** This is NOT a separate tool or screen. It's the practice of **overlaying multiple storm swaths from different dates** on the same map view. Where swaths overlap = areas hit by multiple storms = higher damage probability ("honey holes"). Their FAQ states: "you can load multiple swaths on your screen to see exactly where several storms have hit a certain area."

**Property popups:** Clicking a property marker shows homeowner contact data (name, cell, email) — contact data comes from Cole Information, updated quarterly. An "unknown/gray marker" in canvassing mode auto-downloads this data via a heads-up display popup.

**Layer controls:** Toggle panel for each of the 4 data layers + NOAA reports + social media photos. Simple on/off switches per layer.

**Navigation:** Browser app has Maps tab, Assets tab, plus controls on the map page (Filters, Calendar, Layers, Settings gear, Saved events). Mobile app: Map tab, Canvassing tab, Assets tab, More tab at the bottom.

### What StormLeads Currently Shows

- Google Maps with storm swath polygons (hail, wind, tornado, thunderstorm layers)
- Swath transparency slider (0-100% opacity)
- Layer toggle panel for 6 layers (hail/wind/tornado/thunderstorm/drift/properties)
- FEMA National Structure Inventory overlay with property points
- Supercluster property clustering for performance
- Honey Hole heatmap overlay (NOAA SWDI historical hail data circles)
- Property popup with "Add to Pipeline" button
- Storm feed panel with lead cards
- Time range filter (24h/3d/7d/14d/30d)
- Address search bar, terrain toggle, zoom indicator

### Specific Gaps to Close

| Gap | HailTrace | StormLeads | Priority |
|-----|-----------|------------|----------|
| Swath color graduation by severity | Light-to-dark color scale + cross-hatch for isolated | Single color per type | **High** |
| Star rating on storms | 1-5 stars based on impact/size/probability | 5-star severity in Storm Archive only, not on map | Medium |
| Calendar picker for historical storms | Year > Month > Day navigation | Time range filter (24h-30d) only | **High** |
| Radius search with filters | Set radius, filter by hail size/wind/EF/stars | No radius search | Medium |
| Multi-swath overlay for honey holes | Load multiple date swaths simultaneously | Heatmap circles only (NOAA SWDI) | Low |
| Social media photo overlay | GPS-located hail photos from social | None | Low |
| Property contact data in popup | Name, cell, email from Cole Information | FEMA building data only | **High** (but requires paid data source) |

### Recommended Improvements

1. **Swath color graduation** — Implement a 3-5 step color scale per swath type (e.g., hail: green > yellow > orange > red > dark red based on size). This is the single biggest visual gap vs HailTrace.
2. **Storm calendar picker** — Add a date picker control to the map that loads storms for a specific date. Currently limited to rolling 30-day window.
3. **Star rating badges on map swaths** — Port the existing severity calculation from StormCatalog to the map view, show as a badge on each swath polygon.
4. **"Generate Canvassing List" stub** — Connect the existing stub button (StormMap.jsx ~line 2670) to actually create canvassing pins from properties in the current swath.

---

## 2. Canvassing (compare to HailTrace + RoofLink)

### What HailTrace Shows (Enterprise tier)

- Entering canvassing mode switches to **satellite view** and zooms to current GPS location
- A **bottom row of customizable status markers** appears (color-coded pins)
- Tap a marker type to select it, then tap a rooftop to drop it
- **Unknown/gray marker** auto-downloads homeowner contact data (name, cell, email) via a "heads-up display" popup
- Yellow markers with numbers (#1, #2) track sequential contact attempts
- Status colors and icons are **fully customizable** via browser account settings
- "Track Me" mode follows GPS location (toggleable)
- Notes can be attached to any marker with full history
- **Leaderboard** shows team stats: markers dropped, contact attempts, prospects contacted, leads, qualified leads, sales — filterable by date range
- Pin drop is GPS-verified within 50 feet of property

### What RoofLink Shows

- Google Maps base with **color-coded dots**: green (approved), purple (prospects), orange (denied), blue (paid/happy), gray (dead)
- Legend accessible on map
- **Freehand polygon drawing** for territory assignment
- County boundary overlay toggle for permit tracking
- Weather cloud button shows NOAA/NWS data: yellow/orange/red for hail (diameter inside dot), blue/white for wind (starts at 58mph), "T" for tornadoes
- 3-5 years historical data, steppable through time
- **CAD data on click**: homeowner name, market value, square footage, sale date

### What StormLeads Currently Shows

- Google Maps with dark styling (hybrid view)
- Stats bar (Total doors, Interested, Scheduled) in glass card overlay
- Drop Pin mode with crosshair cursor
- Bottom sheet modal for create/view with outcome quick-select (6 options)
- GPS coordinate display, notes textarea
- Convert to Lead button for interested/scheduled pins
- Territory Manager panel (toggle visibility)
- Toast notifications

### Specific Gaps to Close

| Gap | Competitors | StormLeads | Priority |
|-----|------------|------------|----------|
| Customizable pin colors/icons per status | Both have full customization | Fixed 6 outcomes | Medium |
| Sequential contact attempt tracking | HailTrace: numbered yellow markers | No attempt tracking | Medium |
| Canvassing leaderboard | HailTrace: full team stats by date | No leaderboard in canvassing view | Low |
| Property data on pin click | RoofLink: CAD data (owner, value, sqft) | GPS + address only | **High** (requires paid data) |
| County boundary overlay | RoofLink: toggle for permit tracking | Not available | Low |
| Storm data overlay on canvassing map | RoofLink: NOAA hail/wind/tornado data | Canvassing and storm map are separate views | **High** |

### Recommended Improvements

1. **Storm swath overlay in canvassing view** — Show storm swath polygons on the canvassing map so reps can see damage zones while canvassing. Currently these are entirely separate views.
2. **Customizable pin statuses** — Allow users to define their own outcome types with custom colors (Settings > Canvassing tab). Currently hardcoded to 6 options.
3. **Contact attempt counter** — Add an attempt count to each pin that increments automatically when status changes, showing "#1", "#2" badges.

---

## 3. Pipeline/CRM (compare to JobNimbus + RoofLink)

### What JobNimbus Shows

JobNimbus uses **top navigation** (not a sidebar) — unusual for modern SaaS. Menu items: Home, Contacts, Jobs, Calendar, Boards, Insights.

**Three separate board types** using the same kanban interface:
1. **Sales Boards** — stages like New Inquiry > Estimate Sent > Signed Contract > Job Won. Shows estimated totals per column.
2. **Production Boards** — tracks jobs through Material Order > Scheduled > In Production > Complete. Shows "where they're getting stuck."
3. **Billing Boards** — tracks completed jobs through payment collection.

Each card connects to a full "job folder" with photos, notes, documents, timelines. The canonical stage flow is: Lead > Estimating > Sold > Production > A/R > Completed.

**Cards show:** Contact name, address, job type, estimated value. Draggable across stages. Column headers show stage totals.

### What RoofLink Shows

RoofLink's core UX is fundamentally different: a **vertical checklist per job** rather than a kanban board. They explicitly call competitors' kanban boards "digital post-it notes."

Each job has ~15 sequential checklist steps with different action types:
- Scheduling steps, upload steps, checkbox steps, document creation steps
- Steps change color when completed
- **"Hard stops"** prevent advancement without required photos/checklist items
- Each step can trigger automated emails/SMS to homeowners
- Milestone completion drives automatic pipeline advancement

### What StormLeads Currently Shows

- Kanban board with HTML5 drag-and-drop, optimistic updates
- 3 board tabs (Sales/Production/Billing) — **already matches JobNimbus's 3-board pattern**
- Lead cards with: contact info, priority badges with pulse animation, days-in-stage badges (color-coded green/gray/amber/red), lead score badges (80+/60+/40+ thresholds), source labels, task progress badges
- Conversion rate between columns (color-coded percentages)
- Column collapse toggle (persisted to localStorage)
- Priority/Source/Rep filter dropdowns with active filter pills
- Mobile list view with priority dots, days-in-stage, deal value
- Create Lead button, lead detail panel (lazy-loaded)

### Specific Gaps to Close

| Gap | Competitors | StormLeads | Priority |
|-----|------------|------------|----------|
| Column revenue totals | JobNimbus: estimated totals per stage column | No revenue per column | **High** |
| Deal value on cards | JobNimbus: estimated value on each card | Not shown on pipeline cards | **High** |
| Checklist-driven advancement | RoofLink: milestone completion auto-advances stage | Manual drag only | Medium |
| Card count per column | JobNimbus: shows count in header | Not shown | Medium |

### Recommended Improvements

1. **Show estimated_value on pipeline cards** — Add deal value display to each card. Flagged in overnight resume as a priority.
2. **Column revenue totals** — Sum estimated_value per stage and show in column header (e.g., "Estimate Sent ($45,200 - 12 leads)").
3. **Card count badges in column headers** — Show lead count next to stage name.
4. **Auto-advance on milestone completion** — When all required milestones on a work order are completed, optionally auto-advance the lead to the next pipeline stage.

---

## 4. Estimates (compare to JobNimbus SumoQuote + RoofLink)

### What JobNimbus/SumoQuote Shows

A **multi-page document builder**, not just a line-item form:
- **Toggleable pages** (drag-reorderable): Cover Page, Introduction, Inspection Photos, Estimate Details, Signing & Upgrades, Terms, Warranty, Custom Pages
- Each page can be toggled on/off and reordered
- **Estimate Details** supports up to 3 tabs for good/better/best pricing or multi-trade
- Line items sync from a Products and Services catalog with drag-and-drop reorder
- **Profit margin slider** — visual slider control for margin percentage
- Tax rate, discount, and total override options
- Generates a **branded PDF** with company logo, property photo, certifications
- Templates and Layouts are saveable for reuse
- eSigning for remote deal closing, financing calculator integration

### What RoofLink Shows

- **"3 Estimates in 3 Minutes"** — Good/Better/Best model
- Up to **6 estimate options per job**, renamable (not just 3 tiers)
- **Side-by-side comparison table** with toggleable columns: Work Doing / Not Doing / Supplements / Change Orders / Discounts / Upgrades
- Expandable "[x] More Items" row when >3 line items per section
- **Real-time Gross Profit calculator** with profit margin selector
- One-click PDF export with cover page, per-estimate pages, and comparison summary page
- "Set as Primary" required before material/work orders can be submitted
- Applying a roof template auto-generates estimate + material order + work order simultaneously

### What StormLeads Currently Shows

- Estimate list with KPI stats (Total, Draft, Sent, Accepted counts/values)
- Rich multi-section editor with line items (description, qty, unit price)
- Drag-and-drop line item reorder
- Rich text editor (bold, italic, underline, lists, links)
- Section image uploader, tax rate dropdown, discounts management
- Multi-signer support, financing options toggle (Hearth)
- Template system (save/load), review mode with live preview
- Send for signing modal with email template selector
- SRS Catalog material selection
- AI tier generation (Good/Better/Best) with comparison modal
- Estimate-to-invoice conversion, duplicate estimate

### Specific Gaps to Close

| Gap | Competitors | StormLeads | Priority |
|-----|------------|------------|----------|
| Multi-page document builder | SumoQuote: Cover, Intro, Photos, Details, Terms, Warranty pages | Single continuous form | Medium |
| Profit margin slider | Both: visual slider with real-time margin calculation | Text field input | Medium |
| Side-by-side tier comparison | RoofLink: toggleable column comparison table | Modal-based comparison | Medium |
| Branded PDF generation | SumoQuote: professional PDF with logo, property photo | Live preview only (no server-side PDF) | **High** |
| Up to 6 estimate options | RoofLink: 6 renamable options per job | 3 AI-generated tiers | Low |
| Auto-generate work order from estimate | RoofLink: template -> estimate + material order + WO | Manual creation from estimate | Medium |

### Recommended Improvements

1. **Server-side PDF generation** — Use pdfmake or Puppeteer to generate branded PDF estimates with company logo, cover page, and professional formatting. Flagged in overnight resume.
2. **Profit margin slider** — Replace the text input with a visual slider that shows margin % and dollar amount in real-time.
3. **Side-by-side tier comparison view** — Enhance the existing tier comparison modal to show a table with toggleable columns (like RoofLink's Work Doing / Not Doing / Supplements / Discounts layout).

---

## 5. Content/Marketing (compare to Rooftops.ai)

### What Rooftops.ai Shows

**Design system:** Emerald-to-cyan gradient (#10B981 to #06B6D4) as primary accent. Inter font, extra-bold headings. White background with dark navy contrast panels. Full-viewport satellite map hero with floating address input card.

**Creator Studio (legacy.rooftops.ai — publicly accessible):**
- "Most Popular" section with 2 featured cards (dark gradient backgrounds)
- "Creator Library" section with horizontal scrolling card grid (9 tools)
- "Coming Soon" section with teal badges (5 upcoming tools)
- Each card: white background, colored icon circle, status badge (FREE/PREMIUM/COMING SOON)

**Content generation UI pattern (Social Media Ads, Landing Page Builder):**
- **Two-column split: form on left, live preview on right**
- Form fields: language dropdown, audience multi-select, platform dropdown, tone dropdown, text length slider, free-text prompt area, Generate button
- Preview: realistic social media post mockup (Facebook chrome with engagement bar, share buttons)
- Unsplash image integration below the preview

**AI Employees (coming soon, $199/mo):**
- **Marcus** (Sales) — Teal avatar
- **Aisha** (Marketing) — Orange/amber avatar
- **Elena** (Estimating) — Green avatar
- **Ryan** (Insurance) — Pink/rose avatar
- Stacked card UI with colored initial avatars, sparkle icons, offset overlap effect

**Roof report data tabs:** 7 tabs — Roof Size, Roof Slope, Total Squares, Building Details, Solar Hours, Cost of Solar, AI Insights. Export PDF + "Ask AI" buttons on report panel.

### What StormLeads Currently Shows

- Content Studio with Generate tab (type + tone dropdowns)
- 10 variable input fields (company, city, state, storm date, hail size, service, phone, website, customer name, season)
- Batch mode (5 variations) toggle
- Live preview panel with Facebook, email, door hanger, blog mockups
- Results grid with copy/save/delete actions (card-based)
- Library tab with saved content (localStorage persistence)
- Search + type filter in library

### Specific Gaps to Close

| Gap | Rooftops.ai | StormLeads | Priority |
|-----|-------------|------------|----------|
| Two-column form/preview split | Side-by-side real-time | Sequential (generate then preview) | Medium |
| Platform-specific mockups | Facebook chrome, Instagram frame, email template | Generic mockups | Low |
| Unsplash image integration | Built-in stock photo search | No image integration | Medium |
| Language/audience targeting | Language dropdown, audience multi-select | No audience targeting | Low |
| AI assistant chat | "Rooftops GPT" for contractor questions | No chat interface | Medium |
| Content saved to cloud | Server-persisted | localStorage only (device-specific) | **High** |

### Recommended Improvements

1. **Persist content to database** — Move saved content from localStorage to the database so it syncs across devices. This is a real data loss risk.
2. **Two-column layout on desktop** — Show the form and preview side-by-side on wider screens instead of sequentially.
3. **Stock image integration** — Add Unsplash/Pexels free image search to content generation for ad visuals.

---

## 6. Work Orders/Production (compare to RoofLink)

### What RoofLink Shows

RoofLink's 7-step workflow (Target > Measure > Estimate > Approve > Order > Install > Collect) is visualized on their marketing site as numbered sections with monochrome icons (crosshair, ruler, calculator, checkmark, clipboard, wrench, dollar sign).

**In-app, the core interaction is a vertical job checklist:**
- Each job has ~15 sequential checklist steps with different action types
- Steps change color when completed (gray -> green progression)
- **"Hard stops"** prevent advancement without required photos/checklist items
- Each step can trigger automated emails/SMS to homeowners
- Contextual hints appear after each action

**Production pipeline:**
- Jobs enter production queue automatically upon approval
- Work orders auto-generated from measurement data, separated by trade
- Smart scheduling with availability checking
- **Photo verification** at tear-off, underlayment, and nail pattern stages — required before marking complete

**Material ordering:**
- One-click from estimate to supplier PO (SRS Distribution direct integration)
- Auto-calculated material quantities from roof measurement
- Crew work order auto-generation

### What StormLeads Currently Shows

- 4-column kanban (Pending/Scheduled/In Progress/Completed) with drag-and-drop
- Work order cards with milestone progress bar (title, crew, date, address)
- Detail modal with all editable fields
- Milestone system with add/delete/toggle milestones
- Photo upload per milestone with camera badge, retake capability
- **Photo-required milestone enforcement** — prevents completion without photo (matches RoofLink's "hard stops")
- Milestone templates (8 job types: Shingle, Metal, Gutter, Siding, Storm Damage, Inspection, Flat Roof, Window/Door)
- Create from estimate, team member assignment, date/time pickers

### Specific Gaps to Close

| Gap | RoofLink | StormLeads | Priority |
|-----|----------|------------|----------|
| Auto-advance pipeline on milestone completion | Checklist completion drives pipeline stage | Manual pipeline updates | Medium |
| Auto-generate work order from estimate | Template -> estimate + material order + WO simultaneously | Manual "Create from estimate" | Medium |
| Trade-separated work orders | Separate WOs per trade (roofing, gutters, siding) | Single WO per job | Low |
| Smart scheduling with availability | Checks crew availability before scheduling | Manual date picking | Medium |
| Automated homeowner notifications per step | SMS/email on each milestone | No automatic notifications | **High** |
| Material auto-calculation from measurement | Roof drawing -> material quantities | SRS catalog selection (manual) | Medium |

### Recommended Improvements

1. **Automated homeowner status notifications** — When a milestone is completed (especially photo-required ones like tear-off, underlayment, install), automatically send an email/SMS to the homeowner via the Client Status Page link. This builds trust and reduces "where are you?" calls.
2. **Auto-advance pipeline** — Add an option in Settings where completing all milestones on a work order automatically moves the lead to the next pipeline stage.
3. **Create work order + material order from estimate** — When creating a work order from an estimate, offer to also create a material order pre-populated with the estimate's line items.

---

## 7. Dashboard/Reports (compare to JobNimbus + RoofLink)

### What JobNimbus Shows

**Home page:** 3 default widgets (My Tasks, Jobs, Contacts) with a "Customize" button to add/remove widgets.

**Insights dashboard — 6 major sections:**

1. **Business Overview**: 4 stat cards (Leads, Sold, Close Rate, Estimating Conversion) + 4 charts (Top 5 Lead Sources, Top 5 Sales Reps, Lead Flow YoY, Historical Sales YoY). Filterable by Sales Rep, Lead Source, Job Type.
2. **Sales** (5 sub-tabs): Leads/Close Rate, Estimating Conversion, Sales Leaderboard, Sales Pipeline by Stage, Raw Sales Data
3. **Workflow**: Days in Stage cards per stage, Time in Stage by Sales Rep/Job Type tables
4. **Accounts Receivable**: Outstanding invoices by status, overdue by date range
5. **Completed**: Charts by Job Type, Sales Rep, Lead Source
6. **Profit Tracker**: Profitability Summary, P&L statement, Variance Analysis, Sales & Commissions with Planned vs Actual Gross/Net margins

**Key UX detail:** Users describe the Insights section as "AWFUL" — too many tabs, hard to find specific data. This is an opportunity for StormLeads to do it better with a single-page dashboard.

### What RoofLink Shows

- **Widget-based dashboard** with multiple tab groups across the top
- Groups are reorderable, renamable, and addable via gear icons
- **"Save as Template"** to duplicate dashboards across roles (Sales Rep, PM, RSM, Admin)
- Sections: Sales Pipeline, Lead Generation, Production, Insurance, Job Closeout, Revenue, Leaderboard
- Two UI modes: standard checklist-driven view and "boxy style" with Nearby Jobs, Recently Accessed, Star Jobs

### What StormLeads Currently Shows

- Welcome greeting + user name
- 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with animated count-up
- Revenue goal progress bar (editable target, on-track/behind indicator)
- Pipeline conversion funnel chart (bar chart)
- Mini storm map with live radar indicator
- Tasks due today (checkbox-enabled)
- Follow-ups section, activity feed with timestamps
- Team leaderboard (8 columns, clickable rows)
- Conversion by storm chart, estimate summary (accepted/pending/declined with dollar values)
- Filter dropdowns (Rep, Source, Period) with CustomSelect
- Loading skeletons, comparison period data with delta badges

**Reports page (separate):**
- Revenue chart (area, estimated vs actual with comparison)
- Pipeline chart (horizontal bar, drill-down to leads)
- Conversion chart (radar, rates by source)
- Rep leaderboard (sortable), lead sources pie chart (donut, drill-down)
- Stage duration chart (line)
- Date presets + custom range, comparison toggle, CSV export on all charts

### Specific Gaps to Close

| Gap | Competitors | StormLeads | Priority |
|-----|------------|------------|----------|
| Accounts receivable summary | JobNimbus: outstanding by status, overdue by range | Not on dashboard (on Invoices page) | Medium |
| Role-based dashboard templates | RoofLink: Save as Template per role | Single dashboard for all users | Low |
| Estimating conversion rate | JobNimbus: dedicated stat card | Not a dedicated metric | Medium |
| Year-over-year comparisons | JobNimbus: Lead Flow YoY, Historical Sales YoY | Comparison period deltas but not YoY charts | Low |
| Profit Tracker on dashboard | JobNimbus: P&L, Variance, Commissions | Per-lead expense summary only | Medium |

### Recommended Improvements

1. **A/R aging mini-card on dashboard** — Add a small summary card showing Outstanding/Overdue invoice totals, linking to the Invoices page. Sales managers check this daily.
2. **Estimating conversion stat card** — Add "Estimates Sent -> Accepted" conversion rate as a 5th KPI card (or replace Avg Days to Close, which is less actionable).
3. **Profit summary on dashboard** — Show total revenue vs total expenses vs profit for the selected period. Currently this data exists per-lead but isn't aggregated.

---

## 8. Measurement & Roof Reports (compare to Rooftops.ai + RoofLink)

### What Rooftops.ai Shows

- Satellite-powered roof reports from any address for $12/month (300 reports)
- **7 data tabs**: Roof Size, Roof Slope, Total Squares, Building Details, Solar Hours, Cost of Solar, AI Insights
- Facet counts and segment analysis, pitch/slope analysis (e.g., 5/12)
- Square footage calculation in 100 sqft units
- Solar panel capacity/count, energy savings
- Export PDF + "Ask AI" buttons on report panel
- Margin of error: up to 15% vs final measurements

### What RoofLink Shows

- **Built-in satellite measurement tool** (unlimited, no per-report fee)
- Drawing tools: building outline, ridges, valleys, pitch shield, two-story, eave/rake, ridge vent, flashing, gutters
- Searchable accessory library ("accessory Google") for components
- Auto-calculates everything from ice and water shield to nails while drawing
- Applying a **roof template** auto-generates estimate + material order + work order simultaneously

### What StormLeads Currently Shows

- Roof measurement tools in LeadDetail (drawing, manual entry)
- Solar potential analysis
- FEMA property data (building type, foundation, occupancy)

### Recommended Improvements

1. **Connect roof measurement to estimate** — When a roof measurement is completed (drawing or manual entry), offer to auto-populate an estimate with square footage and material quantities from the SRS catalog.
2. **Roof template presets** — Create templates for common roof types (hip, gable, flat) with pre-set measurement multipliers for waste factor, ridge, valley, etc.

---

## 9. Cross-Cutting UI Patterns from Review Sites

### What Users Love (ensure StormLeads has these)

From Capterra, G2, Software Advice, and Connecteam reviews:

1. **Color-coded kanban boards with drag-and-drop** — StormLeads has this
2. **Real-time dashboard with revenue/pipeline stats** — StormLeads has this
3. **Global search / quick actions** — StormLeads has Cmd-K
4. **Good/Better/Best estimate tiers** — StormLeads has AI tier generation
5. **Map-based territory management with storm overlays** — StormLeads has both but separately

### What Users Hate (avoid these patterns)

1. **JobNimbus top-bar navigation** — described as unintuitive; users prefer sidebar. StormLeads uses sidebar.
2. **JobNimbus Insights** — "AWFUL", too many nested tabs. StormLeads's single-page dashboard avoids this.
3. **Complex pricing with hidden costs** — JobNimbus: base + per-user + per-feature add-ons confuse buyers. StormLeads's flat pricing is a differentiator.
4. **Mandatory integrations for basic features** — CompanyCam, EagleView add $19-45/user/month. StormLeads's built-in features avoid this.
5. **No offline mode** — every major CRM is criticized for requiring internet. Consider PWA offline caching.
6. **2000-photo limit** — JobNimbus caps document storage. StormLeads should ensure generous limits.

### Gaps No Competitor Fills (StormLeads opportunities)

1. **Modern dark-mode-first design** — Zero competitors have this. StormLeads's glassmorphism/oklch design system is genuinely unique in the industry.
2. **Storm data built into CRM workflow** — Everyone else requires a separate HailTrace subscription ($83-200+/mo).
3. **Route planning on map** — Explicitly requested by users in reviews, no competitor offers it. Add optimized canvassing routes.
4. **In-CRM team communication** — No competitor has built-in team chat/messaging.
5. **Affordable all-in-one pricing** — Most competitors charge $120-673+/month per user. StormLeads at $29-149/mo flat is uniquely positioned.

---

## 10. Priority Action Items (Ranked)

### Tier 1 — High Impact, Achievable Now

1. **Pipeline deal values + column totals** — Show estimated_value on cards and sum per column. Pure frontend change. (Gap vs JobNimbus)
2. **Swath color graduation** — 3-5 step color scale based on hail size/wind speed. Visual parity with HailTrace's core differentiator. (Frontend map change)
3. **Server-side PDF estimates** — Generate branded PDFs with company logo and cover page. (Backend + pdfmake library)
4. **Storm swath overlay in canvassing view** — Merge storm data into the canvassing map view. (Frontend integration)
5. **Persist content to database** — Move Content Studio from localStorage to DB. Prevents data loss. (Backend + frontend change)

### Tier 2 — Medium Impact, Moderate Effort

6. **Storm calendar picker on map** — Date picker to load storms for specific dates beyond the 30-day window.
7. **Automated homeowner notifications on milestones** — Email/SMS when work order milestones complete.
8. **Profit margin slider on estimates** — Replace text input with visual slider.
9. **A/R aging summary on dashboard** — Mini-card with outstanding/overdue totals.
10. **Auto-advance pipeline on milestone completion** — Optional setting to advance stage when all WO milestones done.

### Tier 3 — Lower Priority, Nice-to-Have

11. **Customizable canvassing pin statuses** — User-defined outcomes with custom colors.
12. **Side-by-side tier comparison table** — Enhanced estimate comparison view.
13. **Route planning for canvassing** — Optimized door-knock routing (no competitor has this).
14. **Estimating conversion stat card** — Dashboard KPI for estimate acceptance rate.
15. **Two-column Content Studio layout** — Side-by-side form and preview on desktop.

---

## Appendix: Raw Data Sources

### HailTrace
- Dashboard image: `https://cdn.hailtrace.com/images/home/dashboards.png`
- Hail Maps image: `https://cdn.hailtrace.com/images/home/hail-maps.png`
- Customization image: `https://cdn.hailtrace.com/images/home/flexibility.png`
- Full report: `.firecrawl/hailtrace-research/HAILTRACE-UI-REPORT.md`

### Rooftops.ai
- 29 image/screenshot URLs cataloged in `.firecrawl/rooftops-research/ROOFTOPS_AI_UI_REPORT.md`
- Key GIF animations of roof measurement, instant estimate, and social media ads generator

### RoofLink
- 30+ marketing images from rooflink.com and salesrabbit.com
- 6 actual app UI screenshots from Software Advice
- 10 Zendesk help center screenshots showing Multiple Estimates UI flow
- Full report: `.firecrawl/rooflink/ROOFLINK-UI-RESEARCH-2026-04-03.md`

### JobNimbus
- 14 Connecteam screenshots of internal UI
- Full report: `.firecrawl/jobnimbus-research/REPORT-jobnimbus-ui-research.md`

### Review Sites
- Full report: `.firecrawl/competitor-research/competitor-ui-report-2026-04-03.md`

---

*Raw Firecrawl data stored in `.firecrawl/hailtrace-research/`, `.firecrawl/jobnimbus-research/`, `.firecrawl/rooflink/`, `.firecrawl/rooftops-research/`, and `.firecrawl/competitor-research/`.*
