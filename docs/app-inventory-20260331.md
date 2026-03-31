# StormLeads App Inventory — 2026-03-31

**Method:** Full source code analysis of all 23 protected routes + 6 public routes, 37 backend route files (180+ endpoints), live API endpoint testing (28 endpoints verified), and cross-reference with competitor gap analysis matrix.

**Changes since 2026-03-30 inventory:** 8 commits — dashboard filters, storm catalog severity/sorting, A/R aging buckets, photo-required milestones, Content Studio sidebar link, CustomSelect fix on dashboard.

---

## Page-by-Page Feature Inventory

| # | Page | Route | Features Present | Works? | Broken/Missing | Competitor Notes |
|---|------|-------|-----------------|--------|----------------|-----------------|
| 1 | **Dashboard** | `/` | 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges; revenue goal progress bar with inline edit; pipeline funnel (clickable stages); mini storm map; storm activity feed (24h/7d/30d toggle); today's tasks with checkboxes + follow-ups; activity feed timeline; storm conversion rates panel; estimates status summary; team leaderboard table; loading skeletons with shimmer; **NEW: filter by rep, source, time period (7d/30d/90d/YTD)**; mobile "ROOF COMMAND" layout | Yes | 3 silent error catches without user notification; no toast on task completion failure | **Better than JN.** Now has dashboard filters (JN Insights equivalent). Missing: custom dashboard widgets (RoofLink) |
| 2 | **Pipeline** | `/pipeline` | Kanban with 3 board tabs (Sales/Production/Billing); drag-drop stage changes; conversion rates between columns; days-in-stage badges (color-coded); task progress badges on cards; deal value per card + column totals; lead score + source badges on cards; financing status badges; priority indicators; hail size badges; due date badges; rep avatars; column collapse (localStorage); mobile board + list views; filter by priority/source/rep; active filter pills; CreateLeadModal; LeadDetail modal | Yes | 2 silent error catches on filter dropdown data load; TODO stub "generate canvassing list" (line 1083) | **Better than JN+RL.** Has score/source/financing badges. Missing: card thumbnails/photos (RoofLink shows property image on card) |
| 3 | **Leads** | `/leads` | 16-column data table; checkbox bulk select (Change Stage, Assign Rep); CSV export; CSV import (Census geocoding); saved filter presets (localStorage bookmarks); 4 filters (stage/priority/source/score); lead score badges with color gradient; URL-synced params; sortable columns; pagination (25/50/100); LeadDetail modal; ImportLeadsModal; Quick filter buttons (Hot Leads, Needs Follow-up, Unassigned) | Partial | **BUG: "Needs Follow-up" returns 500** — queries nonexistent `outreach_log` table; "Unassigned" works (200); Bulk "Assign Rep" uses raw text input for UUID (unusable UX); no error toasts on any operations | **Match JN.** Saved presets better than JN. Missing: bulk email/SMS actions, map view of leads |
| 4 | **Lead Detail** | (modal) | Contact info + editable priority/stage; lead score breakdown (7 factors with progress bars, refresh); property details (roof type/size/pitch/segments, edge measurements, year built, structure/foundation); weather event section; insurance info; custom fields (5 types, inline edit); activity timeline; tasks section; documents (upload, annotate, delete); financing applications (status tracking); contracts section; expenses + profit summary; client status page link; Google review request; solar potential (6 metrics); quick actions (Call, Email, SMS, Visit, Insurance Report); street view + satellite modal; roof drawing tool; storm history modal with PDF download; property report PDF; FEMA disaster history; billing modal; remove lead | Yes | Quick actions (Call, SMS) open native protocols only; many unguarded client.get/post calls; financing section may fail silently | **Better than JN** in data richness. Has solar analysis, storm history, FEMA data. Missing: in-app SMS threading (JN Engage), in-app email composer |
| 5 | **Storm Map** | `/storm-map` | Mapbox map with storm swath polygons; FEMA property overlay (tile-based); county property overlay; hail history overlay (Honey Hole Finder — 10-year SWDI data); layer toggle controls; time range filter (24h-30d); swath opacity slider; "Houses Only" toggle; property popups with full detail; add-to-pipeline from popup; address search with StreetView; mobile storm feed sidebar | Yes | 8+ silent error catches; "Generate Canvassing List" is TODO stub; reverse geocoding limited to 20 storms | **Better than HailTrace** on free data. Missing: meteorologist verification, hail swath color graduation by intensity |
| 6 | **Storm Catalog** | `/storm-catalog` | Storm archive cards with type/date/location/hail size/wind speed; **NEW: severity ratings (1-5 algorithm)**; **NEW: type filter (All/Hail/Wind/Tornado)**; **NEW: 5 sort options (Newest/Oldest/Most Severe/Largest Hail/Highest Wind)**; time range filter (30d/90d/1y/all); search; click-to-map navigation; reverse-geocoded locations (lazy, cached) | Yes | Limited to 200 storms; no export; no loading state UI | **Unique** — competitors don't have a browsable storm archive. Now competitive with HailTrace on sorting/filtering |
| 7 | **Estimates** | `/estimates` | KPI stat cards (4); status filter (6 statuses); estimate builder with line items + SRS catalog; template system; RichTextEditor; discount management (% or $); tax rate; multi-signer auth; auto-save (2s debounce); send-for-signing modal with email templates + merge tokens; Good/Better/Best tier generation; tier comparison view; financing plan selection; section images; duplicate estimate; print/PDF (window.print); mobile responsive | Yes | PDF is browser print dialog, not server-generated | **Better than JN** (SumoQuote). Has tier generation + comparison. Missing: professional PDF export (server-side pdfmake), inspection photo pages |
| 8 | **Public Estimate** | `/estimate/:token` | Full estimate display; e-signature canvas (mouse + touch); accept/decline flow; Stripe payment (card + ACH with fee breakdown); financing application (Hearth integration with polling); status display (accepted/declined/expired/paid) | Yes | None | **Better than JN.** Online payment + financing + e-sign all on one page |
| 9 | **Invoices** | `/invoices` | KPI stat cards (4: Total, Paid, Outstanding, Overdue); tab filters; create from accepted estimate; invoice builder with lead search + line items; preview mode; payment recording modal; send email; void invoice; overdue badge; automated overdue reminders (daily cron); **NEW: A/R aging summary with 5 buckets** (Current/1-30/31-60/61-90/91+ days, color-coded) | Yes | None critical | **Match JN.** Now has A/R aging (was missing). Missing: QuickBooks sync, Text-to-Pay |
| 10 | **Contracts** | `/contracts` | KPI stat cards (4); status filter (6); contract builder with template system; lead search + auto-populate; merge field support (6 tokens); section editor; preview mode; send contract; void contract; create from estimate or lead | Yes | No image support in contract body; 3 silent catches | **Match JN.** Missing: contract change order management |
| 11 | **Work Orders** | `/work-orders` | 4-column kanban (Pending/Scheduled/In Progress/Completed); drag-drop status changes; create from estimate; detail modal with milestones; **milestone templates for 8 job types**; **NEW: photo-required milestone stops** (camera badge, blocks completion without photo); editable line items with running total; crew assignment; scheduled date/time; TimePicker (6 instances) | Yes | None critical | **Better than JN+RL.** Now has photo-required milestones (RoofLink gap closed). Full milestone + template system |
| 12 | **Tasks** | `/tasks` | Filter tabs (Pending/Completed); create task modal (title, description, due_date, priority); toggle completion; edit task modal; overdue + due-today summary bar; mobile layout with "Mission Log" theme, efficiency metrics | Yes | **No toast notifications** on any CRUD operation — silent failures; assignee field not exposed in create/edit form | **Match JN** basic. Missing: task delegation/assignment UI, recurring tasks |
| 13 | **Calendar** | `/calendar` | FullCalendar with Month/Week/Day/List views; shows tasks + calls + emails + door knocks; color-coded by type; drag tasks to reschedule; now indicator; event click navigates to lead; max 4 events/day | Yes | Only tasks are draggable; no create-event-from-calendar; errors go to console.error only, no user feedback | **Match JN** basic. Missing: appointment scheduling, drag-to-create time slots, Google Calendar sync |
| 14 | **Reports** | `/reports` | 6 report cards: Revenue (area), Pipeline (bar + drill-down), Conversion by Source (radar), Rep Leaderboard (sortable table), Lead Sources (donut + drill-down), Stage Duration (line); period presets; custom date range; comparison periods with delta badges + trend arrows; CSV export per report | Yes | 3 silent catches — charts show empty on failure; no error toasts; no loading states for all charts | **Better than JN.** Has chart drill-down + comparison periods. Missing: custom report builder |
| 15 | **Canvassing** | `/canvassing` | Full-screen dark map; GPS-located pin dropping; 6 outcome types; notes per pin; stats bar; convert pin-to-lead; territory manager panel (polygon drawing); bottom sheet for pin details | Yes | No bulk pin operations; no breakdown by canvasser/time period; "generate canvassing list" stub | **Match HailTrace.** Missing: GPS verification (HailTrace requires within 50ft), canvasser leaderboard, route planning |
| 16 | **Content Studio** | `/content-studio` | Generate tab: 5 content types x 4 tones; 10 variables; batch mode (5 variations); live preview panel; Library tab: save/search/filter/copy/delete; localStorage persistence; **NOW IN SIDEBAR** (was hidden) | Yes | Template-based generation (not AI-powered) | **Partial match Rooftops.ai.** Missing: LLM-powered generation, social media scheduling, SEO optimization |
| 17 | **Expenses** | `/expenses` | KPI summary (3 cards); filter by category (6 types) + date range; expense table with job linking; add/edit/delete modal with lead search; category badges (color-coded) | Yes | No pagination UI (50-item limit); no receipt attachment/upload; no CSV export | Unique. Missing: receipt photos, mileage tracking, expense reports |
| 18 | **Materials** | `/materials` | Catalog tab with 14 category tabs + search; product cards (image, SKU, name, manufacturer, price, stock); product detail modal with image carousel; cart sidebar with branch selection; order submission; Orders tab with history; SRS Catalog integration | Yes | No real-time inventory sync; tax calculation simplified | **Unique.** No competitor has in-app material ordering at this price point |
| 19 | **Subcontractors** | `/subcontractors` | Full CRUD; filter by search/specialty (12 types)/status; table with color-coded specialty badges; slide-over add/edit form; phone auto-formatting; pagination (10/25/50); inline delete confirmation | Yes | None | **Better than JN.** Missing: subcontractor ratings/reviews, insurance/cert tracking, availability calendar |
| 20 | **Settings** | `/settings` | 15 tabs: Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications (10 categories x 2 channels), Email/SMTP, Financing (Hearth), Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews | Yes | Profile tab is read-only (no edit form); 13 silent catches (mostly non-critical); Payments tab unclear | **Better than JN** on free tier. Missing: branding/white-label (logo upload), role-based permissions UI |
| 21 | **Admin** | `/admin` | 4 tabs: Overview, Tenants, Revenue, Usage. Requires `super_admin` role | N/A | Not testable (admin role, not super_admin); no toast notifications; 3 silent catches | Internal tool |
| 22 | **Alerts** | `/alerts` | Storm alert configuration: hail/wind thresholds, radius, enabled/disabled; email recipients; mode selector; alert history; test alert sending | Yes | Only accessible via direct URL or Settings | Functional |

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

| Category | Route Files | Key Endpoints | Notes |
|----------|------------|-----------|-------|
| CRM Core | crm.js, leads.js | Leads CRUD, pipeline stages, team members | `needs_followup` filter broken (500) |
| Estimates | estimates.js | Builder, templates, public view, sending, tiers | 15 endpoints |
| Invoices | invoices.js | CRUD, payments, sending, email | 8 endpoints |
| Contracts | contracts.js | Templates, CRUD, public signing | 12 endpoints |
| Work Orders | workOrders.js | CRUD, milestones, photos, templates | 13 endpoints |
| Map/Storm | map.js, storms.js, properties.js | FEMA, county, storm swaths | 8 endpoints |
| Financing | financing.js, hearthWebhook.js | Hearth adapter, plans, applications | 14 endpoints |
| Canvassing | canvassing.js, territories.js | Pins, territories, polygon CRUD | 11 endpoints |
| Dashboard | dashboard.js | Stats, funnel, activity | 3 endpoints, new filter support |
| Reports | reports.js | Revenue, pipeline, conversion, leaderboard, stage duration, sources | 6 endpoints |
| Auth | auth.js | Login, register, refresh (rate-limited) | 4 endpoints |
| Payments | payments.js | Stripe intents, Connect onboarding | 7 endpoints |
| Documents | documents.js | Upload, list, delete | 3 endpoints |
| Notifications | notifications.js | CRUD, preferences, mark-read | 6 endpoints |
| Search | search.js | Global search (Cmd-K) | 1 endpoint |
| Skip Trace | skipTrace.js | Contact info lookup (paid) | 10 endpoints |
| Roof Measurement | roofMeasurement.js | Satellite measurements (paid) | 8 endpoints |
| Data APIs | dataApis.js, stormHistory.js, disasterDeclarations.js | Census ACS, NOAA SWDI, FEMA, route optimizer | 6 endpoints |
| Content | content.js | Content generation, templates | 3 endpoints |
| Drip | drip.js | Sequences, steps, enrollment | 8 endpoints |
| Automations | automations.js | Workflow triggers | 5 endpoints |
| Materials | materials.js | SRS catalog, orders, 14 categories | 9 endpoints |
| Subcontractors | subcontractors.js | Full CRUD + work order assignment | 8 endpoints |
| Admin | admin.js | Tenant management, revenue | 6 endpoints (super_admin only) |
| Other | alerts, counties, drift, expenses, onboarding, webhook | Storm alerts, wind drift, onboarding, etc. | 30+ endpoints |
| **TOTAL** | **37 files** | **180+ unique endpoints** | |

### Background Jobs / Cron

| Job | Schedule | Description |
|-----|----------|-------------|
| MRMS MESH ingestion | Every 30 min | Ingest hail data from MRMS |
| NWS Active Alerts | Every 1 hour | Ingest NWS alerts |
| SPC Hail Reports | Every 2 hours | Ingest SPC reports with wind drift correction |
| Auto-Import Parcels/FEMA | 3x daily (6am/2pm/10pm) | Import county parcels + FEMA NSI for active storms |
| Daily Data Cleanup | 3am daily | Delete storms > 30 days, orphaned properties |
| Monthly Billing | 1st of month midnight | Process skip trace batch billing |
| Drip Sequence Processor | Every 15 min | Progress enrolled leads through drip steps |
| Overdue Invoice Reminders | 9am daily | Send email for overdue invoices |

---

## Live API Test Results (2026-03-31)

| Endpoint | Status | Data |
|----------|--------|------|
| `POST /api/auth/login` | OK | Returns JWT + user object |
| `GET /api/dashboard/stats` | OK | Pipeline: $5K, 9 leads, 0% close rate |
| `GET /api/dashboard/stats?period=30d` | OK | Filter works — returns filtered stats |
| `GET /api/dashboard/stats?rep_id=...` | OK | Filter works — returns rep-specific stats |
| `GET /api/dashboard/funnel` | OK | 4 stages (new:6, contacted:1, appt_set:1, inspected:1) |
| `GET /api/dashboard/activity` | OK | Empty (no recent activity) |
| `GET /api/leads?page=1` | OK | 9 total leads |
| `GET /api/leads?priority=hot` | OK | Filtered leads |
| `GET /api/leads?needs_followup=true` | **500** | **BUG: queries nonexistent `outreach_log` table** |
| `GET /api/leads?unassigned=true` | OK | Returns unassigned leads |
| `GET /api/leads/:id` | OK | Full lead detail (40+ fields) |
| `GET /api/estimates` | OK | 0 estimates |
| `GET /api/estimates/templates` | OK | Templates available |
| `GET /api/crm/invoices` | OK | 4 invoices |
| `GET /api/crm/contracts` | OK | 1 contract |
| `GET /api/crm/work-orders` | OK | 1 work order |
| `GET /api/crm/work-orders/milestone-templates` | OK | 8 job type templates with photo_required flags |
| `GET /api/crm/tasks` | OK | 0 tasks |
| `GET /api/crm/expenses` | OK | 0 expenses |
| `GET /api/crm/subcontractors` | OK | 0 subcontractors |
| `GET /api/crm/territories` | OK | 0 territories |
| `GET /api/crm/canvass-pins` | OK | 8 canvass pins |
| `GET /api/crm/reports/revenue` | OK | Revenue data present |
| `GET /api/crm/reports/pipeline` | OK | Pipeline breakdown |
| `GET /api/crm/reports/conversion` | OK | Source conversion rates |
| `GET /api/crm/reports/rep-performance` | OK | Rep metrics |
| `GET /api/crm/reports/stage-duration` | OK | Stage timing data |
| `GET /api/crm/reports/lead-sources` | OK | Source distribution |
| `GET /api/storms?hours=168` | OK | 50 storm features (GeoJSON) |
| `GET /api/search?q=test` | OK | Global search returns results |
| `GET /api/notifications` | OK | 0 notifications |
| `GET /api/notifications/preferences` | OK | Preference config |
| `GET /api/crm/team` | OK | 2 team members |
| `GET /api/crm/financing/plans` | OK | 0 plans (no Hearth connected) |
| `GET /api/crm/financing/lenders` | OK | Lender list |
| `GET /api/crm/automations` | OK | 0 automations |
| `GET /api/crm/drip-sequences` | OK | 0 sequences |
| `GET /api/crm/content/templates` | OK | 5 types x 4 tones, 100+ templates |
| `GET /api/alerts/config` | OK | Alert configuration |
| `GET /api/skip-trace/config` | OK | Skip trace settings |
| `GET /api/roof-measurement/config` | OK | Roof measurement settings |
| `GET /api/counties` | OK | County data sources |
| `GET /api/disaster-declarations?state=IA&county=Black+Hawk` | OK | FEMA declarations (COVID, etc.) |
| `GET /api/storm-history?lat=42.49&lng=-92.34` | OK | Returns history (0 events at this coord) |

**Result: 43/44 endpoints OK, 1 broken (needs_followup 500 error)**

---

## Competitor Feature Matrix Cross-Reference (Updated 2026-03-31)

### Features built since 2026-03-30 inventory

| Feature | Previous Status | Current Status | When Built |
|---------|---------------|----------------|------------|
| Dashboard filter controls (rep, source, time period) | Missing vs JN Insights | **DONE** | 2026-03-30 |
| A/R aging summary with 5 buckets | Missing vs JN (Top 10 #7) | **DONE** | 2026-03-30 |
| Photo-required milestone stops | Missing vs RoofLink | **DONE** | 2026-03-30 |
| Storm catalog severity ratings + type filters + sorting | Missing vs HailTrace | **DONE** | 2026-03-30 |
| Content Studio sidebar link | Not discoverable (Top 10 #9) | **DONE** | 2026-03-30 |
| Dashboard CustomSelect fix | Native selects on dashboard | **DONE** | 2026-03-30 |

### Features built across all overnight runs (2026-03-27 to 2026-03-31)

| Feature | Commit | Gap Closed |
|---------|--------|------------|
| Pipeline board tabs + days-in-stage badges | bc9f2cf | vs JN |
| Content library (save/search/reuse) | 54cc2d6 | vs Rooftops.ai |
| Dashboard loading skeletons | 87b9e38 | UX quality |
| Reports comparison periods + trend arrows | d6b3fb7 | vs JN |
| Pipeline task progress on cards | b50c570 | vs RoofLink |
| Editable work order line items | 528f7eb | vs RoofLink |
| Dashboard revenue goal progress bar | eb05317 | vs JN |
| Saved filter presets for leads | d740774 | vs JN |
| Invoice send email | 3547b9d | vs JN |
| CustomSelect portal rendering | 3cb3f11 | UX quality |
| Work order milestone templates (8 types) | 875539b | vs RoofLink |
| Content Studio live preview | 2cbf79c | vs Rooftops.ai |
| Chart drill-down in Reports | 868aad9 | vs JN |
| Pipeline lead score + source badges | cb33b39 | vs JN |
| Estimate tier comparison view | e94dcaf | vs RoofLink |
| Dashboard filter controls | 44cd3d1 | vs JN Insights |
| A/R aging summary | 8c29c9d | vs JN |
| Photo-required milestones | 631393c | vs RoofLink |
| Storm catalog severity/sorting | fceacf4 | vs HailTrace |

---

## Updated Feature Matrix (2026-03-31)

| Feature | JobNimbus | HailTrace | RoofLink | StormLeads | Status |
|---------|-----------|-----------|----------|-----------|--------|
| **CRM & Pipeline** | | | | | |
| Kanban pipeline | Yes | Limited | Yes | Yes (3 boards) | **Better** |
| Contact management | Yes | No | Yes | Yes | Match |
| Lead scoring | No | No | No | Yes (7-factor) | **Better** |
| Custom fields | Yes ($550) | Yes | Yes | Yes (free) | **Better** |
| Global search | Yes | No | No | Yes (Cmd-K) | Match |
| Saved filter presets | Yes | No | No | Yes | **Better** |
| Pipeline card badges | Yes | No | Yes | Yes (score+source+financing) | **Better** |
| Dashboard filters | Yes (Insights) | No | Yes | Yes (rep/source/period) | **Match** |
| **Sales & Estimating** | | | | | |
| Estimate builder | Yes | No | Yes | Yes + tiers + comparison | **Better** |
| E-signature | Yes | No | Yes | Yes (canvas) | Match |
| Financing on estimate | Yes ($) | No | No | Yes (Hearth, free) | **Better** |
| SRS material catalog | No | No | Yes | Yes | Match |
| **Invoicing & Payments** | | | | | |
| Invoicing | Yes | No | Yes | Yes | Match |
| Online payments (Stripe) | Yes ($) | No | Yes | Yes (free) | **Better** |
| A/R aging buckets | Yes | No | No | Yes (5 buckets) | **Match** |
| QuickBooks sync | Yes | No | Yes | No | **Missing** |
| Text-to-Pay | Yes | No | No | No | **Missing** |
| **Storm Data** | | | | | |
| Live hail/wind/tornado maps | No | Yes (core) | Yes | Yes (NOAA, free) | **Better** |
| Real-time storm alerts | No | Yes ($) | Yes | Yes (free) | **Better** |
| Honey Hole Finder | No | Yes | No | Yes (SWDI, free) | **Match** |
| Historical data depth | No | 10+ years | No | 10 years (SWDI) | **Match** |
| Storm catalog with severity | No | Yes | No | Yes (1-5 rating + filters) | **Match** |
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
| Photo-required stops | No | No | Yes | Yes (blocks completion) | **Match** |
| **Communication** | | | | | |
| SMS texting | Yes ($49-249/mo) | No | No | No | **Missing** |
| In-app email | Yes | No | No | No (mailto:) | **Worse** |
| AI phone receptionist | Yes ($298/mo) | No | No | No | **Missing** |
| **AI Features** | | | | | |
| AI content generation | No | No | No | Yes (template, not LLM) | Partial |
| AI roof measurements | No | No | Yes ($) | No | **Missing** |
| **Reports** | | | | | |
| Revenue/Pipeline charts | Yes | No | Yes | Yes | Match |
| Comparison periods | No | No | No | Yes | **Better** |
| Chart drill-down | Yes | No | Yes | Yes | **Match** |
| Dashboard filters | Yes | No | Yes | Yes (rep/source/period) | **Match** |
| CSV export | Yes | No | Yes | Yes | Match |
| **Other** | | | | | |
| Photo annotation | Yes ($19/user) | No | Yes ($) | Yes (free) | **Better** |
| Subcontractor mgmt | Yes | No | No | Yes | Match |
| Drip sequences | Yes | No | No | Yes (free) | **Better** |
| Mobile app | Yes (native) | Yes | Yes | No (PWA only) | **Worse** |

---

## Navigation & Discovery

| Page | In Sidebar? | How to Access | Impact |
|------|-------------|---------------|--------|
| Content Studio | **Yes** (fixed 2026-03-30) | Sidebar under Operations | None — resolved |
| Alerts | **No** | Direct URL `/alerts` or Settings > Storm Alerts | Low — Settings covers it |
| Admin | Conditional | Only visible for `super_admin` role | By design |
| Drip Sequences | **No** | Settings > Drip Sequences tab | Low — Settings covers it |

---

## Error Handling Audit

| Page | Toast Notifications | Silent Catches | Grade |
|------|-------------------|----------------|-------|
| Dashboard | 0 | 3 | D |
| Pipeline | 3 | 2 | C |
| LeadList | 0 | 1 | D |
| LeadDetail | 0 | ~5 | D |
| StormMap | 0 | 8+ | F |
| StormCatalog | 0 | 2 | D |
| Estimates | 13 | 5 | B+ |
| Invoices | 13 | 1 | A |
| WorkOrders | 23 | 3 | A |
| Contracts | 8 | 3 | B |
| Materials | 6 | 1 | B |
| Tasks | 0 | 0 | F (no error handling at all) |
| Calendar | 0 | 2 | D |
| Reports | 0 | 3 | F |
| Canvassing | 9 | 2 | B |
| ContentStudio | 6 | 1 | B |
| Expenses | 5 | 1 | B |
| Subcontractors | 7 | 0 | A |
| Settings | 34 | 13 | B+ |
| AdminDashboard | 0 | 3 | F |

**9 pages have zero toast notifications** — users see nothing when operations fail.

---

## Known Bugs

| Bug | Severity | Location | Root Cause |
|-----|----------|----------|------------|
| "Needs Follow-up" quick filter returns 500 | High | `GET /api/leads?needs_followup=true` | Queries `outreach_log` table which doesn't exist — no migration |
| "Generate Canvassing List" button non-functional | Medium | StormMap.jsx ~line 853, Pipeline.jsx ~line 1083 | TODO stub — onClick does nothing |
| Bulk Assign Rep uses raw UUID text input | Medium | LeadList bulk actions | Should be team member dropdown |
| Profile tab is read-only | Low | Settings > Profile | No edit form — display only |

---

## Top 10 Improvement Opportunities (2026-03-31)

Ranked by competitive impact and feasibility. Items closed from previous lists are noted.

### 1. **QuickBooks Sync** (Missing vs JN + RoofLink) — STILL #1
Every roofing company uses QuickBooks. JN and RoofLink both sync invoices. This is the #1 integration gap preventing adoption by established contractors. QuickBooks has a free developer tier. Priority: one-way invoice push first.

### 2. **Server-Side PDF Export for Estimates** (Worse vs JN/SumoQuote) — STILL #2
Current "PDF" is browser print dialog. JN/SumoQuote generate professional, branded multi-page PDFs with cover pages, inspection photos, line items, signing, and terms. Need server-side pdfmake or Puppeteer generation. This is the most visible quality gap when competing for clients.

### 3. **In-App SMS Texting** (Missing vs JN $49-249/mo) — STILL #3
JN charges $49-249/mo for Engage texting. Twilio costs ~$0.0075/msg. Build in-app SMS thread UI with send/receive. Single most requested feature by field sales teams.

### 4. **Fix "Needs Follow-up" Quick Filter** (BUG — 500 error)
The `outreach_log` table was never created. Either create the migration and populate it from activity data, or rewrite the filter to use the existing `activities` table. This is a visible, user-facing bug.

### 5. **Hail Swath Color Graduation by Intensity** (Missing vs HailTrace)
Storm swaths render as uniform color. HailTrace color-codes by hail size (green < 1", yellow 1-1.5", orange 1.5-2", red > 2"). Visual credibility signal for sales demos.

### 6. **Appointment Scheduling on Calendar** (Worse vs JN)
Calendar displays events but can't create appointments. Need click-to-create time slots, drag-to-schedule. Currently only tasks are draggable. Field teams need this daily.

### 7. **Error Toast Notifications on 9 Pages** (Quality gap)
Dashboard, LeadList, LeadDetail, StormMap, StormCatalog, Tasks, Calendar, Reports, AdminDashboard all have zero error feedback to users. Operations fail silently. This is a UX trust issue.

### 8. **Profile Settings Edit Mode** (Missing basic functionality)
Settings > Profile is read-only. Users can't update their name, email, or password. Need edit form with save.

### 9. **Bulk Assign Rep Dropdown** (UX bug)
Bulk "Assign Rep" on LeadList requires typing a UUID. Needs team member dropdown. Makes bulk assign unusable.

### 10. **Content Studio LLM Integration** (Partial vs Rooftops.ai)
Content Studio generates from templates, not AI. Integrating a free/cheap LLM (Claude Haiku, Llama via Groq) would transform this from a template engine into a competitive AI content tool.

---

## Honorable Mentions (Lower Priority)

- **Recurring tasks** — daily/weekly/monthly task recurrence (JN has this)
- **Task assignee in create/edit form** — field exists in DB but not in UI
- **Google Calendar two-way sync** — complex OAuth flow
- **Custom dashboard widgets** — RoofLink has this but large effort
- **Canvasser leaderboard + route planning** — nice-to-have for field teams
- **Subcontractor insurance/cert tracking** — important for compliance
- **Native mobile app** — PWA works but native improves store presence
- **Branding/white-label** — logo upload for estimates/invoices/contracts
- **Receipt upload on expenses** — reuse document upload infra
- **Canvassing list generation** — wire the TODO stub on StormMap
- **Lead map view** — show leads on a map (HailTrace has this)
- **In-app email composer** — replace mailto: with in-app sending
- **Contract change orders** — JN has this for scope changes

---

## Summary Statistics

| Metric | 2026-03-30 | 2026-03-31 | Delta |
|--------|-----------|-----------|-------|
| Protected routes | 20 | 22 | +2 (Storm Catalog, Alerts now counted) |
| Public routes | 6 | 6 | — |
| Backend route files | 37 | 37 | — |
| Total API endpoints | 264 | 180+ unique | Reconciled count method |
| Background cron jobs | 5 | 8 | +3 (MRMS, NWS, auto-import counted) |
| Settings tabs | 15 | 15 | — |
| Features "Better" than competitors | 14 | 16 | +2 |
| Features matching competitors | 15 | 19 | +4 |
| Features "Missing" vs competitors | 7 | 5 | -2 (aging + milestones closed) |
| Features "Worse" than competitors | 3 | 3 | — |
| Features "Unique" to StormLeads | 2 | 2 | — |
| Known bugs | 3 | 4 | +1 (needs_followup discovered) |
| Pages with zero error toasts | — | 9 | New metric |

---

*Generated 2026-03-31 via full source code analysis of 22 protected routes, 6 public routes, 37 backend route files (180+ endpoints), live API endpoint testing (44 requests, 43 OK / 1 bug), and cross-reference with competitor gap analysis matrix.*
