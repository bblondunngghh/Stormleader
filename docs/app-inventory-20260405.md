# StormLeads App Inventory — 2026-04-05

**Method:** Full source code analysis of all 22 protected routes, 6 public routes, 37 backend route files (279 endpoints), sidebar navigation, and database migrations. Builds on 2026-04-04 inventory with verification of all changes since.
**Firecrawl:** 0 credits remaining — inventory is code-based (no live screenshots).
**Changes since last inventory (2026-04-04):** 1 commit (checkpoint), 1 new service function (signEstimateInPerson — backend only, no route).

---

## What Changed Since 2026-04-04

| Change | Commit | Impact |
|--------|--------|--------|
| In-person estimate signing service function | 0d46a9d (uncommitted in prior run) | `signEstimateInPerson()` in estimateService.js — **NO route wired, unreachable via API** |
| Playwright audit test results | 0d46a9d | 11 test screenshots + error-context files in tests/ |

**Net feature change:** Zero user-facing features added since 2026-04-04. The in-person signing function is complete in the service layer but has no API route, no frontend UI, and cannot be called.

---

## Navigation Structure

### Sidebar (Desktop) — 17 items
**Top-level (5):** Dashboard, Storm Map, Storm Archive, Pipeline, Leads
**Jobs group (4):** Estimates, Contracts, Work Orders, Materials
**Finance group (2):** Invoices, Expenses
**Operations group (6):** Tasks, Calendar, Canvassing, Subcontractors, Reports, Content Studio
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
**Component:** Dashboard.jsx (1,636 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) | Yes | Animated count-up, clickable navigation |
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
| Loading skeletons | Yes | Shimmer animation |

**API Calls:** 10+ dashboard endpoints + storms + team + leads (lazy-loaded)
**Issues:** 2 silent `.catch(() => {})` — no user feedback on API failures. Dynamic lazy import of getTeamMembers and getLeads.

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
- Uses `alert()` for canvassing list success instead of Toast
- Multiple `.catch(() => {})` with no user feedback on API failures
- Extremely large component (2,856 lines) — refactoring candidate
- Some hidden controls in DOM (`display: none`) — incomplete refactoring

---

### 3. Storm Archive (`/storm-catalog`)
**Component:** StormCatalog.jsx (312 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Storm cards grid (responsive auto-fill) | Yes | Min 280px cards |
| Time range filter (24h/3d/7d/14d/30d) | Yes | 5 pill buttons |
| Text search | Yes | Real-time filtering |
| Type filter (All/Hail/Wind/Tornado) | Yes | Pill buttons |
| Sort options (Date/Severity/Hail Size/Wind) | Yes | 4 sort buttons |
| 5-star severity rating | Yes | Calculated from hail/wind data |
| Severity label + color badge | Yes | Minor to Extreme |
| "DAMAGE LIKELY" badge | Yes | For hail >= 1.5" |
| Click-to-navigate to storm map | Yes | Centers map on storm |
| Result count display | Yes | With pluralization |

**Issues:** Silent geocoding failures (empty catch blocks), no request throttling.

---

### 4. Pipeline (`/pipeline`)
**Component:** Pipeline.jsx (1,519 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Kanban board with drag-and-drop | Yes | HTML5 drag API, optimistic updates |
| 3 board tabs (Sales/Production/Billing) | Yes | Stage filtering by workflow phase |
| Deal value on cards | Yes | Shows formatted estimated_value or "---" |
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
| Grab-to-pan horizontal scroll | Yes | Manual scrolling |
| Sidebar lead preview | Yes | Stage change UI, activity feed |

**Issues:** Uses HTML5 drag API (limited mobile touch support, not @dnd-kit). Board definitions hardcoded (not configurable). Silent catch blocks.

---

### 5. Leads (`/leads`)
**Component:** LeadList.jsx (790 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Data table with 16 columns | Yes | Stage, Priority, Score, Address, Contact, Phone, Email, Source, Storm Date, Est. Value, Rep, Last Contact, Follow-up, Days in Stage, Created |
| Column sorting with direction toggle | Yes | Ascending/descending arrows |
| Search bar with 350ms debounce | Yes | URL-synced |
| Quick filters (Hot Leads, Needs Follow-up, Unassigned) | Yes | Preset buttons |
| Advanced filters (Stage, Priority, Source, Score) | Yes | Active filter pills |
| Saved filter presets | Yes | localStorage-backed save/load/delete |
| Bulk actions (Change Stage, Assign Rep) | Yes | Checkbox selection + CustomSelect |
| CSV export | Yes | Formatted download |
| CSV import | Yes | ImportLeadsModal with Census geocoding |
| Pagination (25/50/100 per page) | Yes | Page size selector + prev/next |
| URL-synced filters | Yes | Shareable filtered views |

**Issues:** None identified.

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
| SMS composer | Yes | Template-based SMS (sends nothing — no Twilio) |

**Issues:** 9 silent `.catch(() => {})` blocks. 2,921-line component — largest in the app. Legacy mock data support comment. SMS composer is UI-only (no backend sending).

---

### 7. Estimates (`/estimates`)
**Component:** EstimatesView.jsx (2,408 lines) | **Status:** Fully functional

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
| In-person signing | **NO** | Backend function exists but NO route, NO UI |

**Issues:** 3 silent catches. "LAUNCH MEASUREMENT TOOL" button is promotional stub (no handler). Tier detection uses fragile regex on notes field.

---

### 8. Invoices (`/invoices`)
**Component:** InvoicesView.jsx (1,081 lines) | **Status:** Mostly functional

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
| Record payment | **STUB** | `setShowPaymentModal` exists but modal never renders |
| Void invoice | Yes | Status update |
| Create from estimate | Yes | EstimatePicker modal |

**Issues:** Payment recording modal state exists but UI is missing — clicking "Record Payment" does nothing visible. 2 silent catches.

---

### 9. Contracts (`/contracts`)
**Component:** ContractsView.jsx (604 lines) | **Status:** Fully functional

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
| PDF export | **NO** | Unlike estimates, contracts have no PDF generation |

**Issues:** 3 silent `.catch(() => {})`. No required field validation before save/send. Signature block in preview is static placeholder.

---

### 10. Work Orders (`/work-orders`)
**Component:** WorkOrdersView.jsx (1,146 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| 4-column kanban (Pending/Scheduled/In Progress/Completed) | Yes | Drag-and-drop |
| Cards with milestone progress bar | Yes | Title, crew, date, address |
| Detail modal (full CRUD) | Yes | All editable fields |
| Milestone checklist | Yes | Add/delete/toggle |
| Photo upload per milestone | Yes | Camera badge, retake |
| Photo-required enforcement | Yes | Prevents completion without photo |
| Editable line items | Yes | Add/remove, running total |
| 8 milestone templates | Yes | Shingle, Metal, Gutter, Siding, Storm Damage, Inspection, Flat Roof, Window/Door |
| Create from estimate | Yes | EstimatePicker modal |
| Team member assignment | Yes | CustomSelect |

**Issues:** Minor `item.description` vs `item.name` inconsistency. 3 silent catches. Photo URL API response inconsistency (`url` vs `file_url`).

---

### 11. Materials (`/materials`)
**Component:** MaterialsView.jsx (1,007 lines) | **Status:** Mostly functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Product catalog with search | Yes | Text search input |
| Category filter (13 categories) | Yes | Animated indicator |
| Product grid with cards | Yes | Click for detail |
| Product detail modal | Yes | Qty selector, add to cart |
| Cart sidebar | Yes | Qty +/-, remove, branch selector |
| Orders tab | Yes | Order history |
| SRS Catalog integration | Yes | Material supplier integration |
| Order detail view | **STUB** | `selectedOrder` state set but modal never renders |

**Issues:** 3 silent catches. SRS hardcoded as only supplier.

---

### 12. Tasks (`/tasks`)
**Component:** TasksView.jsx (827 lines) | **Status:** Functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Task list with Pending/Completed tabs | Yes | Count badges |
| Overdue/Due Today counts | Yes | Summary header |
| Task completion checkbox | Yes | Fixed (was hardcoded) |
| Create/Edit task modal | Yes | Title, description, due date, priority |
| Priority badges (Hot/Warm/Cold) | Yes | Color-coded |
| Assignee display | Yes | On task rows |
| Mobile "Mission Log" view | Yes | Tactical theme |
| Mobile efficiency metrics | Yes | Completion rate + critical path velocity |

**Issues:** 4 silent catches. Overdue/today calculations not memoized.

---

### 13. Calendar (`/calendar`)
**Component:** CalendarView.jsx (149 lines) | **Status:** Functional, very lightweight

| Feature | Works? | Notes |
|---------|--------|-------|
| FullCalendar (month/week/day/list views) | Yes | @fullcalendar/react |
| Event type badges | Yes | Task/Call/Email/Door Knock |
| Priority badges | Yes | Color-coded |
| Click event -> navigate to lead | Yes | Opens lead detail |
| Drag-to-reschedule (tasks) | Yes | Updates due_date |
| Now indicator | Yes | Current time line |
| Click-to-create | **NO** | Cannot create tasks/events from empty calendar slot |
| Event creation form | **NO** | No way to create new events from calendar page |

**Issues:** Thinnest component in the app (149 lines). No dateClick handler. No error toast on drag failure (console.error only). No "no events" empty state.

---

### 14. Canvassing (`/canvassing`)
**Component:** CanvassingMode.jsx (686 lines) | **Status:** Fully functional

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

**Issues:** Silent geolocation failure (attempts once with 8-second timeout). 2 silent catches.

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

| Feature | Works? | Notes |
|---------|--------|-------|
| Subcontractor table | Yes | Name, company, specialty, phone, email, rate, status |
| Search, specialty, status filters | Yes | Text + 2 dropdowns |
| Pagination with page size | Yes | Prev/next buttons |
| Add/Edit slide-over panel | Yes | Full form with phone auto-formatting |
| Delete with confirmation | Yes | Hover-reveal buttons |
| Specialty + status badges | Yes | Color-coded |

**Issues:** Status field not shown during creation (only on edit). Phone doesn't validate 10-digit requirement. Hourly rate allows negative numbers until save.

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
| Date presets (Week/Month/Quarter/Year/All-Time) | Yes | Quick select |
| Custom date range picker | Yes | DatePicker start/end |
| Comparison period toggle | Yes | Delta badges + percentages |
| CSV export on all charts | Yes | Download buttons |
| Chart drill-down | Yes | Click to navigate to filtered leads |

**Issues:** 6 silent catches. No user feedback when reports fail to load. Possible timezone issues in period comparison calculation.

---

### 18. Content Studio (`/content-studio`)
**Component:** ContentStudio.jsx (835 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Generate tab with settings | Yes | Type + tone dropdowns |
| 7 content types | Yes | Social posts, door hangers, emails, blog outlines, ad copy, cold call scripts, landing pages |
| 10 variable input fields | Yes | Company, city, storm date, hail size, etc. |
| Batch mode (5 variations) | Yes | Toggle checkbox |
| Live preview panel | Yes | Facebook, email, door hanger, blog mockups |
| Results grid with copy/save/delete | Yes | Card-based layout |
| Library tab with saved content | Yes | Database-backed (migrated from localStorage) |
| Search + type filter in library | Yes | Real-time filtering |
| Library item count badge | Yes | On tab label |
| Cross-device sync | Yes | Database persistence |

**Issues:** Migration logic runs on every mount (could be optimized). No validation that variables are required before generation.

---

### 19. Expenses (`/expenses`)
**Component:** ExpensesView.jsx (420 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| KPI summary (3 stat cards) | Yes | Total, Items, Matching Filter |
| Category + date range filters | Yes | CustomSelect + DatePicker |
| Expense table | Yes | Date, category, job, amount, notes |
| Add/Edit modal | Yes | Lead search, category, amount, date, notes |
| Delete with confirmation | Yes | Inline confirmation |

**Issues:** 2 silent catches. No batch operations, no CSV export.

---

### 20. Settings (`/settings`)
**Component:** SettingsView.jsx (2,877 lines) | **Status:** Fully functional, 15 tabs

| Tab | Works? | Features |
|-----|--------|----------|
| Profile | Yes | Edit first/last name, email, phone, avatar |
| Company | Yes | Sender email, company name, phone, website, address, logo |
| Billing | Yes | Plan selection, feature comparison, card mgmt, invoice history, module toggles |
| Payments | Yes | Stripe Connect, onboarding, payment history |
| Team | Yes | Member list, invite, role management (admin/sales_rep/sales_manager/viewer), delete |
| Alerts | Yes | Storm alert configuration (hail/wind thresholds, immediate/digest mode) |
| Notifications | Yes | 10-category preference toggles |
| Email/SMTP | Yes | SMTP server config, test email |
| Financing | **Partial** | Hearth provider config, but "mock" provider still in dropdown |
| Automations | Yes | Workflow automation CRUD (AutomationSettings component, 392 lines) |
| Drip Sequences | Yes | Step builder, enrollment, scheduling (DripSequences component, 713 lines) |
| Custom Fields | Yes | CRUD for field definitions with types and options |
| Contracts | Yes | Contract template management with sections |
| Reviews | Yes | Google Place ID, review message template |
| Pricing/Line Items | Yes | Line item catalog, section grouping |

**Issues:** 9 silent `.catch(() => {})`. Mock financing provider still in dropdown. Stripe publishable key loaded from env with empty string fallback.

---

### 21. Admin Dashboard (`/admin`)
**Component:** AdminDashboard.jsx (1,000 lines) | **Status:** Functional (super_admin only)

| Feature | Works? | Notes |
|---------|--------|-------|
| Overview stat cards | Yes | Total/active tenants, users, leads, MRR, skip trace + roof measurement revenue |
| Tenants table (searchable, sortable) | Yes | Expandable rows with detail panel |
| Tenant detail management | Yes | Tier/status inline edit, user roster, billing summary |
| Revenue tab | Yes | Revenue breakdown |
| Usage leaderboard | Yes | Per-tenant metrics |
| Payment sources tab | Yes | Payment source management |

**Issues:** 3 silent catches.

---

### 22-24. Public Pages

**PublicEstimate (`/estimate/:token`)** — 718 lines, fully functional
- Estimate details, line items, totals, financing plans, signature canvas, accept/decline, Stripe payment (Card + ACH)
- Financing application flow with lender redirect and 3-second polling
- Issues: 3 empty catches, hardcoded polling timings, base64 signature storage

**PublicContract (`/contract/:token`)** — 225 lines, functional
- Contract sections, signature canvas, sign action, voided status display
- Issues: 1 empty catch on sign submission, flexible but untested content parsing

**ClientStatusPage (`/status/:token`)** — 426 lines, functional
- Progress timeline with 9 stage dots, work order card, milestones list, company branding
- Issues: Stage extraction uses fragile regex (`description?.match(/(?:changed to|->)\s*(\w+)/i)`)

---

### 25-27. Auth & Utility Pages

**LoginPage** (88 lines) — Multi-tenant login (email, password, tenant slug)
- Issue: **Hardcoded test credentials in defaults** (waterlooconstruction1@gmail.com, password, tenant slug) — should be empty strings in production

**RegisterPage** (131 lines) — User registration with tenant creation, clean implementation

**OnboardingPage** (983 lines) — 5-step wizard (Account, Company, Plan, Payment via Stripe, Add-ons)

**Shared Components:**
- TopBar (558 lines) — GlobalSearch (Cmd-K) + NotificationBell with 10-category polling
- BottomTabBar — Mobile navigation bar (5 key tabs)
- PhotoAnnotator (374 lines) — Canvas-based markup tool for roof damage photos
- RoofDrawingTool (842 lines) — Interactive roof measurement drawing
- ImportLeadsModal (414 lines) — CSV import with Census geocoding + field mapping
- StormProperties (740 lines) — Property list panel for storm map

---

## Backend Summary

**Total route files:** 37 (+1 index)
**Total endpoints:** 279 (was 271, +8 from recount; no new routes added since 2026-04-04)

| Module | Prefix | Endpoints | Lines |
|--------|--------|-----------|-------|
| crm.js | /api/crm | 47 | 1,001 |
| properties.js | /api/properties | 18 | 965 |
| estimates.js | /api/crm/estimates | 16 | 404 |
| financing.js | /api/crm/financing | 13 | 120 |
| contracts.js | /api/crm/contracts | 12 | 153 |
| workOrders.js | /api/crm/work-orders | 11 | 163 |
| skipTrace.js | /api/skip-trace | 10 | 209 |
| materials.js | /api/materials | 9 | 781 |
| drip.js | /api/crm/drip-sequences | 8 | 114 |
| invoices.js | /api/crm/invoices | 8 | 156 |
| roofMeasurement.js | /api/roof-measurement | 8 | 255 |
| subcontractors.js | /api/crm/subcontractors | 8 | 114 |
| onboarding.js | /api/onboarding | 7 | 289 |
| payments.js | /api/payments | 7 | 473 |
| content.js | /api/crm/content | 6 | 145 |
| admin.js | /api/admin | 6 | 665 |
| reports.js | /api/crm/reports | 6 | 157 |
| notifications.js | /api/notifications | 6 | 76 |
| territories.js | /api/crm/territories | 6 | 180 |
| leads.js | /api/leads | 6 | 175 |
| auth.js | /api/auth | 5 | 152 |
| automations.js | /api/crm/automations | 5 | 101 |
| canvassing.js | /api/crm/canvass-pins | 5 | 216 |
| expenses.js | /api/crm/expenses | 5 | 81 |
| drift.js | /api/drift | 5 | 70 |
| alerts.js | /api/alerts | 4 | 65 |
| counties.js | /api/counties | 4 | 81 |
| dashboard.js | /api/dashboard | 3 | 47 |
| dataApis.js | /api/data | 3 | 74 |
| documents.js | /api/documents | 3 | 85 |
| map.js | /api/map | 3 | 90 |
| stormHistory.js | /api/storm-history | 2 | 59 |
| storms.js | /api/storms | 2 | 35 |
| hearthWebhook.js | /api/webhooks/hearth | 1 | 18 |
| disasterDeclarations.js | /api/disaster-declarations | 1 | 39 |
| search.js | /api/search | 1 | 21 |
| webhook.js | /api/webhooks | 1 | 30 |

**Database migrations:** 47 total (no new since 2026-04-04)

**Unreachable service functions:**
- `signEstimateInPerson()` in estimateService.js (lines 354-382) — complete implementation, no route

---

## Competitor Feature Matrix Cross-Reference

Cross-referencing `docs/competitor-gap-analysis.md` (2026-03-25 matrix) against actual code as of 2026-04-05:

| Feature | Matrix Status | Actual Status (2026-04-05) | Notes |
|---------|--------------|---------------------------|-------|
| **CRM & Pipeline** ||||
| Kanban pipeline | Match | OK | 3 boards, drag-drop, sidebar preview, conversion rates |
| Pipeline deal values | Not in matrix | Built | Cards show estimated_value, column totals |
| Contact management | Match | OK | Full CRUD with activities |
| Lead source tracking | Match | OK | Source field, filter, reports |
| Custom fields | Better | OK | Free, unlimited, 7+ field types |
| Global search (Cmd-K) | Match | OK | TopBar GlobalSearch |
| **Sales & Estimating** ||||
| Estimate builder | Better | OK | Rich text, tiers, financing, templates |
| Server-side PDF | Not in matrix | Built | pdfmake branded PDF generation |
| Estimate templates | Match | OK | Template CRUD |
| E-signature | Match | OK | Canvas-based on public pages |
| In-person signing | Not in matrix | **INCOMPLETE** | Backend only, no route or UI |
| Estimate-to-invoice | Match | OK | EstimatePicker in InvoicesView |
| **Invoicing & Payments** ||||
| Invoicing | Match | OK | Full builder + A/R aging |
| Online payments | Better | OK | Stripe Card + ACH, free |
| Payment recording | Not in matrix | **STUB** | Modal state exists, UI never renders |
| Financing | Match | OK | Hearth integration |
| QuickBooks sync | **Missing** | **Still Missing** | No QB integration |
| Invoice reminders | Not in matrix | **DB only** | Migration 044 exists, no cron/UI |
| **Scheduling & Tasks** ||||
| Calendar | Match | OK | FullCalendar with drag-reschedule |
| Calendar click-to-create | Not in matrix | **Missing** | Cannot create events from calendar |
| Task management | Match | OK | CRUD, priority, due dates |
| Work orders kanban | Better | OK | 4-column + milestones + templates |
| **Storm Data & Maps** ||||
| Hail/wind/tornado maps | Better | OK | NOAA, free, multi-layer |
| Severity color graduation | Not in matrix | Built | All 3 types: hail, wind, tornado |
| Real-time storm alerts | Better | OK | Free alerting |
| Weather history reports | Better | OK | 10-year SWDI, PDF export |
| Honey Hole Finder | Missing in matrix | Built | NOAA SWDI heatmap overlay |
| Historical data depth | Worse (30-day) | Improved | SWDI 10+ years; NWS storms still 30-day |
| **Canvassing** ||||
| GPS-verified pins | Match | OK | Geolocation on pin drop |
| Territory/region assignment | Missing in matrix | Built | PostGIS polygons + assignment |
| Generate list from storm map | Not in matrix | Built | Creates canvass pins from storm properties |
| **Automation & Reporting** ||||
| Workflow automations | Better | OK | Unlimited, free |
| Reports/analytics | Match | OK | 6 chart types + comparison + drill-down |
| Profit tracker per job | Match | OK | Estimate - expenses in LeadDetail |
| **Communication** ||||
| SMS texting | **Missing** | **Still Missing** | SMS composer exists in LeadDetail but sends nothing |
| Email integration | Worse | Partial | SMTP + drip sequences, no inbox/thread |
| AI phone answering | **Missing** | **Still Missing** | Not feasible cheaply |
| Automated review requests | Missing in matrix | Built | Google review link in Settings + LeadDetail |
| Drip sequences | Not in matrix | Built | 15-min cron, auto-enrollment, step progression |
| **AI Features** ||||
| AI content/marketing | Missing in matrix | Built | Content Studio with 7 types + batch + DB persistence |
| AI roof measurements | **Missing** | Partial | RoofDrawingTool exists, not satellite-based |
| Solar analysis | **Missing** | Partial | Google Solar API in LeadDetail |
| **Other** ||||
| Photo annotation | Missing in matrix | Built | PhotoAnnotator in documents |
| Subcontractor mgmt | Missing in matrix | Built | Full CRUD + assignment |
| Mobile app (native) | **Missing** | **Still Missing** | PWA only |
| Document management | Match | OK | Upload, delete, annotate |
| Team management | Match | OK | Invite, roles, delete |
| Contract PDF generation | Not in matrix | **Missing** | Estimates have PDF, contracts do not |

---

## Code Quality Issues

### Silent Error Handling (~40 occurrences across 14 files)
Files with the most `.catch(() => {})` blocks:
- LeadDetail.jsx: 9
- SettingsView.jsx: 9
- ReportsView.jsx: 6
- TasksView.jsx: 4
- AdminDashboard.jsx: 3
- ContractsView.jsx: 3
- WorkOrdersView.jsx: 3
- PublicEstimate.jsx: 3
- Dashboard.jsx: 2
- CanvassingMode.jsx: 2
- ExpensesView.jsx: 2
- InvoicesView.jsx: 2
- MaterialsView.jsx: 3
- Others: 2+

### Remaining `alert()` Calls
- StormMap.jsx: Generate Canvassing List success message uses `alert()` instead of Toast

### Security Concern
- LoginPage.jsx: Hardcoded test credentials in default state values

### Large Component Files (should consider splitting)
- LeadDetail.jsx: 2,921 lines
- SettingsView.jsx: 2,877 lines
- StormMap.jsx: 2,856 lines
- EstimatesView.jsx: 2,408 lines
- Dashboard.jsx: 1,636 lines
- Pipeline.jsx: 1,519 lines

### Incomplete Features (code exists but not wired)
- `signEstimateInPerson()` — service function without API route
- Invoice payment recording — modal state without modal UI
- Materials order detail — state exists but modal never renders
- Invoice reminders — migration 044 exists, no cron job or UI
- SMS sending — composer UI exists in LeadDetail, no Twilio backend

---

## Summary Statistics

| Metric | 2026-04-04 | 2026-04-05 | Change |
|--------|------------|------------|--------|
| Protected routes | 22 | 22 | --- |
| Public routes | 6 | 6 | --- |
| Backend route files | 39 | 37 | Recount (index.js excluded) |
| Backend endpoints | 271 | 279 | Recount (+8 found) |
| DB migrations | 47 | 47 | --- |
| Sidebar nav items | 17 | 17 | --- |
| Settings tabs | 15 | 15 | --- |
| Silent catch blocks | ~35 | ~40 | +5 (deeper analysis) |
| Identified stubs | 0 | 3 | Payment modal, order detail, SMS send |
| Features "Missing" in matrix but actually built | 6 | 6 | --- |
| Features still truly missing vs competitors | 4 | 4 | QB, SMS, Native, AI Phone |
| Unreachable backend functions | 0 | 1 | signEstimateInPerson |

---

## Top 10 Improvement Opportunities

Ranked by competitive impact, user value, and feasibility:

### 1. In-Person Estimate Signing — HALF-BUILT
**Impact:** High (SumoQuote/JobNimbus offer this; field crews need it)
**Effort:** Low (backend function is DONE, just needs 1 route + 1 UI button)
**Current state:** `signEstimateInPerson()` fully implemented in estimateService.js (accepts+signs+creates work order). Needs POST route in estimates.js and "Sign Now" button in EstimatesView review toolbar.
**What to build:** 1 API route, 1 frontend button + inline signature canvas.

### 2. Invoice Payment Recording — STUB FIX
**Impact:** High (core billing feature; contractors MUST record partial payments)
**Effort:** Low (modal state exists, just needs the modal JSX and API call)
**Current state:** `setShowPaymentModal(true)` is called but no `{showPaymentModal && <Modal>...}` block exists. The backend `POST /invoices/:id/payment` endpoint likely exists or is trivial.
**What to build:** Payment recording modal with amount input, date, and notes.

### 3. Calendar Click-to-Create — MISSING BASIC FEATURE
**Impact:** Medium-High (every CRM competitor has this; 149-line component is thinnest in app)
**Effort:** Low (add dateClick handler to FullCalendar + open task creation modal pre-filled with date/time)
**Current state:** CalendarView only has 149 lines. Can view and drag-reschedule but cannot click empty slot to create new task/event.
**What to build:** `dateClick` handler -> open task creation modal with pre-filled date/time. Add event type selector.

### 4. QuickBooks Sync — CRITICAL COMPETITIVE GAP
**Impact:** High (JobNimbus + RoofLink both have it; contractors expect it for accounting)
**Effort:** Medium (QB API has free tier for small apps)
**Current state:** Zero implementation. No QB route files, no OAuth flow.
**What to build:** OAuth connection in Settings, one-way invoice push to QBO, optional payment sync back.

### 5. SMS/Texting Integration — CRITICAL COMPETITIVE GAP
**Impact:** High (JobNimbus charges $49-249/mo; contractors expect texting)
**Effort:** Medium (Twilio ~$0.0075/msg, pass-through cost)
**Current state:** SMS composer UI exists in LeadDetail with template personalization, but sends nothing. SMS activity type logs but no delivery.
**What to build:** Twilio adapter, wire existing SMS composer to actually send, appointment reminders via drip.

### 6. Contract PDF Generation — PARITY GAP
**Impact:** Medium (estimates have branded PDF download; contracts do not)
**Effort:** Low (reuse existing pdfmake infrastructure from estimates)
**Current state:** EstimatesView has server-side PDF generation via pdfmake. ContractsView has zero PDF support.
**What to build:** Copy estimate PDF template, adapt for contract sections, add download button.

### 7. Silent Error Handling — SYSTEMATIC QUALITY ISSUE (~40 occurrences)
**Impact:** Medium-High (users get no feedback when actions fail; leads to confusion/data loss)
**Effort:** Medium (systematic, touches 14 files)
**Current state:** ~40 `.catch(() => {})` blocks. Users click buttons and nothing happens when API fails.
**What to fix:** Replace with toast notifications on user-initiated actions. Keep silent only for background polling/prefetch.

### 8. Materials Order Detail View — STUB FIX
**Impact:** Medium (users can place orders but can't view order details after the fact)
**Effort:** Low (`selectedOrder` state already exists, just needs the modal JSX)
**Current state:** Order history tab shows list, but clicking an order does nothing. State is set but no modal renders.
**What to build:** Order detail modal showing items, quantities, branch, status, dates.

### 9. Invoice Automated Reminders — DB MIGRATION WITHOUT IMPLEMENTATION
**Impact:** Medium-High (reduces AR aging, auto-reminds customers on overdue invoices)
**Effort:** Medium (migration 044 exists; needs cron job like drip sequences + email templates)
**Current state:** Migration `044_invoice_reminders.sql` exists but no cron job, no settings UI, no reminder sending logic.
**What to build:** Cron job (reuse drip pattern), 3/7/14 day overdue email templates, toggle in Settings.

### 10. LoginPage Hardcoded Credentials — SECURITY FIX
**Impact:** Low (cosmetic/security) but embarrassing if found
**Effort:** Trivial (change 3 default values to empty strings)
**Current state:** Lines 8-10 have test email/password/tenant as form defaults.
**What to fix:** Set default state to `{ email: '', password: '', tenant: '' }`.

---

## Feature Completeness by Category

| Category | Features Built | Features Missing/Incomplete | Completeness |
|----------|---------------|---------------------------|--------------|
| CRM & Pipeline | 7/7 | 0 | 100% |
| Sales & Estimating | 8/9 | In-person signing (half-built) | 89% |
| Invoicing & Payments | 5/8 | Payment recording, QB sync, invoice reminders | 63% |
| Scheduling & Tasks | 3/4 | Calendar click-to-create | 75% |
| Storm Data & Maps | 8/8 | 0 (all built beyond matrix) | 100% |
| Canvassing | 4/4 | 0 | 100% |
| Automation & Reporting | 4/4 | 0 | 100% |
| Communication | 2/5 | SMS, inbox, AI phone | 40% |
| AI Features | 2/4 | Satellite measurements, AI proposals | 50% |
| Other | 4/5 | Native mobile app | 80% |
| **Overall** | **47/58** | **11 gaps** | **81%** |
