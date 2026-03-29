# StormLeads App Inventory — 2026-03-29

**Method:** Full source code analysis of all 21 protected routes + 6 public routes, 38 backend route files (271 endpoints), and cross-reference with competitor gap analysis matrix.

---

## Page-by-Page Feature Inventory

| # | Page | Route | Features Present | Works? | Broken/Missing | Competitor Notes |
|---|------|-------|-----------------|--------|----------------|-----------------|
| 1 | **Dashboard** | `/` | 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges; revenue goal progress bar with inline edit; pipeline funnel (clickable stages); mini storm map; storm activity feed (24h/7d/30d toggle); today's tasks with checkboxes + follow-ups; activity feed timeline; storm conversion rates panel; estimates status summary; team leaderboard table; loading skeletons; mobile "ROOF COMMAND" layout | Yes | None critical | **Match JN.** Has revenue goal (JN feature), loading skeletons, storm conversion (unique). Missing: custom dashboard widgets (RoofLink has this) |
| 2 | **Pipeline** | `/pipeline` | Kanban board with 3 board tabs (Sales/Production/Billing); drag-drop stage changes; conversion rates between columns; days-in-stage badges (color-coded); task progress badges on cards; deal value per card + column totals; financing status badges; priority indicators; hail size badges; due date badges; rep avatars; column collapse (localStorage); mobile board + list views; filter by priority/source/rep; active filter pills; CreateLeadModal; LeadDetail modal | Yes | None critical | **Match/Better JN+RL.** Has conversion rates (competitor gap now closed), board tabs, deal values. Missing: card thumbnails/photos (RoofLink shows property image on card) |
| 3 | **Leads** | `/leads` | 16-column data table; checkbox bulk select (Change Stage, Assign Rep); CSV export; CSV import (Census geocoding); saved filter presets (localStorage bookmarks); 4 filters (stage/priority/source/score); lead score badges with color gradient; URL-synced params; sortable columns; pagination (25/50/100); LeadDetail modal on row click; ImportLeadsModal | Yes | Quick filters (Hot Leads, Needs Follow-up, Unassigned) not fully implemented — buttons exist but logic stubbed | **Match JN.** Saved presets is better than JN. Missing: bulk email/SMS actions, map view of leads |
| 4 | **Lead Detail** | (modal) | Contact info + editable priority/stage; lead score breakdown (7 factors with progress bars, refresh); property details (roof type/size/pitch/segments, edge measurements, year built, structure/foundation); weather event section; insurance info; custom fields (5 types, inline edit); activity timeline; tasks section; documents (upload, annotate, delete); financing applications (status tracking); contracts section; expenses + profit summary (estimate - expenses = profit); client status page link; Google review request (on completion); solar potential (6 metrics); quick actions (Call, Email, SMS, Visit, Insurance Report); street view + satellite modal; roof drawing tool; storm history modal with PDF download; property report PDF; FEMA disaster history; billing modal for paid services; remove lead | Yes | Street View in property popup is hidden (`display: none`); some quick actions open native protocols (tel:, sms:, mailto:) rather than in-app functionality | **Better than JN** in data richness. Has solar analysis (Rooftops.ai feature), storm history, FEMA data. Missing: in-app SMS threading (JN has Engage), in-app email sending (relies on mailto:) |
| 5 | **Storm Map** | `/storm-map` | Google Maps hybrid with storm swath polygons; FEMA property overlay (tile-based, 5000 cap); county property overlay; hail history overlay (Honey Hole Finder); layer toggle controls; time range filter (24h-30d); swath opacity slider; "Houses Only" toggle; property popups with full detail (address, owner, year built, sqft, roof type, hail risk score, 5-year hail chart); add-to-pipeline from popup; address search with StreetView; mobile storm feed sidebar | Yes | "Generate Canvassing List" button is TODO stub; silent error handling (catch {}) throughout; reverse geocoding for storm catalog limited to 20 storms | **Better than HailTrace** on free data access. Missing: meteorologist verification (HailTrace's moat), hail swath color graduation by intensity, historical data beyond 30-day NOAA window |
| 6 | **Storm Catalog** | `/storm-catalog` | Storm archive cards with type/date/location/hail size/wind speed; time range filter (24h-30d); search across all fields; click-to-map navigation; reverse-geocoded locations (lazy, cached) | Yes | No sorting options; no severity/type filter dropdown; limited to 200 storms; no export | Unique feature — competitors don't have a browsable storm archive |
| 7 | **Estimates** | `/estimates` | KPI stat cards (4); status filter (6 statuses); estimate builder with line items + SRS catalog integration; template system; RichTextEditor for sections; discount management (% or $); tax rate selector; multi-signer authorization; auto-save (2s debounce); send-for-signing modal with email templates + merge tokens; Good/Better/Best tier generation; financing plan selection; section images; duplicate estimate; print/PDF (window.print); mobile responsive | Yes | PDF is browser print dialog, not server-generated PDF | **Better than JN** (SumoQuote). Has tier generation, financing plans, material catalog. Missing: professional PDF export (server-side pdfmake), inspection photo pages within estimate |
| 8 | **Public Estimate** | `/estimate/:token` | Full estimate display; e-signature canvas (mouse + touch); accept/decline flow; Stripe payment (card + ACH with fee breakdown); financing application (Hearth integration with polling); status display (accepted/declined/expired/paid) | Yes | None | **Better than JN.** Online payment + financing + e-sign all on one page. Unique combo |
| 9 | **Invoices** | `/invoices` | KPI stat cards (4: Total, Paid, Outstanding, Overdue); tab filters (All/Sent/Viewed/Paid/Overdue); create from accepted estimate; invoice builder with lead search + line items; preview mode; payment recording modal; send email; void invoice; overdue badge | Yes | None critical | **Match JN.** Missing: automated payment reminders UI (backend cron exists), QuickBooks sync, Text-to-Pay |
| 10 | **Contracts** | `/contracts` | KPI stat cards (4); status filter (6); contract builder with template system; lead search + auto-populate; merge field support (6 tokens); section editor (add/remove/edit); preview mode; send contract; void contract; create from estimate or lead | Yes | No image support in contract body | **Match JN.** Has template system, merge fields. Missing: contract change order management |
| 11 | **Work Orders** | `/work-orders` | 4-column kanban (Pending/Scheduled/In Progress/Completed); drag-drop status changes; create from estimate; detail modal with milestones (add/toggle/delete/photo upload); editable line items with running total; crew assignment; scheduled date/time; create new work order | Yes | None critical | **Better than JN.** Has milestones with photos, line item editing. Missing: milestone templates for common job types, templated checklists (RoofLink has this) |
| 12 | **Tasks** | `/tasks` | Filter tabs (Pending/Completed); create task modal (title, description, due_date, priority); toggle completion; edit task modal; overdue + due-today summary bar; mobile layout with "Mission Log" theme, overdue/today/upcoming sections, efficiency metrics (completion rate, critical path velocity) | Yes | None | **Match JN.** Mobile layout is unique and polished. Missing: task delegation/assignment UI (field exists but not prominent), recurring tasks |
| 13 | **Calendar** | `/calendar` | FullCalendar with Month/Week/Day/List views; shows tasks + calls + emails + door knocks; color-coded by type; drag tasks to reschedule; now indicator; event click navigates to lead | Yes | Only tasks are draggable; calls/emails/door knocks are view-only; no create-event-from-calendar | **Match JN** basic. Missing: appointment scheduling (JN has this), drag-to-create time slots, two-way Google Calendar sync |
| 14 | **Reports** | `/reports` | 6 report cards: Revenue (area chart), Pipeline (bar chart), Conversion by Source (radar), Rep Leaderboard (sortable table), Lead Sources (donut), Stage Duration (line chart); period presets (Week/Month/Quarter/Year/All); custom date range; comparison periods with delta badges (trend arrows); CSV export per report | Yes | None | **Match JN.** Comparison periods are a strong feature. Missing: chart drill-down (click bar to see filtered leads), custom report builder |
| 15 | **Canvassing** | `/canvassing` | Full-screen dark map; GPS-located pin dropping; 6 outcome types (Not Home, Interested, Not Interested, Scheduled, Follow Up, Already Customer); notes per pin; stats bar (doors/interested/scheduled); convert pin-to-lead; territory manager panel (polygon drawing); bottom sheet for pin details | Yes | No bulk pin operations; no breakdown by canvasser/time period; no route optimization | **Match HailTrace.** Has territory management (now built). Missing: GPS verification (HailTrace requires within 50ft), canvasser leaderboard, route planning |
| 16 | **Estimates (Public)** | `/estimate/:token` | (See #8 above) | Yes | — | — |
| 17 | **Content Studio** | `/content-studio` | Generate tab: 5 content types (Social, Door Hangers, Emails, Blog, Ad Copy) x 4 tones; 10 variables; batch mode (5 variations); Library tab: save/search/filter/copy/delete; localStorage persistence | Yes | None | **Match Rooftops.ai.** Has content generation + library. Missing: AI-powered (currently template-based), social media scheduling, SEO optimization |
| 18 | **Expenses** | `/expenses` | KPI summary (3 cards); filter by category (6 types) + date range; expense table with job linking; add/edit/delete modal with lead search; category badges (color-coded) | Yes | No pagination UI (50-item limit); no receipt attachment/upload; no CSV export | Unique — JN tracks via Profit Tracker but not as standalone. Missing: receipt photos, mileage tracking, expense reports |
| 19 | **Materials** | `/materials` | Catalog tab with 14 category tabs + search; product cards (image, SKU, name, manufacturer, price, stock); product detail modal with image carousel; cart sidebar with branch selection + quantities; order submission; Orders tab with history; SRS Catalog integration | Yes | Tax calculation may be simplified; no real-time inventory sync; order tracking limited | **Unique.** No competitor has in-app material ordering at this price point. Missing: real-time SRS pricing sync, order status webhooks |
| 20 | **Subcontractors** | `/subcontractors` | Full CRUD; filter by search/specialty (12 types)/status; table with color-coded specialty badges; slide-over add/edit form; phone auto-formatting; pagination (10/25/50); inline delete confirmation | Yes | None | **Better than JN** (JN has basic sub mgmt). Missing: subcontractor ratings/reviews, insurance/cert tracking, availability calendar |
| 21 | **Settings** | `/settings` | 15 tabs: Profile, Company, Billing (plan selection + add-ons + Stripe card), Payments, Team, Storm Alerts (thresholds + mode), Notifications (10 categories x 2 channels), Email/SMTP (config + test), Financing (Hearth connection + plan management), Automations, Drip Sequences, Custom Fields (5 types + CRUD), Pricing/Line Items (sectioned catalog), Contracts (template CRUD), Reviews (Google Place ID + message template) | Yes | Profile tab is read-only (no edit); Payments tab implementation unclear | **Better than JN** on free tier. Has financing, custom fields, 15 tabs. Missing: branding/white-label (logo upload), role-based permissions UI |
| 22 | **Admin** | `/admin` | 4 tabs: Overview (stat cards + revenue), Tenants (search/sort/expand/edit tier+status), Revenue (12-month stacked bars), Usage (skip trace + roof measurement leaderboards) | Yes | No bulk tenant management; no audit trail; no export | Internal tool — not customer-facing |

---

## Public Routes

| Route | Purpose | Works? |
|-------|---------|--------|
| `/login` | Email/password + tenant login | Yes |
| `/register` | New tenant registration | Yes |
| `/onboarding` | Post-registration setup wizard | Yes |
| `/estimate/:token` | Public estimate with e-sign + payment | Yes |
| `/contract/:token` | Public contract with e-sign | Yes |
| `/status/:token` | Client-facing job status page | Yes |

---

## Backend Infrastructure

| Category | Routes | Endpoints | Notes |
|----------|--------|-----------|-------|
| CRM Core | crm.js, leads.js | 51 | Full CRUD, pipeline stages, team members |
| Estimates | estimates.js | 15 | Builder, templates, public view, sending |
| Invoices | invoices.js | 8 | CRUD, payments, sending |
| Contracts | contracts.js | 12 | Templates, CRUD, public signing |
| Work Orders | workOrders.js | 10 | CRUD, milestones, photos |
| Map/Storm | map.js, storms.js, properties.js | 23 | FEMA, county, storm ingestion |
| Financing | financing.js, hearthWebhook.js | 14 | Hearth adapter, plans, applications |
| Canvassing | canvassing.js, territories.js | 11 | Pins, territories, polygon CRUD |
| Dashboard | dashboard.js | 3 | Stats, funnel, activity feed |
| Reports | reports.js | 6 | Revenue, pipeline, conversion, leaderboard |
| Auth | auth.js | 4 | Login, register, refresh, rate-limited |
| Payments | payments.js | 7 | Stripe intents, webhooks |
| Documents | documents.js | 3 | Upload, list, delete |
| Notifications | notifications.js | 6 | CRUD, preferences, mark-read |
| Search | search.js | 1 | Global search (Cmd-K) |
| Skip Trace | skipTrace.js | 10 | Contact info lookup |
| Roof Measurement | roofMeasurement.js | 8 | Satellite measurements |
| Data APIs | dataApis.js, stormHistory.js, disasterDeclarations.js | 6 | Census ACS, NOAA SWDI, FEMA |
| Content | content.js | 3 | AI content generation |
| Drip | drip.js | 8 | Sequences, steps, enrollment |
| Automations | automations.js | 5 | Workflow triggers |
| Materials | materials.js | 9 | SRS catalog, orders |
| Subcontractors | subcontractors.js | 8 | Full CRUD |
| Admin | admin.js | 6 | Tenant management, revenue |
| Other | alerts, counties, drift, expenses, onboarding, webhook | 25 | Storm alerts, onboarding, etc. |
| **TOTAL** | **38 files** | **271 endpoints** | |

### Background Jobs / Cron
- **Storm ingestion scheduler** — Polls SPC/MRMS/NWS for new storms every 5 minutes
- **Drip sequence processor** — Runs every 15 minutes, progresses enrolled leads through drip steps
- **Overdue invoice reminders** — Daily cron, sends email for overdue invoices
- **Lead scoring** — On-demand calculation using Census ACS, FEMA, NOAA SWDI APIs

---

## Competitor Feature Matrix Cross-Reference

Items from the 2026-03-25 matrix that were marked "Missing" but have **since been built**:

| Feature | Matrix Status | Current Status | When Built |
|---------|--------------|----------------|------------|
| Honey Hole Finder | Missing | **DONE** — NOAA SWDI 10-year hail history heat map overlay | 2026-03-25 |
| Territory/region assignment | Missing | **DONE** — PostGIS polygon drawing + rep assignment | 2026-03-24 |
| Photo annotation | Missing | **DONE** — Canvas markup in LeadDetail documents tab | 2026-03-24 |
| Subcontractor management | Missing | **DONE** — Full CRUD with work order assignment | 2026-03-24 |
| Automated review requests | Missing | **DONE** — Google review link on job completion | 2026-03-24 |
| AI content/marketing | Missing | **DONE** — Content Studio with 5 types x 4 tones + library | 2026-03-27 |
| Lead scoring | Not in matrix | **DONE** — 7-factor algorithm with breakdown popup | 2026-03-25 |
| FEMA disaster data | Not in matrix | **DONE** — County-level risk scoring | 2026-03-25 |
| Census demographics | Not in matrix | **DONE** — On-demand ACS for home age, ownership | 2026-03-25 |
| Drip sequences | Not in matrix | **DONE** — Auto-enrollment + step progression + email sending | Pre-existing |
| Financing (Hearth) | Not in matrix | **DONE** — Full adapter, webhook, Settings tab | Pre-existing |
| Good/Better/Best tiers | Not in matrix | **DONE** — Tier generation in EstimatesView | 2026-03-26 |
| Reports comparison periods | Not in matrix | **DONE** — Trend arrows + delta badges | 2026-03-28 |
| Pipeline board tabs | Not in matrix | **DONE** — Sales/Production/Billing | 2026-03-27 |
| Saved filter presets | Not in matrix | **DONE** — localStorage bookmarks in LeadList | 2026-03-28 |
| Revenue goal tracking | Not in matrix | **DONE** — Dashboard progress bar with inline edit | 2026-03-28 |

---

## Updated Feature Matrix (Corrected 2026-03-29)

| Feature | JobNimbus | HailTrace | RoofLink | StormLeads | Status |
|---------|-----------|-----------|----------|-----------|--------|
| **CRM & Pipeline** | | | | | |
| Kanban pipeline | Yes | Limited | Yes | Yes (3 boards) | **Better** |
| Contact management | Yes | No | Yes | Yes | Match |
| Lead scoring | No | No | No | Yes (7-factor) | **Better** |
| Custom fields | Yes ($550) | Yes | Yes | Yes (free) | **Better** |
| Global search | Yes | No | No | Yes (Cmd-K) | Match |
| Saved filter presets | Yes | No | No | Yes | **Better** |
| **Sales & Estimating** | | | | | |
| Estimate builder | Yes | No | Yes | Yes + tiers | **Better** |
| E-signature | Yes | No | Yes | Yes (canvas) | Match |
| Financing on estimate | Yes ($) | No | No | Yes (Hearth, free) | **Better** |
| SRS material catalog | No | No | Yes | Yes | Match |
| **Invoicing & Payments** | | | | | |
| Invoicing | Yes | No | Yes | Yes | Match |
| Online payments (Stripe) | Yes ($) | No | Yes | Yes (free) | **Better** |
| QuickBooks sync | Yes | No | Yes | No | **Missing** |
| Text-to-Pay | Yes | No | No | No | **Missing** |
| **Storm Data** | | | | | |
| Live hail/wind/tornado maps | No | Yes (core) | Yes | Yes (NOAA, free) | **Better** |
| Real-time storm alerts | No | Yes ($) | Yes | Yes (free) | **Better** |
| Honey Hole Finder | No | Yes | No | Yes (SWDI, free) | **Match** |
| Historical data depth | No | 10+ years | No | 10 years (SWDI) | **Match** |
| Meteorologist verification | No | Yes | No | No | **Worse** |
| FEMA property data | No | No | No | Yes (free) | **Unique** |
| Census demographics | No | No | No | Yes (free) | **Unique** |
| **Canvassing** | | | | | |
| GPS pin dropping | No | Yes ($) | Yes | Yes | Match |
| Territory management | No | Yes ($) | Yes | Yes (PostGIS) | **Match** |
| **Work Orders** | | | | | |
| Milestones + photos | No | No | Yes | Yes | Match |
| Editable line items | No | No | Yes | Yes | Match |
| **Communication** | | | | | |
| SMS texting | Yes ($49-249/mo) | No | No | No | **Missing** |
| In-app email | Yes | No | No | No (mailto:) | **Worse** |
| AI phone receptionist | Yes ($298/mo) | No | No | No | **Missing** |
| **AI Features** | | | | | |
| AI content generation | No | No | No | Yes (template) | Partial |
| AI roof measurements | No | No | Yes ($) | No | **Missing** |
| **Other** | | | | | |
| Photo annotation | Yes ($19/user) | No | Yes ($) | Yes (free) | **Better** |
| Subcontractor mgmt | Yes | No | No | Yes | Match |
| Drip sequences | Yes | No | No | Yes (free) | **Better** |
| Mobile app | Yes (native) | Yes | Yes | No (PWA only) | **Worse** |

---

## Top 10 Improvement Opportunities

Ranked by competitive impact and feasibility:

### 1. **QuickBooks Sync** (Missing vs JN + RoofLink)
Every roofing company uses QuickBooks. JN and RoofLink both sync invoices. This is the #1 integration gap that prevents adoption by established contractors. QuickBooks has a free developer tier. Priority: one-way invoice push first.

### 2. **Server-Side PDF Export for Estimates** (Worse vs JN/SumoQuote)
Current "PDF" is just browser print dialog. JN/SumoQuote generate professional, branded PDFs. Need server-side pdfmake or Puppeteer generation with company logo, proper headers, and inspection photo pages. This is the most common negative impression when comparing to competitors.

### 3. **In-App SMS Texting** (Missing vs JN $49-249/mo)
JN charges $49-249/mo extra for Engage texting. Twilio costs ~$0.0075/msg. Build in-app SMS thread UI with send/receive. This is the single most requested feature by field sales teams. Even a basic implementation (outbound only) would close a major gap.

### 4. **Appointment Scheduling on Calendar** (Worse vs JN)
Calendar currently only displays events — you can't create appointments from it. Need click-to-create time slots, drag-to-schedule, and eventually two-way Google Calendar sync. Field teams live on their calendar.

### 5. **Hail Swath Color Graduation by Intensity** (Missing visual polish)
Storm swaths currently render as uniform color. HailTrace color-codes by hail size (green < 1", yellow 1-1.5", orange 1.5-2", red > 2"). This is a visual credibility signal that immediately communicates data quality to users.

### 6. **Pipeline Card Property Thumbnails** (Missing vs RoofLink)
RoofLink shows a small property/satellite image on each pipeline card. StormLeads cards show text only. A Google Street View or satellite thumbnail on cards would dramatically improve the visual density and usefulness of the pipeline view.

### 7. **Receipt Upload on Expenses** (Missing basic functionality)
Expenses have no file attachment. Contractors take photos of receipts constantly. Adding a simple image upload to expense records (reuse existing document upload infrastructure) would make expense tracking actually usable in the field.

### 8. **Recurring Tasks** (Missing vs JN)
Tasks are one-time only. Roofing ops have recurring needs: "Check job site every Tuesday", "Follow up on unpaid invoices weekly". Need a recurrence rule (daily/weekly/monthly) on task creation.

### 9. **Work Order Milestone Templates** (Missing vs RoofLink)
Each new work order requires manually adding milestones. RoofLink has templated checklists for common job types (tear-off, install, cleanup, final inspection). Pre-defined milestone sets would save significant time per job.

### 10. **Lead List Quick Filters** (Partially implemented)
The "Hot Leads", "Needs Follow-up", and "Unassigned" quick filter buttons exist in the UI but their logic is stubbed. These are high-usage one-click filters that would significantly speed up daily lead management.

---

## Honorable Mentions (Lower Priority)

- **Google Calendar two-way sync** — needed eventually but complex OAuth flow
- **Custom dashboard widgets** — RoofLink has this but it's a large effort
- **Chart drill-down in reports** — click bar/funnel segment to see filtered lead list
- **Canvasser leaderboard + route planning** — nice-to-have for field teams
- **Subcontractor insurance/cert tracking** — important for compliance
- **Native mobile app** — PWA works but native would improve store presence
- **Branding/white-label** — logo upload in settings for estimates/invoices

---

*Generated 2026-03-29 via full source code analysis of 21 protected routes, 6 public routes, 38 backend route files (271 endpoints), and cross-reference with competitor gap analysis matrix.*
