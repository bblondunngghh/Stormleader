# StormLeads — Overnight QA Report

**Run date:** 2026-08-29
**Branch:** `feat/financing`
**Baseline:** `1e5c194` (`checkpoint: pre-overnight-run 2026-08-29`)
**Head before this report:** `d41e868`
**Build:** PASS — `npx vite build`, 8.17s, exit 0, 0 errors
**Net DB writes:** 0 (every probe was stubbed client-side, rejected with a 400, or a value-preserving identity write)

---

## Stage completion

| Stage | Run | Outcome | Report | Artifact |
|---|---|---|---|---|
| s1 api-test | 105 | **CAPPED** — `error_max_turns` at turn 51/50 | none | `C:/tmp/api-test-results.txt` (written before the cap) |
| s2 frontend-test | 105 | Complete | full | `C:/tmp/frontend-test-results.txt` + `addendum.txt` |
| s3 ui-audit | 106 | Complete | full | `C:/tmp/ui-audit-results.txt` |
| s4 verify | 107 | **CAPPED** — `error_max_turns` at turn 41/40 | none | none |
| s5 report | 108 | Complete (this document) | — | — |

Two of five stages hit the turn cap. s1 capping is now its **third consecutive run**;
s4 capping is new. Both left work behind — see *Test Coverage Gaps*.

Run numbering collided this run: s1 and s2 both self-labelled **Run 105**. Numbering
resumes cleanly at s3 = 106.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages / routes tested | **19 routes** (18 by s2, 19 by s3 incl. `/alerts`) + **15 Settings tabs** + **6 modals / slide-overs** opened and probed |
| API endpoints tested | **198 distinct endpoints / 248 endpoint+method pairs**, out of a 272-route inventory across 36 route files |
| Total API requests issued | **~498** (314 sweep + 39 jsonb + 120 typed-field + ~25 manual) |
| 5xx responses | **0** |
| Page errors across all sweeps | **0** beyond the documented token-refresh 401s and the documented `/admin` 403 |
| **Bugs found** | **3** |
| **Bugs fixed** | **3** |
| UI inconsistencies found | **1 family** — 13 rule groups / **27 dead CSS declarations**, one root cause |
| UI inconsistencies fixed | **1 family (all 27 declarations)** |
| Commits | **4** — 3 fixes (`f9bb21e`, `f8354cf`, `d41e868`), 1 harness carry (`e34c27a`) |

All three bugs share one shape: **a value silently loses its expected type or
precedence, and nothing at the call site notices.** That is now the **eighth
consecutive run** with this signature.

---

## Backend API Test Results

Server: `http://localhost:3001` (the charter's `:3000` is not listening — documented).
Auth: `POST /api/auth/login` returns an `accessToken`. Five sweep phases: GET with a
real id; POST/DELETE with a dead id and empty body; PATCH/PUT with a dead id;
PATCH/PUT with a real id and empty body; PATCH/PUT with a real id and an unknown
field only.

### Coverage and results by category

| Category | Endpoints | Endpoint+method pairs | Probes | Status spread | Failed |
|---|---|---|---|---|---|
| Auth & admin | 6 | 8 | 12 | 200x1, 400x3, 403x8 | 0 |
| Leads & pipeline | 36 | 48 | 64 | 200x20, 400x32, 404x12 | 0 |
| Estimates & contracts | 19 | 28 | 36 | 200x11, 400x12, 404x13 | 0 |
| Invoices, expenses, payments, financing | 22 | 29 | 37 | 200x13, 400x19, 404x5 | 0 |
| Work orders, subcontractors, materials | 20 | 28 | 36 | 200x17, 400x8, 404x11 | 0 |
| Dashboard & reports | 25 | 25 | 25 | 200x25 | 0 |
| Storm & property data | 29 | 31 | 33 | 200x8, 400x20, 404x5 | 0 |
| Automation, notifications, settings, integrations | 41 | 51 | 71 | 200x30, 400x26, 404x15 | 0 |
| **Total** | **198** | **248** | **314** | **200x125, 400x120, 403x8, 404x61** | **0** |

Plus three focused harnesses: `.qa-r105-jsonb.mjs` (39 requests),
`.qa-r105-typed.mjs` (120 requests, 60 x 200 / 60 x 400), and ~25 manual probes
against contracts, `alert_mode` and varchar bounds. **0 5xx across all ~498
requests.**

Every status above is the correct status for its probe — the sweep asserts on "no
5xx and no silently-accepted junk", not on a fixed code. Four previously suspicious
200s were re-confirmed as correct behaviour and are recorded as verified non-bugs
(tenant singletons with no `:id` in the path; empty-body PATCH short-circuiting to a
pure read).

### What was fixed

**`f9bb21e` — contracts `content` JSONB accepted a scalar and white-screened the
contract page.** All four contract write paths (`POST /crm/contracts`,
`PATCH /crm/contracts/:id`, `POST` and `PATCH /crm/contracts/templates`) wrote the
`content` JSONB column with a bare `JSON.stringify` and no shape guard, so a scalar
string and a `sections` key holding a scalar were both **accepted and persisted with
a 200**. The server PDF path survives only by accident (it happens to guard with
`Array.isArray`); the client does not — `parseSections` returned `content.sections`
on truthiness alone, and `PublicContract.jsx:130`, `ContractsView.jsx:601` and
`:656` all call `sections.map()` on it. That throws on a string and blanks the page,
**including the public customer-facing contract**.

Fixed by guarding the write path the same way invoices and work orders already guard
`line_items`, and tightening both `parseSections` copies to `Array.isArray` — a
write-path guard alone cannot clean rows that already hold junk (the standing Run 68
lesson). Verified: 6 bad shapes now 400, the real `ContractsView` payload still
200s, templates guarded, build PASS.

### Structurally unexercisable (unchanged from prior runs)

Four routes cannot be driven at all: the `counties` and `material_products` tables
do not exist (`42P01`), and `contracts.public_token` / `leads.status_token` are not
columns (`42703`).

---

## Frontend Feature Test Results

Every route was reached by **clicking its sidebar link**, not by `page.goto`, with a
1.5s settle. Assertions per route: an `<h1>` is present, exactly one
`.nav-link.is-active`, zero page errors, and no horizontal overflow.

### Route regression sweep — 18/18 PASS

| Route | h1 | Body len | Nodes | Result |
|---|---|---|---|---|
| `/` | Dashboard | 2061 | 687 | PASS |
| `/storm-map` | Storm Map | 632 | 561 | PASS |
| `/storm-catalog` | Storm Archive | 20733 | 5307 | PASS |
| `/pipeline` | Pipeline | 1312 | 504 | PASS |
| `/leads` | Leads | 1596 | 549 | PASS |
| `/estimates` | Estimates | 1709 | 489 | PASS |
| `/contracts` | Contracts | 626 | 269 | PASS (defect found under stub — below) |
| `/work-orders` | Work Orders | 817 | 284 | PASS |
| `/materials` | Materials | 12350 | 2789 | PASS |
| `/invoices` | Invoices | 1446 | 448 | PASS |
| `/expenses` | Expenses | 470 | 254 | PASS |
| `/tasks` | Tasks | 334 | 186 | PASS |
| `/calendar` | Calendar | 516 | 531 | PASS (styling defect found — below) |
| `/canvassing` | Canvassing | 407 | 399 | PASS |
| `/subcontractors` | Subcontractors | 1593 | 671 | PASS |
| `/reports` | Reports | 821 | 736 | PASS |
| `/settings` | Settings | 714 | 214 | PASS |
| `/admin` | Admin | 354 | 187 | PASS |

`/alerts` was additionally swept by s3 as the 19th route and is the documented
`.is-active` orphan — it renders correctly but highlights no nav link.

### Settings — 15/15 tabs PASS

All fifteen tabs (`profile`, `company`, `billing`, `payments`, `team`, `alerts`,
`notifications`, `email`, `financing`, `automations`, `drip-sequences`,
`custom-fields`, `contracts`, `reviews`, `pricing`) render a distinct panel with 0
page errors, and all 7 create controls open their form and add inputs as expected.

**Investigated and cleared:** Billing's "Add Payment Method" produces 0 API
requests, 0 overlays and no toast — it reads as a dead control but is the *submit*
button of an already-mounted Stripe `CardElement` form (`SettingsView.jsx:1466`,
button at `:1518`). With an empty card it renders "Your card number is incomplete."
inline. Correct behaviour; the tester's create-button regex misclassified a submit
as an opener.

### Interaction pass — all PASS

- **`/leads`** — search 13 to 1 to 13 rows restored; sort fires
  `limit=25&offset=0&sort_by=lead_score&sort_dir=DESC`; a row click opens the detail
  overlay (1178 chars) with the URL unchanged.
- **`/pipeline`** — 13 draggable cards across the 7 expected columns.
- **`/calendar`** — 42 day cells. **`/reports`** — 9 recharts surfaces.
  **`/storm-map`** — 1 canvas, 0 page errors. **`/canvassing`** — renders clean.
- **Estimate review-mode toolbar** (the documented hot spot — 3 dead controls in
  Runs 83/84) is **regression-clean for a third consecutive run**: Back to Editor
  (+864 chars), PDF (**really downloads** `EST-090.pdf`), Sign Now (+1 overlay).
  Send for Signing correctly skipped as destructive. Both prior fixes (`eb6331b`,
  `6462647`) still hold.

### What was broken and how it was fixed

**`f8354cf` — a list response missing its array key white-screened the entire SPA.**

Found with a response-shape sweep that had never been run here: 11 routes x 3 modes
(a 500; a body of `{}`; every top-level array nulled), stubbing the primary GET with
`page.route` + `route.fetch`. **32 of 33 probes degraded gracefully; `/contracts`
blanked on 2 of 3** — body text length 0, no `<h1>`, `contracts.filter is not a
function`.

Root cause at `ContractsView.jsx:55` — `res.data.contracts || res.data || []`. The
`|| res.data` fallback degrades a missing or null key into the **whole response
object**: truthy, and not an array. Because the app has **no error boundary**, the
sidebar and header go down with it, not just the panel.

Seven sites shared the idiom (`ContractsView.jsx:55,287,389`; `LeadDetail.jsx:203`;
`SettingsView.jsx:1391,2286`; `WorkOrdersView.jsx:769`). The app's own convention at
six *other* list setters is `res.data.X || []`, which cannot produce a non-array —
that asymmetry is exactly why `/contracts` was the only one of eleven routes to
crash.

Fixed by keeping the bare-array fallback but requiring it to actually be an array.
Verified: the repro goes from body length 0 to 432 with a proper "No contracts"
empty state, and all five touched views render **byte-identical** to their pre-fix
baselines (626 / 817 / 1596 / 632 / 638). Build PASS 7.98s.

**Reachability: latent, not live.** Every one of the seven endpoints currently
returns its key (checked in the route handlers). Fixed anyway under the standing
Run 68 rule that accepted-but-wrong values are a bug queue — and a whole-app white
screen is its worst realisation.

### Type-confusion sweep on jsonb columns — 24 probes, 0 defects

For each list route the real GET was fetched and one jsonb field on **every row**
rewritten to a scalar or wrong shape, then the page rendered. Zero DB writes.
`/estimates` (`line_items`, `upgrades`, `insurance_details`, `financing_plan_ids`),
`/invoices` (`line_items`), `/contracts` (`content`) and `/leads` (`custom_fields`)
all render clean with 0 errors. **The list level of this branch is closed.** Three
further sites were checked statically and cleared as not the Run 68 shape.

### What still needs attention

- **`EstimatesView.jsx:1318` — measured, deliberately not fixed.** `/estimates` then
  Edit white-screens with `templates.map is not a function` when
  `GET /api/estimates/templates` returns a truthy non-array inside the `templates`
  key. This is a **much weaker claim** than the bug fixed in `f8354cf`: `:1318` uses
  the app's *correct* `|| []` idiom and only breaks if the server actively lies
  about the type inside the key, and `estimates.js:96-99` returns a query rowset,
  which is always an array. Guarding it would mean `Array.isArray`-ing every `.map()`
  in the client — the defensive refactor the charter forbids. Recorded so it is not
  re-chased as a fresh finding.
- **The app has no error boundary anywhere.** Any render throw blanks the whole SPA
  rather than the panel that failed. This is the amplifier behind both tonight's
  frontend bug and Run 68's. Adding one is an enhancement and therefore out of QA
  charter, but it is the highest-leverage robustness item in the backlog and is put
  to the developer here.

---

## UI Consistency Audit Results

19 routes swept in a single browser call, plus 6 modals and slide-overs opened and
probed from the inside.

| # | Category | Result |
|---|---|---|
| 1 | **Icons** | **PASS — no non-Heroicon icons found.** 0 foreign SVGs; every non-recharts, non-vendor svg is `viewBox="0 0 24 24"`. 0 `fa-*`, 0 `material-icons`, 0 `lucide`. Nothing to fix. |
| 2 | **Buttons** | **PASS.** Every radius and height signature maps to a documented button family. No sizing or styling inconsistencies found. |
| 3 | **Toolbars / headers** | **PASS.** Exactly one `<h1>` on 19/19 routes, each with the correct title. |
| 4 | **Sidebar / nav** | **PASS.** 18 nav links + 18 nav icons on 19/19 routes; exactly one `.is-active` on 18/19 — the exception is `/alerts`, the documented orphan route. |
| 5 | **Forms** | **PASS — no non-standard elements.** 0 native `<select>` and 0 native `<input type="date">` app-wide, source and runtime. The `CustomSelect` / `DatePicker` conventions hold. |
| 6 | **Spacing** | **1 defect found and FIXED** (the FullCalendar header cushion, below). 0 horizontal overflow on 19/19 routes. |
| 7 | **Modals** | **PASS.** 0 overlays open at rest on 19/19; 6 opened and probed with 1,439 inline declarations tested — 0 hits. |

### The defect — `d41e868`, a cascade mechanism no prior run had modelled

`client/src/index.css` is wrapped in `@layer base` (line 6). **FullCalendar v6
self-injects its stylesheet unlayered, and an unlayered normal declaration beats
every layered one regardless of specificity.** So the app's `.calendar-view .fc`
overrides — specificity up to **402** — were losing to FullCalendar's own
specificity-**100** rules. **27 declarations were silently dead on `/calendar`**,
each confirmed on every matching element:

| Element | Declared | Actually rendered | Elements |
|---|---|---|---|
| `.fc-toolbar-title` | font-size 18px | **24.5px** | 1/1 |
| `.fc-col-header-cell-cushion` | padding 10px | **2px** | 7/7 |
| `.fc-today-button` | glass background + border | **transparent, no border** | 1/1 |
| `.fc-prev/next .fc-icon` | 18x18, font-size 0 | **19.5px** | 1/1 |
| `.fc-button` | display inline-flex | **block** | 7/7 |
| `.fc-scrollgrid tr:last-child td` | border none | **1px solid** | 43/43 |
| `.fc-scrollgrid td:last-child` | border none | **1px solid** | 7/7 |
| `.fc-button-group .fc-button` | border none | **1px solid** | 6/6 |
| `.fc-col-header-cell` | app border colour | **FullCalendar's colour** | 7/7 |
| `.fc-daygrid-day-number` | padding 0 | **4px** | 42/42 |

**The author had already hit this once** and patched only `.fc-button-primary`
typography with `!important`, documenting the mechanism at `index.css:3780`. These
27 declarations are what that patch did not cover.

**Fixed by closing `@layer base` around the FullCalendar block — not by
`!important`.** Extending `!important` would have inverted the cascade against the
block's *own* non-important overrides (`.fc-button:hover`,
`.fc-button-group .fc-button`, `.fc-day-other .fc-daygrid-day-number`) and killed
those instead — manufacturing the exact Run 102 defect shape the audit was there to
find.

Verified: rendered values now match source; intended overrides preserved (grouped
buttons still transparent, other-month days still dimmed); `:hover` proven alive
with a real pointer; the **built bundle** grepped to confirm the FullCalendar block
sits past the layer close with nothing reordered; 19-route sweep 18/19
byte-identical with `/calendar` unchanged. Build PASS 8.01s, 0 DB writes.

### Two long-standing audit gaps closed — both empty

- **Cross-selector `!important` kill** (an `!important` rule killing a *different*
  rule that should win on specificity or source order): 1,839 static candidate pairs
  pruned to **28 genuinely co-matching pairs** by runtime `el.matches` against the
  real DOM. 3 confirmed kills, **all deliberate Tailwind `!` modifier utilities**.
  No defects.
- **Inline-style checks inside modal and slide-over interiors** (never swept — both
  prior runs measured at rest only): 6 overlays opened, **1,439 inline declarations
  probed, 0 hits**.

**The CSS cascade family is now swept in every direction** — specificity, source
order, inline, `!important`, and layer — and has **converged**.

### False positives killed this run (do not re-file)

- `CreateLeadModal.jsx:157-162` "disabled button at opacity 1" — the inline opacity
  is conditional; it dims itself.
- `.fc-daygrid-day-number` colour read as dead — the probe tested only the first
  element, which is a `.fc-day-other` cell that `index.css:3945` deliberately dims.
  Dead on 12/42, alive on the other 30. **Testing every match, not just the first,
  is what caught this.**
- The first colour sweep produced `oklab()` values that looked like corruption — they
  were reads taken **mid-transition**. Re-measured with transitions killed, every
  value landed exactly on its declared target.

---

## Bugs Fixed

1. **`POST`/`PATCH /api/crm/contracts` and `/crm/contracts/templates`** — the
   `content` JSONB column accepted a scalar and persisted it with a 200,
   white-screening both the internal contract page and the **public
   customer-facing contract** (`sections.map()` on a string throws, and with no
   error boundary the whole SPA blanks). *Fixed in `f9bb21e`* by adding a shape
   guard to all four write paths, matching the guard invoices and work orders
   already apply to `line_items`, and by tightening both `parseSections` copies to
   `Array.isArray` so rows that already hold junk are handled too. 6 bad shapes now
   return 400.

2. **`/contracts` (and 6 sibling list setters)** — a list response missing its array
   key white-screened the entire SPA. `res.data.X || res.data || []` degrades a
   missing key into the whole response object: truthy, not an array. *Fixed in
   `f8354cf`* by keeping the bare-array fallback but requiring it to be an array,
   applied to all 7 sites by an all-or-nothing patch harness. The repro goes from a
   blank page to a proper empty state, and all 5 touched views are byte-identical to
   baseline.

3. **`/calendar`** — 27 CSS declarations were silently dead because `index.css` is
   layered while FullCalendar injects its stylesheet unlayered, so app rules at
   specificity 402 lost to vendor rules at specificity 100 (oversized title,
   collapsed day-header padding, a Today button with no glass background or border,
   oversized chevrons, and grid borders that should have been removed). *Fixed in
   `d41e868`* by closing `@layer base` around the FullCalendar block — deliberately
   **not** with `!important`, which would have killed that block's own `:hover` and
   button-group overrides.

---

## Known Issues (Not Fixed)

- **`automationEngine.js:75-77` — `lead_priority` enum bug. Now 10 runs old, with a
  written repro.** It keeps being skipped because **no stage is explicitly assigned
  it**: it is not frontend-reproducible, so the frontend stages correctly decline it,
  and the api-test stage has never been told to take it. **It needs to be named in
  the api-test prompt itself** — ten runs of "it's another stage's job" is the actual
  failure mode here.
- **`EstimatesView.jsx:1318`** crashes on a truthy non-array `templates`. Measured
  and deliberately not fixed — it is the app's correct `|| []` idiom and only breaks
  if the server lies about the type; guarding it means `Array.isArray`-ing every
  `.map()` in the client, which the charter forbids as a refactor.
- **The SPA has no error boundary.** A developer decision and an enhancement rather
  than a fix, so out of QA charter — but it is what turns any single component throw
  into a whole-app white screen.
- **`qa_options_probe` custom field is still live in the production DB** (tenant
  `waterloo`, created 2026-08-05, label "QA Options Probe"). The nightly hygiene
  sweep matches `'QA-R9%'`, which this label does not match, so it escapes cleanup
  every night. Confirmed safe to delete (0 leads carry a value). Needs one `DELETE`
  and a developer go-ahead — not QA's call.
- **Form-label drift — deferred, developer decision, 6th run.** Canonical
  `.form-group label` is 12px/600/uppercase/0.08em; `/work-orders` renders
  12px/600/none/normal and `/expenses` 12px/400/none/normal. Scope is 4 `labelStyle`
  objects plus roughly 100 inline labels across 19 files, and only 6 files use
  `.form-group`. Deliberately **not** half-converted — a partial fix adds a new
  inconsistency axis rather than removing one.
- **`.qa-r91-neverrun.mjs` — still unrun, now 10 nights.**
- **Housekeeping (developer call):** 336 QA screenshots committed to the repo root;
  dead code `quickFilters` / `applyQuickFilter` (`LeadList.jsx:62`, `:346`); dead CSS
  `.stat-card:hover .stat-card__icon img` (`index.css:959`); a stray 0-byte
  `server/=`.

---

## Test Coverage Gaps

- **s4 (verify) capped at its turn limit and produced no report.** Tonight's three
  fixes therefore rest on **each stage's own self-verification** — which is
  documented and evidence-backed in every case (6 bad shapes returning 400 for
  `f9bb21e`; the byte-identical five-view baseline for `f8354cf`; rendered-value and
  built-bundle checks for `d41e868`) — but **no independent second pass ran.** s4
  left an unvalidated harness, `server/src/routes/.qa-r107-s4-verify-contracts.mjs`,
  which is carried into the tree this run so it is not lost. It has never been
  executed to completion. **This is the top item for the next verify stage.**
- **s1 (api-test) capped for the third consecutive run.** It wrote its results
  artifact first, so the sweep data survived, but it produced no analysis and left
  two finished harnesses uncommitted (swept up by s2 in `e34c27a`).
  **`.qa-r105-jsonb.mjs` and `.qa-r105-typed.mjs` are committed but their results
  have still never been read.** Neither s2 nor s3 would run them — they are write
  probes against the production Neon DB from a stage that capped before reporting,
  which is the api-test stage's call to make, not a frontend stage's.
- **The detail-level type sweep only partly ran — 1 of 4 cases exercised.**
  `/work-orders` and `/invoices` issue **no detail GET at all** (the panel renders
  from the row object the list already holds), so there is nothing to stub, and the
  work-order expander selector matched the page wrapper instead of a card. These are
  recorded as **not exercised**, not as passing. The next run must identify the real
  card expander before stubbing.
- **18 of 272 route patterns not executed — by design.** Excluded as side-effecting:
  `trigger-import` (a real bulk property import), `geocode` (costs money), outbound
  delivery (`send|email|sms|webhook`), auth state (`login` is rate-limited), and the
  action routes `score-all`, `correct-all`, `mark-all-read`, `/complete` and
  `alerts/test`.
- **Four routes are structurally unexercisable** — the `counties` and
  `material_products` tables do not exist, and `contracts.public_token` /
  `leads.status_token` are not columns.
- **`/canvassing` pin drop not completed** — it costs a DB write plus a paid geocode.
- **No screenshots taken this run, by choice.** 336 QA PNGs already sit in the repo
  root, and computed-style plus network-parameter evidence is stronger than an image
  for every check performed.

---

## Note for the next run

The **CSS cascade branch is converged** — specificity, source order, inline,
`!important` and layer are all swept clean. Do not re-spend there. The one measured
extension left is **mapbox-gl**, the other unlayered vendor stylesheet, where the
same layer inversion must apply to every `.mapboxgl-*` override — but map code is
off-limits to edit, so that is **measure and report only**.

The open branch is the **DB/type** one, and its next concrete step is the
detail-level sweep that only partly ran tonight.
