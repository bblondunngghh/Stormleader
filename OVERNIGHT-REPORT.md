# StormLeads — Overnight QA Report

**Date:** 2026-09-04
**Branch:** `feat/financing`
**Baseline:** `a996c76` (`pre-overnight-20260904`, 05:00) → **HEAD `1733a1c`**
**Stages:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report

> **Run number:** the stages disagreed. s2 labelled itself *Run 123*, s3 labelled itself
> *Run 124*, and both ran tonight. Harness filenames inherit the disagreement
> (`.qa-r123-*` from s1/s2, `.qa-r124-*` from s3/s4). This report keys everything to the
> **date and stage name**; the number is not load-bearing and should be resynchronised
> before the next run.

---

## QA Test Summary

| Metric | Result |
|---|---|
| Top-level routes tested | **19 / 19** render (s2 and s3 independently) |
| Settings sub-panels tested | **15 / 15** — a surface never swept before tonight |
| Detail / modal surfaces tested | `/leads/:id` slide-over (8 controls) + **13** create controls across 8 routes and 3 Settings panels |
| API endpoints tested | **170** route probes — 132 GET (every GET in the inventory) + 38 collection-level POST/PUT |
| Route inventory | **272 routes / 36 files** — GET 132 · POST 88 · PATCH 26 · PUT 8 · DELETE 18 (unchanged since Run 114) |
| Client source files statically swept | **76** (undeclared-setter check) |
| **Bugs found** | **4** |
| **Bugs fixed** | **4** (2 commits) |
| UI inconsistencies found | **0** — audits 1–7 all converged |
| Regressions introduced | **0** |
| Build | **PASS** — s2 12.20s · s3 8.01s · s5 final check 8.12s |
| Database | **Net zero.** Tenant-scoped counts byte-identical before and after; 32-table count snapshot identical across the API write sweep |
| Screenshots added to repo | **0** |

### Stage completion — three of four working stages hit their turn cap

| Stage | Terminal reason | Turns | Artifact written | Commits |
|---|---|---|---|---|
| s1 api-test | 🔴 `error_max_turns` | 51 / 50 | **none** (recovered by s5 from `C:/tmp/qa-r123-*.json`) | 0 |
| s2 frontend-test | ✅ `success` | 83 | `/tmp/frontend-test-results.txt` (12,009 B) | `71d06dc`, `130eff6` |
| s3 ui-audit | 🔴 `error_max_turns` | 61 / 60 | `/tmp/ui-audit-results.txt` (13,727 B) | `092d37a`, `1733a1c` |
| s4 verify | 🔴 `error_max_turns` | 41 / 40 | **none** | 0 |

s3 capped *after* writing its artifact and committing its fix, so its charter is fully
reported. s1 capped before writing anything but *after* its harnesses had run — s5
reconstructed its results from the JSON those harnesses left on disk. **s4 produced no
verdict at all** (see Coverage Gaps).

Stage API cost so far: **$23.63** (s1 $5.27 · s2 $8.68 · s3 $5.69 · s4 $3.99).

---

## Backend API Test Results

Source: `C:/tmp/qa-r123-getsweep.json`, `C:/tmp/qa-r123-emptycreate.json`,
`C:/tmp/qa-r123-tenantscope.json` (written 05:02–05:07 tonight).

> ⚠️ `/tmp/api-test-results.txt` on disk is **stale** — it is Run 117's file, dated
> **2026-09-02**. Tonight's s1 never wrote a text artifact. Nothing in this section comes
> from that file.

### Read sweep — every GET route in the inventory

All 132 GET routes, with a **real waterloo-tenant id substituted** wherever the path takes
a param.

| Outcome | Count | Assessment |
|---|---|---|
| `200` | 113 | pass |
| `403` | 5 | **expected** — all `admin.js`; the QA user is not a super-admin |
| `400` | 4 | **expected** — required query param absent (`/api/crm/calendar`, `/api/data/directions`, `/api/disaster-declarations`, `/api/properties`) |
| skipped | 10 | no fixture — the backing table or column does not exist |
| **`5xx`** | **0** | **no server errors on any GET route** |

Per-file pass rate (200s / probed):

```
admin.js            0/5 *   contracts.js       4/5     crm.js            25/27
alerts.js           2/2     counties.js        1/2     dataApis.js        1/2
auth.js             1/1     canvassing.js      2/2     disasterDecl.js    0/1 *
automations.js      1/1     dashboard.js       3/3     documents.js       1/1
drift.js            1/1     drip.js            1/3     estimates.js       5/5
expenses.js         2/2     financing.js       5/6     invoices.js        2/2
leads.js            3/3     map.js             3/3     materials.js       5/6
notifications.js    3/3     onboarding.js      1/1     payments.js        2/2
properties.js       9/10    reports.js         6/6     roofMeasurement.js 5/5
search.js           1/1     skipTrace.js       5/6     stormHistory.js    2/2
storms.js           2/2     subcontractors.js  3/3     territories.js     1/3
workOrders.js       5/5
                                     * shortfall is the expected 403/400, not a failure
```

The 10 skips are structural, not defects: `/api/crm/territories/:id` and `/:id/pins`
(the `territories` table does not exist), `/api/crm/drip-sequences/:id` and
`/:id/enrollments`, `/api/crm/financing/applications/:id`,
`/api/crm/contracts/public/:token`, `/api/crm/prospect-lists/:id/items`,
`/api/counties/:id/status`, `/api/materials/products/:id`, `/api/skip-trace/job/:jobId`.

**Passed: 122 / 132 meaningfully exercised. Failed: 0. Fixed: nothing needed fixing.**

### Write sweep — empty body against every collection-level create

38 collection-level `POST`/`PUT` routes (no `:id` in the path) sent `{}`, i.e. every
required field absent. Action routes excluded by semantics — an empty body *fires* an
action route rather than neutralising it.

- **35 → `400`** with a field-naming message, e.g. `POST /api/counties` →
  `"county_name, arcgis_url, field_map, and data_source_tag are required"`. Correct.
- **3 → `200`**, all `PUT` tenant-singleton upserts: `/api/alerts/config`,
  `/api/crm/tenant-settings`, `/api/materials/credentials`. An empty body against an
  idempotent singleton upsert returning 200 is defensible, **but s1 capped before
  classifying them** — see Coverage Gaps, because a row-count check cannot detect a
  column mutation.
- **Row counts across 32 tables byte-identical before and after.** No permissive create
  left a row behind.

**Passed: 35 / 38 unambiguously. Unclassified: 3. Failed: 0. Fixed: nothing needed fixing.**

### New dimension — static tenant-scope audit of SQL

A dead-uuid probe cannot detect a missing `tenant_id` in a `WHERE` clause (a dead uuid
404s either way), and this tenant holds ~0 foreign rows, so s1 audited the SQL statically
instead: every statement keying on a row id must also constrain `tenant_id`, or be
explicitly public / user-scoped / platform-admin.

**62 candidate sites (24 writes, 38 reads) across 24 files.** Concentrations:
`routes/properties.js` 11 · `services/dripService.js` 9 · `services/crmService.js` 5 ·
`routes/onboarding.js` 4 · `routes/payments.js` 4 · `services/windDriftService.js` 4.

🔴 **These are raw scan hits, NOT confirmed defects, and not one has been triaged** — s1
capped immediately after writing the file. Several are obviously legitimate on sight
(Stripe webhook handlers keyed on a Stripe id, ingestion scripts, `seed-dev.js`). This is
the single highest-value unfinished item of the night and it is a **multi-tenant
isolation** question. It is carried, not closed.

### Not run

`server/.qa-r123-taskfixture.mjs` was written at 05:10 and **never executed** — s1 capped
at 51/50 turns. The `tasks` table still holds **0 rows**, so `PATCH /api/crm/tasks/:id` and
its 7 whitelisted fields remain the last unprobed typed columns in the CRM core. This is
the second consecutive night this exact harness has been written and not run.

---

## Frontend Feature Test Results

Source: `/tmp/frontend-test-results.txt` (s2, completed) and `/tmp/ui-audit-results.txt`
(s3). **19/19 routes render · 0 console errors · 0 uncaught page errors · build PASS.**
The only console output app-wide is `/admin`'s two documented, intentional 403s.

| Page | Tested | Result |
|---|---|---|
| `/` Dashboard | Funnel panel across All Time / source=Canvassing / 7 Days | ✅ Pass. "No pipeline data yet" investigated and proved **unreachable** — see below |
| `/leads` | Export CSV, search, sort, bulk select, Save Filter, pagination | ✅ Pass. CSV = 14 lines correctly quoted, pure client-side blob. Sort SCORE → `sort_by=lead_score&sort_dir=DESC`. ADDRESS deliberately not sortable (8 of 16 `th` call `handleSort`) |
| `/leads/:id` | **Charter item uncovered for 3 runs.** 8 controls in the slide-over | ✅ Pass 8/8 — score popup (Esc closes), Log Activity modal, Street View panorama, Storm History (200, real NOAA row), FEMA Disaster History (200, 37 declarations), Property Report (blob tab), Insurance Report, Quick Call. There is **no tab rail** — the charter's "test every tab" describes a UI that does not exist |
| `/pipeline` | Kanban drag **both directions**, 3 board tabs | ✅ Pass. `new → contacted` PATCH 200, `contacted → new` PATCH 200, card and column counts restored, DB re-queried to confirm `stage='new'` |
| `/estimates` | Regression check on `282f51f` | ✅ Fix holds — status "Sent" → "No estimates match this filter", 16 restored on clear |
| `/invoices` `/contracts` `/expenses` | Render + regression check on `68c968a` | ✅ Pass |
| `/subcontractors` | Search, specialty, status filters | 🔧 **Defect found and fixed — `71d06dc`** (below) |
| `/work-orders` | Detail panel, milestones, line items | ✅ Pass — Milestones 0/7 with all 7 named + PHOTO REQ badges, Line Items total $100.00, Export PDF / Complete / Save Changes render |
| `/tasks` | Render | ⚠️ Empty state only — table has 0 rows. **Not fully testable** |
| `/calendar` | Date click → event modal, 4 views | ✅ Pass. **Gap closed:** a *real* Playwright pointer click **does** fire FullCalendar `dateClick`; the documented trap applies only to synthetic `element.click()` |
| `/materials` | Catalog render, per-product Add controls | ✅ Pass |
| `/reports` | Presets This Week / This Quarter / All Time | ✅ Pass — 7 refetches each, range label updates, per-period empty copy correct |
| `/canvassing` | Render | ✅ Renders. Pin drop not exercised (DB write + paid geocode; `territories` table absent) |
| `/storm-map` | Renders; address search wired but **not driven** | ✅ Renders. See Coverage Gaps — billable per keystroke |
| `/alerts` | Render, numeric steppers | ✅ Pass. Orphan route (no nav entry) — known |
| `/admin` | Render | ✅ Renders; 403s are correct for a non-super-admin |
| `/settings` × 15 tabs | **First ever sweep of the sub-panels** | 🔧 **Defect found and fixed — `092d37a`** (below). All 15 now render substantive content (86–3105 chars); none blank, none stuck loading |
| TopBar global search | `/api/search?q=`, Esc, Ctrl+K | ✅ Pass — 200 + dropdown with LEADS group, Esc closes, Ctrl+K reopens **and** focuses, no-match copy correct |

### Two things that looked broken and are not

- **TopBar global search** reads as a dead control to any probe that scans `position:fixed`
  panels — `.search-dropdown` is `position:absolute`. It works fully. Sixth instance of
  *check the structure before filing*.
- **Dashboard "No pipeline data yet"** is a pixel-perfect replica of tonight's
  `/subcontractors` defect shape, and `getFunnel()` genuinely *is* filter-scoped
  (rep/source/period) — but the endpoint returns all stages with zero counts, so
  `funnel.length === 0` is **unreachable**. Measured empty in **0 of 4** filter states.
  **Recorded as a non-bug. Do not file it.**

### Still needs attention

- **`/tasks` cannot be tested beyond its empty state** until a fixture exists.
- **`ActivityModal` has no Esc handler.** It is not a trapped modal — backdrop click and an
  `aria-label="Close"` button both work — so this stays in the known-and-deferred family,
  but it is inconsistent with the rest of the app.

---

## UI Consistency Audit Results

Source: `/tmp/ui-audit-results.txt`. Scope: **19 routes + 15 Settings sub-panels + 13
create controls + 76 client source files.**

| Audit | Result | Detail |
|---|---|---|
| **1 — Icons** | ✅ **CLEAN** | 0 foreign icon classes (`fa-*`, `material-icons`, `lucide`, `i.icon`) on 19/19 routes and 15/15 Settings panels. Every icon is `@heroicons/react/24/outline`. The only non-`0 0 24 24` viewBoxes app-wide are on `/reports` — `0 0 32 32` ×4, `0 0 132 300` ×3, `0 0 363 300` ×2 — all recharts chart surfaces, not icons. **Nothing found, nothing to fix.** |
| **2 — Buttons** | ✅ **CLEAN** | 0 unnamed buttons on 19/19 (every button carries text, `aria-label`, `title` or an icon). Primary actions uniformly `oklch(0.72 0.19 250)` via `.auth-btn`. Radius families are the documented house set: 12px, 8px, 999px, plus the elliptical squircles 10px/8px and 14px/12px. **Nothing found, nothing to fix.** |
| **3 — Toolbars / Headers** | ✅ **CLEAN** | Header height **exactly 56px on 19/19**. `<h1>` present and route-correct on 19/19. Title-left / actions-right layout consistent. **20th consecutive convergence.** |
| **4 — Sidebar / Nav** | ✅ **CLEAN** | 22 nav buttons / 22 icons on 19/19. Exactly one `.is-active` on 17/19; both exceptions documented and correct — `/reports` and `/tasks` show 2 (sidebar link + an in-page segmented control legitimately reusing `.is-active`), `/alerts` shows 0 (the known orphan route). Active group auto-expands, as intended. |
| **5 — Forms** | ✅ **CLEAN** | **0 native `<select>`** and **0 native date/datetime inputs** across 19 routes *and* 15 Settings panels — `CustomSelect` and `DatePicker` compliance holds everywhere. Inputs without `.form-input` are the documented families only: TopBar Cmd-K search, `/storm-map .address-search__input`, the `/alerts` numeric stepper (wrapper carries the radius), and **new this run** `__PrivateStripeElement-input` on `?tab=billing` — injected by Stripe's own iframe, vendor-owned, not an app control. |
| **6 — Spacing / Alignment** | ✅ **CLEAN** | 0 horizontal overflow on 19/19 (`documentElement.scrollWidth` vs `innerWidth`). 0 stray overlays at rest on 19/19. All 15 Settings panels render substantive content. |
| **7 — Modals** | ✅ **CLEAN** | 13 create controls exercised across 8 routes + 3 Settings panels. **0 page errors on all 13 opens, 0 dead controls.** Real modals consistent on every measured property — `/expenses` "Add Expense" 480px / radius 20px / `.modal-close` 32×32 and `/work-orders` "New Work Order" 520px / 20px / 32×32, both with `modal-backdrop-in` + `modal-scale-in`. Slide-overs: `/tasks` 420px, `/subcontractors` 480px. In-place builders (`/estimates`, `/invoices`, `/contracts`) and inline `!showForm` forms are correctly *not* modals. |

**Two cosmetic readings deliberately NOT "fixed":**

- `/materials` reports 136 buttons at `oklch(0.55 0.18 250 / 0.15)` — that is the
  per-product **Add** control repeated down the catalog. One consistent group, not 136
  outliers.
- `/` reports 3 buttons at `border-radius: 3.35544e+07px` — Chrome's clamp of a very large
  radius. It paints identically to the 999px pills beside it. Cosmetic equivalence, not
  drift.

**Label note, not a defect:** `/leads`, `/calendar` and `/materials` have no "New X" button
**by design** — leads arrive via Import/Export and the storm map, calendar events from
clicking a date, material orders from the catalog/cart.

---

## Bugs Fixed

1. **`/subcontractors`** — A tenant holding **63 subcontractors** was told *"Add Your First
   Subcontractor"* whenever a filter matched zero rows. All three filters (search,
   specialty, status) go server-side and refetch, so a zero-match filter rendered
   empty-*database* copy. Reachable two ways, both proved live before the fix
   (`search="zzzznomatchqq"`, `specialty="Electrical"`).
   **Fixed** with the ternary idiom already in five sibling views. `status` defaults to
   `'active'`, so only a *change* from that default counts as user filtering — otherwise a
   genuinely empty tenant would never see the onboarding CTA. Verified in both directions
   plus an empty-list stub, **zero DB writes**. — **`71d06dc`**

2. **`/settings?tab=automations`** — **DEAD PANEL.** The entire Workflow Automations
   feature (create / edit / toggle / delete rules) was unreachable; the panel sat on
   *"Loading automations..."* forever, throwing `PAGEERROR: setLoadError is not defined`
   twice per load. `setLoadError(false)` at line 82 and `setLoadError(true)` at line 85
   were called with **no `useState` behind them** — the `try` threw, the `catch` threw
   again with nothing to catch it, and `setLoading(false)` at line 87 never ran.
   **Fixed** by completing the abandoned edit rather than reverting it, using the idiom
   already in `ContractsView` / `InvoicesView` / `ExpensesView` / `EstimatesView` /
   `LeadList` / `TasksView`. — **`092d37a`**

3. **`/settings?tab=automations`** — a *failed* load rendered *"No automation rules yet.
   Create one to get started."* The comment left behind in the catch block stated the
   intent ("do not claim the list is empty"); the JSX still claimed it. **Fixed** — a load
   failure now says so. — **`092d37a`**

4. **`/settings?tab=drip-sequences`** — the sibling panel, identical shape:
   `catch { /* ignore */ }` followed by a bare `sequences.length === 0` → *"No drip
   sequences yet."* Same treatment, verified with a stubbed 500. — **`092d37a`**

Also committed, non-fix: **`130eff6`** (2 read-only s2 harnesses) and **`1733a1c`**
(`server/.qa-r124-undeclared.mjs`, the new reusable static check described below).

### Root cause of bug 2 — and why the whole pipeline walked past it

`a996c76` — **tonight's own 05:00 checkpoint commit** — swept in a half-applied edit to
`AutomationSettings.jsx` (6 lines, the only client file in that commit). That edit was
**last night's top open item**: 2026-09-03's s4 capped mid-edit and s5 deliberately left it
uncommitted and broken, with a written warning that *"the next `git status` sweep will
otherwise treat it as recovered work and may commit it broken."* That is exactly what
happened. The warning was correct and the mechanism it predicted fired within 24 hours.

Three independent blind spots then lined up:

1. **`vite build` cannot catch it.** An undeclared identifier is a runtime `ReferenceError`,
   not a bundling error. **Three stages passed a green build tonight over a dead panel.**
2. **There is no ESLint in this project** — no config file, no lint script, no dev
   dependency. `no-undef` is precisely the rule that would have caught this at authoring
   time. *(Reported, not added — adding tooling is outside the QA charter.)*
3. **The 19-route sweep loads `/settings` on its default tab only.** All 15 Settings panels
   are `?tab=` sub-surfaces and no audit had ever entered them looking for **render
   health** — only for tab-chrome consistency. Run 122 measured that 15/15 tabs navigate,
   and they do; the panel behind one of them was dead.

**New reusable guard — `server/.qa-r124-undeclared.mjs` (`1733a1c`, read-only).** It
generalises the defect: every `setXxx()` *call* is checked against a declaration
(`useState` destructure / function / const / let / destructured prop / import) in the same
file, across all 76 client source files. **Before the fix: 1 hit. After: 0 app-wide.** The
only remaining match is `map.setMapTypeId()` in `StormMap.jsx`, a Google Maps API method —
a false positive, and map code is off-limits. **This check costs one command and should be
re-run whenever a stage caps mid-edit.**

---

## Known Issues (Not Fixed)

**Developer decisions — carried, none introduced tonight:**

- 🔴 **No ESLint in the project.** No config, no script, no dependency. Tonight's most
  severe defect in ~20 runs is exactly what `no-undef` exists to catch, and the build
  provably cannot. **New this run and the single highest-leverage item on this list.**
- ⚠️ **No error boundary anywhere in the SPA.** A component that throws during render takes
  the whole page white. Tonight's crash was in an effect, so it "only" froze one panel.
  This is the amplifier behind five past defects.
- **64 generic error toasts discard the server's actionable message** (vs 22 that surface
  it). `InvoicesView.jsx:570` is the reference case.
- **Form-label drift** — 7 treatments, ~100 inline labels. **12th run deferred.**
- **Empty-state *styling* is split** — only `TasksView` uses `.empty-state`; the other 9
  list views inline-style theirs. Refactor candidate, not a defect.
- **`/alerts` is an orphan route** — no nav entry, duplicated under Settings → Storm Alerts.
- **`ActivityModal` has no Esc handler** — closes via backdrop and an `aria-label="Close"`
  button, so not a trapped modal. Known-and-deferred.
- **`22007`/`22008` still leak the raw pg message** (`invalid input syntax for type time:
  "abc"`), exposing the column type name. A deliberate `else` branch in `errorHandler.js`.

**Repo and data hygiene — awaiting a go-ahead:**

- **361 QA screenshots at the repo root** (337 tracked). **This run added 0.**
- **DB junk rows visible in the UI:** subcontractor `{"$eq":1}`, territory `12345`,
  `qa_options_probe` custom field.
- **8 untracked `.qa-*.mjs` harnesses** plus 5 `claude-overnight-*.json` in the working
  tree. This commit is scoped to `OVERNIGHT-REPORT.md` and `docs/` only.
- **`server/.qa-r91-neverrun.mjs` — written, never run, 17 nights.**
- **`server/.qa-r124-s4-serverfix.mjs`** was committed by the `a996c76` checkpoint *before
  this run began* — a stage-4 harness that predates its own run.

**Structurally blocked:**

- **`territories` table does not exist** — 4 routes unexercisable.
- **`contract_templates`**: all 4 rows are `tenant_id = NULL` / `is_default = true`, so the
  waterloo tenant owns zero. `updateTemplate` filters `WHERE id=$2 AND tenant_id=$1`, so a
  PATCH 404s before reaching any guard. **Candidate user-facing defect, still unverified:
  if Settings → Contracts offers Edit on those 4 default templates, that click 404s for
  every tenant.** Carried from 2026-09-03; s4 was investigating it tonight and capped.

---

## Test Coverage Gaps

### 🔴 The dominant failure mode is stage capping, not any individual defect

**s1, s3 and s4 all hit `error_max_turns`** — the same three stages as last night. Between
them they account for nearly every gap below. Tonight's defect count reflects **how much
testing actually ran**, not how sound the application is. s2, the one stage that finished,
did so by collapsing work into few, wide calls. **Raise the s1/s3/s4 turn budgets or narrow
their charters.**

### 🔴 s4 (verify) produced no verdict whatsoever

It capped at 41/40 turns having written three read-only harnesses and nothing else — no
artifact, no commits, no output. Its charter (re-verify every fix from earlier stages,
edge cases, 375px responsive check, browser back/forward) is **entirely unmeasured
tonight.** Its harnesses show what it was reaching for, and the target is a genuine blind
spot worth inheriting:

- `.qa-r124-s4-tokens.mjs` — pulls real share tokens for the three **public, customer-facing
  routes** `/estimate/:token`, `/contract/:token`, `/status/:token`. These live **outside
  the authenticated app shell and have therefore never appeared in any 19-route sweep.**
- `.qa-r124-s4-mergefields.mjs` — asks whether the `{{merge field}}` vocabulary the contract
  UI advertises is ever actually substituted **before a customer sees the public contract
  page.**
- `.qa-r124-s4-tpl.mjs` — dumps `contract_templates` sections.

**None were run to a recorded result.** Note that the two fixes tonight were verified by the
stages that made them (both directions, with stubs), so they are not unverified — but they
received no *independent* re-verification.

### Specific unmeasured areas

- 🔴 **62 candidate tenant-scope SQL sites are untriaged.** A multi-tenant isolation
  question, raw and unclassified. Highest-value unfinished work of the night.
- 🔴 **`tasks` fixture — second night written and not run.** `tasks` = 0 rows, so `/tasks`
  is testable only empty and `PATCH /api/crm/tasks/:id`'s 7 fields stay unprobed. The
  harness already exists (`.qa-r123-taskfixture.mjs`); it needs one command.
- ⚠️ **3 `PUT` tenant-singleton routes returned 200 to an empty body and were never
  classified.** `/api/alerts/config`, `/api/crm/tenant-settings`,
  `/api/materials/credentials`. Row counts prove no row was *created* — they cannot prove
  no column was *mutated*. `/api/materials/credentials` came back with
  `preferred_branch_id: "true"`, which looks like residue from an earlier probe and is
  worth a look. The other 4 singleton routes (`/api/onboarding/org`,
  `/api/roof-measurement/config`, `/api/skip-trace/config`,
  `/api/notifications/preferences`) were not probed at all.
- **POST create-path type confusion remains largely unmeasured.** 88 POST routes exist;
  `createX` functions often bypass the `allowedFields` whitelist and destructure directly
  (`createWorkOrder` does).
- **GET response *shapes* are still unasserted.** 132 routes return 200; nothing checks the
  payload against what the client reads. 14 known disagreements were captured in Run 122's
  sweep and remain untriaged.
- **`.qa-r123-filtersem.mjs`** (do list filters actually narrow the result set?) was written
  at 05:04 and left **no output file** — whether it ran is unknown.

### Deliberately excluded (cost and safety, not oversight)

- 🚫 **`/storm-map` address search — standing exclusion.** `AddressSearch.jsx` uses Google
  Places `AutocompleteSuggestion` + `Geocoder`: **billable per keystroke.** Verified as
  rendered and wired; not driven. The zero-paid-API constraint and the no-bulk-geocoding
  rule both apply.
- 🚫 **FEMA map property code — off-limits** by standing instruction.
- **Paid/destructive `/leads/:id` controls:** Measure Roof (Google Solar API), Run Trace
  (paid skip-trace), Share Status Page (a real write), Remove Lead (destructive), Generate
  Contract (creates a row).
- **Milestone toggling** on `/work-orders` (a write; covered in Run 88) and **pin dropping**
  on `/canvassing` (a write + paid geocode; `territories` absent).
- **No screenshots taken or committed, by choice.**

---

## Database Hygiene

- Tenant-scoped counts for `791bb51d` (waterloo) are **byte-identical** to the pre-run
  snapshot: `leads 13 · tasks 0 · estimates 16 · invoices 14 · work_orders 10 ·
  contracts 4 · expenses 2 · subcontractors 63`.
- The API write sweep's **32-table count snapshot is identical before and after.**
- The pipeline drag moved a lead `new → contacted → new`; only `updated_at` moved, which is
  unavoidable.
- 🚫 **Standing tester-error trap:** an **unscoped** `select count(*) from estimates`
  returns **17**, not 16 — the 17th row belongs to a different tenant. **Always scope count
  queries by `tenant_id` before reporting drift.**

---

## Notes for the Next Run

1. 🔑 **Triage the 62 tenant-scope candidates.** It is the only open item tonight that could
   be a security-class defect rather than a cosmetic or copy defect.
2. 🔑 **Run `.qa-r123-taskfixture.mjs`.** One command clears a gap that has now survived two
   nights of being written and abandoned.
3. 🔑 **Give s4 the public token routes.** `/estimate/:token`, `/contract/:token`,
   `/status/:token` are customer-facing and have **never** been swept. The harnesses that
   fetch real tokens already exist.
4. **Require every stage to write its artifact BEFORE spending its remaining budget.** This
   rule was written last night and went unheeded: s1 and s4 again left nothing, and s5 again
   spent budget reconstructing s1 from raw JSON. The one stage that wrote first (s2) needed
   no reconstruction.
5. **Read each stage's JSON `stop_reason`, never its self-assessment**, and **date-check
   `C:/tmp/*.txt` before treating an artifact as tonight's.** Both rules paid again:
   `/tmp/api-test-results.txt` is two days stale, and reading it as tonight's would have
   fabricated an entire section.
6. **Re-run `.qa-r124-undeclared.mjs` whenever a stage caps mid-edit.** Tonight proves a
   green build is not evidence that the app runs.
7. **Resynchronise the run number** — s2 and s3 disagreed by one on the same night.
8. **Decide on ESLint.** It is the structural answer to the whole class of defect that
   produced tonight's worst finding.

Drift baseline for the next run: the `docs: QA report 2026-09-04` commit (head after this
entry).
