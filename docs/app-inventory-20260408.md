# StormLeads App Inventory — 2026-04-08

**Method:** Full source code analysis of all protected routes, public routes, backend route files, sidebar navigation, and database migrations. Builds on 2026-04-07 inventory with verification of all changes since.
**Firecrawl:** 0 credits remaining — inventory is code-based (no live screenshots).
**Changes since last inventory (2026-04-07):** 4 feature commits + 1 checkpoint commit. Content Studio REMOVED. Pipeline refactored. Work Order PDF added. Speed-to-Lead metric added. Canvassing pins upgraded.

---

## What Changed Since 2026-04-07

| Change | Commit | Impact |
|--------|--------|--------|
| Speed-to-Lead dashboard metric | ea27386 | 5th KPI stat card, backend LATERAL join query — **NEW FEATURE** |
| Dead measurement button fix + insurance auto-calcs | c3a80e1 | Toast guidance on LAUNCH MEASUREMENT TOOL, auto-calc depreciation/ins pays/customer owes — **FIX + ENHANCEMENT** |
| Color-coded teardrop canvassing pins | 1d59c36 | SVG teardrops, outcome legend, analytics section — **NEW FEATURE** |
| CanvassingMode legend oklch fix | 6760ceb | SVG stroke rgba→oklch — **UI FIX** |
| Content Studio REMOVED | 768f403 | Component, route, service, CSS, sidebar link all deleted — **BREAKING CHANGE** |
| Pipeline refactored | 768f403 | 182 additions, 206 deletions, net -24 lines — **REFACTOR** |
| Work Order PDF export | 768f403 | Backend pdfmake endpoint + frontend download button — **NEW FEATURE** |

**Net feature change:** 2 new features (Speed-to-Lead, WO PDF export), 1 removal (Content Studio), 1 major enhancement (canvassing pins), 1 fix (measurement button), 1 refactor (Pipeline).

---

## Navigation Structure

### Sidebar (Desktop) — 16 items (was 17; Content Studio removed)
**Top-level (5):** Dashboard, Storm Map, Storm Archive, Pipeline, Leads
**Jobs group (4):** Estimates, Contracts, Work Orders, Materials
**Finance group (2):** Invoices, Expenses
**Operations group (5):** Tasks, Calendar, Canvassing, Subcontractors, Reports
**Bottom (1):** Settings (15 tabs)

### Not in Sidebar (route-only access)
- `/admin` — AdminDashboard (super_admin role only)
- `/alerts` — AlertSettings (linked from Settings > Alerts tab)

### Public Routes (no auth required)
- `/login`, `/register`, `/onboarding`
- `/estimate/:token` — PublicEstimate (customer-facing e-sign + payment)
- `/contract/:token` — PublicContract (customer-facing e-sign)
- `/status/:token` — ClientStatusPage (customer-facing job progress)

---

## Page-by-Page Inventory

### 1. Dashboard (`/`)
**Component:** Dashboard.jsx (1,740 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| 5 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close, **Speed to Lead**) | Yes | Animated count-up, clickable navigation |
| **Speed-to-Lead metric (NEW)** | Yes | Backend LATERAL join, avg minutes from lead creation to first activity, color badges: Excellent (<=5m green), Good (<=30m amber), Slow (>30m red) |
| Revenue goal progress bar | Yes | Editable target, on-track/behind indicator |
| Pipeline conversion funnel chart | Yes | Bar chart with stage progression |
| Mini storm map (Mapbox) | Yes | Active storms with live radar indicator |
| Tasks due today | Yes | Checkbox toggle, click to lead detail |
| Follow-ups section | Yes | Upcoming follow-up actions |
| Activity feed | Yes | Recent activities with timestamps |
| Team leaderboard | Yes | 8-column table, clickable rows |
| Conversion by storm chart | Yes | Visual breakdown |
| Estimate summary (accepted/pending/declined) | Yes | Dollar value aggregation |
| A/R aging summary (5 buckets) | Yes | Current, 1-30, 31-60, 61-90, 91+ days |
| Estimating conversion cards | Yes | Acceptance rate, pipeline, average |
| Filter dropdowns (Rep, Source, Period) | Yes | CustomSelect, backend-filtered |
| Comparison period data with trend arrows | Yes | Delta badges |
| Loading skeletons | Yes | Shimmer animation, now 5-card grid |
| Days-in-stage cards | Yes | Avg days per stage, stuck lead counts |
| Stale leads alert panel | Yes | Days-stale badges, color-coded |

**Issues:** 2 silent `.catch(() => {})` on getTeamMembers and getLeads.

---

### 2. Storm Map (`/storm-map`)
**Component:** StormMap.jsx (2,856 lines) | **Status:** Mostly functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Google Maps with storm swath polygons | Yes | Hail, wind, tornado, thunderstorm layers |
| Hail severity color graduation | Yes | Green-yellow-orange-red by hail size |
| Wind severity color graduation | Yes | Blue-green-orange-red by mph |
| Tornado severity color graduation | Yes | Yellow-orange-red-purple by EF-scale |
| Swath transparency slider | Yes | 0-100% opacity |
| Layer toggle panel (6 layers) | Yes | Hail/wind/tornado/tstorm/drift/properties |
| FEMA National Structure Inventory overlay | Yes | Points within swath polygons |
| Supercluster property clustering | Yes | Performance optimization |
| Address search bar | Yes | With loading state |
| Honey Hole heatmap overlay | Yes | NOAA SWDI historical hail circles |
| Property popup with "Add to Pipeline" | Yes | Creates lead from map |
| Storm history per location | Yes | 5-mile radius, 10-year SWDI window |
| Time range filter (24h/3d/7d/14d/30d) | Yes | Session-persisted |
| Generate Canvassing List button | Yes | Creates up to 50 canvass pins from storm properties |
| Zoom level indicator | Yes | Z-scale display |
| Terrain toggle | Yes | Map type switch |
| Mobile-responsive layout | Yes | Separate mobile layout |

**Issues:**
- 1 silent catch block
- 2,856-line component — refactoring candidate

---

### 3. Storm Archive (`/storm-catalog`)
**Component:** StormCatalog.jsx (401 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Storm cards grid (responsive auto-fill) | Yes | Min 280px cards |
| Time range filter (24h/3d/7d/14d/30d) | Yes | 5 pill buttons |
| Text search | Yes | Real-time filtering |
| Type filter (All/Hail/Wind/Tornado) | Yes | Pill buttons |
| Sort options (Date/Severity/Hail Size/Wind) | Yes | 4 sort buttons |
| 5-star severity rating | Yes | Calculated from hail/wind data |
| "DAMAGE LIKELY" badge | Yes | For hail >= 1.5" |
| Click-to-navigate to storm map | Yes | Centers map on storm |
| Calendar-based storm search | Yes | Date range picker |

**Issues:** 1 silent catch block.

---

### 4. Pipeline (`/pipeline`)
**Component:** Pipeline.jsx (1,495 lines, refactored from 1,519) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Kanban board with drag-and-drop | Yes | HTML5 drag API, optimistic updates |
| 3 board tabs (Sales/Production/Billing) | Yes | Stage filtering by workflow phase |
| Deal value on cards | Yes | Shows formatted estimated_value |
| Column revenue totals | Yes | Sum of estimated_value per column |
| Lead score badges | Yes | Color-coded (80+/60+/40+) |
| Source labels on cards | Yes | At-a-glance identification |
| Task progress badges | Yes | Completion percentage |
| Days-in-stage badges | Yes | Color-coded (green/gray/amber/red) |
| Conversion rate between columns | Yes | Color-coded percentages |
| Column collapse toggle | Yes | localStorage-persisted |
| Priority/Source/Rep filter dropdowns | Yes | Active filter pills + clear all |
| Mobile list view | Yes | With deal value, priority dots |
| Create Lead button | Yes | Opens CreateLeadModal |
| Sidebar lead preview | Yes | Stage change UI, activity feed |
| **Due date badges (NEW from refactor)** | Yes | Urgent/today/upcoming styling on cards |
| **Mobile priority badges (NEW from refactor)** | Yes | Visual indicator mapping for mobile list view |
| **Active filter pills (NEW from refactor)** | Yes | Shows applied filters with clear option |
| **Financing badge on mobile (NEW from refactor)** | Yes | Visible in mobile list view |

**Issues:** 4 silent catch blocks. HTML5 drag API (limited mobile touch support, not @dnd-kit).

---

### 5. Leads (`/leads`)
**Component:** LeadList.jsx (790 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Data table with 16 columns | Yes | Stage, Priority, Score, Address, Contact, Phone, Email, Source, etc. |
| Column sorting with direction toggle | Yes | Ascending/descending arrows |
| Search bar with 350ms debounce | Yes | URL-synced |
| Quick filters (Hot Leads, Needs Follow-up, Unassigned) | Yes | Preset buttons |
| Advanced filters (Stage, Priority, Source, Score) | Yes | Active filter pills |
| Saved filter presets | Yes | localStorage-backed |
| Bulk actions (Change Stage, Assign Rep) | Yes | Checkbox selection + CustomSelect |
| CSV export | Yes | Formatted download |
| CSV import | Yes | ImportLeadsModal with Census geocoding |
| Pagination (25/50/100 per page) | Yes | Page size selector + prev/next |
| URL-synced filters | Yes | Shareable filtered views |

**Issues:** 1 silent catch block.

---

### 6. Lead Detail (panel from Pipeline/Leads)
**Component:** LeadDetail.jsx (2,921 lines) | **Status:** Fully functional, very comprehensive

| Feature | Works? | Notes |
|---------|--------|-------|
| Lead info header | Yes | Address, storm, contact, priority + stage dropdowns |
| Lead scoring (7-factor algorithm) | Yes | Score button, breakdown popup |
| Roof details (type, measurements) | Yes | Editable |
| Property info (FEMA data) | Yes | On-demand fetch |
| Financing section (Hearth) | Yes | Plans, applications, status tracking |
| Contracts section | Yes | Associated contracts list |
| Expenses / profit tracking | Yes | Estimate total - expenses = profit |
| Activities section | Yes | Feed + log (Activity, Call, Email, SMS, Visit, Insurance) |
| Documents section | Yes | Upload, delete, photo annotation |
| Weather/storm history | Yes | Historical data + PDF export |
| Roof measurement tools | Yes | Drawing, manual entry, solar potential |
| Custom fields | Yes | Dynamic inputs |
| Review request generation | Yes | Google review link |
| Client status page link | Yes | Shareable status token |
| Skip trace | Yes | Contact info lookup |
| FEMA disaster declarations | Yes | Disaster risk data |
| Census demographics | Yes | Home age, ownership rate, income |
| Street View + Satellite Maps | Yes | Mapbox integration |
| SMS composer | **UI Only** | Uses `window.open('sms:...')` — no Twilio backend |

**Issues:** 10 silent catch blocks. SMS composer is pass-through to native device SMS. 2,921-line component — largest in app.

---

### 7. Estimates (`/estimates`)
**Component:** EstimatesView.jsx (2,778 lines, +26 from insurance auto-calcs) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Estimate list with KPI stats | Yes | Total, Draft, Sent, Accepted counts/values |
| Create/Edit builder | Yes | Rich multi-section editor |
| Line items editor with drag-and-drop | Yes | Description, qty, unit price |
| Rich text editor | Yes | Bold, italic, underline, lists, links |
| Section image uploader | Yes | Per-section images |
| Tax rate + discounts | Yes | Preset tax rates, discount management |
| Multi-signer authorization | Yes | Signers section |
| Profit margin input | Yes | Margin calculation |
| Financing options toggle | Yes | Hearth plan selection |
| Template system | Yes | Save/load templates |
| Review mode with live preview | Yes | Edit/preview toggle |
| Send for signing (email) | Yes | Email template selector |
| SRS Catalog material selection | Yes | Integration |
| Duplicate estimate | Yes | Clone existing |
| AI tier generation (Good/Better/Best) | Yes | Auto-generates tiers |
| Tier comparison modal | Yes | Side-by-side view |
| Estimate-to-invoice conversion | Yes | Via InvoicesView |
| Server-side PDF generation | Yes | pdfmake branded PDF with download |
| In-person signing | Yes | Canvas signature modal |
| Insurance details toggle | Yes | Company, claim number, date of loss |
| Optional upgrades section | Yes | Add/remove upsells |
| **LAUNCH MEASUREMENT TOOL button (FIXED)** | Yes | Now shows guidance toast (was dead button) |
| **Insurance auto-calculations (NEW)** | Yes | Depreciation = RCV - ACV, "Ins. Pays" and "Customer Owes" computed fields |

**Issues:** 1 silent catch block.

---

### 8. Invoices (`/invoices`)
**Component:** InvoicesView.jsx (1,173 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Invoice list with KPI stats | Yes | Total Invoiced, Collected, Outstanding, Overdue |
| A/R aging summary (5 buckets) | Yes | Current, 1-30, 31-60, 61-90, 91+ days |
| Filter tabs (All/Draft/Sent/Paid/Overdue) | Yes | Status filtering |
| Invoice builder with line items | Yes | Combobox, qty, unit price |
| Lead/customer selector | Yes | Autocomplete search |
| Due date picker | Yes | DatePicker component |
| Preview mode | Yes | Formatted view |
| Send via email | Yes | Email input modal |
| Record payment | Yes | 7 methods, quick-fill buttons, reference notes |
| Void invoice | Yes | Status update |
| Create from estimate | Yes | EstimatePicker modal |
| Automated invoice reminders | **NO** | Migration 044 exists, no cron/UI |

**Issues:** 1 silent catch block. Invoice reminder migration exists but zero implementation.

---

### 9. Contracts (`/contracts`)
**Component:** ContractsView.jsx (641 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Contract list with KPI stats | Yes | Total, Drafts, Awaiting Signature, Signed |
| Status filter (5 statuses) | Yes | Dropdown |
| Template selector | Yes | Pre-built templates |
| Section editor (add/remove/edit) | Yes | Title + body per section |
| Merge field support | Yes | Token replacement |
| Preview mode | Yes | Toggle view |
| Send / Void | Yes | Draft-only send |
| Create from estimate/lead | Yes | Pre-fills from URL params |
| PDF export | Yes | pdfmake branded PDF |

**Issues:** 3 silent catch blocks. Signature in preview is static placeholder.

---

### 10. Work Orders (`/work-orders`)
**Component:** WorkOrdersView.jsx (1,166 lines, +20 from PDF export) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| 4-column kanban (Pending/Scheduled/In Progress/Completed) | Yes | Drag-and-drop |
| Cards with milestone progress bar | Yes | Title, crew, date, address |
| Detail modal (full CRUD) | Yes | All editable fields |
| Milestone checklist | Yes | Add/delete/toggle |
| Photo upload per milestone | Yes | Camera badge, retake |
| Photo-required enforcement | Yes | Prevents completion without photo |
| Editable line items | Yes | Add/remove, running total |
| 8 milestone templates | Yes | Shingle, Metal, Gutter, etc. |
| Create from estimate | Yes | EstimatePicker modal |
| Team member assignment | Yes | CustomSelect |
| **PDF export (NEW)** | Yes | Backend pdfmake with milestones, line items, crew info; frontend download button with toast feedback |

**Issues:** 4 silent catch blocks. Photo upload doesn't validate file size.

---

### 11. Materials (`/materials`)
**Component:** MaterialsView.jsx (1,007 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Product catalog with search | Yes | Text search input |
| Category filter (13 categories) | Yes | Animated indicator |
| Product grid with cards | Yes | Click for detail |
| Product detail modal | Yes | Qty selector, add to cart |
| Cart sidebar | Yes | Qty +/-, remove, branch selector |
| Orders tab | Yes | Order history |
| SRS Catalog integration | Yes | Material supplier integration |

**Issues:** Cart doesn't persist in localStorage. SRS hardcoded as only supplier.

---

### 12. Tasks (`/tasks`)
**Component:** TasksView.jsx (827 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Task list with Pending/Completed tabs | Yes | Count badges |
| Overdue/Due Today counts | Yes | Summary header |
| Task completion checkbox | Yes | Optimistic updates |
| Create/Edit task modal | Yes | Title, description, due date, priority |
| Priority badges (Hot/Warm/Cold) | Yes | Color-coded |
| Mobile "Mission Log" view | Yes | Tactical theme |

---

### 13. Calendar (`/calendar`)
**Component:** CalendarView.jsx (323 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| FullCalendar (month/week/day/list views) | Yes | @fullcalendar/react |
| Event type badges | Yes | Task/Call/Email/Door Knock |
| Click event -> navigate to lead | Yes | Opens lead detail |
| Drag-to-reschedule (tasks) | Yes | Updates due_date |
| Click-to-create | Yes | CalendarCreateModal |
| Empty state | Yes | Helpful message |

---

### 14. Canvassing (`/canvassing`)
**Component:** CanvassingMode.jsx (753 lines, +68 from pin upgrades) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Google Maps with dark styling | Yes | Hybrid view |
| Stats bar (Total doors, Interested, Scheduled) | Yes | Glass card overlay |
| Drop Pin mode | Yes | Crosshair cursor, tap to place |
| Bottom sheet modal | Yes | Slide-up create/view |
| GPS coordinate display | Yes | On new pin |
| Outcome quick-select (6 options) | Yes | 2-column grid |
| Notes textarea | Yes | Free text |
| Convert to Lead button | Yes | For interested/scheduled pins |
| Territory Manager panel | Yes | Toggle visibility |
| Marker click -> view details | Yes | Read-only details |
| **Color-coded teardrop SVG pins (NEW)** | Yes | Unique colors per outcome type — interested (green), not interested (red), not home (amber), scheduled (blue), follow up (cyan), other (gray) |
| **Outcome legend (NEW)** | Yes | Collapsible panel showing all outcome colors and counts |
| **Analytics section (NEW)** | Yes | Conversion rate, contact rate, interest rate metrics |

---

### 15. Territory Manager (within Canvassing)
**Component:** TerritoryManager.jsx | **Status:** Functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Territory CRUD | Yes | Name, description, color, assignee |
| PostGIS polygon drawing | Yes | Draw on map, coordinates saved |
| Territory list with colors | Yes | Visual distinction |
| Assign to team member | Yes | Dropdown |

---

### 16. Subcontractors (`/subcontractors`)
**Component:** SubcontractorsView.jsx (342 lines) | **Status:** Fully functional

All features working — table, search, filters, CRUD, specialty/status badges. No issues.

---

### 17. Reports (`/reports`)
**Component:** ReportsView.jsx (665 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Revenue chart (area) | Yes | Estimated vs actual with comparison |
| Pipeline chart (horizontal bar) | Yes | Leads by stage, drill-down |
| Conversion chart (radar) | Yes | Rates by source |
| Rep leaderboard (sortable table) | Yes | Leads, closed, revenue, activities |
| Lead sources pie chart (donut) | Yes | Drill-down to filtered leads |
| Stage duration chart (line) | Yes | Average days per stage |
| Date presets + custom range | Yes | Quick select + DatePicker |
| Comparison period toggle | Yes | Delta badges + percentages |
| CSV export on all charts | Yes | Download buttons |
| Chart drill-down | Yes | Click to navigate to filtered leads |

**Issues:** 9 silent catch blocks.

---

### 18. Content Studio — **REMOVED**
**Previously:** ContentStudio.jsx (885 lines) at `/content-studio`
**Status:** Deleted in checkpoint commit 768f403. Component, backend route (`content.js`), service (`contentService.js`), 285 lines of CSS, and sidebar nav link all removed.
**DB migration 046 (content_library table):** Still exists in database but orphaned.
**Reason:** Likely removed due to non-functional OpenAI integration (backend queued but didn't return results).

---

### 19. Expenses (`/expenses`)
**Component:** ExpensesView.jsx (420 lines) | **Status:** Fully functional

All features working — KPI summary, filters, table, CRUD modal. No batch operations or CSV export.

---

### 20. Settings (`/settings`)
**Component:** SettingsView.jsx (2,877 lines) | **Status:** Fully functional, 15 tabs

| Tab | Works? | Features |
|-----|--------|----------|
| Profile | Yes | Edit first/last name, email, phone, avatar |
| Company | Yes | Sender email, company name, phone, website, address, logo |
| Billing | Yes | Plan selection, feature comparison, card mgmt, invoice history |
| Payments | Yes | Stripe Connect, onboarding, payment history |
| Team | Yes | Member list, invite, role management, delete |
| Alerts | Yes | Storm alert configuration |
| Notifications | Yes | 10-category preference toggles |
| Email/SMTP | Yes | SMTP server config, test email |
| Financing | **Partial** | "Mock (Testing)" still in provider dropdown |
| Automations | Yes | Workflow automation CRUD |
| Drip Sequences | Yes | Step builder, enrollment, scheduling |
| Custom Fields | Yes | CRUD for field definitions |
| Contracts | Yes | Contract template management |
| Reviews | Yes | Google Place ID, review message template |
| Pricing/Line Items | Yes | Line item catalog, section grouping |

**Issues:** 9 silent catch blocks. "Mock (Testing)" financing provider. Stripe publishable key falls back to empty string.

---

### 21. Admin Dashboard (`/admin`)
**Component:** AdminDashboard.jsx (1,000 lines) | **Status:** Functional (super_admin only)

Overview stats, tenants table, tenant detail management, revenue tab, usage leaderboard. 5 silent catch blocks.

---

### 22-24. Public Pages

**PublicEstimate** — 718 lines, fully functional (e-sign, payment, financing)
**PublicContract** — 225 lines, functional (sections, signature canvas)
**ClientStatusPage** — 426 lines, functional (progress timeline, milestones)

---

### 25-27. Auth & Utility Pages

**LoginPage** (89 lines) — **SECURITY: Hardcoded real credentials** (email: `waterlooconstruction1@gmail.com`, password: `2Wealth&health`, tenant: `waterloo`) in default state
**RegisterPage** (132 lines) — Clean implementation
**OnboardingPage** (984 lines) — 5-step wizard, fully functional

---

## Backend Summary

**Total route files:** 37 (down from 39 — content.js removed, contentService.js removed)
**Total endpoints:** ~275 (down from ~280 — content endpoints removed)
**Database migrations:** 48 (unchanged)

| Module | Prefix | Endpoints |
|--------|--------|-----------|
| crm.js | /api/crm | ~57 |
| properties.js | /api/properties | 18 |
| estimates.js | /api/estimates | 17 |
| financing.js | /api/crm/financing | 13 |
| contracts.js | /api/crm/contracts | 12 |
| workOrders.js | /api/crm/work-orders | 12 (+1 PDF) |
| skipTrace.js | /api/skip-trace | 10 |
| materials.js | /api/materials | 9 |
| drip.js | /api/crm/drip-sequences | 8 |
| invoices.js | /api/crm/invoices | 8 |
| roofMeasurement.js | /api/roof-measurement | 8 |
| subcontractors.js | /api/crm/subcontractors | 8 |
| onboarding.js | /api/onboarding | 7 |
| payments.js | /api/payments | 7 |
| admin.js | /api/admin | 6 |
| reports.js | /api/crm/reports | 6 |
| notifications.js | /api/notifications | 6 |
| territories.js | /api/crm/territories | 6 |
| leads.js | /api/leads | 6 |
| auth.js | /api/auth | 5 |
| automations.js | /api/crm/automations | 5 |
| canvassing.js | /api/crm/canvass-pins | 5 |
| expenses.js | /api/crm/expenses | 5 |
| drift.js | /api/drift | 5 |
| alerts.js | /api/alerts | 4 |
| counties.js | /api/counties | 4 |
| dashboard.js | /api/dashboard | 3 |
| dataApis.js | /api/data | 3 |
| documents.js | /api/documents | 3 |
| map.js | /api/map | 3 |
| stormHistory.js | /api/storm-history | 2 |
| storms.js | /api/storms | 2 |
| hearthWebhook.js | /api/webhooks/hearth | 1 |
| disasterDeclarations.js | /api/disaster-declarations | 1 |
| search.js | /api/search | 1 |
| webhook.js | /api/webhooks | 1 |

### Scheduled Tasks (9 cron jobs — unchanged)

| Job | Frequency | Status |
|-----|-----------|--------|
| MRMS hail ingestion | Every 30 min | Active |
| NWS alerts | Every 1 hour | Active |
| SPC hail reports | Every 2 hours | Active |
| Storm area auto-import | 3x/day | Active |
| Monthly batch billing | 1st of month | Active |
| Drip sequence processing | Every 15 min | Active |
| Overdue invoice reminders | Daily 9am | Active |
| Stale lead alerts | Daily 8am | Active |
| Daily cleanup (storms >30d) | Daily 3am | Active |

---

## Competitor Feature Matrix Cross-Reference

Cross-referencing `docs/competitor-gap-analysis.md` (2026-03-25 matrix) against actual code as of 2026-04-08:

| Feature | Matrix Status (Mar 25) | Actual Status (Apr 8) | Notes |
|---------|----------------------|----------------------|-------|
| **CRM & Pipeline** ||||
| Kanban pipeline | Match | OK | 3 boards, drag-drop, sidebar preview |
| Pipeline deal values | Not in matrix | Built | Cards show estimated_value, column totals |
| Contact management | Match | OK | Full CRUD with activities |
| Lead source tracking | Match | OK | Source field, filter, reports |
| Custom fields | Better | OK | Free, unlimited, 7+ field types |
| Global search (Cmd-K) | Match | OK | TopBar GlobalSearch |
| Lead scoring | Not in matrix | Built | 7-factor algorithm, badges, breakdown |
| Days-in-stage analytics | Not in matrix | Built | Dashboard cards + pipeline badges |
| Stale lead alerts | Not in matrix | Built | Dashboard panel + daily cron |
| **Speed-to-Lead metric** | Not in matrix | **Built (NEW)** | Avg response time, color-coded badges |
| **Sales & Estimating** ||||
| Estimate builder | Better | OK | Rich text, tiers, financing, templates |
| Server-side PDF | Not in matrix | Built | pdfmake branded PDF generation |
| Estimate templates | Match | OK | Template CRUD |
| E-signature | Match | OK | Canvas-based on public pages |
| In-person signing | Not in matrix | Built | Route + canvas modal |
| Estimate-to-invoice | Match | OK | EstimatePicker in InvoicesView |
| AI tier generation | Not in matrix | Built | Good/Better/Best auto-generation |
| Insurance claim fields | Not in matrix | Built | Company, claim #, date of loss |
| Optional upgrades/upsells | Not in matrix | Built | Add/remove with pricing |
| **Insurance auto-calcs (NEW)** | Not in matrix | **Built** | Depreciation, "Ins. Pays", "Customer Owes" |
| **Invoicing & Payments** ||||
| Invoicing | Match | OK | Full builder + A/R aging |
| Online payments | Better | OK | Stripe Card + ACH, free |
| Payment recording | Not in matrix | Built | 7 methods, quick-fill, reference notes |
| Financing | Match | OK | Hearth integration |
| QuickBooks sync | **Missing** | **Still Missing** | No QB integration |
| Next-day funding | **Missing** | **Still Missing** | No implementation |
| Invoice reminders | Not in matrix | **DB only** | Migration 044 exists, no cron/UI |
| **Scheduling & Tasks** ||||
| Calendar | Match | OK | FullCalendar with drag-reschedule |
| Calendar click-to-create | Not in matrix | Built | dateClick + task creation modal |
| Task management | Match | OK | CRUD, priority, due dates |
| Work orders kanban | Better | OK | 4-column + milestones + photos |
| **Work order PDF export (NEW)** | Not in matrix | **Built** | pdfmake with milestones, line items, crew |
| **Storm Data & Maps** ||||
| Hail/wind/tornado maps | Better | OK | NOAA, free, multi-layer |
| Severity color graduation | Not in matrix | Built | All 3 types |
| Real-time storm alerts | Better | OK | Free alerting |
| Weather history reports | Better | OK | 10-year SWDI, PDF export |
| Honey Hole Finder | Missing in matrix | Built | NOAA SWDI heatmap overlay |
| Calendar-based storm search | Not in matrix | Built | Date range picker on Storm Archive |
| **Canvassing** ||||
| GPS-verified pins | Match | OK | Geolocation on pin drop |
| Territory/region assignment | Missing in matrix | Built | PostGIS polygons + assignment |
| Generate list from storm map | Not in matrix | Built | Storm properties → canvass pins |
| **Color-coded teardrop pins (NEW)** | Not in matrix | **Built** | SVG teardrops per outcome type |
| **Outcome legend + analytics (NEW)** | Not in matrix | **Built** | Conversion/contact/interest rates |
| **Automation & Reporting** ||||
| Workflow automations | Better | OK | Unlimited, free |
| Reports/analytics | Match | OK | 6 chart types + comparison + drill-down |
| Profit tracker per job | Match | OK | Estimate - expenses in LeadDetail |
| Drip sequences | Not in matrix | Built | 15-min cron, auto-enrollment |
| **Communication** ||||
| SMS texting | **Missing** | **Still Missing** | Native `window.open('sms:')` only |
| Email integration | Worse | Partial | SMTP + drip, no inbox/thread view |
| AI phone answering | **Missing** | **Still Missing** | Not feasible cheaply |
| Automated review requests | Missing in matrix | Built | Google review link |
| **AI Features** ||||
| AI content/marketing | Missing in matrix | **REMOVED** | Content Studio deleted 2026-04-08 |
| AI roof measurements | **Missing** | Partial | RoofDrawingTool exists, not satellite |
| Solar analysis | **Missing** | Partial | Google Solar API in LeadDetail |
| **Other** ||||
| Photo annotation | Missing in matrix | Built | PhotoAnnotator canvas |
| Subcontractor mgmt | Missing in matrix | Built | Full CRUD + assignment |
| Contract PDF generation | Not in matrix | Built | pdfmake branded PDF export |
| Material ordering | **Missing** | Partial | SRS catalog, single supplier |
| Mobile app (native) | **Missing** | **Still Missing** | PWA only |
| Document management | Match | OK | Upload, delete, annotate |
| Team management | Match | OK | Invite, roles, delete |

---

## Code Quality Issues

### Silent Error Handling — 55 occurrences across 17 files (UP from ~25)

| File | Count | Notes |
|------|-------|-------|
| LeadDetail.jsx | 10 | Largest concentration |
| SettingsView.jsx | 9 | Settings tab loads |
| ReportsView.jsx | 9 | Chart data loads (was 3, now 9) |
| AdminDashboard.jsx | 5 | Tenant/usage loads |
| Pipeline.jsx | 4 | Team/data fetches (new from refactor) |
| WorkOrdersView.jsx | 4 | Milestone/team loads |
| ContractsView.jsx | 3 | Template/estimate loads |
| Dashboard.jsx | 2 | Team/leads fetches |
| EstimatesView.jsx | 1 | |
| InvoicesView.jsx | 1 | |
| LeadList.jsx | 1 | |
| StormMap.jsx | 1 | |
| StormCatalog.jsx | 1 | |
| TopBar.jsx | 1 | |
| PublicEstimate.jsx | 1 | |
| PublicContract.jsx | 1 | |
| ClientStatusPage.jsx | 1 | |

### Security Concerns
- **LoginPage.jsx: REAL credentials hardcoded** — email (`waterlooconstruction1@gmail.com`), password (`2Wealth&health`), tenant slug (`waterloo`) as default state values
- **SettingsView.jsx:** "Mock (Testing)" financing provider still in production dropdown
- **SettingsView.jsx:** Stripe publishable key falls back to empty string

### Large Component Files (refactoring candidates)
- LeadDetail.jsx: 2,921 lines
- SettingsView.jsx: 2,877 lines
- StormMap.jsx: 2,856 lines
- EstimatesView.jsx: 2,778 lines
- Dashboard.jsx: 1,740 lines
- Pipeline.jsx: 1,495 lines

### Orphaned Database Artifacts
- Migration 046 (content_library table) — frontend + backend deleted, DB table orphaned
- Migration 044 (invoice_reminders) — `last_reminder_at` column exists, no implementation

### Incomplete Features
- Invoice reminders — migration 044 exists, no cron job or UI
- SMS sending — composer UI exists in LeadDetail, no Twilio backend
- Contract signing in preview — static placeholder, signing only works on public page
- Speed-to-Lead — backend query exists but stat card shows "—" as default (may work with real activity data)

---

## Summary Statistics

| Metric | 2026-04-06 | 2026-04-07 | 2026-04-08 | Change |
|--------|------------|------------|------------|--------|
| Protected routes | 22 | 22 | 21 | -1 (content-studio) |
| Public routes | 6 | 6 | 6 | --- |
| Backend route files | 39 | 39 | 37 | -2 (content.js, contentService.js) |
| Backend endpoints | 279 | ~280 | ~275 | -5 (content) +1 (WO PDF) |
| DB migrations | 47 | 49 | 48 | -1 (recount; was 48 all along) |
| Sidebar nav items | 17 | 17 | 16 | -1 (Content Studio) |
| Settings tabs | 15 | 15 | 15 | --- |
| Silent catch blocks | ~25 | ~25 | ~55 | +30 (Pipeline refactor added, ReportsView increased) |
| Cron jobs | 9 | 9 | 9 | --- |
| External API integrations | 12 | 12 | 11 | -1 (OpenAI removed with Content Studio) |
| Features "Missing" in matrix but actually built | 10 | 14 | 17 | +3 (speed-to-lead, WO PDF, canvassing analytics) |
| Features still truly missing vs competitors | 4 | 4 | 4 | QB, SMS, Native app, AI Phone |

---

## Top 10 Improvement Opportunities

Ranked by competitive impact, user value, and feasibility:

### 1. QuickBooks Sync — CRITICAL COMPETITIVE GAP
**Impact:** High (JobNimbus + RoofLink both have it; contractors expect it for accounting)
**Effort:** Medium (QB API has free tier for small apps)
**Current state:** Zero implementation. No QB route files, no OAuth flow.
**What to build:** OAuth connection in Settings, one-way invoice push to QBO, optional payment sync back.

### 2. SMS/Texting Integration — CRITICAL COMPETITIVE GAP
**Impact:** High (JobNimbus charges $49-249/mo; contractors expect texting)
**Effort:** Medium (Twilio ~$0.0075/msg, pass-through cost)
**Current state:** SMS composer uses native `window.open('sms:')`. No app-level sending.
**What to build:** Twilio adapter, wire existing SMS composer, appointment reminders via drip, conversation thread view.

### 3. Silent Error Handling Epidemic — 55 OCCURRENCES (doubled since yesterday)
**Impact:** Medium-High (users get zero feedback when 55 different operations fail)
**Effort:** Medium (systematic, 17 files)
**Current state:** Pipeline refactor and ReportsView changes added ~30 new silent catch blocks. LeadDetail (10) and SettingsView (9) remain worst offenders.
**What to fix:** Replace with toast notifications on user-initiated actions. Keep silent only for background polling that has explicit fallback data.

### 4. Hardcoded Real Credentials in LoginPage — SECURITY RISK
**Impact:** High (real email + real password exposed in client-side source code)
**Effort:** Trivial (empty the default state values)
**Current state:** `useState('waterlooconstruction1@gmail.com')` and `useState('2Wealth&health')` are visible in production bundle.
**What to fix:** Set all default values to empty strings. Use environment variables or dev-only conditions if test defaults are needed.

### 5. Content Studio Replacement / AI Marketing — REGRESSION
**Impact:** Medium-High (was a competitive feature vs Rooftops.ai; now fully removed)
**Effort:** High (requires working LLM integration)
**Current state:** Entire Content Studio feature deleted — component, route, service, CSS, nav link. DB table orphaned.
**Decision needed:** Either rebuild with working LLM backend, or clean up orphaned migration. Rooftops.ai offers AI content for $12/mo — StormLeads had this and lost it.

### 6. Invoice Automated Reminders — DB MIGRATION WITHOUT IMPLEMENTATION
**Impact:** Medium-High (reduces AR aging, auto-reminds customers on overdue invoices)
**Effort:** Low-Medium (migration 044 exists; needs cron job + email templates)
**Current state:** `last_reminder_at` column exists in DB. No cron job, no settings UI.
**What to build:** Cron job (reuse drip pattern), 3/7/14 day overdue email templates, toggle in Settings.

### 7. Multi-Page Estimate Proposals — QUALITY GAP vs SumoQuote
**Impact:** High (professional estimates with cover page + scope + terms are industry standard)
**Effort:** Medium-High
**Current state:** Single-page estimate builder. No multi-page template structure.
**What to build:** Estimate page types (cover, scope, detail, terms, signing), page reordering.

### 8. Email Inbox / Thread View — WORSE THAN COMPETITORS
**Impact:** Medium-High (JobNimbus has full email integration)
**Effort:** High (needs IMAP integration or third-party email sync)
**Current state:** Can send emails via SMTP and drip sequences. No inbound viewing.
**What to build:** At minimum, email activity log with sent email history.

### 9. Orphaned DB Artifacts — TECHNICAL DEBT
**Impact:** Low-Medium (confusion, wasted storage)
**Effort:** Trivial
**Current state:** content_library table (migration 046) has no frontend or backend code. invoice_reminders columns (migration 044) have no implementation.
**What to fix:** Either implement the features or create cleanup migrations.

### 10. "Mock (Testing)" Financing Provider + Empty Stripe Key — PRODUCTION POLISH
**Impact:** Low-Medium (confusing to users in production)
**Effort:** Trivial
**What to fix:** Remove "Mock (Testing)" from financing provider options. Add Stripe key validation.

---

## Appendix: Features Built Since Competitor Matrix (2026-03-25)

Features that were marked **Missing** or **Worse** in the original matrix but have since been built:

1. Honey Hole Finder (NOAA SWDI heatmap) — Built
2. Territory/region assignment (PostGIS polygons) — Built
3. Photo annotation (PhotoAnnotator canvas) — Built
4. Subcontractor management (full CRUD) — Built
5. Automated review requests (Google review link) — Built
6. Profit tracker per job (LeadDetail expenses) — Built
7. In-person estimate signing (canvas modal) — Built
8. Payment recording (7 methods, quick-fill) — Built
9. Calendar click-to-create (task modal) — Built
10. Contract PDF generation (pdfmake) — Built
11. Days-in-stage analytics (dashboard + pipeline) — Built
12. Insurance claim fields on estimates — Built
13. Optional upgrade/upsell items — Built
14. Calendar-based storm archive search — Built
15. Stale lead alerts (dashboard + cron) — Built
16. Speed-to-Lead metric (dashboard KPI) — Built (2026-04-08)
17. Work order PDF export (pdfmake) — Built (2026-04-08)
18. Color-coded canvassing pins with analytics — Built (2026-04-08)
19. Insurance auto-calculations on estimates — Built (2026-04-08)
20. Measurement button guidance toast — Fixed (2026-04-08)

**Features LOST:**
- AI Content Studio (7 content types, batch mode, library) — **REMOVED** (2026-04-08)

**Remaining truly missing (cannot easily build for free):**
1. QuickBooks sync — needs QB API OAuth
2. SMS texting — needs Twilio (~$20-50/mo)
3. Native mobile app — high dev cost (PWA exists)
4. AI phone answering — needs telephony + LLM ($$$)
