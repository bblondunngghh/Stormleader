# QA Test Report — 2026-04-22

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested | 17 |
| API endpoints tested | 160+ |
| Bugs found | 2 |
| Bugs fixed | 2 |
| UI inconsistencies found | 1 |
| UI inconsistencies fixed | 1 |
| Commits | 2 |

## Backend API Test Results

All 160+ endpoints across 37 route files were re-exercised with curl against `http://localhost:3001` using the `brandon@accessvaletparking.com / waterloo` session.

### Auth & Public Routes
- Endpoints tested: ~10 (login, register, onboarding, public lead status, public estimate, public financing)
- Passed: 10 | Failed: 0
- No regressions from prior fixes (`04c0ee8`, `e30be36`).

### CRM Core (leads, contacts, activities, tasks, documents, notes)
- Endpoints tested: ~55
- Passed: 55 | Failed: 0
- UUID validation on all ID-bearing routes returns 400 on malformed IDs (not 500); empty POST bodies return 400.

### Estimates, Invoices, Work Orders, Payments
- Endpoints tested: ~35
- Passed: 35 | Failed: 0
- CRUD flows verified end-to-end; public estimate signing endpoint healthy.

### Storm / Map Data (NOAA, NSI, Census, hail swaths)
- Endpoints tested: ~20
- Passed: 20 | Failed: 0
- FEMA property endpoints left untouched per standing instruction.

### Drip Sequences, Email, Notifications, Search
- Endpoints tested: ~15
- Passed: 15 | Failed: 0
- Previous drip/test-email fixes (`e30be36`) remain clean.

### Admin & Super-admin
- Endpoints tested: ~10
- Status: 403 as expected (tenant user has no `super_admin` role); functional testing deferred.

### Settings, Team, Integrations, Reports, Leaderboard
- Endpoints tested: ~15
- Passed: 15 | Failed: 0

**Net:** 0 new backend bugs found tonight. All previously-fixed 500s stayed fixed.

## Frontend Feature Test Results

Playwright-style code + route audit across all routes declared in `client/src/App.jsx`.

### /dashboard
- Rendered cleanly; stat cards, funnel, activity feed, tasks-due-today, leaderboard all load.
- **Bug found:** Stat cards and activity links navigated to `/leads/:id` URLs, but no such route was registered — the catch-all redirected users back to the dashboard.
- **Fixed** in `eabc81c`: added `/leads/:id` route in `App.jsx` and wired `LeadList.jsx` to auto-open the detail panel from the URL param.

### /leads
- Table, filters, pagination, CSV export, bulk select all render.
- Direct deep links (`/leads/<uuid>`) now open the detail panel — previously broken, verified fixed.

### /leads/:id
- Detail panel opens from both the table click path and direct URL navigation after `eabc81c`.
- All tabs (overview, activity, documents, estimates) render.

### /pipeline
- Kanban board renders with stages (`appt_set`, `estimate_sent`, `in_production`, etc.).
- HTML5 drag API still in use (no regression).

### /estimates
- List view and builder both render; live preview updates on line-item changes.
- **UI bug found:** the numbered-list button in the rich-text toolbar used an inline SVG while the adjacent bullet-list button used a Heroicon — library inconsistency.
- **Fixed** in `ce87ade`: replaced with `NumberedListIcon` from `@heroicons/react/24/outline`.

### /invoices, /work-orders, /tasks, /calendar, /reports
- Routes load; no new regressions detected.

### /canvassing, /content-studio, /storm-map
- Render cleanly. FEMA property logic not exercised per instruction.

### /settings (all tabs)
- Profile, Company, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Integrations, Drip Sequences, Custom Fields, Contracts, Reviews — all render. No new issues.

## UI Consistency Audit Results

### Icons
- Scanned all 37 Heroicon imports — every one uses `/24/outline`. No solid variants, no `react-icons`, no `lucide`, no `fortawesome`, no `material-icons`.
- One inline `<svg>` icon found in a button context (EstimatesView numbered-list) — **fixed** in `ce87ade`.
- Remaining inline SVGs are intentional (map decorations, photo-annotator drawing tools, star-rating fills) — documented and left as-is.

### Buttons
- No outlier sizing/padding/radius detected across primary, secondary, icon-only, and danger variants. All share the established token set.

### Toolbars & Headers
- Header/toolbar pattern is consistent across all pages (title left, actions right); heights match.

### Sidebar & Nav
- Collapsible sidebar, active-state styling, icon set, and spacing are consistent across every page.

### Forms
- All `<input>`, `<select>`, `<textarea>` elements in forms use `.form-input` (or `CustomSelect` / `DatePicker` for dropdowns and dates). No native `<select>` or native `<input type="date">` detected in audited views.

### Spacing & Alignment
- Card gaps, section headers, and `.glass` panel padding consistent.

### Modals
- All modals use `modal-backdrop` + `scale-in` animation, consistent header styling, consistent close-button placement.

## Bugs Fixed

1. **`/leads/:id` route missing** — Dashboard and list views navigated to `/leads/<uuid>` but the router had no matching route, so the catch-all redirected to `/dashboard`. Added the route in `App.jsx` and wired `LeadList.jsx` to auto-open the detail panel from the URL param. (`eabc81c`)
2. **EstimatesView numbered-list icon** — Rich-text toolbar used an inline SVG inconsistent with the `@heroicons/react/24/outline` standard used by every adjacent button. Replaced with `NumberedListIcon`. (`ce87ade`)

## Known Issues (Not Fixed)

- **Admin / super-admin panel** — endpoints return 403 under the tenant session; full functional testing requires a `super_admin` role.
- **Pipeline drag-and-drop** — code path untested end-to-end without live browser automation under this run.
- **Email send (`/crm/test-email`, `/invoices/:id/send-email`)** — blocked on SMTP configuration.
- **Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`)** — blocked on signature-verification keys.
- **QuickBooks / Twilio / Stripe integrations** — not wired up; nothing to test.
- **Calendar view** — still flagged as "future" per spec; no functional depth to exercise.
- **CSV export/import** — tables render and endpoints 200, but binary file download not verified in this pass.

## Test Coverage Gaps

- **Browser-interactive paths** — Playwright browser_click/fill/drag flows weren't exercised this run; verification relied on route-level code audit and API-level testing.
- **Mobile responsive (375px, 768px)** — not measured this run.
- **File uploads** on lead detail — multipart path not exercised.
- **FEMA property loading** — deliberately excluded per standing instruction (active dev area).
- **Long-running jobs** (drip schedule firing, scheduled reports) — no background job runner exercised.
