# StormLeads App Inventory — 2026-04-06

**Method:** Full source code analysis of all protected routes, public routes, backend route files, sidebar navigation, and database migrations. Builds on 2026-04-05 inventory with verification of all changes since.
**Firecrawl:** 0 credits remaining — inventory is code-based (no live screenshots).
**Changes since last inventory (2026-04-05):** 4 feature commits + 2 docs/checkpoint commits.

---

## What Changed Since 2026-04-05

| Change | Commit | Impact |
|--------|--------|--------|
| In-person estimate signing | c575a47 | Route + signature canvas modal — **COMPLETE** (was half-built) |
| Calendar click-to-create | 5935d4c | dateClick handler + task creation modal + empty state — **COMPLETE** (was missing) |
| Contract PDF generation | 263269c | pdfmake branded PDF export — **COMPLETE** (was missing) |
| Enhanced payment recording modal | a3f0b46 | 7 payment methods, quick-fill, notes — **COMPLETE** (was stub) |
| Overnight report | 9992bbb | docs/overnight-history.md updated |
| Pre-overnight checkpoint | 987134d | Snapshot commit |

**Net feature change:** 4 previously broken/missing features are now fully functional.

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

**Issues:** 2 silent `.catch(() => {})` on getTeamMembers and getLeads — no user feedback on API failures.

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
- `alert()` at line 2734 for canvassing list success — should use Toast
- Empty `.catch(() => {})` at line 1453 for property count fetch
- 2,856-line component — refactoring candidate

---

### 3. Storm Archive (`/storm-catalog`)
**Component:** StormCatalog.jsx (311 lines) | **Status:** Fully functional

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

**Issues:** Empty `.catch(() => {})` at line 39 when loading storms.

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
| Sidebar lead preview | Yes | Stage change UI, activity feed |

**Issues:** HTML5 drag API (limited mobile touch support, not @dnd-kit). Empty `.catch(() => {})` on team fetch. Board definitions hardcoded.

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

**Issues:** Empty `.catch(() => {})` on team fetch (line 168). Otherwise clean.

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

**Issues:** 9 silent `.catch(() => {})` blocks. SMS composer is a pass-through to native device SMS (no app-level sending). 2,921-line component — largest in app.

---

### 7. Estimates (`/estimates`)
**Component:** EstimatesView.jsx (2,569 lines) | **Status:** Fully functional

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
| **In-person signing** | **Yes (NEW)** | Canvas signature modal, signer name, auto-creates work order |

**Issues:** "LAUNCH MEASUREMENT TOOL" button (line 541) has NO onClick handler — dead button in UI. No empty catches (all have error handling now).

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
| **Record payment** | **Yes (NEW)** | 7 methods (check/cash/card/ACH/insurance/financing/other), quick-fill buttons (100%/50%/25%), reference notes |
| Void invoice | Yes | Status update |
| Create from estimate | Yes | EstimatePicker modal |
| Automated invoice reminders | **NO** | Migration 044 exists, no cron/UI |

**Issues:** No empty catches (all use showToast). Invoice reminder migration exists but zero implementation.

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
| **PDF export** | **Yes (NEW)** | pdfmake branded PDF with download button |

**Issues:** Signature block in preview is static placeholder (dashed border, no actual signing). No empty catches.

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

**Issues:** None critical. No empty catches.

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
| Order detail view | **Yes** | State-driven conditional render (NOT a stub — uses selectedOrder drilldown) |

**Issues:** SRS hardcoded as only supplier.

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
| Assignee display | Yes | On task rows |
| Mobile "Mission Log" view | Yes | Tactical theme |
| Mobile efficiency metrics | Yes | Completion rate + critical path velocity |

**Issues:** No empty catches detected.

---

### 13. Calendar (`/calendar`)
**Component:** CalendarView.jsx (324 lines) | **Status:** Fully functional (upgraded from 149 lines)

| Feature | Works? | Notes |
|---------|--------|-------|
| FullCalendar (month/week/day/list views) | Yes | @fullcalendar/react |
| Event type badges | Yes | Task/Call/Email/Door Knock |
| Priority badges | Yes | Color-coded |
| Click event -> navigate to lead | Yes | Opens lead detail |
| Drag-to-reschedule (tasks) | Yes | Updates due_date |
| Now indicator | Yes | Current time line |
| **Click-to-create** | **Yes (NEW)** | dateClick handler opens CalendarCreateModal |
| **Event creation form** | **Yes (NEW)** | Title, type, priority, due date, description |
| **Empty state** | **Yes (NEW)** | "No events in this range — Click any date to create a task" |

**Issues:** None. Clean implementation with proper error handling.

---

### 14. Canvassing (`/canvassing`)
**Component:** CanvassingMode.jsx (685 lines) | **Status:** Fully functional

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

**Issues:** None. All catch blocks have error handling.

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
| Pagination with page size | Yes | 10/25/50 per page |
| Add/Edit slide-over panel | Yes | Full form with phone auto-formatting |
| Delete with confirmation | Yes | Hover-reveal buttons |
| Specialty + status badges | Yes | Color-coded (12 specialties) |

**Issues:** None critical.

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

**Issues:** Catch blocks use fallback values (not silent). No critical issues.

---

### 18. Content Studio (`/content-studio`)
**Component:** ContentStudio.jsx (835 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Generate tab with settings | Yes | Type + tone dropdowns |
| 7 content types | Yes | Social posts, door hangers, emails, blog outlines, ad copy, cold call scripts, landing pages |
| 10 variable input fields | Yes | Company, city, storm date, hail size, etc. |
| Batch mode (up to 8 variations) | Yes | Toggle checkbox |
| Live preview panel | Yes | Facebook, email, door hanger, blog mockups |
| Results grid with copy/save/delete | Yes | Card-based layout |
| Library tab with saved content | Yes | Database-backed (migrated from localStorage) |
| Search + type filter in library | Yes | Real-time filtering |
| Library item count badge | Yes | On tab label |
| Cross-device sync | Yes | Database persistence |

**Issues:** None. All catch blocks have fallback handling.

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

**Issues:** No batch operations, no CSV export.

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
| Financing | **Partial** | Hearth provider config — "Mock (Testing)" still in provider dropdown |
| Automations | Yes | Workflow automation CRUD (AutomationSettings component) |
| Drip Sequences | Yes | Step builder, enrollment, scheduling (DripSequences component) |
| Custom Fields | Yes | CRUD for field definitions with types and options |
| Contracts | Yes | Contract template management with sections |
| Reviews | Yes | Google Place ID, review message template |
| Pricing/Line Items | Yes | Line item catalog, section grouping |

**Issues:** 9 silent `.catch(() => {})` blocks across the component. "Mock (Testing)" financing provider still in dropdown (line 1859). Stripe publishable key falls back to empty string `''`.

---

### 21. Admin Dashboard (`/admin`)
**Component:** AdminDashboard.jsx (1,000 lines) | **Status:** Functional (super_admin only)

| Feature | Works? | Notes |
|---------|--------|-------|
| Overview stat cards | Yes | Total/active tenants, users, leads, MRR |
| Tenants table (searchable, sortable) | Yes | Expandable rows with detail panel |
| Tenant detail management | Yes | Tier/status inline edit, user roster, billing summary |
| Revenue tab | Yes | Revenue breakdown |
| Usage leaderboard | Yes | Per-tenant metrics |

**Issues:** 3 silent catches.

---

### 22-24. Public Pages

**PublicEstimate (`/estimate/:token`)** — 719 lines, fully functional
- Estimate details, line items, totals, financing plans, signature canvas, accept/decline, Stripe payment (Card + ACH)
- Financing application flow with lender redirect and polling

**PublicContract (`/contract/:token`)** — 226 lines, functional
- Contract sections, signature canvas, sign action, voided status display

**ClientStatusPage (`/status/:token`)** — 427 lines, functional
- Progress timeline with 9 stage dots, work order card, milestones list, company branding

---

### 25-27. Auth & Utility Pages

**LoginPage** (88 lines) — Multi-tenant login
- **SECURITY:** Hardcoded test credentials in default state (email, password, tenant slug)

**RegisterPage** (131 lines) — User registration with tenant creation

**OnboardingPage** (984 lines) — 5-step wizard (Account, Company, Plan, Payment via Stripe, Add-ons)

**Shared Components:**
- TopBar (558 lines) — GlobalSearch (Cmd-K) + NotificationBell with 10-category polling
- BottomTabBar — Mobile navigation bar (5 key tabs)
- PhotoAnnotator (374 lines) — Canvas-based markup tool for roof damage photos
- RoofDrawingTool (842 lines) — Interactive roof measurement drawing
- ImportLeadsModal (414 lines) — CSV import with Census geocoding + field mapping
- StormProperties (740 lines) — Property list panel for storm map

---

## Backend Summary

**Total route files:** 39
**Total endpoints:** 279
**Database migrations:** 47

| Module | Prefix | Endpoints |
|--------|--------|-----------|
| crm.js | /api/crm | 47 |
| properties.js | /api/properties | 18 |
| estimates.js | /api/crm/estimates | 16 |
| financing.js | /api/crm/financing | 13 |
| contracts.js | /api/crm/contracts | 12 |
| workOrders.js | /api/crm/work-orders | 11 |
| skipTrace.js | /api/skip-trace | 10 |
| materials.js | /api/materials | 9 |
| drip.js | /api/crm/drip-sequences | 8 |
| invoices.js | /api/crm/invoices | 8 |
| roofMeasurement.js | /api/roof-measurement | 8 |
| subcontractors.js | /api/crm/subcontractors | 8 |
| onboarding.js | /api/onboarding | 7 |
| payments.js | /api/payments | 7 |
| content.js | /api/crm/content | 6 |
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

---

## Competitor Feature Matrix Cross-Reference

Cross-referencing `docs/competitor-gap-analysis.md` (2026-03-25 matrix) against actual code as of 2026-04-06:

| Feature | Matrix Status (Mar 25) | Actual Status (Apr 6) | Notes |
|---------|----------------------|----------------------|-------|
| **CRM & Pipeline** ||||
| Kanban pipeline | Match | OK | 3 boards, drag-drop, sidebar preview, conversion rates |
| Pipeline deal values | Not in matrix | Built | Cards show estimated_value, column totals |
| Contact management | Match | OK | Full CRUD with activities |
| Lead source tracking | Match | OK | Source field, filter, reports |
| Custom fields | Better | OK | Free, unlimited, 7+ field types |
| Global search (Cmd-K) | Match | OK | TopBar GlobalSearch |
| Lead scoring | Not in matrix | Built | 7-factor algorithm, badges, breakdown popup |
| **Sales & Estimating** ||||
| Estimate builder | Better | OK | Rich text, tiers, financing, templates |
| Server-side PDF | Not in matrix | Built | pdfmake branded PDF generation |
| Estimate templates | Match | OK | Template CRUD |
| E-signature | Match | OK | Canvas-based on public pages |
| **In-person signing** | Not in matrix | **Built (NEW)** | Route + canvas modal + auto work order creation |
| Estimate-to-invoice | Match | OK | EstimatePicker in InvoicesView |
| AI tier generation | Not in matrix | Built | Good/Better/Best auto-generation |
| **Invoicing & Payments** ||||
| Invoicing | Match | OK | Full builder + A/R aging |
| Online payments | Better | OK | Stripe Card + ACH, free |
| **Payment recording** | Not in matrix | **Built (NEW)** | 7 methods, quick-fill, reference notes |
| Financing | Match | OK | Hearth integration |
| QuickBooks sync | **Missing** | **Still Missing** | No QB integration |
| Next-day funding | **Missing** | **Still Missing** | No implementation |
| Invoice reminders | Not in matrix | **DB only** | Migration 044 exists, no cron/UI |
| **Scheduling & Tasks** ||||
| Calendar | Match | OK | FullCalendar with drag-reschedule |
| **Calendar click-to-create** | Not in matrix | **Built (NEW)** | dateClick + task creation modal + empty state |
| Task management | Match | OK | CRUD, priority, due dates |
| Work orders kanban | Better | OK | 4-column + milestones + templates + photos |
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
| Drip sequences | Not in matrix | Built | 15-min cron, auto-enrollment, step progression |
| Stale lead alerts | Not in matrix | Built | 3/7 day untouched notifications |
| **Communication** ||||
| SMS texting | **Missing** | **Still Missing** | SMS composer exists but uses native `window.open('sms:')`, no Twilio backend |
| Email integration | Worse | Partial | SMTP + drip sequences, no inbox/thread view |
| AI phone answering | **Missing** | **Still Missing** | Not feasible cheaply |
| Automated review requests | Missing in matrix | Built | Google review link in Settings + LeadDetail |
| **AI Features** ||||
| AI content/marketing | Missing in matrix | Built | Content Studio with 7 types + batch + DB persistence |
| AI roof measurements | **Missing** | Partial | RoofDrawingTool exists, not satellite-based |
| Solar analysis | **Missing** | Partial | Google Solar API in LeadDetail |
| **Other** ||||
| Photo annotation | Missing in matrix | Built | PhotoAnnotator canvas tool in documents |
| Subcontractor mgmt | Missing in matrix | Built | Full CRUD + assignment |
| **Contract PDF generation** | Not in matrix | **Built (NEW)** | pdfmake branded PDF export |
| Material ordering | **Missing** | Partial | SRS catalog browsing + cart, single supplier only |
| Mobile app (native) | **Missing** | **Still Missing** | PWA only |
| Document management | Match | OK | Upload, delete, annotate |
| Team management | Match | OK | Invite, roles, delete |

---

## Code Quality Issues

### Silent Error Handling (~25 occurrences remaining)
Files with `.catch(() => {})` blocks:
- SettingsView.jsx: 9
- LeadDetail.jsx: 9
- AdminDashboard.jsx: 3
- Dashboard.jsx: 2
- StormMap.jsx: 1
- StormCatalog.jsx: 1
- Pipeline.jsx: 1
- LeadList.jsx: 1

**Improved since last inventory:** EstimatesView, InvoicesView, ContractsView, ReportsView, CanvassingMode, ExpensesView, ContentStudio, TasksView, WorkOrdersView — all now have proper error handling.

### Remaining `alert()` Calls
- StormMap.jsx line 2734: Generate Canvassing List success message

### Security Concerns
- LoginPage.jsx: Hardcoded test credentials in default state (email, password, tenant)
- SettingsView.jsx: "Mock (Testing)" financing provider still in production dropdown
- SettingsView.jsx: Stripe publishable key falls back to empty string

### Dead UI Elements
- EstimatesView.jsx line 541: "LAUNCH MEASUREMENT TOOL" button — no onClick handler

### Large Component Files (refactoring candidates)
- LeadDetail.jsx: 2,921 lines
- SettingsView.jsx: 2,877 lines
- StormMap.jsx: 2,856 lines
- EstimatesView.jsx: 2,569 lines
- Dashboard.jsx: 1,636 lines
- Pipeline.jsx: 1,519 lines

### Incomplete Features (code exists but not fully wired)
- Invoice reminders — migration 044 exists, no cron job or UI
- SMS sending — composer UI exists in LeadDetail, no Twilio backend
- Contract signing in preview — static placeholder, signing only works on public page
- "LAUNCH MEASUREMENT TOOL" — dead button

---

## Summary Statistics

| Metric | 2026-04-05 | 2026-04-06 | Change |
|--------|------------|------------|--------|
| Protected routes | 22 | 22 | --- |
| Public routes | 6 | 6 | --- |
| Backend route files | 37 | 39 | +2 (recount incl. index) |
| Backend endpoints | 279 | 279 | --- |
| DB migrations | 47 | 47 | --- |
| Sidebar nav items | 17 | 17 | --- |
| Settings tabs | 15 | 15 | --- |
| Silent catch blocks | ~40 | ~25 | -15 (improved in many components) |
| Identified stubs/dead UI | 5 | 2 | -3 (payment modal, in-person signing, calendar create all fixed) |
| Features "Missing" in matrix but actually built | 6 | 10 | +4 (in-person signing, payment recording, calendar create, contract PDF) |
| Features still truly missing vs competitors | 4 | 4 | QB, SMS, Native app, AI Phone |

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
**Current state:** SMS composer UI exists in LeadDetail using `window.open('sms:')` — native device only. No app-level sending, no delivery tracking, no appointment reminders.
**What to build:** Twilio adapter, wire existing SMS composer to actually send through backend, appointment reminders via drip.

### 3. Invoice Automated Reminders — DB MIGRATION WITHOUT IMPLEMENTATION
**Impact:** Medium-High (reduces AR aging, auto-reminds customers on overdue invoices)
**Effort:** Low-Medium (migration 044 exists; needs cron job like drip sequences + email templates)
**Current state:** `last_reminder_at` column exists in DB. No cron job, no settings UI, no reminder sending logic.
**What to build:** Cron job (reuse drip pattern), 3/7/14 day overdue email templates, toggle in Settings.

### 4. Email Inbox / Thread View — WORSE THAN COMPETITORS
**Impact:** Medium-High (JobNimbus has full email integration; StormLeads only sends outbound)
**Effort:** High (needs IMAP integration or third-party email sync service)
**Current state:** Can send emails via SMTP and drip sequences. No inbound email viewing, no conversation threading, no email-to-lead association.
**What to build:** At minimum, email activity log with sent email history. Ideally, inbound email capture via mailhook or IMAP polling.

### 5. "LAUNCH MEASUREMENT TOOL" Button — DEAD UI
**Impact:** Medium (visible in estimates builder, confusing UX when clicking does nothing)
**Effort:** Trivial to fix (either remove the button or wire it to RoofDrawingTool)
**Current state:** Button at EstimatesView.jsx line 541 has no onClick handler.
**What to fix:** Either remove the button or add onClick to open RoofDrawingTool for the associated lead.

### 6. Contract Signing Workflow — INCOMPLETE
**Impact:** Medium (contracts can be sent and signed on public page, but preview shows static placeholder)
**Effort:** Low (PublicContract already has signature canvas — just need UX polish in preview mode)
**Current state:** Contract preview shows a dashed-border box where signature would go. Actual signing only works on the public `/contract/:token` page. No inline signing in the builder.
**What to improve:** Show signed signature image in preview after signing. Add "View Signed Contract" link.

### 7. Silent Error Handling — ~25 REMAINING OCCURRENCES
**Impact:** Medium (users get no feedback when actions fail in Settings, LeadDetail, Dashboard)
**Effort:** Medium (systematic, touches 8 files — but 14 files were already fixed since last inventory)
**Current state:** ~25 `.catch(() => {})` blocks remain, concentrated in SettingsView (9) and LeadDetail (9).
**What to fix:** Replace with toast notifications on user-initiated actions. Keep silent only for background polling.

### 8. LoginPage Hardcoded Credentials — SECURITY FIX
**Impact:** Low (cosmetic/security) but embarrassing if found in production
**Effort:** Trivial (change 3 default values to empty strings)
**Current state:** Default state has test email, password, and tenant slug pre-filled.
**What to fix:** Set default state to `{ email: '', password: '', tenant: '' }`.

### 9. "Mock (Testing)" Financing Provider — PRODUCTION CLEANUP
**Impact:** Low (confusing for users to see "Mock" option in Settings > Financing)
**Effort:** Trivial (remove mock option from provider dropdown, set default to 'hearth')
**Current state:** Line 1748 defaults to `provider: 'mock'`, line 1859 shows "Mock (Testing)" in dropdown.
**What to fix:** Remove mock option, default to hearth, or hide behind admin flag.

### 10. Multi-Page Estimate Proposals — COMPETITIVE ENHANCEMENT
**Impact:** Medium (SumoQuote/JobNimbus offer cover page + inspection photos in proposals)
**Effort:** Medium (extend existing pdfmake infrastructure)
**Current state:** PDF generation creates a single-page document with line items.
**What to build:** Cover page with company branding + photo, optional inspection photos section, terms & conditions page. Makes estimates look more professional.

---

## Feature Completeness by Category

| Category | Features Built | Features Missing/Incomplete | Completeness |
|----------|---------------|---------------------------|--------------|
| CRM & Pipeline | 8/8 | 0 | 100% |
| Sales & Estimating | 10/10 | Dead measurement button | 95% |
| Invoicing & Payments | 6/8 | QB sync, invoice reminders | 75% |
| Scheduling & Tasks | 4/4 | 0 | 100% |
| Storm Data & Maps | 8/8 | 0 (all built beyond matrix) | 100% |
| Canvassing | 4/4 | 0 | 100% |
| Automation & Reporting | 5/5 | 0 | 100% |
| Communication | 2/5 | SMS, inbox, AI phone | 40% |
| AI Features | 2/4 | Satellite measurements, AI proposals | 50% |
| Other | 5/6 | Native mobile app | 83% |
| **Overall** | **54/62** | **8 gaps** | **87%** |

---

## Progress Since First Inventory (2026-03-30)

| Date | Completeness | Features Built | Key Additions |
|------|-------------|----------------|---------------|
| 2026-03-30 | ~70% | ~38 | Baseline inventory |
| 2026-04-01 | ~75% | ~42 | Severity colors, AR aging, photo milestones |
| 2026-04-03 | ~78% | ~44 | Server PDF, dashboard cards, storm colors |
| 2026-04-04 | ~80% | ~47 | Pipeline preview, stale alerts, content studio |
| 2026-04-05 | 81% | 47 | Code-based audit, identified stubs |
| **2026-04-06** | **87%** | **54** | **In-person signing, calendar create, contract PDF, payment recording** |
