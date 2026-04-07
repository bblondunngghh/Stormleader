# Competitor UI Research — Visual Comparison & Actionable Gaps

**Date:** 2026-04-07 (comprehensive refresh — incorporates fresh Firecrawl scrapes + CDN screenshot analysis + prior research)
**Method:** Firecrawl scrapes of competitor websites, help centers, CDN marketing images, YouTube tutorials, App Store metadata, review sites (Capterra, G2, Software Advice), integration partner pages, and CSS inspection. Cross-referenced with `docs/app-inventory-20260407.md` and `docs/competitor-gap-analysis.md`.
**Research files:** `.firecrawl/hailtrace-ui-research.md`, `.firecrawl/jobnimbus-ui-research.md`, `.firecrawl/rooflink-ui-research.md`, `.firecrawl/rooftopsai-ui-research.md`, `.firecrawl/quoteiq-reviews-ui-research.md`
**Companion doc:** `docs/competitor-gap-analysis.md` has the full text/feature/pricing analysis. This document focuses on **visual UI patterns, layouts, and actionable design gaps**.

---

## 1. Storm Map (StormLeads vs HailTrace)

### HailTrace Map Interface (from CDN screenshots + help docs)

**Layout:** Full-screen map with left sidebar panel (~300px wide).

**Left Sidebar:**
- Search bar at top: "Enter your keywords" placeholder, magnifying glass icon
- Address display in bold black text
- 5-tab icon navigation row: Maps (green), Campaigns (yellow), Assets (blue), Address (pink), Canvassing (purple)
- Contact name displayed prominently (e.g., "George Fleeson")
- Google Street View thumbnail of property
- "Create Asset" green CTA button (full-width, #009344)
- Expandable section: "WEATHER IMPACT HISTORY (23)" — shows all historical weather events at address
- Property details section: Home Owner Confirmed (Yes/No), Length of Residence, Gender, Home Value ($615K), etc.

**Map Area:**
- Satellite/hybrid base map (Google Maps)
- Hail swath overlay: large semi-transparent polygonal shapes
- **Color gradient for algorithm hail maps:** Yellow-to-green
  - Outer edges: pale yellow/tan (lower intensity)
  - Middle areas: olive/yellow-green
  - Core/center: darker green-yellow with brownish tones
  - Multiple concentric intensity zones within each swath (like topographic heat map)
  - Semi-transparent (~40-50% opacity), underlying satellite imagery visible
- **Color scheme for meteorologist maps (from integration docs):**
  - Light colors = smaller storm activity
  - Darker colors = severe impact
  - "Purple Zones" = highest severity
- **Weather Events popup** (white tooltip floating over map):
  - Title: "Weather Events (March 1, 2023)"
  - Three data rows with colored circle icons:
    - Green circle: "Algorithm Hail Size — 1.25" — 29,422 houses"
    - Green circle: "Meteorologist Hail Size — 1.25" — 4 Minutes — 26,573 houses"
    - Blue/teal circle: "Meteorologist Wind Speed — 55 MPH — 4 Minutes — 26,573 houses"
- Map markers: green shield icons (storm events), blue arrows, yellow triangle warnings

**Map Controls:**
- Search button (top right on mobile): three tabs — Maps, Campaigns, Assets
- Calendar button: select dates to pull weather events
- Radius filter: adjustable mile radius with circle overlay
- Map Layers button: toggle meteorologist/algorithm/NOAA/social media layers
- Map icon: view saved/downloaded weather events
- Map Settings: change base map (standard vs satellite)
- Filters: by hail size (e.g., 1.5"+), star level, radius
- Reticle/Inspector icon: tap to inspect weather event + quick access to Lead Lists
- Lead List button: draw polygon (3+ points) to generate lead list

**Star Rating System:** 1-5 stars per storm based on properties impacted, max hail size, damage probability. Free tier = 1-star maps only.

**Brand Colors:** Primary Green #16B55F (buttons/active), Brand Green #009344 (marketing), Yellow #FEAD11 (warning), Red #DA1717 (error/lost), Blue #3E87F4 (info). Font: Roboto. Background: #F6F7F9.

### StormLeads Storm Map Comparison

**What We Have:**
- Google Maps with hail/wind/tornado/tstorm swath polygons
- Severity color graduations (green→yellow→orange→red) for hail, wind, tornado
- Swath transparency slider (0-100%)
- 6-layer toggle panel
- FEMA NSI property overlay with Supercluster clustering
- Address search, Honey Hole heatmap, property popup with "Add to Pipeline"
- Storm history per location (5-mile, 10-year SWDI window)
- Time range filter (24h/3d/7d/14d/30d), Generate Canvassing List button

**Key Gaps:**

| Gap | HailTrace Has | Priority | Effort |
|-----|---------------|----------|--------|
| Property sidebar with owner details | Left panel showing name, home value, residence length, weather history count, Street View, "Create Asset" button | High | Medium — we have FEMA data but don't show it in a persistent sidebar |
| Weather event popup with structure counts | "29,422 houses" affected per swath with algorithm vs meteorologist breakdown | High | Low — count FEMA NSI points within swath polygon |
| Draw-polygon lead generation | Draw 3+ points to create custom area, generate lead list | Medium | Medium — PostGIS infrastructure exists |
| Multiple data layer types | 4 independent layer types (meteorologist, algorithm, NOAA, social media) each toggleable | Low | N/A — we use NOAA SPC only (free) |
| Calendar-based storm search on map | Calendar button to search by date directly on map | Low | Already in Storm Archive |

**Recommended Actions:**
1. Add structure count to storm swath tooltips (query FEMA NSI points within polygon)
2. Add persistent left sidebar for selected property (show FEMA data, census demographics, storm history, "Add to Pipeline" — currently popup-only)
3. Add draw-polygon tool for custom lead list generation

---

## 2. Honey Hole Finder (StormLeads vs HailTrace)

### HailTrace Honey Hole Finder

**How it works:** Load multiple historical storm swaths simultaneously. Visually identify where swath polygons overlap — these overlapping zones are "honey holes" with higher damage probability.

**Visual:** Overlapping swath polygons in different colors/dates. Intersection areas appear as darker layered zones. Each swath retains its metadata (date, size, severity).

### StormLeads Honey Hole Finder

**Our approach:** NOAA SWDI heatmap overlay showing historical hail event density as a gradient layer. Toggle on/off from layer panel. Instant visual density without manual swath loading.

**Assessment:** Our implementation is **different and arguably better** — we show a proper heatmap density visualization vs. requiring users to manually stack swaths. HailTrace's approach gives date-specific granularity; ours gives instant spatial density.

**Enhancement:** Add click-on-heatmap-hotspot to show contributing historical events (date, hail size, source).

---

## 3. Canvassing (StormLeads vs HailTrace + RoofLink)

### HailTrace Canvassing (from CDN screenshots)

**Pin System:** 3-color teardrop pins on satellite imagery:
- **Red pins** (most numerous): "Not Interested" / "No Answer"
- **Green pins**: "Interested" / "Sold"
- **Yellow/Gold pins**: "Follow Up" / "Callback"
- Pins placed precisely on individual rooftops (property-level, not block-level)
- Dense coverage — nearly every house in visible neighborhoods has a pin

**Map Sidebar (dark teal/green background):**
- Contact name + address in white text
- Vertical icon nav: Maps (green), Campaigns (yellow), Assets (blue), Contacts (pink), Canvassing (purple), Opportunities (teal)
- Property details: Gender, Potential Amount ($84), sales count ("7 sales")
- "CREATE CONTACT" button (green)
- "Find Maps" button to discover storms at this location
- GPS verification: pins must be within 50 feet of property

**Territory Assignment:** Managers freehand-draw polygon areas on map, assign to reps/teams. Clear visual boundaries prevent overlap. Activity feed shows where reps worked.

### RoofLink Canvassing

**Color-Coded Pin System (with legend button):**
- **Green** = Approved jobs
- **Purple** = Prospects/leads
- **Orange** = Denied insurance claims
- **Blue** = Completed/paid ("our favorite color")
- **Gray** = Deleted/unqualified
- All reps see each other's dots (visibility) but can't access job details (commissions, profits)

**Click-on-Any-House Data (County Appraisal District):**
- Homeowner name, market value, square footage, sale date, years of residence
- Lead statuses customizable; gray = dead leads (separate category, reactivatable)

**Bulk Communication from Map:** Filter by ZIP + status → send bulk email/SMS with pre-made templates

**SalesRabbit Bundle ($160/user/month):** DataGrid AI buyer propensity scores (1-10), credit score estimates, route optimization, historical canvassing results

### StormLeads Canvassing Comparison

**What We Have:**
- Google Maps dark hybrid view
- Stats bar (Total doors, Interested, Scheduled) as glass card overlay
- Drop Pin mode with crosshair cursor
- Bottom sheet modal (slide-up create/view)
- GPS coordinates, outcome quick-select (6 options, 2-column grid), notes
- Convert to Lead button
- Territory Manager: CRUD with PostGIS polygon drawing, color-coded, assignee

**Key Gaps:**

| Gap | Competitors Have | Priority | Effort |
|-----|-----------------|----------|--------|
| Color-coded pins by outcome | HailTrace: red/green/yellow. RoofLink: green/purple/orange/blue/gray | **High** | Low — add color mapping to pin markers |
| Property owner details on map | RoofLink: CAD data (name, value, sqft) on click | Medium | Low — already have FEMA data, surface in popup |
| Canvassing analytics | HailTrace: performance reports (pins, territories, outcomes) | Medium | Low — aggregate existing pin data |
| Nearby Jobs indicator | RoofLink: shows jobs within configurable radius | Medium | Medium — spatial query on leads |
| Pin outcome tracking visualization | Dense red/green/yellow coverage showing where rep worked | Medium | Low — already have pins, just add colors |
| Lead status legend button | RoofLink: visible legend explaining color meanings | Low | Trivial |

**Recommended Actions:**
1. **Color-code canvassing pins by outcome** — green (interested), red (not interested), orange (not home), yellow (follow up), blue (scheduled), gray (converted). High visual impact, low effort.
2. **Add pin color legend** — small floating panel explaining what each color means.
3. **Add canvassing analytics** — conversion rate, pins per rep, outcome breakdown (reuse stats bar pattern).

---

## 4. Pipeline/CRM (StormLeads vs JobNimbus)

### JobNimbus Pipeline (from help docs + CDN screenshots)

**Navigation:** Top-positioned horizontal nav bar (unusual for SaaS) — Home, Contacts, Jobs, Calendar, Boards, Insights. Plus separate left sidebar within app.

**Three Board Types (all kanban):**
1. Sales Boards — leads through sales pipeline with estimated totals
2. Production Boards — jobs through production stages
3. Billing Boards — completed jobs through payment collection

**Board Layout:**
- Horizontal columns per stage
- "Main Flow" dropdown in top-left to switch boards
- Column headers: stage name, item count, financial totals

**Card Design (SPECIFIC):**
- White rectangular boxes in each column
- **Top portion (configurable):** Title line via short-codes (address, contact name), up to 3 customizable content rows (contact type, status, invoice totals, balance due)
- **Fixed bottom row (5 elements, left to right):**
  1. Days in current status (numeric badge)
  2. Completed tasks ratio (e.g., "2/5")
  3. Attachment count (paperclip icon + number)
  4. Due date
  5. Assignee (initials circle or photo + team count)
- **No thumbnails/photos** on kanban cards
- **No color-coded priority indicators**
- **No inline progress bars**

**Column Totals:** Configurable summaries — Estimate Total, Invoice Total, Outstanding Invoice Total. Permission-controlled visibility.

**Board Sidebar (click-to-preview):** Right-side sliding panel with job name, address, status change dropdown, description, assignees, custom fields, activity. "Open In" link for full page.

**Default Stages:** Lead → Estimating → Sold → Production → A/R → Completed

**Design Language:** Navy blue #152152, electric blue #3968C6, light blue #ebf0fa. Plus Jakarta Sans font. White cards on light-gray backgrounds. Known complaint: "too much blue" — visual monotony.

### HailTrace Pipeline (from CDN screenshot)

**Layout:** White background, clean flat design. Three visible panels:

**Opportunity Pipeline:** 4 stage columns — Lead (green badge), Prospect (yellow badge), Closed (blue badge), Lost (red badge). Dollar totals per column (e.g., "$75.0k", "$122.1k"). Individual opportunity cards with green "View" buttons.

**Leaderboard:** List with circular avatar icons (blue circles), user name, deal count, dollar amount.

**Gross Revenue:** Line chart with green/teal line trending over time. Date range tabs (D/W/M).

### StormLeads Pipeline Comparison

**What We Have (and what's BETTER):**
- 3 board tabs (Sales/Production/Billing) — matches JobNimbus
- Deal value on cards + column revenue totals
- Lead score badges (80+/60+/40+) — **JobNimbus has none**
- Source labels on cards — **JobNimbus has none**
- Task progress badges (completion %) — **better than JN's "2/5" text**
- Days-in-stage badges (color-coded: green/gray/amber/red) — **better than JN's plain number**
- Conversion rate between columns — **unique to StormLeads**
- Column collapse toggle
- Priority/Source/Rep filter dropdowns
- Mobile list view
- Sidebar lead preview with activity feed

**Remaining Gaps:**

| Gap | JobNimbus Has | Priority | Effort |
|-----|--------------|----------|--------|
| Configurable card content | Users choose which 3 fields appear on cards via short-codes | Low | Medium |
| Attachment count on cards | Paperclip icon + number | Low | Low |
| Cover photo on job detail | Upload area for job photo | Low | Low |
| Board templates for quick setup | Pre-configured board layouts | Low | Low |

**Assessment:** Our pipeline is **significantly better** than JobNimbus. Our color-coded badges, conversion rates between columns, and multi-criteria scoring surpass their plain text indicators. No major gaps to close here.

---

## 5. Estimates (StormLeads vs JobNimbus SumoQuote + RoofLink)

### JobNimbus SumoQuote Estimate Builder (DETAILED from help docs)

**Multi-Page Structure (8 page types, each toggleable and reorderable via left sidebar with drag-and-drop):**

1. **Cover Page** — Company logo, primary image (650x414px recommended, typically customer's home photo), customer name, date, certification images, save as template
2. **Introduction** — Rich text editor with Insert Token dropdown for shortcodes ({{ACCOUNT_NAME}}, {{CONTACT_PHONE}}), template selector, save as template
3. **Inspection** — Photo sections with layout style picker (multiple arrangement options as popup thumbnails), drag-and-drop photo reorder, add from device/Job/Contact, editable section titles
4. **Estimate Details** — Up to 3 estimate tabs (Good/Better/Best), sections with eye icon (hide/show), trash icon (delete), up/down arrows (collapse), line items synced from Products catalog with 6-dot drag handle, Add Item/Section/Discount buttons, tax rate field, **profit margin slider** (horizontal slider for margin %), Override Total Price link, total breakdown (expandable), notes field
5. **Signing & Upgrades** — Signature capture (auto-populated contact), up to 4 additional signers, disclaimers, upgrade line items with separate profit margin slider, deposit request toggle (amount + description), product selections (e.g., shingle color), footer notes
6. **Terms and Conditions** — Rich text or PDF upload, require customer acknowledgment toggle
7. **Warranty** — Start date, details text, thank-you note, company signature upload, signee name/title
8. **Custom Pages** — PDFs from Job/Contact records, sales PDFs from library, single-use upload, text pages with token auto-fill

**Layout System:** Pre-configured collections of page templates. Layout Library with filter and preview. Set default layout, edit/copy, "Explore" for samples.

**Sending:** "Review and Share" generates PDF preview. Send for e-signatures or sign on spot. Must be "Approved" or "Marked as Signed" before converting to Invoice/Work Order.

### RoofLink Estimate Builder

**Auto-Generation:** Draw roof → select supplier template → system generates estimate + material order + work order simultaneously. Real-time Gross Profit calculation from SRS pricing + labor rates.

**Multiple Estimates:** Up to 6 options per job (vs SumoQuote's 3). Rename options (e.g., "Silver/Gold/Platinum"). Side-by-side comparison table. "Set as Primary" required before material/work orders can submit. Export button compiles selected estimates into single PDF.

**Estimate Options PDF Output:** Page 1 = company logo + cover. Pages 2-7 = one per estimate (logo, option name, bid type, total, work doing, payment). Final page = "Compare Estimates" summary with all options side by side.

**Line Item Categories:** Work Doing, Work Not Doing, Supplements (insurance), Change Orders, Discounts, Upgrades — toggleable via dropdown.

**Insurance Fields:** Insurance proceeds (ACV), recoverable depreciation, O&P input, auto-calculated customer cost.

### StormLeads Estimate Builder Comparison

**What We Have:**
- Estimate list with KPI stats (Total, Draft, Sent, Accepted counts/values)
- Rich multi-section builder, line items with drag-and-drop
- Rich text editor, section image uploader
- Tax rate, discounts, multi-signer, profit margin input
- Financing toggle (Hearth), template system, review/preview mode
- SRS Catalog material selection, duplicate estimate
- AI tier generation (Good/Better/Best), tier comparison modal
- Estimate-to-invoice, server-side PDF (pdfmake), in-person signing
- Insurance details toggle (company, claim #, date of loss)
- Optional upgrades section

**Key Gaps:**

| Gap | Competitors Have | Priority | Effort |
|-----|-----------------|----------|--------|
| Cover page | SumoQuote: logo + property photo + customer name + date page | **High** | Medium — add as optional first page to PDF |
| Multi-page PDF structure | SumoQuote: 8 page types (cover, intro, inspection photos, estimate, signing, T&C, warranty, custom) | Medium | High — significant PDF restructure |
| Photo sections with layout picker | SumoQuote: embed inspection photos with configurable arrangements | Medium | Medium |
| Profit margin slider (visual) | SumoQuote: horizontal slider. RoofLink: always-visible GP calculation | Medium | Low — we have input, make it a slider |
| Insurance auto-calculations | RoofLink: ACV → depreciation → customer out-of-pocket auto-calc | Medium | Low — add computed fields |
| Up to 6 estimates per job | RoofLink: 6 options. SumoQuote: 3 tabs | Low | We have AI tiers, this is comparable |
| Token/shortcode system | SumoQuote: {{ACCOUNT_NAME}}, {{CONTACT_PHONE}} auto-fill | Low | Medium |
| Side-by-side comparison export | RoofLink: "Compare Estimates" final page in PDF | Low | Medium |
| Fix dead measurement button | "LAUNCH MEASUREMENT TOOL" has no onClick handler | **Trivial** | Trivial — wire to RoofDrawingTool or remove |

**Recommended Actions:**
1. Fix dead "LAUNCH MEASUREMENT TOOL" button — wire to RoofDrawingTool or remove
2. Add cover page option to estimate PDF (company logo, property photo, customer name, date)
3. Add insurance auto-calculations: ACV input → depreciation → customer out-of-pocket
4. Make profit margin input a visual slider (higher engagement than text input)

---

## 6. Dashboard/Reports (StormLeads vs JobNimbus + RoofLink)

### JobNimbus Insights Dashboard (DETAILED from help docs)

**Access:** Left nav "Insights" tab → hamburger menu opens slide-out sidebar with 6 sections:

**1. Business Overview:**
- Filter bar: Sales Rep, Lead Source, Job Type dropdowns
- 4 stat cards: Leads count, Sold count, Close Rate %, Estimating Conversion Rate %
- 4 charts in 2x2 grid: Top 5 Lead Sources (horizontal bar), Top 5 Sales Reps (horizontal bar), Lead Flow (line/bar, this year vs last year), Historical Sales (line, YoY comparison)
- Click any bar → "drill down to next level"
- Three-dot menu per chart for export

**2. Sales (5 sub-tabs):**
- Leads/Close Rate: lead flow graphs, lead mix by source, scorecards by rep/source/type, "Leads by Area" geographic map
- Estimating Conversion: rate %, estimated jobs count, conversion scorecards
- Sales: historical trending, leaderboard, breakdowns by rep/area/source/type
- Sales Pipeline: jobs per stage (bar/funnel), outstanding estimates by status with dollar amounts
- Sales Data: raw table with configurable columns (eye icon), export

**3. Workflow:**
- 5 "Time in Stage" cards (Lead, Estimating, Sold, Production, A/R) — each showing green number (avg days)
- Clickable green numbers drill into contributing jobs
- Time in Stage by Sales Rep table, by Job Type table, by Status
- Filter: Date Range, Sales Rep, Job Type, Lead Source

**4. Accounts Receivable:**
- Outstanding Invoices total (large number)
- Overdue by date range: 1-30 days, 91+ days, not overdue
- A/R + Completed Jobs data table

**5. Completed:**
- 3 charts: Completed by Job Type (MoM bar), by Sales Rep (bar, revenue), by Lead Source (bar)
- 3 scorecard tables with average revenue per category

**6. Profit Tracker (4 sub-tabs):**
- Profitability Summary: Planned vs Actual Gross/Net, 4 charts (margins, revenue trends, costs), by Lead Source
- Profit & Loss: planned and actual charts
- Variance Analysis: variance summary, by salesperson, by job type
- Sales & Commissions: salesperson profitability bar graph, commissions paid/due, commission % of revenue/profit

### JobNimbus Profit Tracker (Per-Job)

- Tab within each Job record (alongside Activity, Tasks, Photos, etc.)
- Top metrics bar: revenue, cost, profit displayed horizontally
- "View More" button opens sidebar with drag-and-drop metric cards (customize which 5 appear as "Favorites")
- Cost section: grouped line items (Manual Section or Material vs Labor auto-sort), drag-and-drop reorder
- Import from: Estimates, Material Orders, Work Orders
- Commissions Panel: Planned Revenue/Profit/Flat Fee types, rate entry, assign to salesperson

### RoofLink Dashboard (from webinar walkthrough)

**Widget-Based, Fully Customizable:**
- Multiple groups (tabbed sections) displayed as horizontal tabs
- Groups are reorderable, renamable, addable, removable
- "Save as Template" duplicates layout to other roles
- Two UI modes: Standard (checklist-driven) and "Boxy" (widget grid with Nearby Jobs, Recently Accessed, Star Jobs, Reports, Statistics)

**Dashboard Groups (7):**
1. Sales Pipeline: signed contracts, filed claims (clickable cards)
2. Lead Generation: lead source tracking breakdown
3. Production: jobs approved vs in production, roofs scheduled/not, work orders completed/not
4. Insurance: supplementing, depreciation tracking
5. Job Closeout: warranties to submit, jobs to close, unpaid jobs
6. Revenue: this month vs all time, retail vs insurance
7. Leaderboard: by gross profit, filterable Weekly/Monthly/All Time

**Role-Based Templates:** Different default dashboards for Sales Rep, Marketing Rep, Team Leader, RSM, Project Manager, Office/Admin.

**Reports:** ~150 pre-built + fully custom builder. Export to CSV, Excel, HTML, PDF. Email reports directly. Stale job alerts (3/7 day triggers).

### StormLeads Dashboard Comparison

**What We Have (17+ sections):**
- 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close)
- Revenue goal progress bar with on-track/behind indicator (**unique**)
- Pipeline conversion funnel chart
- Mini storm map with live radar (**unique**)
- Tasks due today, follow-ups, activity feed
- Team leaderboard (8 columns)
- Conversion by storm chart (**unique**)
- Estimate summary (accepted/pending/declined)
- A/R aging summary (5 buckets)
- Estimating conversion cards
- Filter dropdowns (Rep, Source, Period) with comparison period data
- Loading skeletons
- Days-in-stage cards (**NEW** — matches JN's Workflow dashboard)
- Stale lead alerts (**NEW** — matches RoofLink's stale job alerts)

**Assessment:** Our dashboard is **one of the most comprehensive** in the industry. We have unique features (mini storm map, revenue goal, conversion by storm) that no competitor offers.

**Remaining Gaps:**

| Gap | Competitors Have | Priority | Effort |
|-----|-----------------|----------|--------|
| Geographic lead distribution map | JN: "Leads by Area" map in Sales section | Medium | Medium — plot leads on mini map |
| Speed to Lead metric | RoofLink + Roofr: response time tracking | Medium | Low — lead.created_at vs first activity timestamp |
| Retail vs Insurance breakdown | RoofLink: revenue split by job type | Medium | Low — if lead has insurance fields |
| Customizable dashboard layout | RoofLink: add/remove/reorder widget groups | Medium | High — significant refactor |
| Role-based dashboards | RoofLink: 6 role templates | Low | Medium |
| Profit Tracker per job | JN: dedicated tab with drag-and-drop metrics, commissions | Low | We have profit tracking in LeadDetail |
| YoY comparison charts | JN: this year vs last year overlays | Low | Medium |

**Recommended Actions:**
1. Add "Speed to Lead" metric — time from lead creation to first activity (data already exists)
2. Add "Leads by Area" mini-map or geographic distribution chart
3. Add proposal aging — highlight estimates sent 7+ days without response

---

## 7. Content/Marketing (StormLeads vs Rooftops.ai)

### Rooftops.ai Creator Studio (from app inspection + resources site)

**Tech Stack:** Next.js React SPA, workspace-based routing (`/[locale]/[workspaceid]/`), dark/light/system theme toggle, toast notifications (top-center, 3.5s, max 3 visible).

**Command Interface:** Uses special character prompts: `/` for prompts, `@` for files, `#` for tools.

**14 Content Tools:**
1. Social Media Ads, 2. Email Marketing, 3. Landing Page Builder, 4. Cold Call Scripts, 5. Legal Documents, 6. Translation (80+ languages), 7. AI Image Generation (DALL-E), 8. SEO Optimizer (coming soon), 9. Content Calendar (coming soon), 10. Strategy Documents, 11. Training Manuals, 12. Website Generator, 13. Meeting Strategies, 14. Video Editing (coming soon)

**Social Media Manager:** Auto-scheduling, engagement metrics, AI content ideas, "Creator Library" with stored content + negative trend identification. "30 days of social media posts in seconds."

**Design Language:** Montserrat (headings), Inter (body), Caveat Brush (accent/handwritten). Black text on white backgrounds. Dark/light mode toggle. Material estimate cards with photographic backgrounds.

### StormLeads Content Studio Comparison

**What We Have:** 7 content types (social, door hangers, emails, blog outlines, ad copy, cold call scripts, landing pages), 10 storm-specific variable inputs, batch mode (up to 5), live preview panel, card-based results grid, database-backed library.

**Assessment:** We cover the **most valuable content types** for storm restoration. Rooftops.ai has more types (14 vs 7) but many are tangential to the core workflow (legal docs, training manuals, meeting strategies).

**Key Gaps:**

| Gap | Rooftops.ai Has | Priority | Effort |
|-----|----------------|----------|--------|
| AI Image Generation | DALL-E powered images for social posts | Medium | Low — API call (~$0.02/image) |
| Content scheduling | Calendar for planning when to post/send | Medium | Medium |
| Command interface (/ @ #) | Slash commands for quick content creation | Low | Medium |
| Translation (80+ languages) | Multi-language output | Low | Low — add to prompt |

**Recommended Actions:**
1. Add content scheduling/calendar — plan when to use generated content
2. Consider AI image generation for social media posts
3. Add storm-specific types: insurance claim letters, supplement request templates

---

## 8. AI Roof Reports (StormLeads vs Rooftops.ai)

### Rooftops.ai Report Interface (DETAILED)

**Generation Flow:** Address search → AI pulls satellite imagery → ~30 seconds processing with 18 rotating status messages → report displays.

**Report Layout (top to bottom):**
1. **Header:** Property address + building icon, imagery quality badge, overhead satellite image, Google Street View photo(s)
2. **General Metrics:** Roof facets, total roof area (sq ft), ground area, max sunshine hours/year, max panel count, max array area, yearly energy DC kWh
3. **Roof Pitch Analysis:** Fractions (e.g., "5/12"), per-facet breakdown with area % and square footage, individual facet cards
4. **Building Details:** Roof area (with tilt), ground footprint, roofing squares (100 sq ft units)
5. **Material Estimate Cards:** 5 options with photographic backgrounds (Asphalt, Premium Asphalt, Clay Tile, Metal, Wood Shake), each with "Estimate" button → loading → material + labor cost breakdown
6. **Solar Insights:** Upfront cost, lifetime utility bills, 20-year net savings, yearly energy, **Solar Insight Scale** (horizontal bar: Red=Bad Fit → Yellow=Good Fit → Green=Great Fit, with dynamic caret indicator)
7. **Actions Bar:** Export PDF, Ask AI (opens GPT with property data), copy-to-clipboard, save/bookmark, Generate AI Content (links to Creator Studio with context)

### StormLeads Property Data Comparison

**What We Have:** FEMA NSI data, Census demographics, Street View + Satellite (Mapbox), roof measurement tools (drawing + manual), solar potential (Google Solar API), weather/storm history with PDF export, skip trace, FEMA disaster declarations.

**Assessment:** Different but complementary. Rooftops.ai = satellite roof analysis + instant estimates. StormLeads = storm damage history + lead qualification. The combination is powerful.

**Potential Enhancement:** Integrate Rooftops.ai-style roof report using Google Solar API's buildingInsights endpoint (we already use this for solar data — extend to include facet counts, pitch analysis, area calculations).

---

## 9. Work Orders/Production (StormLeads vs RoofLink)

### RoofLink 7-Step Workflow (DETAILED from webinar)

**Core Insight:** The pipeline is NOT a kanban board. Jobs advance **automatically** when checklist milestones complete. "Most other CRMs have boards that customers manually move to and from, basically replicating digital post-it notes."

**Checklist Step Types (4 different action widgets):**
1. **Scheduling step** — opens calendar picker with rep availability checking
2. **Uploading step** — requires file/photo upload before marking complete
3. **Checkbox step** — simple toggle completion
4. **Document creation step** — generates and sends a document

**Standard Checklist (~15 steps from webinar):**
1. Send welcome email (automated template)
2. Schedule inspection (calendar + rep availability)
3. Complete inspection form (customizable, photo capture)
4. File insurance claim (company, claim #, deductible, loss date)
5. Upload insurance scope
6. Schedule adjuster meeting
7. Create pre-contract/contingency agreement (e-signable)
8. Measure roof (drawing tool or third-party)
9. Create estimate (from measurement + template)
10. Customer approval / contract signing
11. Material ordering (one-click to SRS)
12. Schedule install
13. Installation checklist (photo verification)
14. Final collection / payment
15. Submit warranties / close out

**"Hard Stops" Enforcement:** Rep CANNOT mark a stage complete until required photos are uploaded and checklist items checked off. "If the photo isn't there, the rep doesn't get paid."

**Production Dashboard:** Roofs scheduled vs not (clickable counts), work orders completed vs not, insurance supplementing status, job closeout status.

**Crew Portal (~$30/month):** View work orders, upload photos, add notes, view calendar. Cannot see profits, commissions, or admin settings.

### StormLeads Work Orders Comparison

**What We Have:**
- 4-column kanban (Pending/Scheduled/In Progress/Completed)
- Cards with milestone progress bar
- Detail modal with full CRUD
- Milestone checklist with photo upload per milestone
- Photo-required enforcement (prevents completion without photo)
- 8 milestone templates, create from estimate, team assignment

**Key Gaps:**

| Gap | RoofLink Has | Priority | Effort |
|-----|-------------|----------|--------|
| Auto-advancement | Jobs move automatically when milestones complete | Medium | Low — add option to auto-advance |
| Checklist step types | 4 types (scheduling, uploading, checkbox, document) | Medium | Medium |
| Timestamp audit trail | Every checklist item logged with completion timestamp | Medium | Trivial — add `completed_at` column |
| Work order PDF export | Generate homeowner-ready PDF with organized photos | **High** | Medium — reuse pdfmake |
| Crew-only portal | Limited access for field crews | Medium | Medium — viewer role restriction |
| Trade separation | Work orders separated by roofing/gutters/siding | Low | Low — add category field |
| Welcome email automation | Auto-send template email on job creation | Low | Low — use existing drip infrastructure |

**Recommended Actions:**
1. Add work order PDF export with organized photos (reuse pdfmake from estimates)
2. Add auto-advance option: when all milestones complete → auto-move to next column
3. Add completion timestamp to milestones (trivial `completed_at` column)
4. Consider crew-limited view using existing viewer role

---

## 10. Job Detail View (StormLeads vs JobNimbus)

### JobNimbus Job Detail (from help docs)

**Header:** Job name + primary contact (name, phone, email). Quick-action buttons for: financial documents, notes, emails, tasks, text messages.

**Right Sidebar (always visible):**
- Cover photo upload area
- Address with Directions/Copy/Edit links
- Job overview with custom fields
- Status indicators: current status, days in status, job type, lead source, assigned users, location, dates, sales rep, subcontractors, synced integrations
- Tags section
- Related contacts list

**Left Navigation (12+ tabs):**
Dashboard, Activity, Fields, Tasks, Photos, Documents, Estimates, Material & Work Orders, Payments & Invoices, Profit Tracker, Forms, Custom Documents

### StormLeads LeadDetail Comparison

**What We Have (2,921 lines — comprehensive):**
Lead info header, lead scoring (7-factor), roof details, property info (FEMA), financing (Hearth), contracts, expenses/profit, activities, documents with photo annotation, weather/storm history, roof measurement tools, custom fields, review request, client status page, skip trace, FEMA disasters, census demographics, Street View + Satellite

**Assessment:** Our LeadDetail is **very comprehensive** — arguably more data-rich than JobNimbus's job view. We have storm-specific data (weather history, FEMA, census, hail scores) that they don't.

**Minor Gaps:**
- Cover photo upload — JN has prominent job cover photo. We could add a "hero image" to LeadDetail.
- Forms feature — JN has standardized inspection forms. We have custom fields but not templated forms.

---

## 11. Communication (StormLeads vs JobNimbus Engage)

### JobNimbus Engage (Texting) — VISUAL DETAILS

**Compose Area:** Text input field with 4 action buttons: image attachment (MMS), message templates, schedule (presets: This Afternoon, Tomorrow Morning, Tomorrow Afternoon, Custom Time), emoji picker. Character counter (160 chars standard, 70 chars with emojis).

**Conversation Thread:** Chat-style message bubbles. Scheduled messages show edit/delete on hover. Single shared inbox for all messages.

**Text-to-Pay:** Requires both Engage AND Payments subscriptions. Two-click payment link texting → customer clicks → secure payment page (green-themed).

**Cost:** $49/mo (Basic), $149/mo (Standard), $249/mo (Premium) + $20 setup. NOT included in base CRM.

### JobNimbus AssistAI (AI Receptionist)

**Interface:** Left sidebar — Dashboard, Contacts, Logs, Settings.
- Dashboard: metrics panel (Minutes Saved, Calls Answered, Appointments Booked, Booking Rate), latest calls feed
- Logs: data table with time frame selector (7-90 days), wrap lines toggle, filters, CSV/JSON export
- Agent types: Appointment Scheduler (books into JN calendar) and Message Taker

**Cost:** $298/agent/month + $0.15/minute.

### StormLeads Communication Status

**What We Have:** SMS composer uses `window.open('sms:...')` — native device pass-through, no in-app sending. Email via SMTP configuration. Drip sequences with auto-sending.

**Assessment:** This is our biggest UX gap. Twilio integration for real SMS would cost ~$20-50/month but would match a feature JobNimbus charges $49-249/month for. However, per project constraints, this involves real costs.

---

## 12. Emerging Threat: QuoteIQ

### QuoteIQ UI Details (from myquoteiq.com + fresh scrapes)

**Brand:** Primary Blue #2872FA, Dark Navy #192A3D. Feature cards in 3-column grid, 8px border radius, system fonts, 40px minimum input height.

**AI Estimator:** Upload up to 5 photos → AI analyzes property size, conditions, obstacles → description scoring with real-time feedback → dynamic question generation → before/after AI image preview → upsell recommendation cards → professional estimate output. Automated follow-up scheduling built into flow.

**MapMeasure Pro:** Interactive satellite map with overlay drawing tools for measurement boundaries. Drop pins for sq ft / linear ft measurement. Pricing auto-calculates from contractor rates. Screenshots attach directly to estimates (March 2026 update).

**InstaQuote (Self-Service Widget, 5-step):**
1. Service selection with real-time pricing display
2. Quote delivery via email AND SMS automatically
3. Customer approves with e-signature
4. InstaSchedule shows contractor's real-time availability
5. Customer picks date, job drops onto calendar

**Options Estimates:** 3-tab Good/Better/Best with line items and pricing per tier.

**Pricing Threat:** $29.99/mo includes full AI suite. Claims 91% savings ($31,500+/year) vs stacking competitor tools.

**StormLeads Moat:** QuoteIQ has **NO storm data, NO weather mapping, NO hail tracking**. Our NOAA/FEMA storm intelligence is the differentiator they can't match cheaply.

---

## 13. Industry-Wide UI Patterns (Cross-Competitor Analysis)

### Dashboard Design Consensus
- **Card-based KPI layouts** (5-7 core KPIs recommended)
- **Role-based views:** CSR/Sales, Technician/Crew, Financial
- **Visual job boards** (Kanban) showing status + progress
- **Pipeline visualization** with stage-based revenue breakdowns
- Charts: bar for stage duration, line for trends, funnels for conversion

### Estimate Builder Consensus
- **Good/Better/Best format** is industry standard (3-tier pricing)
- Each tier shows: material costs, labor, permits, disposal, monthly financing
- E-signature integration is table stakes
- Photo annotations and satellite imagery attachment trending
- Two approaches: 3 independent documents (isolated prices) vs combined single estimate

### Navigation Consensus
- **Sidebar navigation** (collapsible) is most common pattern
- **Tab-based content switching** for sub-sections
- **Bottom tab bar** for mobile apps
- **Sticky headers** with hamburger for mobile web

### AI Integration Trends (2026)
- Photo-based AI estimating (QuoteIQ leads)
- AI voice notes and transcription (Zuper)
- AI-generated before/after images (QuoteIQ unique)
- Natural language CRM control (QuoteIQ Autopilot, JN Scout)
- AI dispatch and scheduling (ServiceTitan)
- Auto-organized photo documentation (Zuper AI Walkthrough)
- Self-service quote widgets trending (QuoteIQ InstaQuote, SkyQuote, Roofr)

---

## 14. Priority Improvement Roadmap

### Tier 1 — High Impact, Low-Medium Effort (do next)

| # | Improvement | Inspired By | Effort | Impact |
|---|-------------|-------------|--------|--------|
| 1 | **Color-coded canvassing pins** by outcome (green/red/orange/yellow/blue/gray) | HailTrace + RoofLink | Low | High — instant visual improvement |
| 2 | **Fix dead measurement button** in EstimatesView | N/A (bug) | Trivial | Medium — removes dead UI |
| 3 | **Storm structure count** in swath tooltips (FEMA NSI points within polygon) | HailTrace | Low | High — adds data value |
| 4 | **Work order PDF export** with organized photos | RoofLink | Medium | High — customer deliverable |
| 5 | **Speed-to-Lead metric** on dashboard (created_at vs first activity) | RoofLink + Roofr | Low | Medium — sales coaching |
| 6 | **Milestone completion timestamps** on work orders | RoofLink | Trivial | Medium — audit trail |

### Tier 2 — Medium Impact, Medium Effort (plan for)

| # | Improvement | Inspired By | Effort | Impact |
|---|-------------|-------------|--------|--------|
| 7 | **Estimate cover page** (logo, property photo, customer name) | SumoQuote | Medium | High — professional presentation |
| 8 | **Insurance auto-calculations** (ACV → depreciation → out-of-pocket) | RoofLink | Low-Med | Medium — insurance workflow |
| 9 | **Property sidebar on map** (persistent panel with FEMA data, Street View, owner details) | HailTrace | Medium | High — reduces clicks |
| 10 | **Auto-advance work orders** when milestones complete | RoofLink | Low-Med | Medium — reduces manual work |
| 11 | **Canvassing analytics** (conversion rate, pins per rep, outcomes) | HailTrace | Low | Medium — rep coaching |
| 12 | **Profit margin slider** (visual slider instead of text input) | SumoQuote + RoofLink | Low | Low-Med — better UX |

### Tier 3 — Nice-to-Have (backlog)

| # | Improvement | Inspired By | Effort | Impact |
|---|-------------|-------------|--------|--------|
| 13 | Proposal aging alerts (estimates sent 7+ days) | Industry standard | Low | Low |
| 14 | Draw-polygon lead generation on storm map | HailTrace | Medium | Medium |
| 15 | Content scheduling/calendar | Rooftops.ai | Medium | Low |
| 16 | Leads-by-area geographic distribution | JobNimbus | Medium | Low |
| 17 | Customizable dashboard widget layout | RoofLink | High | Medium |
| 18 | AI image generation for social content | Rooftops.ai | Low | Low |
| 19 | Pin color legend button on canvassing | RoofLink | Trivial | Low |

---

*This document complements `docs/competitor-gap-analysis.md` (feature/pricing analysis) with visual/UX-specific research. Both should be consulted when planning UI improvements. Raw Firecrawl data available in `.firecrawl/` directory.*
