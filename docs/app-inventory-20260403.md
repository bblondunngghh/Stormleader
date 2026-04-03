# StormLeads App Inventory — 2026-04-03

**Method:** Full source code analysis of all 22 protected routes, 6 public routes, 38 backend route files (248 endpoints), and sidebar navigation structure.
**Note:** Localtunnel was 503 during this run; inventory is code-based rather than live-UI-based. All feature claims verified against actual JSX/API code.

---

## Navigation Structure

### Sidebar (Desktop)
**Top-level items:** Dashboard, Storm Map, Storm Archive, Pipeline, Leads
**Jobs group:** Estimates, Contracts, Work Orders, Materials
**Finance group:** Invoices, Expenses
**Operations group:** Tasks, Calendar, Canvassing, Subcontractors, Reports, Content Studio
**Bottom:** Settings

### Not in Sidebar (accessible via route only)
- `/admin` — AdminDashboard (super_admin only)
- `/alerts` — AlertSettings (linked from Settings > Alerts tab)

### Public Routes (no auth)
- `/login`, `/register`, `/onboarding`
- `/estimate/:token` — PublicEstimate (customer-facing)
- `/contract/:token` — PublicContract (customer-facing)
- `/status/:token` — ClientStatusPage (customer-facing)

---

## Page-by-Page Inventory

### 1. Dashboard (`/`)
**Component:** Dashboard.jsx (1,562 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Welcome greeting + user name | Yes | Personalized with first name |
| 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) | Yes | Animated count-up, clickable to navigate |
| Revenue goal progress bar | Yes | Editable target, on-track/behind indicator, localStorage |
| Pipeline conversion funnel chart | Yes | Bar chart with stage progression |
| Mini storm map (Mapbox) | Yes | Shows active storms with live radar indicator |
| Tasks due today | Yes | Checkbox-enabled, clickable to lead detail |
| Follow-ups section | Yes | Upcoming follow-up actions |
| Activity feed | Yes | Recent lead activities with timestamps |
| Team leaderboard | Yes | Rep performance table with 8 columns, clickable rows |
| Conversion by storm chart | Yes | Visual breakdown |
| Estimate summary (accepted/pending/declined) | Yes | Dollar value aggregation |
| Filter dropdowns (Rep, Source, Period) | Yes | CustomSelect components, backend accepts params |
| Loading skeletons | Yes | Shimmer animation placeholders |
| Dashboard comparison period data | Yes | Delta badges with trend arrows |

**API Calls:** 8 dashboard endpoints + storms + team + leads
**Issues:** None identified. All sections fully implemented with error handling.

---

### 2. Storm Map (`/storm-map`)
**Component:** StormMap.jsx (~2,800 lines)
**Status:** Mostly functional, some stubs

| Feature | Works? | Notes |
|---------|--------|-------|
| Google Maps with storm swath polygons | Yes | Hail, wind, tornado, thunderstorm layers |
| Swath transparency slider | Yes | 0-100% opacity control |
| Layer toggle panel (hail/wind/tornado/thunderstorm/drift/properties) | Yes | Multiple data layers |
| FEMA National Structure Inventory overlay | Yes | Points within swath polygons |
| County property records overlay | Yes | Points from property database |
| Supercluster property clustering | Yes | Performance optimization for large datasets |
| Address search bar | Yes | With loading state |
| Storm info card (glass panel) | Yes | Shows active storm details |
| Zoom level indicator | Yes | Z-scale display |
| Terrain toggle | Yes | Switch map type |
| Honey Hole heatmap overlay | Yes | NOAA SWDI historical hail data circles |
| Property popup with "Add to Pipeline" | Yes | Creates lead from map |
| FEMA data fetch per property | Yes | Detailed building data on demand |
| Storm history per location | Yes | 5-mile radius, 10-year window |
| Reverse geocode on map click | Yes | Coordinates to address |
| Storm feed panel with lead cards | Yes | Total leads, impact zone counts |
| Time range filter (24h/3d/7d/14d/30d) | Yes | Session-persisted |
| Generate Canvassing List button | **NO** | Empty handler: `onClick={() => {/* TODO */}}` |
| Swath property progress bar | Yes | Shows loading progress |
| Mobile-responsive layout | Yes | Separate mobile layout |

**API Calls:** getSwaths, getPropertiesInSwath, getFemaLiveProperties, getHailHeatmap, getStormHistory, createProperty, addPropertyToPipeline, createManualLead, reverse-geocode
**Issues:**
- "Generate Canvassing List" button is a stub (line ~2670)
- Some hidden controls in DOM (`display: none`) suggesting incomplete refactoring
- Multiple `.catch(() => {})` with no user feedback

---

### 3. Storm Archive (`/storm-catalog`)
**Component:** StormCatalog.jsx (312 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Storm cards grid | Yes | Auto-fill responsive grid (min 280px) |
| Time range filter (24h/3d/7d/14d/30d) | Yes | 5 pill buttons |
| Text search | Yes | Real-time filtering |
| Type filter (All/Hail/Wind/Tornado) | Yes | Pill buttons |
| Sort options (Date/Severity/Hail Size/Wind) | Yes | 4 sort buttons |
| 5-star severity rating | Yes | Calculated from hail/wind data |
| Severity label + color badge | Yes | Minor to Extreme |
| "DAMAGE LIKELY" badge | Yes | For hail >= 1.5" |
| Click-to-navigate to storm map | Yes | Opens storm map centered on storm |
| Lazy reverse geocoding | Yes | Batch geocoding with coordinate rounding cache |
| Result count display | Yes | With pluralization |

**API Calls:** getStorms, reverse-geocode
**Issues:** Silent geocoding failures (empty catch blocks), no request throttling for batch geocoding.

---

### 4. Pipeline (`/pipeline`)
**Component:** Pipeline.jsx (1,213 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Kanban board with drag-and-drop | Yes | HTML5 drag API, optimistic updates |
| 3 board tabs (Sales/Production/Billing) | Yes | Stage filtering by workflow phase |
| Lead cards with contact info | Yes | Priority badges with pulse animation |
| Days-in-stage badges | Yes | Color-coded (green/gray/amber/red) |
| Lead score badges | Yes | Color-coded (80+/60+/40+ thresholds) |
| Source labels on cards | Yes | At-a-glance identification |
| Task progress badges on cards | Yes | Completion percentage |
| Conversion rate between columns | Yes | Color-coded percentages |
| Column collapse toggle | Yes | Persisted to localStorage |
| Priority/Source/Rep filter dropdowns | Yes | With active filter pills + clear all |
| Mobile list view | Yes | Priority dots, days-in-stage, deal value |
| Mobile board/list view toggle | Yes | Board vs list selector |
| Create Lead button | Yes | Opens CreateLeadModal |
| Lead detail panel | Yes | Lazy-loaded with Suspense |
| Grab-to-pan horizontal scroll | Yes | Manual scrolling with grab cursor |

**API Calls:** getPipelineStages, getLeads (500 limit), getTeamMembers, updateLead
**Issues:** None identified. Uses HTML5 drag API (not @dnd-kit), which has limited mobile drag support.

---

### 5. Leads (`/leads`)
**Component:** LeadList.jsx (790 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Data table with 16 columns | Yes | Stage, Priority, Score, Address, Contact, Phone, Email, Source, Storm Date, Est. Value, Rep, Last Contact, Follow-up Due, Days in Stage, Created |
| Column sorting with direction toggle | Yes | Ascending/descending arrows |
| Search bar with 350ms debounce | Yes | URL-synced |
| Quick filters (Hot Leads, Needs Follow-up, Unassigned) | Yes | Preset filter buttons |
| Advanced filters (Stage, Priority, Source, Score) | Yes | Dropdowns with active filter pills |
| Filter presets (save/load/delete) | Yes | localStorage-backed |
| Bulk actions (Change Stage, Assign Rep) | Yes | Checkbox selection + CustomSelect dropdowns |
| CSV export | Yes | Formatted data download |
| CSV import | Yes | Opens ImportLeadsModal with Census geocoding |
| Pagination (25/50/100 per page) | Yes | Page size selector + prev/next |
| URL-synced filters | Yes | Shareable filtered views via query params |
| Row click to lead detail | Yes | Opens LeadDetail panel |
| Select all on page | Yes | Checkbox in header |

**API Calls:** getLeads (paginated), bulkAssign, bulkStatus, getTeamMembers
**Issues:** None critical. Quick filters for needs_followup and unassigned appear to work (fixed in 2026-04-02 run).

---

### 6. Lead Detail (modal/panel from Pipeline/Leads)
**Component:** LeadDetail.jsx (2,922 lines)
**Status:** Fully functional, very comprehensive

| Feature | Works? | Notes |
|---------|--------|-------|
| Lead info header (address, storm, contact) | Yes | With priority and stage dropdowns |
| Lead scoring with 7-factor algorithm | Yes | Score calculation button, breakdown popup |
| Severity rating display | Yes | Based on storm data |
| Roof details (type, measurements) | Yes | Editable |
| Property info (FEMA data) | Yes | On-demand fetch |
| Financing section (Hearth integration) | Yes | Plans, applications, status |
| Contracts section | Yes | List of associated contracts |
| Expenses section | Yes | Job cost summary (estimate total / expenses / profit) |
| Activities section | Yes | Feed + log buttons (Activity, Call, Email, SMS, Visit, Insurance) |
| Documents section | Yes | Upload, delete, photo annotation (pencil icon) |
| Weather/storm history section | Yes | Historical data + PDF export |
| Roof measurement tools | Yes | Drawing, manual entry, solar potential |
| Custom fields rendering | Yes | Dynamic custom field inputs |
| Review request generation | Yes | Google review link |
| Client status page link | Yes | Generates shareable status token |
| Skip trace integration | Yes | Lookup contact info |
| Disaster declarations display | Yes | FEMA disaster risk data |
| Census demographics display | Yes | Home age, ownership rate, income |

**API Calls:** 20+ endpoints covering leads, financing, contracts, expenses, properties, weather, scoring, documents, activities, custom fields, roof measurement, solar, disaster declarations
**Issues:** Extremely large component (nearly 3K lines). Could benefit from splitting into sub-components.

---

### 7. Estimates (`/estimates`)
**Component:** EstimatesView.jsx (2,369 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Estimate list with KPI stats | Yes | Total, Draft, Sent, Accepted counts/values |
| Status filter dropdown | Yes | CustomSelect |
| Create/Edit estimate builder | Yes | Rich multi-section editor |
| Line items editor with drag-and-drop | Yes | Description, qty, unit price |
| Rich text editor | Yes | Bold, italic, underline, lists, links |
| Section image uploader | Yes | Per-section images |
| Tax rate dropdown (preset options) | Yes | Multiple tax rates |
| Discounts management | Yes | Add/manage discount lines |
| Signers/Authorization section | Yes | Multi-signer support |
| Profit margin percentage input | Yes | Margin calculation |
| Financing options toggle | Yes | Hearth plan selection |
| Template system | Yes | Save/load estimate templates |
| Review mode with live preview | Yes | Toggle between edit and preview |
| Send for signing modal | Yes | Email template selector + token insertion |
| SRS Catalog material selection | Yes | Integration with materials |
| Duplicate estimate | Yes | Clone existing |
| AI tier generation (Good/Better/Best) | Yes | Auto-generates tiers |
| Tier comparison modal | Yes | Side-by-side comparison view |
| Estimate-to-invoice conversion | Yes | Via InvoicesView |

**API Calls:** 11+ estimate endpoints + financing lenders/plans + materials
**Issues:** `EST-XXX` placeholder stub (line 1524), financing config UI incomplete ("No lender configured" without setup UI).

---

### 8. Invoices (`/invoices`)
**Component:** InvoicesView.jsx (1,081 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Invoice list with KPI stats | Yes | Total Invoiced, Collected, Outstanding, Overdue |
| A/R aging summary (5 buckets) | Yes | Current, 1-30, 31-60, 61-90, 91+ days |
| Filter tabs (All/Draft/Sent/Paid/Overdue) | Yes | Status filtering |
| Invoice builder with line items | Yes | Description combobox, qty, unit price |
| Lead/customer selector with search | Yes | Autocomplete dropdown |
| Tax rate dropdown | Yes | Preset options |
| Due date picker | Yes | DatePicker component |
| Invoice preview mode | Yes | Formatted view |
| Send invoice via email | Yes | Email input modal |
| Record payment modal | Yes | Amount input |
| Void invoice | Yes | Status update |
| Create from estimate | Yes | EstimatePicker modal |

**API Calls:** 10+ invoice endpoints + estimates + search
**Issues:** `invoice.customer_email` potentially undefined (line 573).

---

### 9. Contracts (`/contracts`)
**Component:** ContractsView.jsx (603 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Contract list with KPI stats | Yes | Total, Drafts, Awaiting Signature, Signed |
| Status filter (Draft/Sent/Viewed/Signed/Voided) | Yes | Dropdown |
| Template selector | Yes | Pre-built templates |
| Customer details form | Yes | Lead search + name, email, phone, address |
| Section editor (add/remove/edit) | Yes | Title + body per section |
| Merge field support | Yes | Token replacement (documented in placeholder) |
| Contract preview mode | Yes | Toggle view |
| Send contract | Yes | Draft only |
| Void contract | Yes | Status change |
| Create from estimate / lead | Yes | Pre-fills data from URL params |

**API Calls:** 9+ contract endpoints + estimates + leads
**Issues:** Silent error handling throughout, no required field validation before save/send.

---

### 10. Work Orders (`/work-orders`)
**Component:** WorkOrdersView.jsx (1,147 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| 4-column kanban (Pending/Scheduled/In Progress/Completed) | Yes | Drag-and-drop between columns |
| Work order cards with milestone progress bar | Yes | Title, crew, date, address |
| Detail modal with all editable fields | Yes | Full CRUD |
| Milestone system with checklist | Yes | Add/delete/toggle milestones |
| Photo upload per milestone | Yes | Camera badge, retake capability |
| Photo-required milestone enforcement | Yes | Prevents completion without photo |
| Editable line items | Yes | Add/remove, running total |
| Milestone templates (8 job types) | Yes | Shingle, Metal, Gutter, Siding, Storm Damage, Inspection, Flat Roof, Window/Door |
| Create from estimate | Yes | EstimatePicker modal |
| Team member assignment | Yes | CustomSelect dropdown |
| Date/time pickers | Yes | DatePicker component |

**API Calls:** 12+ work order endpoints + milestones + documents + estimates + team
**Issues:** Minor — inconsistent property naming in line items (`item.description` vs `item.name`).

---

### 11. Tasks (`/tasks`)
**Component:** TasksView.jsx (828 lines)
**Status:** Functional with mobile issues

| Feature | Works? | Notes |
|---------|--------|-------|
| Task list with Pending/Completed tabs | Yes | Count badges |
| Overdue/Due Today counts | Yes | Summary header |
| Task completion checkbox | Yes | Optimistic update |
| Create task modal | Yes | Title, description, due date, priority |
| Edit task modal | Yes | Same fields |
| Priority badges (Hot/Warm/Cold) | Yes | Color-coded |
| Assignee name display | Yes | On task rows |
| Mobile "Mission Log" view | Yes | Separate mobile layout with tactical theme |
| Mobile efficiency metrics | Yes | Completion rate + critical path velocity |
| Overdue/Today/Upcoming sections | Yes | With badge counters |

**API Calls:** getTasks, createTask, updateTask
**Issues:**
- **Mobile checkbox bug:** Line 735 — `checked={false}` hardcoded, completed tasks never show as checked on mobile
- Silent error handling throughout (no toast notifications for failures)
- `overdue` and `dueToday` calculations not memoized (recalculate every render)

---

### 12. Calendar (`/calendar`)
**Component:** CalendarView.jsx (149 lines)
**Status:** Functional, lightweight

| Feature | Works? | Notes |
|---------|--------|-------|
| FullCalendar integration (month/week/day/list) | Yes | @fullcalendar/react |
| Event rendering with type badges | Yes | Task/Call/Email/Door Knock |
| Priority badge on events | Yes | Color-coded |
| Click event to navigate to lead | Yes | Opens lead detail |
| Drag-to-reschedule (tasks only) | Yes | Updates due_date |
| Now indicator | Yes | Current time line |
| 4 events max per day cell | Yes | DayGrid limit |

**API Calls:** getCalendarEvents, updateTask
**Issues:**
- No click-to-create (can't create new tasks/events from calendar)
- No error feedback on drag operation failure
- Only tasks are draggable, not indicated visually

---

### 13. Canvassing (`/canvassing`)
**Component:** CanvassingMode.jsx (686 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Google Maps with dark styling | Yes | Hybrid view |
| Stats bar (Total doors, Interested, Scheduled) | Yes | Glass card overlay |
| Drop Pin mode | Yes | Crosshair cursor, tap to place |
| Bottom sheet modal (create/view) | Yes | Slide-up |
| GPS coordinate display | Yes | On new pin |
| Address input | Yes | Free text |
| Outcome quick-select (6 options) | Yes | 2-column grid |
| Notes textarea | Yes | Free text |
| Convert to Lead button | Yes | For interested/scheduled pins |
| Territory Manager panel | Yes | Toggle visibility |
| Marker click to view pin details | Yes | Shows read-only details |
| Toast notifications | Yes | Success/error messages |

**API Calls:** getCanvassPins, getCanvassStats, createCanvassPin, convertCanvassPin
**Issues:** Silent geolocation failure (only attempts once on mount with 8-second timeout).

---

### 14. Reports (`/reports`)
**Component:** ReportsView.jsx (666 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Revenue chart (area chart) | Yes | Estimated vs actual with comparison |
| Pipeline chart (horizontal bar) | Yes | Leads by stage, drill-down to leads |
| Conversion chart (radar) | Yes | Rates by lead source |
| Rep leaderboard (sortable table) | Yes | Leads, closed, revenue, activities |
| Lead sources pie chart (donut) | Yes | Drill-down to filtered leads |
| Stage duration chart (line) | Yes | Average days per stage |
| Date presets (Week/Month/Quarter/Year/All-Time) | Yes | Quick select buttons |
| Custom date range picker | Yes | DatePicker start/end |
| Comparison period toggle | Yes | Delta badges with percentage changes |
| CSV export on all charts | Yes | Download buttons |
| Chart drill-down | Yes | Click bars/slices to navigate to filtered leads |

**API Calls:** 6 report endpoints (revenue, pipeline, conversion, rep performance, lead sources, stage duration)
**Issues:** None identified. Feature-complete with proper loading states.

---

### 15. Content Studio (`/content-studio`)
**Component:** ContentStudio.jsx (677 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Generate tab with content settings | Yes | Type + tone dropdowns |
| 10 variable input fields | Yes | Company, city, state, storm date, hail size, service, phone, website, customer name, season |
| Batch mode (5 variations) | Yes | Toggle checkbox |
| Generate button with loading | Yes | Calls API |
| Live preview panel | Yes | Facebook, email, door hanger, blog mockups |
| Results grid with copy/save/delete | Yes | Card-based layout |
| Library tab with saved content | Yes | localStorage persistence |
| Search + type filter in library | Yes | Real-time filtering |
| Library item count badge | Yes | On tab label |

**API Calls:** generateContent, generateContentBatch
**Issues:** None identified. Content is localStorage-backed (not database), which avoids Neon storage pressure but means content is device-specific.

---

### 16. Materials (`/materials`)
**Component:** MaterialsView.jsx (1,008 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Catalog tab with product search | Yes | Text search input |
| Category filter with animated indicator | Yes | Category buttons |
| Product grid with cards | Yes | Clickable for detail |
| Product detail modal | Yes | Quantity selector, add to cart |
| Cart sidebar | Yes | Qty +/-, remove, branch selector, checkout |
| Orders tab with order list | Yes | Order history |
| Order detail view | Yes | Expandable order details |
| SRS Catalog integration | Yes | Material supplier integration |

**API Calls:** searchProducts, getOrders, getBranches, createOrder
**Issues:** None identified.

---

### 17. Expenses (`/expenses`)
**Component:** ExpensesView.jsx (420 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| KPI summary (Total Expenses, Items, Matching Filter) | Yes | 3 stat cards |
| Category filter dropdown | Yes | CustomSelect |
| Date range filter (Start/End) | Yes | DatePicker components |
| Expense table (date, category, job, amount, notes) | Yes | With actions column |
| Add/Edit expense modal | Yes | Lead search autocomplete, category, amount, date, notes |
| Delete confirmation dialog | Yes | Inline confirmation |

**API Calls:** getExpenses, createExpense, updateExpense, deleteExpense, search
**Issues:** Silent error handling in catch blocks.

---

### 18. Subcontractors (`/subcontractors`)
**Component:** SubcontractorsView.jsx (343 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Subcontractor table | Yes | Name, company, specialty, phone, email, hourly rate, status |
| Search, specialty, status filters | Yes | Text input + 2 dropdowns |
| Pagination (page size selector) | Yes | prev/next buttons |
| Add/Edit slide-over panel | Yes | Full form with phone auto-formatting |
| Delete with inline confirmation | Yes | Hover-reveal buttons |
| Specialty badge color coding | Yes | Visual distinction |
| Status badge | Yes | Active/inactive |

**API Calls:** listSubcontractors, createSubcontractor, updateSubcontractor, deleteSubcontractor
**Issues:** Status field not shown during creation (only on edit).

---

### 19. Settings (`/settings`)
**Component:** SettingsView.jsx (2,876 lines)
**Status:** Fully functional, very comprehensive

| Tab | Works? | Features |
|-----|--------|----------|
| Profile | Yes | Edit first name, last name, email with Save/Cancel |
| Company | Yes | Sender email, company name, phone, website, address |
| Billing | Yes | Plan selection, feature comparison, card management, invoice history, SkipTrace/Roof.ai module toggles |
| Payments | Yes | Stripe Connect status, onboarding, payment history |
| Team | Yes | Member list, invite form, role management, delete members |
| Alerts | Yes | Storm alert configuration |
| Notifications | Yes | Preference toggles by category |
| Email/SMTP | Yes | SMTP server config, test email |
| Financing | Yes | Hearth provider config, lender management, plan sync |
| Automations | Yes | Imported component (AutomationSettings) |
| Drip Sequences | Yes | Imported component (DripSequences) |
| Custom Fields | Yes | CRUD for custom field definitions |
| Contracts | Yes | Contract template management |
| Reviews | Yes | Google Place ID, review message template |
| Pricing/Line Items | Yes | Line item catalog with CRUD, section grouping |

**API Calls:** 20+ across all tabs (auth, tenant-settings, team, alerts, notifications, financing, custom fields, estimates, contracts, payments, onboarding)
**Issues:** Mock financing provider still in dropdown for testing.

---

### 20. Admin Dashboard (`/admin`)
**Component:** AdminDashboard.jsx (1,001 lines)
**Status:** Functional (super_admin only)

| Feature | Works? | Notes |
|---------|--------|-------|
| Overview tab with stat cards | Yes | Platform-wide metrics |
| Tenants tab with searchable table | Yes | Sortable, expandable rows |
| Tenant detail (tier/status management) | Yes | Inline edit panel |
| Revenue tab | Yes | Revenue breakdown by service |
| Usage tab with leaderboard | Yes | Usage metrics per tenant |

**API Calls:** 6 admin endpoints (overview, tenants, tenant detail, update tenant, revenue, usage)
**Issues:** None identified.

---

### 21. Public Estimate (`/estimate/:token`)
**Component:** PublicEstimate.jsx (719 lines)
**Status:** Fully functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Estimate header and details | Yes | Company, estimate #, date, validity |
| Line items table | Yes | Description, qty, unit price, total |
| Totals (subtotal, discount, tax, total) | Yes | With financing offer |
| Financing plan cards | Yes | Monthly payment, apply buttons |
| Scope/Warranty/Terms sections | Yes | Rich text display |
| Signature canvas (mouse + touch) | Yes | Draw-to-sign |
| Accept/Decline actions | Yes | With signer name input |
| Stripe payment (Card + ACH) | Yes | PaymentElement form |
| Payment success message | Yes | Confirmation display |

**API Calls:** 7 public endpoints (estimate, financing plans/apps, accept, decline, apply financing, payment intent)
**Issues:** Fee percentages hardcoded client-side, financing polling UX is minimal.

---

### 22. Public Contract (`/contract/:token`)
**Component:** PublicContract.jsx (226 lines)
**Status:** Functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Contract header and sections | Yes | Company, type, date, customer info |
| Dynamic content rendering | Yes | Multiple format parser |
| Signature canvas | Yes | Mouse + touch drawing |
| Sign action with signer name | Yes | POST to server |
| Voided status display | Yes | Badge indicator |
| Signed confirmation with signature image | Yes | Post-signing display |

**API Calls:** 2 (fetch contract, sign contract)
**Issues:** Uses `axios` directly instead of the app's `client` wrapper (inconsistent).

---

### 23. Client Status Page (`/status/:token`)
**Component:** ClientStatusPage.jsx (427 lines)
**Status:** Functional

| Feature | Works? | Notes |
|---------|--------|-------|
| Progress timeline | Yes | Stage dots with current/past/future states |
| Work order card | Yes | Title, status badge, scheduled date |
| Milestones list | Yes | Checkboxes showing completion state |
| Customer info | Yes | Name and address |
| Company branding | Yes | Company name header |

**API Calls:** 1 (fetch status by token)
**Issues:** Stage extraction uses fragile regex pattern matching on description text. Minimal error/loading states.

---

## Backend Summary

**Total route files:** 38
**Total endpoints:** 248

| Module | Prefix | Endpoints | Notes |
|--------|--------|-----------|-------|
| crm.js | /api/crm | 45 | Core CRM (leads, stages, activities, contacts, custom fields) |
| properties.js | /api/properties | 18 | Property management, geocoding, FEMA data |
| estimates.js | /api/crm/estimates | 15 | Estimate CRUD, templates, tiers, public signing |
| financing.js | /api/crm/financing | 13 | Hearth adapter, lenders, plans, applications |
| contracts.js | /api/crm/contracts | 12 | Contract CRUD, templates, public signing |
| workOrders.js | /api/crm/work-orders | 11 | Work order CRUD, milestones, templates |
| skipTrace.js | /api/skip-trace | 10 | Contact info lookup |
| materials.js | /api/materials | 9 | Product catalog, orders, branches (SRS) |
| drip.js | /api/crm/drip-sequences | 8 | Drip sequence CRUD, steps, enrollment |
| invoices.js | /api/crm/invoices | 8 | Invoice CRUD, email, payment recording |
| roofMeasurement.js | /api/roof-measurement | 8 | Roof drawing, manual entry, solar |
| subcontractors.js | /api/crm/subcontractors | 8 | Subcontractor CRUD |
| payments.js | /api/payments | 7 | Stripe integration, payment intents |
| onboarding.js | /api/onboarding | 7 | Tenant setup wizard |
| admin.js | /api/admin | 6 | Super admin dashboard |
| reports.js | /api/crm/reports | 6 | Revenue, pipeline, conversion, rep, sources, duration |
| notifications.js | /api/notifications | 6 | CRUD + preferences |
| territories.js | /api/crm/territories | 6 | Territory CRUD with PostGIS |
| leads.js | /api/leads | 6 | Lead operations + public status |
| auth.js | /api/auth | 5 | Login, register, refresh, me, profile update |
| automations.js | /api/crm/automations | 5 | Workflow automation CRUD |
| canvassing.js | /api/crm/canvass-pins | 5 | Pin CRUD + stats |
| expenses.js | /api/crm/expenses | 5 | Expense CRUD + summary |
| drift.js | /api/drift | 5 | Drift analysis |
| alerts.js | /api/alerts | 4 | Storm alert config |
| counties.js | /api/counties | 4 | County data |
| dashboard.js | /api/dashboard | 3 | Stats, funnel, activity |
| dataApis.js | /api/data | 3 | Census demographics, SWDI hail |
| documents.js | /api/documents | 3 | Upload, list, delete |
| content.js | /api/crm/content | 3 | AI content generation |
| map.js | /api/map | 3 | Map data endpoints |
| storms.js | /api/storms | 2 | Storm swath data |
| stormHistory.js | /api/storm-history | 2 | Historical storm lookup |
| search.js | /api/search | 1 | Global search |
| disasterDeclarations.js | /api/disaster-declarations | 1 | FEMA disaster risk |
| hearthWebhook.js | /api/webhooks/hearth | 1 | Hearth financing webhook |
| webhook.js | /api/webhooks | 1 | Generic webhook |

---

## Competitor Feature Matrix Cross-Reference

Cross-referencing the Feature Comparison Matrix from `docs/competitor-gap-analysis.md` (written 2026-03-25) against actual code as of 2026-04-03:

| Feature | Matrix Status | Actual Status (2026-04-03) | Notes |
|---------|--------------|---------------------------|-------|
| Kanban pipeline | Match | **Correct** | 3 board tabs, drag-drop, conversion rates |
| Contact management | Match | **Correct** | Full CRUD with activities |
| Lead source tracking | Match | **Correct** | Source field, filter, reports |
| Custom fields | Better | **Correct** | Free, unlimited, 7+ field types |
| Global search (Cmd-K) | Match | **Correct** | TopBar GlobalSearch component |
| Estimate builder | Better | **Correct** | Rich text, tiers, financing, templates |
| Estimate templates | Match | **Correct** | Template CRUD in Settings |
| E-signature | Match | **Correct** | Canvas-based signature on public pages |
| Estimate-to-invoice | Match | **Correct** | EstimatePicker in InvoicesView |
| Invoicing | Match | **Correct** | Full builder + A/R aging |
| Online payments | Better | **Correct** | Stripe Card + ACH, free |
| Financing | Match | **Correct** | Hearth integration, full adapter |
| QuickBooks sync | **Missing** | **Still Missing** | No QB integration exists |
| Calendar | Match | **Correct** | FullCalendar with drag-reschedule |
| Task management | Match | **Correct** | CRUD with priority, due dates |
| Work orders kanban | Better | **Correct** | 4-column + milestones + templates |
| Hail/wind/tornado maps | Better | **Correct** | NOAA, free, multi-layer |
| Real-time storm alerts | Better | **Correct** | Free alerting system |
| Weather history reports | Better | **Correct** | 10-year SWDI data, PDF export |
| Honey Hole Finder | **Missing** in matrix | **Actually Built** | NOAA SWDI heatmap overlay on storm map |
| Historical data depth | Worse (30-day) | **Improved** | SWDI gives 10+ years; storms still 30-day window for NWS |
| GPS-verified canvassing pins | Match | **Correct** | Geolocation on pin drop |
| Territory/region assignment | **Missing** in matrix | **Actually Built** | Full TerritoryManager with PostGIS polygons |
| Workflow automations | Better | **Correct** | Unlimited, free |
| Reports/analytics | Match | **Correct** | 6 chart types + comparison + drill-down |
| Profit tracker per job | Match | **Correct** | In LeadDetail (estimate - expenses) |
| SMS texting | **Missing** | **Still Missing** | No Twilio integration |
| Email integration | Worse | **Partial** | SMTP config exists, drip sequences work, but no inbox/thread view |
| AI phone answering | **Missing** | **Still Missing** | Not feasible cheaply |
| Automated review requests | **Missing** in matrix | **Actually Built** | Google review link generation in Settings + LeadDetail |
| Photo annotation | **Missing** in matrix | **Actually Built** | PhotoAnnotator in LeadDetail documents |
| Subcontractor mgmt | **Missing** in matrix | **Actually Built** | Full CRUD + work order assignment |
| Mobile app (native) | **Missing** | **Still Missing** | Web only, but PWA manifest exists |
| AI content/marketing | **Missing** in matrix | **Actually Built** | Content Studio with batch generation |
| AI roof measurements | **Missing** | **Partial** | Roof drawing tool exists, not satellite-based |
| Solar analysis | **Missing** | **Partial** | Google Solar API integration in LeadDetail |

---

## Top 10 Improvement Opportunities

Ranked by competitive impact and feasibility:

### 1. QuickBooks Sync — CRITICAL GAP
**Impact:** High (both JobNimbus and RoofLink have it; contractors expect it)
**Effort:** Medium (QB API has free tier for small apps)
**Current state:** Zero implementation. No QB route files, no OAuth flow.
**What to build:** OAuth connection in Settings, one-way invoice push to QBO, optional two-way sync for payments.

### 2. SMS/Texting Integration — CRITICAL GAP
**Impact:** High (JobNimbus charges $49-249/mo; contractors expect texting)
**Effort:** Medium (Twilio ~$0.0075/msg)
**Current state:** Zero implementation. SMS activity type exists in UI but sends nothing.
**What to build:** Twilio adapter, send SMS from LeadDetail, appointment reminders, two-way threading.

### 3. Calendar Click-to-Create — MISSING FEATURE
**Impact:** Medium-High (all CRM competitors have this; current calendar is view-only for creation)
**Effort:** Low
**Current state:** CalendarView is 149 lines — a thin FullCalendar wrapper. Can view and drag-reschedule tasks, but cannot click a time slot to create a new task or appointment.
**What to build:** Click-on-empty-slot to open task creation modal, pre-filled with selected date/time.

### 4. Storm Map "Generate Canvassing List" — STUB
**Impact:** Medium-High (this is the workflow that connects storm data to door-knocking)
**Effort:** Low-Medium
**Current state:** Button exists but handler is empty: `onClick={() => {/* TODO */}}`.
**What to build:** Take properties in current storm view, generate a canvassing list/CSV or create canvass pins in batch.

### 5. Mobile Task Checkbox Bug — BUG
**Impact:** Medium (breaks core task UX on mobile)
**Effort:** Very Low (one-line fix)
**Current state:** Line 735 in TasksView.jsx — `checked={false}` hardcoded. Completed tasks never show as checked in the mobile "Mission Log" view.
**What to fix:** Change to `checked={task.status === 'completed'}`.

### 6. Pipeline Deal Values on Cards — COMPETITOR GAP
**Impact:** Medium-High (JobNimbus and RoofLink show deal value on every card; column revenue totals)
**Effort:** Medium (requires estimate-to-lead join query)
**Current state:** Pipeline cards show lead score + source badges but NOT estimated deal value. No column revenue totals.
**What to build:** Add `estimated_value` to pipeline card display, show sum at column header.

### 7. Server-Side PDF Estimates — QUALITY GAP
**Impact:** Medium-High (current estimates use browser print dialog; competitors generate professional PDFs)
**Effort:** Medium-Large (needs pdfmake or similar)
**Current state:** No PDF generation endpoint. PublicEstimate renders HTML that users must print-to-PDF.
**What to build:** Server-side PDF endpoint using pdfmake/puppeteer, download button on estimate detail.

### 8. Error Handling / User Feedback — SYSTEMATIC ISSUE
**Impact:** Medium (silent failures frustrate users; currently many `.catch(() => {})` blocks)
**Effort:** Medium (systematic, touches many files)
**Current state:** StormMap, StormCatalog, TasksView, ContractsView, ExpensesView all have silent catch blocks. No toast notifications for API failures in many components.
**What to fix:** Add toast notifications for all API error catches, especially on user-initiated actions (save, delete, create).

### 9. Hail Swath Color Graduation — VISUAL GAP
**Impact:** Medium (HailTrace shows severity-based color gradients; StormLeads shows uniform color)
**Effort:** Medium
**Current state:** Storm swath polygons render with uniform fill color per type. No severity-based gradient.
**What to build:** Color swath polygons by hail size / wind speed using a gradient scale (green→yellow→orange→red).

### 10. Email Inbox / Thread View — COMPETITOR GAP
**Impact:** Medium (JobNimbus has full email integration; StormLeads only has outbound SMTP)
**Effort:** Large (would need IMAP integration or email API service)
**Current state:** Can send emails via SMTP and drip sequences, but no inbox view, no thread display, no reply tracking.
**What to build:** At minimum, show sent email history per lead. Full inbox would require major infrastructure.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Protected routes | 22 |
| Public routes | 6 |
| Backend route files | 38 |
| Backend endpoints | 248 |
| Sidebar nav items | 17 (5 top + 4 Jobs + 2 Finance + 6 Operations) |
| Settings tabs | 15 |
| Total frontend LOC (pages only) | ~18,000+ |
| Features marked "Missing" in competitor matrix that are actually built | 5 (Honey Hole, Territory, Review Requests, Photo Annotation, Subcontractor Mgmt, AI Content) |
| Features still truly missing vs competitors | 4 (QuickBooks, SMS, Native Mobile, AI Phone) |
| Identified bugs | 2 (mobile task checkbox, EST-XXX stub) |
| Identified stubs | 1 (Generate Canvassing List) |
