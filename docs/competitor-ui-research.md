# Competitor UI Research — Visual Comparisons

**Date:** 2026-04-02 (refreshed — all competitor sites re-scraped via Firecrawl CLI)
**Methodology:** Firecrawl search + scrape of competitor websites, product pages, help center docs (HailTrace Zoho KB, SumoQuote docs.sumoquote.com), review sites (Capterra, G2), YouTube demo videos, and integration partner pages.
**Competitors:** HailTrace, JobNimbus (+ SumoQuote), RoofLink (+ Roofle), Rooftops.ai, QuoteIQ
**Companion doc:** `docs/competitor-gap-analysis.md` (text feature analysis — not duplicated here)

---

## 1. Storm Map (HailTrace vs StormLeads)

### What HailTrace Shows (verified via hailtrace.com, hailtrace.zohodesk.com KB, YouTube)

**Map Interface:**
- Full-screen interactive map with storm swath polygons overlaid on satellite/street imagery
- Left sidebar with **Maps** tab (browser app) or bottom tab bar (mobile app)
- Search bar at top for location/address lookup
- **State filter dropdown** — multi-select "Filter by states"
- **Date range picker** — MM/DD format with start/end selectors
- **Pagination controls** — Prev/Next for browsing the storm archive
- Storm archive at hailtrace.com/hail-maps shows preview cards: map thumbnail image (from cdn.hailtrace.com/storm-image-previews/), date, affected states + cities, storm type badges (Hail / Wind / Tornado), "More Info" link

**Color/Severity System:**
- **Star rating system (1-5 stars)** per storm map — factors: number of affected properties, maximum hail size, initial probability of finding damage. 5-star = year's most impactful storms
- **"Purple Zones"** indicate highest-severity areas — integration partners (SPOTIO, KnockBase) specifically reference routing crews to "Purple Zones first — the neighborhoods most likely to file claims and approve work"
- **Hatched-pattern layer** (unique to HailTrace) — highlights isolated hail swaths at a glance. YouTube video "Understanding Isolated Maps With Hatched Pattern" (BYEZBYlFKPg) demos this
- Swaths are color-graduated by severity (exact gradient is proprietary but the visual differentiation is a key selling point)
- Each map shows: hail size data, wind speed, affected property count, NOAA reports

**Toggle Map Layers (from Knowledge Base — hailtrace.zohodesk.com):**
- Right-hand side "Toggle Map Layers" button (browser app) or right-side toggle (mobile)
- Each layer has individual **Opacity sliders** (per-layer opacity control)
- "Confirm" button to apply layer changes
- Available layers include: Hail maps, Wind maps, Tornado maps, NOAA reports, Radar, Assets
- Same toggle works both from Maps tab and when searching weather events

**Property Data Popups:**
- Available as download packages (single property, storm swath area, or custom-drawn polygon)
- Data sourced from Cole Information, updated quarterly
- Fields: address, owner info, property details, weather history
- Separate residential vs commercial data plans
- **Asset Filtering** system: filter by Created At/By User, Updated At, Status (Door Knock #1, Monitor for Storm, Pending Claim), Assigned to User, Last Impact Date, Stage (Lead/Prospect/Closed)
- Export filtered assets to CSV spreadsheet

**Honey Hole Finder:**
- Load multiple historical storm swaths simultaneously on the same view
- Overlap areas where several storms hit the same region show as darker/denser overlays
- Layer transparency controls make it easy to spot intersection patterns
- Enables identifying "honey holes" — areas with repeated storm damage = higher close rates

**Dashboard (cdn.hailtrace.com/images/home/dashboards.png):**
- Revenue tracking widgets
- Weekly performance statistics
- Lead pipeline with customizable stages (Opportunities pipeline)
- Data-driven analytics for tracking leads in one place
- Customize data fields, asset pins, pipeline stages

**Mobile App:**
- Native iOS + Android apps with bottom tab bar navigation
- Maps tab, Assets tab, Pipeline tabs
- Storm tracking with live push notifications
- Same layer toggle and search functionality as browser app
- In-app inspection result tracking

**Color Scheme:**
- Dark green (#009344) accent on dark backgrounds (#203431)
- White content areas, light gray (#F0F0F0) secondary
- Light/dark theme toggle available in knowledge base portal

### What StormLeads Currently Shows

- Mapbox map with storm swath polygons (NOAA SPC/MRMS data)
- FEMA property overlay (tile-based, polygon intersection)
- County property overlay
- Honey Hole Finder (10-year SWDI hail history heat map)
- Layer toggle controls with time range filter (24h-30d)
- Swath opacity slider (single global slider)
- "Houses Only" toggle
- Property popups: address, owner, year built, sqft, roof type, hail risk score, 5-year hail chart
- Add-to-pipeline from popup
- Address search with StreetView
- Mobile storm feed sidebar

### Specific Gaps

| HailTrace Feature | StormLeads Status | Priority |
|---|---|---|
| Star rating per storm (1-5) | Not implemented | Medium — adds instant severity assessment |
| Purple Zone / color graduation by severity | Not implemented (uniform swath color) | **High** — #1 visual credibility gap |
| Hatched-pattern layer for isolated swaths | Not implemented | Medium — helps spot isolated events |
| Per-layer opacity sliders (vs single global) | Single global slider only | Medium — better layer control |
| Multi-swath overlay for Honey Hole analysis | Partially done (heat map, not swath overlay) | Low — heat map achieves similar goal |
| Meteorologist verification badges | Cannot replicate (human-dependent) | N/A |
| Storm archive cards with thumbnail previews | Storm Catalog exists but no thumbnail images | Low — catalog works differently |
| Residential/commercial data downloads | Not implemented (add-to-pipeline only) | Medium — CSV export of properties in swath |
| Asset filtering (status, stage, impact date) | Not implemented for map properties | Medium — useful for managing leads |
| Custom draw tool for area selection | Not implemented | Medium — useful for territory creation |

### Recommended Improvements

1. **Hail swath color graduation** — Implement graduated opacity/color by hail size: light green (<1"), yellow (1-1.5"), orange (1.5-2"), red (>2"). This is the single most impactful visual improvement for storm map credibility.
2. **Storm severity badges** — Add a 1-5 star or severity badge to each storm swath tooltip showing: max hail size, affected property estimate, damage probability. HailTrace's star system is immediately comprehensible.
3. **Per-layer opacity controls** — Replace single global opacity slider with individual sliders per layer (swaths, properties, heat map). HailTrace's KB shows this is a key UI element.
4. **"Download properties in area"** — Allow CSV export of all FEMA properties within a drawn polygon or storm swath. HailTrace sells this as a separate data plan — we can offer it free.

---

## 2. Pipeline / CRM (JobNimbus vs StormLeads)

### What JobNimbus Shows (verified via jobnimbus.com/product, support docs, YouTube demos)

**Boards (Kanban) Interface:**
- Columns called "Lists" — each List maps to one or more job statuses
- Cards are white boxes with customizable content via **short-code templates**
- **Card contents (configurable):**
  - Line 1: Contact/Job name (customizable via templates)
  - Line 2: Contact type, status info
  - Line 3: Financial data (e.g., "Sum of all Approved Invoices")
  - Additional lines: Balance due, custom fields
- **Fixed bottom row on every card (not customizable):**
  - Days in current status (number badge)
  - Task completion ratio (e.g., "3/5 tasks")
  - Attachment count (documents + photos)
  - Due date (if scheduling enabled)
  - Assignee profile pictures/initials + count badge
- **Column headers** can show aggregate totals: Estimate Total, Invoice Total, or Outstanding Invoice Total
- Drag-and-drop between Lists changes job status
- 14 distinct card types available
- 7 status columns standard

**Multiple Board Types:**
- Customizable project boards per workflow (Sales, Production, etc.)
- Up to 3 boards (Essentials), 5 (Pro), Unlimited (Premium/Enterprise)
- Template boards with pro tips

**Sales Dashboard (Insights):**
- KPI cards: Leads, Close Rate, Sold Deals (prominently displayed)
- Sales Pipeline Report: 3-stage funnel (Lead -> Estimating -> Sold) with contact/job counts
- Lead Source Report: lead count, sold count, sold rate per source
- Revenue Leaderboard — Sold: total approved/invoiced estimates per rep
- Deals Leaderboard — Sold: deal count per rep
- Average Deal Size — Sold: total revenue / total jobs
- Bar charts and leaderboard-style rankings
- Color-coded pipeline stages
- Filterable by: sales rep, job type, lead source
- 79+ insights references, 39+ report instances in docs
- User complaint: Insights "AWFUL" — often need to export to Excel

**Profit Tracker (jobnimbus.com/product/profit-tracker):**
- Per-job view accessible from Job detail -> Profit Tracker tab
- **Top metrics bar:** Revenue, profit figures, customizable via "View More" sidebar
- **Cost section:** Imported line items grouped by Manual Section or Cost Type, planned vs actual totals, drag-and-drop reorder, section management (duplicate/delete/rename)
- **Commissions panel:** Assign payouts to sales reps based on revenue or profit percentages
- **Metrics cards:** Draggable, up to 5 favorites pinned to main display
- Cost imports from: Estimates, Material Orders, Work Orders

**Mobile App UI (from jobnimbus.com three-phone showcase):**
- Left phone: Sales board with lead cards (card-row layout)
- Middle phone: Annotated roof photo with drawing tools (circles, arrows)
- Right phone: Calendar view with scheduled tasks/appointments
- 4.8-star rating from 5,000+ reviews (iOS + Android)

**Color Scheme:**
- Blue primary (#4D85E5, #3968c6, brand #2b5797) on light backgrounds (#ebf0fa)
- White cards on subtle blue-gray backgrounds
- Webflow-based website with SVG icons
- User complaint: "blues are so similar you can't easily see the slider bars"

**Feature Navigation (from jobnimbus.com/features mega-menu):**
- Features dropdown: Payments, Measurements, Mobile, Insights, Financing, Invoicing, Profit Tracker, AssistAI, Integrations, Estimates, Scout (BETA)
- Solutions dropdown: Sales, Communications, Production, Billing, Pro Services, Marketing

### What StormLeads Currently Shows

- 3 board tabs (Sales / Production / Billing)
- Drag-drop stage changes
- Conversion rates between columns
- Days-in-stage badges (color-coded)
- Task progress badges on cards
- Deal value per card + column totals
- Lead score badges + source badges on cards
- Financing status badges
- Priority indicators, hail size badges, due date badges
- Rep avatars
- Column collapse (localStorage)
- Mobile board + list views
- Filter by priority/source/rep with active filter pills
- CreateLeadModal inline

### Specific Gaps

| JobNimbus Feature | StormLeads Status | Priority |
|---|---|---|
| Customizable card templates (short-codes) | Not implemented — fixed card layout | Medium |
| Attachment/photo count on cards | Not shown | Low — quick visual aid |
| Per-job Profit Tracker tab (planned vs actual) | Expenses in LeadDetail | Medium |
| Commissions tracking per rep | Not implemented | Medium |
| Multiple board configurations per user | 3 fixed boards (good enough) | Low |

### Recommended Improvements

1. **Attachment/photo count badge on cards** — Small paperclip icon + count. Quick visual for "has this lead been documented?"
2. **Per-job profit view** — Show planned (estimate) vs actual (expenses) with a visual bar/gauge in LeadDetail. JobNimbus makes this a dedicated tab with drag-and-drop cost sections.
3. **Property thumbnail on card** — RoofLink shows property images on pipeline cards. Consider a small satellite/street view thumbnail.

### StormLeads Advantages Over JobNimbus

- Lead score badges (JN doesn't have scoring)
- Source badges on cards
- Conversion rates between columns
- Financing status badges
- Hail size badges
- 3 pre-built domain-specific boards (Sales/Production/Billing) vs JN's generic boards
- No per-board limits on any tier

---

## 3. Estimates & Proposals (SumoQuote + RoofLink vs StormLeads)

### What SumoQuote (JobNimbus) Shows (verified via docs.sumoquote.com, YouTube "SumoQuote 10 Minute Demo")

**Proposal Builder — Multi-Page Architecture:**
- Two modes: **Standard** (detailed multi-page) or **Simple** (one-page)
- Left sidebar shows **Pages** panel with draggable page types:
  1. **Cover Page** — Auto-populated date, primary image upload, company logo, certification/logo badge, color palette toggle for branding
  2. **Introduction Pages** — Formatted text with measurement tokens + text tokens for auto-fill dynamic content
  3. **Inspection Pages** — 4 photo layout styles:
     - **Standard** — photos stacked vertically with labels
     - **Side-by-side** — two photos per row
     - **Wide** — full-width photos
     - **Full** — photo fills entire page
     - Photos can be reordered via drag handles (3 horizontal lines)
     - Pencil icon under each photo opens annotation editor with zoom bar, drawing tools
     - Can import from CompanyCam or JobNimbus directly
     - Sections within inspection pages (photos cannot move between sections)
  4. **Quote Details Pages** — Good/Better/Best tabs (up to 3 options), line items synced from Products/Services catalog, organized into blue sections, per-line image support, hover actions for delete/edit, drag-reorderable with six-dot handles, discount/tax controls, profit margin slider
  5. **Authorization Pages** — Signature fields, deposit requests, product selections for upgrades
  6. **Terms & Conditions Page** — Standard legal text
  7. **Custom Pages** — PDF import, Canva library integration, user-defined content

**Template System:**
- 140+ template references across the platform
- Templates available for: text pages, Quote Details (line items), Authorization pages, full layouts
- Templates can be private (My Templates) or shared (Shared Templates)
- Email templates with merge tokens for sending

**Customer Experience:**
- Professional branded PDF output that reportedly influences vendor selection
- Financing option display for budget-conscious customers
- Typical workflow: take photos at property -> build quote on phone in 5 minutes

### What RoofLink Shows (verified via rooflink.com)

**Estimate Builder (from rooflink.com/roofing-estimate-software/):**
- Create up to **6 estimate options** per prospect
- **Good/Better/Best presentation** (shown as Silver/Gold/Platinum variants) side-by-side on mobile
- Screenshot shows three-column comparison on phone screen (RL_Multiple_estimate__Good_Better_best_.png)
- Real-time **Gross Profit margin** display overlaid on estimate cards — live calculations visible
- Auto-generated from satellite measurements — no manual measurement entry
- One-click material ordering from estimate -> SRS supplier PO
- "Living file" concept — one single data source flows through entire workflow
- Dashboard view highlights profit protection with live material pricing

### What StormLeads Currently Shows

- Estimate builder with line items + SRS catalog integration
- Template system with saved templates
- RichTextEditor for custom sections
- Discount management (% or $), tax rate selector
- Multi-signer authorization
- Auto-save (2s debounce)
- Send-for-signing modal with email templates + merge tokens
- Good/Better/Best tier generation + comparison view (side-by-side)
- Financing plan selection (Hearth integration)
- Section images
- Duplicate estimate, print/PDF (window.print)

### Specific Gaps

| Competitor Feature | StormLeads Status | Priority |
|---|---|---|
| Cover page with branding (logo, colors, property photo) | Not implemented | **High** — first impression |
| Inspection photo pages in proposal (4 layout styles) | Not implemented | **High** — key sales tool |
| Photo annotation within proposal builder | Have annotation in LeadDetail, not in estimates | Medium |
| Professional server-side PDF generation | Uses browser print dialog | **High** — #2 overall gap |
| Up to 6 estimate options (RoofLink) | Have 3 (Good/Better/Best) | Low — 3 is sufficient |
| Measurement tokens in templates | Not implemented | Medium |
| Real-time profit margin on estimate (RoofLink) | Have expenses/profit in LeadDetail | Low |

### Recommended Improvements

1. **Server-side PDF generation** — Use pdfmake to generate branded multi-page PDFs with: cover page (logo, property photo, company colors), inspection photo pages (support 4 SumoQuote layout styles: standard, side-by-side, wide, full), line items, terms, and e-signature page. This is the single biggest quality gap visible to customers.
2. **Estimate cover page** — Add fields for company logo upload, property image (from documents/street view), and branded header with color picker. SumoQuote's cover page is the first thing homeowners see.
3. **Inspection photo section** — Allow adding photos from the lead's documents directly into estimate sections, organized by area. Support drag-to-reorder within sections. SumoQuote's 4 style options (standard, side-by-side, wide, full) are a good model.

---

## 4. Content & Marketing (Rooftops.ai vs StormLeads)

### What Rooftops.ai Shows (verified via rooftops.ai/products, search results)

**Platform Overview (from rooftops.ai/products):**
- Tagline: "The future of roof intelligence"
- Three core features promoted: Custom AI Chat, Instant Roof Measurements, AI Agent Library
- 2,000+ contractor users, 4.9 rating
- Modern SaaS aesthetic with dark theme option
- Google Maps satellite imagery prominently featured
- 30-second report generation messaging

**AI Creator Studio (from product descriptions and search results):**
- **Grid-based content template library** with category cards:
  - Social Media Ads
  - Landing Page Builder
  - Email Marketing
  - Cold Call Scripts
  - Legal Documents
  - Meeting Strategy
  - Training Manuals
  - Translation Tool (80+ languages)
  - SEO Optimization
  - Content Calendar Planning
  - AI-Generated Images
- Card-based layout showing template types with category headers ("Most Popular," "Creator Library," "Coming Soon")
- One-click document generation interface
- **Creator Library** — save and organize generated content for reuse
- **Document Manager** — organizing saved content and property reports
- Distinction between Free-tier and Premium-tier templates

**AI Roof Reports:**
- Map-based address search (satellite imagery integration)
- 30-second report generation: roof area, pitch, facet count, square footage, cost estimates
- PDF export for professional proposals
- Simple address field with instant "Generate Report" button

**AI Employees (Coming Soon, $199/mo):**
- Four named AI personas presented as visual team members:
  - **Marcus** — Sales follow-up automation
  - **Aisha** — Marketing content/SEO
  - **Elena** — Estimating (changed from social media role)
  - **Ryan** — Insurance claims (changed from general responses)
- 24/7 automated lead follow-up

**Rooftops GPT (AI Assistant):**
- ChatGPT-style conversational interface customized for contractors
- Real-time business insights, email drafting, task help, roofing Q&A

### What StormLeads Currently Shows

- Content Studio with 5 content types (Social, Door Hangers, Emails, Blog, Ad Copy)
- 4 tone options per content type
- 10 input variables
- Batch mode (5 variations)
- Live preview panel (side-by-side with Facebook/email/door hanger/blog mockups)
- Library tab: save/search/filter/copy/delete
- localStorage persistence
- **NOT AI-powered** — template-based string interpolation
- Sidebar nav link present

### Specific Gaps

| Rooftops.ai Feature | StormLeads Status | Priority |
|---|---|---|
| AI-powered generation (LLM) | Template-based only | **High** — core differentiator |
| 12+ content types (scripts, legal, training, SEO) | 5 content types | Medium — expand library |
| Social media scheduling | Not implemented | Medium |
| AI-generated images | Not implemented | Low |
| SEO optimization | Not implemented | Low |
| Multi-language translation | Not implemented | Low |
| Content calendar | Not implemented | Medium |
| AI chatbot for website | Not implemented | Low |
| Named AI employee personas | Not implemented | Low — marketing gimmick |

### Recommended Improvements

1. **LLM integration for content generation** — Replace template interpolation with actual AI generation. Even a basic OpenAI/Anthropic API call (~$0.01/request) would dramatically improve output quality. This is table stakes for 2026.
2. **Add content types:** Call scripts, landing page copy, legal docs (contract terms), training materials. High-value for contractors and easy to implement with LLM.
3. **Social media scheduling** — Even a basic "copy to clipboard + open platform" workflow would help. Full scheduling requires social API integrations.
4. **AI chat assistant** — A simple chat interface that can answer roofing questions, draft emails, help with estimates. Rooftops.ai's GPT-style assistant is a strong differentiator at $12/mo.

---

## 5. Work Orders & Production (RoofLink vs StormLeads)

### What RoofLink Shows (verified via rooflink.com, rooflink.com/production/)

**7-Step Workflow Visualization (from rooflink.com homepage):**
- Linear numbered steps (1-7) with dedicated pages for each:
  1. **Target** — Territory mapping overlaid with storm/weather data (RL_Weather_Page_HERO.png shows mobile map with storm targeting)
  2. **Measure** — Satellite roof measurements with drawing tool (RL_measure_page_png_Drawing_.png), no climbing required
  3. **Estimate** — Good/Better/Best three-column comparison on mobile (RL_Multiple_estimate__Good_Better_best_.png), real-time profit margin visible
  4. **Approve** — Back-office verification step with error checking (RL_pricing_page_AS__Hero.png)
  5. **Order** — Approval auto-triggers supplier POs to SRS + crew work order generation. "Living file" shows all data flowing (RL_Multiple_estimates_Page_Living_file_.png)
  6. **Install** — Templated checklists with photo prompts per line item, issue tracking. **Photo-required stops** — can't advance without uploading required photos. Blocks crew payment until photos verified.
  7. **Collect** — Payment processing for retail and insurance jobs (Stripe)

**Key Production Patterns:**
- "Living file" concept — one single data source flows from measurement through collection
- Milestone completion automatically advances project through pipeline
- Photo verification workflow embedded (tear-off, underlayment, final nail pattern required before crew payment)
- Smart crew scheduling based on availability and job type
- Real-time material drop tracking
- Mobile-first: reps productive same day they're hired
- CompanyCam integration: field photos auto-flow into customer profile

**RoofLink Design Language:**
- Clean professional interface emphasizing data visibility
- Light backgrounds with profit margins prominently displayed
- Large touch targets for mobile
- Hero image shows contractor with phone managing crews (Home_imgshero.png)
- Strong testimonial: "We went from $35M with 17 office staff to $50M+ with fewer than 4" via automation

### What StormLeads Currently Shows

- 4-column kanban (Pending/Scheduled/In Progress/Completed)
- Drag-drop status changes
- Create from estimate
- Detail modal with milestones (add/toggle/delete/photo upload)
- Milestone templates for 8 job types (tear-off, shingle install, metal install, flat roof, gutter, siding, fence, general repair)
- **Photo-required milestone stops** with camera badge (blocks completion without photo) — **ALREADY BUILT**
- Editable line items with running total
- Crew assignment
- Scheduled date/time with TimePicker

### Specific Gaps

| RoofLink Feature | StormLeads Status | Priority |
|---|---|---|
| Photo-required milestone hard stops | **Already built** | Done |
| Auto-trigger PO on approval | Not implemented (manual ordering) | Medium |
| "Living file" single data flow | Separate views (estimate, work order, expenses) | Low — works fine |
| CompanyCam auto-sync photos | Not applicable (built-in photos) | N/A |
| Auto-generate insurance PDF with photos | Not implemented | Medium |
| Real-time profit margin on work order | Not shown on work order view | Low |
| Smart crew scheduling (availability-based) | Basic crew assignment only | Medium |

### Recommended Improvements

1. **Insurance documentation PDF** — Auto-generate a PDF from work order photos + milestones for insurance claim support. Reuse the photo annotation feature already built.
2. **Estimate -> Work Order -> Expense profit tracking** — Show real-time profit (estimate total - expenses) on the work order detail view, not just LeadDetail. RoofLink shows this prominently.
3. **Crew availability scheduling** — Add crew member availability calendar so assignment considers schedule conflicts. Currently basic assignment only.

### StormLeads Advantages Over RoofLink

- **Photo-required milestones already built** — RoofLink's strongest feature is already matched
- 8 job-type milestone templates vs RoofLink's generic templates
- Free vs $400/user/month
- Built-in material ordering (SRS) without separate integration

---

## 6. Dashboard & Reports (JobNimbus + RoofLink vs StormLeads)

### What JobNimbus Shows (verified via jobnimbus.com/product/insights, support docs)

**Dashboard Layout:**
- Two tabs: **Classic** and **Sales (Insights)**
- **Classic Dashboard:** Customizable widget layout with checkboxes to show/hide reports, tasks/contacts/jobs widgets, "Customize" button in top right
- **Sales Dashboard (Insights):**
  - KPI cards: Leads, Close Rate, Sold Deals (prominently displayed)
  - Sales Pipeline Report: 3-stage funnel (Lead -> Estimating -> Sold)
  - Lead Source Report: lead count, sold count, sold rate per source
  - Revenue Leaderboard: total approved/invoiced per rep
  - Deals Leaderboard: deal count per rep
  - Average Deal Size
  - Bar charts and leaderboard rankings
  - Color-coded pipeline stages
  - Filterable by: sales rep, job type, lead source
  - Year-to-date metrics
- **Workflow Insights:** Bottleneck identification and duration tracking
- User complaints: "AWFUL" reporting, often needs Excel export, mobile reporting weak

**Profit Tracker (dedicated product page):**
- Per-job view from Job detail -> Profit Tracker tab
- Top metrics bar: Revenue, profit, customizable "View More" sidebar
- Cost sections: Imported line items grouped by Manual Section or Cost Type
- Planned vs actual totals with drag-and-drop reorder
- Section management: duplicate/delete/rename
- Commissions panel: assign payouts based on revenue or profit %
- Metrics cards: Draggable, up to 5 favorites pinned

### What RoofLink Shows

- Custom dashboard widgets (user-configurable)
- Custom reports with builder
- Profit-first compensation tracking (commission tied to gross profit)
- Real-time profit margins visible from estimate through completion

### What StormLeads Currently Shows

- 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges
- Revenue goal progress bar with inline edit
- Pipeline funnel (clickable stages -> navigate to filtered leads)
- Mini storm map
- Storm activity feed (24h/7d/30d toggle)
- Today's tasks with checkboxes + follow-ups
- Activity feed timeline
- Storm conversion rates panel
- Estimates status summary
- Team leaderboard table
- Filter by rep, source, time period (7d/30d/90d/YTD)
- A/R aging summary with 5 buckets (Current/1-30/31-60/61-90/91+ days, color-coded)
- Reports page: 6 reports (Revenue area, Pipeline bar + drill-down, Conversion by Source radar, Rep Leaderboard table, Lead Sources donut + drill-down, Stage Duration line)
- Period presets + custom date range + comparison periods with delta badges + trend arrows
- CSV export per report

### Specific Gaps

| Competitor Feature | StormLeads Status | Priority |
|---|---|---|
| Customizable dashboard widgets (show/hide/reorder) | Fixed layout | Low — current layout is comprehensive |
| Per-job Profit Tracker (planned vs actual) | Have expenses + profit in LeadDetail | Medium |
| Commissions tracking per rep | Not implemented | Medium |
| Draggable/rearrangeable metric cards | Not implemented | Low |
| Custom report builder | Not implemented | Low — 6 report types sufficient |

### Recommended Improvements

1. **Per-job profit tracking** — Already have expense tracking in LeadDetail. Surface planned (estimate total) vs actual (expenses) comparison more prominently with a visual bar gauge. JN makes this a dedicated tab.
2. **Commissions panel** — Add commission tracking per rep (% of revenue or profit). This is a key JN Profit Tracker feature for business owners.

### StormLeads Advantages

- Storm-specific dashboard widgets (storm activity feed, conversion rates, mini map) — **unique, no competitor has this**
- Comparison periods with delta badges + trend arrows — JN doesn't have this
- Chart drill-down on Pipeline + Lead Sources
- Revenue goal progress bar — simple but effective motivator
- A/R aging summary — already built (JN requires separate setup)
- Loading skeletons — polished UX detail
- Dashboard filters (rep, source, time period) — **already implemented**

---

## 7. AI Features (JobNimbus + QuoteIQ — Emerging Competitive Threat)

### What JobNimbus Shows (verified via jobnimbus.com/product/assistai, press releases)

**AssistAI (jobnimbus.com/product/assistai):**
- AI-powered receptionist that handles every call 24/7
- Books appointments directly into JobNimbus calendar
- Captures lead data and syncs to CRM
- Dashboard with agent management, contacts, logs
- General tab: change org name, customize avatar, deactivate
- $298/agent/month + per-minute usage
- Tagline: "Never miss a phone call again—ever"

**Scout (BETA, Jan 2026):**
- Mobile AI assistant for real-time CRM actions
- Voice or text commands: create/update jobs, contacts, tasks, notes, estimates, invoices, messages
- "Actually does the work for you—inside the app"
- Press release coverage in Clarion Ledger, Jacksonville.com
- Currently on waitlist

**Smart Forms:**
- AI-powered form builder replacing paper workflows

### What QuoteIQ Shows (verified via myquoteiq.com, search results)

**AI Estimator:**
- Upload roof photos -> AI analyzes shingle condition, damage severity, pitch, square footage, scope
- Market-accurate pricing by geographic location
- Follow-up questions about tear-off vs overlay, materials, decking
- Complete estimate generated in 4-7 minutes

**MapMeasure Pro:**
- Draw over satellite imagery to calculate square footage and pricing
- Pin dropping, complex shape mapping
- Ridge, valley, hip measurement
- Export directly into estimate builder

**InstaQuote (homeowner self-service):**
- Widget embedded on contractor's website
- Homeowner enters address -> gets instant ballpark roof estimate
- Submits info if serious -> becomes qualified lead

**AI Virtual Call Team:**
- 24/7 inbound call answering + lead qualification
- **Outbound calling** — can cold-call 300 homeowners in storm zones
- Conversation AI, not just IVR

**Other AI Tools:**
- AI Autopilot — 35-tool natural language CRM control ("create an invoice for...")
- Before/After AI Image Generator — show homeowners what new roof will look like
- Review Multiplier — automated review requests
- Pricing: $29.99-$399.99/mo with AI on ALL plans

### What Roofle Shows (verified via offers.roofle.com, now part of SalesRabbit/RoofLink)

**RoofQuote PRO Widget:**
- Instant online roof quotes embedded on contractor's website
- Homeowner enters address -> gets pricing based on specific materials
- Customizable with brand colors and contractor's own prices
- $350/month or $5,500/year (includes setup + 2 free months)
- Unlimited users, leads, instant quotes, weather data, proposals, orders
- Tagline: "Wake Up To Ready-to-Buy Leads With INSTANT ONLINE Roof Quotes"
- YouTube demo: "How To Sell a Roof Online" (V6OMpxRRpZM, 47 min)

### StormLeads Status

- **No AI features currently** — Content Studio is template-based, not LLM-powered
- No self-service quoting widget
- No AI phone answering
- No AI-assisted estimation

### Relevance to StormLeads

QuoteIQ is the biggest pricing threat — their $29.99/mo matches our proposed Starter tier but includes AI tools. **However, QuoteIQ has ZERO storm data/weather mapping.** This is StormLeads' moat. Key takeaways:

1. **AI-powered features are table stakes** for 2026 roofing CRM competition
2. **Photo-based estimation** is a powerful differentiator we should consider
3. **Self-service quoting widgets** (InstaQuote/Roofle) could drive lead generation
4. **Storm data is our competitive moat** — no competitor at this price point has it
5. **LLM-powered content generation** is the lowest-hanging fruit AI feature

---

## 8. Cross-Cutting UI Patterns

### Navigation Patterns

| Competitor | Nav Style | Mobile |
|---|---|---|
| JobNimbus | Webflow mega-menu with dropdowns (Features, Solutions, Industries) | Native iOS/Android app, 4.8 stars |
| HailTrace | Top nav with dark green accent, bottom tab bar on mobile | Native iOS/Android app |
| RoofLink | Mega-menu with collapsible sections (Blueprint, Solutions, Integrations) | Native app, mobile-first design |
| Rooftops.ai | Standard top nav, clean minimal design | Web responsive |
| QuoteIQ | Standard SaaS marketing site | Web responsive |
| **StormLeads** | Collapsible sidebar, dark mode, glass panels | PWA (no native app) |

### Color Systems

| Competitor | Primary | Background | Cards |
|---|---|---|---|
| JobNimbus | Blue (#4D85E5, #2b5797) | Light blue-gray (#ebf0fa) | White |
| HailTrace | Green (#009344) | Dark (#203431) / White | White on gray (#F0F0F0) |
| RoofLink | Navy blue (#3563ad) | Dark navy (#111827) / White | White with generous whitespace |
| Rooftops.ai | Teal/green gradients | White / dark option | Card-based clean layout |
| **StormLeads** | oklch accent colors | Dark mode first | Glass panels (backdrop-filter) |

### Key Observations

1. **StormLeads' design is the most distinctive** — dark-mode glassmorphism is visually unique among all competitors. All major competitors use traditional light-mode designs with white cards on light backgrounds.
2. **Mobile-first is now standard** — JobNimbus, HailTrace, and RoofLink all have native apps with 4.5+ star ratings. StormLeads' PWA approach needs to deliver an equally polished mobile experience.
3. **Every competitor uses card-based layouts** — pipeline cards, dashboard widgets, estimate tiles. StormLeads should ensure glass cards maintain the same information density as competitor white cards.
4. **All competitors converge on mega-menus** — feature-rich navigation with Solutions/Features/Industries dropdowns. StormLeads' sidebar nav is actually better for in-app use (persistent, always visible).

---

## Summary: Top 12 Visual/UI Improvements by Impact

| # | Improvement | Competitor Reference | Effort | Impact |
|---|---|---|---|---|
| 1 | **Server-side PDF estimates** with cover page, inspection photos (4 layout styles), branding | SumoQuote multi-page proposals | Large | Critical — visible to customers |
| 2 | **Hail swath color graduation** by severity (green/yellow/orange/red) | HailTrace purple zones + color system | Medium | High — map credibility |
| 3 | **LLM-powered content generation** replacing template interpolation | Rooftops.ai, QuoteIQ (AI on all plans) | Medium | High — 2026 table stakes |
| 4 | **Per-layer opacity controls** on storm map | HailTrace toggle map layers KB | Small | Medium — better map UX |
| 5 | **Storm severity badges** (1-5 rating per storm) | HailTrace star system | Small | Medium — data richness |
| 6 | **Estimate cover page** with logo + property image + branding colors | SumoQuote cover page | Small | Medium — first impression |
| 7 | **Inspection photo pages in estimates** (4 styles: standard, side-by-side, wide, full) | SumoQuote inspection pages | Medium | High — sales tool |
| 8 | **Per-job profit tracking** (planned vs actual with visual gauge) | JobNimbus Profit Tracker | Small | Medium — business owner tool |
| 9 | **Commissions tracking per rep** | JobNimbus Profit Tracker | Small | Medium — team management |
| 10 | **Insurance documentation PDF** from work order photos + milestones | RoofLink production workflow | Medium | Medium — insurance jobs |
| 11 | **AI chat assistant** for email drafting, roofing Q&A | Rooftops.ai GPT, QuoteIQ Autopilot | Medium | Medium — differentiation |
| 12 | **Self-service quoting widget** for contractor websites | Roofle RoofQuote PRO, QuoteIQ InstaQuote | Large | Medium — lead generation |

---

## YouTube Demo Resources (for visual reference)

| Competitor | Video | URL |
|---|---|---|
| SumoQuote | 10 Minute Demo | youtube.com/watch?v=xywwszN5cEw |
| SumoQuote | Inspection Page Overview | youtube.com/watch?v=grpqmhlD2Ks |
| SumoQuote | Inspection Page Styles | youtube.com/watch?v=epRHZhWlJBY |
| HailTrace | Isolated Maps With Hatched Pattern | youtube.com/watch?v=BYEZBYlFKPg |
| HailTrace | Asset Filtering Tutorial | youtube.com/watch?v=YDcaJaou-ZY |
| Roofle | How To Sell a Roof Online Demo | youtube.com/watch?v=V6OMpxRRpZM |
| JobNimbus | Full Tutorial 2026 | Search "How To Use Jobnimbus 2026" |
| JobNimbus | CRM Demo 2026 | Search "JobNimbus CRM Demo 2026" |

---

*Generated 2026-04-02 via Firecrawl CLI scrapes of hailtrace.com, hailtrace.com/hail-maps, hailtrace.zohodesk.com/portal/en/kb (Toggle Map Layers, Asset Filtering), jobnimbus.com/features, jobnimbus.com/product, jobnimbus.com/product/assistai, docs.sumoquote.com (Inspection Page, Templates, Styles), rooflink.com, rooftops.ai/products, offers.roofle.com, myquoteiq.com, Capterra, G2, and integration partner pages.*
