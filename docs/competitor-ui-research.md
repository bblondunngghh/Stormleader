# Competitor UI Research — Visual Comparison

**Date:** 2026-03-29 (third pass — comprehensive Firecrawl research across 50+ sources)
**Method:** Firecrawl scraping of competitor websites, help centers, marketing pages, YouTube tutorials, integration partner sites, and third-party review sites (Capterra, G2, ConveYour, RoofChief, Onetrace, SPOTIO, etc.)
**Companion doc:** `docs/competitor-gap-analysis.md` (text feature analysis — not duplicated here)

---

## 1. Storm Map (Compare to HailTrace)

### How HailTrace Displays Storm Data

**Map Layers (4 independent toggles):**
1. **Meteorologist Maps** — hand-drawn hail/wind/tornado swaths from 15+ in-house meteorologists
2. **Algorithm Hail Maps** — automated swaths, QC'd by meteorologists
3. **NOAA Reports** — verified ground-truth pins
4. **Social Media Images** — geolocated camera icons showing real damage photos from affected areas

**Hail Swath Color System:**
- Light colors = minor hail activity -> darker/purple = severe damage
- Integration partners (SPOTIO) refer to high-severity zones as **"Purple Zones"**
- Knockbase describes it as: "Light color = smaller storm activity, darker color = severe impact"
- Available layer filters: Algorithm Hail Size, Meteorologist Hail Size, Wind Speed Reports, Tornado Paths

**Star Rating System (1-5):**
- Every storm event gets a 1-5 star rating based on: properties impacted, max hail size, damage probability
- 5-star = major metro area hits; 1-star = small storms (free tier only gets 1-star maps)
- Star ratings visible on storm preview cards in the storm gallery

**Isolated Hail Pattern (NEW Dec 2025):**
- Unique hatched-line overlay on swath polygons indicating isolated (non-widespread) hail
- Two triggers: low volume of hail, or mixed sizes with sporadic larger stones
- No other platform has this visual indicator

**Map Controls (mobile):**
- Search button (top-right) -> 3 tabs: Maps, Campaigns, Assets
- Calendar picker for date selection
- Adjustable radius filter with visible circle on map
- Map Layers toggle button
- Map Settings for base map (standard/hybrid/satellite)
- Filters for hail size minimums, star level, radius
- Storm preview cards with date, state abbreviations, city names, type badges (Hail/Wind/Tornado)

**Hail Maps Gallery (hailtrace.com/hail-maps):**
- Public card grid with storm thumbnail previews
- Each card: date, states, cities, storm type badges
- Search bar + state dropdown + date range picker at top

### How HailTrace Honey Hole Finder Works

**Not a dedicated heat map.** It's the Multi Map Overlay feature -- users load multiple storm dates simultaneously and visually identify where swaths overlap. Areas with repeat impacts show denser/darker coloring from stacked polygons. It's a manual exploration tool, not an automated scoring system.

### HailTrace Property Popups / Asset Detail

**Data fields available:**
- Full address, roof type, last renovation date
- 9+ weather impact fields: last hail date/size (meteorologist AND algorithm), last wind date/speed, last tornado date/EF rank
- Customizable pipeline statuses (Door Knock #1, Appointment Booked, Pending Claim, etc.)
- Opportunity stage (Lead -> Prospect -> Open -> Closed -> Lost)
- Asset Weather tab with downloadable historical storm maps
- Custom data fields (Enterprise plan)
- Toggle between Map view and List/Table view

### What StormLeads Currently Shows
- Google Maps hybrid with storm swath polygons from NOAA SPC/MRMS/NWS
- FEMA property overlay (tile-based, 5000 cap) with county property overlay
- Hail history heat map overlay (Honey Hole Finder via NOAA SWDI 10-year data)
- Layer toggle controls, time range filter (24h-30d), opacity slider
- Property popups with address, owner, year built, sqft, roof type, hail risk score, 5-year hail chart
- Add-to-pipeline from popup, address search with StreetView

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **Hail swath color graduation** | HIGH | Medium | HailTrace uses light-to-purple gradient by severity. Our swaths are uniform color. Need color scale by hail size (1" = yellow, 1.5" = orange, 2"+ = red/purple) |
| **Storm star/severity rating** | MEDIUM | Low | Simple 1-5 rating per storm event based on properties impacted + max hail size. Show as badge on storm catalog cards |
| **Social media damage photos on map** | LOW | High | HailTrace geolocates real damage photos. Would require social API integration or user-submitted photos |
| **Hatched pattern for isolated hail** | LOW | Medium | Unique HailTrace feature. Could differentiate swath rendering for scattered vs widespread hail |
| **Multi-storm overlay for honey holes** | MEDIUM | Low | Our Honey Hole Finder uses NOAA SWDI heat map (arguably better than manual overlay). But adding ability to load multiple specific storm dates simultaneously would match their workflow |
| **Storm preview cards in catalog** | LOW | Low | HailTrace shows thumbnail map previews per storm. Our Storm Catalog uses text cards. Adding mini-map thumbnails would be polished |

---

## 2. Pipeline / CRM (Compare to JobNimbus)

### How JobNimbus Pipeline Works

**Board Types (3):**
1. **Sales Boards** — all leads/jobs with estimated totals per column
2. **Production Boards** — jobs in production, identify bottlenecks
3. **Billing Boards** — completed jobs, collect final payment

**Kanban Card Content:**
- Address as primary identifier (e.g., "1281 Kerry Way")
- Contact name
- Task progress indicators
- Numbered entries within each column
- Job/estimate status
- Color-coded by status
- Drag-and-drop between stages
- Cards do NOT show property thumbnails/photos

**Board Features:**
- Custom boards (private or shared)
- Board templates
- "Main Flow" dropdown to switch between boards
- Default stages: Appointment, Schedule, Estimating, Pending...
- Revenue totals per stage (Sales boards)

**UI Style:**
- Clean white/light-gray background
- Blue primary action color
- Standard enterprise SaaS layout -- **reviewers consistently call it "aging" and "showing its age"**
- G2 badges, 4.8-star mobile app

### How RoofLink Pipeline Works (Milestone-Driven)

**Key Differentiator:** Pipeline advancement is automatic based on checklist completion, not manual drag-and-drop. RoofLink dismisses competitors as "digital post-it notes."

- "Hard stops" block stage advancement until required photos are uploaded and punch list items checked
- If the photo isn't there, the rep doesn't get paid
- Dashboard shows job counts per stage, clickable
- Pipeline: Sales -> Approved -> Production stages
- Jobs tracked by: scheduled/not scheduled, work orders complete/incomplete

**Dashboard Widgets:**
- Role-based dashboard templates (save layout and apply to all sales reps, PMs, admins)
- KPIs: jobs by status, work orders, revenue (monthly/all-time), retail vs insurance split
- Sales pipeline (clickable), lead sources, leaderboard (gross + profit by rep)
- 150+ built-in reports + custom report builder
- Two UI modes: standard checklist view OR "boxy" card layout (Nearby Jobs, Recently Accessed, Starred)

### What StormLeads Currently Shows
- 3 board tabs (Sales/Production/Billing) with kanban columns
- Drag-drop stage changes with conversion rates between columns
- Days-in-stage badges (color-coded), task progress badges, deal value per card + column totals
- Financing status, priority indicators, hail size badges, due date badges, rep avatars
- Column collapse (localStorage), mobile board + list views
- Filter by priority/source/rep with active filter pills

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **Card property thumbnails** | HIGH | Medium | RoofLink shows property images on cards. Add Google Street View or satellite thumbnail to pipeline cards for instant visual recognition |
| **Revenue totals per stage column** | LOW | Low | JobNimbus shows estimated totals at column headers. We show deal value per card but verify column totals are prominent |
| **Milestone-driven auto-advancement** | MEDIUM | High | RoofLink auto-advances stages when checklist items complete. Our pipeline is manual drag-and-drop. Consider optional auto-advance rules |
| **Board templates** | LOW | Medium | JobNimbus lets users create and share board templates. Nice-to-have for onboarding |

---

## 3. Estimates (Compare to JobNimbus SumoQuote + RoofLink)

### How JobNimbus SumoQuote Estimate Builder Works

**8 Page Types (all toggleable on/off):**
1. **Cover Page** — company branding, customer home photo (650x414px), certification images, secondary logo, date, auto-populated customer info
2. **Introduction** — rich text editor with bold/italic/underline, bulleted/numbered lists, Insert Token dropdowns for auto-fill shortcodes (e.g., `{{ACCOUNT_NAME}}`), saved templates
3. **Inspection** — photo sections with descriptions, multiple layout styles for photo+description, drag-and-drop photo reorder, add from device or Job/Contact
4. **Estimate Details** — THE CORE PRICING PAGE:
   - Up to 3 tabs for Good/Better/Best OR multi-trade (Roofing/Siding/Gutters)
   - "Include all items from" option avoids double-entry between tiers
   - Sections with names (e.g., "Roofing Tear Off", "Materials and Labor")
   - Line items sync from Products & Services catalog
   - Drag-and-drop reorder with six-dot handle
   - Add Item / Add Section (from template) / Add Discount buttons
   - Tax rate application, profit margin slider, override total price
   - Save as Template button
5. **Signing & Upgrades** — signature capture, disclaimers, upgrade line items with profit margin slider, deposit request toggle, up to 4 additional signers, product selections (shingle color)
6. **Terms and Conditions** — rich text or PDF upload, require acknowledgment toggle
7. **Warranty** — warranty start date, details, thank-you note, company signature upload
8. **Custom Pages** — PDFs from Job/Contact, Sales PDFs (company library), single-use uploads, text with token auto-fill

**Layout System:**
- Layouts = pre-configured template collections for rapid creation
- Layout Library with filter and preview, set default layout
- Location-specific layouts

**SumoQuote Stats:** $2,078 average upgrades per signed quote, 64% close rate increase

### How RoofLink Estimates Work

**Measurement-Coupled:**
- Drawing a roof auto-generates estimate, material order, AND work order simultaneously
- "3 Estimates in 3 Minutes" marketing

**Multiple Estimates (up to 6 per job):**
- Rename options (Good/Better/Best or Silver/Gold/Platinum)
- Side-by-side comparison table with columns for each estimate
- Toggle views: Work Doing, Work Not Doing, Supplements, Change Orders, Discounts, Upgrades
- Compile into single branded PDF with Compare Estimates summary page
- One must be "Set as Primary" before ordering

**Real-Time Profit Visibility:**
- Gross Profit calculation on every estimate
- Reps see how discounts affect their commission
- Material cost and labor cost displayed separately
- Commission calculated on gross profit, not revenue

### What StormLeads Currently Shows
- KPI stat cards (4), status filter (6 statuses)
- Estimate builder with line items + SRS catalog integration
- Template system, RichTextEditor, discount management (% or $), tax rate
- Multi-signer authorization, auto-save (2s debounce)
- Send-for-signing modal with email templates + merge tokens
- Good/Better/Best tier generation, financing plan selection
- Section images, duplicate estimate, print/PDF (browser window.print)

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **Server-side PDF export** | HIGH | Medium | Both competitors produce professional branded PDFs. We use browser print. Need pdfmake or similar with company logo, cover photo, organized sections |
| **Inspection photo pages** | HIGH | Medium | SumoQuote has dedicated photo pages with multiple layout styles and drag-and-drop reorder. Our estimates don't include inspection photos in the estimate document itself |
| **Cover page with property photo** | MEDIUM | Low | SumoQuote starts with a branded cover page including customer home photo. Professional first impression |
| **Estimate comparison page** | MEDIUM | Medium | RoofLink compiles multiple estimates into a single PDF with a Compare Estimates summary. Our Good/Better/Best exists but no comparison view |
| **Profit margin slider** | MEDIUM | Low | Both competitors show real-time profit margin on estimates. Add a margin calculator that shows profit % as line items change |
| **Layout/template library** | LOW | Medium | SumoQuote has a Layout Library with pre-built collections. Our template system exists but could be more visual |

---

## 4. Content / Marketing (Compare to Rooftops.ai)

### How Rooftops.ai Creator Studio Works

**Two Sites:**
- New site (rooftops.ai) — modern Next.js rebuild, emerald-to-cyan gradient, satellite map hero, polished marketing. Product UI behind login
- Legacy site (legacy.rooftops.ai) — original app still functional with publicly accessible Creator Studio tools

**Creator Studio Library Layout:**
- "Most Popular" section: 2 large featured cards with dark gradient backgrounds (Social Media Ads, Landing Page Builder)
- "Creator Library" section: horizontally scrollable row of white cards with icons -- Email Marketing, Social Media Planner, Cold Call Scripts, Legal Doc Templates, Meeting Strategy, Training Manuals, Translate Anything
- "Coming Soon" section: AI Image Generator, Estimate Builder, SEO Optimizer, Content Scheduler, AI Video Clips
- Card design: white background, subtle shadow, colored icon circle top-left, arrow link top-right, bold title, gray description, status badge (FREE/PREMIUM/COMING SOON)

**Social Media Ads Creator (publicly visible):**
- Two-column layout: form left, Facebook post mockup preview right
- Form fields: language dropdown, target audience multi-select (age groups), social platform, tone of voice (Professional/Friendly/Quirky/Humorous/Inspirational/Empathetic/Casual/Pirate), text length, topic text input
- Preview: full Facebook post chrome with avatar, timestamp, post text area, stock image (Unsplash integration), engagement bar, Like/Message/Share buttons
- Copy and share buttons above preview

**Landing Page Builder (publicly visible):**
- Two-column: form left, full landing page template preview right
- Form fields: language, company description, 3 services inputs, competitor advantage text, tone of voice
- Preview: full landing page template with header, hero, 3 alternating feature blocks, why section, footer

**AI Employees (Coming Soon):**
- Marcus (Sales) -- teal initial avatar
- Aisha (Marketing) -- orange/amber avatar
- Elena (Estimating) -- green avatar
- Ryan (Insurance) -- pink/rose avatar
- Card UI only, no actual interface yet. $199/month waitlist

**Design System:**
- Emerald-to-cyan gradient CTAs (`#10B981` to `#06B6D4`)
- Inter font, extra-bold (800) headings
- Dark navy panels for contrast sections
- White background, subtle card shadows
- Trust signals everywhere: stars, user counts, "trusted by" badges

### What StormLeads Currently Shows
- Content Studio with 5 content types (Social, Door Hangers, Emails, Blog, Ad Copy) x 4 tones
- 10 variables, batch mode (5 variations)
- Library tab: save/search/filter/copy/delete with localStorage persistence
- Template-based generation (not AI-powered)

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **AI-powered generation** | HIGH | Medium | Our Content Studio is template-based. Rooftops.ai uses GPT-5 for actual AI generation. Need LLM integration (free tier: local model or rate-limited API) |
| **Live preview panel** | HIGH | Low | Rooftops shows a Facebook post mockup or landing page preview in real-time as you fill the form. Our generator doesn't show a preview |
| **Platform-specific mockups** | MEDIUM | Medium | Rooftops renders content inside a Facebook/Instagram post mockup. Shows how it'll actually look on the platform |
| **Landing page builder** | MEDIUM | High | Rooftops generates full landing page content (headline, sections, CTAs). We don't have this |
| **Multi-language support** | LOW | Low | Rooftops supports 80+ languages via translation tool. Nice for diverse markets |
| **Social media scheduling** | LOW | High | Rooftops has a 30-day planner (Coming Soon on legacy). Social scheduling is a requested feature |

---

## 5. Work Orders / Production (Compare to RoofLink)

### How RoofLink Production Workflow Works

**7-Step Blueprint: Target -> Measure -> Estimate -> Approve -> Order -> Install -> Collect**
- Each step has a monochrome icon (crosshair, ruler, calculator, checkmark, clipboard, wrench, dollar sign)
- Milestone-driven: completing checklist items auto-advances jobs through stages
- "Hard stops" block advancement without required photos/checklist items

**Work Order Features:**
- Auto-generated from approved estimate measurement data -- no manual transcription
- Separated by trade automatically (roofing, gutters, etc.)
- Shows: what to install, where, how much it pays
- Crew logins ($30/month) give limited access: photos, notes, calendar, work orders only -- NO profit/cost visibility

**Production Checklists:**
- Customizable with action types: scheduling step, uploading step, checkbox step
- Photo verification required at multiple stages (tear-off, underlayment, final nail pattern)
- Checklist steps can trigger automated emails/SMS to homeowners
- "If the photo isn't there, the rep doesn't get paid"

**Scheduling:**
- Smart scheduling: assign crews by availability and job type
- Calendar integration to prevent double-booking
- Real-time material delivery and crew status updates

### What StormLeads Currently Shows
- 4-column kanban (Pending/Scheduled/In Progress/Completed)
- Drag-drop status changes
- Create from estimate, detail modal with milestones (add/toggle/delete/photo upload)
- Editable line items with running total
- Crew assignment, scheduled date/time

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **Milestone templates for job types** | HIGH | Medium | RoofLink comes with pre-configured checklists per job type. Our milestones are manual. Add templates (e.g., "Shingle Replacement" = 8 standard milestones) |
| **Photo-required hard stops** | MEDIUM | Medium | RoofLink blocks stage advancement without uploaded photos. Add optional "required" flag to milestone steps |
| **Automated notifications on milestone** | MEDIUM | Medium | RoofLink triggers homeowner emails/SMS when milestones complete. Wire our notification system to milestone events |
| **Trade-separated work orders** | LOW | Medium | RoofLink auto-splits work orders by trade from the estimate. Nice for multi-trade jobs |
| **Crew-limited access** | LOW | Medium | RoofLink crew logins hide profit/cost data. Our team roles could add a "crew" role with restricted views |

---

## 6. Dashboard / Reports (Compare to JobNimbus + RoofLink)

### How JobNimbus Insights Works

**6 Dashboard Sections (hamburger menu):**

1. **Business Overview** — KPI cards (Leads, Sold, Close Rate, Estimating Conversion), 4 graphs (Top Lead Sources, Top Sales Reps, Lead Flow YoY, Historical Sales YoY), drill-down on any data point
2. **Sales (5 sub-tabs):**
   - Leads/Close Rate — lead flow graphs, lead mix by source, scorecards by rep/source/type, Leads by Area MAP, raw data table
   - Estimating Conversion — rate %, by rep/type/source scorecards
   - Sales — historical chart, leaderboard, sales by rep/area/source/type
   - Sales Pipeline — current pipeline by stage with job counts, outstanding estimates with $ amounts
   - Sales Data — raw table with customizable columns (eye icon to show/hide)
3. **Workflow** — Time in Stage cards (avg days per stage: Lead, Estimating, Sold, Production, A/R), breakdown by rep and job type, Time in Status
4. **Accounts Receivable** — Outstanding invoices total + by status, overdue by date range, by category (1-30 days, 91+ days)
5. **Completed** — 3 graphs (by job type, by rep, by lead source), 3 scorecards with average revenue, raw data
6. **Profit Tracker (4 sub-tabs):**
   - Profitability Summary — Planned vs Actual Gross/Net margins, Revenue Trended, by Lead Source
   - Profit & Loss — Planned vs Actual charts
   - Variance Analysis — by salesperson, by job type
   - Sales and Commissions — rep profitability, commissions paid/due, as % of revenue and profit

**All tables have:** Eye icon for column customization, drill-down capability, download/export, filter bar (Sales Rep, Lead Source, Job Type, Date Range)

### How RoofLink Dashboard Works
- Customizable widget-based with role-based templates
- KPIs: jobs by status, work orders, revenue, retail vs insurance split, pipeline, lead sources
- Leaderboard: gross + profit by rep, filterable by Weekly/Monthly/All Time
- 150+ built-in reports + custom report builder

### What StormLeads Currently Shows
- 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges
- Revenue goal progress bar with inline edit
- Pipeline funnel (clickable stages)
- Mini storm map, storm activity feed (24h/7d/30d toggle)
- Today's tasks, activity feed timeline, storm conversion rates
- Estimates status summary, team leaderboard
- Reports page: 6 reports (Revenue, Pipeline, Conversion by Source, Rep Leaderboard, Lead Sources, Stage Duration), period presets, comparison periods with delta badges, CSV export

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **Drill-down on charts** | HIGH | Medium | JobNimbus lets you click any bar/data point to drill into contributing jobs. Our charts are display-only |
| **Profit Tracker (Planned vs Actual)** | HIGH | High | JobNimbus tracks planned vs actual gross/net margins, variance analysis by rep and job type, commission tracking. We show expenses vs estimate = profit, but no planned margins or variance analysis |
| **Accounts Receivable dashboard** | MEDIUM | Medium | JobNimbus has outstanding invoices by status, overdue by category (1-30 days, 91+ days). Our invoices page has basic stats but no aging analysis |
| **Workflow/Time-in-Stage analytics** | MEDIUM | Medium | JobNimbus shows average days per stage with breakdown by rep and job type. We show days-in-stage badges on pipeline cards but no aggregate analysis |
| **Custom report builder** | MEDIUM | High | Both competitors let users build custom reports. RoofLink has 150+ built-in. We have 6 fixed reports |
| **Leads by Area map** | LOW | Medium | JobNimbus shows a geographic distribution of leads on a map in their Sales analytics. We have the storm map but not a lead distribution overlay |
| **Role-based dashboard templates** | LOW | Medium | RoofLink lets admins create dashboard layouts per role and apply across the org |

---

## 7. Canvassing / Territory (Compare to HailTrace + RoofLink)

### How HailTrace Canvassing Works
- Enterprise-only feature
- Polygon-based campaign regions on map
- GPS verification within 50 feet of property (must be physically present)
- Custom pin colors/types, door-knock status tracking
- Lead list generation directly from campaign view (3 methods: polygon draw, campaign, storm swath)
- Lead lists include: address, email, phone, contact name (via Cole Information, quarterly updated)
- Canvassing reports for team performance

### How RoofLink/SalesRabbit Canvassing Works
- Freehand polygon drawing to assign territories to reps/teams
- Color-coded pin system: green = approved, purple = prospects, orange = denied insurance
- CAD data pull: homeowner name, sqft, building value
- Google Street View integration ("turn around and look at homes")
- Bulk SMS/email from map filtered by ZIP + lead status
- Activity feed showing where reps have dropped pins

### What StormLeads Currently Shows
- Full-screen dark map with GPS-located pin dropping
- 6 outcome types (Not Home, Interested, Not Interested, Scheduled, Follow Up, Already Customer)
- Notes per pin, stats bar (doors/interested/scheduled)
- Convert pin-to-lead, territory manager panel (polygon drawing)

### Gaps to Close

| Gap | Priority | Effort | Details |
|-----|----------|--------|---------|
| **GPS proximity verification** | MEDIUM | Medium | HailTrace requires within 50ft. We allow pin drops anywhere. Add optional GPS check |
| **Canvasser leaderboard** | MEDIUM | Low | HailTrace has canvassing reports. Add doors knocked/scheduled/interested per rep |
| **Bulk communication from map** | MEDIUM | High | RoofLink sends bulk SMS/email from map filtered by ZIP + status. Requires SMS integration |
| **Property data on pins** | LOW | Medium | RoofLink pulls CAD data (owner name, sqft, value) before knocking. We'd need a free data source |
| **Route optimization** | LOW | High | Neither competitor has this well, but it's commonly requested in reviews |

---

## 8. Mobile Experience (Cross-Competitor)

### Industry State
- **HailTrace mobile:** 3.0-3.3 stars. Lag, crashes, unintuitive. Desktop version widely preferred. Bottom bar: Maps, Assets, More
- **JobNimbus mobile:** 4.8 stars, 5000+ reviews. Three-screen demo: kanban board, photo annotation, calendar. Strong mobile-first design
- **RoofLink mobile:** 4.1 stars, 39 ratings. "Can truly run a job from start to finish." Two UI modes available
- **Rooftops.ai mobile:** No dedicated app. Web-only

### Universal Reviewer Complaints About Mobile
- Crashes and slow sync between mobile and desktop
- Limited feature parity vs desktop
- Offline support is inconsistent
- Photo upload reliability issues in the field

### StormLeads Mobile Status
- Web-only, no native mobile app
- Mobile responsive bottom tab bar is in TODO list
- PWA manifest/service worker already built

### Opportunities
StormLeads has a significant opportunity: HailTrace's mobile app is their weakest point (3.0-3.3 stars), and reviewers across ALL products complain about mobile. A responsive PWA with offline support would be competitive.

---

## 9. UI Design Trends Across Competitors

### What Reviewers Consistently Praise
1. **Kanban/board views** for pipeline visualization
2. **Drag-and-drop** interfaces for scheduling and deals
3. **Color-coded statuses** on boards and maps
4. **Clean proposal builders** (Roofr cited as "best-looking proposals in the game")
5. **Mobile reliability** (offline, photo upload, GPS)
6. **One-click material ordering** from estimates
7. **Real-time dashboards** showing revenue, pipeline, performance
8. **Map-based** territory management and storm data

### What Reviewers Consistently Criticize
1. **"Dated/aging interfaces"** — JobNimbus and AccuLynx specifically called out; RoofChief says "built in 2012 and haven't changed much since"
2. **Overwhelming complexity** — ServiceTitan, AccuLynx
3. **Steep learning curves** — 3+ week onboarding common
4. **Mobile limitations** vs desktop
5. **Cluttered layouts** — AccuLynx specifically
6. **Complex pricing** confusing users
7. **Slow sync** between mobile and desktop

### StormLeads Design Advantage
StormLeads' glassmorphism dark-mode-first design would be the **first modern-looking roofing CRM** in this space. Every competitor uses standard white/light-gray enterprise SaaS styling built 2012-2015. The oklch color system, .glass panels, and iOS 26 Liquid Glass aesthetic are genuinely unique in the roofing vertical.

---

## 10. Pricing Landscape (Context for Feature Prioritization)

| Product | Solo Monthly | 5-Person Monthly | 10-Person Monthly |
|---------|-------------|-----------------|------------------|
| **JobNimbus** | ~$349 | ~$619 | ~$1,254 |
| **HailTrace** | ~$83-166 | Same (per-company) | Same (per-company) |
| **RoofLink** | $400 | $2,000 | $4,000 |
| **RoofLink + SalesRabbit** | $160 | $800 | $1,600 |
| **AccuLynx** | Custom | Custom | Custom |
| **ServiceTitan** | Custom (expensive) | Custom | Custom |
| **Rooftops.ai** | $12 | $55 (team) | ~$55+ |
| **Roofr** | $99-169 | $99-169 | $99-169 |
| **StormLeads (target)** | $29 | $79-149 | $149 |

**Key insight:** StormLeads at $29-149/month is 3-10x cheaper than every full-featured competitor. The only cheaper option is Rooftops.ai ($12/month) which is NOT a CRM -- it's only AI reports and content.

---

## 11. Prioritized Improvement Recommendations

### Tier 1 — High Impact, Closes Biggest Gaps

1. **Server-side PDF estimates** — Both JobNimbus (SumoQuote) and RoofLink produce professional branded multi-page PDFs. Our browser print is the single biggest quality gap in estimates. Use pdfmake to generate cover page + inspection photos + line items + signing + terms.

2. **Hail swath color graduation** — HailTrace's light-to-purple severity gradient is their signature visual. Color-coding swaths by hail size (yellow -> orange -> red -> purple) would immediately make our storm map look more professional.

3. **AI-powered Content Studio** — Rooftops.ai at $12/month generates actual AI content with GPT-5. Our template-based system can't compete. Integrate a free/cheap LLM (local Ollama or rate-limited API) for real generation with live preview panel.

4. **Chart drill-down in Reports** — JobNimbus lets you click any bar to see the contributing jobs. This is a common analytics pattern that makes reports actually actionable.

5. **Milestone templates for work orders** — RoofLink's pre-configured checklists per job type are a major time-saver. Add 5-8 standard templates (Shingle Replacement, Metal Roof, Gutter Install, etc.).

### Tier 2 — Medium Impact, Strong Competitive Value

6. **Pipeline card thumbnails** — Add Street View or satellite image to kanban cards. RoofLink shows property images; JobNimbus does not. Visual recognition in pipeline is valuable for field reps.

7. **Profit Tracker (Planned vs Actual)** — JobNimbus's variance analysis by rep and job type is a powerful management tool. Start with planned margin on estimates + actual cost tracking.

8. **Photo-required milestones** — RoofLink's "hard stops" requiring photo upload before stage advancement. Add optional "required" flag to work order milestone steps.

9. **Canvasser leaderboard** — Simple metrics panel: doors knocked, interested, scheduled per rep. HailTrace Enterprise has this.

10. **Invoice aging analysis** — JobNimbus breaks overdue invoices into 1-30 day, 31-60, 61-90, 91+ buckets. Add this to our invoices KPI cards.

### Tier 3 — Nice to Have, Lower Priority

11. Storm star/severity rating system for storm catalog
12. Estimate comparison page (side-by-side Good/Better/Best)
13. Leads-by-area geographic map in reports
14. Role-based dashboard templates
15. GPS proximity verification for canvassing
16. Multi-language content generation

---

## 12. Screenshot Reference URLs

### HailTrace
- Dashboard: `cdn.hailtrace.com/images/home/dashboards.png`
- Hail maps: `cdn.hailtrace.com/images/home/hail-maps.png`
- Customization: `cdn.hailtrace.com/images/home/flexibility.png`
- Accuracy: `hailtrace.com/backgrounds/accurate_maps.png`
- Hook Agency (third-party): map with colored pins + sidebar (`hookagency.com/wp-content/uploads/2025/02/hailtrace-hail-trackers-1024x534.jpeg`)
- Phoenix hail map GIF: severity regions in red/orange (`hookagency.com/wp-content/uploads/2025/02/Hail-Map-Phoenix-AZ-October-5-2010-hail-trackers-1024x642.gif`)

### JobNimbus
- Capterra screenshots: 3 product screenshots + video on Capterra product page
- G2 board view: `images.g2crowd.com/uploads/attachment/file/1319946/jobnimbus-board-softwaresuggest.png`
- ConveYour: 4 screenshots (`jobnimus-image{1-4}.png`) showing dashboard, pipeline, job detail, and feature views

### RoofLink
- Homepage hero: `rooflink.com/wp-content/uploads/2025/12/Home_imgshero.png`
- Weather/Territory: `rooflink.com/wp-content/uploads/2025/12/RL_Weather_Page_HERO.png`
- Measurement: `rooflink.com/wp-content/uploads/2025/12/RL_measure_page_png_Drawing_-1.png`
- Good/Better/Best: `rooflink.com/wp-content/uploads/2025/12/RL_Multiple_estimate__Good_Better_best_.png`
- Real-time profit: `rooflink.com/wp-content/uploads/2025/12/RL_Multiple_estimate__Real-time_.png`
- Production pipeline: `rooflink.com/wp-content/uploads/2026/02/RL_WBlueprint_Page_5-6_Delegate-e1770927625718.png`
- Mobile CRM: `rooflink.com/wp-content/uploads/2024/11/rooflink-crm-app-2.12-524x1024-1.png`
- SalesRabbit canvassing: `salesrabbit.com/wp-content/uploads/2025/07/SR_RL_Homepage__Canvassing.png`
- SalesRabbit weather: `salesrabbit.com/wp-content/uploads/2025/07/SR_RL_Homepage__Weather_data.png`

### Rooftops.ai
- New site uses satellite map hero with floating address card
- Legacy Creator Studio tools publicly visible at `legacy.rooftops.ai/creatorstudio`
- Social Media Ads form at `legacy.rooftops.ai/magic_creator`
- Landing Page Builder at `legacy.rooftops.ai/landingpages`
- Resources site: `resources.rooftops.ai` (mockup screenshots of GPT chat, Creator Studio, AI City Maps)

### Review Site Comparisons
- Onetrace full comparison table: `framerusercontent.com/images/be6uBfuWpRZjCQEkcEsCB0aaws4.webp`
- AccuLynx high-res UI: `a-us.storyblok.com/f/1001647/.../acculynx-image3.png` (3413x2037)
- ServiceTitan dispatch board: `images.ctfassets.net/.../ezgif-458f8a9c9b31ea.jpg` (1800x1297)
- ServiceTitan Good/Better/Best mobile: `images.ctfassets.net/.../image10.png` (507x639)

---

## 13. Sources

- hailtrace.com, help.hailtrace.com (Zoho Desk KB), HailTrace YouTube (66-video playlist)
- jobnimbus.com/features, jobnimbus.com/product, support.jobnimbus.com, sumoquote.com
- rooflink.com, salesrabbit.com/rooflink, RoofLink Zendesk help center, YouTube demos
- rooftops.ai, legacy.rooftops.ai, resources.rooftops.ai, Product Hunt
- Integration partners: SPOTIO, Knockbase, SalesRabbit
- Review sites: Capterra, G2, Connecteam, RooferBase, RoofChief, Onetrace, ConveYour, QuoteIQ
- Third-party comparisons: Hook Agency, ServiceTitan blog, HubSpot blog, Zuper, FlashCrafter, SPOTIO blog
