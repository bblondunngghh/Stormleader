# Competitor UI Research — Visual Patterns & Actionable Gaps

**Date:** 2026-04-08 (refreshed with new Firecrawl research)
**Methodology:** Firecrawl scraping of competitor websites, help centers, review sites, marketing pages, and partner integration docs. No in-app screenshots were obtainable (all competitors gate their apps behind login/demo walls), so descriptions are synthesized from marketing imagery, help docs, partner documentation, and review site descriptions.
**Complements:** `docs/competitor-gap-analysis.md` (feature/pricing text analysis, 2026-03-26)

---

## 1. Storm Map (StormLeads vs HailTrace)

### How HailTrace Does It

**Swath colors — graduated severity scale:**
- **Yellow** — small hail (0.50-0.75"), minor cosmetic damage
- **Orange** — moderate hail (0.75-1.25"), significant impact
- **Red** — large hail (2.00"+), severe structural compromise
- **Wind overlay** uses a separate palette: blue/green (<58 mph), yellow (58-70 mph), red/purple (70+ mph)
- **"Purple Zones"** where hail + wind overlaps mark highest damage potential — referenced explicitly by integration partners (SPOTIO, Knockbase) as the neighborhoods most likely to file claims

**Map rating system:** Each storm swath gets a **1-to-5 star rating** based on property count impacted, max hail size, and probability of finding damage. 5-star maps are rare (most impactful storms of the year). Free-tier users only see 1-star maps.

**Layer controls:** A toolbar with a HailTrace icon toggle enables/disables the storm data layer. A **right-side panel** lists available storm swaths with metadata (location, date, severity, wind speed, hail size, rainfall). Users click "Show on Map" per swath. Multiple swaths can be stacked simultaneously.

**Camera icons** appear near impact locations showing compiled photos of hail/wind/tornado damage.

**Property popups:** Sidebar card shows full address, contact options (phone/email from Cole Information data), and map access buttons. Three data modes: single property lookup, swath-based bulk download, or a **draw-out tool** (custom polygon selection). Each property can pull a **Weather History Report** — a shareable PDF covering 14+ years of hail/wind/tornado history for insurance date-of-loss evidence.

**Design language:** Dark-themed with green (#009344) accents, dark backgrounds (#203431), white text. Purple-themed app icon. Professional, data-dense aesthetic.

### How StormLeads Does It Now

- Hail/wind/tornado swaths with color graduation (green-yellow-orange-red by size/speed)
- 6 layer toggles (hail/wind/tornado/tstorm/drift/properties)
- Transparency slider for swath opacity
- FEMA NSI property overlay with Supercluster clustering
- Honey Hole heatmap (NOAA SWDI historical hail circles)
- Property popup with "Add to Pipeline" action
- Time range filter (24h/3d/7d/14d/30d)
- Storm history per location (5-mile radius, 10-year SWDI window)
- Generate Canvassing List button (up to 50 pins from storm properties)

### Specific Gaps to Close

| Gap | HailTrace Has | StormLeads Has | Priority |
|-----|--------------|----------------|----------|
| Storm star ratings | 1-5 star severity rating per swath | Nothing — swaths are unrated | **High** — helps users instantly prioritize which storms to canvass |
| Purple zone highlighting | Combined hail+wind overlap zones marked distinctly | Separate layers, no overlap emphasis | **Medium** — visual cue for highest-damage areas |
| Camera/damage photo markers | Photo icons on map near impact sites | No damage photo layer | **Low** — requires user-submitted photos or external data |
| Weather History PDF per address | 14+ year shareable PDF for insurance claims | Storm history display (no PDF export for single address) | **High** — insurance adjusters want printable reports |
| Draw-to-select polygon tool | Custom polygon for property selection | Only swath-based or canvassing list | **Medium** — lets users define custom target areas |
| Right-side storm panel | Scrollable list of swaths with metadata | Filter pills only, no storm list panel | **Medium** — easier to browse/toggle multiple storms |

### Recommended Improvements

1. **Add storm severity rating (1-5 stars)** to storm cards in Storm Archive and swath popups on the map. Formula: weighted score of hail size + property count + wind speed.
2. **Add "overlap zone" highlighting** when multiple swath types intersect — use a distinct purple-ish oklch color for the overlap region.
3. **Add per-address Weather History PDF export** button in LeadDetail and property popups — compile SWDI data into a branded PDF.
4. **Add a storm list sidebar** on the map (collapsible right panel) listing active swaths with metadata, toggle visibility per swath.

---

## 2. Honey Hole Finder (StormLeads vs HailTrace)

### How HailTrace Does It

Not a standalone UI panel — it's a **workflow pattern** within the map. Users load multiple storm swaths simultaneously across different dates. The overlapping translucent swath layers visually reveal locations hit repeatedly by smaller storms. Areas where 3-4 swaths overlap appear as dense, deeply colored regions — "honey holes" where cumulative damage makes roofs replacement-ready even if no single storm was catastrophic. HailTrace tracks how damage builds through repeated impacts over time.

### How StormLeads Does It Now

- Dedicated Honey Hole heatmap overlay using NOAA SWDI historical hail data
- Heat circles showing hail frequency by location
- Toggle on/off from layer controls

### Gap Analysis

StormLeads actually has a **more explicit** honey hole feature than HailTrace — ours is a dedicated heatmap layer vs their manual swath-stacking workflow. However, HailTrace's approach lets users see the actual individual storms that hit an area, while our heatmap is an aggregate visualization.

### Recommended Improvement

- **Add "drill into" capability** to honey hole heatmap: clicking a hot zone should list the individual storms that contributed to that area's heat score, with dates and severity. This combines our heatmap advantage with HailTrace's individual-storm detail.

---

## 3. Pipeline / CRM (StormLeads vs JobNimbus)

### How JobNimbus Does It

**Board structure:** Columns called "Lists" correspond to workflow stages. Cards represent jobs/contacts.

**Card design — 4 zones:**
1. **Title row** — contact display name (configurable)
2. **Three configurable body lines** — e.g., Contact Type + Status, sum of approved invoices, balance due
3. **Fixed bottom row** (left to right): days-in-status counter, task completion ratio (e.g., "3/5"), attachment count, due date, assignee initials/avatar with team count badge
4. White card on column background

**Column headers:** Optional revenue totals showing Estimate Total, Invoice Total, and Outstanding Invoice Total per stage. Only approved estimates count.

**Interaction:** Drag-and-drop between columns auto-updates job status and resets days-in-status counter. A dropdown arrow next to the board name switches between boards. Boards Overview page shows all boards as draggable tiles.

**Known UX weakness:** Blue-on-blue column colors make scrollbar sliders hard to distinguish — thin bars, poor contrast. (Design mistake to avoid.)

### How StormLeads Does It Now

- Kanban board with HTML5 drag-and-drop
- 3 board tabs (Sales/Production/Billing) with stage filtering
- Cards show: deal value, lead score badge, source label, task progress badge, days-in-stage badge, due date badge, financing badge
- Column revenue totals (sum of estimated_value)
- Conversion rate between columns
- Column collapse toggle (localStorage-persisted)
- Priority/Source/Rep filter dropdowns with active filter pills
- Sidebar lead preview panel
- Mobile list view with priority dots

### Specific Gaps to Close

| Gap | JobNimbus Has | StormLeads Has | Priority |
|-----|--------------|----------------|----------|
| Configurable card body lines | 3 user-configurable lines per card | Fixed card layout (not configurable) | **Low** — our cards already show relevant data |
| Multiple board types | Separate boards per workflow with overview page | 3 tabs filtering one board | **Medium** — some users want custom boards |
| Assignee avatar on cards | Initials/photo + team count badge | No assignee indicator on cards | **High** — field teams need to see who owns each lead |
| Attachment count on cards | Shows attachment count in bottom row | No document indicator | **Low** — nice-to-have |
| Task completion ratio on cards | "3/5" style counter on every card | Task progress badge (percentage) | **Already close** — our percentage badge is arguably better |
| Outstanding invoice total per column | Three financial totals per column header | Only estimated_value sum | **Medium** — useful for billing board |

### Recommended Improvements

1. **Add assignee avatar/initials** to pipeline cards — show the assigned rep's initials in a small circle on the card's bottom row.
2. **Add invoice totals to column headers** on the Billing tab — show Invoiced, Collected, Outstanding alongside estimated value.
3. **Add a Boards Overview page** if users create custom pipeline configurations.

---

## 4. Estimates (StormLeads vs JobNimbus SumoQuote + RoofLink)

### How JobNimbus Does It

**Builder layout:** Left sidebar shows layout template section toggles with eye icons (visibility), trash icons (delete), and collapse arrows. Main area has the estimate content.

**Key UI patterns:**
- **Template selector dropdown** — "Standard Estimate" (multi-page) vs "Simple Estimate" (one-page)
- **Up to 3 estimate tabs** for Good/Better/Best comparison
- Line items with six-dot drag handles, synced from Products & Services library
- **Profit margin adjustment slider** with total price override link
- Save as Template button
- Signing page: disclaimer text area, upgrades section, deposit toggle with amount/description, Add Signer button
- Text pages (Intro, Terms, Warranty): formatting toolbar (bold, italic, underline, lists, links) + "Insert Token" dropdown for auto-filling customer data
- "Review and Share" button generates PDF preview

### How RoofLink Does It

**Measurement-first workflow:**
- User traces roof perimeter on satellite imagery, then labels lines (Rake, Eave, Ridge, Hip, Valley)
- Automatic material calculations with waste factor
- A product template creates estimate + material order + work order **simultaneously**
- **Up to 6 estimates per job** with comparison dropdown
- Real-time SRS Distribution pricing displayed inline
- Profit margin preview visible before sending

### How StormLeads Does It Now

- Rich multi-section editor with line items (drag-and-drop)
- Rich text editor (bold, italic, underline, lists, links)
- Section image uploader
- Tax rate + discounts + profit margin input
- Multi-signer authorization
- Financing options toggle (Hearth)
- Template system (save/load)
- Review mode with live preview
- AI tier generation (Good/Better/Best)
- Tier comparison modal (side-by-side)
- Server-side PDF generation (pdfmake)
- SRS Catalog material selection
- Insurance details (company, claim #, date of loss)
- Insurance auto-calculations (depreciation, ins. pays, customer owes)

### Specific Gaps to Close

| Gap | Competitors Have | StormLeads Has | Priority |
|-----|-----------------|----------------|----------|
| Insert Token / mail merge | JobNimbus auto-fills customer data into text sections | Manual text entry | **High** — saves time, reduces errors |
| Deposit/progress payment toggle | JobNimbus has deposit amount + description field on signing page | No deposit field | **Medium** — common in roofing |
| Satellite roof tracing tool | RoofLink traces perimeter, auto-calculates materials | Manual measurement entry + "Launch Measurement Tool" (guidance toast) | **High** — but requires paid imagery API |
| Estimate-to-work-order auto-creation | RoofLink creates WO automatically from approved estimate | Separate manual WO creation | **Medium** — workflow automation |
| Up to 6 estimate versions | RoofLink allows 6 per job | 3 tiers (Good/Better/Best) | **Low** — 3 tiers is sufficient |

### Recommended Improvements

1. **Add token/merge field insertion** — dropdown in the rich text editor to insert `{{customer_name}}`, `{{address}}`, `{{storm_date}}`, etc. Replace at PDF generation time.
2. **Add deposit/progress payment fields** to the estimate signing section — amount, description, and due-on-signing toggle.
3. **Auto-create Work Order** when an estimate is approved — pre-fill from estimate line items.

---

## 5. Content / Marketing (StormLeads vs Rooftops.ai)

### How Rooftops.ai Does It

**AI Creator Studio interface:** Grid of tool cards, each with a labeled icon and "Premium" badge. Content types: Social Media Ads, Landing Page Builder, Cold Call Scripts, Email Marketing, Translate Anything, Legal Docs Creation, Meeting Strategies, Training Manuals.

**Workflow:** Prompt-driven — select content type, provide context (business name, target audience, tone), AI generates drafts. No WYSIWYG editor — output is generated text for copy/export. Includes a "creator library" of saved content and AI-driven content suggestions.

**Rooftops GPT:** Free ChatGPT-wrapper for contractors. Chat interface accessible from main nav. Supports sales scripts, marketing copy, customer support responses, email drafting, roofing Q&A.

**AI Employees ($199/mo, waitlist):**
- **Marcus** — Sales: automated follow-ups and lead conversion
- **Aisha** — Marketing: content creation and campaign management
- **Elena** — Estimating: automated estimate generation
- **Ryan** — Insurance: claim processing and documentation

**Roof Report UI:** Map-first hero with full-width Google Maps satellite view. Custom zoom controls and measurement tools ("Start Measure"/"End Measure" buttons). Below the map: expandable metric sections — General Metrics (facets, squares, area), Roof Pitch Table (fractions with percentages), Building Details, Satellite + Street View imagery. Export PDF button. Disclaimer noting ~15% margin of error.

**Solar Analysis:** "Solar Insights" section with a **property suitability gauge** (Bad Fit / Good Fit / Great Fit) as a visual scale with caret indicator. Panel recommendations (max panel count, available area), financial projections (upfront cost, 20-year savings with/without solar, yearly kWh generation, usable sunlight hours).

**Design:** Clean typography (Montserrat/Inter). Dark/light toggle. Font Awesome icons. Animated progress messages during report generation. Professional minimalist aesthetic.

### How StormLeads Does It Now

- Content Studio was **REMOVED** (commit 768f403, 2026-04-08)
- Drip sequences with auto-enrollment and step progression
- No AI content generation
- No marketing content tools
- Solar potential display exists in LeadDetail roof measurement section

### Gap Analysis

StormLeads removed Content Studio, so there is currently no content generation feature. However, per the project mission, all features must be free or very cheap — Rooftops.ai charges $12/mo for their AI tools, which is viable.

### Recommended Improvements (Future)

1. **Re-introduce a lightweight content generator** using a free/cheap LLM API — focus on the highest-value content types: door knocker scripts, follow-up email templates, and social media posts about recent storms.
2. **Template library** — pre-built marketing templates that users customize (no AI needed, zero cost).
3. **AI Assistant chat** — a ChatGPT-style sidebar for contractor questions (requires LLM integration, marked as TODO).

---

## 6. Work Orders / Production (StormLeads vs RoofLink)

### How RoofLink Does It

**Milestone-driven pipeline:** Completing a milestone (measurement done, estimate approved, materials ordered) **automatically advances** the job through the pipeline — no manual drag-and-drop needed. This is explicitly marketed as superior to competitors' "digital post-it note" kanban boards.

**7-step workflow visualization:** Sequential steps displayed as expandable feature cards. Each step has a right/down arrow toggle. Progress is tracked per-project.

**Auto-cascading actions:**
- Estimate approval -> auto-creates supplier PO + crew work order
- Material order -> auto-generates pick list
- Install completion -> auto-triggers payment collection

**Checklist system:** Templated checklists per install step. Photo prompts require field workers to capture specific photos at each stage. Photos organized by inspection line items (not flat gallery). Time-stamped automatically.

**Mobile-first:** iOS 13.0+, tab-based navigation. Scheduling, tracking, documenting all accessible on phone. Pre-made form templates (contingency forms, insurance contracts, retail repair proposals).

### How StormLeads Does It Now

- Work Orders page with list view
- Work Order PDF export (pdfmake, added 2026-04-08)
- Manual stage progression via Pipeline drag-and-drop
- No auto-cascading actions from estimate approval
- No templated installation checklists
- No photo prompts per inspection step
- Photo annotation exists (on LeadDetail)

### Specific Gaps to Close

| Gap | RoofLink Has | StormLeads Has | Priority |
|-----|-------------|----------------|----------|
| Auto-advance pipeline on milestone | Milestone completion moves jobs automatically | Manual drag-and-drop only | **High** — major workflow efficiency gain |
| Templated install checklists | Pre-built checklists with photo prompts | No checklists | **High** — field crews need structure |
| Photo-per-inspection-item | Photos organized by checklist line item | Flat document gallery | **Medium** — helps with insurance documentation |
| Estimate -> WO auto-creation | Approval auto-creates WO + PO | Separate manual creation | **Medium** — reduces admin work |
| Pre-made form templates | Contingency forms, insurance contracts, retail proposals | No form templates | **Medium** — common roofing paperwork |

### Recommended Improvements

1. **Add milestone-based auto-advance** — when key actions complete (estimate signed, materials ordered, install photos uploaded), offer to auto-advance the pipeline stage with a confirmation toast.
2. **Add installation checklists** to Work Orders — templated checklist items with required photo upload per item. Store photos tagged to the checklist step.
3. **Add estimate-to-work-order auto-creation** — when estimate status changes to "accepted," prompt to auto-generate a Work Order pre-filled with line items.

---

## 7. Dashboard / Reports (StormLeads vs JobNimbus + RoofLink)

### How JobNimbus Does It

**Multiple specialized dashboards ("Insights"):**
- **Business Overview** — top 5 revenue-yielding lead sources, peak lead-conversion times, lead flow/mix, close rate/sales volume. Filterable by rep, job type, lead source.
- **Close Rates** — percentage of leads reaching "Sold" stage, estimating conversion rates
- **Workflow** — duration in each status/stage, broken down by rep/type/source — identifies bottlenecks
- **A/R Dashboard** — "mission control" for accounts receivable and cash flow
- **Jobs Completed** — closed invoice data and performance metrics

**Job-level Profit Tracker:** Per-job tab showing revenue, profit margins, cost metrics with up to 5 draggable metric cards.

### How RoofLink Does It

- Customizable dashboard widgets — users build layouts per role
- Pipeline auto-progression updates dashboard in real-time
- Custom reports on costs, labor hours, revenue
- Bulk messaging integrated into web dashboard

### How StormLeads Does It Now

- 5 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close, Speed-to-Lead)
- Revenue goal progress bar
- Pipeline conversion funnel chart
- Mini storm map with live radar
- Tasks due today + follow-ups
- Activity feed with timestamps
- Team leaderboard (8 columns)
- Conversion by storm chart
- Estimate summary (accepted/pending/declined)
- A/R aging summary (5 buckets)
- Estimating conversion cards
- Filter dropdowns (Rep, Source, Period)
- Comparison period data with trend arrows
- Days-in-stage cards + stale leads alert

### Specific Gaps to Close

| Gap | Competitors Have | StormLeads Has | Priority |
|-----|-----------------|----------------|----------|
| Multiple dashboard views | JobNimbus has 5+ specialized dashboards | Single unified dashboard | **Low** — our single dashboard is comprehensive |
| Workflow bottleneck analysis | JobNimbus shows duration per stage by rep/type/source | Days-in-stage cards (aggregate only) | **Medium** — drill-down by rep would help |
| Per-job Profit Tracker | JobNimbus shows revenue, margins, costs per job | Expenses / profit tracking in LeadDetail | **Already close** — our LeadDetail has this |
| Draggable/customizable widgets | Both competitors allow layout customization | Fixed layout | **Low** — nice-to-have, not critical |
| Lead source ROI | JobNimbus shows top 5 revenue-yielding sources | No lead source revenue breakdown | **High** — helps users know where to spend marketing dollars |

### Recommended Improvements

1. **Add lead source revenue breakdown** — a bar chart or table showing revenue (closed deals) per lead source. This is the #1 question contractors ask: "Where should I spend my marketing budget?"
2. **Add stage-duration drill-down** — clicking a days-in-stage card should break down by rep, showing which team members are bottlenecks at which stages.
3. **Add a Reports page** (already in sidebar as "Reports") with saved report templates: Close Rate by Period, Revenue by Source, Pipeline Velocity, A/R Aging Detail.

---

## 8. Canvassing (StormLeads vs HailTrace + SalesRabbit/RoofLink)

### How HailTrace Does It

- Enterprise-tier canvassing with **GPS-verified pins** (must be within 50 feet of property)
- Users draw **canvassing region boundaries** around storm swaths using boundary tools
- Territories sync to mobile — field reps see exact boundaries + receive notifications
- **Asset pin system** — upload existing customer base as map pins; system auto-notifies when those properties fall within a new storm swath, generating a downloadable spreadsheet of impacted clients
- Canvassing reports track team activity and coverage

### How SalesRabbit/RoofLink Does It

- Freehand polygon drawing for territory boundaries
- Territory assignment to reps
- Historical canvassing progress visualization (see previous results, follow up on missed leads)
- Route planning optimization
- Web dashboard showing lead + territory maps together
- Customer pins strategically mapped into canvassing routes

### How StormLeads Does It Now

- Color-coded teardrop canvassing pins (outcome-based colors)
- Outcome legend with analytics section
- Generate Canvassing List from storm properties (up to 50 pins)
- Pin outcomes tracked
- SVG teardrops with oklch colors

### Specific Gaps to Close

| Gap | Competitors Have | StormLeads Has | Priority |
|-----|-----------------|----------------|----------|
| GPS verification of pin drops | HailTrace verifies within 50 feet | No GPS verification | **Medium** — prevents false reporting |
| Territory boundary drawing | Both competitors have polygon territory tools | No territory drawing (canvassing uses storm-generated pins) | **High** — managers need to assign areas |
| Existing customer storm alerts | HailTrace auto-notifies when existing customers are in new storm swaths | No existing-customer overlay | **High** — huge upsell opportunity |
| Route optimization | SalesRabbit optimizes canvassing routes | No route planning | **Medium** — saves drive time |
| Canvassing team reports | Both have activity/coverage reports | Analytics section (basic) | **Medium** — needs drill-down per rep |

### Recommended Improvements

1. **Add territory drawing tool** — let managers draw polygon boundaries on the map, assign to reps, and have field reps see only their territory.
2. **Add "existing customer storm alert"** — when loading storm swaths, check if any existing leads/customers fall within the swath polygon and surface them in a notification or list. Zero-cost feature using existing data.
3. **Add canvassing coverage report** — per-rep breakdown of pins dropped, outcomes, and territory completion percentage.

---

## 9. Roofle Instant Pricing (Emerging Competitor Pattern)

### How Roofle Does It (Now Part of RoofLink/SalesRabbit)

**RoofQuote PRO** — a white-labeled widget embedded on contractor websites:
- Homeowner enters address -> satellite imagery loads showing all structures
- **30-second AI quotes** with auto-calculated waste and slope
- **Product cards** (up to 8) with price ranges, images, color swatches
- Expandable product detail pages with system components and warranty info
- **Financing pre-qualification** under 60 seconds, no credit impact
- E-commerce shopping-cart-like progression through product selection
- **Brand colors:** Orange (#EF7E45) buttons, dark teal (#244C5A) backgrounds, cyan accents (#73F1FF)
- Pricing: $5,500/year or $350/month + $2K setup

### StormLeads Opportunity

This is a premium feature ($350+/mo) that StormLeads could offer in a simplified free version:
- A public-facing "Get a Quick Quote" page (similar to our existing PublicEstimate page) where homeowners enter their address, select roof type/material, and get a ballpark estimate range.
- No satellite measurements needed — use our existing square footage data from FEMA NSI or manual entry.
- Zero cost to implement using existing infrastructure.

---

## 10. Calendar & Scheduling (StormLeads vs JobNimbus)

### How JobNimbus Does It

**Four calendar views:** Month (default), Week (shows 3 days at a time), Day (with current-time line), Agenda (scrollable list format).

**Color-coded by team member** — tasks appear as highlights on Day/Week views and as vertical bars on the left side in Month/Agenda views. Users filter by team member checkboxes in a left-hand Calendars panel.

**Interaction:** Drag-and-drop rescheduling. Show/hide completed tasks toggle. Google Calendar sync. Notifications fire the day tasks are due. "+" button to create tasks associated with jobs.

**Mobile:** Same four views with view selector icon at top. iOS uses gear icon for filters; Android uses three-dot menu.

### How StormLeads Does It Now

- Calendar page exists in sidebar
- Basic calendar view
- No Google Calendar sync
- No team member color coding
- No drag-and-drop rescheduling

### Recommended Improvements

1. **Add 4 calendar views** (Month, Week, Day, Agenda) to match industry standard.
2. **Color-code by assigned rep** for team visibility.
3. **Drag-and-drop rescheduling** on the calendar.

---

## 11. Cross-Cutting UI Patterns Summary

### What Competitors Do Well (Patterns to Adopt)

| Pattern | Used By | How to Apply |
|---------|---------|--------------|
| Dark theme with colored accents | HailTrace (green), Rooftops.ai (dark/light toggle) | **Already doing this** — oklch dark-mode-first is correct |
| Right-side detail panels | HailTrace (storm list), JobNimbus (job detail) | Add collapsible right panels where context helps |
| Fixed bottom row on cards | JobNimbus (days + tasks + attachments + assignee) | Standardize our pipeline card bottom row |
| Star/severity ratings | HailTrace (1-5 star storms) | Add to storm cards and swath popups |
| Milestone-driven pipeline | RoofLink (auto-advance on completion) | Add optional auto-advance with confirmation |
| Token/merge fields in templates | JobNimbus (Insert Token dropdown) | Add to estimate and email template editors |
| Map-first hero layout | HailTrace, Rooftops.ai | **Already doing this** — Storm Map is our hero page |

### What Competitors Do Poorly (Advantages to Maintain)

| Weakness | Competitor | StormLeads Advantage |
|----------|-----------|---------------------|
| Blue-on-blue column colors, poor contrast | JobNimbus | Our oklch color system with high-contrast dark mode |
| No free tier / opaque pricing | JobNimbus ($349+/mo), RoofLink ($400/user/mo) | Free/cheap is our core mission |
| No integrated storm mapping in CRM | JobNimbus (requires HailTrace add-on) | Storm map + CRM in one app |
| Manual swath-stacking for honey holes | HailTrace | Our dedicated heatmap layer is more intuitive |
| 15% measurement error margin | Rooftops.ai | We don't claim satellite measurement accuracy |
| Finicky integrations, manual data entry | JobNimbus (per user reviews) | Single integrated platform, no integration tax |

---

## Priority Implementation Roadmap

### Quick Wins (< 1 day each, high impact)

1. **Assignee avatar on pipeline cards** — show rep initials in a circle on card bottom row
2. **Storm severity star rating** — calculated badge on storm cards in Archive + map popups
3. **Lead source revenue chart** on dashboard — bar chart showing closed-deal revenue per source
4. **Existing customer storm alert** — check existing leads against new swath polygons, surface in notifications

### Medium Effort (1-3 days each)

5. **Token/merge field insertion** in estimate rich text editor
6. **Deposit/progress payment fields** on estimate signing page
7. **Per-address Weather History PDF** export from LeadDetail + property popups
8. **Stage-duration drill-down by rep** on dashboard days-in-stage cards
9. **Canvassing coverage report** — per-rep pins, outcomes, territory completion

### Larger Features (3+ days each)

10. **Territory drawing tool** for canvassing with rep assignment
11. **Installation checklists** with photo prompts on Work Orders
12. **Milestone-based auto-advance** for pipeline stages
13. **Auto-create Work Order** from approved estimate
14. **Storm list sidebar panel** on map (collapsible right panel with swath metadata)
15. **Lightweight AI content generator** (requires LLM integration)
16. **Calendar upgrade** — 4 views, rep color coding, drag-and-drop rescheduling
