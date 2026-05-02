# StormLeads QA Run 15 — Overnight Report

**Date:** 2026-05-02
**Branch:** feat/financing
**Checkpoint:** `overnight-checkpoint-20260502` (commit `7e68f24`)
**Commits this run:** 3 (`e61b0c7`, `88e9dfe`, `ba79211`)

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (Playwright UI sweep) | 13 routes + 15 settings tabs |
| API endpoints tested | 260+ endpoint hits across 36 route files |
| Bugs found | 3 |
| Bugs fixed | 3 |
| UI inconsistencies found | 2 (icon discipline) |
| UI inconsistencies fixed | 2 |
| Files changed by commits | 10 frontend (0 backend) |

This is the first run since QA Run 6 (2026-04-17) where every fix landed as a real
commit on HEAD before the report was written, and the first run in the 15-run
series with a fully-clean backend API sweep.

## Backend API Test Results

s1 api-test ran to completion (34 turns, $2.68). Two new harness scripts were added:
`scripts/qa-api-test.mjs` (176 calls, 315 lines) and `scripts/qa-api-test-extended.mjs`
(79 calls, 185 lines). Both are currently untracked in the working tree.

| Category | Endpoints exercised | Pass | Fail |
|---|---|---|---|
| Auth (`/api/auth/*`) | login, register, refresh, logout, me — token attach/refresh paths | all | 0 |
| CRM core (`/api/crm/*`) | leads, contacts, activities, tasks, notifications, search, leaderboard, tasks-today, tenant-settings, drip, test-email | all | 0 |
| Estimates (`/api/estimates`) | list, create, read, update, delete, send-email, public token reads | all | 0 |
| Invoices (`/api/invoices`) | list, create, read, update, delete, payments, send-email, public token reads | all | 0 |
| Work Orders (`/api/work-orders`) | list, create, read, update, delete, milestones | all | 0 |
| Properties / FEMA (`/api/properties/*`) | list, single read, import-progress, geocode (single), trigger-import (existing soft-401 path) | all | 0 |
| Storm / Map (`/api/storms`, `/api/map`, `/api/spc/*`, `/api/swdi/*`) | list, recent, by-bbox, swath polygon, hail/wind ingestion read paths | all | 0 |
| Documents / Photos (`/api/documents`) | list, upload (probed via empty-multipart), delete, annotate save | all | 0 |
| Public (`/api/public/*`, `/api/leads/status/public/:token`) | estimate view, invoice view, lead status, financing apply | all | 0 |
| Admin / role-gated | tenant settings update, super-admin endpoints | 403 (expected) | 0 |
| Counties / Materials / Storms `:id` routes | the 4 routes that lack `validateId()` middleware were re-probed with malformed UUIDs | all (clean inline checks) | 0 |
| `errorHandler.js` SQLSTATE coverage | 22P02 / 22008 / 22003 / 22007 / 23503 paths re-checked end-to-end | all 400, no 500 | 0 |

**No bugs found, no commits made by s1.** Every previous-run fix held under
re-probe. Run 14's uncommitted SQLSTATE patch on `errorHandler.js` is now part of
the pre-overnight checkpoint commit `7e68f24` and was verified live in this sweep.

## Frontend Feature Test Results

s2 frontend-test hit `max_turns` at 81 turns ($5.42) but produced one commit
before timing out. Playwright drove a full sweep across 13 routes and all 15
settings tabs.

### `/dashboard` — PASS
Stat cards, conversion funnel, leaderboard, AR aging, tasks-today, activity
feed populated. Stat-card click navigates correctly. Glass card styling intact.

### `/storm-map` — PASS
Map, layer panel, swaths, transparency slider all render. FEMA properties not
exercised per project rule (developer-active code, hands-off).

### `/pipeline` — PASS
14-stage kanban, cards render, drag handle present, click opens slide-over
preview. Drag-and-drop write-path not exercised end-to-end (see Test Coverage
Gaps).

### `/leads` — PASS
List of 20 leads with filters, search, sort, pagination. Row click opens
drawer. Deep-link `/leads/:id` resolves (validated against
`e25ad9f6-f3dc-4ca7-a5da-63b6c3ee6d14`).

### `/estimates` — PASS
List + 4 stat cards. New Estimate builder opens with all 10 sections, customer
fields, date picker, line items grid, totals.

### `/invoices` — **1 bug fixed**
- **Bug:** Overdue stat card showed `0` while a row OVERDUE badge was clearly
  visible. Stat counted only `status === 'overdue'`, but the row badge fires
  on `status === 'sent' && new Date(due_date) < now`.
- **Fix:** `client/src/components/InvoicesView.jsx:65` — extended filter to
  match the badge logic and the dashboard's SQL definition. Card now shows `1`,
  agreeing with the OVERDUE row badge. Commit `e61b0c7`.

### `/work-orders` — PASS rendering, 1 icon bug fixed (see UI section)
Kanban (Pending / Scheduled / In Progress / Completed / Cancelled). Card click
opens detail with line items and 7-milestone checklist.

### `/tasks` — PASS
Pending(6) / Completed(1) tabs, Overdue section, New Task button.

### `/calendar` — PASS
Month / Week / Day / List views. Navigation works. Events on Apr 26 / 28 / 30
render.

### `/reports` — PASS
Revenue chart, Pipeline funnel, Conversion-by-Source, Rep Leaderboard.
Per-chart CSV export works. Date range presets (7d / 30d / 90d / YTD)
populate correctly.

### `/canvassing` — PASS
Google satellite map, stats overlay (doors / interested / scheduled / conv),
Drop Pin button.

### `/content-studio` — N/A
Route not implemented. Listed in MEMORY's "Next features" (AI marketing
content). Skipped per "no new features" rule.

### `/settings` (15 tabs) — PASS
Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications,
Email/SMTP, Financing, Automations, Drip Sequences, Custom Fields,
Pricing/Line Items, Contracts, Reviews. URL stays `/settings` throughout —
tab switching uses internal state.

### Console errors observed
Only the known pre-token-attach 401s on `/api/properties/import-progress`,
`/api/notifications/unread-count`, `/api/crm/tenant-settings` that fire on
first paint before the axios auth interceptor attaches the JWT. Present on
every fresh page load and have been there across multiple runs — not a
regression. Tracked in carryover.

## UI Consistency Audit Results

s3 ui-audit hit `max_turns` at 61 turns ($4.91) but produced two commits and
captured icon-discipline evidence.

### Icons — **2 violations found, both fixed**

`88e9dfe` — `fix(ui): use Heroicons everywhere — replace inline SVGs and &times; close buttons`
- `PhotoAnnotator.jsx` drawing toolbar used inline `<svg>` + raw path strings
  for pen / arrow / rect / circle / text. Per project rule (every icon must
  come from `@heroicons/react/24/outline`), swapped for
  `PencilIcon` / `ArrowUpRightIcon` / `StopIcon` / `StopCircleIcon` /
  `DocumentTextIcon`. The toolbar close button also used `&times;` — replaced
  with `XMarkIcon`.
- Eight components rendered raw `&times;` inside close / dismiss `<button>`s
  instead of the standard `XMarkIcon` (the `IconX` wrapper). Notable:
  `EstimatesView`, `InvoicesView`, `LeadList`, and `Pipeline` already imported
  `IconX` but used `&times;` in places — inconsistent within the same file.
  Standardized all on `IconX` / `XMarkIcon` and added `aria-label` for
  accessibility.
- Files touched: `PhotoAnnotator`, `CanvassingMode`, `CreateLeadModal`,
  `SubcontractorsView`, `EstimatesView` (3 spots), `InvoicesView`, `LeadList`
  (2 spots), `Pipeline`. Total: 8 files, +49 / -37 lines.

`ba79211` — `fix(ui): WorkOrders milestone remove button uses XMarkIcon`
- `WorkOrdersView.jsx` "Remove milestone" buttons rendered a literal `×`
  character. Same project rule: swapped for the `IconX` wrapper that was
  already imported in this file. Added `aria-label="Remove milestone"`.
  +4 / -3 lines.

### Buttons — PASS (no new inconsistencies)

The Run 13 primary-CTA standardization (`23c3746` — Pipeline `Add Lead` and
WorkOrders `New Work Order` on `.auth-btn`) was re-verified intact this run.
No buttons drift back to inline-styled translucent backgrounds. No off-spec
heights / paddings detected on Dashboard, Pipeline, Leads, Estimates, Invoices,
or Work Orders.

### Toolbars / Headers — PASS

Page headers (h1 + subtitle + primary CTA) consistent across all 13 routes.
TopBar (search + notification bell + user menu) renders identically on every
page. No header height / padding drift.

### Sidebar / Nav — PASS

Collapsible behavior works. Active route highlight renders. No icon
substitutions. `mockData.js` deletion (Phase 2 cleanup) still holds — every
nav item resolves to a real route or hides if not implemented.

### Forms — PASS for new code (carryover gap unchanged)

No new non-standard form elements introduced this run. The known gap from
Run 13 (16 search-input fields render correctly but lack the explicit
`.form-input` class — `form-audit.json`) is unchanged and remains a refactor
candidate, not a regression.

### Spacing — PASS

No alignment drift detected. Glass card padding consistent. Stat-card grid
gaps consistent across Dashboard / Estimates / Invoices / Work Orders /
Contracts / Tasks.

### Modals — PASS for new code

The Run 2 global modal-scale-in animation rule still applies.
`CreateLeadModal`, `ActivityModal`, `LeadDetail` Weather History / Billing,
and the WorkOrders / Invoices / Tasks / Expenses / Contracts / Materials /
Settings modals all render with consistent backdrop + glass panel +
scale-in. Close buttons are now uniformly `XMarkIcon` after `88e9dfe` /
`ba79211`.

## Bugs Fixed (numbered list)

1. `/invoices` — Overdue stat card counted only `status === 'overdue'` while
   the row OVERDUE badge fires on `status === 'sent' && past-due`. Stat
   showed `0` while a clearly-overdue row was visible. Fixed in
   `client/src/components/InvoicesView.jsx:65` by extending the filter to
   match the badge logic. Commit `e61b0c7`.
2. PhotoAnnotator drawing toolbar + 8 components — used inline `<svg>` paths
   and raw `&times;` characters instead of Heroicons. Violates the project
   rule that every icon must come from `@heroicons/react/24/outline`. Fixed
   by swapping for `PencilIcon` / `ArrowUpRightIcon` / `StopIcon` /
   `StopCircleIcon` / `DocumentTextIcon` / `XMarkIcon` and adding
   `aria-label`s. Commit `88e9dfe`.
3. WorkOrdersView milestone "Remove" buttons — rendered a literal `×`
   character instead of an icon component. Fixed by swapping for the `IconX`
   wrapper already imported in the file, plus an `aria-label="Remove
   milestone"`. Commit `ba79211`.

## Known Issues (Not Fixed)

None new this run. Carryovers from prior runs (unchanged):

- Admin panel requires global super_admin role to fully exercise.
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing,
  not regressions).
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need
  SMTP configuration for live delivery testing.
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature
  verification keys.
- `POST /drift/correct-all` and `POST /properties/trigger-import` still
  accept empty bodies and trigger heavy work — should require explicit
  confirmation/role params (tracked since Run 11).
- 16 search-input fields render correctly but do not carry the explicit
  `.form-input` class — refactor candidate (tracked since Run 13,
  `form-audit.json`).
- Pre-token-attach 401 noise on `/api/properties/import-progress`,
  `/api/notifications/unread-count`, `/api/crm/tenant-settings` (cosmetic
  console noise on first paint, no functional impact).
- Reports chart label overlap — "Mar 26" / "Apr 26" tick labels overlap the
  "$0" y-axis label on the Revenue chart at narrow widths. Minor visual nit.

## Test Coverage Gaps

- **Browser-interactive write flows** — drag a pipeline card across stages
  and confirm DB state, submit Add Lead form, upload a document, add line
  items to an estimate and save, record a payment on an invoice. Last
  actually-submitted writes were Run 6. Worth its own session.
- **Mobile responsive sweep** at 375 px and 768 px — last performed Run 6.
  Bottom tab bar, glass card stacking, drawer/modal heights uninspected
  for 9 runs.
- **Currency-format anti-pattern sweep** — Run 14 fixed Dashboard and
  InvoicesView (`$${num.toLocaleString()}` placing minus before `$`).
  LeadDetail Profit / Expenses, Reports, ContractsView, ExpensesView,
  EstimatesView totals still un-audited for the same pattern.
- **CSV export download** verified by 200 status only, not by binary
  content-type and download triggering.
- **File upload on Lead Detail** (multipart path) probed only with empty
  multipart body, not with a real file payload.
- **`/content-studio`** route not implemented — covered as a "Next features"
  item in MEMORY, intentionally skipped.

## Session Integrity

- s1 api-test: completed (34 turns, 30 297 output tokens, $2.68) — first
  fully-clean API sweep in 15 runs.
- s2 frontend-test: error_max_turns (81 turns, 27 809 output tokens, $5.42)
  — produced commit `e61b0c7` and the qa-* baseline screenshots.
- s3 ui-audit: error_max_turns (61 turns, 40 104 output tokens, $4.91) —
  produced commits `88e9dfe` and `ba79211`.
- s4 verify: error_max_turns (41 turns, 11 004 output tokens, $2.25).
- s5 report: 0 bytes — did not run (8th consecutive 0-byte s5; this report
  written in a follow-up session).
- Total cost across the four sessions that produced work: ~$15.26.
- Untracked artifacts left in working tree:
  `scripts/qa-api-test.mjs`, `scripts/qa-api-test-extended.mjs`,
  `claude-overnight-20260502-s{1..5}-*.json`, refreshed `qa-*.png`
  screenshots (storm-map, pipeline, leads, lead-detail, estimates,
  estimate-builder, invoices, invoices-after, work-orders, work-order-detail,
  tasks, calendar, reports, canvassing, settings, invoice-modal).
