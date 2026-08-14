# StormLeads — Overnight QA Report

**Run 74 · 2026-08-11 · 05:00–06:05 CDT**
Baseline `3dd2e0f` (`checkpoint: pre-overnight-run 2026-08-11`) → HEAD `f5f593a`

> **Run-number note.** History's last entry is Run 73 (2026-08-09); no run occurred on
> 2026-08-10, so tonight is canonically **Run 74**. Stage s1 labelled itself Run 74; s2, s3
> and s4 each labelled themselves **Run 75**, and the archived audit file is committed as
> `tests/audit-reports/ui-audit-run75.txt`. This is the same self-labelling off-by-N recorded
> for Run 60. Artifacts named "Run 75" in this report belong to Run 74.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Bugs found | 7 |
| Bugs fixed | 6 |
| Bugs found but **not** fixed | 1 (needs a schema migration) |
| Commits | 7 (6 × `fix:`, 1 × `docs:` archive) |
| Frontend routes render-swept | 17 of 20 in-app routes |
| Frontend routes interaction-driven | 8 |
| Modals opened and measured live | 5 distinct (of ~22 overlay sites) |
| API routes in catalogue | 272 across 36 route files (re-counted from source this stage — matches) |
| API routes exercised | **244 of 272 (89.7%)** — 28 excluded by charter |
| API requests issued | ~950 across 7 phases |
| API 5xx found | **1** (`generate-tiers`) — every sweep phase otherwise 0 5xx |
| UI defects found | 4 classes across 26 code sites |
| UI defects fixed | 4 classes across 26 code sites |
| Net DB row writes | **0** from testing; plus a deliberate cleanup of 4 residue rows |
| Final build | exit 0 (see Session Integrity) |

**Headline — the method fix from Run 74's own s1 paid off immediately, and then a second
method fix paid off in s3.** Runs 70 and 73 probed write routes with a valid-but-nonexistent
UUID, which 404s *before* handler logic runs, so those sweeps were structurally incapable of
finding stored-shape crashes. Adding a **real-ID pass** found a hard 500 on the first try
(`POST /api/estimates/:id/generate-tiers`, `(x || []).map` walking onto a `null` element —
the third appearance of that exact shape). Separately, s3 found two of its three defects by
**grouping every element by computed style and investigating the odd bucket**, not by hunting
a known bug shape: the plan badge surfaced because it was the only button of 35 style
variants whose own font computed to the UA default, and the real defect (an untinted icon)
was two steps past the signal that flagged it.

**Second theme — "create coerces, update does not" is now a confirmed bug family, third
appearance.** `WorkOrderDetail` seeds unset optional fields with `''` and PATCHes the whole
form; `createWorkOrder` already coerced `'' → null` for every uuid/date/time column but
`updateWorkOrder` did not, so Postgres rejected the write with 22P02 → 400. **Save Changes
failed on 20 of 21 work orders (95%) and the edit was discarded.** Same shape as `ea15a50`
(estimate autosave). Standing action carried forward: for every entity, diff the create
service function against the update service function.

**Third theme — the JSONB carry-forward is CLOSED with numbers and is *not* a bug.** The
three-run-old note that "~23 of 29 JSONB columns are unguarded" was tested rather than
assumed. All 6 high-traffic columns guard the container type and tolerate junk elements,
and every reader now survives that junk: this is a coherent guard-at-read architecture, not
a defect. The residual risk is precise and worth stating: *a new reader doing element access
without a filter reintroduces the 500 class* — which is exactly how `generate-tiers` broke.

---

## Backend API Test Results

Stage s1 (`api-test`). Server on **`localhost:3001`** (not 3000 as the stage prompt states).
Results were recorded per **phase**, not per category, so the table below gives the verified
route inventory and charter exclusions per category; pass/fail is reported per phase beneath it.

### Route inventory and coverage by category

| Category | Route files | Routes | Exercised | Excluded (charter) |
|---|---|---:|---:|---|
| CRM core | `crm.js` | 51 | 46 | 5 send-email |
| Storm / property data | `properties`, `storms`, `stormHistory`, `counties`, `map`, `dataApis`, `disasterDeclarations` | 33 | 27 | 2 geocode, 3 import, 1 counties import |
| Estimates | `estimates.js` | 17 | 17 | — |
| Contracts | `contracts.js` | 13 | 13 | — |
| Financing | `financing.js` | 13 | 12 | 1 plans/sync |
| Drip / automations | `drip`, `automations` | 13 | 13 | — |
| Work orders | `workOrders.js` | 12 | 12 | — |
| Auth / onboarding | `auth`, `onboarding` | 12 | 12 | — |
| Canvassing / territories | `canvassing`, `territories` | 11 | 11 | — |
| Skip trace | `skipTrace.js` | 10 | 1 | 9 (paid API) |
| Alerts / notifications | `alerts`, `notifications` | 10 | 10 | — |
| Materials | `materials.js` | 9 | 9 | — |
| Reports / dashboard | `reports`, `dashboard` | 9 | 9 | — |
| Invoices | `invoices.js` | 8 | 8 | — |
| Subcontractors | `subcontractors.js` | 8 | 8 | — |
| Roof measurement | `roofMeasurement.js` | 8 | 8 | — |
| Payments | `payments.js` | 7 | 1 | 6 (real money) |
| Leads | `leads.js` | 6 | 6 | — |
| Admin | `admin.js` | 6 | 6 | — |
| Expenses | `expenses.js` | 5 | 5 | — |
| Drift | `drift.js` | 5 | 5 | — |
| Documents | `documents.js` | 3 | 3 | — |
| Webhooks | `webhook`, `hearthWebhook` | 2 | 1 | 1 |
| Search | `search.js` | 1 | 1 | — |
| **Total** | **36 files** | **272** | **244 (89.7%)** | **28** |

Prior run for comparison: 132 of 272 (48.5%).

### Results by phase

| Phase | Requests | Result |
|---|---:|---|
| 1 — GET sweep (dead-uuid params) | 122 | 76 × 2xx, 11 × 400, 5 × 403, 30 × 404 — **0 5xx** |
| 2 — WRITE sweep (empty body, dead uuid) | 122 | 12 × 2xx, 110 × 4xx — **0 5xx** |
| 3 — AUTH sweep (no token) | 244 | 242 × 4xx, 2 × 2xx — no unintended public route |
| 4 — real-ID GET, one live row per param route | 24 | 23 × 200, 1 × 404 — **0 5xx** |
| 5 — every row of 6 JSONB entities through detail + PDF | 288 | **0 5xx** |
| 6 — public token routes (unauthenticated) | 95 real + 7 forged | **0 5xx**, no leak |
| 7 — JSONB write-guard probes (6 columns × 7 hostile shapes) | 42 | container guarded, elements tolerated |

**Phase 5 was exhaustive, not sampled:** estimates 83 rows × {detail, pdf}, invoices 18 ×
{detail}, contracts 6 × {detail, pdf}, work_orders 21 × {detail, pdf}, material_orders 3 ×
{detail}, leads 47 × {detail}. Four param routes were skipped because no rows exist
(`drip-sequences/:id`, `financing/applications/:id`, `territories/:id`, `territories/:id/pins`
— the `territories` table does not exist at all).

**Auth:** the only two unauthenticated 200s are `POST /api/webhooks/hearth` and
`POST /api/webhooks/tracerfy`. Both are public by design for external callers, both no-op
without a valid signature, and the parse-before-verify tradeoff in `financing/index.js:226`
is documented in-source at `:231-235`. **Verified non-bug — do not re-file.**

**Hostile input on the public surface:** dead UUID, `abc`, `../../etc/passwd`, `' OR 1=1 --`,
`null`, `%00`, and a 500-character token all returned a clean 404. No SQL injection, no path
traversal, no stack leak.

### Fixed

| Commit | Endpoint | Was | Now |
|---|---|---|---|
| `46d8480` | `POST /api/estimates/:id/generate-tiers` | 500 on any estimate with a non-object line item | 201 |
| `8a45209` | `PATCH /api/crm/work-orders/:id` | 400 on 20 of 21 work orders | 200 |

`46d8480` was **generalised rather than assumed isolated**: the three sibling routes that also
consume `estimate.line_items` (`/duplicate`, `/crm/invoices/from-estimate/:id`,
`/crm/work-orders/from-estimate/:id`) were probed with both malformed rows and returned
201/201 each — they pass the array through without element access, so they propagate the bad
shape but never throw. **The bug was isolated to `generate-tiers`, not systemic.**

---

## Frontend Feature Test Results

Stage s2 (`frontend-test`), plus interaction work in s3 and re-verification in s4.
App at `localhost:5173`, tenant `waterloo`.

**Method note carried from the prior run and applied here: a page that renders is not a page
that works.** Render-depth sweeps cannot find silent data bugs; interactions were driven and
then the *result* was verified against the database or a reload, not against the optimistic UI.

### Render sweep — 17 of 20 in-app routes

`/` · `/storm-map` · `/storm-catalog` · `/pipeline` · `/leads` · `/estimates` · `/invoices` ·
`/contracts` · `/work-orders` · `/tasks` · `/calendar` · `/reports` · `/canvassing` ·
`/materials` · `/subcontractors` · `/expenses` · `/settings`

**0 console errors, 0 page errors, 0 white screens, `<h1>` present on all 17.** The
glyph-in-text-node detector inherited from Run 73 returned 0 hits on all 17.

### Per-page detail

| Page | Driven this run | Result |
|---|---|---|
| `/dashboard` | Stat cards, funnel, Today panel, Days-in-Stage panel probed against the DB | **1 defect found, not fixed** — Days in Stage reports 0.0 days for all 5 stages and 0 stuck leads while 22 leads have sat in stage `new` for an average of 90 days. Raw-enum leak on the source chart **fixed** (`85d6358`). |
| `/reports` | Conversion-by-Source radar, Lead Sources pie | **1 defect fixed** (`85d6358`) — raw enum `fema_nsi` / `storm_map` rendered verbatim. Post-fix axis reads "Manual / FEMA NSI / Storm Map / Canvassing"; all 4 pie sectors still render. |
| `/work-orders` | Opened detail modal, clicked Save Changes on real rows, toggled milestones | **1 HIGH defect fixed** (`8a45209`) — Save Changes 400'd on 20 of 21 work orders. Milestones **PASS**: toggle persists (1/8 → 2/8 survives reload) and photo-gated milestones correctly expose "Photo required — upload before completing". |
| `/tasks` | Slide-over opened and measured | Renders and opens correctly. Close button was unnamed → **fixed** (`6a0a29f`). Does not close on Escape (see Known Issues). |
| `/expenses`, `/materials` | Modals opened and measured | Render and open correctly. Close buttons unnamed → **fixed** (`6a0a29f`). |
| `/leads` | Import CSV modal opened (s4) | Opens correctly; close button named after `6a0a29f`. |
| `/subcontractors` | Slide-over opened (s4) | **PASS** — already had an accessible close name, and is still the only overlay that closes on Escape. |
| Remaining 10 routes | Render, console, heading and glyph checks only | **PASS**, no interaction driven. |

### Tester error recorded, not a defect

`/storm-archive` redirects to the Dashboard. That is correct — the route is `/storm-catalog`
(`Sidebar.jsx:30`, labelled "Storm Archive"), and `App.jsx`'s `path="*"` correctly catches a
nonexistent path. **Not a bug.**

---

## UI Consistency Audit Results

Stage s3 (`ui-audit`). All 7 charter audits executed across 17 routes.

| # | Audit | Verdict |
|---|---|---|
| 1 | **Icons** | **PASS**, 3 lenses. 0 imports from `24/solid`, 0 from Lucide/react-icons/FontAwesome; 2,160 rendered SVGs measured, 0 non-conforming (all `viewBox="0 0 24 24" fill="none" stroke-width="1.5"`); 0 foreign classes (`fa-*`, `material-icons`, `glyphicon`). |
| 2 | **Buttons** | **1 defect found and fixed** (`69755dd`). 35 computed style variants app-wide. The largest look-alike pair was investigated and proved **deliberate**: `.nav-link` 13.5px vs `.nav-link--child` 13px is set in the same rule as the child indent (`index.css:388`), not drift. |
| 3 | **Toolbars / headers** | **PASS — byte-identical on 17 of 17.** 56px height, 0px 32px padding, 20px/18px radius, `h1` 18px/700. Single bucket, no outliers. |
| 4 | **Sidebar / nav** | **PASS.** 18 nav links on all 17 routes, 18 of 18 carry a Heroicon, gaps identical `[0, 8, 30]`, exactly one `.is-active` per route — except `/alerts`, the known orphan route with no sidebar entry. Not a new finding. |
| 5 | **Forms** | **PASS on the hard project rules** — 0 native `<select>` and 0 `<input type="date">` across all 17 routes. `CustomSelect` and `DatePicker` fully respected, 7th consecutive run. |
| 6 | **Spacing & alignment** | **MEASURED FOR THE FIRST TIME** after being deferred in Runs 72, 73 and 74. Root cause found, not fixed (below). |
| 7 | **Modals** | **1 defect found and fixed** (`6a0a29f`). Drift re-confirmed with numbers; Escape behaviour measured after 4 runs deferred. |

### Icons — the non-defects, adjudicated

- `StormMap.jsx:1900` `"↑ Type the house #"` — inside a Google InfoWindow HTML string. Map
  code (charter-excluded) and prose, not an icon slot. **Not a defect.**
- 13 emoji hits, all previously adjudicated. `CanvassingMode.jsx:8-13` defines an `emoji:`
  field on `DISPOSITIONS` that **is never read anywhere in the file** — dead data that renders
  nothing. `Pipeline.jsx:347-349` hail/date/wind and the lead-score bolt are the documented
  deliberate non-Heroicon glyphs. **Not re-filed.**

### Spacing — the root cause behind every fractional pixel in the app

Three runs deferred this measurement. Measured now, it explains values earlier runs logged as
inexplicable:

> **Two spacing systems coexist.** Dashboard and Pipeline use **Tailwind rem utilities**
> (`p-4`, `p-5`, `gap-2`, `gap-3`) resolving against a **14px root** → 17.5px, 10.5px,
> 8.75px, 7px. Every other page uses **px CSS variables** (`--space-md` = 12px, 16px, 24px).

Measured spread: 6 card-container gap values, 17 `.glass` padding values across 4 radius
values, 7 page-wrapper padding values. **Not converted** — it spans two large views and is a
refactor, which the charter forbids. Documented with numbers so the call can be made
deliberately. This is the same root cause as the standing "rem-vs-px font sizes at 10 sites"
note, now shown for spacing too.

### Modals — drift re-confirmed with numbers

Four modals opened live and measured (`/tasks` slide-over, `/work-orders`, `/expenses`,
`/materials` cart):

| Property | Result |
|---|---|
| `.glass` panel | **4/4 PASS** |
| `modal-scale-in` | **4/4 PASS** (0.25s slide-over, 0.2s the three modals) |
| Title treatment | 3 treatments (H2 18/700, H3 16/700, H3 16/800) **plus a slide-over with no heading element at all** |
| Close button size | 4 sizes — 32×32, 20×23, 18×21, 26×29 |
| Close inset (r, t) | 4 positions — 25,25 / 25,27 / 13,13 / 24,17 |
| Width | 420 / 520 / 480 / 420 |
| Backdrop | 0.35+blur16 / 0.6+none / 0.6+blur8 / 0.6+none — **per-context by design**, standing note says do not normalise |
| Escape to close | **0 of 4** close on Escape |
| `role="dialog"` / `aria-modal` | **0 files app-wide** — uniformly absent |

---

## Bugs Fixed

1. **`POST /api/estimates/:id/generate-tiers` — 500 on every estimate holding a non-object
   line item** — `46d8480`. `estimateService.js:330` ran
   `(original.line_items || []).map(item => ({ ...item, unit_price: ... }))`. `|| []` guards a
   *falsy container* only — not a truthy non-array, and not a `null` **element**. `{...null}`
   is legal and yields `{}`, so the spread survives and `item.unit_price` throws. Fixed by
   reusing the guard the estimate PDF route already uses (`routes/estimates.js:258`):
   `Array.isArray()` on the container plus `.filter(item => item && typeof item === 'object')`
   on the elements. Verified EST-083 `[null]` and EST-082 `[null,"",1]` both 500 → 201, and a
   control estimate with good data still produced 3 tiers **with its line item preserved**.

2. **`/work-orders` "Save Changes" — 400 on 20 of 21 work orders, edit discarded** —
   `8a45209`. `WorkOrderDetail` seeds unset optional fields with `''`
   (`WorkOrdersView.jsx:59-63`) and PATCHes the whole form, so unassigned or unscheduled work
   orders sent `assigned_to:""`, `scheduled_time_start:""`, `scheduled_time_end:""`.
   `updateWorkOrder` (`workOrderService.js:347`) passed those through; Postgres rejects `''`
   for uuid/date/time (22P02) and `errorHandler.js:32` maps that to a 400. `createWorkOrder`
   **already** coerced all of them at `:303-306`. Fixed with an `emptyToNull` list mirroring
   `updateEstimate`'s `dateFields` coercion. Text columns deliberately **not** coerced (`''`
   is legitimate there) and `status` deliberately **not** coerced (a null status would drop
   the row out of the kanban). Verified: identical payload 400 → 200, DB row uncorrupted,
   and a control work order with an assignee and both times byte-identical after reload.

3. **`/reports` + `/dashboard` — raw lead-source enum rendered to the user** — `85d6358`.
   `fema_nsi` and `storm_map` appeared verbatim on the Conversion-by-Source radar axis and
   the Lead Sources pie. The same enum was rendered **three ways app-wide**: "FEMA NSI"
   (LeadList/Pipeline, canonical), "Fema Nsi" (Dashboard), "fema_nsi" (Reports). `ReportsView`
   already had a `STAGE_LABELS` map and used it for stages but had no equivalent for sources.
   Fixed display-only with a `SOURCE_LABELS` map plus a `tickFormatter`, following the file's
   own local-label-map convention; the data shape is untouched so CSV export is unchanged.
   Found by the standing `^[a-z]+(_[a-z]+)+$` rendered-text detector, on its second outing.

4. **4 pages rendered two `<h1>` elements** — `26f73ef`. The topbar renders
   `h1.topbar__page-title` as persistent chrome on all 17 routes, and `Dashboard:1247`,
   `WorkOrdersView:958`, `MaterialsView:131` and `StormCatalog:197` each added a second one —
   on `/work-orders` and `/storm-catalog` it was **the same string twice**. Fixed `h1` → `h2`,
   which is what `SubcontractorsView:77` and `AlertSettings:93` already do: the convention
   existed and was followed by 2 of 6. Retagged rather than deleted because two of the four
   titles anchor a count badge or a subtitle+icon in a flex row. **Zero visual change**,
   guaranteed by the global `* { margin: 0 }` reset (`index.css:13`) plus inline
   fontSize/fontWeight on all four, and verified by measurement (28/820, 20/800, 22/800,
   22/700 all byte-identical before and after).

5. **18 modal and slide-over close buttons had no accessible name** — `6a0a29f`. An icon-only
   `<button>` whose entire content is `<IconX />` announces as just "button". Measured
   app-wide rather than sampled: of 46 buttons containing an X icon, 18 had no name, 22 had
   text, 5 had `aria-label`, 1 had `title`; after the fix, **0 unnamed**. This was drift, not
   a missing convention — `aria-label="Close"` already existed at 4 sites. **Every one of the
   18 was verified to be `onClick={onClose}` before labelling**: an X glyph equally means
   "remove this row", and mislabelling one of those "Close" would be worse than leaving it
   unnamed.

6. **Plan badge icon ignored the tier colour on all 17 routes** — `69755dd`. `PlanBadge` tints
   four things with `planColors[tier]` — background (12%), border (25%), label, and by intent
   the `CheckBadgeIcon` — but the icon sat **outside** the `<span>` carrying `color`, so it
   fell through to the inherited near-white `oklch(0.95 0.005 260)` against an amber chip.
   Wrong on every route and for all four tiers. Fixed by adding `color` to the button's style
   object. Verified live: icon, label, span and SVG stroke all now `oklch(0.75 0.15 60)`.

---

## Known Issues (Not Fixed)

### Found this run

- **`/dashboard` "Days in Stage" measures the wrong thing — needs a schema migration.**
  Confirmed defect, medium severity, silent wrong data with no error signal. The panel shows
  avg 0.0 days for all 5 stages and 0 stuck leads, while 22 leads have sat in stage `new` for
  an average of 90 days. `crm.js:849` computes the average from **`updated_at`**, a generic
  row-modification timestamp maintained by the `trg_leads_updated` trigger that fires on
  *every* UPDATE of `leads`. Adding a note, assigning a rep or re-scoring a lead therefore
  resets its "days in stage" to 0 and clears its stuck flag — the panel's entire purpose is
  defeated by any unrelated edit. **Not fixable within the QA charter:** there is no
  stage-entry timestamp anywhere in the schema (`leads` has only `created_at`, `updated_at`,
  `last_contact_at`, `deleted_at`, `lead_score_updated_at`), and the `activities` table records
  only `note` and `call` rows, no stage changes. The information required to compute this
  correctly **is not recorded**. A correct fix is a new `stage_changed_at` column plus a
  backfill plus a write on every stage transition. **Recommend a developer ticket.**

- **Property import cap is 95% consumed.** `properties` holds 94,680 rows against
  `MAX_TOTAL_PROPERTIES = 100000` (`countyService.js:114`). Not a bug; worth a ticket before
  it silently stops importing.

### Recommended, deliberately out of charter

- **Escape does not close 21 of ~22 overlays.** Measured for the first time after 4 runs
  deferred: 0 of 4 modals tested close on Escape; only `/subcontractors` does. A genuine
  inconsistency, but implementing it across ~22 overlays is a behaviour change, not a
  consistency fix. Needs a decision.
- **`role="dialog"` / `aria-modal` appear in 0 files app-wide.** Uniformly absent, therefore
  consistent; adding them is a feature, not a QA edit. Recommended.
- **The two-spacing-system split** (Tailwind rem on Dashboard/Pipeline vs px vars elsewhere).
  One convention decision; measured and documented above rather than half-converted.
- **Modal title and close-button drift** — 3 title treatments plus a headingless slide-over,
  4 close sizes, 4 close insets. Now measured twice. Needs a design decision.
- **Per-file inline style objects** — `quick-action-btn` with inline `fontSize` 11/12/13px is
  the accepted norm for that utility class. Documented, not converted.

### Carried forward, re-confirmed

- **External — `feature.tnris.org` is unresolvable** (`getaddrinfo ENOTFOUND`) and the
  auto-import scheduler retried it **58 times inside ~90 seconds** for `_TX_STATEWIDE` at
  06:00 with no visible backoff. Independently confirmed from tonight's server log; Run 73
  measured 61 retries in ~5 minutes. The DNS failure is external; **the retry volume is not**
  and is worth a look.
- **External** — SPC archive 404s for same-day `260811_rpts_*.csv` (not yet published).
  Expected, not a defect.
- Duplicate `estimate_number` (`EST-021` / `EST-022` / `EST-082`); `INV-0008` / `INV-0013`
  with `total = 0.00` and `amount_paid > 0`. Carried, not re-verified this run.
- `EST-082` / `EST-083` malformed rows are **kept deliberately** — they are the fixtures that
  exercise the JSONB guards, and they are what caught `46d8480`.
- `className="modal-scale-in"` at `CalendarView:256`, `DripSequences:580`,
  `EstimatesView:2868`, `InvoicesView:1055` matches no CSS rule — dead class, left per the
  no-refactor rule.
- `/tasks` Pending tab empty state reads "No tasks yet / Create your first task" when tasks
  exist — wrong copy for an empty *filter*. Cosmetic.

### Closed this run

- **"~23 of 29 JSONB columns are unguarded" — CLOSED, and it is NOT a bug.** Tested rather
  than assumed, by creating throwaway rows, PATCHing 7 hostile shapes, reading back what was
  *stored*, then hitting the reader. All 6 high-traffic columns reject string/number/bool/object
  containers, tolerate junk elements, and every reader returns 200 on the junk. That is a
  deliberate, uniform guard-at-read architecture. **Residual risk, stated precisely:** a new
  reader that does element access without a filter reintroduces the 500 class.

---

## Test Coverage Gaps

**Frontend**

- **3 of 20 in-app routes were never opened:** `/leads/:id` (lead detail — every tab, the
  activity modal and the score-breakdown popup are all untested this run), `/alerts` (the
  orphan route with no sidebar entry), and `/admin` (returns 403 for this user; a screenshot
  was captured but the page was never exercised).
- **`/content-studio` is on the stage charter but does not exist in `App.jsx`.** The charter
  should be corrected or the route built — this has been silently unsatisfiable.
- **Settings' 15 tabs were not individually swept.** The stage charter names 12 of them
  explicitly; only the page shell was verified.
- **Form elements were measured at page level only.** Most forms live inside modals, and only
  **5 of ~22 overlay sites** were opened all night.
- **9 of 17 swept routes got render-depth checks only** — no interaction was driven on them,
  and the run's own method note says render depth cannot find silent data bugs.
- `/storm-map` and `/canvassing` are excluded from all sweeps by charter (map code).

**Backend**

- **28 of 272 routes are permanently excluded by charter** and have therefore never been
  exercised: payments (6, real money), skip-trace (9, paid API), send-email (5), geocode (2),
  import (3), plans/sync (1), counties import (1), webhook (1).
- **Results were recorded per phase, not per category.** The category table above is a
  coverage map derived from the route inventory; there is no per-category pass/fail record.
  Future stages should tag each request with its category at sweep time.
- **Write coverage is validation-depth for most routes.** Phase 2 used an empty body and a
  dead UUID, which proves nothing crashes on validation — not that the handler works. Only
  the JSONB entities got real-payload write testing.
- Four param routes could not be tested at all because **no rows exist**: `drip-sequences/:id`,
  `financing/applications/:id`, `territories/:id`, `territories/:id/pins`. The `territories`
  table does not exist in the database.

---

## Session Integrity

| Stage | Turns | Cap | Cost | API time | Commits | Results file |
|---|---:|---:|---:|---:|---:|---|
| s1 api-test | 51 | 50 | $5.42 | 13.7 min | 1 | ✅ `api-test-results.txt` (131 lines) |
| s2 frontend-test | 81 | 80 | $9.15 | 19.6 min | 2 | ✅ `frontend-test-results.txt` (127 lines) |
| s3 ui-audit | 61 | 60 | $6.67 | 16.4 min | 4 | ✅ `ui-audit-results.txt` (123 lines) |
| s4 verify | 41 | 40 | $4.14 | 11.2 min | 0 | ✅ `verify-results.txt` (71 lines) |
| **Total s1–s4** | **234** | — | **$25.39** | **61.0 min** | **7** | **4 of 4** |

- **INFRA WIN — 4 of 4 stages wrote their results file, for the first time.** Against 3-of-4
  last run and 1/1/0-of-4 in Runs 70–72. **s4 in particular went from writing nothing at all
  to a complete 71-line file** — it was the single biggest waste in the previous run. The fix
  that worked is unchanged: **write the header first and append per finding**, rather than
  composing the file in a final turn the cap always eats. All four files were verified **by
  header line**, not by mtime.
- **All four stages hit MAX_TURNS — the sixth consecutive run of 4-of-4.** Turn caps, not test
  design, remain the binding constraint on coverage.
- **INFRA — two stages reported themselves "STAGE COMPLETE, uncapped" while the harness
  recorded `error_max_turns`.** s1 and s3 both wrote a complete results file *and* then hit
  the cap; the self-assessment in `overnight_resume.md` is contradicted by the session JSON.
  Trust the session JSON, not the stage's own claim.
- **s4 committed nothing**, but unlike last run its verification is fully recorded. It
  independently re-verified all 6 fix commits — all PASS — and re-measured one of them more
  accurately than the stage that made it: `8a45209`'s blast radius is **21 of 21** work orders
  affected, not the 20 of 21 recorded in the commit message.
- **DB hygiene.** Net **0** rows written by testing: 9 `generate-tiers` estimates deleted
  (84 → 84), 6 sibling-probe rows deleted, all JSONB probe rows deleted. Separately, s4 made
  two deliberate cleanups: it restored `'' → NULL` on 20 work-order text columns that its own
  PATCH round-trip had converted, and it deleted **4 user-visible QA-residue work orders**
  titled `true`, `12345`, `{"nested":{"deep":1}}` and `{"x","y"}` (2026-08-02 fuzz residue),
  cascading to 28 orphan milestones. `work_orders` 21 → 17, `work_order_milestones` 148 → 120.
- **New tester traps, added to standing gotchas.** `POST /api/auth/login` is rate-limited —
  roughly 10 attempts triggers a 15-minute lockout, so a harness must not re-mint on a
  counter. `POST /api/properties/trigger-import` is **not** matched by a `/\/import/`
  exclusion because the path is `trigger-import` with a hyphen; it returned
  `{"status":"started"}` and began a real background bulk import of 70 storm clusters.
  Verified harmless this time (0 property rows written in the following 30 minutes — the
  counties were already imported), but it is a live cost risk.
- The API listens on **port 3001**; the s1 stage prompt says 3000. The prompt's login
  credentials also differ from the ones the harness actually used. Both should be corrected.
- **`docs/overnight-history.md` had a gap at 2026-07-31** (Runs 63–64 were missing entirely).
  Backfilled as a reconstructed stub from git evidence. This is the second consecutive run to
  find a missing history entry — check for gaps at the **start** of every s5.

---

*Report generated by stage s5 (report), Run 74, 2026-08-11.*
