# StormLeads App Inventory — 2026-04-04

**Method:** Full source code analysis of all 22 protected routes, 6 public routes, 39 backend route files (271 endpoints), sidebar navigation, and database migrations. Builds on 2026-04-03 inventory with verification of all changes since.
**Firecrawl:** 0 credits remaining — inventory is code-based (no live screenshots).
**Changes since last inventory (2026-04-03):** 7 commits adding 667 lines across 13 files.

---

## What Changed Since 2026-04-03

| Change | Commit | Impact |
|--------|--------|--------|
| Wind + tornado severity color graduation on storm map | d580832 | Swaths now color-coded by wind speed/EF-scale (was hail-only) |
| Content Studio library persisted to database | f671c98 | New `content_library` table, 3 new API endpoints, cross-device sync |
| Server-side PDF estimate generation | 10df25d | pdfmake-based branded PDF with download button, new GET endpoint |
| Dashboard A/R aging + estimating conversion cards | 297f989 | 2 new dashboard sections, 2 new API endpoints in crm.js |
| Bug fix: task checkbox on mobile | be862f6 | `checked={false}` → `checked={task.status === 'completed'}` |
| Bug fix: EST-XXX placeholder in estimates | be862f6 | Replaced with actual estimate number |
| Bug fix: canvassing list stub on storm map | be862f6 | Now creates up to 50 canvass pins from storm properties |
| New migration: tenant_settings key-value store | 047 | Flexible per-tenant configuration |

---

## Navigation Structure

### Sidebar (Desktop)
**Top-level:** Dashboard, Storm Map, Storm Archive, Pipeline, Leads
**Jobs group:** Estimates, Contracts, Work Orders, Materials
**Finance group:** Invoices, Expenses
**Operations group:** Tasks, Calendar, Canvassing, Subcontractors, Reports, Content Studio
**Bottom:** Settings

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
**Component:** Dashboard.jsx (~1,640 lines) | **Status:** Fully functional

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
| A/R aging summary (5 buckets) | Yes | **NEW** — Current, 1-30, 31-60, 61-90, 91+ days |
| Estimating conversion cards | Yes | **NEW** — Acceptance rate, pipeline, average |
| Filter dropdowns (Rep, Source, Period) | Yes | CustomSelect, backend-filtered |
| Comparison period data with trend arrows | Yes | Delta badges |
| Loading skeletons | Yes | Shimmer animation |

**API Calls:** 10 dashboard endpoints + storms + team + leads
**Issues:** 2 silent `.catch(() => {})` — no user feedback on API failures.

---

### 2. Storm Map (`/storm-map`)
**Component:** StormMap.jsx (~2,850 lines) | **Status:** Mostly functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Google Maps with storm swath polygons | Yes | Hail, wind, tornado, thunderstorm layers |
| Hail severity color graduation | Yes | Green→yellow→orange→red by hail size |
| Wind severity color graduation | Yes | **NEW** — Blue→green→orange→red by mph |
| Tornado severity color graduation | Yes | **NEW** — Yellow→orange→red→purple by EF-scale |
| Swath transparency slider | Yes | 0-100% opacity |
| Layer toggle panel (6 layers) | Yes | Hail/wind/tornado/tstorm/drift/properties |
| FEMA National Structure Inventory overlay | Yes | Points within swath polygons |
| Supercluster property clustering | Yes | Performance optimization |
| Address search bar | Yes | With loading state |
| Honey Hole heatmap overlay | Yes | NOAA SWDI historical hail circles |
| Property popup with "Add to Pipeline" | Yes | Creates lead from map |
| Storm history per location | Yes | 5-mile radius, 10-year SWDI window |
| Time range filter (24h/3d/7d/14d/30d) | Yes | Session-persisted |
| Generate Canvassing List button | Yes | **FIXED** — Creates up to 50 canvass pins from storm properties |
| Zoom level indicator | Yes | Z-scale display |
| Terrain toggle | Yes | Map type switch |
| Mobile-responsive layout | Yes | Separate mobile layout |

**API Calls:** getSwaths, getPropertiesInSwath, getFemaLiveProperties, getHailHeatmap, getStormHistory, createProperty, addPropertyToPipeline, createManualLead, reverse-geocode, createCanvassPin
**Issues:**
- Some hidden controls in DOM (`display: none`) — incomplete refactoring
- Uses `alert()` for canvassing list success instead of Toast
- Multiple `.catch(() => {})` with no user feedback on API failures

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

**Issues:** Silent geocoding failures (empty catch blocks), no request throttling for batch geocoding.

---

### 4. Pipeline (`/pipeline`)
**Component:** Pipeline.jsx (~1,213 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Kanban board with drag-and-drop | Yes | HTML5 drag API, optimistic updates |
| 3 board tabs (Sales/Production/Billing) | Yes | Stage filtering by workflow phase |
| Deal value on cards | Yes | Shows formatted estimated_value or "—" |
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

**API Calls:** getPipelineStages, getLeads (500 limit), getTeamMembers, updateLead
**Issues:** Uses HTML5 drag API (limited mobile drag support, not @dnd-kit).

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
**Component:** LeadDetail.jsx (~2,922 lines) | **Status:** Fully functional, very comprehensive

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

**Issues:** 9 silent `.catch(() => {})` blocks. Extremely large component (~3K lines) — would benefit from splitting.

---

### 7. Estimates (`/estimates`)
**Component:** EstimatesView.jsx (~2,400 lines) | **Status:** Fully functional

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
| **Server-side PDF generation** | Yes | **NEW** — pdfmake branded PDF with download button |

**API Calls:** 12+ estimate endpoints + financing + materials + PDF
**Issues:** None identified (EST-XXX stub fixed in be862f6).

---

### 8. Invoices (`/invoices`)
**Component:** InvoicesView.jsx (1,081 lines) | **Status:** Fully functional

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
| Record payment | Yes | Amount input |
| Void invoice | Yes | Status update |
| Create from estimate | Yes | EstimatePicker modal |

**Issues:** `invoice.customer_email` potentially undefined (line 573). 1 silent catch.

---

### 9. Contracts (`/contracts`)
**Component:** ContractsView.jsx (603 lines) | **Status:** Fully functional

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

**Issues:** 3 silent `.catch(() => {})`. No required field validation before save/send.

---

### 10. Work Orders (`/work-orders`)
**Component:** WorkOrdersView.jsx (1,147 lines) | **Status:** Fully functional

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

**Issues:** Minor `item.description` vs `item.name` inconsistency. 3 silent catches.

---

### 11. Tasks (`/tasks`)
**Component:** TasksView.jsx (828 lines) | **Status:** Functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Task list with Pending/Completed tabs | Yes | Count badges |
| Overdue/Due Today counts | Yes | Summary header |
| Task completion checkbox | Yes | **FIXED** — was hardcoded `checked={false}` on mobile |
| Create/Edit task modal | Yes | Title, description, due date, priority |
| Priority badges (Hot/Warm/Cold) | Yes | Color-coded |
| Assignee display | Yes | On task rows |
| Mobile "Mission Log" view | Yes | Tactical theme |
| Mobile efficiency metrics | Yes | Completion rate + critical path velocity |

**Issues:** Silent error handling (no toast for failures). Overdue/today calculations not memoized.

---

### 12. Calendar (`/calendar`)
**Component:** CalendarView.jsx (149 lines) | **Status:** Functional, lightweight

| Feature | Works? | Notes |
|---------|--------|-------|
| FullCalendar (month/week/day/list views) | Yes | @fullcalendar/react |
| Event type badges | Yes | Task/Call/Email/Door Knock |
| Priority badges | Yes | Color-coded |
| Click event → navigate to lead | Yes | Opens lead detail |
| Drag-to-reschedule (tasks) | Yes | Updates due_date |
| Now indicator | Yes | Current time line |

**Issues:**
- **No click-to-create** — cannot create tasks/events from empty calendar slot
- No error feedback on drag failure
- Only tasks are draggable (not visually indicated)
- Only 149 lines — thinnest component in the app

---

### 13. Canvassing (`/canvassing`)
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
| Marker click → view details | Yes | Read-only details |

**Issues:** Silent geolocation failure (attempts once with 8-second timeout).

---

### 14. Territory Manager (within Canvassing)
**Component:** TerritoryManager.jsx | **Status:** Functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Territory CRUD | Yes | Name, description, color, assignee |
| PostGIS polygon drawing | Yes | Draw on map, coordinates saved |
| Territory list with colors | Yes | Visual distinction |
| Assign to team member | Yes | Dropdown |

**API Calls:** 6 territory endpoints with PostGIS
**Issues:** None identified.

---

### 15. Reports (`/reports`)
**Component:** ReportsView.jsx (666 lines) | **Status:** Fully functional

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

**Issues:** None identified.

---

### 16. Content Studio (`/content-studio`)
**Component:** ContentStudio.jsx (~780 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Generate tab with settings | Yes | Type + tone dropdowns |
| 10 variable input fields | Yes | Company, city, storm date, hail size, etc. |
| Batch mode (5 variations) | Yes | Toggle checkbox |
| Live preview panel | Yes | Facebook, email, door hanger, blog mockups |
| Results grid with copy/save/delete | Yes | Card-based layout |
| Library tab with saved content | Yes | **CHANGED** — Now database-backed (was localStorage) |
| Search + type filter in library | Yes | Real-time filtering |
| Library item count badge | Yes | On tab label |
| Cross-device sync | Yes | **NEW** — Database persistence enables multi-device access |

**API Calls:** generateContent, generateContentBatch, getContentLibrary, saveContentToLibrary, deleteContentFromLibrary
**Issues:** None identified.

---

### 17. Materials (`/materials`)
**Component:** MaterialsView.jsx (1,008 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Product catalog with search | Yes | Text search input |
| Category filter | Yes | Animated indicator |
| Product grid with cards | Yes | Click for detail |
| Product detail modal | Yes | Qty selector, add to cart |
| Cart sidebar | Yes | Qty +/-, remove, branch selector |
| Orders tab | Yes | Order history + detail |
| SRS Catalog integration | Yes | Material supplier integration |

**Issues:** None identified.

---

### 18. Expenses (`/expenses`)
**Component:** ExpensesView.jsx (420 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| KPI summary (3 stat cards) | Yes | Total, Items, Matching Filter |
| Category + date range filters | Yes | CustomSelect + DatePicker |
| Expense table | Yes | Date, category, job, amount, notes |
| Add/Edit modal | Yes | Lead search, category, amount, date, notes |
| Delete with confirmation | Yes | Inline confirmation |

**Issues:** Silent error handling in catch blocks.

---

### 19. Subcontractors (`/subcontractors`)
**Component:** SubcontractorsView.jsx (343 lines) | **Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Subcontractor table | Yes | Name, company, specialty, phone, email, rate, status |
| Search, specialty, status filters | Yes | Text + 2 dropdowns |
| Pagination with page size | Yes | Prev/next buttons |
| Add/Edit slide-over panel | Yes | Full form with phone auto-formatting |
| Delete with confirmation | Yes | Hover-reveal buttons |
| Specialty + status badges | Yes | Color-coded |

**Issues:** Status field not shown during creation (only on edit).

---

### 20. Settings (`/settings`)
**Component:** SettingsView.jsx (~2,876 lines) | **Status:** Fully functional, 15 tabs

| Tab | Works? | Features |
|-----|--------|----------|
| Profile | Yes | Edit first/last name, email |
| Company | Yes | Sender email, company name, phone, website, address |
| Billing | Yes | Plan selection, feature comparison, card mgmt, invoice history, module toggles |
| Payments | Yes | Stripe Connect, onboarding, payment history |
| Team | Yes | Member list, invite, role management, delete |
| Alerts | Yes | Storm alert configuration |
| Notifications | Yes | 10-category preference toggles |
| Email/SMTP | Yes | SMTP server config, test email |
| Financing | Yes | Hearth provider config, lender management, plan sync |
| Automations | Yes | Workflow automation CRUD (AutomationSettings component) |
| Drip Sequences | Yes | Step builder, enrollment, scheduling (DripSequences component) |
| Custom Fields | Yes | CRUD for field definitions |
| Contracts | Yes | Contract template management |
| Reviews | Yes | Google Place ID, review message template |
| Pricing/Line Items | Yes | Line item catalog, section grouping |

**Issues:** 9 silent `.catch(() => {})`. Mock financing provider still in dropdown.

---

### 21. Admin Dashboard (`/admin`)
**Component:** AdminDashboard.jsx (1,001 lines) | **Status:** Functional (super_admin only)

| Feature | Works? | Notes |
|---------|--------|-------|
| Overview stat cards | Yes | Platform-wide metrics |
| Tenants table (searchable, sortable) | Yes | Expandable rows |
| Tenant detail management | Yes | Tier/status inline edit |
| Revenue tab | Yes | Revenue breakdown |
| Usage leaderboard | Yes | Per-tenant metrics |

**Issues:** 3 silent catches.

---

### 22–24. Public Pages

**PublicEstimate (`/estimate/:token`)** — 719 lines, fully functional
- Estimate details, line items, totals, financing plans, signature canvas, accept/decline, Stripe payment (Card + ACH)

**PublicContract (`/contract/:token`)** — 226 lines, functional
- Contract sections, signature canvas, sign action, voided status display

**ClientStatusPage (`/status/:token`)** — 427 lines, functional
- Progress timeline with stage dots, work order card, milestones list, company branding
- Issue: Stage extraction uses fragile regex on description text

---

### 25–27. Auth & Utility Pages

**LoginPage** — Multi-tenant login (email, password, tenant slug)
**RegisterPage** — User registration with tenant creation
**OnboardingPage** — Setup wizard for new tenants

**TopBar** — GlobalSearch (Cmd-K), NotificationBell with 10-category polling
**BottomTabBar** — Mobile navigation bar (5 key tabs)
**PhotoAnnotator** — Canvas-based markup tool for roof damage photos
**RoofDrawingTool** — Interactive roof measurement drawing
**ImportLeadsModal** — CSV import with Census geocoding + field mapping

---

## Backend Summary

**Total route files:** 39 (was 38)
**Total endpoints:** 271 (was 248, +23 new)

| Module | Prefix | Endpoints | Change |
|--------|--------|-----------|--------|
| crm.js | /api/crm | 47 | +2 (A/R aging, estimating conversion) |
| properties.js | /api/properties | 18 | — |
| estimates.js | /api/crm/estimates | 16 | +1 (PDF generation) |
| financing.js | /api/crm/financing | 13 | — |
| contracts.js | /api/crm/contracts | 12 | — |
| workOrders.js | /api/crm/work-orders | 11 | — |
| skipTrace.js | /api/skip-trace | 10 | — |
| materials.js | /api/materials | 9 | — |
| drip.js | /api/crm/drip-sequences | 8 | — |
| invoices.js | /api/crm/invoices | 8 | — |
| roofMeasurement.js | /api/roof-measurement | 8 | — |
| subcontractors.js | /api/crm/subcontractors | 8 | — |
| payments.js | /api/payments | 7 | — |
| onboarding.js | /api/onboarding | 7 | — |
| content.js | /api/crm/content | 6 | +3 (library CRUD) |
| admin.js | /api/admin | 6 | — |
| reports.js | /api/crm/reports | 6 | — |
| notifications.js | /api/notifications | 6 | — |
| territories.js | /api/crm/territories | 6 | — |
| leads.js | /api/leads | 6 | — |
| auth.js | /api/auth | 5 | — |
| automations.js | /api/crm/automations | 5 | — |
| canvassing.js | /api/crm/canvass-pins | 5 | — |
| expenses.js | /api/crm/expenses | 5 | — |
| drift.js | /api/drift | 5 | — |
| alerts.js | /api/alerts | 4 | — |
| counties.js | /api/counties | 4 | — |
| dashboard.js | /api/dashboard | 3 | — |
| dataApis.js | /api/data | 3 | — |
| documents.js | /api/documents | 3 | — |
| map.js | /api/map | 3 | — |
| storms.js | /api/storms | 2 | — |
| stormHistory.js | /api/storm-history | 2 | — |
| search.js | /api/search | 1 | — |
| disasterDeclarations.js | /api/disaster-declarations | 1 | — |
| hearthWebhook.js | /api/webhooks/hearth | 1 | — |
| webhook.js | /api/webhooks | 1 | — |

**Database migrations:** 47 total (2 new: content_library table, tenant_settings KV store)

---

## Competitor Feature Matrix Cross-Reference

Cross-referencing `docs/competitor-gap-analysis.md` (2026-03-25 matrix) against actual code as of 2026-04-04:

| Feature | Matrix Status | Actual Status (2026-04-04) | Notes |
|---------|--------------|---------------------------|-------|
| **CRM & Pipeline** ||||
| Kanban pipeline | Match | ✅ Correct | 3 boards, drag-drop, conversion rates |
| **Pipeline deal values** | Not in matrix | ✅ Built | Cards show estimated_value, column totals |
| Contact management | Match | ✅ Correct | Full CRUD with activities |
| Lead source tracking | Match | ✅ Correct | Source field, filter, reports |
| Custom fields | Better | ✅ Correct | Free, unlimited, 7+ field types |
| Global search (Cmd-K) | Match | ✅ Correct | TopBar GlobalSearch |
| **Sales & Estimating** ||||
| Estimate builder | Better | ✅ Correct | Rich text, tiers, financing, templates |
| **Server-side PDF** | Not in matrix | ✅ **NEW** | pdfmake branded PDF generation |
| Estimate templates | Match | ✅ Correct | Template CRUD |
| E-signature | Match | ✅ Correct | Canvas-based on public pages |
| Estimate-to-invoice | Match | ✅ Correct | EstimatePicker in InvoicesView |
| **Invoicing & Payments** ||||
| Invoicing | Match | ✅ Correct | Full builder + A/R aging |
| Online payments | Better | ✅ Correct | Stripe Card + ACH, free |
| Financing | Match | ✅ Correct | Hearth integration |
| QuickBooks sync | **Missing** | ❌ **Still Missing** | No QB integration |
| **Scheduling & Tasks** ||||
| Calendar | Match | ✅ Correct | FullCalendar with drag-reschedule |
| Task management | Match | ✅ Correct | CRUD, priority, due dates |
| Work orders kanban | Better | ✅ Correct | 4-column + milestones + templates |
| **Storm Data & Maps** ||||
| Hail/wind/tornado maps | Better | ✅ Correct | NOAA, free, multi-layer |
| **Severity color graduation** | Not in matrix | ✅ **NEW** | All 3 types: hail, wind, tornado |
| Real-time storm alerts | Better | ✅ Correct | Free alerting |
| Weather history reports | Better | ✅ Correct | 10-year SWDI, PDF export |
| Honey Hole Finder | Missing in matrix | ✅ **Actually Built** | NOAA SWDI heatmap overlay |
| Historical data depth | Worse (30-day) | ⚠️ Improved | SWDI 10+ years; NWS storms still 30-day |
| **Canvassing** ||||
| GPS-verified pins | Match | ✅ Correct | Geolocation on pin drop |
| Territory/region assignment | Missing in matrix | ✅ **Actually Built** | PostGIS polygons + assignment |
| **Generate list from storm map** | Not in matrix | ✅ **NEW** | Creates canvass pins from storm properties |
| **Automation & Reporting** ||||
| Workflow automations | Better | ✅ Correct | Unlimited, free |
| Reports/analytics | Match | ✅ Correct | 6 chart types + comparison + drill-down |
| Profit tracker per job | Match | ✅ Correct | Estimate - expenses in LeadDetail |
| **Communication** ||||
| SMS texting | **Missing** | ❌ **Still Missing** | No Twilio integration |
| Email integration | Worse | ⚠️ Partial | SMTP + drip sequences, no inbox/thread |
| AI phone answering | **Missing** | ❌ **Still Missing** | Not feasible cheaply |
| Automated review requests | Missing in matrix | ✅ **Actually Built** | Google review link in Settings + LeadDetail |
| **AI Features** ||||
| AI content/marketing | Missing in matrix | ✅ **Actually Built** | Content Studio with batch + DB persistence |
| AI roof measurements | **Missing** | ⚠️ Partial | RoofDrawingTool exists, not satellite |
| Solar analysis | **Missing** | ⚠️ Partial | Google Solar API in LeadDetail |
| **Other** ||||
| Photo annotation | Missing in matrix | ✅ **Actually Built** | PhotoAnnotator in documents |
| Subcontractor mgmt | Missing in matrix | ✅ **Actually Built** | Full CRUD + assignment |
| Mobile app (native) | **Missing** | ❌ **Still Missing** | PWA only |
| Document management | Match | ✅ Correct | Upload, delete, annotate |
| Team management | Match | ✅ Correct | Invite, roles, delete |

---

## Code Quality Issues

### Silent Error Handling (35 occurrences across 12 files)
Files with the most `.catch(() => {})` blocks:
- LeadDetail.jsx: 9
- SettingsView.jsx: 9
- AdminDashboard.jsx: 3
- ContractsView.jsx: 3
- WorkOrdersView.jsx: 3
- Dashboard.jsx: 2
- Others: 6

### Remaining `alert()` Calls
- StormMap.jsx: Generate Canvassing List success message uses `alert()` instead of Toast

### Large Component Files (should consider splitting)
- LeadDetail.jsx: ~2,922 lines
- SettingsView.jsx: ~2,876 lines
- StormMap.jsx: ~2,850 lines
- EstimatesView.jsx: ~2,400 lines
- Dashboard.jsx: ~1,640 lines

---

## Summary Statistics

| Metric | 2026-04-03 | 2026-04-04 | Change |
|--------|------------|------------|--------|
| Protected routes | 22 | 22 | — |
| Public routes | 6 | 6 | — |
| Backend route files | 38 | 39 | +1 |
| Backend endpoints | 248 | 271 | +23 |
| DB migrations | 45 | 47 | +2 |
| Sidebar nav items | 17 | 17 | — |
| Settings tabs | 15 | 15 | — |
| Silent catch blocks | ~35 | 35 | — |
| Identified bugs | 2 | 0 | **All fixed** |
| Identified stubs | 1 | 0 | **All fixed** |
| Features "Missing" in matrix but actually built | 5 | 6 | +1 (storm→canvass list) |
| Features still truly missing vs competitors | 4 | 4 | — (QB, SMS, Native, AI Phone) |

---

## Top 10 Improvement Opportunities

Ranked by competitive impact and feasibility:

### 1. QuickBooks Sync — CRITICAL GAP
**Impact:** High (JobNimbus + RoofLink both have it; contractors expect it for accounting)
**Effort:** Medium (QB API has free tier for small apps)
**Current state:** Zero implementation. No QB route files, no OAuth flow.
**What to build:** OAuth connection in Settings, one-way invoice push to QBO, optional payment sync back.

### 2. SMS/Texting Integration — CRITICAL GAP
**Impact:** High (JobNimbus charges $49-249/mo; contractors expect texting)
**Effort:** Medium (Twilio ~$0.0075/msg, pass-through cost)
**Current state:** SMS activity type exists in LeadDetail UI but sends nothing.
**What to build:** Twilio adapter, send SMS from LeadDetail, appointment reminders, two-way threading.

### 3. Calendar Click-to-Create — MISSING FEATURE
**Impact:** Medium-High (all CRM competitors have this)
**Effort:** Low (CalendarView is only 149 lines — thinnest page in the app)
**Current state:** Can view and drag-reschedule, but cannot click empty slot to create new task/event.
**What to build:** dateClick handler → open task creation modal pre-filled with selected date/time.

### 4. Silent Error Handling — SYSTEMATIC ISSUE (35 occurrences)
**Impact:** Medium-High (users get no feedback when actions fail; leads to confusion/data loss)
**Effort:** Medium (systematic, touches 12 files)
**Current state:** 35 `.catch(() => {})` blocks across LeadDetail (9), SettingsView (9), AdminDashboard (3), ContractsView (3), WorkOrdersView (3), and 6 other files.
**What to fix:** Replace with toast notifications on user-initiated actions.

### 5. Pipeline — @dnd-kit Migration — MOBILE GAP
**Impact:** Medium (HTML5 drag API has poor mobile touch support; Pipeline is a core feature)
**Effort:** Medium
**Current state:** Pipeline.jsx + WorkOrdersView.jsx both use HTML5 drag API.
**What to build:** Migrate to @dnd-kit for proper touch/mobile drag support, accessibility.

### 6. Email Inbox / Thread View — COMPETITOR GAP
**Impact:** Medium (JobNimbus has full email integration)
**Effort:** Large (needs IMAP or email API service)
**Current state:** Can send via SMTP + drip sequences. No inbox, no thread view, no reply tracking.
**What to build:** At minimum, sent email history per lead. Full inbox needs major infrastructure.

### 7. Historical Storm Data Expansion — DATA GAP
**Impact:** Medium (HailTrace has 10+ years; NWS storm swaths limited to 30-day rolling window)
**Effort:** Medium (NOAA SPC SVRGIS has 70+ years of free data)
**Current state:** SWDI hail history gives 10+ years for Honey Hole heatmap, but actual storm swath polygons are 30-day NWS only.
**What to build:** Ingest SPC SVRGIS historical storm shapefiles, expand time range selector.

### 8. Storm Map — Replace `alert()` with Toast + Improve UX
**Impact:** Low-Medium (professional UX)
**Effort:** Very Low
**Current state:** "Generate Canvassing List" success uses browser `alert()`. Hidden DOM elements suggest incomplete refactoring.
**What to fix:** Replace `alert()` with Toast, clean up hidden controls.

### 9. Large Component Refactoring
**Impact:** Low-Medium (developer productivity, maintenance)
**Effort:** Medium-Large
**Current state:** 5 components over 1,500 lines (LeadDetail ~3K, SettingsView ~2.9K, StormMap ~2.8K, EstimatesView ~2.4K, Dashboard ~1.6K).
**What to do:** Split into sub-components (e.g., LeadDetail → LeadHeader, LeadFinancing, LeadActivities, etc.).

### 10. AI Assistant / Chat — COMPETITOR TREND
**Impact:** Medium (JobNimbus has AssistAI $298/mo + Scout; Rooftops.ai has GPT-5 for $12/mo; QuoteIQ includes AI on all plans)
**Effort:** Medium-Large (LLM API costs, but cheap models available)
**Current state:** Content Studio generates marketing content, but no general AI assistant, no voice commands, no smart form filling.
**What to build:** Chat panel in sidebar, context-aware suggestions (e.g., "this lead hasn't been contacted in 14 days"), auto-draft emails/notes.
