# Overnight QA Report — 2026-05-03 (Run 17)

Branch: `feat/financing` · Pre-run checkpoint: `cf6d869` · Head: `a16ac46`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (frontend) | 14 routes + 14 settings tabs |
| API endpoints tested | 257 endpoint hits across 36 route files (178 main harness + 79 extended write-flow harness) |
| Bugs found | 2 (UI only) |
| Bugs fixed | 2 |
| API/server bugs | 0 |
| Commits this run | 2 (`4719928`, `a16ac46`) |

This was the **third consecutive 0-bug overnight QA run** for the API and frontend code paths (Runs 15 and 16 were API-clean, Run 17 added a frontend Playwright sweep that was also clean). The only two commits were a UI-polish toolbar fix and a test-harness fix for false-positive 400s; no production server code changed.

## Backend API Test Results

Two harnesses were run end-to-end against `http://localhost:3001`:

| Harness | Endpoint hits | Pass | Fail | 5xx | Notes |
|---|---:|---:|---:|---:|---|
| `scripts/qa-api-test.mjs` (main) | 178 | 178 | 0 | 0 | Covers all 36 route files |
| `scripts/qa-api-test-extended.mjs` (write flows) | 79 | 79 | 0 | 0 | Create/update/delete on activities, estimates, invoices, work-orders |
| **Total** | **257** | **257** | **0** | **0** | |

### Coverage by route category

| Category | Endpoints | Result |
|---|---|---|
| Auth (`/api/auth/*`) | login, register, me, refresh, logout | All 200/204 on happy path; 400/401 on negative paths |
| CRM Leads (`/api/crm/leads/*`) | list, get, create, update, delete, status, public | Clean |
| CRM Activities | list, create, by-lead | Clean |
| CRM Tasks | list, create, toggle, by-user | Clean |
| Estimates | list, get, create, update, send, accept, public | Clean |
| Invoices | list, get, create, send, mark-paid, AR aging | Clean |
| Work Orders | list, get, create, update, milestones, kanban | Clean |
| Properties | list, get, geocode (single), import-progress | Clean (correctly 400s on `{}` body for geocode) |
| Storm/NOAA | events, layers, swaths, disaster-declarations, FEMA cache | Clean |
| Canvassing | pins (CRUD), trails | Clean |
| Documents | upload, list, delete | Clean |
| Notifications | list, unread-count, mark-read | Clean |
| Search | leads/contacts/properties global | Clean |
| Team | members, roles, leaderboard | Clean |
| Settings | tenant-settings, profile, integrations | Clean |
| Calendar | range query (start/end required) | Clean |
| Reports | revenue, conversion, days-in-stage, AR | Clean |
| Drip / Email / SMTP | dripService, test-email | Clean |
| Webhooks | tracerfy, hearth (signature paths return 401) | Clean |
| Admin (super_admin only) | tenants, system | 403 as expected on tenant-scoped login |

### Fixes committed

- **`4719928` — test(qa): fix harness expectations for 3 false-positive 400s**
  - The harness was sending invalid input on three calls and flagging the API's correct 400 responses as bugs. No production code changed.
  - `PATCH /api/crm/canvass-pin/:id` was sending `outcome: 'callback'`, which is not in the valid enum; switched to `'follow_up'` so the 200 path is exercised, with a separate negative case for the 400.
  - `GET /api/crm/calendar` requires `start` and `end` query params (the frontend always passes them); the harness was hitting it bare. Now sends a real range plus a separate negative case for the missing-params 400.
  - `GET /api/disaster-declarations` requires `state` and `county`; harness now sends `state=TX&county=Harris` plus a separate negative case.
  - After the fix: 178/178 expected, 0 issues. Extended harness still 79/79 with 0 5xx.

No production API code changed. Prior runs of API hardening (`4865288` input validation, `26a3f20` UUID validation) are still holding under re-probe.

## Frontend Feature Test Results

All 14 application pages and all 14 settings tabs were walked under Playwright. Screenshots captured to `qa-run17-*.png` (working-tree, untracked).

| Page | Tested | Result | Notes |
|---|---|---|---|
| `/dashboard` | Stat cards, 14-stage funnel, storm activity feed, tasks-due-today, AR aging, estimating conversion, days-in-stage, team leaderboard | PASS | Pipeline $60K, 2 New Leads, 0% Close, Speed-to-Lead 42h, 51 storm events |
| `/storm-map` | Map render, layer panel, swath transparency slider, address search, hail/wind/property legends | PASS | FEMA layer untouched per user constraint |
| `/pipeline` | Sales/Production/Billing tabs, kanban cards, filter dropdowns, Add Lead CTA | PASS | Drag-and-drop not interactively exercised |
| `/leads` | Stage/Priority/Source/Score filters, Import/Export, table with stage badges, pagination 25/50/100 | PASS | 20 leads visible |
| `/leads/:id` | Drawer with Contact, FEMA history, Property, Weather, Quick Call/Email/SMS/Visit, Insurance Report, Generate Contract, Add Expense | PASS | Sample lead `e25ad9f6-…` |
| `/estimates` | 4 stat cards, status filter, Compare Tiers + New Estimate CTAs, table with Best/Better/Good tier badges | PASS | Compare Tiers button height fixed (see UI audit) |
| `/invoices` | 4 stat cards, AR aging by bucket, status tabs, From Estimate + New Invoice CTAs | PASS | Overdue stat counter from prior run still correct |
| `/work-orders` | Kanban (Pending/Scheduled/…), milestone progress per card, From Estimate + New Work Order CTAs | PASS | From Estimate button height fixed (see UI audit) |
| `/tasks` | Pending/Completed tabs, overdue badge, priority chips, New Task CTA | PASS | |
| `/calendar` | Month view (May 2026), nav arrows, Today, Month/Week/Day/List switcher, events render | PASS | |
| `/reports` | Date-range filters, Compare button, charts (Revenue line, Pipeline funnel, Conversion-by-Source funnel), Rep Leaderboard, CSV export | PASS | Chart label overlap at ~930 px width is cosmetic (carry-over) |
| `/canvassing` | Map render, Drop Pin CTA, 4 stat counters, satellite tiles | PASS | |
| `/content-studio` | — | NOT IMPLEMENTED | Route doesn't exist; redirects to `/`. Per `MEMORY.md project_next_features` this is a planned future feature, not a regression. |
| `/settings` | All 14 tabs render with correct heading, content, and CTA: Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews | PASS | Empty-state tabs (Custom Fields, Automations, Drip Sequences) show empty-state copy + creation CTA |

### Console

- 0 new errors. 0 React errors. 0 key warnings. 0 PropType warnings. 0 unhandled promise rejections.
- The same three pre-token-attach 401s fire on every fresh page load: `/api/properties/import-progress`, `/api/notifications/unread-count`, `/api/crm/tenant-settings`. They return 401 once before the auth interceptor attaches, then succeed on retry. **Carry-over #7 from Run 16 — not a regression introduced this run.**

### Still needs attention (frontend)

- Browser-interactive write flows have not been exercised since Run 6 — drag-pipeline-card, end-to-end Add Lead, record invoice payment, toggle work-order milestone, document upload. Pages render and CTAs are present, but the actual write paths weren't submitted this run.
- Mobile viewport sweep at 375 px / 768 px is overdue (last performed Run 6).

## UI Consistency Audit Results

| Category | Audit method | Result | Action |
|---|---|---|---|
| **Icons** | grep for `lucide-react`, `@fortawesome`, `react-icons`, `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, raw `<svg>` icon paths in view components, `material-symbols-*`, raw `&times;` in close buttons | CLEAN | None — prior runs (`88e9dfe`, `ba79211`, `6e779d8`, `b5887e7`, `18f337a`) hardened this surface and no regressions appeared |
| **Buttons (toolbar primary)** | Heights/radii of primary CTAs against the `.auth-btn` reference | PASS | None — Run 13 (`23c3746`) standardized Pipeline + WorkOrders primaries on `.auth-btn` |
| **Buttons (toolbar secondary)** | Heights/radii of secondary CTAs sitting next to primaries | INCONSISTENT (2 found) | **Fixed in `a16ac46`** — see below |
| **Toolbars / Page headers** | Consistent placement and structure across pages | PASS | Same toolbar pattern across Estimates, Invoices, Work Orders |
| **Sidebar / Nav** | Collapsible behavior, label/route mapping, active-state styling | PASS | `/storm-catalog` correctly mapped from "Storm Archive" sidebar item |
| **Forms** | All inputs use `.form-input` class, all `<select>` use `CustomSelect`, all date pickers use `DatePicker` | MOSTLY PASS | Carry-over: 16 search-input fields lack the explicit `.form-input` class (tracked since Run 13, cosmetic) |
| **Spacing / Alignment** | Toolbar CTA vertical alignment | INCONSISTENT (rolled into `a16ac46`) | Fixed |
| **Modals** | Backdrop, close-button (XMarkIcon), glass styling | PASS | All modals use `IconX` / `XMarkIcon` after Run 16's `88e9dfe` |

### Fixes committed

- **`a16ac46` — fix(ui): align toolbar secondary CTAs to match primary auth-btn height**
  - `client/src/components/EstimatesView.jsx` — "Compare Tiers" was 34 px next to a 36 px "New Estimate" `.auth-btn`. Now 36 px with matching 14/12 px radius.
  - `client/src/components/WorkOrdersView.jsx` — "From Estimate" was 32 px next to a 36 px "New Work Order" `.auth-btn`. Now 36 px with matching radius.
  - Pattern matches the already-correct Invoices toolbar.
  - +4 / -1 lines.

## Bugs Fixed

1. **Estimates toolbar — "Compare Tiers" secondary CTA height mismatch** — Sat at 34 px next to a 36 px primary `.auth-btn`. Aligned to 36 px / matching radius. (`a16ac46`)
2. **Work Orders toolbar — "From Estimate" secondary CTA height mismatch** — Sat at 32 px next to a 36 px primary `.auth-btn`. Aligned to 36 px / matching radius. (`a16ac46`)
3. **QA harness — 3 false-positive 400s** *(test code only, not a production bug)* — `canvass-pin` PATCH used an invalid enum, `/api/crm/calendar` was called bare instead of with required `start/end`, and `/api/disaster-declarations` was called without required `state/county`. Harness now sends valid params on the happy path and adds explicit negative cases for the 400 paths. (`4719928`)

## Known Issues (Not Fixed)

Carry-overs that were out-of-scope or require external decisions:

1. **Heavy-work guards on `POST /drift/correct-all` and `POST /properties/trigger-import`** — accept empty bodies and trigger long-running jobs. Tracked since Run 11. Needs a product decision on the confirmation/role gate.
2. **`form-audit.json` cleanup** — 16 search-input fields render correctly but lack the explicit `.form-input` class. Cosmetic, tracked since Run 13.
3. **Pre-token-attach 401 noise** — three endpoints fire before the axios auth interceptor attaches on every fresh page load (`/api/properties/import-progress`, `/api/notifications/unread-count`, `/api/crm/tenant-settings`). All three succeed on retry. Console-only noise. Could be fixed by hoisting `axios.defaults.headers.common['Authorization']` from `localStorage` synchronously at app boot.
4. **Reports chart label overlap at ~930 px viewport width** — the "Conversion By Source" title wraps awkwardly into the CSV badge. Cosmetic.
5. **404 response shape** — Express HTML 404 vs JSON elsewhere. Cosmetic.
6. **Currency-format anti-pattern audit** — Run 14 caught two `$${num}` issues (Dashboard `formatCurrency`, Invoices balance). LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals have not been re-audited since.

## Test Coverage Gaps

Things that were not exercisable this run:

1. **Browser-interactive write flows** — last truly exercised Run 6. This run verified read/render but did not drag a kanban card across stages, complete the full multi-step Add Lead modal, record an invoice payment, toggle a work-order milestone, or upload a document. Biggest remaining gap.
2. **Mobile viewport sweep at 375 px / 768 px** — last performed Run 6.
3. **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) — need real SMTP creds for live delivery.
4. **Webhook signature verification** (`/webhooks/tracerfy`, `/webhooks/hearth`) — need provider signing keys.
5. **File-upload multipart path on Lead Detail** — only the empty-multipart 400 path was exercised; no real binary payload.
6. **CSV export download** — verified 200 status only, not download trigger or content-type.
7. **QuickBooks / Twilio / Stripe integrations** — not implemented (pre-existing, not regressions).
8. **Admin super-panel** — requires global `super_admin` role; tenant-scoped login correctly returns 403.
9. **FEMA / Properties layer on Storm Map** — explicit user constraint: do not touch.
10. **Bulk geocoding** — explicit cost constraint: do not exercise.

## Session Integrity

| Session | Status | Turns | Output | Notes |
|---|---|---:|---|---|
| s1 api-test | completed | 39 | 14 247 tokens | Produced commit `4719928` |
| s2 frontend-test | completed | 63 | 23 959 tokens | 0 commits (nothing to fix) |
| s3 ui-audit | error_max_turns (60) | 61 | 26 348 tokens | Produced commit `a16ac46` before exhaustion |
| s4 verify | error_max_turns (40) | 41 | 11 684 tokens | No new commits |
| s5 report | 0 bytes | — | — | **9th consecutive 0-byte s5.** Should be folded into s4 with a longer turn budget, or dropped — this report was written in a follow-up session |

Total cost across the four sessions that produced work: ~$12.72.

Both fixes (`4719928`, `a16ac46`) landed as real commits on `HEAD` before this report was written — third consecutive run with that property.
