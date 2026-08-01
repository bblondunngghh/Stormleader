# StormLeads — Overnight QA Report

**Run 65 · 2026-08-01 · branch `feat/financing`**
Baseline: `d31a3db` (Run 64 HEAD) · Checkpoint: `7177fdd` · Final HEAD: `7783290`
Stages: s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages / routes tested at interaction depth | 7 |
| API endpoints inventoried | 272 (36 route modules) |
| API endpoints exercised this run | 263 unauthenticated · 109 `:id` scope-swept · 92 GET fuzzed |
| Total API requests issued | ~2,210 |
| Bugs found | **8** |
| Bugs fixed | **6** |
| Bugs found but NOT fixed | **2 classes** (10 reproducible endpoint+param combinations) |
| UI inconsistencies found | 2 |
| UI inconsistencies fixed | 2 |
| Code commits | 5 |
| Final build | **exit 0, 7.97s, 0 errors** |

This run broke the pattern of prior "converged" runs by testing **four axes the backend had never been swept on** — auth enforcement, tenant isolation, query-param fuzzing, and type confusion — rather than re-running the existing 272-route harnesses, which had not drifted. Three of the four axes completed; the fourth was lost to a turn cap. The two highest-severity findings of the run, a cross-tenant PII leak and two hard 500s, came directly from the new axes.

---

## Backend API Test Results

The five `.qa-*.mjs` harnesses from Run 63 (272 routes, 429 checks) were **deliberately not re-run**: the drift gate against `d31a3db` showed **zero changes under `server/src/routes`**, so repeating them would have been pure repetition. Coverage was spent on untested axes instead.

### Axis A — Auth enforcement (new axis) — PASS

263 non-public routes hit with **no** `Authorization` header.

| Result | Count |
|---|---|
| Correct 401 / 403 | 254 |
| Unauthenticated 2xx (leak) | **0** |
| 5xx crashes | **0** |
| Intentionally public (skipped) | 9 |

All 9 non-401 responses are deliberately public surfaces, and each **validated input rather than leaking data**: contract public view/sign, financing public plans/applications/apply, public lead status, tenant onboarding, Stripe intent creation, and the Stripe webhook. No route is missing `authenticate`. **0 bugs.**

### Axis B — Tenant isolation (new axis) — 1 BUG FOUND + FIXED

Runtime cross-tenant probes with a valid tenant-A token (5 tenants in DB): estimate `GET`, estimate `/pdf`, and user `GET` all correctly returned 404; the platform-admin route correctly returned 403.

Static exhaustive sweep of **all 109 `:id` routes**:

| Scoping | Count |
|---|---|
| Scoped by `req.tenantId` | 82 |
| Scoped by `req.user.id` (from JWT) | 1 — notifications `PATCH /:id/read`, verified correct |
| Public / global by design | 24 — NOAA, FEMA, census, platform-admin |
| **Unscoped** | 2 — one benign, one real bug |

- `GET /api/materials/products/:id` — unscoped, but serves a **static in-memory `MOCK_PRODUCTS` catalog**, global by design. Not a bug.
- `GET /api/skip-trace/job/:jobId` — **real cross-tenant PII leak.** Fixed, `df5d1ce`.

### Axis C — Query-param fuzzing (new axis) — 10 HARD 500s FOUND, **NOT FIXED**

92 GET routes × 21 hostile values = **1,932 requests**.

| Result | Count |
|---|---|
| 5xx / connection error | **10** |
| SQL-injection payloads that reached the DB | **0** |

Positive result worth recording: `sort=id;DROP TABLE leads--` and `status=' OR 1=1--` both return **200 with correct data** — parameterized queries hold everywhere. Non-numeric pagination (`limit=abc`) correctly returns 400 on `/api/leads`. Oversized and zero values (`limit=99999999999`, `limit=0`) return 200.

The 10 failures are **unvalidated negative pagination and a null byte reaching PostgreSQL**. They were found by s1 minutes before it hit its turn cap; the raw JSON was written but the finding was never triaged or fixed. **Re-verified live at report time against `:3001` — all 10 reproduce identically (1,932 requests, 10 5xx, matching s1's isolated run exactly).** See *Known Issues*.

### Axis D — Type confusion in write bodies — **NOT RUN**

Planned but never executed; s1 exhausted its turn cap after Axis C. See *Test Coverage Gaps*.

### Bonus finds — 2 HARD 500s FOUND + FIXED

Not from a planned axis. `UPDATE ... ORDER BY ... LIMIT` is **MySQL syntax**; PostgreSQL rejects it with SQLSTATE `42601`. Verified live, not assumed. A codebase-wide multiline scan found exactly these two instances and no others. Fixed, `9c6eb2f`.

### Endpoint category summary

| Category | Endpoints touched | Passed | Failed | Fixed |
|---|---|---|---|---|
| Auth / onboarding | 263 (no-token sweep) | 263 | 0 | — |
| Skip-trace | 5 | 2 | 3 | `df5d1ce`, `9c6eb2f` |
| CRM (leads, dashboard, subcontractors) | 92 GET fuzzed | 89 | 3 | **none — open** |
| Leads (public API) | fuzzed | — | 3 | **none — open** |
| Materials | fuzzed | — | 2 | **none — open** |
| Contracts / financing / payments (public) | 9 | 9 | 0 | — |
| Tenant-scoped `:id` routes | 109 | 108 | 1 | `df5d1ce` |

---

## Frontend Feature Test Results

### Settings → Contracts — 1 BUG FOUND + FIXED

The drift gate flagged `SettingsView.jsx` as the one changed client file (checkpoint `7177fdd` renamed `template_type` → `type`), making this tab a priority target.

- **Tested:** clone a built-in template, edit the copy, change Type, save, verify in list, delete.
- **Broken:** the Type dropdown rendered `—` for every real template. `typeOptions` declared six values (`roofing_agreement`, `subcontractor`, `work_authorization`, `insurance_aob`, `warranty`, `custom`) with **zero overlap** with the actual `contract_templates.type` domain (`standard`, `insurance`, `financing`, `supplement`, per migration 037). `CustomSelect.jsx:10` falls back to `'-'` when no option matches its bound value, so the select could not display its own value. The six unused values appear nowhere else in the repo.
- **Impact:** every clone of a built-in — the primary creation path — opened Edit with a blank Type.
- **Fixed:** `5195d84` — added the four real domain values first, kept the existing six so no capability is removed.
- **Verified live:** Type renders "Supplement"; all 10 options render in the portal; changed to Standard → saved → list shows `standard`. Full clone/edit/save/delete round trip passes. QA clone row deleted, no DB residue.
- **Note:** this confirms the developer's `template_type` → `type` rename is coherent with the backend. `contracts.template_type` is a *different* column — do not conflate. Built-ins correctly expose Clone only (no Edit/Delete), matching the `is_default = FALSE` service guard.

### Storm Archive — 1 UI BUG FOUND + FIXED

- **Tested:** time-range filter pills at interaction depth (first walk of this route beyond render).
- **Broken:** the active pill measured 36px while the five inactive pills measured 29px, and the bulge **moved as you clicked** — the row visibly reflowed on every filter change.
- **Fixed:** `5b52fb7`. Root cause under *UI Consistency Audit*.
- **Verified:** 6/6 pills at 36px, uniform across clicks.

### Calendar — 1 UI BUG FOUND + FIXED

- **Tested:** toolbar rendering at computed-style depth.
- **Broken:** all 7 `.fc-toolbar` buttons rendered in FullCalendar's raw defaults (14px / 400 / 5.6px 9.1px / no capitalize) instead of the design-system values the stylesheet already declared.
- **Fixed:** `7783290`. Root cause under *UI Consistency Audit*.
- **Verified:** 7/7 at 13px / 600 / capitalize; labels 8px 16px; arrows 8px 10px; height spread narrowed 1.7px → 0.7px.

### Materials + cart — PASS

Header 56px "topbar glass", correct `h1`, 16px main gap, 0 native select/date. Cart drawer opened at interaction depth: backdrop `oklch(0 0 0 / 0.6)` (Run 61's fix still holding), `position: fixed`, `z-index: 1000`, `justify: flex-end`, `modal-backdrop-in` animation; panel `.glass` 420px, `modal-scale-in`, radius `20px 0 0 20px` (drawer → left corners only, correct). One close button.

### Canvassing — PASS

Header 56px, correct `h1`, `main-content` padding 0 + radius 20px/18px (intentional full-bleed map, `CanvassingMode.jsx:258`), 0 native select/date, 0 non-Heroicon SVGs. Only `gm-control-active` present — Google Maps chrome, developer-owned.

### Storm Map — PASS

Header 56px, correct `h1`, 0 native select/date, 0 console errors. `map-controls__dropdown-trigger` 38px, `map-legend__info-btn` 18px, `gm-control-active` 40px — each class internally consistent. Confirmed the Storm Archive pill defect is **not** replicated here (0 toggle pills on this route). FEMA/map logic untouched per charter.

### Admin — GATED, known non-bug

Header 56px, correct `h1`, 0 native select/date. Body reads "Failed to load overview data." with 2 console errors — this is the **documented platform-admin-only 403 gate** on `/api/admin/overview`, not a defect. Content cannot be audited from a tenant account. Four tab buttons render classless at 32px; not filed, since the page is gated and Run 64 already ruled `AdminDashboard`'s bare `main-content` default out of scope.

### Still needs attention

Browser back/forward navigation remains untested — **five consecutive runs**. Storm Map, Canvassing and Admin were walked at render + computed-style depth this run, but their *workflows* (drawing a roof, dropping and editing a canvass pin, running a storm search end to end) have still never been exercised.

---

## UI Consistency Audit Results

Both finds share a theme worth carrying forward: **a styling rule that silently does not apply.** Neither is visible by reading the JSX — both required measuring computed style on a live page. A grep-level audit would have passed both.

### Icons — PASS
37 outline import sites, 0 non-outline variants, 0 foreign icon libraries, 2 permitted map SVGs (Google Maps chrome). No changes.

### Buttons — 2 FOUND, 2 FIXED

**1. Storm Archive filter pills changed height on click** — `StormCatalog.jsx:204` + `:216`, fixed `5b52fb7`.

Root cause: the className swaps `auth-btn` (active) ↔ `quick-action-btn` (inactive). `.auth-btn` (`index.css:2373`) fixes `height: 36px` with no border; `.quick-action-btn` (`index.css:1797`) has **no height** and sizes from padding + 1px borders. Both pills carry the same inline `{fontSize: 12, padding: '6px 14px'}` — but on `.auth-btn` the 6px vertical padding is **inert**, which is itself the proof of drift, yielding 36px, while `quick-action-btn` computes 6+6+15+2 = 29px.

Measured live: 24 Hours / 3 Days / 7 Days / 14 Days / Custom = 29px @ top 180.5; 30 Days (active) = 36px @ top 177. Clicking "7 Days" moved the 36px bulge to it and dropped 30 Days to 29px.

36px is the correct target, not 29px: in the same flex row, both DatePicker wrappers and the `.form-input` measure 36px, and 36px is the app-wide standard control height (`.auth-btn`, `.form-input`, DatePicker), re-verified by Run 64. In-repo precedent for the fix exists at 4 sites (`LeadList.jsx:416`, `:420`, `TasksView.jsx:531`, `:622`). Two lines, no restructuring; horizontal padding and font size retained for deliberate pill compactness.

*Deliberately untouched:* `quick-action-btn` carries per-context inline padding at ~100 sites app-wide (3 heights across 139 instances on Materials alone). That is the accepted norm for this utility class and normalizing it is a refactor. This find is different **in kind** — one control changing its own size on click, not padding varying between contexts.

**2. Calendar toolbar rendered in FullCalendar's default typography** — `index.css:3741` + `:3811`, fixed `7783290`.

Root cause — **CSS cascade layers, a new class of bug for this audit.** `index.css:1` declares `@layer theme, base, utilities;` and line 6 wraps the entire app stylesheet in `@layer base`. FullCalendar v6 **self-injects its stylesheet unlayered**, and unlayered normal declarations beat *every* layered declaration regardless of specificity — so FC's `.fc .fc-button` (specificity 0,2,0) silently beat the app's `.calendar-view .fc .fc-button` (0,3,0). Confirmed by enumerating `document.styleSheets`: the app rule matched but lost.

Proof the author had already hit this: in the same rule block, `border-radius`, `box-shadow` and `outline` are marked `!important` and those three **did** apply — because for `!important` the layer order reverses. Only the non-important properties died. This is dead CSS, not a design question; the intent was already written in the file.

The `!important` on the prev/next block is **required**, not incidental: without it the arrows' intentionally tighter `8px 10px` would be clobbered by the general rule's now-`!important` 16px.

*Deliberately not touched:* background / border-color on these buttons (Today renders transparent vs the declared glass fill). Same layer cause, but changing fills interacts with hover/active/group rules that already work, and is a colour-treatment call — the developer's, per Run 61/64 precedent.

**Vendor-CSS generalization sweep** (root cause pushed app-wide): only two vendor CSS sources exist — FullCalendar (self-injected, fixed) and `mapbox-gl.css` (imported in `Dashboard.jsx:5`, `RoofDrawingTool.jsx:4`). The Mapbox overrides at `index.css:1190-1200` **already** use `!important` on every competing property, so the author had solved it there. FullCalendar was the genuine outlier. **No further vendor-CSS defects.**

### Toolbars / Headers — PASS
56px "topbar glass" with correct `h1` on all 6 gap routes.

### Sidebar / Nav — PASS
12 nav-links + 3 group headers, uniform 42px rows, exactly 1 `is-active`.

### Forms — PASS
0 native `<select>` and 0 native date inputs app-wide, confirmed in code **and** live on all 6 routes. `CustomSelect` / `DatePicker` conventions hold.

### Spacing — PASS
List views at 16px; map/catalog views on documented defaults.

### Modals — PASS
Materials cart drawer verified at interaction depth (see Frontend section). No new modal deviations.

---

## Bugs Fixed

1. **`GET /api/skip-trace/job/:jobId` — cross-tenant PII leak (SECURITY, highest severity this run).** The route passed `req.params.jobId` straight to Tracerfy using a single **shared** `TRACERFY_API_KEY`, so all tenants' jobs live in one upstream account and any authenticated user of any tenant could read another tenant's skip-trace results — owner name, phone numbers, email — by supplying a job id. Masked in this environment because `TRACERFY_API_KEY` is unset, so a 503 fired before the proxy; **with a key configured in production it would have served the other tenant's data.** — **Fixed `df5d1ce`:** ownership gate matching the codebase's own idiom (`workOrders.js` verifies the parent work order before touching milestones) — check `job_id` + `tenant_id` against `skip_trace_usage` (the table `POST /api/skip-trace` already writes `job_id` into), 404 if not owned.

2. **`POST /api/skip-trace` (`routes/skipTrace.js:120`) — hard 500.** `UPDATE ... ORDER BY ... LIMIT` is MySQL syntax; PostgreSQL rejects it with SQLSTATE `42601`. The throw happens **after** the batch is submitted upstream, so `job_id` is never recorded and the run becomes unbillable and untrackable. — **Fixed `9c6eb2f`:** rewritten as `WHERE id = (SELECT id ... ORDER BY created_at DESC LIMIT 1)` — standard Postgres, identical "newest matching row only" semantics.

3. **`processSkipTraceResults()` (`services/skipTraceService.js:182`) — hard 500 on the Tracerfy webhook.** Same MySQL-only syntax. The throw happens **after** leads are already updated, so `records_returned` is never written and the webhook 500s. — **Fixed `9c6eb2f`:** same rewrite.

4. **Settings → Contracts → Edit Template — Type dropdown could not display any real template type.** `typeOptions` had zero overlap with the actual `contract_templates.type` domain, so `CustomSelect` fell back to `—` for every template. — **Fixed `5195d84`:** added the four real domain values, kept the existing six.

5. **Storm Archive filter pills — control changed its own size on click** (36px active vs 29px inactive; the bulge moved and the row reflowed on every filter click). — **Fixed `5b52fb7`:** added `height: 36` to both pill inline styles, matching the app-wide 36px control height and the 4-site in-repo precedent.

6. **Calendar toolbar buttons — rendered in FullCalendar's default typography** because the app's rule sits in `@layer base` while FullCalendar self-injects unlayered CSS that outranks it. — **Fixed `7783290`:** `!important` on `font-size`, `font-weight`, `padding`, `text-transform` in the `:3741` block and on `padding` in the `:3811` prev/next block.

---

## Known Issues (Not Fixed)

### NEW — open defect, found this run

**Negative pagination and null bytes reach PostgreSQL unvalidated → 10 hard 500s across 5 route files.** Found by Axis C fuzzing; s1 hit its turn cap immediately after writing the raw JSON, so the finding was never triaged or fixed. **Re-verified live at report time — all 10 reproduce.**

| Endpoint | Param | Route file |
|---|---|---|
| `GET /api/leads` | `limit=-1`, `offset=-5`, `stage=\0null` | `leads.js` |
| `GET /api/crm/leads` | `stage=\0null` | `crm.js` |
| `GET /api/crm/dashboard/properties-affected/list` | `limit=-1`, `offset=-5` | `crm.js` |
| `GET /api/crm/subcontractors` | `limit=-1`, `offset=-5` | `subcontractors.js` |
| `GET /api/materials/orders` | `limit=-1`, `offset=-5` | `materials.js` |

Root cause confirmed from the server log: PostgreSQL raises `OFFSET must not be negative` / `LIMIT must not be negative` (SQLSTATE `2201X`, `nodeLimit.c` / `recompute_limits`). Negative values parse as valid integers, so the existing non-numeric guard — which correctly 400s `limit=abc` on `/api/leads` — lets them through to the DB. Validation coverage is also **inconsistent across files**: `/api/materials/orders?offset=abc` raises `invalid input syntax for type bigint: "NaN"` where `/api/leads?offset=abc` correctly returns 400.

**Severity: low-to-moderate.** No client code sends negative pagination, so this is not reachable through the UI; it is unvalidated-input hardening on a public-facing API, and it produces genuine unhandled 500s with DB errors in the logs. **Not fixed because the s5 charter is reporting only.** The fix is small and mechanical — clamp `limit`/`offset` to non-negative integers and strip null bytes — but it touches 5 route files and should be done as its own change with its own verification. The harness (`server/.qa-r65-fuzz.mjs`) is read-only and re-runnable against any base URL via `QA_BASE`.

### Environment finding — action required from the developer

**The API server on `:3001` is serving pre-fix code.** It runs as `node server/src/index.js` with **no watcher**; process start times are 7/30 05:47 and 7/31 04:00, both of which predate today's API fixes (`9c6eb2f` / `df5d1ce`, committed 05:08). Proof: against `:3001` an unowned job id returned 503 — i.e. it *reached* the Tracerfy proxy, the leak path — while a fresh instance returns 404. **Any stage that "verified an API fix" against `:3001` today verified the old build**, which is why verification was run against an isolated `:3099` instance instead. The developer must restart `:3001` to pick up today's two API fixes. The running server was not killed; `:3099` was started and stopped by the verify stage.

### Carried from previous runs

- **Estimate Builder currency formatting inconsistent** *(developer decision)* — `EstimatesView.jsx:2118` uses `toLocaleString` → `$2,500.00` while `:2258` uses `toFixed(2)` → `$2500.00` for the **same** `subtotal`, both visible at once. Values are correct; only the thousands separator differs. `toFixed(2)` dominates the file 18 vs 7. Recommend standardizing on `toLocaleString` for user-facing money.
- **Calendar toolbar background / border-color** — Today renders transparent vs the declared glass fill. Same cascade-layer cause as the fix above, but changing fills interacts with working hover/active/group rules; a colour-treatment call for the developer.
- **Close-button placement has two patterns** — dominant flex-header row vs absolute corner X (`top:12/right:12`) in exactly 3 files (`ExpensesView`, `CanvassingMode`, `ReportsView`). Converting either way restructures a working modal = refactor, out of charter.
- **`validateId('jobId')` requires a UUID** but `skip_trace_usage.job_id` is TEXT and the id originates from Tracerfy's `queue_id`. If Tracerfy ever issues a non-UUID id, the route 400s before the ownership gate. Pre-existing, predates today's commits, unverifiable without `TRACERFY_API_KEY`.
- **`.lg-mini-map` (`index.css:1190-1200`) matches no JSX** — dead CSS for a removed component. Harmless, not filed as a UI bug.
- **Esc-to-close absent on most modals** — needs a shared hook; enhancement, not a QA bug.
- **`DELETE /api/crm/tasks|work-orders|canvass-pins/:id` handlers missing** — the client never calls them; adding endpoints is forbidden by charter.
- **EstimateBuilder does not collapse at 375px** — fixed 280px sidebar in `overflow:hidden`. Fine at 768px+; mobile paused.
- **skip-trace 503** — intentional, no `TRACERFY_API_KEY`. Env state, not a bug.
- **Modal z-index spread (200/300/400/1000/9999/99998) deliberately NOT normalized** — it is functional stacking order for nested overlays; normalizing risks real layering regressions.

---

## Test Coverage Gaps

1. **Axis D (type confusion in write bodies) was never run.** Planned as one of this run's four new axes — wrong JSON types in write bodies must 400, never 500. s1 exhausted its 50-turn cap after Axis C. Given that Axis C found 10 real 500s on its first execution, **this is the highest-value untested axis available** and should lead the next run.

2. **The 10 open fuzz 500s need fixing and re-verification.** Second priority; the harness already exists and is read-only.

3. **Independent re-verification covered only 2 of 5 fixes.** s4 formally verified `9c6eb2f` — with negative controls proving the probe was not vacuously passing — and `df5d1ce` (8/8 runtime checks against an isolated instance, probe rows inserted and deleted, `skip_trace_usage` back to 0 rows) before hitting its 40-turn cap. The three UI fixes were verified live by their authoring stages with computed-style measurement, but **were not independently re-verified**.

4. **Browser back/forward — untested for the fifth consecutive run.** Every stage that queued it died before reaching it.

5. **Route walks remain partial.** Storm Map, Canvassing and Admin were checked at render + computed-style depth, not workflow depth — roof drawing, canvass pin edit, and end-to-end storm search have never been exercised. Admin cannot be audited at all from a tenant account behind its 403 gate.

6. **Keyboard navigation** — Esc, Tab order, focus rings, Enter-submit still untested app-wide.

7. **Phone 375px sweep** not revisited. Mobile paused, low priority.

8. **Google-geocoding paths permanently excluded** per the standing cost rule; side-effecting routes (real email, Stripe, paid Tracerfy, bulk Neon writes, storm ingestion, admin cross-tenant mutation) intentionally excluded and enumerated rather than silently capped.

---

## Session Integrity

All four working stages hit their turn cap — the fifth consecutive run in which caps, not scope, are the binding constraint. **However, Run 62's recurring infrastructure failure is now fixed: 4 of 4 stages wrote their results files incrementally and 4 of 4 survived.** Every finding in this report is backed by a file on disk; in Run 62 all four were lost.

| Stage | Outcome | Turns | Cost | Result |
|---|---|---|---|---|
| s1 api-test | MAX_TURNS (50) | 51 | $4.73 | Axes A/B/C run; **2 bugs fixed** (`df5d1ce`, `9c6eb2f`); Axis C's 10 finds written to JSON but never triaged |
| s2 frontend-test | MAX_TURNS (80) | 81 | $6.37 | Settings → Contracts walked; **1 bug fixed** (`5195d84`) |
| s3 ui-audit | MAX_TURNS (60) | 61 | $5.92 | 6 carried-gap routes walked at interaction depth; **2 bugs fixed** (`5b52fb7`, `7783290`) |
| s4 verify | MAX_TURNS (40) | 41 | $3.60 | Fixes 1–2 of 5 formally verified; found the stale-`:3001` environment issue |
| s5 report | this report | — | — | Re-verified Axis C live (1,932 requests, 10 5xx, identical); final build **exit 0, 7.97s** |

s1–s4 spend ≈ **$20.62**.

**Lesson carried forward.** Run 62 established that convergence counters measure where we have looked, not where the bugs are. This run is the strongest evidence yet: the drift gate under `server/src/routes` was **empty**, the existing 272-route harnesses had all passed in Run 63, and the backend had been "converged" for 22 runs — and pointing coverage at four never-tested axes still produced a **cross-tenant PII leak**, two hard 500s, and ten more. Separately, both UI finds were rules that *silently did not apply* — inert inline padding, and an entire rule block outranked by unlayered vendor CSS. **Grep-level audits would have passed both; only measuring computed style on a live page caught them.**

**New gotcha for future runs:** any third-party CSS imported via JS is unlayered and will silently beat app CSS wrapped in `@layer base`. Both vendor sources in this repo have now been checked.

---

*Final build: `npx vite build` → exit 0, built in 7.97s, 0 errors. Chunk-size advisories only (mapbox-gl 1,703.49 kB · index 592.75 kB · ReportsView 490.59 kB), unchanged from prior runs.*
