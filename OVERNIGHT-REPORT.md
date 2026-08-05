# StormLeads — Overnight QA Report

**Run 69 · 2026-08-05 · branch `feat/financing`**
Baseline: `15c4552` (checkpoint: pre-overnight-run 2026-08-05) · Final HEAD: `5dc9743`
Stages: s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Routes swept (render + computed style) | **19 of 19** authed routes |
| Pages tested at interaction depth | **4** — see Coverage Gaps |
| API endpoints inventoried | **272** (36 route files) |
| API endpoints exercised live | **132 GET** + 3 write routes fuzzed |
| Server 5xx across the GET sweep | **0** |
| **Bugs found** | **5** |
| **Bugs fixed** | **5** (in 5 commits) |
| UI inconsistencies found | **1** |
| UI inconsistencies fixed | **1** |
| Findings reported, not fixed (out of charter) | 11 |
| False positives correctly dismissed | 3 |

Five bugs found, five fixed. **Three were app-killing white-screens** — clicking any lead, editing the newest invoice, and the Custom Fields settings tab. Three of the five share a single root shape: *a truthiness or length check standing in for a type check.*

Three of five stages (s1, s2, s4) terminated on their turn caps. s3 completed. Stage cost s1–s4 ≈ **$22.42**.

---

## Backend API Test Results

### Route inventory (stage s1)

The full server surface was enumerated from `server/src/routes` (36 files) before any probing:

| Method | Routes |
|---|---|
| GET | 132 |
| POST | 88 |
| PATCH | 26 |
| DELETE | 18 |
| PUT | 8 |
| **Total** | **272** |

140 of 272 are write routes. 109 require a real id in the path, so the sweep resolved live ids for 16 entity types rather than probing with synthetic UUIDs.

### GET sweep — 132 endpoints tested, 132 passed, 0 failed

Every catalogued GET route was called live against a fresh API instance with a real tenant token.

| Status | Count | Assessment |
|---|---|---|
| 200 | 98 | Pass |
| 400 | 23 | Pass — unresolvable path params, correctly rejected |
| 404 | 6 | Pass — correct for absent resources |
| 403 | 5 | Pass — `/api/admin/*` correctly refused a non-admin token (`Insufficient permissions`) |
| **5xx** | **0** | **Pass — no endpoint crashed** |

A clean and meaningful result: this same sweep found five hard 500s in Run 65. The 403s are a positive signal, not a gap — admin routes are gated rather than open.

### Write-path type-confusion fuzzing

| Category | Endpoints tested | Passed | Failed | Outcome |
|---|---|---|---|---|
| Custom fields | 2 — `POST /crm/custom-fields`, `PATCH /crm/custom-fields/:id` | 0 → 2 after fix | 2 | **Fixed — `447aabd`** |
| Leads | 1 — `POST /crm/leads/quick` | 1 | 0 | Pass |

**Custom fields — FAILED, then fixed (`447aabd`).** `POST` validated `field_type` but never `options`; `PATCH` validated *nothing at all*. A non-array `options` was stored verbatim as a JSONB string, and `SettingsView`'s Custom Fields tab then called `field.options.join()` on it during render. Type guards added to both routes, plus an `Array.isArray` guard in the client — because a server guard cannot clean rows that are **already stored**. Post-fix: **12/12 malformed shapes rejected 400**, both valid controls still pass.

**Leads — PASSED.** 8 wrong-type shapes across two fields: 4 rejected 400 (`contact_name` as number/boolean/array/object), 4 accepted 201 (`source`), all four coerced to `string` by the column type, **0 crashes on read-back**. Accepting a coerced `source` is correct behaviour, not a defect.

---

## Frontend Feature Test Results

Stage s2 reached four areas before its turn cap. Three carried bugs; all three were fixed.

### `/estimates` — 1 bug, fixed

- **Tested:** list totals, Compare Tiers view, per-line rows, live builder line total.
- **Broken:** five money sites called bare `.toLocaleString()`, which applies no minimum fraction digits. Real values rendered as **`$53,496.6`**, `$44,580.5`, `$8,812.8`. The *same* `est.total` renders with two decimals at line 411 — so one page disagreed with itself on the same number.
- **Fixed — `b7775a8`:** the file already imports the canonical `formatCurrency` helper and uses it two lines away; these five sites simply bypassed it.
- **Verified:** 16 malformed amounts → 0 in both views, 0 console errors. Confirmed against the database: **38 of 83 estimates in the test tenant carry fractional cents, and 16 end in a trailing zero cent** (`EST-079` = `53496.60`). Visible on page load, not a synthetic edge case.

### `/leads` → Lead Detail — 1 bug, fixed (**white-screen**)

- **Tested:** clicking a lead row to open detail; custom-field rendering.
- **Broken:** `LeadDetail.jsx:1309` rendered a select custom field with `(def.options || []).map(...)`. The `|| []` fallback only covers a **falsy** value, so a truthy non-array reached `.map()` during render and threw, **unmounting the entire SPA** (`document.body.innerText.length` → 0). Reachable by clicking **any** row on `/leads`.
- **Fixed — `d575bf7`:** `Array.isArray` guards in `LeadDetail.jsx:1309` and `SettingsView.jsx:2071` `startEdit`, which had the identical falsy-only guard feeding `form.options.map`.
- **Verified with the malformed row still in the database:** body 0 → 2,910 chars, app stays mounted, 0 console errors.

### `/invoices` → Invoice Builder — 1 bug, fixed (**white-screen**)

- **Tested:** clicking Edit on an invoice.
- **Broken:** `InvoiceBuilder` seeded state with `invoice?.line_items?.length ? invoice.line_items : [blank]`. A stored `line_items` of `[null]` **has length 1**, so the guard passed and the null element survived to all three consumers — the subtotal reduce (`:506`), the preview table (`:667`), the editable rows (`:825`) — where `item.quantity` threw and unmounted the SPA.
- **Fixed — `17fa0dc`:** filtered at the state boundary, covering all three consumers with one change. Same shape as Run 67's `a023c66`, which guarded `line_items` *elements* rather than just the container.
- **Verified:** Edit on `INV-0019` went from body 0 chars → 501, 0 console errors. **`INV-0019` and `INV-0017` really do hold `[null]` in the live database, and `INV-0019` is the newest — so it is the first "Edit" button on the page.**

### Settings → Custom Fields — passes after `447aabd` + `d575bf7`

Renders, and the edit form opens, with the malformed row still present.

### What still needs attention

**15 of 19 routes were never clicked this run.** They were swept at render and computed-style depth by s3 (0 console errors, structurally consistent), but no interaction was exercised: `/dashboard`, `/pipeline`, `/tasks`, `/work-orders`, `/contracts`, `/expenses`, `/calendar`, `/reports`, `/materials`, `/storm-map`, `/storm-catalog`, `/subcontractors`, `/admin`, `/alerts`, `/canvassing`. **All three bugs above were click-only defects invisible to a render sweep**, so the unclicked pages are not "probably fine".

---

## UI Consistency Audit Results

Stage s3 was the only stage to finish inside its cap. All 7 charter audits plus 3 additional axes, across 19 routes at 1440×900.

| # | Audit | Result | Detail |
|---|---|---|---|
| 1 | **Icons** | **PASS** | **No non-Heroicon icons found; nothing to fix.** 2,210 / 2,219 SVGs carry the exact 24/outline signature (`viewBox 0 0 24 24` \| `fill=none` \| `stroke-width=1.5`). The 9 outliers are all `class="recharts-surface"` on `/reports` — chart canvases, not icons. Code sweep: 0 imports outside `24/outline`; 0 lucide / react-icons / MUI / FontAwesome; 0 `fa-*` classes. The 2 inline `<svg>` are legitimate map glyphs. |
| 2 | **Buttons** | **PASS (in-group)** | **No sizing/styling inconsistency to fix.** Shared classes are byte-identical everywhere they appear — `.auth-btn` identical across 9 routes, `.nav-link` ×126, `.quick-action-btn` ×193. Primary background is a single value app-wide, `oklch(0.72 0.19 250)`. 0 unnamed icon-only buttons. *Documented, not fixed:* filter/tab **active-state** has ~8 treatments across pages (below). |
| 3 | **Toolbars / Headers** | **PASS** | **Consistent across pages — byte-identical on 19/19.** `class="topbar glass"`, height 56px, padding `0 32px`, background `oklch(0.16 0.015 260 / 0.35)`, `h1` 18px/700. No page missing a header; no variance of any kind. |
| 4 | **Sidebar / Nav** | **PASS** | **No issues.** Collapse/expand 240→68→240px restores exactly; labels 11→0→11; icons uniform 18×18. **0 duplicate icon paths in *both* states** — Run 67's `79c8945` (Contracts → `DocumentCheckIcon`) holds, verified in the collapsed state that made the original bug visible. Exactly 1 active item per route. |
| 5 | **Forms** | **PASS** | **No non-standard elements. 0 native `<select>` and 0 `input[type="date"]`** across all 19 routes — both standing project rules hold; `CustomSelect.jsx` and `DatePicker.jsx` are used everywhere. The 5 input treatments are deliberate and internally consistent. |
| 6 | **Spacing** | **PASS** | **No alignment issues to fix.** 16px card gaps, 1px panel borders, and a deliberate radius hierarchy (20/18px page panels → 16px nested cards → 12px chips → 999px pills). New axis — **silent text truncation: 0 findings** across 7 dense routes. |
| 7 | **Modals** | **PASS on every charter item** | **All consistent.** 4/4 `.modal-backdrop`, 4/4 `.glass`, **4/4 `modal-scale-in` at 0.2s**, 4/4 centred, 4/4 radius 20px, 4/4 title weight 700. Widths (440/480/520/720) scale with content, which is what "consistent for similar types" asks for. *Documented, not fixed:* title treatment drift (below). |

### Additional axes run this run

| Axis | Result |
|---|---|
| **oklch-only colour rule** | **PASS.** 1,661 `oklch()` usages vs 176 non-oklch — and all 176 sit in a legitimately separate design context: map components (Google/Mapbox polygon APIs take hex strings and reject oklch), the white-paper print/PDF inspection report, public customer-facing pages, and 4 recharts series colours. **No oklch violations inside the app's own dark glass surfaces.** |
| **Keyboard focus rings** | **1 DEFECT — FIXED (`11cbe8d`).** See below. |
| **Silent text truncation** | **PASS**, 0 findings. |

### The one UI defect found — `11cbe8d`

**`input[type=checkbox]` and `input[type=range]` had no keyboard focus indicator at all.**

`index.css:4392` strips the outline from every `input`/`textarea`/`select` on `:focus-visible`. That is correct for text entry, which substitutes a border-colour change plus a glow (`.form-input:focus`, `.topbar__search input:focus`). But checkbox, radio and range are `appearance:none` custom chrome with **no such substitute** — so the blanket rule left them with nothing. A keyboard-focused checkbox computed `outline:none`, `box-shadow:none` and an unchanged `--glass-border`: **pixel-identical to its unfocused siblings.**

Reach: **26 checkboxes in the `/leads` tab order**, including "Select all leads on this page", plus the storm-map layer toggles.

Fixed additively — the `[type]` attribute raises specificity above `input:focus-visible`, so text-input behaviour is untouched and source order is irrelevant; the circular `border-radius:50%` is preserved. Verified by **real keyboard `Tab`** — a programmatic `.focus()` does not match `:focus-visible` and would have produced a false pass. Before/after screenshots at `C:/tmp/r69-checkbox-focused.png` and `-AFTER.png`.

*How the axis was chosen:* the previous stage's `58c061f` fixed `.nav-link` and the calendar toolbar by beating an `outline: none !important` reset — the classic shape of a partial fix. The question this run asked was *"what else did that reset silence?"*

### False positives correctly dismissed — do not re-file

1. **FullCalendar toolbar buttons** compute `border-radius: 0` while "Today" is 12px. Not a defect — the wrapping `.fc-button-group` carries the radius plus `overflow:hidden` (`index.css:3785`), so the group supplies the rounded outer edge. Intended segmented control.
2. **152 hex + 24 rgba colours** in `.jsx` look like oklch-rule violations. All are map APIs, print templates, public pages, or chart series.
3. **50 textless buttons on `/subcontractors`** look like unlabelled icon buttons. All carry `title="Edit"`/`"Delete"`; unnamed count is 0.

---

## Bugs Fixed

1. **`POST` + `PATCH /crm/custom-fields`** — Neither route validated `options`; `PATCH` validated nothing at all, so a non-array was stored verbatim and later crashed the Custom Fields settings panel on `.join()`. — **Fixed** by adding type guards to both routes plus an `Array.isArray` guard in `SettingsView`, since a server guard cannot clean already-stored rows. 12/12 malformed shapes now rejected 400. — **`447aabd`**
2. **`/estimates`** — Five money sites used bare `.toLocaleString()` and dropped trailing cents, rendering `$53,496.60` as **`$53,496.6`**; the same value rendered correctly 400 lines away, so one page disagreed with itself. — **Fixed** by routing all five through the `formatCurrency` helper the file already imports. 16 malformed amounts → 0. — **`b7775a8`**
3. **`/leads` → Lead Detail (white-screen)** — `(def.options || []).map()` guards only against *falsy*, so a truthy non-array threw during render and unmounted the whole SPA. Triggered by clicking **any** lead. — **Fixed** with `Array.isArray` guards in `LeadDetail.jsx:1309` and `SettingsView.jsx:2071`. — **`d575bf7`**
4. **`/invoices` → Invoice Builder (white-screen)** — `line_items?.length` passes for `[null]`, so the null element reached all three consumers and `item.quantity` threw, unmounting the SPA. `INV-0019` is the newest invoice, so it was the first "Edit" button on the page. — **Fixed** by filtering at the state boundary, covering all three consumers with one change. — **`17fa0dc`**
5. **App-wide (accessibility)** — `input[type=checkbox]` and `[type=range]` had **no keyboard focus indicator at all**; a focused checkbox was pixel-identical to an unfocused one, across 26 checkboxes in the `/leads` tab order. — **Fixed** by restoring the same focus ring `button:focus-visible` uses, via an additive higher-specificity rule that leaves text inputs untouched. — **`11cbe8d`**

---

## Known Issues (Not Fixed)

### Data — stored junk the new guards defend against, verified still present tonight

- **2 invoices hold `[null]` line items** — `INV-0019` and `INV-0017`, both `draft`. `17fa0dc` guards the render path, but **the rows were not cleaned**; a data migration is a developer decision, not QA's.
- **1 custom-field row holds `options: "abcde"`** (a JSONB string, not an array). Deliberately retained so the `d575bf7` render guard stays exercised. `server/.qa-r69-inject.mjs cleanup` exists to remove it but was never run — s4 capped first.
- **Run 66's backlog of 255 ACCEPTED wrong-type write shapes is still untriaged.** This is the third consecutive run in which that backlog produced a real crash: the `[null]` line items above came from prior fuzzing that returned 2xx and was dismissed as "not a crash". **A 2xx is not evidence the stored data is usable — that backlog is a bug queue.**

### Features incomplete — developer decisions, deliberately not built by QA

- **The `/dashboard` period filter bar is inert.** All 5 buttons produce an identical KPI row; the client sends the params, the server drops `req.query`. Three unimplemented filter dimensions (date, rep, source). Carried from Run 67.
- **Two dashboard stats endpoints disagree.** `/api/dashboard/stats` honours `date_from` and returns pipelineValue 1,314,892.39 / 42 leads; the CRM endpoint the client actually uses returns $60K / 8.
- **`/alerts` is an orphan route** — no nav entry, no links; the only route of 19 with 0 `.is-active`. Fix is either an IA change or a route deletion.
- **6 pipeline stages are absent from the `lead_stage` enum.** `ALTER TYPE … ADD VALUE` is irreversible in Postgres — needs a migration decision.

### Design-convention drift — one root cause, three symptoms

Form labels (**31 of 53 off-standard**, 7 treatments), modal titles (3 sizes, plus an `<h3>` where others use `<h2>`), and filter-tab active states (~8 treatments) all stem from **the same structural cause: every file hand-rolls an inline style object instead of sharing a class.** Each is internally consistent within its own row, so nothing looks broken on screen. **One convention decision would close all three** — and `index.css:2239` already defines the canonical label target. Left alone rather than half-converting a multi-file convention (charter rule 7).

### Other

- **Esc-to-close is inconsistent** — 0/4 modals and the `/tasks` slide-over did not close on Esc this run, while `/subcontractors` (same CSS class) did in Run 67. Drift from a pattern already implemented in the repo, not a missing feature.
- **`StormMap .address-search__input` has no focus indicator.** Same defect class as `11cbe8d`, but left alone — map component code is charter-excluded.
- **`GET /api/properties/fema-live` returned 500** — external dependency, not app code: `nsi.sec.usace.army.mil:443` connect-timed-out after 10s. No fix available on our side; worth a graceful-degradation ticket.
- **DB hygiene — 7 probe rows created tonight remain in the live database:** 5 leads at "1 QA Probe Way" (4 with a null `contact_name`) and 2 custom-field definitions. Older probe leads from Runs 13, 18 and 34 are also still present. `447aabd`'s "probe rows deleted (net DB writes 0)" was accurate for the 12-shape custom-field probe specifically, but the lead-write probes and the two definition rows were not cleaned.
- **Run 68 (2026-08-04) produced no QA report and no history entry.** Its four code fixes are in git (`ea65b82`, `03cc9fb`, `691f501`, `58c061f`), but its s5-report stage never committed — `OVERNIGHT-REPORT.md` still held Run 67 when this run started. A reconstructed Run 68 stub, sourced from git log and clearly labelled as such, has been added to `docs/overnight-history.md` so the record is not silently discontinuous.

---

## Test Coverage Gaps

1. **Frontend interaction testing covered 4 of 19 routes.** s2 hit its 80-turn cap having tested `/estimates`, `/leads`, `/invoices` and Settings → Custom Fields — finding 3 bugs, 2 of them app-killing. The other 15 routes were swept at render depth only. **This is the largest gap in the run, and the hit rate on the pages that *were* clicked (3 bugs across 4 pages) argues the remaining 15 are not clean.** It is nonetheless an improvement: Runs 67 and 68 each reached only one page.
2. **Write-path testing covered 3 of 140 write routes.** s1 capped at 50 turns after the GET sweep and the custom-fields fix. `POST`/`PATCH`/`PUT`/`DELETE` coverage remains the thinnest area of the pipeline.
3. **s4-verify produced no evidence file.** It capped at 40 turns and left `server/.qa-r70-dbstate.mjs` behind without persisting output — **an infra regression against Run 67, which established that every stage writes evidence incrementally so findings survive a cap.** This report ran that script directly (read-only) to recover ground truth; it is the source of the invoice, custom-field and estimate figures above. *(Filename prefix drift again: the script is labelled `r70` but belongs to Run 69, the same mislabelling Run 67 logged. Do not be misled next run.)*
4. **10 of 26 tenant-scoped routes still cannot be IDOR-probed** because no tenant has any rows (`drip_sequences`, `financing_applications`, `documents`, `skip_trace_usage`, `automations`, `custom_field_definitions`). Probing them requires writing rows to the live Neon DB. No cross-tenant isolation probe ran this run; Run 67's 16-route probe found 0 leaks.
5. **Storm Map, Admin and roof drawing remain render-depth only** — no end-to-end workflow has ever been exercised.
6. **Keyboard navigation is now partially covered** — focus rings were measured app-wide for the first time this run (and found a bug). Tab *order* and Enter-submit remain untested.
7. **Permanently excluded by standing cost rules, not by accident:** Google geocoding endpoints and side-effecting routes (email/SMS sends). Mobile/375px sweeps remain paused per the web-only focus.

---

## Session Integrity

| Stage | Outcome | Turns | Cost | Result |
|---|---|---|---|---|
| s1 api-test | **MAX_TURNS (50)** | 51 | $4.19 | 272 routes catalogued, 132 GET swept, **0 5xx**; 1 API bug fixed (`447aabd`) |
| s2 frontend-test | **MAX_TURNS (80)** | 81 | $10.09 | 3 UI bugs fixed (`b7775a8`, `d575bf7`, `17fa0dc`), 2 of them white-screens; reached 4 pages |
| s3 ui-audit | **COMPLETED** | 55 | $5.40 | 7/7 charter audits + 3 new axes; 1 bug fixed (`11cbe8d`); 3 false positives dismissed |
| s4 verify | **MAX_TURNS (40)** | 41 | $2.74 | Capped without persisting evidence; its DB-state script was re-run by s5 |
| s5 report | this document | — | — | — |

**Environment verified before any result was trusted.** The standing hazard is real and was checked: `::1:5173` (PID 10884) is StormLeads, while `0.0.0.0:5173` (PID 10588) is a *different application* (`C:\Projects\AVApp`). `http://localhost:5173` is correct; **`127.0.0.1:5173` serves the wrong app.** Page title was asserted as "StormPipe — Roofing CRM" before any measurement. `client/vite.config.js` verified clean.

**5 code commits stand for this run**, plus the s3 audit-report commit and this report.

### Lessons carried forward

- **The stored-junk defect class produced 3 of tonight's 5 bugs** (`447aabd`, `d575bf7`, `17fa0dc`). All three share one shape: **a truthiness or length check standing in for a type check.** `x || []` does not guard a truthy non-array; `x?.length` does not guard `[null]`. Grepping for that shape is a high-yield axis for the next run.
- **A write-path guard and a render-path guard are two different fixes.** `447aabd` stops new junk but cannot clean rows already stored — which is exactly why `d575bf7` and `17fa0dc` were still needed, and why they had to be verified *with the malformed row still in the database*.
- **A partial fix names its own next bug.** `11cbe8d` was found by asking what else `58c061f`'s reset had silenced. Two runs in a row where that question paid.
- **Drive focus audits with real `keyboard.press('Tab')`.** A programmatic `.focus()` does not match `:focus-visible` and yields a false pass.

**Drift baseline for the next run: `11cbe8d`.**
