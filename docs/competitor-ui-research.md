# Competitor UI Visual Research — StormLeads vs Industry Leaders

**Date:** 2026-03-28 (second pass — fresh scrapes with deeper UI detail)
**Methodology:** Live scraping of competitor websites, help centers, review sites (G2/Capterra), YouTube tutorial transcripts, and product pages via Firecrawl
**Sources:** hailtrace.com, jobnimbus.com, support.jobnimbus.com, rooflink.com, rooftops.ai, g2.com, YouTube demos
**Companion doc:** `docs/competitor-gap-analysis.md` (text/feature analysis — not duplicated here)

---

## 1. Storm Map (Compare to HailTrace)

### What HailTrace Shows

**Homepage hero** (hailtrace.com): Full-width dark satellite map background with bright storm swath overlays. Tagline "Track Storms. Be There First. Beat Competition." with three bullet feature callouts (Live Alerts, Monitor Properties, Streamline Claims) and a prominent "Request Demo" CTA.

**Hail Maps gallery page** (hailtrace.com/hail-maps): A scrolling gallery of dated storm event cards, each showing:
- Thumbnail map preview image (from `cdn.hailtrace.com/storm-image-previews/{date}/preview.png`)
- Date displayed prominently (e.g., "Mar 25, 2026")
- Affected states listed (e.g., "TX - OK - KS")
- Affected cities listed below states (e.g., "Amarillo, TX; Lubbock, TX...")
- Star rating (1-5 stars) — "5-Star maps are our most high-profile maps... saved for the most impactful storms each year"
- State filter dropdown and date range filter at the top
- Text search field for finding specific storms

**Storm swath display** (from marketing images and FAQ):
- Star ranking system (1–5) based on: property count impacted, max hail size, probability of finding damage
- Camera icons on maps showing real hail/damage photos from verified locations, placed near where the photo was taken
- Multi-storm overlay capability — overlay storms from different dates on same map to find "honey holes"
- Hail maps show graduated severity — their CDN images show distinct colored swath regions
- Maps are "created by hand by meteorologists using dual-pol radar products and verified by ground truth reports"
- Hail maps go back to 2010, wind maps to 2020

**Dashboard** (cdn.hailtrace.com/images/home/dashboards.png):
- "Track your revenue and provide valuable statistics"
- Weekly performance metrics
- Lead tracking in a single view
- Described as designed for "data-based decisions" — implies charts/graphs for pipeline analytics

**Honey Hole Finder**:
- Finds "hidden areas that have a higher risk for damage from severe weather"
- Searches across multiple storm dates to find zones with repeated impacts
- Presented as a map overlay highlighting high-frequency impact zones
- Higher risk = higher damage probability = better canvassing targets

**Property/Asset data** (from FAQ):
- Three download methods: single property lookup, storm swath area download, custom draw-tool area selection
- Residential and commercial data plans (sourced from Cole Information, updated quarterly)
- Asset pins for existing customers with storm impact notifications
- "Impacted HailTrace Assets" alert — notifies when tracked properties fall within a new storm swath
- Can export filtered assets to CSV

**Canvassing** (from FAQ and plans page, Enterprise tier only):
- Custom pin dropping with GPS verification (must be within 50 feet of property)
- Canvassing region assignment to reps
- Pin-to-lead conversion
- Separate subscription from core storm mapping

**Customization** (cdn.hailtrace.com/images/home/flexibility.png):
- Custom data fields on assets
- Custom pipeline stages
- Customizable asset pins

### What StormLeads Currently Shows
- 5 storm swath types (hail, wind, tornado, severe, drift) on Mapbox
- County + FEMA property markers with clustering
- Honey Holes heat layer via NOAA SWDI
- Address search, time range picker (24h–30d), layer toggles, opacity slider
- "Improved Only" filter
- Property popup with owner/address/FEMA data/damage assessment
- "Add to Pipeline" from property popup
- Tile-based progressive property loading with caching

### Specific Gaps to Close

| Gap | HailTrace | StormLeads | Priority |
|-----|-----------|------------|----------|
| **Hail severity color graduation** | Distinct swath colors by severity (1-5 star system) | Single color for all hail swaths | **HIGH** — data already has `hail_size_in` |
| **Storm event gallery with previews** | Dated cards with map thumbnail, states, cities, star rating | Storm Archive with text-only cards, no map previews | MEDIUM |
| **Customer asset tracking** | Upload existing customers as pins, get alerted when hit by storms | No asset pin system for existing pipeline leads | MEDIUM |
| **Property data draw tool** | Draw custom area on map to download property data | No freehand area selection | LOW (cost concern with geocoding) |
| **Storm damage photo overlay** | Camera icons on map showing real hail/damage photos at verified locations | No damage photo integration on map | LOW |
| **Storm severity star rating** | 1-5 star rating per storm event | No severity classification per event | MEDIUM |
| **Multi-date storm overlay** | Overlay storms from different dates simultaneously | Single time range only | LOW |
| **Historical depth** | Hail maps back to 2010 (16 years) | NOAA SWDI heat map (10+ years) but swaths limited to 30 days | MEDIUM |

### Recommended Improvements
1. **Hail swath color graduation** (quick win): Style Mapbox fill layer with `hail_size_in` breakpoints: green (<1"), yellow (1-1.5"), orange (1.5-2"), red (>2"). Add legend panel.
2. **Storm Archive preview images**: Generate and cache a small Mapbox static map thumbnail per storm event. Add severity badge based on max hail size.
3. **Lead-as-asset alerts**: Allow marking existing pipeline leads as "monitored properties" that trigger notifications when new storms intersect their location.

---

## 2. Pipeline / CRM (Compare to JobNimbus)

### What JobNimbus Shows

**Sales Boards** (from G2 screenshots, product page, and demo tour):
- Kanban columns labeled by stage: "Estimate", "Signed Contract", etc.
- Each card shows: address (as job name), contact name, task progress indicators
- Cards numbered and show job/estimate status
- Drag-and-drop between columns — product page shows animated GIF of card being dragged from "Estimate" to "Signed Contract"
- Column-level estimated totals visible
- Description: "Super easy to organize and with our drag and drop feature it was never been easier to update what jobs are in what part of the process"

**Three Board Types** (from product features page):
- **Sales boards**: "See all your leads and jobs on one board, with estimated totals and more"
- **Production boards**: "See all your jobs in production on one board—including where they're getting stuck"
- **Billing boards**: "See all your completed jobs on one board, and use it to easily collect final payment"

**Board card content** (from YouTube tutorial walkthrough):
- Cards show address-based job names (e.g., "1281 Kerry Way")
- Job type labels visible (e.g., "Inspection Assignment", "Small")
- Task progress indicators beside each entry
- Stages mentioned: appointment, schedule, estimating, pending
- Jobs can be dragged between stage columns

**Custom workflows**:
- "Create the perfect workflow for your sales team to get incredible results"
- "Create workflows for every job type (e.g., residential retail or insurance roofing)"
- Production automation: "When a job is scheduled, send an email to my customer"
- Sales automation: "When a proposal is signed, move the job to 'Sold'"

**Contact/Lead list view** (from YouTube demo transcript, modeled after Excel):
- Sortable, filterable column headers — entirely customizable (add/remove/reorder via "add remove columns" panel)
- Toggle between system fields and custom fields as columns
- Inline editable cells
- Saved filter lists for marketing campaigns — save any filtered view for later reference
- Bulk edit and bulk email to entire filtered list
- Import via CSV/Excel

**Job detail page** (from YouTube demo):
- Three main areas: deal details, primary contact info, agenda + activity feed
- Activity feed split into three tabs:
  1. **System updates** — automated change tracking
  2. **Email interactions** — full sent/received email history (bidirectional sync)
  3. **Notes/Activities** — one-click activity logging by category, @mention support, threaded dialogue
- Task creation: type, assignee, priority, date/time — creates tasks and events (events are time-sensitive, populate on calendar)
- Task/event templates creatable in settings, applied manually or via automation
- File section with unlimited storage — emails with attachments auto-stored
- Custom field section below main content
- All associated deals shown with won/lost/in-progress status

### What StormLeads Currently Shows
- 3 board tabs (Sales/Production/Billing) with drag-and-drop
- Priority/source/rep filters with active pills
- Column collapse/expand (persisted), conversion rate badges
- Deal value on cards + column revenue totals
- Days-in-stage badges (color-coded)
- Financing status badge, horizontal pan/grab scrolling
- CreateLeadModal from pipeline
- Lead list: 16-column sortable table, URL-synced filters, bulk assign/stage change, CSV export

### Specific Gaps to Close

| Gap | JobNimbus | StormLeads | Priority |
|-----|-----------|------------|----------|
| **Task progress on board cards** | Each card shows task completion indicator | Cards show value + days-in-stage only | MEDIUM |
| **Mobile list view** | Full mobile experience with native app | "List" toggle exists but only Board renders | **HIGH** |
| **Inline card editing** | Click to edit directly on board card | Must open lead detail to edit | LOW |
| **Saved filter presets** | Save filter combos as named lists for reuse | Filters are URL-synced but can't save/name them | MEDIUM |
| **Column customization** | Add/remove/reorder columns in list view | Fixed 16-column table | LOW |
| **Custom workflows per type** | Different stage sequences for residential vs. insurance vs. commercial | Same stages for all leads | MEDIUM |
| **One-click activity logging** | Click activity category icon → logged instantly | Must open ActivityModal with full form | LOW |

### Recommended Improvements
1. **Mobile pipeline list view** (high priority): Implement the already-stubbed list mode for mobile — each row shows address, stage badge, value, days-in-stage.
2. **Task count on pipeline cards**: Add small task progress indicator (e.g., "2/5 tasks") to each kanban card alongside existing value/days badges.
3. **Saved filter presets**: Let users name and save current filter combination, stored per user in DB.

---

## 3. Estimates (Compare to JobNimbus/SumoQuote)

### What JobNimbus Shows

**Estimate builder** (from support.jobnimbus.com — detailed annotated screenshots visible):

Multi-page document builder with a left sidebar for page navigation. Toggle pages on/off beneath "Show/Hide."

**Page types available:**
1. **Cover Page** — Upload primary image (customer's home photo from job), company logo, certification badge/secondary logo. Contact info auto-populated from CRM job record.
2. **Introduction** — Rich text editor with merge tokens ({%raw}{{FIRST_NAME}}{%endraw} etc.), saved as templates for reuse.
3. **Inspection** — Photo sections with multiple layout styles (screenshot shows style selector with side-by-side, grid, full-width options). Drag-to-reorder photos. Section descriptions. Add multiple sections.
4. **Estimate Details** — THE core pricing page:
   - Up to 3 estimate tabs (Good/Better/Best OR multi-trade: Roofing/Siding/Gutters)
   - "Include all items from" another tab to avoid double-entry
   - Line items synced from Products & Services
   - Drag-to-reorder line items (six-dot drag handle)
   - Add Item, Add Section, Add Discount buttons
   - Tax rate application
   - **Profit margin slider** — visual slider adjusts margin in real-time
   - Override Total Price link
   - Expandable total breakdown panel
   - Save as Template
   - Page Settings: choose single-option vs multi-option customer selection, product name/description display options
5. **Signing & Upgrades** — Signature capture, upgrade line items with profit margin slider, deposit request toggle (amount + description), product selection fields (e.g., "Shingle color" dropdown), up to 4 additional signers
6. **Terms and Conditions** — Summary text or uploaded PDF, toggle for "require customer acknowledgment"
7. **Warranty** — Start date, warranty details with tokens, thank you note, company signature
8. **Custom Pages** — PDFs from Job/Contact, Sales PDFs, single-use PDF upload, or Text Page with tokens

**Two estimate modes:**
- **Standard Estimate**: Full multi-page document with all page types
- **Simple Estimate**: One-page quick estimate (Estimate Details only)

**Layout system:**
- Layouts = saved collections of page templates
- Select a Layout before starting to pre-populate all pages
- Save individual pages as templates independently
- Edits auto-save (no manual save needed)
- "Review and Share" button generates PDF preview for final review before sending

### What StormLeads Currently Shows
- Full estimate builder with sections management
- Line items editor with drag reorder
- Templates and rich text editor (bold/italic/underline/lists/links)
- Financing toggle with plan selection
- Multi-signer authorization, auto-save (2s debounce)
- Good/Better/Best tier generation
- SRS catalog integration, section images, tax rate selector
- Send modal with email template + tokens
- Preview/print mode
- Duplicate estimate, convert to contract

### Specific Gaps to Close

| Gap | JobNimbus/SumoQuote | StormLeads | Priority |
|-----|---------------------|------------|----------|
| **Inspection photo pages** | Dedicated page with photo layout selector, drag-reorder, descriptions | No inspection photo pages in estimates | **HIGH** |
| **Cover page with home photo** | Customer home photo + logo + certification auto-pulled from job | No cover page | MEDIUM |
| **Profit margin slider** | Visual slider for real-time margin adjustment | No margin visualization | MEDIUM |
| **PDF export** | Full PDF generation and preview | Print-to-PDF only (no server-side PDF) | **HIGH** |
| **Layout system** | Save complete multi-page layouts as reusable packages | Individual templates but no grouped layouts | LOW |
| **Required acknowledgment pages** | Toggle requiring customer to confirm viewing T&C | No acknowledgment tracking | LOW |
| **Warranty page** | Dedicated warranty section with dates and details | No warranty section in estimates | LOW |
| **Product selection fields** | Customer picks shingle color, etc. from dropdown | No product selection on signing page | LOW |

### Recommended Improvements
1. **PDF export** (high priority): Server-side PDF generation using pdfmake (already in deps). Convert estimate sections → structured PDF with cover, line items, signature blocks.
2. **Inspection photo section**: Add a new section type in estimate builder for photo grid with descriptions (reuse photo annotation data from LeadDetail).
3. **Profit margin display**: Show margin percentage next to total (simple calculation from line item cost vs. price). Could be a toggle in estimate settings.

---

## 4. Content / Marketing (Compare to Rooftops.ai)

### What Rooftops.ai Shows

**Homepage value prop** (rooftops.ai):
- "AI Roof Reports in 30 Seconds" — primary positioning
- Three-step workflow hero: Enter Address → Get Instant Report → Send & Close
- 6 feature cards in grid:
  1. **AI Roof Measurements** — satellite-powered with facet counts, pitch analysis, square footage
  2. **Instant Cost Estimates** — material and labor costs auto-calculated from user's pricing
  3. **One-Click Proposals** — generate professional proposals, send directly to homeowners
  4. **AI Assistant** — "Ask questions, draft emails, and get help with any roofing task"
  5. **Lead Follow-up** — automated follow-up sequences converting leads to signed contracts
  6. **Solar Analysis** — upsell solar with potential analysis (Coming Soon badge)

**AI Employees concept** (new 2026, in waitlist):
- Named AI personas with avatar initials: Marcus (Sales), Aisha (Marketing), Elena (Estimating), Ryan (Insurance)
- Each handles specific business functions 24/7
- Starting at $199/month
- Capabilities: automated lead follow-up, content & SEO creation, social media management, 24/7 customer responses

**Consulting program** ($5,000 for 5 weeks, 4 spots/month):
- Week 1: AI Audit & Strategy → Week 2: Property Analysis System → Week 3: AI Sales & Estimating → Week 4: Marketing Automation → Week 5: Deploy & Scale
- "6 months of Rooftops AI Premium included"
- Powered by: Google Maps, Solar API, Satellite Imagery, GPT-5

**Key pivot**: Rooftops.ai has moved from standalone "creator studio" content tool to AI-first platform with automated roof reports, proposals, and AI employee personas. Content generation is embedded into the proposal/report workflow — not a separate content studio.

**Legacy product** still accessible at legacy.rooftops.ai (linked from homepage banner).

### What StormLeads Currently Shows
- Content Studio with 5 content types: social media posts, door hangers, email campaigns, blog posts, ads
- 4 tone options (professional, casual, urgent, friendly), 10 merge variables
- Batch mode (generate 5 variations at once)
- Library tab with search and filter for saved content
- Copy to clipboard
- Stored in localStorage only (no cloud persistence)

### Specific Gaps to Close

| Gap | Rooftops.ai | StormLeads | Priority |
|-----|-------------|------------|----------|
| **Cloud persistence** | Server-side content storage | localStorage only (lost on browser clear) | **HIGH** |
| **AI roof report generation** | 30-second satellite report with measurements | Manual roof measurement display from Google Solar | LOW (requires paid satellite API) |
| **One-click proposal from content** | Content feeds directly into proposal sending | Content Studio and Estimates are separate workflows | MEDIUM |
| **AI assistant chat** | Natural language assistant for drafting, answering questions | No conversational AI interface | MEDIUM — future |
| **Automated lead follow-up** | AI-driven sequence automation | Drip sequences (15-min cron, rule-based auto-enrollment) | StormLeads already competitive |

### Recommended Improvements
1. **Cloud content persistence** (high priority): Move Content Studio library from localStorage to a `content_library` DB table: `tenant_id`, `type`, `tone`, `title`, `content`, `created_at`.
2. **Content → Estimate bridge**: "Use in Estimate" button in Content Studio that opens estimate builder with content pre-filled as introduction page.
3. **AI chat assistant**: Future consideration — conversational interface for CRM operations and content generation.

---

## 5. Work Orders / Production (Compare to RoofLink)

### What RoofLink Shows

**7-step linear workflow** (rooflink.com, powered by SalesRabbit platform):
1. **Target** — Territory mapping, storm-based lead identification, weather/radar data overlay
2. **Measure** — Satellite roof measurements via Hover/EagleView, gutter takeoff, fence measurements — no climbing
3. **Estimate** — Auto-generated estimates with real-time profit margin visibility, exact material need calculations
4. **Approve** — Back-office verification and job approval workflow gate
5. **Order** — Automatic supplier POs to SRS Distribution, crew work order generation
6. **Install** — Templated installation checklists, photo prompts by inspection line items, issue tracking
7. **Collect** — Payment processing for retail and insurance jobs via Stripe

**Product page visuals** (rooflink.com/roofing-crm/):
- Mobile phone mockup (524×1024 screenshot) showing CRM app interface
- iPad mockup showing project management dashboard
- Feature icons: Project Management, Mobile Accessibility, Weather Integration, Roofing Proposals, Lead Tracking & Conversion, Analytics & Reporting
- Stats: 12M homes/businesses served, 2M+ estimates created, 24 core feature improvements

**SalesRabbit + Roofle acquisition** (Jan 2026):
- RoofLink is now part of unified platform: SalesRabbit (field sales, 85K+ users) + RoofLink (production/CRM) + Roofle (instant online pricing, AI-assisted financing, digital proposals)
- First "end-to-end contractor growth platform" covering: online buying → field selling → production

**Production workflow patterns** (from articles and CRM page):
- "Track jobs from inspection to install without shuffling papers"
- "Integrate estimating, measurements, and contracts into one smooth workflow"
- Material inventory management tied to estimates
- Photo collection organized by inspection line items
- Insurance documentation: adjuster details, claim notes, photos, communication in one place
- "Profit-first compensation tracking" — commission tied to gross profit margin

### What StormLeads Currently Shows
- 4-column kanban: Pending / Scheduled / In Progress / Completed
- Drag-drop status changes
- Milestone management with progress bars
- Photo upload per milestone
- Editable fields (title, desc, assignee, crew, dates, times, notes)
- Create from estimate, line items display (read-only)

### Specific Gaps to Close

| Gap | RoofLink | StormLeads | Priority |
|-----|----------|------------|----------|
| **Templated checklists** | Pre-built install checklists with photo prompts per line item | Milestones only, no template system | MEDIUM |
| **Auto PO to suppliers** | Automatic material POs generated from estimate line items | Material catalog exists but no auto-PO from WO | MEDIUM |
| **Back-office approval step** | Explicit approval gate before ordering/installing | No approval workflow gate | LOW |
| **Line item editing in WO** | Full line item management in work orders | Line items read-only in WO detail modal | MEDIUM |
| **Photo per line item** | Required photo for each checklist/inspection item | Photos are per-milestone only | LOW |
| **Insurance claim workflow** | Adjuster details, claim notes, photos organized per claim | Insurance info in LeadDetail but not structured in WO | LOW |

### Recommended Improvements
1. **Work order line item editing**: Allow adding/editing/removing line items within the WO detail modal (currently read-only from parent estimate).
2. **Milestone templates**: Template system for milestones — pre-built sets for common job types (e.g., "Residential Reroof": tear-off, install, cleanup, final inspection).
3. **Auto-populate material order**: Button in WO to create a material order pre-filled from the WO's line items.

---

## 6. Dashboard / Reports (Compare to JobNimbus + RoofLink)

### What JobNimbus Shows

**Dashboard** (from YouTube demo walkthrough and product description):
- Homepage shows tasks, jobs overview, and quick-add buttons
- Customizable tile layout — "you can drag drop change the order of things remove things that might not be relevant to you or add more tiles"
- Multiple dashboard presets per role — "you might like a traditional sales dashboard... versus an administrator dashboard where you have everything that is forecasted to close"
- Available tiles: Pipeline overview, agenda/task list, recent activity, forecasted-to-close, closed previous month, revenue metrics
- "Latest actions" section with email sync indicator (blue ribbon prompt)
- Task list split: past due, due today, upcoming

**Insights / Reports** (from product page and G2):
- "Visualize trends and stats with custom reports"
- "Efficiency reports — See all your jobs in production and find out how to improve efficiency"
- G2 screenshot labeled "Make data-driven decisions" showing analytics dashboard with charts
- Users consistently complain that the new "Insights" is "AWFUL" — a known pain point for JN users
- "Classic Reports" learning page still maintained (implies old reports were better)

**From Pipeline CRM demo** (detailed comparable patterns from YouTube transcript):
- Seven pre-built reports customizable with different X/Y axes
- Axes selectable from any system field OR custom field
- Goals: individual, team, and company-level with attainment tracking and periodic updates
- "Performance polls" for creating custom goal types beyond the six defaults
- Reports addable as dashboard tiles for at-a-glance viewing
- Multiple pipeline views via dropdown selector
- Bulk email open rate and click rate tracking per campaign

### What StormLeads Currently Shows
- 4 KPI stat cards (pipeline value, new leads, close rate, avg days to close) with week-over-week change indicators
- Pipeline funnel visualization
- Mini storm map (Mapbox)
- Storm activity feed with 24h/7d/30d filter
- Today's tasks with checkbox toggle, follow-ups section
- Storm conversion rates (top 5), estimate summary (draft/sent/viewed/accepted)
- Team leaderboard table
- Reports page: 6 chart types (revenue area, pipeline bar, conversion radar, rep table, sources donut, stage duration line)
- Date range presets + custom dates, CSV export per chart

### Specific Gaps to Close

| Gap | JobNimbus | StormLeads | Priority |
|-----|-----------|------------|----------|
| **Customizable dashboard tiles** | Drag/drop/remove/add tiles, multiple dashboards per role | Fixed layout | LOW |
| **Comparison periods** | Previous period comparisons in reports | Week-over-week on stat cards only, no chart comparisons | MEDIUM |
| **Custom report axes** | Choose X and Y axes from any field | Fixed chart configurations | LOW |
| **Goals/targets** | Individual, team, company goals with attainment % | No goal-setting system | MEDIUM |
| **Drill-down on charts** | Click chart element to see underlying records | No drill-down navigation | MEDIUM |
| **Per-job profit dashboard** | "Profit Tracker" — real-time cost breakdowns | Expenses + job costing in LeadDetail only | LOW |

### Recommended Improvements
1. **Comparison periods** (medium priority): Dual-fetch previous period data + calculate deltas + display trend arrows on each report chart.
2. **Revenue/goal tracking**: Monthly revenue target in Settings → progress bar on Dashboard.
3. **Chart drill-down**: Click bar segment or funnel stage → navigate to filtered lead list showing those records.

---

## 7. Communication (Compare to JobNimbus)

### What JobNimbus Shows

**Engage Texting** (G2 screenshots show iPhone mockup with chat-bubble interface):
- Shared SMS inbox with multiple phone numbers per account
- Manual and automated text messaging
- Chat-bubble interface (native app)
- Pricing: $49/mo (Basic), $149/mo (Standard), $249/mo (Premium) + $20 setup
- Text-to-Pay: send payment link via SMS for instant collection

**Email**:
- "Complete bidirectional sync with both G suite and Outlook Exchange"
- All sent/received emails stored per job record automatically
- Emails with attachments auto-stored in file section
- Email templates with merge tags (first name, address, etc.)
- Bulk email to filtered lists
- Email campaigns: series of conditional emails with triggers, entry/exit criteria
- HTML newsletter support
- Open rate and click rate tracking per campaign/bulk email

**Other communication features:**
- **Caller ID** — greet customers by name on incoming calls (iOS + Android)
- **@mentions** — tag team members in notes for collaboration
- **Job share** — live link for customers/partners to track job progress
- **Notification center** — centralized notifications hub
- **Review requests** — automated on job completion
- **AssistAI** — AI phone answering agent, $298/agent/month + per-minute usage

### What StormLeads Currently Shows
- SMS via native `sms:` protocol link (opens phone's SMS app, not in-app)
- Email sending via SMTP integration in Settings
- Drip sequences (15-min cron, auto-enrollment, step progression)
- Google review request (completed jobs)
- Notification system (10 categories, multi-channel, preferences, polling)
- Client status page (public link for customer to track job progress)

### Specific Gaps to Close

| Gap | JobNimbus | StormLeads | Priority |
|-----|-----------|------------|----------|
| **In-app SMS** | Full SMS inbox with chat bubbles, shared numbers | Native `sms:` protocol only (leaves app) | **HIGH** for retention |
| **Email sync** | Bidirectional Gmail/Outlook sync per job | SMTP send only, no inbox integration | MEDIUM |
| **Open/click tracking** | Per-campaign analytics | No email engagement tracking | MEDIUM |
| **Text-to-Pay** | Payment collection via SMS link | No payment collection | MEDIUM |
| **Caller ID** | Greet by name on calls | Not applicable (web-only) | N/A |

### Recommended Improvements
1. **In-app SMS** (highest-impact communication feature): Twilio integration (~$0.0075/msg). Thread UI per lead + send/receive endpoints. Enables text-based follow-up without leaving app.
2. **Email open tracking**: Add tracking pixel to outgoing drip emails. Store open/click events per drip step for analytics.

---

## 8. Cross-Cutting UI Patterns & Design Language

### Design Comparison

| Aspect | JobNimbus | HailTrace | RoofLink | Rooftops.ai | StormLeads |
|--------|-----------|-----------|----------|-------------|------------|
| **Theme** | Light, professional blue/white | Dark satellite base, bright swath overlays | Light/clean, mobile-first | Dark gradient hero, clean sections | Dark mode, glassmorphism, oklch |
| **Navigation** | Left sidebar: Dashboard, Contacts, Jobs, Calendar, Documents, Reports | Top nav bar + map-centric | Mobile bottom nav | Minimal top nav | Collapsible left sidebar |
| **Card design** | Minimal white cards, text + progress indicators | Map-centric with data overlays | Feature icon + brief text | Feature grid with icons | Glass cards with backdrop-filter |
| **Data density** | High — Excel-like list views, customizable columns | Medium — map + asset list | Medium — step workflow | Low — AI-first minimal | High — tables + kanban + charts |
| **Mobile** | 4.8-star native app (5,000+ reviews) | Native iOS + Android app | Mobile-first responsive | Responsive web | Responsive web (no native app) |

### What Makes Each Competitor's UI Effective

1. **JobNimbus**: Everything connects to a "Job" record — estimates, invoices, photos, notes, tasks all visible from one page. The three-board paradigm (Sales/Production/Billing) maps to how contractors think about workflow. Excel-like list views feel familiar to users migrating from spreadsheets.

2. **HailTrace**: The map IS the product. Everything radiates from geographic location. Storm severity visualization (star ratings, color graduation) helps users instantly prioritize where to canvass. Daily meteorologist forecasts create urgency and habit.

3. **RoofLink**: The 7-step linear workflow (Target→Collect) makes the entire job lifecycle visible and sequential. Users always know "what's next." Profit-first positioning (margin visibility at every step) appeals to business-minded owners.

4. **Rooftops.ai**: AI-first approach — enter address, get report, send proposal. Minimal steps between data and action. Named AI personas (Marcus, Aisha) make automation feel like "hiring" rather than "configuring."

### StormLeads Differentiators to Preserve

These competitive advantages should NOT be changed:
- **Free storm data** — no per-map or per-download charges (vs. HailTrace $999-1,999/yr)
- **Built-in lead scoring** — 7-factor algorithm included free (competitors charge extra or don't offer)
- **Glassmorphism design** — modern, distinctive look vs. generic SaaS blue/white
- **Integrated content studio** — only Rooftops.ai has content generation; JN, HailTrace, RL don't
- **Photo annotation built-in** — no CompanyCam subscription ($19-29/user/mo) needed
- **FEMA disaster history** — unique data source integration no competitor has
- **Solar potential analysis** — matches Rooftops.ai upcoming feature, ahead of JN/HailTrace/RL
- **Three pipeline board views** — matches JN's Sales/Production/Billing paradigm
- **Conversion rate badges** — unique pipeline insight no competitor shows between columns

---

## Summary: Top 10 Actionable Improvements (Prioritized by Effort/Impact)

| # | Improvement | Competitor Source | Effort | Impact |
|---|-------------|-------------------|--------|--------|
| 1 | **Hail swath color graduation by severity** | HailTrace star/color system | Low | High |
| 2 | **Mobile pipeline list view** | JobNimbus mobile app | Low | High |
| 3 | **PDF export for estimates** | JobNimbus/SumoQuote PDF generation | Medium | High |
| 4 | **Content Studio cloud persistence** | Rooftops.ai server-side storage | Low | High |
| 5 | **Comparison periods in reports** | JobNimbus + Pipeline CRM | Medium | Medium |
| 6 | **Inspection photo pages in estimates** | SumoQuote inspection page type | Medium | High |
| 7 | **Work order line item editing** | RoofLink production workflow | Low | Medium |
| 8 | **Saved filter presets in pipeline/leads** | JobNimbus saved list views | Low | Medium |
| 9 | **Revenue/goal targets on dashboard** | JobNimbus goals + attainment | Low | Medium |
| 10 | **In-app SMS via Twilio** | JobNimbus Engage texting | High | High |

---

*Research conducted via live Firecrawl scraping on 2026-03-28. All UI descriptions based on publicly available marketing pages, help center documentation, G2 review screenshots, and YouTube tutorial transcripts. No competitor accounts were accessed.*
