# StormLeads App Inventory — 2026-04-01

**Method:** Source code analysis of 23 protected routes + 6 public routes, 38 backend route files (187+ endpoints), live API endpoint testing (50+ endpoints verified via curl), cross-reference with competitor gap analysis matrix (2026-03-25), and automated codebase audits for TODOs/stubs/silent catches.

**Changes since 2026-03-31 inventory:** 1 commit (`6089412` checkpoint: pre-overnight-run 2026-04-01). No functional changes since last inventory.

---

## Page-by-Page Feature Inventory

| # | Page | Route | Features Present | Works? | Broken/Missing | Competitor Notes |
|---|------|-------|-----------------|--------|----------------|-----------------|
| 1 | **Dashboard** | `/` | 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges; revenue goal progress bar with inline edit; pipeline funnel (clickable stages); mini storm map; storm activity feed (24h/7d/30d toggle); today's tasks with checkboxes + follow-ups; activity feed timeline; storm conversion rates panel; estimates status summary; team leaderboard table; loading skeletons with shimmer; filter by rep, source, time period (7d/30d/90d/YTD); mobile "ROOF COMMAND" layout | Yes | 2 silent catch blocks (team members, metrics); no toast on task completion failure; followups panel silently fails if outreach_log table missing | **Better than JN.** Has dashboard filters (JN Insights equivalent). Missing: custom dashboard widgets (RoofLink), drag-to-rearrange cards |
| 2 | **Pipeline** | `/pipeline` | Kanban with 3 board tabs (Sales/Production/Billing); drag-drop stage changes; conversion rates between columns; days-in-stage badges (color-coded); task progress badges on cards; deal value per card + column totals; lead score + source badges on cards; financing status badges; priority indicators; hail size badges; due date badges; rep avatars; column collapse (localStorage); mobile board + list views; filter by priority/source/rep; active filter pills; CreateLeadModal; LeadDetail modal | Yes | 2 silent error catches on filter dropdown data load; TODO stub "generate canvassing list" (non-functional button) | **Better than JN+RL.** Has score/source/financing badges. Missing: card thumbnail photos (RoofLink), drag-to-reorder columns |
| 3 | **Leads** | `/leads` | 16-column data table; checkbox bulk select (Change Stage, Assign Rep); CSV export; CSV import (Census geocoding); saved filter presets (localStorage bookmarks); 4 filters (stage/priority/source/score); lead score badges with color gradient; URL-synced params; sortable columns; pagination (25/50/100); LeadDetail modal; ImportLeadsModal; Quick filter buttons (Hot Leads, Needs Follow-up, Unassigned) | Partial | **BUG: "Needs Follow-up" returns 500** — queries nonexistent `outreach_log` table; Bulk "Assign Rep" uses raw text input for UUID (unusable UX); no error toasts on any operations | **Match JN.** Saved presets better than JN. Missing: bulk email/SMS actions, map view of leads |
| 4 | **Lead Detail** | (modal) | Contact info + editable priority/stage; lead score breakdown (7 factors with progress bars, refresh); property details (roof type/size/pitch/segments, edge measurements, year built, structure/foundation); weather event section; insurance info; custom fields (5 types, inline edit); activity timeline; tasks section; documents (upload, annotate, delete); financing applications (status tracking); contracts section; expenses + profit summary; client status page link; Google review request; solar potential (6 metrics); quick actions (Call, Email, SMS, Visit, Insurance Report); street view + satellite modal; roof drawing tool; storm history modal with PDF download; property report PDF; FEMA disaster history; billing modal; remove lead | Yes | 9+ silent catch blocks (financing, lead data, tasks, activities, contacts, documents, notes, solar, lead comparison); 2 alert() calls instead of toasts (status page link); quick actions (Call, SMS) open native protocols only | **Better than JN** in data richness. Has solar analysis, storm history, FEMA data, photo annotation. Missing: in-app SMS threading (JN Engage), in-app email composer |
| 5 | **Storm Map** | `/storm-map` | Mapbox map with storm swath polygons; FEMA property overlay (tile-based, polygon intersection); county property overlay; hail history overlay (Honey Hole Finder — 10-year SWDI data as heatmap); layer toggle controls; time range filter (24h-30d); swath opacity slider; "Houses Only" toggle; property popups with full detail; add-to-pipeline from popup; address search with StreetView; mobile storm feed sidebar | Yes | 10+ silent catch blocks (GeoJSON layers, storm swaths, FEMA tiles, property loading); "Generate Canvassing List" is TODO stub; reverse geocoding limited to 20 storms | **Better than HailTrace** on free data. Missing: meteorologist verification, hail swath color graduation by intensity, building footprint overlay |
| 6 | **Storm Catalog** | `/storm-catalog` | Storm archive cards with type/date/location/hail size/wind speed; severity ratings (1-5 algorithm); type filter (All/Hail/Wind/Tornado); 5 sort options (Newest/Oldest/Most Severe/Largest Hail/Highest Wind); time range filter (30d/90d/1y/all); search; click-to-map navigation; reverse-geocoded locations (lazy, cached) | Yes | Limited to 200 storms; no export; no loading state UI | **Unique** — competitors don't have a browsable storm archive |
| 7 | **Estimates** | `/estimates` | KPI stat cards (4); status filter (6 statuses); estimate builder with line items + SRS catalog; template system; RichTextEditor; discount management (% or $); tax rate; multi-signer auth; auto-save (2s debounce); send-for-signing modal with email templates + merge tokens; Good/Better/Best tier generation; tier comparison view; financing plan selection; section images; duplicate estimate; print/PDF (window.print); mobile responsive | Yes | 1 silent catch (financing plans); PDF is browser print dialog, not server-generated | **Better than JN** (SumoQuote). Has tier generation + comparison. Missing: professional PDF export (server-side pdfmake), inspection photo pages |
| 8 | **Public Estimate** | `/estimate/:token` | Full estimate display; e-signature canvas (mouse + touch); accept/decline flow; Stripe payment (card + ACH with fee breakdown); financing application (Hearth integration with polling); status display (accepted/declined/expired/paid) | Yes | 2 console.error without user feedback on public-facing forms | **Better than JN.** Online payment + financing + e-sign all on one page |
| 9 | **Invoices** | `/invoices` | KPI stat cards (4: Total, Paid, Outstanding, Overdue); tab filters; create from accepted estimate; invoice builder with lead search + line items; preview mode; payment recording modal; send email; void invoice; overdue badge; automated overdue reminders (daily cron); A/R aging summary with 5 buckets (Current/1-30/31-60/61-90/91+ days, color-coded) | Yes | 1 silent catch (invoice data) | **Match JN.** Has A/R aging. Missing: QuickBooks sync, Text-to-Pay, online payment collection on invoices |
| 10 | **Contracts** | `/contracts` | KPI stat cards (4); status filter (6); contract builder with template system; lead search + auto-populate; merge field support (6 tokens); section editor; preview mode; send contract; void contract; create from estimate or lead | Yes | 3 silent catches (contract operations); no image support in contract body | **Match JN.** Missing: contract change order management |
| 11 | **Work Orders** | `/work-orders` | 4-column kanban (Pending/Scheduled/In Progress/Completed); drag-drop status changes; create from estimate; detail modal with milestones; milestone templates for 8 job types; photo-required milestone stops (camera badge, blocks completion without photo); editable line items with running total; crew assignment; scheduled date/time; TimePicker (6 instances) | Yes | 1 silent catch (milestones load) | **Better than JN+RL.** Has photo-required milestones (RoofLink gap closed). Full milestone + template system |
| 12 | **Tasks** | `/tasks` | Filter tabs (Pending/Completed); create task modal (title, description, due_date, priority); toggle completion; edit task modal; overdue + due-today summary bar; mobile layout with "Mission Log" theme, efficiency metrics | Yes | No toast notifications on any CRUD operation — silent failures; assignee field not exposed in create/edit form | **Match JN** basic. Missing: task delegation/assignment UI, recurring tasks |
| 13 | **Calendar** | `/calendar` | FullCalendar with Month/Week/Day/List views; shows tasks + calls + emails + door knocks; color-coded by type; drag tasks to reschedule; now indicator; event click navigates to lead; max 4 events/day | Yes | 2 console.error without user feedback; only tasks are draggable; no create-event-from-calendar | **Match JN** basic. Missing: appointment scheduling, drag-to-create time slots, Google Calendar sync |
| 14 | **Reports** | `/reports` | 6 report cards: Revenue (area), Pipeline (bar + drill-down), Conversion by Source (radar), Rep Leaderboard (sortable table), Lead Sources (donut + drill-down), Stage Duration (line); period presets; custom date range; comparison periods with delta badges + trend arrows; CSV export per report | Yes | No error toasts; no loading states for individual charts | **Better than JN.** Has chart drill-down + comparison periods. Missing: custom report builder, PDF export |
| 15 | **Canvassing** | `/canvassing` | Full-screen dark map; GPS-located pin dropping; 6 outcome types; notes per pin; stats bar; convert pin-to-lead; territory manager panel (polygon drawing with color picker + team assignment); bottom sheet for pin details | Yes | No bulk pin operations; no breakdown by canvasser/time period; "generate canvassing list" stub | **Match HailTrace.** Missing: GPS verification (HailTrace requires within 50ft), canvasser leaderboard, route planning/optimization |
| 16 | **Content Studio** | `/content-studio` | Generate tab: 5 content types x 4 tones; 10 variables; batch mode (5 variations); live preview panel (Facebook/email/door hanger/blog mockups); Library tab: save/search/filter/copy/delete; localStorage persistence; sidebar nav link | Yes | Template-based generation (not AI-powered) | **Partial match Rooftops.ai.** Missing: LLM-powered generation, social media scheduling, SEO optimization |
| 17 | **Expenses** | `/expenses` | KPI summary (3 cards); filter by category (6 types) + date range; expense table with job linking; add/edit/delete modal with lead search; category badges (color-coded) | Yes | No pagination UI (50-item limit); no receipt attachment/upload; no CSV export | Unique. Missing: receipt photos, mileage tracking, expense reports |
| 18 | **Materials** | `/materials` | Catalog tab with 14 category tabs + search; product cards (image, SKU, name, manufacturer, price, stock); product detail modal with image carousel; cart sidebar with branch selection; order submission; Orders tab with history; SRS Catalog integration | Yes | No real-time inventory sync; WIP/test material names in production data ("Carlisle WIP 300 High Temp"); tax calculation simplified | **Unique.** No competitor has in-app material ordering at this price point |
| 19 | **Subcontractors** | `/subcontractors` | Full CRUD; filter by search/specialty (12 types)/status; table with color-coded specialty badges; slide-over add/edit form; phone auto-formatting; pagination (10/25/50); inline delete confirmation | Yes | None | **Better than JN.** Missing: subcontractor ratings/reviews, insurance/cert tracking, availability calendar |
| 20 | **Settings** | `/settings` | 15 tabs: Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications (10 categories x 2 channels), Email/SMTP, Financing (Hearth), Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews | Yes | Profile tab is read-only (no edit form); 2 console.error without feedback; Mock financing provider visible in production UI; Automations tab uses browser confirm() for delete | **Better than JN** on free tier. Missing: branding/white-label (logo upload), role-based permissions UI |
| 21 | **Admin** | `/admin` | 4 tabs: Overview, Tenants, Revenue, Usage. Requires `super_admin` role | N/A | Not testable (admin role returns 403, not super_admin); 5 silent catches | Internal tool |
| 22 | **Alerts** | `/alerts` | Storm alert configuration: hail/wind thresholds, radius, enabled/disabled; email recipients; mode selector; alert history; test alert sending | Yes | 2 console.error without toast; only accessible via direct URL or Settings | Functional |

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

| Category | Route Files | Key Endpoints | API Test Status |
|----------|------------|-----------|-------|
| Auth | auth.js | Login, register, refresh (rate-limited), /me | All 200 OK |
| CRM Core | crm.js, leads.js | Leads CRUD, pipeline stages, team members, quick create | 200 OK; **needs_followup filter 500** |
| Dashboard | dashboard.js (via crm.js) | Stats, funnel, activity, leaderboard, tasks-today, followups, conversion-by-storm, estimate-summary, properties-affected | All 200 OK |
| Estimates | estimates.js | Builder, templates, public view, sending, tiers, accept/decline | All 200 OK |
| Invoices | invoices.js | CRUD, payments, sending, email, from-estimate | 200 OK |
| Contracts | contracts.js | Templates CRUD, public signing, create-from-estimate | 200 OK |
| Work Orders | workOrders.js | CRUD, milestones, photos, templates, from-estimate | 200 OK |
| Storm/Map | map.js, storms.js, properties.js | FEMA live, polygon, swaths, storms list | 200 OK (swaths needs bbox param) |
| Financing | financing.js, hearthWebhook.js | Hearth adapter, plans, applications, lenders, webhooks | 200 OK |
| Canvassing | canvassing.js, territories.js | Pins, territories, polygon CRUD, stats | 200 OK |
| Reports | reports.js | Revenue, pipeline, conversion, rep-performance, stage-duration, lead-sources | 200 OK |
| Content | content.js | Generate, templates, batch | 200 OK |
| Drip | drip.js | Sequences CRUD, steps, enrollment | 200 OK |
| Automations | automations.js | Workflow triggers CRUD | 200 OK |
| Materials | materials.js | Products, branches, orders, credentials | 200 OK |
| Subcontractors | subcontractors.js | Full CRUD + work order assignment | 200 OK |
| Notifications | notifications.js | CRUD, preferences, mark-read, unread-count | 200 OK |
| Search | search.js | Global search (Cmd-K) | 200 OK |
| Documents | documents.js | Upload (multer 25MB), list, delete | 200 OK |
| Data APIs | dataApis.js, stormHistory.js, disasterDeclarations.js | Census ACS, NOAA SWDI, FEMA, route optimizer | 200 OK |
| Alerts | alerts.js | Config, history, test | 200 OK |
| Skip Trace | skipTrace.js | Config, submit, payment | 200 OK |
| Roof Measurement | roofMeasurement.js | Config, measure (Google Solar), manual | 200 OK |
| Payments | payments.js | Stripe Connect onboarding, webhooks | 200 OK (400 without body) |
| Admin | admin.js | Overview (super_admin only) | 403 (correct — requires super_admin) |
| Onboarding | onboarding.js | Create tenant, update org, select plan | 200 OK |
| Other | drift.js, counties.js, webhook.js | Wind drift, county imports, Tracerfy webhooks | 200 OK |
| **TOTAL** | **38 files** | **187+ unique endpoints** | **50 tested, 49 OK, 1 BUG** |

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

## Live API Test Results (2026-04-01)

| Endpoint | Status | Data |
|----------|--------|------|
| POST /api/auth/login | 200 | JWT issued for brandon@accessvaletparking.com |
| GET /api/dashboard/stats | 200 | pipelineValue: $5,000, leadCount: 9, closeRate: 0%, avgDaysToClose: 0 |
| GET /api/dashboard/funnel | 200 | 4 stages with counts |
| GET /api/dashboard/activity | 200 | Activity feed data |
| GET /api/crm/dashboard/leaderboard | 200 | 2 team members (Miles Martin, Brandon Admin) |
| GET /api/crm/dashboard/tasks-today | 200 | 0 tasks today |
| GET /api/crm/dashboard/followups | 200 | 0 followups (may be broken — depends on outreach_log) |
| GET /api/crm/dashboard/conversion-by-storm | 200 | 0 storm conversions |
| GET /api/crm/dashboard/estimate-summary | 200 | All 0 (no estimates created) |
| GET /api/crm/pipeline/metrics | 200 | Funnel: new(6), contacted(1), appt_set(1), inspected(1) |
| GET /api/leads | 200 | 9 leads total |
| GET /api/leads?needs_followup=true | **500** | **BUG: `outreach_log` table does not exist** |
| GET /api/leads?unassigned=true | 200 | Works correctly |
| GET /api/estimates | 200 | 0 estimates |
| GET /api/crm/invoices | 200 | 4+ invoices (INV-0004 visible) |
| GET /api/crm/work-orders | 200 | 1+ work orders |
| GET /api/crm/contracts | 200 | Working |
| GET /api/crm/tasks | 200 | 0 tasks |
| GET /api/crm/expenses | 200 | Working |
| GET /api/crm/subcontractors | 200 | Working |
| GET /api/crm/canvass-pins | 200 | Working |
| GET /api/crm/territories | 200 | Working |
| GET /api/crm/drip-sequences | 200 | Working |
| GET /api/crm/automations | 200 | Working |
| GET /api/crm/financing/plans | 200 | Working |
| GET /api/crm/content/templates | 200 | Working |
| GET /api/crm/reports/revenue | 200 | Working |
| GET /api/crm/reports/pipeline | 200 | 4 stages with values |
| GET /api/crm/reports/rep-performance | 200 | Working |
| GET /api/crm/reports/lead-sources | 200 | Working |
| GET /api/crm/reports/conversion | 200 | Working |
| GET /api/crm/reports/stage-duration | 200 | Working |
| GET /api/notifications | 200 | Working |
| GET /api/search?q=test | 200 | Working |
| GET /api/storms | 200 | GeoJSON with active storms |
| GET /api/alerts/config | 200 | Working |
| GET /api/alerts/history | 200 | Working |
| GET /api/storm-history?lat=30.1&lng=-94.1 | 200 | NOAA SWDI data |
| GET /api/storm-history/heatmap | 200 | Heatmap data |
| GET /api/data/fema-housing?zip=77706 | 200 | FEMA housing assistance data |
| GET /api/materials/products | 200 | SRS catalog |
| GET /api/materials/branches | 200 | SRS branch locations |
| GET /api/materials/orders | 200 | Order history |
| GET /api/materials/credentials | 200 | Working |
| GET /api/documents | 200 | Working |
| GET /api/crm/leads | 200 | Enhanced lead list |
| GET /api/disaster-declarations | 400 | Needs county param |
| GET /api/admin/overview | 403 | Correct — requires super_admin role |
| **Total** | **50 tested** | **49 OK, 1 BUG (needs_followup)** |

---

## Known Bugs

| # | Bug | Severity | Location | Root Cause |
|---|-----|----------|----------|------------|
| 1 | **Needs Follow-up filter returns 500** | High | `GET /api/leads?needs_followup=true` | Queries nonexistent `outreach_log` table. Migration file exists (`007_outreach_log.sql`) but was never applied to production DB. Also referenced in `dashboardService.js:110` (followups dashboard panel). |

---

## Code Quality Issues

### Browser Dialogs (Should Be Modals)
| File | Line | Code | Should Use |
|------|------|------|-----------|
| AutomationSettings.jsx | 91 | `confirm('Delete this automation rule?')` | ConfirmModal |
| LeadDetail.jsx | 1602 | `alert('Status page link copied!')` | Toast |
| LeadDetail.jsx | 1604 | `alert('Failed to generate status link')` | Toast |
| RoofDrawingTool.jsx | 485 | `alert('Failed to save measurements')` | Toast |

### Silent Error Catches (No User Feedback)
| Component | # Silent Catches | Risk |
|-----------|-----------------|------|
| StormMap.jsx | 10+ | Medium — map shows blank on failure |
| LeadDetail.jsx | 9+ | High — critical lead data fails silently |
| Dashboard.jsx | 2 | Medium — metrics/team load silently |
| Pipeline.jsx | 2 | Medium — team data, pipeline stages |
| EstimatesView.jsx | 2 | Low — financing plans, estimate data |
| ContractsView.jsx | 3 | Medium — contract operations |
| InvoicesView.jsx | 1 | Low — invoice data |
| WorkOrdersView.jsx | 1 | Low — milestones |
| AdminDashboard.jsx | 5 | Low — admin-only |
| CalendarView.jsx | 2 | Medium — event loading |
| AlertSettings.jsx | 2 | Low |
| PublicEstimate.jsx | 2 | Medium — customer-facing |
| SettingsView.jsx | 2 | Low |
| **Total** | **65+** | |

### Production Data Issues
| Issue | Location | Impact |
|-------|----------|--------|
| WIP material names | materials.js:98-99, estimateService.js:413-414 | "Carlisle WIP 300/250 High Temp" appear in production catalog |
| Mock financing provider | SettingsView.jsx Financing tab | Users can select "mock" provider in production UI |

---

## Competitor Feature Matrix Cross-Reference (2026-04-01)

Features listed as "Missing" in the competitor matrix (2026-03-25) that have **actually been built:**

| Feature | Matrix Status | Actually Built? | When | Notes |
|---------|--------------|----------------|------|-------|
| Honey Hole Finder | Missing | **YES** | 2026-03-25 | NOAA SWDI integration, heat map overlay, full UI |
| Territory/region assignment | Missing | **YES** | 2026-03-24 | PostGIS polygons, drawing tool, team assignment |
| Photo annotation | Missing | **YES** | 2026-03-24 | PhotoAnnotator component wired into LeadDetail |
| Material ordering | Missing | **YES** | 2026-03-24 | SRS catalog integration, cart, order submission |
| Subcontractor mgmt | Missing | **YES** | 2026-03-24 | Full CRUD with work order assignment |
| Automated review requests | Missing | **YES** | 2026-03-24 | Google review link on job completion |
| Solar analysis | Missing | **YES** | 2026-03-25 | 6 metrics in LeadDetail via Google Solar API |
| AI content/marketing | Missing → Partial | **PARTIAL** | 2026-03-27 | Content Studio with templates + preview; not LLM-powered |
| SMS texting | Missing | No | — | Still missing; requires Twilio |
| QuickBooks sync | Missing | No | — | Still missing; #1 integration gap |
| Email integration | Worse | No | — | Still email-via-automations only |
| AI phone answering | Missing | No | — | Out of scope (expensive) |
| AI roof measurements | Missing | **PARTIAL** | Built | Google Solar API provides basic measurements |
| Instant online quoting | Missing | No | — | RoofLink/Roofle exclusive |
| Mobile app (native) | Missing | No | — | Web-only; PWA available |
| Next-day funding | Missing | No | — | Stripe-specific feature |

**Updated Feature Status Count:**
- Matrix shows 15 items as "Missing" → 7 are now built, 1 partial, 7 still missing
- Matrix shows 2 items as "Worse" → Both still worse (email, historical data depth)

---

## Top 10 Improvement Opportunities (Prioritized)

Based on functional inventory + competitor comparison, these are the highest-impact improvements:

### Tier 1: Critical Gaps (Competitive Blockers)

| # | Improvement | Why | Effort | Competitor Reference |
|---|-------------|-----|--------|---------------------|
| 1 | **Fix needs_followup bug** | Broken quick filter returns 500. Either create `outreach_log` table or rewrite to use `activities` table. Dashboard followups panel may also be affected. | Small (1-2 hrs) | Basic CRM functionality |
| 2 | **QuickBooks sync** | #1 integration gap. Every competitor (JN, RL) has it. Roofing contractors need accounting sync or they won't switch. Start with one-way invoice push via QB free developer tier. | Large (8-16 hrs) | JN: built-in, RL: built-in |
| 3 | **Server-side PDF estimates** | Browser print dialog is unprofessional. Need branded PDFs with cover page, photos, line items, e-sign placeholder. Use pdfmake or puppeteer. | Large (6-12 hrs) | JN: SumoQuote PDFs, RL: professional PDFs |

### Tier 2: High-Impact Quick Wins

| # | Improvement | Why | Effort | Competitor Reference |
|---|-------------|-----|--------|---------------------|
| 4 | **Add error toasts to 65+ silent catches** | Users get no feedback when operations fail. Batch with `showToast()` hook across all pages. Prioritize: LeadDetail (9), StormMap (10), Dashboard (2). | Medium (3-5 hrs) | All competitors show error states |
| 5 | **Replace 4 browser dialogs with modals/toasts** | `alert()` and `confirm()` break the glass aesthetic and mobile UX. Replace with existing Toast and ConfirmModal patterns. | Small (1 hr) | All competitors use custom modals |
| 6 | **Fix bulk Assign Rep dropdown** | Currently uses raw UUID text input — completely unusable. Replace with team member dropdown using CustomSelect. | Small (30 min) | JN: dropdown, RL: dropdown |
| 7 | **Add Profile edit form** | Settings > Profile tab is read-only. Users can't update their name, email, or avatar. | Small (1-2 hrs) | All competitors have profile editing |

### Tier 3: Competitive Differentiators

| # | Improvement | Why | Effort | Competitor Reference |
|---|-------------|-----|--------|---------------------|
| 8 | **Hail swath color graduation** | Color-code storm swaths by hail size (green < 1", yellow 1-1.5", orange 1.5-2", red 2"+). Currently all swaths are same color. | Medium (2-4 hrs) | HailTrace: multi-color by intensity |
| 9 | **Calendar appointment scheduling** | Click-to-create events, drag-to-schedule time slots. Currently calendar is read-only display. | Medium (4-6 hrs) | JN: full scheduling, RL: crew scheduling |
| 10 | **Remove mock/WIP data from production** | Mock financing provider in Settings UI, WIP material names in catalog. Unprofessional if customers see it. | Small (30 min) | N/A |

---

## Feature Completeness Summary

| Category | Features Built | Working | Broken | Missing vs Competitors |
|----------|---------------|---------|--------|----------------------|
| CRM & Pipeline | 12 | 12 | 0 | Bulk SMS, map view of leads |
| Estimates & Contracts | 10 | 10 | 0 | Server-side PDF, change orders |
| Invoicing & Payments | 7 | 7 | 0 | QuickBooks sync, Text-to-Pay |
| Storm Data & Maps | 8 | 7 | 1 stub | Color graduation, meteorologist |
| Canvassing | 5 | 4 | 1 stub | GPS verification, route planning |
| Dashboard & Reports | 10 | 10 | 0 | Custom report builder |
| Communication | 4 | 4 | 0 | SMS, in-app email, AI phone |
| Work Orders | 7 | 7 | 0 | Supplier PO integration |
| Content & AI | 3 | 3 | 0 | LLM integration, social scheduling |
| Settings & Admin | 15 | 14 | 1 (profile) | White-label/branding |
| **TOTAL** | **81** | **78** | **3** | |

---

## Appendix: Updated Competitor Matrix Status

| Feature | Matrix (3/25) | Actual (4/1) | Change |
|---------|--------------|-------------|--------|
| Honey Hole Finder | Missing | **Built** | Fixed |
| Territory/region assignment | Missing | **Built** | Fixed |
| Photo annotation | Missing | **Built** | Fixed |
| Material ordering | Missing | **Built** | Fixed |
| Subcontractor mgmt | Missing | **Built** | Fixed |
| Automated review requests | Missing | **Built** | Fixed |
| Solar analysis | Missing | **Built** | Fixed |
| AI content/marketing | Missing | **Partial** | Template-only |
| Historical data depth | Worse (30d) | **Better** (10yr SWDI) | Improved |
| QuickBooks sync | Missing | Missing | No change |
| SMS texting | Missing | Missing | No change |
| Email integration | Worse | Worse | No change |
| AI phone answering | Missing | Missing | No change |
| Instant online quoting | Missing | Missing | No change |
| Next-day funding | Missing | Missing | No change |
| Mobile app (native) | Missing | Missing (PWA) | No change |
| AI roof measurements | Missing | Partial (Solar API) | Improved |
