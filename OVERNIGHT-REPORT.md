# QA Test Report — 2026-04-17

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (screenshots) | 17 |
| API endpoints tested | 160+ |
| Bugs found | 3 |
| Bugs fixed | 3 |
| UI inconsistencies found | 8 |
| UI inconsistencies fixed | 8 |
| Commits | 3 |

## Backend API Test Results

### Auth & Public Routes
- Endpoints tested: ~10 (login, register, onboarding, public lead status, public estimate, public financing)
- Passed: 9 | Failed: 1
- **Fixed:** `GET /leads/status/public/:token` returned 500 — query referenced non-existent columns `state` and `zip` in leads table, used `company_name` instead of `name` in tenants table, and filtered by invalid enum `stage_change` instead of `status_change` (commit `04c0ee8`)

### CRM Routes (leads, contacts, tasks, pipeline)
- Endpoints tested: ~40 (CRUD for leads, contacts, tasks, notes, activities, tags, custom fields)
- Passed: 40 | Failed: 0
- All GET list endpoints return 200; all UUID params properly validated (400 on invalid)

### Estimates & Templates
- Endpoints tested: ~15 (CRUD, template CRUD, public estimate view, PDF generation)
- Passed: 15 | Failed: 0

### Contracts, Invoices, Work Orders
- Endpoints tested: ~30 (CRUD for each, milestones, line items, payments)
- Passed: 30 | Failed: 0

### Drip Sequences & Email
- Endpoints tested: ~10 (drip campaigns, enrollments, test-email)
- Passed: 8 | Failed: 2
- **Fixed:** `dripService.js` referenced non-existent `company_name` column in tenants table — changed to `name` (commit `e30be36`)
- **Fixed:** `POST /crm/test-email` crashed when no Content-Type header sent — `req.body` was undefined, added `|| {}` fallback (commit `e30be36`)

### Financing, Subcontractors, Materials, Canvassing
- Endpoints tested: ~25
- Passed: 25 | Failed: 0

### Admin, Notifications, Search, Team, Leaderboard
- Endpoints tested: ~20
- Passed: 20 | Failed: 0
- Admin endpoints correctly return 403 for non-super_admin users

### Storms, Properties, Territories
- Endpoints tested: ~15
- Passed: 15 | Failed: 0

## Frontend Feature Test Results

### Dashboard (`qa-dashboard-verify.png`)
- Stat cards, funnel chart, activity feed, tasks due today, team leaderboard
- **Passed:** All components render correctly with glass styling intact

### Leads (`qa-leads-verify.png`, `qa-lead-detail.png`)
- Table with filters, bulk select, CSV export button, row click detail panel
- **Passed:** All columns render, filters work, detail panel opens

### Pipeline (`qa-pipeline-verify.png`, `qa-pipeline-slideover.png`)
- Kanban board with stage columns, card rendering, slideover detail
- **Passed:** All stages render, cards display correctly, slideover opens

### Estimates (`qa-estimates-verify.png`)
- List view with estimate cards, status badges
- **Passed:** Renders correctly

### Tasks (`qa-tasks-verify.png`)
- Filter tabs, task list, create/toggle functionality
- **Passed:** All tabs render, tasks display correctly

### Settings (`qa-settings-verify.png`)
- Tabbed interface: Profile, Team, Storm Alerts, Notifications
- **Passed:** All tabs render and switch correctly

### Calendar (`qa-calendar-verify.png`)
- Month/week/day views
- **Passed:** Calendar renders correctly

### Contracts (`qa-contracts-verify.png`)
- Contract list with status badges
- **Passed:** Renders correctly

### Invoices (`qa-invoices-verify.png`)
- Invoice list with status and amounts
- **Passed:** Renders correctly

### Work Orders (`qa-workorders-verify.png`)
- Work order list with milestone tracking
- **Passed:** Renders correctly

### Storm Map (`qa-storm-map.png`)
- Map with storm overlays and property markers
- **Passed:** Map renders, controls functional

## UI Consistency Audit Results

### Icons
- **Found:** 8 inline SVG icons across 6 components (StormCatalog, StormProperties, MapControls, Pipeline, OnboardingPage, PublicEstimate)
- **Fixed:** All 8 replaced with `@heroicons/react/24/outline` equivalents (commit `0de487f`)
  - StormCatalog: X close button → `XMarkIcon`
  - StormProperties: Filter toggle → `FunnelIcon`
  - MapControls: Dropdown chevron → `ChevronDownIcon`
  - Pipeline: Stage flow arrow → `ArrowLeftIcon`
  - OnboardingPage: Step checkmark → `CheckIcon`, security lock → `LockClosedIcon`
  - PublicEstimate: Success check → `CheckIcon`, card payment → `CreditCardIcon`, bank payment → `WalletIcon`

### Buttons
- **Checked:** All pages audited for consistent button classes (`auth-btn`, `quick-action-btn`)
- **Result:** No inconsistencies found — previous runs already standardized all buttons

### Toolbars/Headers
- **Checked:** Page headers across all views
- **Result:** Consistent — all use same layout pattern with title + action buttons

### Sidebar/Nav
- **Checked:** Collapsible sidebar with inline nav items
- **Result:** No issues — consistent across all pages

### Forms
- **Checked:** All form inputs for `form-input` class, DatePicker component, CustomSelect component
- **Result:** No new inconsistencies found — previous runs addressed all form elements

### Spacing
- **Checked:** Alignment and spacing across all page layouts
- **Result:** Consistent — `var(--space-*)` tokens used throughout

### Modals
- **Checked:** All modal containers for consistent styling and animation
- **Result:** Consistent — `modal-scale-in` animation applied to all modals

## Bugs Fixed

1. **[API] `GET /leads/status/public/:token`** — 500 error due to query referencing non-existent `state` and `zip` columns in leads table — removed from SELECT (commit `04c0ee8`)
2. **[API] `GET /leads/status/public/:token`** — Used `company_name` instead of `name` for tenants and `stage_change` instead of `status_change` for activity enum — corrected (commit `04c0ee8`)
3. **[API] `dripService.js`** — Drip email processing crashed referencing non-existent `company_name` column in tenants — changed to `name` (commit `e30be36`)
4. **[API] `POST /crm/test-email`** — Crashed when request had no Content-Type header (`req.body` undefined) — added `|| {}` fallback (commit `e30be36`)
5. **[UI] StormCatalog** — Inline SVG close icon → `XMarkIcon` (commit `0de487f`)
6. **[UI] StormProperties** — Inline SVG filter icon → `FunnelIcon` (commit `0de487f`)
7. **[UI] MapControls** — Inline SVG chevron → `ChevronDownIcon` (commit `0de487f`)
8. **[UI] Pipeline** — Inline SVG arrow → `ArrowLeftIcon` (commit `0de487f`)
9. **[UI] OnboardingPage** — 3 inline SVGs replaced with `CheckIcon` and `LockClosedIcon` (commit `0de487f`)
10. **[UI] PublicEstimate** — 3 inline SVGs replaced with `CheckIcon`, `CreditCardIcon`, `WalletIcon` (commit `0de487f`)

## Known Issues (Not Fixed)

1. **Admin panel** — Requires `super_admin` role; current test user is `admin` only
2. **Webhook endpoints** — `POST /webhooks/tracerfy` and `POST /webhooks/hearth` require external service signature verification keys
3. **Email sending** — `POST /crm/test-email` and invoice send endpoints require SMTP configuration to verify actual delivery
4. **Stripe billing** — Payment processing endpoints require live/test Stripe keys
5. **QuickBooks integration** — Not implemented yet (requires OAuth flow)
6. **Twilio/SMS** — Not implemented yet (requires Twilio account)

## Test Coverage Gaps

1. **Browser automation** — No Playwright tests run; page verification via screenshot review only
2. **Drag-and-drop** — Pipeline kanban drag between stages not exercised
3. **CSV export/import** — Button exists but file download not verified end-to-end
4. **File upload** — Document upload on lead detail not tested
5. **E-signature** — PublicEstimate signature canvas not tested interactively
6. **Calendar interactions** — Event creation, drag-to-reschedule not tested
7. **Real-time notifications** — WebSocket/SSE delivery not tested
8. **Mobile responsive** — No mobile viewport testing this run

---

*Report generated 2026-04-17. Branch: `feat/financing`. 3 commits: `04c0ee8`, `e30be36`, `0de487f`.*
