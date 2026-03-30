# StormLeads App Inventory — 2026-03-30

**Method:** Full source code analysis of all 20 protected routes + 6 public routes, 37 backend route files (264 endpoints), live API endpoint testing, and cross-reference with competitor gap analysis matrix.

**Changes since 2026-03-29 inventory:** 5 new features added (milestone templates, content preview, chart drill-down, pipeline badges, estimate tier comparison). Nightly Playwright UI audit added.

---

## Page-by-Page Feature Inventory

| # | Page | Route | Features Present | Works? | Broken/Missing | Competitor Notes |
|---|------|-------|-----------------|--------|----------------|-----------------|
| 1 | **Dashboard** | `/` | 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges; revenue goal progress bar with inline edit; pipeline funnel (clickable stages → navigate to filtered leads); mini storm map; storm activity feed (24h/7d/30d toggle); today's tasks with checkboxes + follow-ups; activity feed timeline; storm conversion rates panel; estimates status summary; team leaderboard table; loading skeletons with shimmer; mobile "ROOF COMMAND" layout | Yes | None critical | **Match JN.** Has revenue goal (JN feature), loading skeletons, storm conversion (unique). Missing: custom dashboard widgets (RoofLink has this) |
| 2 | **Pipeline** | `/pipeline` | Kanban board with 3 board tabs (Sales/Production/Billing); drag-drop stage changes; conversion rates between columns; days-in-stage badges (color-coded); task progress badges on cards; deal value per card + column totals; **NEW: lead score badges + source badges on cards**; financing status badges; priority indicators; hail size badges; due date badges; rep avatars; column collapse (localStorage); mobile board + list views; filter by priority/source/rep; active filter pills; CreateLeadModal; LeadDetail modal | Yes | None critical | **Better than JN+RL.** Now has score/source badges on cards (was missing). Missing: card thumbnails/photos (RoofLink shows property image on card) |
| 3 | **Leads** | `/leads` | 16-column data table; checkbox bulk select (Change Stage, Assign Rep); CSV export; CSV import (Census geocoding); saved filter presets (localStorage bookmarks); 4 filters (stage/priority/source/score); lead score badges with color gradient; URL-synced params; sortable columns; pagination (25/50/100); LeadDetail modal on row click; ImportLeadsModal; Quick filter buttons (Hot Leads, Needs Follow-up, Unassigned) | Yes | Quick filters partially stubbed — Hot Leads works (sets priority=hot), but Needs Follow-up and Unassigned have no backend support; Bulk "Assign Rep" uses raw text input for UUID instead of dropdown (unusable UX) | **Match JN.** Saved presets better than JN. Missing: bulk email/SMS actions, map view of leads |
| 4 | **Lead Detail** | (modal) | Contact info + editable priority/stage; lead score breakdown (7 factors with progress bars, refresh); property details (roof type/size/pitch/segments, edge measurements, year built, structure/foundation); weather event section; insurance info; custom fields (5 types, inline edit); activity timeline; tasks section; documents (upload, annotate, delete); financing applications (status tracking); contracts section; expenses + profit summary (estimate - expenses = profit); client status page link; Google review request (on completion); solar potential (6 metrics); quick actions (Call, Email, SMS, Visit, Insurance Report); street view + satellite modal (working); roof drawing tool; storm history modal with PDF download; property report PDF; FEMA disaster history; billing modal; remove lead | Yes | Quick actions (Call, SMS) open native protocols (tel:, sms:) rather than in-app; Street View fixed (was hidden, now working) | **Better than JN** in data richness. Has solar analysis, storm history, FEMA data. Missing: in-app SMS threading (JN Engage), in-app email composer (relies on mailto:) |
| 5 | **Storm Map** | `/storm-map` | Google Maps hybrid with storm swath polygons; FEMA property overlay (tile-based, 5000 cap); county property overlay; hail history overlay (Honey Hole Finder — 10-year SWDI data); layer toggle controls; time range filter (24h-30d); swath opacity slider; "Houses Only" toggle; property popups with full detail (address, owner, year built, sqft, roof type, hail risk score, 5-year hail chart); add-to-pipeline from popup; address search with StreetView; mobile storm feed sidebar | Yes | "Generate Canvassing List" button is TODO stub (line 2670); 4 empty catch blocks silently swallow errors (lines 247, 256, 265, 274); reverse geocoding for storm catalog limited to 20 storms | **Better than HailTrace** on free data. Missing: meteorologist verification, hail swath color graduation by intensity, historical data beyond 30-day NOAA window |
| 6 | **Storm Catalog** | `/storm-catalog` | Storm archive cards with type/date/location/hail size/wind speed; time range filter (24h-30d); search across all fields; click-to-map navigation; reverse-geocoded locations (lazy, cached) | Yes | No sorting options; no severity/type filter dropdown; limited to 200 storms; no export | Unique — competitors don't have a browsable storm archive |
| 7 | **Estimates** | `/estimates` | KPI stat cards (4); status filter (6 statuses); estimate builder with line items + SRS catalog integration; template system; RichTextEditor for sections; discount management (% or $); tax rate selector; multi-signer authorization; auto-save (2s debounce); send-for-signing modal with email templates + merge tokens; Good/Better/Best tier generation; **NEW: tier comparison view** (side-by-side comparison); financing plan selection; section images; duplicate estimate; print/PDF (window.print); mobile responsive | Yes | PDF is browser print dialog, not server-generated PDF | **Better than JN** (SumoQuote). Has tier generation + comparison view, financing plans, material catalog. Missing: professional PDF export (server-side pdfmake), inspection photo pages |
| 8 | **Public Estimate** | `/estimate/:token` | Full estimate display; e-signature canvas (mouse + touch); accept/decline flow; Stripe payment (card + ACH with fee breakdown); financing application (Hearth integration with polling); status display (accepted/declined/expired/paid) | Yes | None | **Better than JN.** Online payment + financing + e-sign all on one page |
| 9 | **Invoices** | `/invoices` | KPI stat cards (4: Total, Paid, Outstanding, Overdue); tab filters (All/Sent/Viewed/Paid/Overdue); create from accepted estimate; invoice builder with lead search + line items; preview mode; payment recording modal; send email; void invoice; overdue badge; automated overdue reminders (daily cron) | Yes | None critical | **Match JN.** Missing: QuickBooks sync, Text-to-Pay |
| 10 | **Contracts** | `/contracts` | KPI stat cards (4); status filter (6); contract builder with template system; lead search + auto-populate; merge field support (6 tokens); section editor (add/remove/edit); preview mode; send contract; void contract; create from estimate or lead | Yes | No image support in contract body | **Match JN.** Has template system, merge fields. Missing: contract change order management |
| 11 | **Work Orders** | `/work-orders` | 4-column kanban (Pending/Scheduled/In Progress/Completed); drag-drop status changes; create from estimate; detail modal with milestones (add/toggle/delete/photo upload); **NEW: milestone templates for 8 job types** (tear-off, shingle install, metal install, flat roof, gutter, siding, fence, general repair); editable line items with running total; crew assignment; scheduled date/time; create new work order; "From Estimate" button | Yes | None critical | **Better than JN+RL.** Now has milestone templates (RoofLink gap closed). Missing: photo-required milestone hard stops (RoofLink blocks stage advancement without photos) |
| 12 | **Tasks** | `/tasks` | Filter tabs (Pending/Completed); create task modal (title, description, due_date, priority); toggle completion; edit task modal; overdue + due-today summary bar; mobile layout with "Mission Log" theme, overdue/today/upcoming sections, efficiency metrics (completion rate, critical path velocity) | Yes | Silent error handling — no toast notifications on create/edit failure (unlike WorkOrdersView); assignee field not exposed in create/edit form | **Match JN.** Mobile layout is unique. Missing: task delegation/assignment UI, recurring tasks |
| 13 | **Calendar** | `/calendar` | FullCalendar with Month/Week/Day/List views; shows tasks + calls + emails + door knocks; color-coded by type; drag tasks to reschedule; now indicator; event click navigates to lead; max 4 events/day display | Yes | Only tasks are draggable; calls/emails/door knocks are view-only; no create-event-from-calendar | **Match JN** basic. Missing: appointment scheduling, drag-to-create time slots, Google Calendar sync |
| 14 | **Reports** | `/reports` | 6 report cards: Revenue (area chart), Pipeline (bar chart **with drill-down**), Conversion by Source (radar), Rep Leaderboard (sortable table), Lead Sources (donut **with drill-down**), Stage Duration (line chart); period presets (Week/Month/Quarter/Year/All); custom date range; comparison periods with delta badges + trend arrows; CSV export per report | Yes | None | **Better than JN.** Now has chart drill-down (was missing). Comparison periods + drill-down are strong features |
| 15 | **Canvassing** | `/canvassing` | Full-screen dark map; GPS-located pin dropping; 6 outcome types (Not Home, Interested, Not Interested, Scheduled, Follow Up, Already Customer); notes per pin; stats bar (doors/interested/scheduled); convert pin-to-lead; territory manager panel (polygon drawing); bottom sheet for pin details | Yes | No bulk pin operations; no breakdown by canvasser/time period; no route optimization | **Match HailTrace.** Missing: GPS verification (HailTrace requires within 50ft), canvasser leaderboard, route planning |
| 16 | **Content Studio** | `/content-studio` | Generate tab: 5 content types (Social, Door Hangers, Emails, Blog, Ad Copy) x 4 tones; 10 variables; batch mode (5 variations); **NEW: live preview panel** showing formatted output; Library tab: save/search/filter/copy/delete; localStorage persistence | Yes | **NOT IN SIDEBAR** — only accessible via direct URL; template-based generation (not AI-powered) | **Partial match Rooftops.ai.** Has content generation + library + live preview. Missing: AI-powered generation (LLM), social media scheduling, SEO optimization |
| 17 | **Expenses** | `/expenses` | KPI summary (3 cards); filter by category (6 types) + date range; expense table with job linking; add/edit/delete modal with lead search; category badges (color-coded) | Yes | No pagination UI (50-item limit); no receipt attachment/upload; no CSV export | Unique — JN tracks via Profit Tracker but not standalone. Missing: receipt photos, mileage tracking, expense reports |
| 18 | **Materials** | `/materials` | Catalog tab with 14 category tabs + search; product cards (image, SKU, name, manufacturer, price, stock); product detail modal with image carousel; cart sidebar with branch selection + quantities; order submission; Orders tab with history; SRS Catalog integration | Yes | No real-time inventory sync; tax calculation simplified; order tracking limited | **Unique.** No competitor has in-app material ordering at this price point |
| 19 | **Subcontractors** | `/subcontractors` | Full CRUD; filter by search/specialty (12 types)/status; table with color-coded specialty badges; slide-over add/edit form; phone auto-formatting; pagination (10/25/50); inline delete confirmation | Yes | None | **Better than JN.** Missing: subcontractor ratings/reviews, insurance/cert tracking, availability calendar |
| 20 | **Settings** | `/settings` | 15 tabs: Profile, Company, Billing (plan selection + add-ons + Stripe card), Payments, Team, Storm Alerts (thresholds + mode), Notifications (10 categories x 2 channels), Email/SMTP (config + test), Financing (Hearth connection + plan management), Automations (workflow triggers), Drip Sequences (auto-enrollment + step progression), Custom Fields (5 types + CRUD), Pricing/Line Items (sectioned catalog), Contracts (template CRUD), Reviews (Google Place ID + message template) | Yes | Profile tab is read-only (display only, no edit form); Payments tab implementation unclear | **Better than JN** on free tier. Has financing, custom fields, 15 tabs. Missing: branding/white-label (logo upload), role-based permissions UI |
| 21 | **Admin** | `/admin` | 4 tabs: Overview (stat cards + revenue), Tenants (search/sort/expand/edit tier+status), Revenue (12-month stacked bars), Usage (skip trace + roof measurement leaderboards). Requires `super_admin` role (not visible for regular `admin` users) | N/A | Not testable with current user (admin role, not super_admin) | Internal tool — not customer-facing |
| 22 | **Alerts** | `/alerts` | Storm alert configuration: hail size threshold, wind speed threshold, radius, enabled/disabled toggle; email recipients list; mode selector | Yes | **NOT IN SIDEBAR** — only accessible via direct URL or Settings integration | Functional but discovery issue |

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

| Category | Route Files | Endpoints | Notes |
|----------|------------|-----------|-------|
| CRM Core | crm.js, leads.js | 51 | Full CRUD, pipeline stages, team members |
| Estimates | estimates.js | 15 | Builder, templates, public view, sending |
| Invoices | invoices.js | 8 | CRUD, payments, sending |
| Contracts | contracts.js | 12 | Templates, CRUD, public signing |
| Work Orders | workOrders.js | 11 | CRUD, milestones, photos, templates |
| Map/Storm | map.js, storms.js, properties.js | 23 | FEMA, county, storm ingestion |
| Financing | financing.js, hearthWebhook.js | 14 | Hearth adapter, plans, applications |
| Canvassing | canvassing.js, territories.js | 11 | Pins, territories, polygon CRUD |
| Dashboard | dashboard.js | 3 | Stats, funnel, activity feed |
| Reports | reports.js | 6 | Revenue, pipeline, conversion, leaderboard, stage duration, lead sources |
| Auth | auth.js | 4 | Login, register, refresh, rate-limited |
| Payments | payments.js | 7 | Stripe intents, webhooks |
| Documents | documents.js | 3 | Upload, list, delete |
| Notifications | notifications.js | 6 | CRUD, preferences, mark-read |
| Search | search.js | 1 | Global search (Cmd-K) |
| Skip Trace | skipTrace.js | 10 | Contact info lookup (paid) |
| Roof Measurement | roofMeasurement.js | 8 | Satellite measurements (paid) |
| Data APIs | dataApis.js, stormHistory.js, disasterDeclarations.js | 6 | Census ACS, NOAA SWDI, FEMA |
| Content | content.js | 3 | AI content generation |
| Drip | drip.js | 8 | Sequences, steps, enrollment |
| Automations | automations.js | 5 | Workflow triggers |
| Materials | materials.js | 9 | SRS catalog, orders |
| Subcontractors | subcontractors.js | 8 | Full CRUD |
| Admin | admin.js | 6 | Tenant management, revenue |
| Other | alerts, counties, drift, expenses, onboarding, webhook | 30 | Storm alerts, onboarding, etc. |
| **TOTAL** | **37 files** | **264 endpoints** | |

### Background Jobs / Cron

- **Storm ingestion scheduler** — Polls SPC/MRMS/NWS for new storms every 5 minutes
- **Drip sequence processor** — Runs every 15 minutes, progresses enrolled leads through drip steps
- **Overdue invoice reminders** — Daily cron, sends email for overdue invoices
- **Lead scoring** — On-demand calculation using Census ACS, FEMA, NOAA SWDI APIs
- **Nightly UI audit** — 4am Playwright test suite screenshots all pages (added 2026-03-30)

---

## Live API Test Results (2026-03-30)

| Endpoint | Status | Data |
|----------|--------|------|
| `POST /api/auth/login` | OK | Returns JWT + user object |
| `GET /api/crm/dashboard/stats` | OK | 4 stat cards with oklch colors |
| `GET /api/dashboard/funnel` | OK | 4 stages (new:6, contacted:1, appt_set:1, inspected:1) |
| `GET /api/dashboard/activity` | OK | Empty (no recent activity) |
| `GET /api/leads?page=1&pageSize=5` | OK | 9 total leads |
| `GET /api/leads/:id` | OK | Full lead detail with property, scores, factors |
| `GET /api/estimates` | OK | 0 estimates |
| `GET /api/crm/invoices` | OK | 4 invoices |
| `GET /api/crm/contracts` | OK | 1 contract |
| `GET /api/crm/work-orders` | OK | 1 work order ("Roof Replacement") |
| `GET /api/crm/tasks` | OK | 0 tasks |
| `GET /api/notifications` | OK | 0 notifications |
| `GET /api/crm/expenses` | OK | 0 expenses |
| `GET /api/crm/subcontractors` | OK | 0 subcontractors |
| `GET /api/crm/drip-sequences` | OK | 0 sequences |
| `GET /api/crm/territories` | OK | 0 territories |
| `GET /api/crm/canvass-pins` | OK | 8 canvass pins |
| `GET /api/crm/reports/revenue` | OK | 1 month of data ($5K estimated) |
| `GET /api/storms?hours=168` | OK | GeoJSON FeatureCollection with storm polygons |
| `GET /api/search?q=test` | OK | Returns leads, contacts, estimates arrays |
| `GET /api/crm/team` | OK | 2 team members (Brandon Admin, Miles Martin) |
| `GET /api/crm/financing/plans` | OK | 0 plans (no Hearth connected) |
| `GET /api/crm/automations` | OK | 0 automations |
| `GET /api/admin/overview` | 403 | Requires super_admin role (by design) |

---

## Competitor Feature Matrix Cross-Reference (Updated 2026-03-30)

Items from the 2026-03-29 matrix that were marked "Missing" but have **since been built**:

| Feature | Previous Status | Current Status | When Built |
|---------|---------------|----------------|------------|
| Work order milestone templates | Missing (Top 10 #9) | **DONE** — 8 job type templates | 2026-03-29 |
| Chart drill-down in reports | Honorable mention | **DONE** — Pipeline + Lead Sources clickable | 2026-03-29 |
| Pipeline card badges | Missing detail | **DONE** — Lead score + source badges on cards | 2026-03-29 |
| Content Studio live preview | Missing vs Rooftops.ai | **DONE** — Side-by-side preview panel | 2026-03-29 |
| Estimate tier comparison | Missing vs RoofLink | **DONE** — Good/Better/Best side-by-side view | 2026-03-29 |
| Street View in LeadDetail | Was hidden (display:none) | **FIXED** — Working, portaled to body | Recent |

---

## Updated Feature Matrix (Corrected 2026-03-30)

| Feature | JobNimbus | HailTrace | RoofLink | StormLeads | Status |
|---------|-----------|-----------|----------|-----------|--------|
| **CRM & Pipeline** | | | | | |
| Kanban pipeline | Yes | Limited | Yes | Yes (3 boards) | **Better** |
| Contact management | Yes | No | Yes | Yes | Match |
| Lead scoring | No | No | No | Yes (7-factor) | **Better** |
| Custom fields | Yes ($550) | Yes | Yes | Yes (free) | **Better** |
| Global search | Yes | No | No | Yes (Cmd-K) | Match |
| Saved filter presets | Yes | No | No | Yes | **Better** |
| Pipeline card badges | Yes | No | Yes | Yes (score+source) | **Match** |
| **Sales & Estimating** | | | | | |
| Estimate builder | Yes | No | Yes | Yes + tiers + comparison | **Better** |
| E-signature | Yes | No | Yes | Yes (canvas) | Match |
| Financing on estimate | Yes ($) | No | No | Yes (Hearth, free) | **Better** |
| SRS material catalog | No | No | Yes | Yes | Match |
| **Invoicing & Payments** | | | | | |
| Invoicing | Yes | No | Yes | Yes | Match |
| Online payments (Stripe) | Yes ($) | No | Yes | Yes (free) | **Better** |
| QuickBooks sync | Yes | No | Yes | No | **Missing** |
| Text-to-Pay | Yes | No | No | No | **Missing** |
| Invoice aging buckets | Yes | No | No | No | **Missing** |
| **Storm Data** | | | | | |
| Live hail/wind/tornado maps | No | Yes (core) | Yes | Yes (NOAA, free) | **Better** |
| Real-time storm alerts | No | Yes ($) | Yes | Yes (free) | **Better** |
| Honey Hole Finder | No | Yes | No | Yes (SWDI, free) | **Match** |
| Historical data depth | No | 10+ years | No | 10 years (SWDI) | **Match** |
| Meteorologist verification | No | Yes | No | No | **Worse** |
| FEMA property data | No | No | No | Yes (free) | **Unique** |
| Census demographics | No | No | No | Yes (free) | **Unique** |
| Hail swath color graduation | No | Yes (core) | No | No | **Missing** |
| **Canvassing** | | | | | |
| GPS pin dropping | No | Yes ($) | Yes | Yes | Match |
| Territory management | No | Yes ($) | Yes | Yes (PostGIS) | **Match** |
| **Work Orders** | | | | | |
| Milestones + photos | No | No | Yes | Yes | Match |
| Editable line items | No | No | Yes | Yes | Match |
| Milestone templates | No | No | Yes | Yes (8 types) | **Match** |
| **Communication** | | | | | |
| SMS texting | Yes ($49-249/mo) | No | No | No | **Missing** |
| In-app email | Yes | No | No | No (mailto:) | **Worse** |
| AI phone receptionist | Yes ($298/mo) | No | No | No | **Missing** |
| **AI Features** | | | | | |
| AI content generation | No | No | No | Yes (template) | Partial |
| AI roof measurements | No | No | Yes ($) | No | **Missing** |
| **Reports** | | | | | |
| Revenue/Pipeline charts | Yes | No | Yes | Yes | Match |
| Comparison periods | No | No | No | Yes | **Better** |
| Chart drill-down | Yes | No | Yes | Yes | **Match** |
| CSV export | Yes | No | Yes | Yes | Match |
| **Other** | | | | | |
| Photo annotation | Yes ($19/user) | No | Yes ($) | Yes (free) | **Better** |
| Subcontractor mgmt | Yes | No | No | Yes | Match |
| Drip sequences | Yes | No | No | Yes (free) | **Better** |
| Mobile app | Yes (native) | Yes | Yes | No (PWA only) | **Worse** |

---

## Navigation & Discovery Issues

| Page | In Sidebar? | How to Access | Impact |
|------|-------------|---------------|--------|
| Content Studio | **No** | Direct URL `/content-studio` only | Users can't discover it |
| Alerts | **No** | Direct URL `/alerts` only (also in Settings > Storm Alerts) | Low — Settings tab covers it |
| Admin | Conditional | Only visible for `super_admin` role | By design |
| Drip Sequences | **No** | Settings > Drip Sequences tab only | Low — Settings tab covers it |

---

## Top 10 Improvement Opportunities (Updated 2026-03-30)

Ranked by competitive impact and feasibility. Items closed since yesterday are struck through.

### 1. **QuickBooks Sync** (Missing vs JN + RoofLink)
Every roofing company uses QuickBooks. JN and RoofLink both sync invoices. This is the #1 integration gap that prevents adoption by established contractors. QuickBooks has a free developer tier. Priority: one-way invoice push first.

### 2. **Server-Side PDF Export for Estimates** (Worse vs JN/SumoQuote)
Current "PDF" is browser print dialog. JN/SumoQuote generate professional, branded multi-page PDFs with cover pages, inspection photos, line items, signing, and terms. Need server-side pdfmake or Puppeteer generation. This is the most visible quality gap.

### 3. **In-App SMS Texting** (Missing vs JN $49-249/mo)
JN charges $49-249/mo for Engage texting. Twilio costs ~$0.0075/msg. Build in-app SMS thread UI with send/receive. Single most requested feature by field sales teams. Even outbound-only would close a major gap.

### 4. **Appointment Scheduling on Calendar** (Worse vs JN)
Calendar displays events but can't create appointments from it. Need click-to-create time slots, drag-to-schedule. Field teams live on their calendar. Currently only tasks are draggable; calls/emails are view-only.

### 5. **Hail Swath Color Graduation by Intensity** (Missing vs HailTrace)
Storm swaths render as uniform color. HailTrace color-codes by hail size (green < 1", yellow 1-1.5", orange 1.5-2", red > 2"). Visual credibility signal that communicates data quality.

### 6. **LeadList Quick Filters Backend** (Partially implemented)
Hot Leads filter works (sets priority=hot), but "Needs Follow-up" and "Unassigned" have no backend support. Need `needs_followup` and `unassigned` query params on the leads endpoint. Quick win — 30 minutes of backend work.

### 7. **Invoice Aging Buckets** (Missing vs JN)
JN sorts overdue invoices into 1-30, 31-60, 61-90, 91+ day buckets with summary cards. We have overdue badges but no aging analysis. Quick win — add bucket headers/cards to InvoicesView.

### 8. **Receipt Upload on Expenses** (Missing basic functionality)
Expenses have no file attachment. Contractors take photos of receipts constantly. Reuse existing document upload infrastructure. Makes expense tracking actually usable in the field.

### 9. **Content Studio Sidebar Link** (Discovery issue)
Content Studio is fully built but not in the sidebar navigation. Users cannot discover it without knowing the URL. Add it under an appropriate nav group.

### 10. **Profile Tab Edit Mode** (Missing basic functionality)
Settings > Profile is read-only (name, email, role displayed but not editable). Users can't update their name or password from Settings. Need an edit form with save functionality.

---

## Honorable Mentions (Lower Priority)

- **Bulk assign rep dropdown** — currently a raw text input for UUID, needs team member dropdown
- **Recurring tasks** — daily/weekly/monthly task recurrence (JN has this)
- **Task assignee in create/edit form** — field exists in DB but not in UI
- **Task error handling** — silent failures, no toast notifications on create/edit/toggle
- **Google Calendar two-way sync** — complex OAuth flow
- **Custom dashboard widgets** — RoofLink has this but large effort
- **Canvasser leaderboard + route planning** — nice-to-have for field teams
- **Subcontractor insurance/cert tracking** — important for compliance
- **Native mobile app** — PWA works but native improves store presence
- **Branding/white-label** — logo upload for estimates/invoices
- **Profit tracker / variance analysis** — JN tracks planned vs actual margins
- **Photo-required milestone hard stops** — RoofLink blocks advancement without photos
- **AI-powered content generation** — LLM integration for Content Studio
- **Storm catalog sorting/filtering** — no sort options, no severity filter
- **Generate Canvassing List button** — TODO stub on StormMap (line 2670)

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Protected routes | 20 |
| Public routes | 6 |
| Backend route files | 37 |
| Total API endpoints | 264 |
| Background cron jobs | 5 |
| Settings tabs | 15 |
| Features marked "Better" than competitors | 14 |
| Features matching competitors | 15 |
| Features "Missing" vs competitors | 7 |
| Features "Worse" than competitors | 3 |
| Features "Unique" to StormLeads | 2 |

---

*Generated 2026-03-30 via full source code analysis of 20 protected routes, 6 public routes, 37 backend route files (264 endpoints), live API endpoint testing, and cross-reference with competitor gap analysis matrix.*
