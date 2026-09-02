# StormLeads — Overnight QA Report

**Date:** 2026-09-01
**Branch:** `feat/financing`
**Baseline:** `24d95bd` (tag `pre-overnight-20260901`) → **HEAD `6479d9e`**
**Final build:** `npx vite build` — **exit 0, built in 7.97s**

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (functional, real interactions) | **18 routes + 15 Settings tabs** |
| Pages audited (UI consistency) | **19 routes** |
| API endpoints in inventory | **272** across 36 route files |
| API endpoints exercised | **198 distinct paths / 248 path+method pairs** |
| Total API requests issued | **≈12,800** (314 sweep + 12,375 query-param + ~65 jsonb + 45 post-fix verify) |
| **Bugs found** | **2** |
| **Bugs fixed** | **2** |
| Regressions found | **0** |
| UI inconsistencies found | **1** |
| UI inconsistencies fixed | **1** |
| 5xx responses / uncaught throws | **0 / 0** |
| Commits | **3** (2 fixes, 1 test-harness carry) |
| Net DB rows created by QA | **0** |

### Stage execution

| Stage | Outcome | Turns | Duration | Cost | Artifact |
|---|---|---|---|---|---|
| s1-api-test | `error_max_turns` | 51 | 10.8 min | $5.06 | written early, §5 left unfilled |
| s2-frontend-test | **success** | 76 | 30.6 min | $10.42 | complete, 20 sections |
| s3-ui-audit | `error_max_turns` | 61 | 15.8 min | $6.61 | complete (written before cap) |
| s4-verify | `error_max_turns` | 41 | 10.9 min | $3.82 | **none produced** |

Total agent cost through s4: **$25.91**. Three of four stages hit the turn cap — s1 for the
**seventh** consecutive run. Stage self-numbering diverged again (s1/s2 → "Run 114",
s3 → "Run 115", s4 → "Run 116"); they are one calendar run.

---

## Backend API Test Results

Inventory: **272 routes / 36 files** — GET 132, POST 88, PATCH 26, DELETE 18, PUT 8
(140 write routes). 109 of 272 paths carry a `:param` and need a real id.

### Full route sweep (`server/.qa-r114-sweep.mjs`)

| Phase | What | Ran | Excluded | Statuses |
|---|---|---|---|---|
| A | GET, real ids | 130 | 2 | 200:103 400:11 403:5 404:11 |
| B | POST/DELETE, dead id, `{}` | 85 | 21 | 400:56 404:29 |
| C | PATCH/PUT, dead id, `{}` | 33 | 1 | 200:4 400:18 403:1 404:10 |
| D | PATCH/PUT, real id, `{}` | 33 | 1 | 200:9 400:18 403:1 404:5 |
| E | PATCH/PUT, real id, unknown field | 33 | 1 | 200:9 400:17 403:1 404:6 |

**314 requests · 200:125 400:120 403:8 404:61 · 0 5xx · 0 threw · 0 defects.**

### Per-category results

Categories are route files. "Passed" = responded with a defensible status — no 5xx, no
throw, no silent accept of bad input.

| Category (route file) | Endpoints in file | Requests | Statuses | Passed | Failed |
|---|---|---|---|---|---|
| CRM (`crm.js`) | 51 | 61 | 200:30 400:23 404:8 | 61 | 0 |
| **Estimates (`estimates.js`)** | 17 | 20 | 200:7 400:7 404:6 | 20 | 0 in sweep — **1 defect from the jsonb probe** (below) |
| Financing (`financing.js`) | 13 | 17 | 200:5 400:10 404:2 | 17 | 0 |
| Contracts (`contracts.js`) | 13 | 16 | 200:4 400:5 404:7 | 16 | 0 |
| Work orders (`workOrders.js`) | 12 | 15 | 200:7 400:2 404:6 | 15 | 0 |
| Properties (`properties.js`) | 18 | 15 | 200:6 400:8 404:1 | 15 | 0 |
| Skip trace (`skipTrace.js`) | 10 | 12 | 200:5 400:5 404:2 | 12 | 0 |
| Materials (`materials.js`) | 9 | 11 | 200:7 400:1 404:3 | 11 | 0 |
| Drip sequences (`drip.js`) | 8 | 10 | 200:2 400:3 404:5 | 10 | 0 |
| Subcontractors (`subcontractors.js`) | 8 | 10 | 200:3 400:5 404:2 | 10 | 0 |
| Roof measurement (`roofMeasurement.js`) | 8 | 10 | 200:5 400:5 | 10 | 0 |
| Automations (`automations.js`) | 5 | 9 | 200:1 400:4 404:4 | 9 | 0 |
| Notifications (`notifications.js`) | 6 | 9 | 200:3 400:3 404:3 | 9 | 0 |
| Admin (`admin.js`) | 6 | 8 | 403:8 | 8 | 0 — 403 by design, documented non-bug |
| Invoices (`invoices.js`) | 8 | 8 | 200:4 400:2 404:2 | 8 | 0 |
| Territories (`territories.js`) | 6 | 8 | 200:3 400:4 404:1 | 8 | 0 |
| Leads (`leads.js`) | 6 | 8 | 200:4 400:2 404:2 | 8 | 0 |
| Onboarding (`onboarding.js`) | 7 | 8 | 200:4 400:4 | 8 | 0 |
| Canvassing (`canvassing.js`) | 5 | 7 | 200:2 400:4 404:1 | 7 | 0 |
| Expenses (`expenses.js`) | 5 | 7 | 200:2 400:4 404:1 | 7 | 0 |
| Reports (`reports.js`) | 6 | 6 | 200:6 | 6 | 0 |
| Alerts (`alerts.js`) | 4 | 5 | 200:5 | 5 | 0 |
| Payments (`payments.js`) | 7 | 5 | 200:2 400:3 | 5 | 0 |
| Auth (`auth.js`) | 5 | 4 | 200:1 400:3 | 4 | 0 |
| Drift (`drift.js`) | 5 | 4 | 400:2 404:2 | 4 | 0 |
| Dashboard (`dashboard.js`) | 3 | 3 | 200:3 | 3 | 0 |
| Documents / counties / dataApis / map | 13 | 12 | 200:2 400:8 404:2 | 12 | 0 |
| Storms / storm history / disasters / search | 6 | 6 | 200:2 400:3 404:1 | 6 | 0 |

### New dimension — duplicate / bracketed query params (closed)

Express's `qs` turns `?x=a&x=b` into an **array** and `?x[a]=1` into an **object**. Every
handler that assumes `req.query.X` is a string sees a shape it never planned for. This
dimension had never been tested.

| Variant | Shape delivered | Requests | Statuses |
|---|---|---|---|
| dup-array | `['1','2']` | 4,125 | 200:3153 400:378 403:165 404:429 |
| bracketed object | `{a:'1'}` | 4,125 | 200:3168 400:363 403:165 404:429 |
| nested array | `['1','2']` | 4,125 | 200:3168 400:363 403:165 404:429 |

125 GET routes × 33 real param names × 3 shapes = **12,375 requests · 0 5xx · 0 threw ·
0 defects.** Query-string type confusion is **clean — dimension closed.**

### jsonb container-type guards (where the defect came from)

Method: PATCH a real row with a wrong-typed value, read the column back, revert.

| Column | string | number | object | array | null | Verdict |
|---|---|---|---|---|---|---|
| `estimates.line_items` | 400 | 400 | 400 | ok | 200 | guarded |
| `estimates.financing_plan_ids` | 400 | 400 | 400 | ok | 200 | guarded |
| `estimates.upgrades` | 400 | 400 | 400 | ok | 200 | guarded |
| `estimates.insurance_details` | 400 | 400 | ok | 400 | 200 | guarded |
| **`estimates.discounts`** | **200** | **200** | **200** | ok | 200 | **NO GUARD** |
| **`estimates.signers`** | **200** | **200** | **200** | ok | 200 | **NO GUARD** |
| **`estimates.deposit`** | **200** | **200** | **200** | ok | 200 | **NO GUARD** |
| `invoices.line_items` | 400 | 400 | 400 | ok | 200 | guarded |
| `work_orders.line_items` | 400 | 400 | 400 | ok | 200 | guarded |
| `contracts.content` | 400 | 400 | ok | 400 | — | guarded |
| `leads.custom_fields` | 400 | 400 | ok | 400 | 400 | guarded |
| `leads.tags` (`text[]`) | 400 | 400 | 400 | ok | 200 | guarded |
| `custom_field_definitions.options` | 400 | 400 | 400 | ok | 200 | guarded |

All probed rows verified restored. → **Bug 1**, fixed in `f7bb323`.

**Post-fix verification — re-run at 06:10 in this stage against the live server:
45 probes, 45 pass / 0 fail.** All five array fields (`line_items`, `financing_plan_ids`,
`upgrades`, `discounts`, `signers`) now reject string / number / bool / object with a 400
and a named message; both object fields (`insurance_details`, `deposit`) reject
string / number / bool / array. Legitimate shapes still pass validation and reach the 404.
The guard applies on **both `PATCH /:id` and `POST /` (create)**.

---

## Frontend Feature Test Results

18/18 authenticated routes rendered with an `<h1>`, exactly one `.nav-link.is-active`, and
**0 page errors**. Every page below was driven with **real interactions**, not just
rendered. **0 app defects, 0 regressions, 0 fixes needed.**

| Page | What was tested | Result | Needs attention |
|---|---|---|---|
| `/dashboard` | 6 of 7 clickable stat tiles, 14 funnel tiles, date-range control | **PASS** — all 6 navigate (Storm Map, View Leads, Pipeline Value, New Leads 7D, Close Rate, Avg Days to Close); funnel tile → `/leads?stage=contacted`; 7d/30d/90d vs YTD/All-Time drive real refetches | — |
| `/leads` | search, all 4 `CustomSelect` filters, sort toggle, page sizes, row click | **PASS** — filters fire correct query params *and* change row counts (Stage→New 13→9, Priority→Hot 13→2, Source→Storm Map 13→5, Score 80+ 13→1); sort toggles `DESC`→`ASC`; 25/50/100 all fire `limit=` | — |
| Lead detail overlay | Score Breakdown, Log Activity, stage picker, roof-type picker, Storm History, FEMA, Insurance Report | **PASS** — real per-factor scores; 11 stages in the picker; FEMA hits `GET /api/disaster-declarations?state=TX&county=Travis`; Insurance Report renders +1158 chars | — |
| `/pipeline` | 3 board tabs, **HTML5 drag both directions** | **PASS** — Sales(7)/Production(5)/Billing(4) column sets; drag New→Contacted fired `PATCH /api/crm/leads/… {"stage":"contacted"}` (9/2→8/3), dragged back (net zero) | — |
| `/estimates` | list + status filter, builder line items, profit-margin slider, save | **PASS** — Draft filter 16→14 rows; 2 blank rows at qty 2 × $150 → row totals $300/$300, **Subtotal $600.00**; 30% margin → cost $420.00 / profit $180.00; Save Draft POSTs a well-formed body (stubbed) | — |
| Estimate review toolbar | Back to Editor / PDF / Sign Now / Send for Signing | **PASS 4/4** — PDF really downloads `EST-090.pdf`; Back to Editor restores +864 chars / +17 inputs, matching the Run 105 baseline. **4th consecutive clean run**; fixes `eb6331b` + `6462647` hold | — |
| `/invoices` | New Invoice; **Record Payment full flow** | **PASS** — editor for INV-0007 shows Total $5,000.00 / Paid $603.00 / **Balance Due $4,397.00**; quick-fills, 7 methods; a typed amount posts `{"amount":1,…}` — honoured (stubbed) | — |
| `/work-orders` | New Work Order modal; card detail overlay | **PASS** — modal has Title\*/Description/Job Type Template + 7-step checklist preview; detail shows Line Items (1) Total $100.00 and **Milestones (0/7)** with all 7 mark-complete buttons | — |
| `/tasks` | tabs, priority mapping, overdue badge, toggle, create | **PASS** against a stubbed list (the tenant has 0 tasks) — Pending 2 / Completed 1 switch; hot→HIGH, warm→MEDIUM, cold→LOW; "12d overdue"; toggle → `PATCH`, create → `POST` | — |
| `/calendar` | 4 views, next-period, **real-pointer `dateClick`** | **PASS** — Month(42 cells)/Week(15)/Day(3)/List; Sept→Oct 2026; day-cell click opens Create Task pre-filled `10/7/2026` | — |
| `/reports` | 5 date presets | **PASS** — This Quarter / This Year / All Time render 9 recharts surfaces; This Week / This Month show the documented empty state | — |
| `/storm-map` | 5 layer toggles, address input, storm rows, time range | **PASS** — all 5 checkboxes flip; `.gm-style` + 20 tiles + zoom controls + 10 storm rows; time-range toggle changes the panel 482→530 chars | Google Places autocomplete deliberately not typed into (metered API) |
| `/canvassing` | Pin Legend, Manage Territories, **Drop Pin + real map click** | **PASS** — 7 outcomes in the legend; territory list works; New Pin form opens with a live GPS fix (32.701390, -97.301395), 6 outcomes, Save Pin present (**not clicked — 0 writes**) | — |
| `/materials` | Add to cart, Order History / Product Catalog tabs | **PASS** — cart badge → "Cart 1"; both tabs switch and render their own tables | — |
| `/subcontractors` | search, row Edit slide-over | **PASS** — search 25→0→25; Edit opens the full slide-over | 30 of 64 rows carry junk names (DB hygiene, below) |
| `/storm-catalog` | type filters, time ranges | **PASS** — Hail 38 / Wind 136 / Tornado 0 / All 200; 24h 3 / 7d 200 / 30d 200 (200 = server page cap) | — |
| `/expenses` | Add Expense modal, category filter | **PASS** — filtering to `Permit` gives "0 expenses" + empty state, so the filter is live | — |
| `/contracts` | New Contract, row actions, editor | **PASS** — rows expose View / PDF / Send / Void; View opens the full contract editor | Rows have **no Edit** button (by design) |
| `/settings` (15 tabs) | all 15 tabs + 8 interactions | **PASS 15/15** — profile, company, billing, payments, team, alerts, notifications, email, financing, automations, drip-sequences, custom-fields, pricing, contracts, reviews. **0 page errors, 0 4xx across all 15.** Storm Alerts master toggle fires `PUT /api/alerts/config` (stubbed, restored); SMTP "Show" flips password→text | The charter's "Integrations" tab does not exist — unbuilt feature, documented non-bug |
| `/admin` | render | **PASS** — 403 on `/api/admin/overview` by design (dev-bypass `super_admin` in the SPA vs a real `admin` token) | — |

### Type-confusion sweep at the builder/detail level — **lead closed**

A lead open for three runs. Method: intercept every `/api/` response and recursively rewrite
**17 jsonb-ish keys** (`line_items, upgrades, signers, discounts, sections,
financing_plan_ids, insurance_details, content, milestones, checklist, photos, attachments,
options, custom_fields, tiers, payments, activities`) to a **truthy non-array** (`"oops"`,
`42`), then open each builder/detail.

**Result: 0 white screens, 0 page errors, 8/8 flows.** The `Array.isArray` guards added by
earlier runs (`EstimatesView.jsx:1337/1350/1353/1368`, `InvoicesView.jsx:488`,
`SettingsView.jsx:2074/2228`, `LeadDetail.jsx:1319`, `WorkOrdersView.jsx:113/:843`) hold at
the detail level as well as the list level. **Lead closed.**

### Frontend items that looked broken but were not

Eight apparent dead controls all resolved to **test-harness selector errors**, not app
defects. Recorded so future runs do not re-file them: the lead-detail stage and roof-type
pickers are **inline, not portaled**; `Record Payment` lives in the invoice **editor**, not
the row; modal input lookups must be scoped to the modal node (the first
`input[type=number]` in document order sits *behind* it); `/contracts` rows say **View**,
never Edit; **all 6 Settings create controls are inline forms**, so an overlay-count
detector reports every one as dead; the cart badge sits on the next line; canvassing icon
buttons have empty `innerText`; and the 0×0 "Keyboard shortcuts" button on map routes is
**Google's**, not the app's.

---

## UI Consistency Audit Results

19 routes swept. **Audits 1–7 converged for the 17th consecutive run** and cost 2 tool
calls, so the remaining budget went to a new dimension.

| Category | Findings | Fixed? |
|---|---|---|
| **Icons** | **None.** 43 icon imports, **all 43** from `@heroicons/react/24/outline` — 0 solid, 0 `/20` or `/16`, 0 lucide / react-icons / fontawesome / material. 2,206 runtime `<svg>` across 19 routes: 2,197 on the Heroicon `0 0 24 24` viewBox; the 9 others are all `class="recharts-surface"` chart and legend SVGs on `/reports` — the documented non-bug. 0 foreign icon classes on any route. | N/A — clean |
| **Buttons** | **No inconsistency.** Per-route distinct signatures 8–16 and distinct radii 3–7 — the established deliberate spread (primary / secondary / icon-only / pill filter / segmented group). Radii use an intentional **elliptical squircle scale** (10/8, 14/12, 20/18 px across 81 JSX + 8 CSS sites) approximating iOS 26 Liquid Glass. Investigated and cleared. | N/A — clean |
| **Toolbars / headers** | **Consistent across pages.** `.topbar.glass` measures exactly **56px on 19/19** routes; a correct `<h1>` is present on 19/19. | N/A — clean |
| **Sidebar / nav** | **Consistent.** 22 buttons / 22 icons / 0 anchors on 19/19 (19 nav items + 3 collapsible group headers: JOBS, FINANCE, OPERATIONS). Item heights 42px for nav items, 21–22px for group headers. Exactly one `.is-active` on **18/19**. | N/A — clean. The 19th is `/alerts`, the known orphan route (below) |
| **Forms** | **No non-standard elements.** **0 native `<select>` and 0 native `input[type=date\|time\|datetime-local]`** on all 19 routes *and* 0 in source — `CustomSelect` / `DatePicker` used throughout. 22 inputs lack `.form-input`; all 22 are accounted for: the TopBar ⌘K search (own `.topbar__search` styling including its own `::placeholder` rule), `.address-search__input` on `/storm-map`, and 2 × 26px inputs on `/alerts` that are the inner field of a segmented numeric stepper (`AlertSettings.jsx:311`) whose wrapper carries the radius — the same deliberate wrapper-carries-the-radius pattern already documented twice. | N/A — clean |
| **Spacing / alignment** | **No issues.** Distinct `.glass` padding values per route 2–6; glass element counts stable (2 on `/admin` → 202 on `/storm-catalog`). **0 horizontal overflow** (`scrollWidth - clientWidth === 0`) on 19/19. | N/A — clean |
| **Modals** | **All consistent.** Overlays at rest (`.modal-backdrop`, `[role=dialog]`, `.slide-over`) = **0 on 19/19** — no stray or leaked overlay on any route. Modal *interiors* were swept in a prior run (2 defects fixed then) and were not re-opened. | N/A — clean |
| **NEW — UA-rendered surfaces** | **1 defect.** `color-scheme` was declared on only three scoped selectors (`index.css:2329`, `:2346`, `:4208`), so the computed value at `:root` and on `body` was `normal`. On a light-mode OS Chrome painted every UA-owned surface light — visibly, autofilled `.form-input` fields on `/login`, `/register` and `/onboarding` rendered as a light box inside the dark glass card. There is no `:-webkit-autofill` treatment anywhere in the codebase (0 rules). | **YES — `15bd0e5`** |

The 14-surface UA sweep (autofill, native control chrome, select popups, date pickers,
checkbox, radio, range, file button, search cancel, progress/meter, scrollbars,
`::placeholder`, caret, `::selection`) found autofill to be **the only uncovered surface**.
Everything else is either custom-styled or absent from the app. **Dimension exhausted and
closed.**

---

## Bugs Fixed

1. **[API — `PATCH /api/estimates/:id` and `POST /api/estimates`]** — *`discounts`,
   `signers` and `deposit` accepted a string, number or object behind a 200.*
   `estimateService.js` stringifies all three into `jsonb` columns, and `jsonb` stores
   whatever shape it is handed — unlike a `text[]` or `numeric` column there is no cast to
   fail, so nothing rejected the write. The junk surfaces later as a render crash in the
   estimate builder. Root cause: the route's `JSON_ARRAY_FIELDS` / `JSON_OBJECT_FIELDS`
   lists did not cover every name in `estimateService.js`'s `jsonFields` (`:195-197`).
   **Fixed** by adding `discounts` and `signers` to `JSON_ARRAY_FIELDS` and `deposit` to
   `JSON_OBJECT_FIELDS`, with a comment binding the two lists to the service's list so they
   cannot drift apart again. → **`f7bb323`** · verified in this stage: **45/45 probes pass**,
   on create as well as update.

2. **[UI — app-wide; visible on `/login`, `/register`, `/onboarding`]** — *the root
   `color-scheme` was never declared, so the browser painted its own surfaces light.*
   Autofilled credential fields rendered light-on-dark inside the dark glass card — on the
   first screen a returning user sees. **Fixed** with `:root { color-scheme: dark; }` in
   `@layer base`, the same layer as the three pre-existing scoped declarations. Measured
   before and after in one browser session: root/body computed `colorScheme` `normal` →
   `dark`; a bare native input flipped `rgb(255,255,255)`/`rgb(0,0,0)` →
   `rgb(59,59,59)`/`rgb(255,255,255)`; app `.form-input` background, colour, height and
   `backdrop-filter` **unchanged** (glass preserved); the 19-route sweep identical to the
   pre-fix baseline. `color-scheme` affects painting only, never geometry — no layout risk.
   → **`15bd0e5`**

The third commit, **`6479d9e`**, is not a fix: it carries five API test harnesses
(`server/.qa-r114-*.mjs`) that s1 left untracked when it hit the turn cap.

---

## Known Issues (Not Fixed)

**Developer decisions — outside the QA charter to change unilaterally:**

- **No error boundary anywhere in the SPA.** The amplifier behind four past defects: any
  single component throw takes the whole app to a white screen instead of one broken panel.
  Highest-leverage backlog item, but an enhancement rather than a bug fix.
- **64 generic error toasts discard the server's actionable message** — against 22 sites
  that surface it. Compare `InvoicesView.jsx:566` with the correct idiom at `:592`. An
  app-wide convention change.
- **Form-label drift — 7 treatments, ~100 inline labels.** Carried for the 10th run. A
  refactor, not a defect.
- **`/alerts` is an orphan route** — nothing in the nav links to it (0 `.is-active`) and it
  is duplicated under Settings → Storm Alerts. Add a nav entry or retire it.
- **`EstimatesView.jsx:1318`** — measured and deliberately not fixed; guarding it means
  `Array.isArray`-ing every `.map()` in the client.

**DB hygiene — verified directly against the database in this stage (06:11). All
pre-existing; none created tonight.**

- **30 of 64 subcontractors carry JSON-literal names**, user-visible on `/subcontractors`:
  `{"1","2","3"}` ×15, `{"$eq":1}` ×14, `{"deep":[1,null]}` ×1. Created between 2026-04-09
  and 2026-07-27 by earlier fuzz probes. The standing hygiene sweep matches `'QA-R9%'`,
  which none of them match. Needs a go-ahead to delete.
- **`canvass_territories` holds one row named `12345`** (created 2026-08-20), visible in
  Manage Territories.
- **Estimate EST-082 carries a stray QA signer** — `s4signer@example.com` /
  "S4First S4Last", last touched **2026-08-21**. **Newly identified this run**, not
  previously tracked. It is a well-formed array element, so nothing breaks; it is data junk.
- **✅ Resolved this run:** the `qa_options_probe` custom field that held a **string** in a
  `jsonb options` column — left by a 2026-08-05 probe, before the guard at `crm.js:1160`
  existed — has been removed; `custom_field_definitions` is now empty (0 rows). *Caveat: no
  pre-cleanup row count was recorded, so I can confirm the junk row is gone but cannot prove
  nothing else was removed with it.*
- **Shape audit is clean:** 0 non-container `jsonb` values remain in `estimates`,
  `invoices`, `work_orders`, `contracts`, `leads` or `custom_field_definitions`. Every row
  the type-confusion probes touched was verified restored.

**Housekeeping:**

- **361 QA screenshots committed to the repo root.** Zero added tonight — both s2 and s3
  wrote theirs to `C:/tmp` instead.
- **`server/.qa-r91-neverrun.mjs` has still never been run — 14 nights.**
- `tenants.updated_at` moved 2026-08-31 → 2026-09-01 inside s1's window: a tenant-singleton
  `PATCH` bumps `updated_at` even when the body sets no column. Cosmetic, **not** filed as a
  defect — but it means "0 writes" above means "0 rows added", not "no row touched".

---

## Test Coverage Gaps

- **s4-verify produced no artifact.** It capped at 41 turns having written three harnesses
  (`s4-guard-probe.sh`, `s4-positive.mjs`, `s4-jsonb-semantics.mjs`) but no results file.
  **I ran its guard probe myself in this stage — 45/45 pass** — so Bug 1 is independently
  verified. What remains unverified is s4's **positive-path** test: that a *legitimate*
  `discounts` / `signers` / `deposit` payload is stored verbatim after the guard. The guard
  probe proves valid shapes pass validation (they reach the 404), and `f7bb323` touches only
  the validator, not the write path — but end-to-end storage was not re-measured. Not run
  here because it writes to a real row, against the standing minimize-writes rule.
- **s4's jsonb-merge semantics probe never ran** (`server/.qa-r116-s4-jsonbsem.mjs`,
  untracked). It asks whether an unguarded `COALESCE(col,'{}') || $n::jsonb` column can be
  *corrupted* or merely errors — the generalisation of tonight's defect to every other
  jsonb-merge write site. Open lead.
- **s1 never filled in §5 of its own artifact.** The API section above was reconstructed
  from raw JSON that s1 wrote and never read (`C:/tmp/qa-r114-*.json`). **Third consecutive
  run with this pattern.**
- **24 of 272 routes were never exercised:** 18 excluded by design (side-effecting — real
  sends, payments, geocodes), 4 structurally unexercisable (`counties` and
  `material_products` tables absent, `42P01`; `contracts.public_token` and
  `leads.status_token` are not columns, `42703`), 2 excluded per phase.
- **The 3 public `:token` routes** (contract signing, estimate signing, lead status) were
  not driven under interaction — they need a valid token the schema cannot currently issue.
- **Settings write paths were stubbed, not committed.** All 15 tabs render and all 8 probed
  controls open, but every create form was measured *open*, not *submitted*, and the one
  toggle that fires a `PUT` was intercepted. Whether those writes persist correctly is
  unmeasured.
- **`/admin`'s four tabs** are unmeasured beyond the shell — the SPA's dev-bypass
  `super_admin` does not match a real `admin` token, so the page 403s by design.
- **`/content-studio` and `/leads/:id`** appear in no sweep, static or functional.
- **Paid APIs deliberately untouched:** Google Places autocomplete on `/storm-map`, single
  property geocoding, and canvassing pin saves (which write a row *and* geocode).
- **No screenshots taken or committed**, by choice — see the 361 already in the repo root.

---

## Notes for the Next Run

1. **Stage capping is still the dominant failure mode, not any individual defect.** Three of
   four stages capped; s1 has now capped seven runs running. Tonight's defect count reflects
   how much testing ran, not how much of the app is sound. Either raise the s1/s4 turn
   budgets or narrow their charters.
2. **s2's success is the template.** It was the only stage to finish, and it did so on the
   widest charter, by writing its artifact incrementally and using **one aggregating browser
   call per dimension** rather than one call per route.
3. **The silent-type-loss streak is broken on the frontend but not the backend.** Tonight's
   backend defect is that same shape for the eleventh consecutive run: a value silently
   loses its expected type and the failure is invisible at the call site. Triage this shape
   first. `|| []` and `|| {}` are **not** type guards — they rule out `null` and `undefined`
   only.
4. **Reassign the s3 slot.** The UI charter is exhausted: Audits 1–7 now cost 2 tool calls
   and have converged 17 runs in a row. Run them as a regression check and spend the rest of
   that budget on a new dimension.
5. **Access tokens live 15 minutes.** A session inherited from a previous stage will still
   render the dashboard shell from cached `localStorage.user` while every request 401s.
   Check an actual API status before trusting a session. Mint per stage and inject both
   token and refresh token (keys: `token`, `refreshToken`, `user` — *not* `accessToken`).
6. **Playwright MCP cannot write outside the repo** — a `C:\tmp` target fails *and the
   evaluate result is lost*. Return results inline and compact.
7. **Estimates are mounted at `/api/estimates`, not `/api/crm/estimates`**
   (`routes/index.js:62` versus `:57`/`:60`). A probe on the `/api/crm/` path 404s on every
   case and reads as "fully guarded" — this trap hid tonight's defect from earlier runs.
8. **`leads.tags` is `text[]`, not `jsonb`.** A `JSON.stringify`-based restore hands pg the
   string `"[]"` and throws `22P02`, aborting the harness *after* it has mutated the row.
   Read `pg_typeof` first. Cost a manual DB restore this run.
9. **Give map routes ≥4s before measuring** — at 2.2s Google's own "Sorry, we have no
   imagery here." sits in `main.innerText` and reads as an app failure.
10. **Drift baseline for the next run:** the `docs: QA report 2026-09-01` commit — HEAD after
    this entry.
