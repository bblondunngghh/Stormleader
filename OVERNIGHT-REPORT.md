# StormLeads — Overnight QA Report

**Run 71 · 2026-08-07 · 05:00–05:41 CDT**
Baseline `3f730af` (`pre-overnight-20260807`) → HEAD `e205240`

---

## QA Test Summary

| Metric | Count |
|---|---|
| Bugs found | 9 |
| Bugs fixed | 7 |
| Bugs found but not fixed | 2 |
| Commits | 7 (all `fix:`) |
| Pages render-swept | 16 routes (2,024 SVGs) |
| Pages interaction-tested | 5 of 19 |
| API routes in catalogue | 272 |
| API routes exercised this run | 11 (depth-first, not a breadth sweep) |
| JSONB columns mapped | 29 |
| JSONB columns given write guards | 5 this run (6 of 29 cumulative) |
| UI inconsistencies found | 14 glyph-in-icon-slot sites |
| UI inconsistencies fixed | 13 (1 category deferred, 5 sites) |
| Net DB rows written | 0 |
| Final build | exit 0, 8.08s |

**Headline:** the highest-severity finding was not a crash. `/dashboard` shipped a
three-control filter bar — period, rep, source — that was wired correctly on the client and
discarded entirely by the server. Clicking a filter highlighted the button, refetched, and
re-rendered byte-identical numbers, with no error and no console message. It had been
inert for as long as the filter bar has existed.

**Coverage caveat, stated up front:** all four upstream stages hit their turn caps again
(4-for-4, third consecutive run). Coverage is depth-first on JSONB by design; this run did
**not** repeat Run 70's 252-route breadth sweep. Sections below distinguish *tested and
passing* from *not tested* — those are not the same claim, and most of this app is the
second.

---

## Backend API Test Results

Route catalogue: **272** across 37 route files (`crm.js` 51, `properties.js` 18,
`estimates.js` 17, `financing.js` 13, `contracts.js` 13, `workOrders.js` 12, …).

Run 70's carry-forward directed this run at **JSONB columns** as the highest-value target,
on the finding that strongly-typed Postgres columns absorb bad shapes (cast failure → clean
400) while JSONB stores anything verbatim. That direction paid out: 3 of 4 API bugs this run
were JSONB shape defects.

| Category | Routes probed | Result | Fixed in |
|---|---|---|---|
| Estimates (JSONB write validation) | 2 (`POST /api/estimates`, `PATCH /api/estimates/:id`) | 12 of 13 hostile shapes now 400; 7 of 7 valid payloads still 200 | `ae946ab` |
| Materials (JSONB element deref) | 2 (`POST /api/materials/orders`, `POST /api/materials/estimate/:id/auto-order`) | 7 of 7 malformed shapes now 400, was 500 | `b65e8af` |
| CRM dashboard (filter plumbing) | 3 (`/crm/dashboard/stats`, `/crm/pipeline/metrics`, `/crm/dashboard/activity`) | filters now applied; 3 independent cross-checks reconcile | `3e23c9a` |
| Dashboard (control group) | 3 (`/api/dashboard/*`) | already correct — used as the reference implementation | — |
| Auth | 1 (`POST /api/auth/login`) | token mint OK | — |
| **Total exercised live** | **11** | **0 5xx after fixes** | |

### What was fixed

**`ae946ab` — estimates accepted any JSONB shape and stored it verbatim.**
`POST /api/estimates` and `PATCH /api/estimates/:id` validated `lead_id` and nothing else.
`estimateService:176` writes `line_items`, `financing_plan_ids`, `upgrades` and
`insurance_details` through a bare `JSON.stringify`. Verified: `{"upgrades":"notanarray"}`,
`{"financing_plan_ids":5}`, `{"insurance_details":"abc"}` all returned **200 and stored
unchanged** before the fix. Guards container type only; element sanitizing stays on the
client, which must remain defensive because a write guard cannot clean rows already stored.

**`b65e8af` — malformed JSONB items 500'd the materials order routes.**
Two deref sites guarding the *container* but not the *elements* — `Array.isArray(items)`
passes for `[null]`, then `items.reduce(... item.quantity ...)` throws. The auto-order route
used `estimate.line_items || []`, and `||` only covers falsy, so a truthy non-array reached a
`for..of`. Not fuzzing-only: `EST-082`/`EST-083` hold this shape in the live database.

**`3e23c9a` — the entire dashboard filter bar was silently ignored.**
The client was always correct; the three receiving routes called their services with
`req.tenantId` only and never read `req.query`. The filtering machinery already existed in
`routes/dashboard.js` (`extractFilters`) — but that is the *other* dashboard router, which
the UI does not call. The control that proved it: `date_from=2030-01-01` is a future date and
must match zero rows; before the fix it returned the complete unfiltered dataset.

Measured before → after (funnel total): no filter 31 → 31 (no regression),
`source=canvassing` 31 → 3, `source=manual` 31 → 17, `source=nonexistent` 31 → 0,
`date_from=2030` 31 → 0. Activity rows: 14 → 14 unfiltered, → 5 at 90d, → 0 at 30d.

Three independent cross-checks confirm the new numbers are *right*, not merely *different*:
source counts reconcile exactly with the dashboard's own "Revenue by Lead Source" panel
(a different endpoint) at 3 + 6 + 5 + 17 = 31; the 7d funnel (6 + 2 = 8) equals the
independently computed "New Leads (7d)" KPI; and 14 → 5 → 0 matches the real feed dates
(newest activity 6/7/2026, 61 days back — inside 90d, outside 30d).

Deliberately *not* date-filtered: the previous-period comparison (7–14d) and Speed to Lead
(30d) declare their own windows and their cards are labelled with them. Rep and source still
apply to both.

---

## Frontend Feature Test Results

Sixteen routes were render-swept. **Five were interaction-tested.** Both numbers matter — the
five that were driven produced six of the run's nine findings, so the other fourteen routes
are *unexercised*, not clean.

### `/estimates` — interaction-tested
- **Tested:** list render, Edit → builder hydration against deliberately malformed rows, drag-handle rendering, write-on-open regression check.
- **Broken → fixed:** clicking Edit unmounted the entire SPA — `TypeError: Cannot read properties of null (reading 'selected')`. Two sibling defects on the same hydration effect: `Array.isArray(estimate.upgrades)` guards the container but not the elements, and the row renderer does a bare `upg.selected` read *in the render body*, so one null element takes down the whole app rather than one panel. Second defect: `estimate?.financing_plan_ids || []` lets a truthy non-array through to `selectedPlanIds.includes(...)`. Fixed at the state boundary so every consumer is covered by one change (`f608588`).
- **Verified:** with the malformed row still in the database (`EST-083` = `upgrades [null]`, `financing_plan_ids {"a":1}`), `root.innerText` 0 → 1722, 0 page errors, Upgrades panel present.
- **Regression check:** confirmed the now-succeeding open does **not** write back — `updated_at` unchanged. Run 70's `8adf59e` write-on-open guard still holds. This check exists because of Run 70's lesson that fixing one bug can activate a latent one.

### `/dashboard` — interaction-tested
- **Tested:** filter bar (period / rep / source), Clear Filters, KPI cards, activity feed.
- **Broken → fixed:** every control inert (`3e23c9a`, above).
- **Verified in browser:** clicking "7 Days" moved the funnel New 22 → 6, Contacted 6 → 2, Appt Set 1 → 0, Inspected 1 → 0, Estimate Sent 1 → 0; activity 14 rows → 0; Pipeline Value $60K → $0. Screenshot `r71-dashboard-filter-7d-AFTER.png`. Console errors 0.
- **Correctly unchanged:** "New Leads (7d)" stays 8 — those 8 recent leads genuinely carry no `estimated_value`, which is why the filtered pipeline value is $0.

### `/leads` — interaction-tested
- **Tested:** list render, source pills, source filter dropdown.
- **Broken → fixed:** 16 of 31 leads had a `source` value that no filter could select (`d37dedd`). Live code writes `storm_map` and `fema_nsi` (`StormMap.jsx:1826`) and `canvassing` (`routes/canvassing.js:186`), none of which appeared in the `/leads` label map or the `/pipeline` filter options. DB ground truth: manual 27, fema_nsi 6, storm_map 5, canvassing 5 — while the two options that *were* listed (`storm_auto`, `door_knock`) matched **zero rows**. On `/leads` those 16 rows rendered a raw unstyled enum key; on `/pipeline` they were unreachable by filtering entirely.
- **Kept deliberately:** `storm_auto` / `door_knock` are `seed.js` values and matter for freshly seeded databases.

### `/reports` — interaction-tested
- **Tested:** sortable column headers, DeltaBadge trend indicators.
- **Broken → fixed:** four sortable `<th>` used text `▲`/`▼`; DeltaBadge used `→ ↑ ↓` (`208e298`). Now reuses `LeadList`'s exact post-`e29e005` style object (10×10, opacity 0.5, strokeWidth 2.5), matching `CustomSelect`'s chevron.
- **Verified:** glyph text nodes 1 → 0; clicking the "Activities" header renders exactly 1 chevron SVG in that `th` with no triangle text, so ASC/DESC still indicates.

### `/pipeline` — interaction-tested
- **Tested:** board render, task-count badges, source filter.
- **Broken → fixed:** task-count badges used `✓` as a text prefix in two places (`e205240`). Verified live: 0 glyph text nodes, 78 SVGs, 0 non-conforming.

### Render-depth only — not interaction-tested
`/`, `/calendar`, `/invoices`, `/work-orders`, `/materials`, `/contracts`, `/documents`,
`/territories`, `/subcontractors`, `/expenses`, `/drip`, `/settings`, `/admin`, `/map`.
These rendered without error and passed the SVG sweep. **No workflow on any of them was
driven.** Do not read this as passing.

---

## UI Consistency Audit Results

### Icons — 14 sites found, 13 fixed, 1 category deferred

This is Run 70's carry-forward #4 (*"sweep the SVGs, grep the source, AND read the rendered
DOM"*) paying out for the **third** consecutive run, and it surfaced a third distinct glyph
class. Each of the three methods missed something the others caught:

| Site | Glyph | Fixed as | Commit |
|---|---|---|---|
| `ReportsView.jsx:360` (4 `<th>`) | `▲` `▼` | ChevronUp/DownIcon | `208e298` |
| `ReportsView.jsx:528` DeltaBadge | `→ ↑ ↓` | Arrow Heroicons | `208e298` |
| `Dashboard.jsx:537` revenue-goal pill | `✓` `⚠` | Check/ExclamationIcon | `208e298` |
| `Dashboard.jsx:1332` stat-change pill | `↑` `↓` | Arrow Heroicons | `208e298` |
| `SettingsView.jsx:767` plan comparison | `▲` `▼` | Chevron Heroicons | `208e298` |
| `DripSequences.jsx:319/330` reorder | literal `↑` `↓` | Arrow Heroicons + `title` | `208e298` |
| `EstimatesView.jsx:1904/2112` drag handles | `&#x2807;` | `Bars3Icon` + `title` | `e205240` |
| `LeadDetail.jsx:656` score Refresh | `↻` | `ArrowPathIcon` | `e205240` |
| `LeadDetail.jsx:2703` street-view close | `✕` | `IconX` + `title` | `e205240` |
| `LeadDetail.jsx:2755` Google Maps link | `↗` | `ArrowTopRightOnSquareIcon` | `e205240` |
| `Pipeline.jsx:842/1280` task badges | `✓` | `CheckIcon` | `e205240` |

**Why three runs of icon audits kept missing these.** Run 70 established that an emoji is a
*text node*, invisible to `querySelectorAll('svg')`. This run found the rule generalises
further: the first source grep reused Run 70's **emoji** ranges and therefore could not see
U+2191 or U+25BC; the rendered-DOM sweep caught those. Re-grepping with arrow, geometric and
technical ranges — *and* the `\uXXXX` and `&#xXXXX;` escape forms — then found three sites the
DOM sweep could not reach, because they sit behind a Settings tab and a comparison state that
needs data to render. The two drag handles were U+2807 BRAILLE PATTERN DOTS-123 written as an
HTML entity: invisible to a literal-glyph grep, to the emoji ranges, and to the arrow ranges
alike.

**Accessibility side-effect:** four of these sites — the two drag handles, the two
`DripSequences` reorder buttons, and the street-view close button — were bordered `<button>`
elements whose only content was a text glyph. They had **no accessible name at all**. All now
carry `title`.

**Triaged as NOT defects** (verified, deliberately left alone): `CanvassingMode`'s 6 emoji are
dead data — the `emoji` key is never read, only `label` and `color`; `StormProperties.jsx` is
an orphan component with zero importers; `LeadDetail`'s `×` are multiplication signs in the
roof-cost formula; `Pipeline`'s hail/wind glyphs remain the documented deliberate exception.

**Final state:** `svgBad = 0` across all 16 routes — 2,024 SVGs, every non-recharts SVG
`viewBox="0 0 24 24" fill="none"`.

### Buttons, Toolbars/Headers, Sidebar/Nav, Forms, Spacing, Modals — NOT AUDITED

Stage 3 was chartered with seven audit categories and hit its 60-turn cap inside the first
one. **Categories 2–7 produced no findings because they were never run**, not because they
passed. This is the second consecutive run in which the icon audit consumed the entire UI
stage. Esc-to-close (0 of 4 modals in Run 69) remains unretested for a third run.

---

## Bugs Fixed

1. **`/estimates` (UI)** — A null element inside an estimate's `upgrades` white-screened the entire SPA on Edit — `Array.isArray` guards the container, not the elements, and the read happens in the render body. *Fixed:* sanitize at the state boundary; also hardened `financing_plan_ids || []` against truthy non-arrays. — `f608588`
2. **`POST`/`PATCH /api/estimates` (API)** — Accepted any JSONB shape for `line_items`, `upgrades`, `financing_plan_ids`, `insurance_details` and stored it verbatim with a 200. *Fixed:* container-type guards returning specific 400s; 12 of 13 hostile shapes rejected, 7 of 7 valid payloads unaffected. — `ae946ab`
3. **`POST /api/materials/orders` (API)** — `items: [null]` passed `Array.isArray` then threw in `.reduce` → 500. *Fixed:* per-element type check → 400. — `b65e8af`
4. **`POST /api/materials/estimate/:id/auto-order` (API)** — `line_items || []` let a truthy non-array reach `for..of` → 500 on real rows `EST-082`/`EST-083`. *Fixed:* array + element guard → 400. — `b65e8af`
5. **`/dashboard` (API)** — The entire filter bar (period, rep, source) was discarded server-side; three routes ignored `req.query` completely. *Fixed:* wired `extractFilters`-style handling into the three `/api/crm/*` routes the UI actually calls. — `3e23c9a`
6. **`/leads` + `/pipeline` (UI)** — 16 of 31 leads carried a source (`storm_map`, `fema_nsi`, `canvassing`) absent from both the label map and the filter options, while two listed options matched zero rows. *Fixed:* added the three real values, kept the two seed values. — `d37dedd`
7. **7 pages (UI)** — 13 glyph-in-icon-slot sites across `ReportsView`, `Dashboard`, `SettingsView`, `DripSequences`, `EstimatesView`, `LeadDetail`, `Pipeline`. *Fixed:* replaced with `@heroicons/react/24/outline` equivalents; added accessible names to 5 previously unnamed buttons. — `208e298`, `e205240`

---

## Known Issues (Not Fixed)

1. **`⚡` (U+26A1) survives in 5 icon slots — needs a design decision.**
   `LeadDetail.jsx:613` (lead-score button, `⚡ ${score}` / `⚡ Score`) and
   `LeadList.jsx:420-423` (four `CustomSelect` option labels — `⚡ 80+ Excellent` etc.).
   Found by this stage's verification sweep *after both s3 and s4 had declared the icon audit
   clean*. Left as one unit deliberately: the `LeadDetail` one is a mechanical swap, but the
   four `LeadList` entries are option-label **strings**, and giving them icons requires
   `CustomSelect` to render nodes in options — a component change, not a swap. Fixing half the
   category would leave the audit in a worse-documented state than leaving it whole.

2. **Duplicate `estimate_number` within a single tenant — needs a DB migration.**
   `EST-021`, `EST-022` and `EST-082` each exist twice under tenant `791bb51d`. There is no
   unique constraint on `(tenant_id, estimate_number)`. **Pre-existing, not caused by this
   run** — the duplicate `EST-082` rows were created 2026-05-26 and 2026-06-07. (`EST-001`
   appearing twice is legitimate: two different tenants.) A fix needs a renumbering decision
   for the existing collisions before the constraint can be added.

3. **`GET /api/properties/fema-live` 500 — external, not actionable.** NSI connect timeout.
   Carried from Run 70; unchanged.

4. **24 of 29 JSONB columns still have no write guard.** See gaps below.

5. **Chunk-size build warning** — `mapbox-gl` 1.70 MB, `index` 594 kB. Pre-existing and
   cosmetic; no action taken (would be an enhancement, outside the QA charter).

---

## Test Coverage Gaps

**1. JSONB write guards — 24 of 29 columns unguarded.** This run mapped all 29 and guarded 5
(`estimates` ×4, `material_orders.items`); `custom_field_definitions.options` was guarded in
Run 69. The highest-value remainder is **`invoices.line_items` (18 rows) and
`work_orders.line_items` (21 rows)** — structurally identical to `estimates.line_items`, which
produced three separate white-screens across Runs 69–71. Also unguarded and populated:
`contracts.content`, `contract_templates.content`, `leads.custom_fields`,
`leads.lead_score_factors`, `activities.metadata`, `tenants.branding`,
`financing_lenders.config`, `subscription_plans.features`. **This is the single
highest-value target for Run 72.**

**2. No breadth sweep this run.** Run 70 exercised 252 of 272 routes (92.6%). This run went
depth-first on JSONB per that run's carry-forward and exercised **11**. The 252-route result
is *not* re-verified against tonight's 4 server-side changes; `crm.js`, `estimates.js` and
`materials.js` all changed after it was measured.

**3. Interaction testing reached 5 of 19 routes.** Those 5 yielded 6 findings. The 14
render-only routes are unexercised, not clean.

**4. Six of seven UI audit categories never ran** (buttons, toolbars/headers, sidebar/nav,
forms, spacing, modals) — s3 capped inside category 1.

**5. Turn caps are the binding constraint — 4 of 4 stages capped, third consecutive run.**

| Stage | Outcome | Turns | Cost | API time |
|---|---|---|---|---|
| s1 api-test | MAX_TURNS | 51 / 50 | $4.12 | 7.7 min |
| s2 frontend-test | MAX_TURNS | 81 / 80 | $7.33 | 10.4 min |
| s3 ui-audit | MAX_TURNS | 61 / 60 | $5.23 | 7.7 min |
| s4 verify | MAX_TURNS | 41 / 40 | $3.27 | 5.6 min |
| **s1–s4** | **4 of 4 capped** | | **$19.95** | **31.3 min** |

Two stages ended with **verified fixes sitting uncommitted** in the working tree — s1's
materials guards (committed by s2 as `b65e8af`) and s4's six icon fixes (committed by this
stage as `e205240`). Work is being stranded at the cap boundary, not lost, but only because
each downstream stage has re-verified and adopted it.

**6. Results files were not written — for the third consecutive run.** None of
`/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, `/tmp/ui-audit-results.txt`
exists. The only file in temp is `stage-3-ui-audit.txt`, which is stage 3's **prompt**, not its
output. A reader trusting filenames or mtimes would report a prompt as a result. **All nine
findings in this report were reconstructed from commit messages, probe scripts, and live
re-verification.** Commit messages remain the pipeline's only reliable evidence channel.
*Suggested fix: have each stage write its results file first and append per finding, rather
than composing it at the end where the cap always lands.*

**7. Permanently excluded** (by standing project rules, not gaps): Google geocoding and all
bulk geocoding; bulk DB writes; FEMA map property loading, filtering, IndexedDB caching and
storm-swath intersection (developer-owned, changes get reverted); mobile/375px (web-only
focus).

---

## Database Hygiene

- **Net rows written this run: 0.** All API probes used rejection paths (every malformed
  payload 400s, so no row is created) or GETs.
- s4's badge probe tasks were deleted by its own cleanup script — `qa2026%` tasks remaining: **0**.
- `estimates` 84, `leads` 47, `material_orders` 3 — unchanged from Run 70.
- `EST-082` / `EST-083` malformed JSONB left in place **deliberately**, as in Run 70, so the
  client-side element guards stay exercised against real data rather than only fuzzing.
  `EST-083` was restored to its pre-probe state after the `ae946ab` guard testing.

---

## Verification

- Final build: `npx vite build` → **exit 0, 8.08s**.
- Live re-verification this stage (localhost:5173, title asserted "StormPipe — Roofing CRM"):
  `/pipeline` 0 glyph text nodes / 78 SVGs / 0 non-conforming; `/estimates` builder 0 glyph
  text nodes / 82 SVGs / 10 drag handles rendering as Heroicons; **0 console errors**.
- Server freshness confirmed by mtime-vs-boot, not commit time (Run 70's lesson):
  `crm.js` 05:16:10 < API PID 10992 boot 05:16:20.
- Drift baseline for Run 72: **`e205240`**.
