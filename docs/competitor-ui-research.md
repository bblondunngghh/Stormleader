# Competitor UI Research — Visual Comparison

**Date:** 2026-03-27 (refreshed with new scrapes)
**Method:** Firecrawl scraping of competitor websites, help centers, product pages, and knowledge bases
**Sources:** hailtrace.com, jobnimbus.com, sumoquote.com, rooflink.com, rooftops.ai, support pages, review sites
**Companion doc:** `docs/competitor-gap-analysis.md` (text/feature analysis — not duplicated here)

---

## 1. Storm Map (compare to HailTrace)

### What HailTrace Shows

**Map Interface:**
- Full-screen interactive map with storm swaths rendered as colored polygons
- Each storm event page (e.g., `/hail-maps/10-15-2025`) shows: storm type (hail/wind/tornado/hurricane), impacted states count, impacted cities count, estimated affected structures
- Maps are meteorologist-verified (15+ in-house meteorologists), not algorithm-only — this is their core differentiator
- Storm swaths are color-graded by severity (hail size / wind speed)
- Users can overlay multiple storm dates on the same map to find "honey holes" — areas with repeated storm hits

**Property Data on Map:**
- Properties displayed as pins on the map with asset filtering
- Asset filters include: "Assigned to User", "Created At", "Created By User", "Updated At", "Updated By", "Status" (Door Knock #1, Monitor for Storm, etc.), "Stage" (Prospect, Lead, Closed), "Last Impact Date", shingle type
- Pins can be filtered on both the Map page (visual) and Asset page (list view)
- NEW: Filtered assets can be exported to CSV for offline work or CRM import
- Properties linked to Contacts and Opportunities (pipeline stages)

**Honey Hole Finder:**
- Searches an area across multiple storm dates to find zones with repeated severe weather impacts
- Higher risk = higher damage probability = better canvassing targets
- Presented as a map overlay highlighting high-frequency impact zones

**Dashboard:**
- Revenue tracking with real-time statistics
- Weekly performance metrics
- All leads in a single view
- Data-based decision support with visual charts
- Screenshot at `cdn.hailtrace.com/images/home/dashboards.png` shows: revenue chart, lead pipeline, weekly metrics sidebar

**Pipeline:**
- "Opportunities pipeline" with customizable stages
- Assets (properties) linked to pipeline opportunities
- Stage filtering (Prospect → Lead → Closed) available on both map and list views

### What StormLeads Currently Shows
- Hail/wind/tornado/thunderstorm layers on Mapbox
- FEMA NSI properties at zoom 14+ with address/owner/value/year
- Honey hole heatmap overlay (NOAA SWDI 10+ years)
- Time range filter (30d - all), layer toggles, transparency slider
- Click-to-add-lead from property popup

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **Storm swath color graduation by severity** | HIGH | HailTrace color-grades swaths by hail size/wind speed. Our swaths are uniform color. Add graduated fill: green (1") → yellow (1.5") → orange (2") → red (2.5"+) for hail |
| **Multi-date overlay for honey holes** | MEDIUM | HailTrace lets users stack multiple storm dates. Our honey hole finder shows aggregate heat — add ability to toggle individual storm dates on/off |
| **Property filtering on map** | HIGH | HailTrace filters properties by stage, assigned rep, last impact date, shingle type directly on the map. We show all properties uniformly. Add filter controls to the map sidebar |
| **Affected structure count per storm** | LOW | HailTrace shows "estimated number of affected structures" per storm event. Nice-to-have metric for storm detail panels |
| **CSV export of filtered map properties** | MEDIUM | HailTrace's new feature lets users export filtered assets to CSV. We have CSV export in LeadList but not from the map view |

---

## 2. Pipeline/CRM (compare to JobNimbus)

### What JobNimbus Shows

**Board System (3 separate boards):**
1. **Sales Boards** — "See all your leads and jobs on one board, with estimated totals and more." Kanban columns for each sales stage with deal value visible per card and per column total
2. **Production Boards** — "See all your jobs in production on one board — including where they're getting stuck." Separate kanban for production workflow stages
3. **Billing Boards** — "See all your completed jobs on one board, and use it to easily collect final payment." Third kanban focused on payment collection status

**Key UI elements per board:**
- Drag-and-drop cards between stages
- Estimated totals visible on each column header
- Custom workflows per job type (e.g., residential retail vs insurance roofing)
- Column-level metrics showing bottlenecks
- Cards show: contact name, address, job type, estimated value, days in stage

**Custom Workflows:**
- Users create different workflow templates for different job types
- Sales automation: "When a proposal is signed, move the job to 'Sold'"
- Production automation: "When a job is scheduled, send an email to customer"

**Profit Tracker:**
- Real-time per-job profitability tracking
- Revenue vs expenses breakdown
- Visible in job detail and dashboard

### What StormLeads Currently Shows
- Single kanban board with drag-drop stage changes
- Cards show: name, address, priority badge, source badge
- Mobile board/list toggle
- Collapsible columns
- Filter by priority/source/rep

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **No deal value on pipeline cards** | CRITICAL | Every competitor shows dollar amounts on kanban cards. Add estimate total or pipeline value to each card. Show column totals in headers |
| **Single board for everything** | HIGH | JN separates Sales/Production/Billing into 3 boards. Add board tabs or a board selector dropdown to Pipeline.jsx. Each board type shows different stages |
| **No days-in-stage indicator** | MEDIUM | JN surfaces bottlenecks by showing how long jobs sit in a stage. Add a "X days" badge to cards and highlight stale ones (>7 days = yellow, >14 = red) |
| **No column-level metrics** | MEDIUM | JN shows count + total value per column header. Add "12 leads · $45,200" to each column header |
| **No automation triggers on stage change** | MEDIUM | JN auto-moves jobs and sends emails on stage transitions. Our drip engine exists but isn't triggered by pipeline stage changes (only lead creation/estimate sent) |

---

## 3. Estimates (compare to JobNimbus/SumoQuote + RoofLink)

### What JobNimbus/SumoQuote Shows

**Estimate Builder (multi-page document system):**
- **Cover Page** — Company logo, customer home photo (pulled from job), certification badges, auto-populated customer info, custom name, date
- **Introduction Page** — Rich text editor with bold/italic/lists/links, "Insert Token" for merge fields (auto-inserts customer name, address, etc.), custom field tokens, save as template
- **Inspection Page** — Photo sections with multiple layout styles (side-by-side, grid, full-width), drag-to-reorder photos, descriptions per photo, photos pulled from job record or device upload, multiple sections
- **Estimate Details** — Good/Better/Best options (up to 3 tabs), sections with line items synced from Products & Services, drag-to-reorder items, per-section visibility toggle (eye icon), profit margin slider, discount button, tax rate application, total price override, notes field, save as template
- **Signing & Upgrades** — Disclaimers section, upgrade line items with profit margin, deposit request toggle with amount/description, auto-populated signer info, up to 4 additional signers, product selection fields (e.g., shingle color dropdown), footer notes
- **Terms and Conditions** — Separate legal page
- **Warranty** — Dedicated warranty page
- **Custom Pages** — User-created additional pages

**Key UX patterns:**
- Left sidebar shows page list with show/hide toggles and drag-to-reorder
- Two modes: Standard Estimate (multi-page) and Simple Estimate (one-page)
- Templates for individual pages AND full layouts (collection of page templates)
- Auto-save on all edits
- "Page Settings" gear icon on each section for display options
- Product name/description display toggle (both, name only, or description only)

**SumoQuote specific stats:**
- $2,078 average upgrades sold per signed quote
- 64% average increase in competitive close rate
- 0 days customer wait time for quote
- Key selling tools: Brand cover page, integrations, photos, pricing options, financing, eSigning

### What RoofLink Shows

**Estimate System:**
- Auto-generated estimates from satellite roof measurements
- Real-time profit margin visibility built into estimate generation
- Good/Better/Best estimate options shown on mobile screen
- "Living file" concept — estimate updates as job progresses
- One-click supplier PO generation from approved estimate
- Crew work order auto-generation from estimate
- Mobile-first: reps generate estimates at the door in 5-10 minutes

### What StormLeads Currently Shows
- Full builder with 10+ sections
- Templates with merge fields
- Discounts, profit margin calc
- Multiple signers, financing integration
- Materials catalog
- Print, send, duplicate

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **No inspection photo page in estimates** | HIGH | JN/SumoQuote has a dedicated inspection page with multiple photo layouts (side-by-side, grid, full-width). Add photo section type to estimate builder with layout options |
| **No Good/Better/Best estimate options** | HIGH | Both JN and RoofLink show 2-3 estimate tiers side by side (tabs in JN, cards in RoofLink). Add option tabs to estimate builder with "include all items from" base option |
| **No cover page with customer photo** | MEDIUM | JN generates a branded cover page with the customer's home photo. Add optional cover page section to estimate builder |
| **No page-level show/hide and reorder** | MEDIUM | JN's left sidebar lets users toggle and reorder estimate pages. Our sections exist but lack visual page management |
| **No estimate-to-work-order flow** | MEDIUM | RoofLink auto-generates supplier POs and crew work orders from approved estimates. We have "create from estimate" for work orders but no supplier PO integration |
| **No PDF export** | HIGH | Both competitors generate professional PDFs. Currently browser print only. Add pdfmake generation |

---

## 4. Content/Marketing (compare to Rooftops.ai)

### What Rooftops.ai Shows

**AI Creator Studio:**
- "Professional content and strategy generated in seconds saving you thousands each year"
- Content types:
  - **Social Media Content** — Schedule posts across platforms, keeping social media active and engaging
  - **Landing Page Creator** — Build landing pages (described as "track engagement metrics")
  - **Strategy Docs** — AI-driven content ideas that resonate with target audience
  - **Creator Library** — Store and manage generated content
- Fine-tuned GPT specifically for contracting/trade businesses ("Rooftops GPT")
- "Like ChatGPT but tailored just for your business"

**AI Employees (new product line):**
- "Hire AI-powered team members that work 24/7"
- Capabilities: automated lead follow-up, content & SEO creation, social media management, 24/7 customer responses
- Essentially AI agents for specific business tasks

**AI Roof Reports:**
- Enter any address → AI pulls satellite imagery → instant report with: roof area, pitch, facet counts, material recommendations, cost estimates
- One-click professional proposal generation from report
- Lead follow-up automation (drip sequences for leads)
- Solar analysis upsell built in
- 15,000+ reports generated, 2,000+ roofing pros

### What StormLeads Currently Shows
- Content Studio with 5 types (social/door hangers/email/blog/ads)
- 4 tones, 10 configurable variables
- Batch generation (5 variations)
- Copy-to-clipboard

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **No saved content library** | HIGH | Rooftops.ai has a "Creator Library" to save and manage content. Add save-to-library feature in Content Studio with search/filter |
| **No direct social posting** | MEDIUM | Rooftops.ai schedules posts across platforms. We only copy to clipboard. Consider integrating with social media APIs (free tier options exist for Buffer/Hootsuite) |
| **No AI strategy documents** | LOW | Rooftops.ai generates marketing strategy docs. Low priority but could be an AI content type to add |
| **Hardcoded example values in Content Studio** | HIGH | Current Content Studio uses hardcoded examples instead of pulling from company profile. Wire up company name, services, and location from Settings |

---

## 5. Work Orders/Production (compare to RoofLink)

### What RoofLink Shows

**7-Step Workflow Visualization:**
1. **Target** — Territory mapping + storm-based lead identification + weather/radar overlay
2. **Measure** — Satellite roof measurements (built-in drawing tool, no EagleView cost)
3. **Estimate** — Auto-generated with real-time profit margin, Good/Better/Best options
4. **Approve** — Back-office verification checkpoint with margin alerts (screenshot shows "Approve stage" with margin alert badges)
5. **Order** — Auto-triggers supplier POs to SRS Distribution + crew work order generation
6. **Install** — Templated checklists, photo prompts per inspection line item, issue tracking. Crews must upload photos of tear-off, underlayment, and final nail pattern before requesting payment
7. **Collect** — Payment processing (Stripe) for both retail and insurance jobs

**Production Pipeline UI:**
- Single digital timeline view unifying the entire workflow
- Materials section: connected directly to distributors, one-click ordering from approved estimate
- Crew work orders: precise instructions showing what to install, where, and payment amount — delivered to crew's phone
- Smart scheduling: assign crews based on availability and job type
- Real-time updates: see when materials drop and when crews work
- Photo verification: required photo checkpoints at each production milestone
- Dashboard shows "Approve stage" with margin alert indicators

**Key UI Pattern:**
- Production as a "checklist, not a mystery" — each step has clear requirements before the next step unlocks
- Gating: crews can't request payment until photos are uploaded
- The entire flow runs from a mobile-first interface

### What StormLeads Currently Shows
- 4-column kanban: Pending → Scheduled → In Progress → Completed
- Drag-drop stage changes
- Detail modal with milestones (% tracking)
- Create from estimate
- Team assignment, line items from estimates

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **Photo upload is a stub** | CRITICAL | RoofLink requires photo verification at each milestone. Our work order photo upload shows "coming soon" toast. Wire up existing document upload service to milestone photos |
| **Milestones are read-only** | HIGH | RoofLink has templated checklists per job type. Our milestones can't be created or edited by users. Add CRUD for milestone templates |
| **No gating/sequencing between steps** | MEDIUM | RoofLink gates progression (can't collect payment until photos uploaded). Add optional prerequisite rules: "Require photos before marking complete" |
| **No supplier PO from work order** | MEDIUM | RoofLink auto-generates supplier POs. We have SRS material ordering but it's separate from work orders. Link work order materials to SRS order flow |
| **No crew scheduling/capacity** | MEDIUM | RoofLink assigns crews based on availability. We assign teams but don't track crew availability/capacity |

---

## 6. Dashboard/Reports (compare to JobNimbus + RoofLink + HailTrace)

### What Competitors Show

**JobNimbus Dashboard:**
- Customizable classic dashboard with configurable widgets
- Users pick which reports appear on their dashboard
- Insights (newer reporting): custom reports with flexible filtering
- Built-in reports + custom report builder
- Profit Tracker: real-time per-job profitability

**JobNimbus Features Page describes:**
- Sales boards with "estimated totals" — dollar amounts visible across the board
- Production boards showing "where jobs are getting stuck" — bottleneck visualization
- Billing boards for payment collection status

**HailTrace Dashboard:**
- Revenue chart prominently displayed
- Lead pipeline visualization
- Weekly performance metrics in a sidebar
- Clean layout: main chart area + sidebar metrics + lead list

**RoofLink Dashboard:**
- Profit-first metrics: margin alerts on job approvals
- Revenue vs overhead visualization
- Per-job profitability
- Break-even point tracking for seasonal planning

### What StormLeads Currently Shows
- 4 stat cards: pipeline value, new leads, close rate, avg days to close
- Pipeline funnel bars
- Mini storm map
- Storm activity panel (24h/7d/30d)
- Today's tasks, activity feed
- Storm conversion panel, estimates summary
- Team leaderboard

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **No customizable dashboard widgets** | MEDIUM | JN lets users choose which reports appear on dashboard. Add widget picker or drag-to-reorder for dashboard panels |
| **No per-job profit tracking** | HIGH | Both JN (Profit Tracker) and RoofLink show real-time per-job profitability. We have revenue/expenses/profit in LeadDetail but no aggregate profit dashboard widget |
| **No bottleneck visualization** | MEDIUM | JN production boards show "where jobs are getting stuck." Add stage duration highlighting — stages with above-average dwell time get flagged |
| **No comparison periods (YoY/MoM)** | MEDIUM | Reports show current data only. Add "vs previous period" comparison |
| **No report export** | HIGH | No CSV or PDF export from Reports. Add download buttons per chart |
| **Dashboard panels not drillable** | LOW | Clicking a stat card doesn't navigate to filtered detail. Add click-through to filtered views |

---

## 7. Communication (compare to JobNimbus)

### What JobNimbus Shows

**Engage Texting:**
- Shared inbox for SMS with multiple phone numbers
- Manual + automated texting ($49/$149/$249/mo tiers)
- Text-to-Pay: send payment link via SMS

**Email:**
- Send/receive email within CRM
- Automated emailing on triggers

**AssistAI ($298/agent/month):**
- 24/7 AI phone answering, books appointments, captures lead data
- All call data syncs to CRM automatically

**Scout (Beta):**
- Mobile AI assistant for voice/text CRM commands

### What StormLeads Currently Shows
- SMTP email config with drip sequences
- Estimate/invoice/contract emails
- Notification system (10 categories, multi-channel)

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **No SMS/texting** | HIGH | JN's Engage is a major selling point. Consider Twilio integration (pay-per-message fits our cheap ethos). Even basic outbound SMS for appointment reminders |
| **No Text-to-Pay** | MEDIUM | JN sends payment links via SMS. Once we have SMS + online payments, this becomes straightforward |

---

## 8. Invoicing & Payments (compare to JobNimbus + RoofLink)

### What Competitors Show

**JobNimbus:**
- Create invoices from estimates in one click
- Online payments (credit/debit + ACH/eCheck)
- Text-to-Pay via SMS
- Next-day funding
- QuickBooks sync (Online, Desktop, Server)
- Billing boards (kanban for payment status)

**RoofLink:**
- Stripe integration for retail and insurance jobs
- Payment processing as final step of 7-step workflow

### What StormLeads Currently Shows
- Invoice list with status filter + KPIs
- Line items, tax calc, discounts
- Manual payment recording
- Create from estimate, Hearth financing

### Gaps to Close

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| **No online payment on invoices** | CRITICAL | Both competitors accept online payments. We have Stripe on PublicEstimate but not invoices. Extend Stripe payment intent to invoice send flow |
| **No payment reminders/dunning** | HIGH | JN automates billing reminders. Add overdue invoice trigger to drip engine |
| **No QuickBooks sync** | MEDIUM | JN syncs with QB. Consider QB Online API integration |

---

## Summary: Top 10 Visual/UX Improvements by Priority

| # | Improvement | Competitor Reference | Effort |
|---|------------|---------------------|--------|
| 1 | **Add deal value to pipeline cards + column totals** | JobNimbus Sales Boards | Low |
| 2 | **Wire online payments to invoices** | JobNimbus Payments + RoofLink | Medium |
| 3 | **Implement work order photo upload** | RoofLink Install step | Low |
| 4 | **Add Good/Better/Best estimate options** | JN/SumoQuote + RoofLink | Medium |
| 5 | **Storm swath color graduation by severity** | HailTrace hail maps | Medium |
| 6 | **Property filtering on storm map** | HailTrace asset filtering | Medium |
| 7 | **PDF export for estimates/invoices/contracts** | All competitors | Medium |
| 8 | **Add inspection photo page to estimates** | SumoQuote Inspection page | Medium |
| 9 | **Content library for saved AI content** | Rooftops.ai Creator Library | Low |
| 10 | **Report export (CSV/PDF) + comparison periods** | JobNimbus Insights | Medium |

---

## Appendix: Screenshot/Image URLs from Competitor Sites

These URLs from competitor marketing pages contain actual product UI screenshots:

**HailTrace:**
- Dashboard: `cdn.hailtrace.com/images/home/dashboards.png`
- Hail maps: `cdn.hailtrace.com/images/home/hail-maps.png`
- Customization: `cdn.hailtrace.com/images/home/flexibility.png`
- Asset filtering tutorial video: `youtube.com/watch?v=YDcaJaou-ZY`

**RoofLink:**
- Production page: `rooflink.com/wp-content/uploads/2026/02/RL_Production_Page.png`
- Materials ordering: `rooflink.com/wp-content/uploads/2026/02/RL_Production_Page_Materials.png`
- Crew management: `rooflink.com/wp-content/uploads/2026/02/RL_Production_Page_Crews-1.png`
- Approve stage with margin alerts: `rooflink.com/wp-content/uploads/2026/02/RL_WBlueprint_Page-04`
- Good/Better/Best estimates: `rooflink.com/wp-content/uploads/2025/12/RL_Multiple_estimate__Good_Better_best_.png`
- Weather/territory targeting: `rooflink.com/wp-content/uploads/2025/12/RL_Weather_Page_HERO.png`
- Satellite measurements: `rooflink.com/wp-content/uploads/2025/12/RL_measure_page_png_Drawing_-1.png`
- Full platform webinar: `youtube.com/watch?v=pCy4mDPJF6I`

**JobNimbus/SumoQuote:**
- Estimate layout selector: `support.jobnimbus.com/hs-fs/hubfs/Screenshot%202024-11-14%20at%2012-44-27%E2%80%AFPM-png.png`
- Cover page builder: `support.jobnimbus.com/hs-fs/hubfs/image-png-Feb-12-2025-10-07-10-5693-PM.png`
- Introduction page: `support.jobnimbus.com/hs-fs/hubfs/image-png-Feb-13-2025-06-21-44-3930-PM.png`
- Inspection page: `support.jobnimbus.com/hs-fs/hubfs/image-png-Feb-13-2025-08-18-51-2029-PM.png`
- Estimate details with margin slider: `support.jobnimbus.com/hs-fs/hubfs/Screenshot%202025-09-02%20at%208.47.27%20AM.png`
- Signing page: `support.jobnimbus.com/hs-fs/hubfs/image-png-Dec-17-2025-09-43-36-8846-PM.png`
- SumoQuote 10-min demo: `youtube.com/watch?v=xywwszN5cEw`
- CRM review video: `youtube.com/watch?v=eS4qevw85Rk`
