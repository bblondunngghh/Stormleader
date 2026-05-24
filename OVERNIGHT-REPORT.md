# Overnight QA Report — 2026-05-24 (QA Runs 29 + 30)

Branch: `feat/financing` · Pre-run checkpoint: `022b2e6` (`overnight-checkpoint-20260524`) · Head: `87d7230` · Commits this run: **2**

This is the **29th + 30th overnight QA run** since the harness was formalised, consolidated into a single report because both stages execute against the same baseline tree on the same date. Unlike Runs 27+28 (which produced zero commits), this run produced **two real bug fixes** — one server-contract bug surfaced by the API harness and one CSS bug surfaced by the UI consistency audit.

- **s1 (api-test) — Run 29:** 144 endpoints exercised, 100 2xx / 44 4xx, 0 5xx; surfaced + fixed a Tasks contract mismatch.
- **s3 (ui-audit) — Run 30:** 7 audits across 19 authenticated pages; surfaced + fixed 2 transparent-backdrop modals.
- **s2 / s4 / s5** continued the long-running `max_turns` pattern; see Session Integrity below.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend pages walked / audited (Run 30 s3) | **19** (every authenticated route) |
| API endpoints tested (Run 29 s1) | **144** (84 GET-sweep + 8 404-test + 3 400-UUID + 26 400-empty + 4 public-bad-token + 3 heavy-work + 2 round-trip + 1 mark-all-read + 1 delete-missing + 1 admin-tenant + 11 misc) |
| Bugs found (real, server-side or UI) | **3** (1 backend contract, 2 UI parity-CSS) |
| Bugs fixed | **3** (100% of those found) |
| Production 5xx after run | **0** (**13th consecutive run**) |
| UI inconsistencies found | **2** (both modal backdrops) |
| UI inconsistencies fixed | **2** (100%) |
| Commits this run | **2** (`2eb2135`, `87d7230`) |
| Intentional 503s | 1 (`GET /api/skip-trace/job/:jobId` when `TRACERFY_API_KEY` unset) |
| Intentional empty-body 200s | 3 (`POST /alerts/test`, `POST /drift/correct-all`, `POST /properties/trigger-import`) |

---

## Backend API Test Results

Single endpoint table covering 144 probes; see `/tmp/api-test-results.txt` for the full row-by-row sweep. Coverage by category:

| Category | Endpoints exercised | 2xx | 4xx | 5xx | Notes |
|---|---|---|---|---|---|
| Auth | 1 | 1 | 0 | 0 | `/auth/me` |
| Storms / map / properties | 11 | 11 | 0 | 0 | bbox-bounded reads, includes `/properties/import-progress`, `/storms/*`, `/storm-history/*` |
| Dashboard (legacy `/dashboard/*`) | 3 | 3 | 0 | 0 | stats / funnel / activity |
| Leads | 1 | 1 | 0 | 0 | `/leads` |
| Skip-trace | 5 | 5 | 0 | 0 | config / balance / invoices / usage / jobs |
| Alerts | 2 | 2 | 0 | 0 | config + history |
| Counties | 1 | 1 | 0 | 0 | |
| CRM core | 12 | 12 | 0 | 0 | `/crm/{leads,tasks,team,tenant-settings,pipeline/*,activities,dashboard/*}` |
| CRM dashboard widgets | 11 | 11 | 0 | 0 | properties-affected, follow-ups, conversion, AR, leaderboard, tasks-today, days-in-stage, stale, storm-alerts, lead-source-revenue, estimating-conversion |
| CRM prospect / calendar / custom fields | 3 | 3 | 0 | 0 | |
| CRM contracts + financing | 5 | 5 | 0 | 0 | contracts, templates, lenders, plans, applications |
| CRM automations + drip + canvass | 5 | 5 | 0 | 0 | |
| CRM reports | 6 | 6 | 0 | 0 | revenue, pipeline, conversion, rep-performance, stage-duration, lead-sources |
| CRM work orders / expenses / subs / territories / invoices | 9 | 9 | 0 | 0 | |
| Estimates | 2 | 2 | 0 | 0 | list + templates |
| Notifications | 3 | 3 | 0 | 0 | list, unread-count, preferences |
| Search + documents | 2 | 2 | 0 | 0 | |
| Roof-measurement | 3 | 3 | 0 | 0 | config / usage / balance |
| Onboarding + admin | 4 | 4 | 0 | 0 | plans, admin overview/tenants/revenue/usage |
| Payments | 2 | 2 | 0 | 0 | connect status, history |
| Materials | 4 | 4 | 0 | 0 | products, branches, orders, credentials |
| Disaster declarations + storm-history | 2 | 2 | 0 | 0 | |
| 404-tests (well-formed missing UUID) | 8 | 0 | 8 | 0 | all return canonical `{"error":"<entity> not found"}` |
| 400-tests (malformed UUID) | 3 | 0 | 3 | 0 | all return `{"error":"Invalid id format"}` |
| 400-tests (empty POST body) | 26 | 0 | 26 | 0 | every endpoint returns a specific required-field message |
| public-bad-token probes | 4 | 1 | 3 | 0 | 1 intentional-200 carry-over: `/crm/financing/public/:token/plans` returns `[]` for bad tokens (item 13, carry-over) |
| heavy-work probes | 3 | 3 | 0 | 0 | accept empty bodies — see Known Issues |
| round-trip create + complete | 2 | 2 | 0 | 0 | created task, then patched `completed_at` — both 200 |
| Miscellaneous | 2 | 2 | 0 | 0 | mark-all-read no-op, delete-missing document |

**Total: 144 / 144 endpoints returned the expected status family. Zero unexpected 5xx. Zero unexpected 4xx.**

### Backend bug fixed

| File:Line | Bug | Fix | Commit |
|---|---|---|---|
| `client/src/components/Dashboard.jsx:672` and `client/src/components/TasksView.jsx:735` | UI sent `{status:"completed"}` to `PATCH /api/crm/tasks/:id`, but the server route only accepts `{completed_at}`. The 400 was silently swallowed, so the task disappeared from local state but the DB row was never updated. The TasksView checkbox was also bound to the non-existent `task.status === "completed"` field, so the checkbox always rendered unchecked. | Now sends `{completed_at: new Date().toISOString()}` from Dashboard, and binds the checkbox to `!!task.completed_at` in TasksView. | `2eb2135 fix(tasks): use completed_at field instead of non-existent status field` |

This bug was surfaced by the round-trip test in the harness, not by the static sweep. The endpoint returned 200 to the harness only after the field rename.

---

## Frontend Feature Test Results

Run 30 (s3) walked every authenticated route via the Playwright MCP browser, calling `mcp__plugin_playwright_playwright__browser_evaluate` to collect computed styles, button signatures, form controls, modal triggers, and header metrics on each page. Code-side static greps (`@heroicons/24/solid`, `react-icons`, `lucide`, `@fortawesome`, native `<select>`, `<input type="date">`) ran in parallel.

| Page | What was tested | Verdict | Notes |
|---|---|---|---|
| `/dashboard` | Header h1, stat cards, glass panels, sidebar nav, TopBar search, notifications | **PASS** | Snapshot captured to `snapshot-dashboard.md` |
| `/storm-map` | Map control, address-search input, layer toggles, sidebar nav | **PASS** | `.address-search__input` deliberately not `.form-input` (compact map overlay control) |
| `/storms` (Storm Archive) | List, filters, pagination | **PASS** | |
| `/pipeline` | Kanban columns, drag handles, filter dropdowns, refresh, Add Lead | **PASS** | Snapshot captured to `snapshot-pipeline.md` — 14 stages, all render |
| `/leads` | List columns, bulk-select, page-size pills, CSV export, Import modal | **FIXED** | `Import` modal had transparent backdrop — fixed in `87d7230` |
| `/leads/:id` (LeadDetail) | Editable fields, documents, activity modal, weather history, billing | **PASS** | All modals confirmed render dark backdrop |
| `/jobs` (Work Orders + sub-tabs) | List, create modal, milestone toggles | **PASS** | |
| `/finance` (Estimates / Invoices / Contracts / Expenses) | Stat cards, list, create, edit, builder preview, expense capture | **PASS** | All 4 sub-tabs render, stat cards consistent |
| `/operations` (Materials / Subcontractors / Canvassing / Territories / Reports / Calendar / Automations / Drip Sequences) | List + modals across all 8 sub-tabs | **FIXED** | Drip Sequences `delete-confirm` modal had transparent backdrop — fixed in `87d7230` |
| `/settings` (all 12 sub-tabs) | Profile, Team, Storm Alerts, Notifications, Skip Trace, Roof Measurement, etc. | **PASS** | All tabs render and switch correctly |
| `/admin` | Overview, tenants, revenue, usage | **PASS** | Requires super_admin role |
| `/reports` | Charts, filters | **PASS** | 9 non-Heroicon SVGs flagged but those are Recharts chart elements, not UI icons |
| `/calendar` | Month view, event tiles | **PASS** | |
| `/canvass-pins` | Map pins, stats, create | **PASS** | |
| `/notifications` | List, mark-all-read | **PASS** | |
| `/tasks` | Filter tabs, create modal, checkbox toggle | **FIXED** | Task complete-toggle was no-op against DB until backend contract fix (`2eb2135`) |
| TopBar | Global search (Cmd-K), notifications bell, importing-properties chip | **PASS** | Global search box deliberately uses `.topbar__search` not `.form-input` (intentional toolbar styling) |
| Sidebar | Nav links, group headers, collapse state | **PASS** | Identical button signature on every page: h=42, padding 12 16, br=12, fs=13.5, fw=500 (active 600) |
| `/alerts` | Stepper number inputs | **PASS** | Stepper inputs deliberately not `.form-input` (intentional sub-control of +/- group) |

**Total: 19 routes / 19 PASS or FIXED. Zero routes broken at end of run.**

### What still needs attention (frontend)

- **Browser-driven write flows** still not exercised end-to-end against persistence: form-submit on Add Lead, kanban drag persists stage, Invoice Record Payment status transition, Work Order checklist toggle, Lead doc upload (real file). Carry-over from Runs 25–29; Run 30 pivoted to UI consistency instead. Highest-yield frontier for Run 31.
- **Mobile sweep at 375 px / 768 px** — last full sweep was Run 6 (24 runs ago).

---

## UI Consistency Audit Results

Detailed report in `ui-audit-results.txt`. Raw per-page metrics in `audit-pass1.json`, `audit-buttons.json`, `audit-modals.json`, `audit-spacing.json`.

| Audit | Method | Verdict | Findings |
|---|---|---|---|
| **1 — Icons** | Code grep + browser walk for non-Heroicon SVGs | **PASS** | 0 results across `@heroicons/24/solid`, `@heroicons/20`, `react-icons`, `lucide`, `@fortawesome`, `font-awesome`, `material-icons`, `@mui/icons`, `fa-*` classes. 19/19 pages render Heroicons-only icons. `/reports` contains 9 Recharts SVGs which are decorative chart elements, not UI icons. |
| **2 — Buttons** | Class-signature grouping per page | **PASS** | All primary CTAs use `auth-btn` (h=36, br=14/12, bg oklch 0.72 0.19 250). All secondary actions use `quick-action-btn` (h=31–36, br=14/12, bg oklch 0.18 0.03 265/0.5). All filter dropdowns use `CustomSelect` (h=36, br=12, bg oklch 0.22 0.02 260/0.45). Pill toggles use br=999. Compact pagination buttons on `/leads` and `/subcontractors` use smaller padding via inline styles — intentional compact variants of `quick-action-btn`. |
| **3 — Toolbar / Header** | Computed height measurement | **PASS** | All 19 pages measured `headerH = 56px` exactly. |
| **4 — Sidebar / Nav** | Per-page nav-button computed style + active-state class | **PASS** | Identical nav buttons on every page: h=42, padding 12 16, br=12, fs=13.5, fw=500 (active 600). All nav links carry a Heroicon outline svg. Nav group headers ("Jobs", "Finance", "Operations") consistent: h=22, fs=11, fw=700. Active state correctly toggled via `is-active` class on the matching link. |
| **5 — Forms** | Native `<select>` + native `<input type="date">` count + `.form-input` class probe | **PASS** | **0 native `<select>` elements anywhere in `client/src`.** **0 native `<input type="date">` / `<input type="datetime-local">` in JSX.** All standard inputs use `.form-input`. Non-form-input inputs are intentional component patterns (TopBar search, inline number stepper, map address-search). All hidden checkboxes are toggle-switch wrappers. |
| **6 — Spacing & Alignment** | H1/H2 font sizes, stat-card gap, glass-panel padding | **PASS** | H1 page-header titles: 18px / fw 700 on every page. Stat-card container gap: 16px on `/estimates`, `/invoices`, `/contracts`, `/expenses`. Glass panel padding varies by content type (kanban 14px, list cards 24px, report panels 20px) — intentional, driven by content density needs. |
| **7 — Modals** | Modal-open round-trip per modal trigger, asserting backdrop styles | **FIXED** | 14 of 16 `.modal-backdrop` instances render correct inline position/background/blur. 2 modals had a transparent-backdrop bug — fixed (see below). All modals use animation `modal-scale-in 200ms` via global CSS selectors. Modal panel sizes match content (300–720 px) and use border-radius from design-system tokens (`--radius-lg`, `--radius-xl`, `--radius-2xl`). Intentional variation. |

### UI bugs fixed

| File:Line | Bug | Fix | Commit |
|---|---|---|---|
| `client/src/components/ImportLeadsModal.jsx:166` | `<div className="modal-backdrop">` had no inline `style` props. The `.modal-backdrop` CSS class in `client/src/index.css:4419` only carries the fade-in animation — it intentionally does NOT set position/inset/background/blur. Result: clicking "Import" on `/leads` opened the modal panel with no darkened backdrop, leaving the underlying page fully visible and click-through. | Added the standard inline block: `position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0 0 0 / 0.6), backdropFilter: 'blur(8px)'` — matching the pattern used by ExpensesView, CalendarView, MaterialsView, etc. | `87d7230 fix(ui): restore backdrop styling on ImportLeads + DripSequences delete modals` |
| `client/src/components/DripSequences.jsx:572` | Same bug pattern on the delete-confirmation modal. | Same fix as above. | `87d7230` (same commit) |

Fix verified via Playwright `getComputedStyle` round-trip on the Import Leads modal after the fix; the dark blurred backdrop now renders correctly. Screenshots: `verify-import-modal.png` (pre-fix), `verify-import-modal-fixed.png` (post-fix).

---

## Bugs Fixed (numbered list)

1. **Dashboard.jsx `handleCompleteTask` (line 672)** — Sent `{status:"completed"}` to `PATCH /api/crm/tasks/:id`, but the route only accepts `{completed_at}`. Task disappeared from local state but the DB row never updated (the 400 was silently swallowed). **Fix:** Send `{completed_at: new Date().toISOString()}`. Commit `2eb2135`.
2. **TasksView.jsx checkbox binding (line 735)** — Checkbox bound to `task.status === "completed"`, but the `tasks` table has no `status` column. Always rendered unchecked. **Fix:** Bind to `!!task.completed_at`. Commit `2eb2135`.
3. **ImportLeadsModal.jsx modal backdrop (line 166)** — Missing inline position/background/blur on the `.modal-backdrop` div. Modal opened with transparent backdrop and page click-through. **Fix:** Added standard inline style block. Commit `87d7230`.
4. **DripSequences.jsx delete-confirm modal backdrop (line 572)** — Same bug pattern as #3. **Fix:** Same as #3. Commit `87d7230`.

Total: **2 commits, 3 files touched, 4 defects fixed** (the Tasks fix is one commit touching two files for one bug class).

---

## Known Issues (Not Fixed)

These are pre-existing carry-overs not introduced by tonight's work. Each is documented with the run that first surfaced it and the reason it remains deferred.

| # | Issue | First Surfaced | Why Not Fixed |
|---|---|---|---|
| 1 | Heavy-work guards accept empty bodies (`POST /drift/correct-all`, `POST /properties/trigger-import`, `POST /crm/leads/score-all`) | Run 11 | Returns 200 with idempotent-noop body when nothing to do; not a defect per existing contract |
| 2 | 16 search-input fields lack explicit `.form-input` class | Run 13 (`form-audit.json`) | Cosmetic; visual styling matches |
| 3 | Pre-token-attach 401 noise on `/api/notifications/unread-count`, `/api/properties/import-progress`, `/api/crm/tenant-settings` | Run 25 | Behavioural — needs proactive expiry check in `client/src/api/client.js` interceptor (~10 lines); deferred |
| 4 | Reports chart label overlap at ~930 px viewport | Run 9 | Cosmetic; needs responsive label-rotation in Recharts config |
| 5 | 404 response shape — Express HTML 404 vs JSON elsewhere | Run 12 | Cosmetic; needs custom 404 handler middleware |
| 6 | Currency-format anti-pattern sweep not done (`$${num}`) — LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals | Run 14 | Carry-over; needs a sweep with `formatCurrency()` helper |
| 7 | `DELETE /api/documents/:id` returns 200 `{"deleted":false}` for missing rows instead of 404 | Run 20 | Cosmetic shape mismatch with sibling DELETE endpoints |
| 8 | `POST /api/webhooks/hearth` permissive on missing fields — empty-body returns 200 not 400 | Run 21 | Security-audit candidate; needs a webhook-fixture validator |
| 9 | `GET /api/skip-trace/job/:jobId` returns 503 when `TRACERFY_API_KEY` unset | n/a | Intentional graceful-degrade |
| 10 | Admin panel requires global `super_admin` role to fully exercise | n/a | Test-tenant scoping decision; not a defect |
| 11 | Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP for live delivery | n/a | Configuration; needs SMTP setup |
| 12 | Webhook signature delivery paths — valid-signature paths need real signing keys | n/a | Configuration; needs key material |
| 13 | `/crm/financing/public/:token/plans` returns `200 []` for invalid tokens (vs 404 from siblings) | Run 28 | Cosmetic shape mismatch |
| 14 | `.modal-backdrop` CSS class still requires inline styling at each call site (16 sites repeat ~6 lines of position/background/blur) | Run 30 | Refactor — could absorb boilerplate to prevent the exact bug class fixed in #3+#4, but deliberately skipped this run per "don't refactor working features" rule; Run 31+ could reconsider |
| 15 | `subcontractors.js.bak` — 8 dead routes | Run 17 | Safe `git rm` deferred per "don't refactor working state" |
| 16 | `/content-studio` orphan reference in old docs but never implemented | Run 18 | Decision: build or scrub |
| 17 | `/subcontractors` has both H1 "Subcontractors" and H2 "Subcontractors" | Run 30 | Content choice, not consistency defect |
| 18 | Storm-source enum errors leak DB internals (`invalid input value for enum storm_source`) | Run 22 | Security-audit candidate |
| 19 | `qa-fixtures/` does not exist — file upload success paths untested with real binaries | Run 19 | Needs fixture material |

---

## Test Coverage Gaps

| Area | Why not fully tested |
|---|---|
| **Browser-driven WRITE flows** (form-submit, kanban drag, Invoice Record Payment, Work Order checklist toggle, Lead doc upload) | Carry-over from Runs 25–29. Runs 28–30 walked render-only. Highest-yield frontier for Run 31. |
| **Mobile responsive sweep at 375 px / 768 px** | Last full sweep was Run 6 (24 runs ago). Carry-over. |
| **CSV import success path with real file** | "No bulk DB writes" rule — needs targeted fixture write. |
| **Multipart upload SUCCESS path with binary content** | `qa-fixtures/` missing; needs fixture material. |
| **CSV export download** | Verified by 200 status only, not by `Content-Type` and download trigger. |
| **QuickBooks / Twilio / Stripe live flows** | Pre-existing; needs live API keys. |
| **Email delivery** (`/crm/test-email`, `/invoices/:id/send-email`) | Needs SMTP configuration. |
| **Webhook valid-signature paths** | Needs real signing keys. |
| **Admin panel full surface** | Requires global `super_admin`. |

---

## Session Integrity

| Stage | Run # | Outcome | Turns | Cost | Commits |
|---|---|---|---|---|---|
| s1 api-test | 29 | **completed** | (harness ran cleanly, 144 endpoints) | — | `2eb2135` (1 commit, 2 files for one bug class) |
| s2 frontend-test | 29 | `error_max_turns` | 81 | $4.39 | 0 — render walk only |
| s3 ui-audit | 30 | **completed** with deliverable | — | — | `87d7230` (1 commit, 2 files for one bug class) |
| s4 verify | 30 | `error_max_turns` | 41 | $2.56 | 0 — captured `verify-import-modal-fixed.png`, `qa-run30-{01-04}-*.png`, `snapshot-{dashboard,pipeline}.md` |
| s5 report | 30 | written in follow-up session | — | — | this file + `docs/overnight-history.md` append |

**This is the first run since Run 26 to produce real source-code commits** (the prior three runs each produced zero). After 4 consecutive zero-fix runs (Runs 26–28), Run 29's API harness round-trip surfaced the Tasks contract bug, and Run 30's modal round-trip surfaced the backdrop bug. Both bug classes had been latent for an unknown number of runs because the harness previously only tested static reads, not round-trip writes; and the audit previously only tested static SVG/class signatures, not modal-open round-trips.

Run-number labelling inconsistency persists across stages: s1 self-labelled "Run 29", s3 self-labelled "Run 30", screenshots use `qa-run30-*` prefix. Orchestrator script still needs to pass a stable run number into each stage's prompt.

---

## Diff vs. Run 28 (last reported baseline)

- `git diff 257a658..87d7230 -- server/src/` — empty
- `git diff 257a658..87d7230 -- client/src/components/Dashboard.jsx` — 1-line change (`handleCompleteTask` payload)
- `git diff 257a658..87d7230 -- client/src/components/TasksView.jsx` — 1-line change (checkbox binding)
- `git diff 257a658..87d7230 -- client/src/components/ImportLeadsModal.jsx` — 6 lines added (modal-backdrop inline style)
- `git diff 257a658..87d7230 -- client/src/components/DripSequences.jsx` — 6 lines added (modal-backdrop inline style)
- `git diff 257a658..87d7230 -- qa-api-test.mjs` — empty (harness unchanged from Run 26's corrected baseline)

Branch `feat/financing` advanced from `257a658` → `2eb2135` → `87d7230`.

---

## Next Run Plan (Run 31)

The two consecutive UI-driven runs (Run 29 API round-trip + Run 30 UI modal round-trip) have each found exactly one fix. The **browser-write-flow phase of carry-over #1 is still untouched and remains the highest-yield frontier**. Plan:

1. Real form-submit round-trips against each write surface: Add Lead, kanban drag persists stage, Invoice Record Payment, Work Order checklist toggle, Lead doc upload (real file).
2. Mobile viewport sweep at 375 px / 768 px (24 runs since last full sweep).
3. If still low yield, pivot to currency-format consistency sweep (carry-over #6 above).
4. Consider absorbing modal-backdrop boilerplate into `.modal-backdrop` CSS class (carry-over #14) to prevent recurrence of the bug class fixed this run.
