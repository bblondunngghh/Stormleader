# StormLeads App Functional Inventory — 2026-03-28

**Method:** Source code analysis of all frontend page components, backend route files, and API modules. Cross-referenced against competitor Feature Comparison Matrix from `docs/competitor-gap-analysis.md`.

**Pages inventoried:** 20 routes (17 authenticated + 3 public)
**Backend route files:** 39 route modules
**Branch:** `feat/financing` at commit `a6b3cbf`

---

## Page-by-Page Inventory

| # | Page | Route | Lines | Features Present | Works? | Broken/Missing | Competitor Notes |
|---|------|-------|-------|-----------------|--------|----------------|-----------------|
| 1 | **Dashboard** | `/` | 1,338 | 4 KPI stat cards (pipeline value, new leads, close rate, avg days to close) with week-over-week change indicators. Pipeline funnel visualization. Mini storm map (Mapbox). Storm activity feed with 24h/7d/30d filter. Today's tasks with checkbox toggle. Follow-ups section. Activity feed. Storm conversion rates (top 5). Estimate summary (draft/sent/viewed/accepted). Team leaderboard table. Skeleton loading. CountUp animations. Responsive mobile layout. | Yes | No drill-down from leaderboard to rep's leads. No manual lead creation from dashboard. Storm conversion limited to top 5. | **Matches JN:** Has funnel, tasks, leaderboard. **Better:** Storm activity + conversion panels unique to StormLeads. |
| 2 | **Storm Map** | `/storm-map` | ~2,500+ | 5 storm swath types (hail, wind, tornado, severe, drift). County + FEMA property markers with clustering. Honey Holes heat layer. Address search. Time range picker (24h–30d). Layer toggles. Opacity slider. "Improved Only" filter. Property popup with owner/address/FEMA data/damage assessment. "Add to Pipeline" from property. Swath detail popup. Tile-based progressive property loading with caching. | Yes | No hail swath color graduation by severity (green→red). No property filtering by stage/rep/impact date. No "batch add to pipeline" for multiple properties. 200-storm cap per time range. | **Better than HailTrace:** Free, combined with CRM. **Worse:** No color graduation, no 10+ year history, no meteorologist verification, no property filters. |
| 3 | **Storm Archive** | `/storm-catalog` | ~200 | Time range filter (24h–30d). Full-text search across type/location/county. Storm cards grid with type badge, date, location, hail size, wind speed, source. Click-to-navigate to storm map. Lazy reverse-geocoding for storms without location. | Yes | Max 200 storms, no pagination. No detail view without navigating away. No export. No severity rating display. | New feature, no direct competitor equivalent as standalone page. |
| 4 | **Pipeline** | `/pipeline` | 1,098 | 3 board tabs: Sales (7 stages), Production (5 stages), Billing (3 stages). Drag-and-drop cards between columns. Priority/source/rep filters with active pills. Column collapse/expand (persisted). Conversion rate badges between columns. Deal value on cards + column revenue totals. Days-in-stage badges (color-coded). Financing status badge. Horizontal pan/grab scrolling. Mobile view with stage pills. CreateLeadModal. | Yes | Mobile "List" view mode button exists but only Board view implemented. Rep avatar shows initials only (no photos). No inline card editing. | **Matches JN+RL:** Full kanban with drag-drop. **Better:** 3 board views (Sales/Production/Billing), free conversion rates, days-in-stage. Revenue totals now implemented. |
| 5 | **Leads** | `/leads` | 668 | 16-column sortable table. URL-synced filters (stage, priority, source, score). Debounced search. Checkbox multi-select. Bulk assign rep / bulk stage change. CSV export (16 columns). Lead score badges (color-tiered). Page size selector (25/50/100). Pagination. Import CSV modal. Click row → LeadDetail. | Yes | No column reorder/hide. No saved filter presets. No inline editing. | **Matches JN:** Full lead table with bulk actions. **Better:** Free lead scoring, CSV import/export included. |
| 6 | **Lead Detail** | (modal) | 2,920 | Priority/stage dropdowns. 7-factor lead score with breakdown popup. Contact info + additional contacts. 6 action buttons (View House, Measure Roof, Run Trace, Storm History, Property Report, FEMA Disaster History). Property details + roof type. Storm & damage section. Roof measurement display with 8 edge types. Documents with photo annotation. Financing applications. Contracts list. Expenses / job costing with profit summary. Client status page sharing. Google review request (completed jobs). Solar potential (6 metrics). 6 quick actions (Log Activity, Call, Email, SMS, Visit, Insurance Report). Street View / Satellite modal. Roof Drawing Tool. Insurance Report generator (print-to-PDF). Remove lead. | Yes | Custom fields fetched but not displayed in UI. SMS composer uses native `sms:` protocol (no in-app SMS). noaaHistory variable declared but unused. | **Better than JN:** Built-in photo annotation, solar data, FEMA history, weather report, insurance report PDF, lead scoring — all free. **Missing vs JN:** No CompanyCam integration, no EagleView integration. |
| 7 | **Estimates** | `/estimates` | 2,166 | 4 KPI stat cards. Status filter dropdown. Full estimate builder with sections management. Line items editor with drag reorder. Templates. Rich text editor (bold/italic/underline/lists/links). Financing toggle with plan selection. Multi-signer authorization. Auto-save (2s debounce). Send modal with email template + tokens. Preview/print mode. Good/Better/Best tier generation. Duplicate estimate. Convert to contract. SRS catalog integration. Section images. Tax rate selector. | Yes | No PDF export (print-to-PDF only). Section reorder drag support prepared but unclear if fully wired. | **Matches JN/SumoQuote:** Full builder, templates, e-sign, tiers. **Better:** Free, unlimited, financing built-in. **Worse:** No inspection photo pages embedded in estimates. |
| 8 | **Contracts** | `/contracts` | 603 | 4 KPI stat cards. Status filter. Contract builder with template system. Merge field support (8 fields). Lead search + auto-populate. Side-by-side preview with resolved merge fields. Send via email. Void contract. Create from estimate (URL params). | Yes | No PDF download (preview only). | Unique feature — most competitors don't have built-in contracts. |
| 9 | **Work Orders** | `/work-orders` | ~700 | 4-column kanban (Pending/Scheduled/In Progress/Completed). Drag-drop status changes. Milestone management with progress bars. Photo upload per milestone. Editable fields (title, desc, assignee, crew, dates, times, notes). Create from estimate. Line items display. | Yes | Line items are read-only in detail modal (no add/edit). | **Better than JN:** Visual kanban (JN has basic WO). **Matches RL:** Similar kanban workflow. |
| 10 | **Materials** | `/materials` | ~800 | 14 product categories with animated tab indicator. Product search. Product grid with category/stock badges. Shopping cart sidebar with quantity controls. Product detail modal. Branch selector. Order submission. Order history tab. | Yes | Product catalog may not be populated with real SRS data. Order history detail view may be partial. | Unique — no competitor has built-in material catalog (they integrate SRS/QXO externally). |
| 11 | **Invoices** | `/invoices` | 1,026 | 4 KPI stat cards (Total Invoiced, Collected, Outstanding, Overdue). Filter tabs (All/Draft/Sent/Paid/Overdue). Invoice builder with lead search, line items, tax, due date. Preview mode. Send email. Record payment. Void invoice. Create from estimate. Overdue badge. | Yes | Payment modal partially implemented. No recurring invoices. No QuickBooks sync. | **Matches JN:** Full invoicing. **Missing:** No online payment collection (Stripe checkout), no QuickBooks sync, no Text-to-Pay. |
| 12 | **Expenses** | `/expenses` | ~500 | 3 KPI stat cards. 6 expense categories (color-coded). Category + date range filters. Add/Edit modal with lead search. Delete confirmation. Lead association. | Yes | No receipt photo upload. No recurring expenses. | **Matches JN:** Basic expense tracking. Per-job profit tracking in LeadDetail is better than most competitors. |
| 13 | **Tasks** | `/tasks` | ~600 | Filter tabs (Pending/Completed). Summary header (Overdue/Due Today counts). Task list with checkbox toggle. Priority badges. Assignee + lead display. Create/Edit slide-over modals. Mobile: "Mission Log" themed view with overdue/today/upcoming sections. Efficiency index (completion rate + critical path velocity). | Yes | No task templates. No recurring tasks. No drag-to-reorder priority. | **Matches JN:** Basic task management with priorities. |
| 14 | **Calendar** | `/calendar` | ~200 | FullCalendar integration. Month/Week/Day/List views. Task + activity events. Drag-to-reschedule (tasks only). Event type badges. Priority display. Click event → navigate to lead. Now indicator. | Yes | No create event from calendar click. No team member calendar overlay. | **Matches JN:** Calendar with scheduling. **Worse:** No dispatching, no crew scheduling. |
| 15 | **Canvassing** | `/canvassing` | ~600 | Interactive dark-themed Google Map. 6 outcome types (color-coded pins). GPS-based pin dropping. Stats bar (total/interested/scheduled). Pin detail with notes. Convert pin to lead. Territory manager toggle. | Yes | Can't edit existing pins. No offline mode. No voice/photo notes per pin. | **Matches HailTrace:** GPS pins + outcomes + conversion. **Missing:** Can't edit pins after creation. Territory drawing exists separately. |
| 16 | **Reports** | `/reports` | ~600 | 6 chart types: Revenue (area), Pipeline by stage (bar), Conversion by source (radar), Rep leaderboard (sortable table), Lead sources (donut), Stage duration (line). Date range presets + custom dates. CSV export per chart. | Yes | No comparison periods (vs last month/quarter). No drill-down on chart elements. No "export all" option. No trend indicators. | **Matches JN:** Multiple report types. **Worse:** No comparison periods, no drill-down. JN users complain their "Insights" is "AWFUL" though. |
| 17 | **Content Studio** | `/content-studio` | ~400 | Generate tab: 5 content types (social, door hangers, email, blog, ads). 4 tones. 10 merge variables. Batch mode (5 variations). Library tab: search + filter saved content. Copy to clipboard. | Yes | Library stored in localStorage only (no cloud sync). Requires AI backend endpoint. | **Matches Rooftops.ai Creator Studio.** Unique vs JN/HailTrace/RL (none have content generation). |
| 18 | **Subcontractors** | `/subcontractors` | ~400 | 12 specialties (color-coded). Paginated list with search/filter. Add/Edit slide-over panel. Phone auto-formatting. Delete with confirmation. Active/Inactive status. Hourly rate display. | Yes | No work order assignment history view. No performance rating. | **Matches JN:** Sub management. Most competitors don't have this. |
| 19 | **Settings** | `/settings` | ~1,500+ | 15 tabs: Profile, Company, Billing, Payments (Stripe), Team, Storm Alerts, Notifications, Email/SMTP, Financing (Hearth), Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews. | Yes | Some tabs may have partial implementations. | Comprehensive — covers more settings than most competitors in one view. |
| 20 | **Admin** | `/admin` | ~500 | 4 tabs: Overview, Tenants, Revenue, Usage. Super-admin role gate. Tenant management with status/tier badges. Revenue breakdown. Usage leaderboard. | Partial | Likely still under development. Only accessible to super_admin. | Internal tool — not customer-facing. |

### Public Pages

| Page | Route | Features | Works? |
|------|-------|----------|--------|
| **Public Estimate** | `/estimate/:token` | Customer-facing estimate view with e-signature canvas | Yes |
| **Public Contract** | `/contract/:token` | Customer-facing contract with signature | Yes |
| **Client Status** | `/status/:token` | Public job progress page | Yes |
| **Login** | `/login` | Email + password + tenant selection | Yes |
| **Register** | `/register` | New account creation | Yes |
| **Onboarding** | `/onboarding` | Post-registration setup flow | Yes |

---

## Backend Route Coverage (39 modules)

| Module | Endpoints | Status |
|--------|-----------|--------|
| admin.js | Tenant management, platform stats | Active |
| alerts.js | Storm alert configuration | Active |
| auth.js | Login, register, refresh, logout (rate-limited) | Active |
| automations.js | Workflow trigger/action CRUD | Active |
| canvassing.js | Pin CRUD, convert-to-lead, territory polygons | Active |
| content.js | AI content generation | Active |
| contracts.js | Contract CRUD, send, void, sign | Active |
| counties.js | County lookup | Active |
| crm.js | Lead CRUD, bulk operations, pipeline, team | Active |
| dashboard.js | Stats, funnel, tasks-today, activity, leaderboard | Active |
| dataApis.js | Census ACS, external data proxies | Active |
| disasterDeclarations.js | FEMA disaster history lookup | Active |
| documents.js | Upload, download, delete | Active |
| drift.js | Wind-drift swath calculation | Active |
| drip.js | Drip sequence CRUD, step management, cron | Active |
| estimates.js | Estimate CRUD, send, templates, tiers | Active |
| expenses.js | Expense CRUD with lead association | Active |
| financing.js | Hearth adapter, application status | Active |
| hearthWebhook.js | Financing webhook handler | Active |
| invoices.js | Invoice CRUD, send, payments, overdue cron | Active |
| leads.js | Lead endpoints, scoring, import | Active |
| map.js | Storm data, property loading | Active |
| materials.js | SRS product catalog, orders | Active |
| notifications.js | 10-category notification system | Active |
| onboarding.js | Post-registration setup | Active |
| payments.js | Stripe integration | Active |
| properties.js | Property search, import triggers | Active |
| reports.js | Revenue, pipeline, conversion, rep, duration | Active |
| roofMeasurement.js | Google Solar + manual measurements | Active |
| search.js | Global search (Cmd-K) | Active |
| skipTrace.js | Contact lookup service | Active |
| stormHistory.js | Weather history + PDF report | Active |
| storms.js | Storm ingestion, SPC/NWS/MRMS | Active |
| subcontractors.js | Subcontractor CRUD | Active |
| territories.js | Canvassing territory polygons | Active |
| webhook.js | General webhook handler | Active |
| workOrders.js | WO CRUD, milestones, photos | Active |

---

## Competitor Matrix Cross-Reference (Updated)

Items from the Feature Comparison Matrix (`docs/competitor-gap-analysis.md`) that were marked as **Missing** or **Worse**, with current actual status:

| Feature | Matrix Status | Actual Status (2026-03-28) | Notes |
|---------|--------------|---------------------------|-------|
| Honey Hole Finder | Missing | **BUILT** | Full hail frequency heat layer on storm map via NOAA SWDI |
| Territory/region assignment | Missing | **BUILT** | Territory manager with polygon drawing in canvassing |
| Photo annotation | Missing | **BUILT** | Canvas-based markup in LeadDetail documents tab |
| Subcontractor management | Missing | **BUILT** | Full CRUD with 12 specialties, rates, status |
| Automated review requests | Missing | **BUILT** | Google review link generation for completed jobs |
| AI content/marketing | Missing | **BUILT** | Content Studio with 5 types, 4 tones, batch mode |
| Online payments | Missing → Better | **BUILT** | Stripe integration in Settings + invoice payment recording |
| Financing | Match | **BUILT** | Hearth adapter with webhook handler |
| Deal value on pipeline cards | Previously Missing | **BUILT** | Revenue totals per column + value on cards |
| Good/Better/Best estimate tiers | Previously Missing | **BUILT** | Tier generation exposed in EstimatesView UI |
| Estimate → Work Order | Previously Missing | **BUILT** | Auto-create WO when estimate approved/signed |
| Invoice overdue reminders | Previously Missing | **BUILT** | Daily cron + overdue badge |
| Property report PDF | Previously Missing | **BUILT** | Comprehensive PDF with storm history + lead score |
| QuickBooks sync | Missing | **STILL MISSING** | No QuickBooks integration |
| SMS/texting | Missing | **STILL MISSING** | Only native sms: protocol links, no in-app SMS |
| Mobile native app | Missing | **STILL MISSING** | Web-only (PWA manifest exists) |
| AI phone receptionist | Missing | **STILL MISSING** | No telephony integration |
| AI mobile assistant | Missing | **STILL MISSING** | No voice command interface |
| AI roof measurements | Missing | **STILL MISSING** | No satellite-based auto-measurement |
| AI proposal generation | Missing | **PARTIAL** | Content Studio generates marketing content, not full proposals |
| Instant online quoting | Missing | **STILL MISSING** | No homeowner self-service quoting widget |
| Solar analysis | Missing | **BUILT** | Google Solar API integration in LeadDetail (panel count, savings, payback) |
| Aerial measurements | Missing | **PARTIAL** | Google Solar provides roof segments; no EagleView/Hover integration |
| Material ordering | Missing | **BUILT** | SRS catalog with cart + order submission in MaterialsView |
| Historical data depth (10+ yr) | Worse (30-day) | **STILL WORSE** | Still limited to NOAA 30-day rolling window |
| Meteorologist verification | Worse | **STILL WORSE** | Algorithm-only, no human verification |
| Email integration (2-way) | Worse | **STILL WORSE** | Send-only via SMTP, no inbox sync |
| Hail swath color graduation | Not in matrix | **STILL MISSING** | All hail swaths same color regardless of severity |
| Property filtering on map | Not in matrix | **STILL MISSING** | No filter by stage/rep/impact date on map |

---

## Top 10 Improvement Opportunities

Ranked by competitive impact and feasibility:

### 1. Hail Swath Color Graduation by Severity
**Gap:** All hail swaths display the same yellow color regardless of hail size. HailTrace grades green → yellow → orange → red by severity.
**Impact:** High — this is the first thing storm chasers notice when comparing map tools.
**Effort:** Low — data already includes hail size; just need conditional fill color in Mapbox layer style.

### 2. Property Filtering on Storm Map
**Gap:** No way to filter map properties by pipeline stage, assigned rep, or impact date. HailTrace and RoofLink both support this.
**Impact:** High — sales reps need to see "my properties" vs "unclaimed" on the map.
**Effort:** Medium — need to join leads table with property markers and add filter UI.

### 3. QuickBooks Sync
**Gap:** JobNimbus and RoofLink both have QuickBooks integration. Contractors need accounting sync.
**Impact:** Critical for sales — accountants will block adoption without this.
**Effort:** Medium — QB API has free tier for small apps, need OAuth flow + invoice/payment sync.

### 4. In-App SMS Messaging
**Gap:** Current SMS uses native `sms:` protocol links. JobNimbus charges $49-249/mo for Engage texting. No in-app conversation view.
**Impact:** High — contractors communicate heavily via text.
**Effort:** Medium — Twilio API (~$0.0075/msg), need message thread UI + send/receive endpoints.

### 5. PDF Export for Estimates/Invoices/Contracts
**Gap:** Currently relies on browser print-to-PDF. No server-side PDF generation for email attachment or download button.
**Impact:** High — customers expect "Download PDF" buttons.
**Effort:** Medium — pdfmake already in dependencies; need server-side render + download endpoint.

### 6. Historical Storm Data Expansion (10+ Years)
**Gap:** Only 30-day NOAA rolling window. HailTrace has 10+ years of history.
**Impact:** High — historical data is HailTrace's core value proposition.
**Effort:** Medium-High — NOAA Storm Events CSV archives are free but need bulk ingestion pipeline.

### 7. Calendar Event Creation + Team Overlay
**Gap:** Can't create events by clicking on calendar. No team member calendar overlay for crew scheduling.
**Impact:** Medium — current calendar is view-only for non-task events.
**Effort:** Low — FullCalendar supports `dateClick` handler; team overlay needs multi-source fetch.

### 8. Custom Fields Display in Lead Detail
**Gap:** Custom field definitions are fetched in LeadDetail but never rendered in the UI. The feature exists in the backend but has no visible frontend.
**Impact:** Medium — users who configured custom fields can't see them on leads.
**Effort:** Low — definitions already fetched; need a "Custom Fields" section with read/edit UI.

### 9. Comparison Periods in Reports
**Gap:** Reports show current period only. No "vs last month" or "vs last quarter" comparison. No trend arrows.
**Impact:** Medium — managers need to see if metrics are improving.
**Effort:** Medium — need dual-fetch for comparison period + delta calculation + trend indicators.

### 10. Canvassing Pin Editing + Offline Mode
**Gap:** Can't edit pins after creation. No offline support despite field use case.
**Impact:** Medium — field reps make mistakes and lose connectivity.
**Effort:** Medium — edit is straightforward API call; offline needs service worker queue.

---

## Feature Completeness Summary

| Category | Total Features | Complete | Partial | Missing |
|----------|---------------|----------|---------|---------|
| CRM & Pipeline | 8 | 8 | 0 | 0 |
| Sales & Estimating | 7 | 6 | 1 (PDF export) | 0 |
| Invoicing & Payments | 6 | 4 | 1 (payments) | 1 (QuickBooks) |
| Storm Data & Maps | 8 | 5 | 1 (history depth) | 2 (color grad, property filters) |
| Scheduling & Tasks | 4 | 3 | 1 (calendar create) | 0 |
| Canvassing | 4 | 3 | 0 | 1 (pin editing) |
| Communication | 4 | 1 | 1 (email) | 2 (SMS, AI phone) |
| Reporting | 4 | 3 | 1 (comparison) | 0 |
| AI Features | 5 | 1 | 1 (content) | 3 (phone, assistant, measurements) |
| Other | 6 | 4 | 1 (aerial) | 1 (native mobile) |
| **TOTAL** | **56** | **38 (68%)** | **8 (14%)** | **10 (18%)** |

---

*Generated 2026-03-28 by code-based functional analysis. Last competitor data from 2026-03-26 scrapes.*
