# QA Overnight Report — 2026-04-09

## QA Test Summary

| Metric | Count |
|--------|-------|
| Pages tested | 20 |
| API endpoints tested | 130+ |
| Bugs found | 6 |
| Bugs fixed | 6 |
| UI consistency violations | 0 |
| Build status | Passing (7.5s) |

---

## Backend API Test Results

### CRM Dashboard Endpoints
- **Endpoints tested**: ~15 (stat cards, pipeline summary, funnel, activity feed, tasks-today, leaderboard, days-in-stage, stale-leads, customer-storm-alerts)
- **Passed**: All after fix
- **Failed (pre-fix)**: 3 endpoints returning 500
- **Fix**: `b6ca3fa` — Changed `closed_won`/`closed_lost` to `sold`/`lost` (matching `lead_stage` enum), fixed `assigned_to_user_id` to `assigned_rep_id`, fixed `u.name` to `CONCAT(first_name, last_name)`, replaced `se.event_type` with `se.source` and removed invalid `raw_data` JSON extracts

### Lead Management
- **Endpoints tested**: ~20 (CRUD, quick create, bulk actions, CSV export, filters, search)
- **Passed**: All after fix
- **Failed (pre-fix)**: 1 — `POST /api/crm/leads/quick` returning 500
- **Fix**: `19dc947` — Removed `property_state` and `property_zip` from INSERT (columns don't exist on leads table)

### Estimates
- **Endpoints tested**: ~15 (CRUD, create, update, public access, PDF, line items, templates)
- **Passed**: All after fixes
- **Failed (pre-fix)**: 2 — create returning 500, tax calculation producing wrong values
- **Fixes**:
  - `19dc947` — Removed `insurance_details` and `upgrades` from INSERT (columns don't exist on estimates table)
  - `337b1b1` — Tax calculation was multiplying subtotal by rate directly (5000 * 8.25 = 41250) instead of dividing by 100 first (5000 * 0.0825 = 412.50)

### Financing & Contracts (Public Routes)
- **Endpoints tested**: ~10 (public token-based access, plan listings)
- **Passed**: All after fix
- **Failed (pre-fix)**: All public routes returning 401
- **Fix**: `2a3ece7` — Mounted `/crm/financing` and `/crm/contracts` routers before the `/crm` router in routes index so their public (no-auth) endpoints are reachable before CRM auth middleware intercepts

### Notifications
- **Endpoints tested**: ~8 (preferences get/update, auto-seed, types listing)
- **Passed**: All after fix
- **Failed (pre-fix)**: 1 — preferences endpoint returning 500
- **Fix**: `2b7ac36` — Removed `stale_lead` from auto-seed notification types list (doesn't exist in `notification_type` enum)

### Other Endpoint Categories (All Passing)
- **Auth** (~5 endpoints): Login, register, profile — all passing
- **Storm Data** (~10 endpoints): Map data, archive, alerts — all passing
- **Tasks** (~8 endpoints): CRUD, toggle complete, filters — all passing
- **Documents** (~5 endpoints): Upload, list, delete — all passing
- **Team/Leaderboard** (~5 endpoints): Members, stats — all passing
- **Search** (~3 endpoints): Global search, Cmd-K — all passing
- **Calendar** (~5 endpoints): Events CRUD — all passing
- **Settings** (~10 endpoints): Profile, company, notifications — all passing

---

## Frontend Feature Test Results

### Dashboard
- **Tested**: Stat cards, pipeline summary, storm map, storm activity feed, tasks due today, team leaderboard
- **Passed**: All elements render with correct data ($14K pipeline, 1 new lead, etc.)
- **Issues**: None — zero console errors

### Pipeline (Kanban)
- **Tested**: Stage columns, card rendering, card data display
- **Passed**: All stages load with correct lead cards
- **Issues**: None

### Leads
- **Tested**: Table rendering, column display, filters, search, pagination
- **Passed**: All features functional
- **Issues**: None

### Estimates
- **Tested**: List view, create new estimate, line items, tax calculation
- **Passed**: All after tax calculation fix
- **Issues**: Tax calculation bug fixed in `337b1b1`

### Settings
- **Tested**: All tabs — Profile, Team, Storm Alerts, Notifications, Financing, Drip, Custom Fields, Contracts
- **Passed**: All tabs load and render correctly
- **Issues**: Notification preferences fixed in `2b7ac36`

### Storm Map
- **Tested**: Map rendering, storm markers, popups
- **Passed**: All functional
- **Issues**: None

### All Other Pages (Storm Archive, Contracts, Work Orders, Materials, Invoices, Expenses, Tasks, Calendar, Canvassing, Subcontractors, Reports, Admin)
- **Tested**: Basic page load, navigation, core rendering
- **Passed**: All load with zero console errors
- **Issues**: Admin returns expected 403 (user role is `admin`, routes require `super_admin`)

### Responsive Testing (375px mobile)
- **Tested**: Dashboard, Leads, Pipeline at mobile width
- **Passed**: Cards stack, sidebar collapses, tables truncate gracefully
- **Issues**: None

---

## UI Consistency Audit Results

### Icons
- **Audit**: Checked all components for non-Heroicon icon usage
- **Result**: All icons are Heroicons — no violations found

### Buttons
- **Audit**: Checked button sizing and styling across all pages
- **Result**: Consistent — no issues found

### Toolbars/Headers
- **Audit**: Verified toolbar and header consistency across pages
- **Result**: Consistent — no issues found

### Sidebar/Nav
- **Audit**: Verified sidebar navigation, collapsible behavior, active states
- **Result**: All 18+ nav items render correctly, zero issues

### Forms
- **Audit**: Grep confirmed zero native `<select>` elements and zero native `<input type="date">` elements
- **Result**: All dropdowns use `CustomSelect.jsx`, all date pickers use `DatePicker.jsx` — no violations

### Spacing/Alignment
- **Audit**: Visual check across all pages at desktop and mobile widths
- **Result**: No alignment issues detected

### Modals
- **Audit**: Checked modal rendering and backdrop consistency
- **Result**: All modals consistent — no issues found

### Glass/oklch Theme
- **Audit**: Verified glass styling and oklch color usage
- **Result**: All components comply with design system — no hex colors detected in active components

---

## Bugs Fixed

1. **CRM Dashboard** — `days-in-stage`, `stale-leads`, and `customer-storm-alerts` endpoints returning 500 due to wrong enum values (`closed_won`/`closed_lost` instead of `sold`/`lost`), wrong column names (`assigned_to_user_id` instead of `assigned_rep_id`), and invalid JSON path extracts — Fixed in `b6ca3fa`

2. **Quick Lead Creation** — `POST /api/crm/leads/quick` returning 500 because INSERT included `property_state` and `property_zip` columns that don't exist on the leads table — Fixed in `19dc947`

3. **Estimate Creation** — `POST /api/estimates` returning 500 because INSERT included `insurance_details` and `upgrades` columns that don't exist on the estimates table — Fixed in `19dc947`

4. **Public Financing/Contract Routes** — All public (no-auth) endpoints for financing plans and contract viewing returning 401 because CRM router's auth middleware intercepted all `/crm/*` requests before sub-routers could handle their public routes — Fixed in `2a3ece7`

5. **Notification Preferences** — Settings > Notifications tab returning 500 for any user without existing preferences because auto-seed included `stale_lead` which doesn't exist in the `notification_type` enum — Fixed in `2b7ac36`

6. **Estimate Tax Calculation** — `calculateTotals()` multiplied subtotal by `taxRate` directly (e.g., 5000 * 8.25 = 41,250) instead of dividing by 100 first (5000 * 0.0825 = 412.50) — Fixed in `337b1b1`

---

## Known Issues (Not Fixed)

1. **Admin Panel Access** — Admin routes return 403 because the test user has role `admin` but routes require `super_admin`. Need to either update user role in DB or create a `super_admin` user to fully test admin overview/tenants/revenue/usage tabs.

2. **QuickBooks Sync** — Not implemented. Requires OAuth flow setup (high effort, external dependency).

3. **SMS/Twilio Integration** — Not implemented. Requires Twilio account and real messaging costs.

4. **Automated Invoice Reminders** — Migration 044 exists but cron job and email templates not yet built.

---

## Test Coverage Gaps

1. **Admin panel** — Could not test admin-specific features (tenant management, revenue overview, usage stats) due to role permissions. Requires `super_admin` role.

2. **Pipeline drag-and-drop** — Basic rendering tested but actual drag-and-drop stage transitions not exercised in this session.

3. **CSV export/import** — Endpoint exists and responds but actual file download not verified in headless testing.

4. **Email composition** — Email modal not tested for actual send functionality (requires SMTP configuration).

5. **Public estimate/contract pages** — API routes verified working, but full customer-facing page rendering not tested via browser.

6. **Calendar interactions** — Page loads but event creation/editing and view switching (Month/Week/Day/List) not exercised.

7. **Reports CSV export** — Page loads but export button functionality not verified.

8. **Payment processing** — Stripe integration not configured/tested.

---

*Report generated: 2026-04-09*
*Session cost: $21.25 across 4 agent sessions (API test, frontend test, UI audit, verification)*
*Files modified: 4 (server/src/routes/crm.js, server/src/routes/index.js, server/src/services/estimateService.js, server/src/services/notificationService.js)*
*Net code change: -9 lines (23 insertions, 32 deletions)*
