# Overnight QA Report — 2026-05-04 (Run 18)

Branch: `feat/financing` · Pre-run checkpoint: `22a0c11` · Head: `e72b649`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (frontend) | 14 routes + 14 settings tabs (re-walked from Run 17 baseline) |
| API endpoints tested | 158 endpoint hits across 36 route files (`/tmp/api-test-results.txt`, `qa-api-test-results.json`) |
| Bugs found | 2 (1 UI title-bar regression, 1 API input-validation gap) |
| Bugs fixed | 2 |
| Commits this run | 2 (`29d4a34`, `e72b649`) |
| UI inconsistencies found | 1 (rolled into the 2 fixes — title-bar on `/storm-catalog`) |

This is the **fourth consecutive overnight QA run with 0 production-code 5xx bugs**. Both fixes this run are minor: one is a viewTitles map miss in the topbar, the other is an empty-body PATCH guard already present on four sibling endpoints but missing from these four. Every previous-run fix held under re-probe.

## Backend API Test Results

The main harness (`qa-api-test.mjs`, 178 calls) and a follow-up extended pass (curl probes for the four PATCH endpoints) were run end-to-end against `http://localhost:3001`. Final tally written to `/tmp/api-test-results.txt`:

```
# SUMMARY
Total: 158
OK (2xx/3xx/4xx): 158
5xx: 0
NETERR: 0
```

| HTTP method | Count | All passed |
|---|---:|---|
| GET | 108 | yes |
| POST | 31 | yes (all expected-400 input-validation negative cases) |
| PATCH | 14 | yes |
| PUT | 5 | yes |
| **Total** | **158** | **yes** |

| Status code returned | Count |
|---|---:|
| 200 | 105 |
| 400 | 43 (intentional input-validation negatives) |
| 404 | 10 (intentional not-found negatives) |
| 5xx | **0** |

### Coverage by route category

| Category | Result |
|---|---|
| Auth (`/api/auth/*`) | clean — `me`, login, refresh, password update, logout all OK |
| Storms (`/api/storms*`, `/api/drift/*`) | clean — list, by-id 404, swath geometry |
| Dashboard (`/api/dashboard/*`, `/api/crm/dashboard/*`) | clean — stats, funnel, activity, properties-affected, AR summary, leaderboard, days-in-stage, customer-storm-alerts, lead-source-revenue, follow-ups, conversion-by-storm, estimating-conversion |
| Leads (`/api/leads`, `/api/crm/leads*`) | clean — list, by-id, activities, bulk-assign / bulk-status validation, quick-create validation |
| CRM core (`/api/crm/{tasks,pipeline,team,tenant-settings,custom-fields,prospect-lists,calendar,activities}`) | clean |
| Estimates (`/api/estimates*`) | clean — list, by-id, templates, PDF (200, valid `%PDF-1.3`), PATCH partial-update, POST validation |
| Invoices (`/api/crm/invoices*`) | clean — list, by-id, PATCH partial-update, POST validation |
| Work Orders (`/api/crm/work-orders*`) | clean — list, by-id, milestones, PDF, PATCH partial-update |
| Contracts (`/api/crm/contracts*`) | **1 bug found** — empty-body PATCH returned misleading 404; **fixed (e72b649)** |
| Tasks (`/api/crm/tasks/:id`) | **1 bug found** — empty-body PATCH returned misleading 404; **fixed (e72b649)** |
| Expenses (`/api/crm/expenses*`) | **1 bug found** — empty-body PATCH returned misleading 404; **fixed (e72b649)** |
| Subcontractors (`/api/crm/subcontractors*`) | **1 bug found** — empty-body PATCH returned misleading 404; **fixed (e72b649)** |
| Territories / Canvass-pins | clean — already had the empty-body 400 guard |
| Reports (`/api/crm/reports/*`) | clean — revenue, pipeline, conversion, rep-performance, stage-duration, lead-sources |
| Drip / Automations / Financing | clean — empty-list returns, validation |
| Skip-Trace / Roof-Measurement | clean — config, balance, usage, jobs |
| Admin (`/api/admin/*`) | clean — overview, tenants, revenue, usage |
| Materials (`/api/materials/*`) | clean — products, branches, orders, credentials |
| Notifications | clean — list, unread-count, preferences |
| Search (`/api/search?q=`) | clean — keyword match |
| Documents | clean — list returns empty-state shape |
| Storm-history / Disaster-declarations / FEMA-housing / Directions | clean — point-query 200, missing-param 400 |
| Payments / Stripe Connect | clean — status, history |
| Alerts | clean — config, history, test |

### Backend fix (commit `e72b649`)

`fix(api): empty-body PATCH returns 400 on tasks/contracts/expenses/subcontractors`

| Endpoint | Before | After |
|---|---|---|
| `PATCH /api/crm/tasks/:id` | empty `{}` body fell through to service layer and returned `404 "Task not found"` (misleading) | returns `400 {"error":"No fields to update"}` |
| `PATCH /api/crm/contracts/:id` | empty `{}` body returned `404 "Contract not found or not in draft status"` (misleading) | returns `400 {"error":"No fields to update"}` |
| `PATCH /api/crm/expenses/:id` | empty `{}` body returned `404 "Expense not found"` (misleading) | returns `400 {"error":"No fields to update"}` |
| `PATCH /api/crm/subcontractors/:id` | empty `{}` body returned `404 "Subcontractor not found"` (misleading) | returns `400 {"error":"No fields to update"}` |

Pattern matches the existing guard on `territories`, `canvass-pins`, `custom-fields`, and `auth.me`. Verified: all four return 400 on `{}` and 200 on a valid partial update. +12 lines / -0 across 4 files.

## Frontend Feature Test Results

A frontend Playwright sweep was run (s2) and a verify pass (s4) re-walked the same routes plus a 375-px mobile dashboard check.

| Page | What was tested | Result |
|---|---|---|
| `/dashboard` | Stat cards, 14-stage pipeline funnel, storm activity feed, tasks-due-today, AR aging, estimating-conversion 20%, days-in-stage, team leaderboard | clean |
| `/storm-map` | Map render, layer panel toggles, swath transparency slider, address search, hail/wind/property legends | clean (FEMA properties NOT TOUCHED per developer instruction) |
| `/storm-catalog` (Storm Archive) | Topbar h1 displayed | **bug found** — title showed "Dashboard" instead of "Storm Archive"; **fixed (29d4a34)** |
| `/pipeline` | Sales/Production/Billing tabs, kanban with cards, filter dropdowns, Add Lead CTA | clean |
| `/leads` | Stage/Priority/Source/Score filters, Import/Export, table with stage badges, pagination 25/50/100 | clean |
| `/leads/:id` | Drawer panel with Contact, FEMA Disaster History, Property, Weather Event, Quick Call/Email/SMS/Visit, Insurance Report, Generate Contract, Add Expense | clean |
| `/estimates` | 4 stat cards, status filter, Compare Tiers + New Estimate (now 36-px aligned from Run 17), tier badges | clean |
| `/invoices` | 4 stat cards, AR aging by bucket, status tabs, From Estimate + New Invoice CTAs, Overdue badge logic (fixed Run 16) | clean |
| `/work-orders` | Kanban (Pending/Scheduled/...), milestone progress per card, From Estimate + New Work Order CTAs | clean |
| `/tasks` | Pending/Completed tabs, overdue badge, priority chips, New Task CTA | clean |
| `/calendar` | Month view, navigation arrows, Today, Month/Week/Day/List view switcher, events render | clean |
| `/reports` | This Week/Month/Quarter/Year/All Time filters, date range picker, Compare button, Revenue line / Pipeline funnel / Conversion-by-Source funnel, Rep Leaderboard, CSV exports | clean |
| `/canvassing` | Map renders, Drop Pin CTA, 4 stat counters | clean |
| `/settings` (14 tabs) | Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews | clean — every tab renders or shows correct empty state |

### Frontend fix (commit `29d4a34`)

`fix(ui): topbar shows Storm Archive on /storm-catalog instead of Dashboard`

`client/src/components/TopBar.jsx` — the `viewTitles` map was missing the `'storm-catalog'` key, so the page header h1 fell through to the default and rendered "Dashboard" while the user was on the Storm Archive route. Added one entry: `'storm-catalog': 'Storm Archive'`. +1 line.

### Mobile responsive (375 px) — first sweep since Run 6

Verify stage took a single screenshot of `/dashboard` at 375 px (`qa-run18-mobile-dashboard-375.png`). The dashboard degrades gracefully at 375 px: stat cards stack to 1-up, sidebar collapses, content reflows. **No layout breaks observed** but only one route was actually re-checked at this width — full mobile sweep across all 14 routes is still pending (carry-over from Run 6, 11 runs ago).

## UI Consistency Audit Results

The audit stage (s3) re-ran the now-standard categorical sweeps. Results below follow the same audit categories used in Run 17.

| Category | Findings |
|---|---|
| **Icons** | Clean. `git grep` for `lucide-react`, `@fortawesome`, `react-icons`, `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, raw `<svg>` icon paths, `material-symbols-*`, raw `&times;` — all return zero hits. The icon-discipline commits from Runs 13–17 (`88e9dfe`, `ba79211`, `6e779d8`, `b5887e7`, `18f337a`) are sticking |
| **Buttons** | Clean. The Run 17 toolbar-CTA height alignment (`a16ac46` for Estimates `Compare Tiers` and WorkOrders `From Estimate`) holds — both still 36 px / matching radius |
| **Toolbars / Headers** | **1 issue found** — Storm Archive page header h1 fell through to "Dashboard" because of a missing entry in the topbar `viewTitles` map. **Fixed (`29d4a34`)** |
| **Sidebar / Nav** | Clean. All 14 sidebar items have outline Heroicons; active states consistent; collapse/expand works |
| **Forms** | No new violations. Carry-over still tracked: 16 search inputs lack the explicit `.form-input` class (cosmetic-only — they render correctly via CustomSelect / DatePicker chrome around them) |
| **Spacing / Alignment** | Clean. Card gaps, section header sizes, glass panel padding all match across pages |
| **Modals** | Clean. All modals use `modal-backdrop`, scale-in animation, consistent close-X positioning |

## Bugs Fixed

1. **Topbar / `/storm-catalog`** — header h1 displayed "Dashboard" instead of "Storm Archive" because the `viewTitles` map in `TopBar.jsx` was missing the `'storm-catalog'` key. Fixed by adding the entry — `client/src/components/TopBar.jsx`, +1 line. Commit `29d4a34`.

2. **`PATCH /api/crm/{tasks,contracts,expenses,subcontractors}/:id`** — empty-body PATCH (`{}`) fell through to the service layer, which returned `null`, which produced a misleading `404 "Not found"` response despite the resource existing. Added the same `if (!req.body || Object.keys(req.body).length === 0) return 400 "No fields to update"` guard already used on the territories / canvass-pins / custom-fields / auth.me PATCH endpoints. `server/src/routes/{crm.js,contracts.js,expenses.js,subcontractors.js}`, +12 lines / -0 across 4 files. Commit `e72b649`.

## Known Issues (Not Fixed)

Carry-overs from prior runs, all unchanged this run:

- **Heavy-work POST guards** — `POST /drift/correct-all` and `POST /properties/trigger-import` accept empty bodies and trigger heavy jobs. Should require explicit confirmation/role params. Tracked since Run 11. Not in scope for this QA-only run.
- **`form-audit.json` cleanup** — 16 search-input fields render correctly but lack the explicit `.form-input` class. Cosmetic. Tracked since Run 13.
- **Pre-token-attach 401 noise** — `/api/properties/import-progress`, `/api/notifications/unread-count`, `/api/crm/tenant-settings` fire before the axios auth interceptor attaches on every fresh page load. Three 401s on first paint, then succeed on retry. Console-only noise; no functional impact. Tracked since Run 16.
- **Reports chart label overlap** — at ~930 px viewport width, "Conversion By Source" title wraps awkwardly into the CSV badge. Cosmetic. Tracked since Run 17.
- **404 response shape** — Express HTML 404 vs JSON elsewhere. Cosmetic.
- **Currency-formatting anti-pattern** — `LeadDetail` Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals not yet audited for the `$${num}` pattern that produced Run 14's bugs.
- **Admin panel** — requires global super_admin role and live multi-tenant data to fully exercise.
- **Email-send endpoints** — `/crm/test-email`, `/invoices/:id/send-email` need SMTP configuration for live delivery testing.
- **Webhook endpoints** — `/webhooks/tracerfy`, `/webhooks/hearth` need signature verification keys.
- **File upload (multipart)** — Lead Detail document upload not exercised with a real binary payload.
- **CSV export** — verified by 200 status only, not by `Content-Type: text/csv` and download triggering.
- **QuickBooks / Twilio / Stripe integrations** — not implemented (pre-existing, not regressions).

## Test Coverage Gaps

- **Browser-interactive write flows** — biggest remaining gap. Not exercised since Run 6 (12 runs ago). Reads/renders verified, but Add-Lead end-to-end submit, drag pipeline cards between stages, record invoice payments, toggle work-order milestones, document-upload multipart path are all still un-tested via Playwright.
- **Mobile responsive** — partial coverage this run (one screenshot at 375 px on `/dashboard`). Full sweep across all 14 routes at 375 px and 768 px not done since Run 6.
- **FEMA properties layer** — explicitly out of scope per developer instruction; do not touch.
- **Storm-map property loading at scale** — IndexedDB caching path not exercised in Playwright.
- **Drag-drop kanban** — not exercised under Playwright (HTML5 drag API path).

## Session Integrity

| Stage | Result | Turns | Output tokens | Cost | Notes |
|---|---|---:|---:|---:|---|
| s1 api-test | error_max_turns | 51 | 33 067 | $4.26 | Produced `/tmp/api-test-results.txt` (158 endpoints) and `qa-api-test-results.json`. No commits this stage |
| s2 frontend-test | error_max_turns | 81 | 21 320 | $4.57 | Re-walked all 14 pages + 14 settings tabs. No bugs, no commits |
| s3 ui-audit | error_max_turns | 61 | 21 339 | $3.79 | Produced commit `29d4a34` (TopBar `/storm-catalog` fix) |
| s4 verify | error_max_turns | 41 | 11 831 | $2.20 | Produced commit `e72b649` (empty-body PATCH 400 on 4 endpoints), one mobile screenshot at 375 px |
| s5 report | 0 bytes | — | — | — | **10th consecutive 0-byte s5** — did not run; this report written in a follow-up session |

Total cost across the four sessions that produced work: **~$14.82**. Both fixes landed as real commits on HEAD before the report was written — this is the **fourth consecutive run** with that property.

## Files Left Untracked in Working Tree

- `claude-overnight-20260504-{s1-api-test,s2-frontend-test,s3-ui-audit,s4-verify,s5-report}.json` — orchestrator metadata
- `qa-api-test-results.json` — main harness output (51 KB, 158 endpoints)
- `qa-api-test.mjs` — main harness script (17 KB) — first introduced Run 16, still untracked
- `qa-token.txt` — auth token used by the harness
- `qa-run18-mobile-dashboard-375.png` — single mobile screenshot from s4

## What to Do Next

If running another sweep:
- **Browser-interactive write flows** are the biggest gap (12 runs of read-only verification). A run that actually drags a kanban card, creates a lead end-to-end, records an invoice payment, toggles a work-order milestone, and uploads a document would close that gap.
- **Mobile viewport sweep** at 375 px and 768 px across all 14 routes (only `/dashboard` was checked this run).
- **Pre-token-attach 401 noise** — fixable by hoisting the token attach earlier (synchronous `axios.defaults.headers.common['Authorization']` from localStorage on app boot before any component mounts).
- **Drop or refactor s5** — 10 consecutive 0-byte runs. Either fold into s4 with a longer turn budget, or drop entirely.
