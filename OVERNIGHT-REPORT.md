# StormLeads — Overnight QA Report

**Run 76 · 2026-08-15**
Branch `feat/financing` · Baseline `dfb346c` (tag `pre-overnight-20260815`) · Head `cb1d786`
API `http://localhost:3001` · Client `http://localhost:5173` · Tenant `waterloo`

Stages: s1 api-test, s2 frontend-test, s3 ui-audit, s4 verify, s5 report (this document).

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend routes tested | **19** (all 18 sidebar routes + 1 deep link `/leads/:id`) |
| Settings tabs tested | **15 of 15** |
| Modal / slide-over overlays opened | **11** (s2) + **5** re-measured (s3) |
| API endpoints inventoried | **272** (132 GET, 140 write) |
| API endpoints actually exercised over the wire | **199 (73.2%)** — 123 GET, 76 write |
| Client→server API call sites diffed | **279** (0 unmatched after the s1 fix) |
| **Bugs found** | **7** |
| **Bugs fixed** | **6** |
| Bugs found but not fixed | **1** (s4 hit its turn cap mid-investigation) |
| UI inconsistencies found | **4** (+ 4 known items re-confirmed, not re-filed) |
| UI inconsistencies fixed | **4** |
| 5xx responses observed | **0** |
| Console errors across 19 routes | **0** |
| Failed network requests across 19 routes | **0** |
| Fix commits | **5** (`f88895b`, `e8ddc8f`, `05aa857`, `383ba4f`, `5ae8bfb`) |
| Final `vite build` | **PASS** — see the Build Verification section |

**Headline:** all six fixed defects were found by **set-difference over code** — comparing a
set of names that are *declared* against the set that is actually *defined*. Four different
kinds of name produced findings this run: API paths the client calls vs. routes the server
mounts (1), SQL identifiers vs. `information_schema` (1), CSS custom properties vs. `:root`
(1), and JSX `className`s vs. CSS selectors (1), plus accessible names present vs. absent on
sibling controls (1) and a loaded font vs. any consumer of it (1). This is the third
consecutive run where the run's findings came from a set difference rather than from
inspecting rendered output.

**The run did not achieve net-zero DB writes.** s1's empty-body write sweep mutated 14 rows
of live data and hit its turn cap before it could roll them back. Details and the exact
remediation are in **Known Issues**.

---

## Backend API Test Results

Stage s1. Route inventory was built by parsing `server/src/routes/*.js` and the mount
prefixes in `routes/index.js`: **272 endpoints across 34 route files**. Real stored row IDs
were resolved first (33 entity types) so that param routes reached handler logic instead of
404ing at the lookup — the structural gap Run 74 identified.

### GET sweep — 132 endpoints

| Result | Count |
|---|---|
| 200 OK | 114 |
| 400 (correct validation on a required query param) | 5 |
| 403 (correct — super-admin only) | 4 |
| Skipped, no resolvable ID | 9 |
| **5xx** | **0** |

The five 400s are all correct behaviour, not defects: `GET /api/crm/calendar`,
`/api/data/directions`, `/api/disaster-declarations`, `/api/properties/fema-live` and
`/api/properties/reverse-geocode` each require a query parameter the sweep deliberately
omitted. The four 403s are the `/api/admin/*` endpoints refusing a non-super-admin token.

By category: crm 27, properties 10, financing 6, materials 6, reports 6, skipTrace 6,
admin 5, contracts 5, estimates 5, roofMeasurement 5, workOrders 5, and 1–3 each across
alerts, auth, automations, canvassing, counties, dashboard, dataApis, disasterDeclarations,
documents, drift, drip, expenses, invoices, leads, map, notifications, onboarding, payments,
search, stormHistory, storms, subcontractors, territories.

### Write sweep (POST/PUT/PATCH/DELETE) — 140 endpoints

| Result | Count |
|---|---|
| 200 | 17 |
| 201 | 4 |
| 400 (validation guard fired correctly) | 51 |
| 404 | 4 |
| Excluded by charter (paid APIs, bulk geocode, bulk import, outbound email) | 38 |
| DELETE skipped deliberately | 18 |
| Skipped, no resolvable ID | 8 |
| **5xx** | **0** |

**What this sweep is structurally unable to find:** an empty-body pass only proves the
validation guard fires. It says nothing about handler logic past that guard. The planned
phase-B pass — no-op PATCHes carrying each row's own stored values back, which is what
exposes stored-shape crashes — **was never run**; s1 hit its 50-turn cap immediately after
the phase-A sweep. That is the single largest coverage gap of the run.

### Fixed

**`f88895b` — invoice "Send Email" posted to a route that does not exist.**
`InvoicesView.jsx:587` called `/invoices/<id>/send-email`, but the invoices router is mounted
at `/api/crm/invoices` (`routes/index.js:57`). There is no `/api/invoices` mount at all, so
every send 404'd and the modal always showed "Failed to send invoice" — **the invoice email
never sent.** Every other invoice call in `api/invoices.js` already used the `/crm/` prefix;
this one-off inline `client.post` was the only consumer missing it. Verified:
`POST /api/invoices/<id>/send-email` → 404 Not found; `POST /api/crm/invoices/<id>/send-email`
→ 400 "Recipient email required" (route exists, validates before touching the mailer).
Found as the only orphan among 244 unique client call sites.

**`e8ddc8f` — storm re-impact notifications threw 42703 on a non-existent column.**
`impactedAssetService.js:54` filtered the notification fan-out with `AND u.is_active = true`,
but `users` has no `is_active` column. Every execution threw
`42703 column u.is_active does not exist`. Because `checkImpactedAssetsForEvents` catches
per-event and only logs, the failure was **silent** — the "Property re-impacted by storm"
notification was never delivered and the impacted count never returned. Three leads currently
intersect a storm event, so the path is live, not hypothetical. This was the only reference
to `users.is_active` in the entire server; the three other tenant-wide fan-outs
(`notificationService.js:35`, `automationEngine.js:110`, `dripService.js:351`) already select
tenant users with no active flag. Verified with a transaction + `ROLLBACK` (net-zero writes)
and then `EXPLAIN` against the live schema: old SQL still fails, new SQL plans cleanly and
inserts 1 row per tenant user (4 of 4).

A black-box sweep cannot reach either bug: the first is a client-side path string, the second
only executes during storm ingestion when a new event intersects an existing lead.

---

## Frontend Feature Test Results

Stage s2, driven with Playwright against `http://localhost:5173`.

**Baseline sweep — all 19 routes: zero console errors, zero failed requests, zero page
errors, zero native `<select>`, zero native date inputs, zero raw-enum text red flags.**

| Page | Tested | Result |
|---|---|---|
| `/dashboard` | Stat cards, funnel, activity feed, tasks-due panel, stat-card navigation | Pass. Stat-card → route navigation works (an earlier miss was a bad locator, not a defect) |
| `/storm-map` | Route loads, no console errors. FEMA property code not touched (off-limits) | Pass — not deep-tested by charter |
| `/pipeline` | Kanban renders, cards present, HTML5 drag between stages | Pass |
| `/leads` | Table, every filter (status / source / date), search, labels | Pass — all filters apply and all labels are human-readable |
| `/leads/:id` | Deep link, slide-over detail, tabs, score breakdown | Pass — deep link resolves and renders. **Closes Run 75's top coverage gap** |
| `/estimates` | Builder render, line items, live totals, discount + tax order of operations | Pass — math verified correct: tax applied post-discount, 2250 × 8.25% = $185.63, total $2,435.63 |
| `/invoices` | List, create, payment controls | Pass |
| `/work-orders` | Kanban, detail overlay, 7 milestones, toggle + persistence | Functional pass; **1 accessibility defect found and fixed** (below) |
| `/tasks` | Full CRUD cycle: create, toggle complete, filter tabs | Pass — tabs recount correctly (Pending 0→1→0, Completed 3→4) |
| `/calendar` | Renders, events shown | Pass |
| `/reports` | Charts, date-range picker, report-type switching | Pass |
| `/canvassing` | Route loads; territories endpoint returns `200 []` | Pass — **the standing "territories table does not exist" gotcha is stale and is now retired** |
| `/content-studio` | — | **Does not exist.** On the charter, not in the app. Third run reporting this |
| `/settings` | **All 15 tabs.** Company tab: edited 4 fields, saved, reloaded, diffed, restored | Pass — all 4 persisted and were restored (net-zero change). Company Name is a disabled input by design |

**Two additional set-differences run at this stage, both clean:**
- Every API path the client calls vs. every route the server mounts — **279 call sites, 0
  unmatched** (s1's `f88895b` fix had already closed the only orphan).
- Every rendered `<button>` vs. those with a click handler — 3 apparent dead buttons, all
  three Google Maps InfoWindow HTML strings using event delegation. No dead React buttons.
- Raw-enum text scan extended from pages to **11 overlays** — all clean. The raw-enum-in-UI
  family has appeared four times historically; it did not appear this run.

### Fixed

**`05aa857` — work-order milestone toggles had no accessible name.**
The 20×20 completion toggle on each milestone is a `<button>` whose entire content is a
conditionally-rendered `<CheckIcon>`. Incomplete, the button is literally empty; complete, it
holds only an `aria-hidden` svg. It exposed no accessible name in either state, so a screen
reader announced the primary control of the milestone feature as just "button", seven times
per work order. This was drift, not a missing convention — both sibling controls in the same
row are already labelled (`title="Upload milestone photo"`, `aria-label="Remove milestone"`).

Measured, not sampled: a page-level sweep of all 17 routes returns **zero** unnamed buttons,
which is exactly why the app-wide audit in `6a0a29f` never reached these. Sweeping 9 overlays
found work-order detail as the single remaining site (7 unnamed → 0). Toggle behaviour is
unchanged — re-tested 0/7 → 1/7 (14%) → 0/7 with correct PATCHes and a net-zero DB result.

### Still needs attention

- **`/estimates` — unfixed runtime error.** See Known Issues #1.
- `/content-studio` is on the s2 charter but is not a route in this application. The charter
  should be corrected or the page built; it has now been reported three runs running.

---

## UI Consistency Audit Results

Stage s3. **17 authenticated routes + 5 modals/slide-overs.** All 7 charter audits ran.
Full artifact: `tests/audit-reports/ui-audit-2026-08-15-run76-s3.txt` (also at
`C:/tmp/ui-audit-results.txt`). Harness checked in at `server/.qa-r76s3-setdiff.mjs`.
**Net-zero DB writes for this stage** — read-only, every modal closed with Escape, the CSV
import never started.

### Icons — CLEAN, one dead font removed

- **43/43** icon import sites are `@heroicons/react/24/outline`. Zero solid variants, zero
  lucide / react-icons / fontawesome / material / tabler. The 3 "non-outline" grep hits were
  false positives — paths containing the substring *material* (`./MaterialsView`,
  `../api/materials`).
- On all 17 routes, every `<svg>` inside `.main-content` carries the Heroicons signature
  (`viewBox="0 0 24 24"` + `fill="none"` + `stroke-width="1.5"`), with exact count matches:
  `/storm-catalog` 1000/1000, `/materials` 411/411, `/subcontractors` 54/54, `/pipeline`
  46/46, `/` 41/41.
- Sole exception `/reports`: 19 svg = 10 Heroicons + 9 `recharts-surface`, the documented
  data-viz non-bug.
- **Found and fixed:** `index.html` loaded the Google *Material Symbols Outlined* icon font on
  every page view with zero consumers anywhere in the app — a render-blocking request for an
  icon library the project forbids. Removed (`5ae8bfb`).

### Buttons — CLEAN against the established pattern

- `.auth-btn` (primary CTA) is **identical on all 8 routes** that use it as a CTA:
  `36px | 0px 24px | 13px | 14px/12px | 700 | oklch(0.72 0.19 250)`.
- `/storm-catalog`'s `.auth-btn` at `36 | 6px 14px | 12px` is the documented reuse of the
  primary-CTA class as an active filter chip. Not re-filed.
- Row-action `.quick-action-btn` agrees at 31px across `/estimates` (156 instances),
  `/contracts` (18), `/invoices` (22).
- Re-confirmed known backlog item, not re-filed: `.quick-action-btn` spans 8 heights app-wide
  (21/25/27/29/31/32/36/38), every one from a per-site inline padding override.

### Toolbars / Headers — height CLEAN, heading treatment unchanged

- The top bar measures **exactly 56px on all 17 routes**. No variance.
- Re-confirmed known, not re-filed: there is still **no `<h1>` anywhere in the app**, and
  page headings remain 28px (`/`), 24.5px (`/calendar`), 22px (`/storm-catalog`,
  `/materials`, `/subcontractors`), 20px (`/alerts`, `/work-orders`), and absent entirely on
  9 of 17 routes. Existing developer ticket.

### Sidebar / Nav — CLEAN

- 18/18 nav items: 42px tall, 12px radius, 18px icons, all Heroicons-outline.
- Exactly one `.is-active`. Zero items missing an icon. Width 240px.
- Font sizes 13.5px (7 parents) / 13px (11 children) — deliberate hierarchy, not drift.

### Forms — CLEAN (fourth consecutive run), one defect fixed

- **Zero native `<select>` and zero native `<input type=date|datetime-local|time>`** on all
  17 routes *and* inside all 5 overlays. The `DatePicker.jsx` / `CustomSelect.jsx` rules are
  fully respected.
- `.form-input` is uniform where used: `36px | 0 16px | 12px radius |
  oklch(0.22 0.02 260 / 0.45) | 1px oklch(0.5 0.02 260 / 0.15)`. The single 32px instance
  (`/materials`) is the documented deliberate fit into the 41px category tab bar.
- **Found and fixed (`383ba4f`) — the run's most user-visible defect.** `AlertSettings.jsx`
  (the `/alerts` route) referenced `var(--border-subtle)` ×4 and `var(--bg-elevated)` ×4.
  **Neither token is defined anywhere in the repository** — `:root` defines `--glass-border`
  and `--glass-bg`; these two names were invented at the call site.

  The failure mode is worse than a wrong colour. An unresolvable `var()` invalidates the
  *whole* declaration at computed-value time, and the code wrote the **border shorthand**, so
  all three longhands reset to their initial values:

  ```
  stepper container   border: 0px none    background: rgba(0,0,0,0)
  stepper input       border: 0px none    background: rgba(0,0,0,0)
  Send Test Alert     border: 0px none
  REFERENCE .glass    border: 1px solid oklch(0.5 0.02 260 / 0.15)
  ```

  Visually, the **Min Hail Size and Min Wind Speed number steppers rendered as bare text with
  two loose −/+ glyphs** — no box, no field, no affordance that they were editable — sitting
  directly below an "Add email address" `.form-input` showing full glass chrome in the same
  panel. All 8 references repointed at real tokens; verified byte-identical to `.form-input`
  and `.glass` afterwards, with no border doubling. Zero references to either token remain.

### Spacing — no new findings, root cause unchanged

Root font-size is 14px on every route, so Tailwind's rem utilities keep landing on fractional
pixels. `.glass` padding measures 17.5px and 8.75px 21px (Dashboard), 14px and 10.5px 14px
(Pipeline), against a clean 24px (Estimates, Invoices, Contracts, Expenses, Settings), 20px
(Reports), 16px (Storm Catalog, Materials, Work Orders) and 12px 24px (Leads).
**Two spacing systems still coexist.** Documented backlog item, not re-filed.

### Modals — last run's fix is holding, one defect fixed

- All 5 overlays opened (`/tasks`, `/expenses`, `/work-orders`, `/leads`, `/subcontractors`)
  compute `animation-name: modal-scale-in`. Run 75's `f788c22` fix, which *defined* the
  previously-undefined `.modal-scale-in` selector, is live and every overlay animates in.
- Panel radius consistent: 20px (modals) / 20px 18px (slide-overs).
- **Found and fixed (`5ae8bfb`)** — `ImportLeadsModal.jsx:325` renders the "Importing
  leads…" indicator with `className="skeleton-shimmer"`. **No such selector exists.** The
  app's shimmer class is `.skeleton` (`index.css:4309`); `skeleton-shimmer` exists only as a
  `@keyframes` name inside `Dashboard.jsx`'s inline `<style>`, which is not even mounted here
  because the modal opens from `LeadList`. The user saw a **48×48 empty gap** for the entire
  duration of a CSV import. Proven without running a real import (which would have written
  rows and geocoded) by injecting both classes into the live document and reading computed
  style: `.skeleton-shimmer` → `background-image: none` / `animation-name: none`; `.skeleton`
  → gradient + `shimmer 1.5s`.
- Re-confirmed known, not re-filed: 3 modal title treatments with a heading-level skip
  (`ExpensesView` `h3`@16 vs `WorkOrders` `h2`@18 vs `ImportLeads` `h2`@20); backdrop variance
  (`blur(8px)`/z9999 vs none/z1000); close-button placement in 2 patterns.

### Bonus sweep — accessible button names: CLEAN, family closed

Because s2 fixed one unnamed control this run, s3 swept every visible `<button>` and
`[role=button]` inside `.main-content` on all 17 routes, accepting text / `aria-label` /
`title` / `aria-labelledby` / `img[alt]` / `.sr-only` / `<svg><title>`. **Result: 0 unnamed
buttons on 0 routes.** The family is closed.

### Audit methodology note

The static set-difference produced **17 candidates; only 3 were real** — a ~5× over-report.
Runtime CSSOM measurement killed the rest, and each would have been a false bug report:
`animation: spin` has no `@keyframes spin` in `index.css` but *is* defined by third-party CSS
(the spinner spins); `page-fade-in` and `--tc` are genuinely undefined but their selectors
have zero usages in any `.jsx` (dead CSS); `mobileEstPulse` / `mobilePulse` are defined in
component-local `<style>` blocks co-located with their users. **Static set-difference to
generate candidates, runtime measurement to confirm — neither half alone is sound.**

---

## Bugs Fixed (numbered)

1. **`/invoices` → `POST /api/crm/invoices/:id/send-email`** — the Send Email button posted to
   `/api/invoices/:id/send-email`, a mount that does not exist, so every send 404'd and the
   invoice email never went out. Fixed by adding the `/crm` prefix to the one-off inline
   `client.post` at `InvoicesView.jsx:587`. — **`f88895b`**
2. **Storm ingestion → `impactedAssetService.js`** — the notification fan-out filtered on
   `users.is_active`, a column that does not exist, throwing `42703` on every impacted lead
   and silently swallowing the "Property re-impacted by storm" notification. Fixed by dropping
   the predicate, matching all three other tenant-wide fan-outs. — **`e8ddc8f`**
3. **`/work-orders` (detail overlay)** — all 7 milestone completion toggles were empty
   `<button>`s with no accessible name in either state; a screen reader announced them as
   "button". Fixed with a state-tracking `aria-label` ("Mark *name* complete" / "incomplete"),
   matching the convention already used by both sibling controls in the same row.
   — **`05aa857`**
4. **`/alerts` → `AlertSettings.jsx`** — 8 references to two CSS custom properties that are
   not defined anywhere (`--border-subtle`, `--bg-elevated`); because they sat inside the
   border shorthand the whole declaration went invalid, so the Min Hail Size and Min Wind
   Speed steppers rendered with `border: 0px none` and a transparent background — no control
   chrome at all. Fixed by repointing all 8 at real tokens. — **`383ba4f`**
5. **`/leads` → Import Leads modal** — the loading indicator used `className="skeleton-shimmer"`,
   which matches no selector, rendering an invisible 48×48 blank for the whole duration of a
   CSV import. Fixed to `.skeleton`. — **`5ae8bfb`**
6. **App-wide → `index.html`** — the Google Material Symbols Outlined icon font was loaded on
   every page view with zero consumers, a render-blocking request for a forbidden icon
   library. Removed. — **`5ae8bfb`**

---

## Known Issues (Not Fixed)

**1. `/estimates` — `ReferenceError: editingEstimate is not defined` on Download PDF.**
Found by s4 in its final turn; it hit the 40-turn cap before it could fix or commit.
Reproduction: `/estimates` → Edit on any row → **Review & Share** → click the **Download
PDF** button in the top bar. The console throws and no PDF downloads.
Root cause confirmed statically: `EstimatesView.jsx:1637` reads `editingEstimate`, but that
`useState` is declared at line 37 inside `EstimatesView` (lines 31–878), while line 1637 sits
inside the **separate `EstimateBuilder` component** (starts line 1248), which receives the
estimate as its `estimate` prop and has no `editingEstimate` binding. **This is a one-line fix
(`estimate` in place of `editingEstimate`) and should be the first item of the next run.**

**2. The run did not achieve net-zero DB writes — 14 rows created, 11 updated.**
s1's empty-body write sweep exercised routes that accept an empty body and mutate, then hit
its 50-turn cap while assessing the damage. Re-queried live at report time:

| Table | Created 05:08 | Updated 05:08 |
|---|---|---|
| `estimates` | 4 (`EST-096`…`EST-099`) | 5 |
| `invoices` | 1 (`INV-0023`) | 1 |
| `work_orders` | 1 | 2 |
| `work_order_milestones` | 7 | — |
| `contracts` | 0 | 1 |
| `leads` | 0 | 2 |

Two state changes are wrong and user-visible: contract **`9f5aea47-9c97-4c98-9358-0205e3f41867`
is now `voided`**, and work order **`9c1794cc-793d-447d-90dc-2807566fe749` is now
`completed`**. Current totals: estimates 100, invoices 22, work_orders 21, live leads 24.
No remediation script was written for this run's residue.

**3. Run 75's cleanup script has still never been run.** `server/.qa-run75-s4-cleanup.mjs`
exists and is ready, but Run 75's residue is still live — which is why tonight's 4 new
estimates land at `EST-099` rather than `EST-095`. **Two runs of residue are now stacked.**

**4. s2's probe task was never deleted, and no DELETE route exists for tasks.**
`6abf9774-75f7-49c9-b184-c53d4cc7eeee` "QA76 task probe" (status `completed`) is still in
`tasks`. s2 discovered that `/api/crm/tasks` exposes only GET/POST/PATCH — there is no DELETE
route and no delete control in the UI, so the missing button is *consistent*, not a defect.
s2 was mid-way through writing a scoped SQL delete when it hit its 80-turn cap. Removing this
row requires direct SQL.

**5. Standing QA fuzz residue in `/leads` and `/pipeline` — carried from Run 75, now a fourth
stage running.** Addresses reading `true`, `12345`, `{"nested":{"deep":1}}` and `{"x","y"}`
are visible in the live leads table and the pipeline kanban. s2 saw and reported it again
this run. Deleting rows is outside a UI-audit charter and s4 never reached its cleanup step.
*(Note: the `warm` priority on task "QA72 verify task write" is **not** residue — `tasks.priority`
is typed as the `lead_priority` enum and renders as "Medium". Corrected in Run 75; do not
re-file.)*

**6. `/dashboard` Days-in-Stage still averages `updated_at`.** Any unrelated lead edit zeroes
the metric. The data needed is not recorded anywhere — this requires a `stage_changed_at`
column plus a backfill, which is a developer/migration decision, not a QA fix. Carried from
Run 74.

**7. `/content-studio` is on the s2 charter but does not exist in the app.** Third run
reporting this. Either the charter is stale or the page was never built.

**8. Documented UI backlog, re-confirmed and deliberately not re-filed:** two coexisting
spacing systems (14px root ⇒ 5 distinct `.glass` paddings); `.quick-action-btn` at 8 heights;
no `<h1>` anywhere and 9 of 17 routes with no page heading at all; 3 modal title treatments
with a heading-level skip; modal backdrop and close-button variance. Each needs a design
decision, not a bug fix.

---

## Test Coverage Gaps

**1. All four working stages hit their turn cap — the seventh consecutive run.**

| Stage | Turns | Terminal reason | Cost |
|---|---|---|---|
| s1 api-test | 51 / 50 | `error_max_turns` | $4.81 |
| s2 frontend-test | 81 / 80 | `error_max_turns` | $9.38 |
| s3 ui-audit | 61 / 60 | `error_max_turns` | $6.16 |
| s4 verify | 41 / 40 | `error_max_turns` | $2.84 |

Every gap below traces back to this. **Raising the caps — or budgeting the last 5 turns for
cleanup and artifact writing — is the highest-leverage change available to this pipeline.**

**2. API breadth fell to 199/272 (73.2%) from Run 75's 261/272 (96.0%).** s1 ran phase A of
its write plan (empty body) and capped out before phase B (no-op PATCH with each row's own
stored values). Phase B is the pass that reaches handler logic past validation, so **51 write
endpoints are recorded only as "the 400 guard fired"** — that is not the same as testing them.

**3. Only 1 of 4 stages wrote its results artifact.** s3 produced
`tests/audit-reports/ui-audit-2026-08-15-run76-s3.txt`. **s1, s2 and s4 wrote nothing** —
`C:/tmp/api-test-results.txt` and `C:/tmp/frontend-test-results.txt` are still Run 75 and
Run 74 files respectively, and no `verify-results.txt` was produced. This report was
reconstructed from commit messages, the raw sweep JSON in `C:/tmp/qa-r76-*.json`, the stage
transcripts and live DB queries. Run 74 recorded "4 of 4 stages wrote their .txt" as an infra
win; that regressed hard this run.

**4. s4 verified the fixes but committed nothing and ran no cleanup.** It confirmed all five
fix commits by diff review, re-ran the client↔server path set-difference, then spent its
remaining turns chasing the `/estimates` PDF error and capped out. Its charter items —
empty-state testing, form-validation edge cases, browser back/forward, 375px responsive
degradation, **and the standing DB cleanup** — were **not** reached.

**5. Routes never swept by the UI audit:** `/storm-map` and `/canvassing` (off-limits FEMA/map
code), `/leads/:id`, and the 6 public token routes (`/estimate/:token` etc., which need a live
token). s2 did open `/leads/:id` successfully, so only the map routes and public token routes
are wholly untested.

**6. What the set-difference technique is structurally unable to find:** names built at
runtime by string concatenation (`btn-${variant}`), which neither the static nor the runtime
half can resolve; and **styling that is wrong but valid** — every check asks "does this name
resolve", never "is the resolved value the right one".

**7. Not exercised by charter:** anything requiring a paid API key, bulk geocoding, bulk
import, or outbound email (38 write endpoints excluded), and all 18 DELETE endpoints.

---

## Build Verification

`cd client && npx vite build` — result recorded in the commit for this report; see the
history entry for the exact outcome.

---

*Report generated by stage s5 on 2026-08-15. Previous run: Run 75 (2026-08-14). Drift
baseline for the next run: `cb1d786`.*
