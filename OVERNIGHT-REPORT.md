# StormLeads — Overnight QA Report

**Date:** 2026-07-29 (Run 61)
**Branch:** `feat/financing` · **HEAD at start:** `ebb1aa1` → **HEAD now:** `e5c4c89`
**Baseline:** `2d7fb57` (2026-06-19) — the converged reference the drift gate measures against
**Stages run:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages exercised (live Playwright) | **18 routes** swept at code level by s3; **13 walked end-to-end** by s2; Materials re-verified live by s4 |
| Modal / overlay sites audited | **22** `.modal-backdrop` sites across 13 components, plus 5 `.slide-over` components |
| API endpoints exercised (live) | **60 endpoint rows** (59 × 200, 1 × intentional 403) inside **83 total HTTP requests** |
| Functional bugs found | **0** |
| Functional bugs fixed | **0** |
| UI inconsistencies found | **1** |
| UI inconsistencies fixed | **1** |
| Code commits (fixes) | **1** — `e5c4c89` |

**Verdict: backend converged (21st consecutive 0-fix run); UI audit broke an 17-run zero streak with 1 real find, now fixed.**

This is the first non-zero UI audit in 18 runs. The drift gate was **empty on all four vectors** — the committed app source was byte-identical to baseline `2d7fb57` — but s3 deliberately declined to skip on that basis, because the prior 17 "converged" audits only sampled **Dashboard + Settings** in the live browser. A full sweep of all 18 routes and all 22 modal sites still had headroom, and it found a genuine deviation. The lesson is recorded for future runs: an empty drift gate proves *the code has not changed*, not *the code has been fully examined*.

**Drift gate — all four vectors EMPTY at run start:**
- `git diff --stat 2d7fb57..HEAD -- client/src server/src` → empty
- `git diff --name-only 2d7fb57..HEAD -- server/src/routes` → empty (0 new route files)
- `git diff --name-only 2d7fb57..HEAD -- client/src/components client/src/pages` → empty
- dep/build config (`package.json`, `package-lock.json`, `vite.config.js`, `index.html`) → empty

After this run the gate is intentionally non-empty by exactly one line — the fix below.

---

## Backend API Test Results

Source was byte-identical to a baseline whose full 245-route sweep converged across 20 prior runs. Rather than re-test unchanged bytes, s1 ran a **live health verification of every mount prefix** against the running server (`:3001`).

**Inventory:** 37 route modules · 280 `router.<method>()` declarations · 36 mount prefixes.

| Category | Endpoints exercised | Pass | Fail |
|---|---|---|---|
| Auth | `/api/auth/login` | 1 | 0 |
| Storm / map / geo data | `/storms`, `/storms?days=7`, `/map/swaths`, `/properties?bbox`, `/counties`, `/storm-history`, `/disaster-declarations`, `/data/fema-housing` | 8 | 0 |
| Dashboard (legacy prefix) | `/dashboard/stats`, `/funnel`, `/activity` | 3 | 0 |
| CRM dashboard widgets | all 13 `/api/crm/dashboard/*` (stats, activity, tasks-today, leaderboard, followups, ar-summary, estimate-summary, estimating-conversion, days-in-stage, stale-leads, conversion-by-storm, properties-affected, customer-storm-alerts) | 13 | 0 |
| Leads | `/leads`, `/leads?page=1&limit=5`, `/crm/leads` | 3 | 0 |
| CRM core | tasks, team, pipeline/stages, pipeline/metrics, tenant-settings, contracts, invoices, automations, work-orders, drip-sequences, expenses, subcontractors, territories, canvass-pins | 14 | 0 |
| Financing (branch feature) | `/crm/financing/plans`, `/lenders` | 2 | 0 |
| Reports | `/crm/reports/revenue`, `/pipeline` | 2 | 0 |
| Estimates | `/api/estimates` | 1 | 0 |
| Notifications | `/api/notifications` | 1 | 0 |
| Search | `/api/search?q=test` | 1 | 0 |
| Documents | `/api/documents` | 1 | 0 |
| Materials | `/api/materials/products` | 1 | 0 |
| Roof measurement | config, usage, balance | 3 | 0 |
| Payments | connect/status, history | 2 | 0 |
| Onboarding | `/onboarding/plans` | 1 | 0 |
| Alerts | config, history | 2 | 0 |
| Admin | `/api/admin/tenants` → **403 intentional** (platform-admin only) | 1 (as designed) | 0 |
| **Total** | | **60** | **0** |

**Error handling — 10/10 correct, 0 unintentional 5xx:**

| Case | Expected | Got |
|---|---|---|
| `POST /auth/login` empty body | 400 | 400 + zod field details |
| `POST /auth/login` bad creds | 401 | 401 `Invalid email or password` |
| `GET /crm/leads` no auth header | 401 | 401 `Missing or invalid authorization header` |
| `GET /leads/notanumber` | 400 | 400 `Invalid id format` (**not** 500) |
| `GET /crm/leads/999999999` | 400 | 400 `Invalid id format` (ids are UUIDs) |
| `POST /crm/leads {}` | 400 | 400 `propertyId is required` |
| `POST /crm/tasks {}` | 400 | 400 `title required` |
| `GET /crm/invoices/abc` | 400 | 400 (**not** 500) |
| `GET /estimates/abc` | 400 | 400 (**not** 500) |
| `GET /nonexistent-route-qa` | 404 | 404 **JSON**, not an HTML error page |

**Required-param validation — 5/5 correct 400s, each returning 200 once the param was supplied:** `/properties` and `/map/swaths` need `bbox`; `/storm-history` needs `lat`+`lng`; `/disaster-declarations` needs `state`+`county`; `/data/fema-housing` needs `zip`.

**Not bugs.** 11 initial 404s were the tester's own wrong-path guesses. Each was traced to its real path in the router source, which returns 200 — e.g. dashboard widgets live at `/api/crm/dashboard/*`, not `/api/dashboard/*`; `/api/map/storms` is really `/map/properties|/affected-properties|/swaths`.

**What was fixed:** nothing — no backend defects existed. **0 commits** from this stage (the charter commits only fixes). Backend stands at its **21st consecutive converged run**.

---

## Frontend Feature Test Results

s2 declined the shallow health check that recent runs used and walked the pages end-to-end in Playwright. It reached 13 pages before exhausting its turn budget mid-Settings (see Coverage Gaps).

| Page | Tested | Passed | Broken / Fixed | Needs attention |
|---|---|---|---|---|
| **Dashboard** (`/`) | Full render, all 13 widgets with real data; console; stat-card navigation | ✅ Renders; console **0 err / 0 warn**; stat card → `/pipeline` works | None | None |
| **Pipeline** (`/pipeline`) | Kanban render, 14 stages, inter-stage conversion %, column totals, card click | ✅ All render; card click opens the lead preview | None — the initial "card click does nothing" reading was a wrong selector (the preview is `.slide-over`, not a modal) | None |
| **Lead preview → LeadDetail** | Preview population, "Open Full Detail" | ✅ Opens in-place as a 480px slide-over (by design — `onOpenFull` sets `selectedLeadId`, not a route change); all sections, 21 action buttons, real financials | None — the initial "no detail rendered" reading was a mistimed assertion | None |
| **Leads** (`/leads`) | Table render, stage filter, design-system compliance | ✅ 23 rows / 16 cols; **0 native selects or date inputs**; CustomSelect portals correctly (11 options → body); filter URL-syncs to `?stage=contacted`, 4 rows, count matches Pipeline | None | None |
| **Storm Map** (`/storm-map`) | Map render, 6 layer toggles | ✅ Google Maps 1900×1900 canvas; layers toggle (Hail Reports reveals a conditional Wind Drift sub-toggle) | None | Address-search submit **deliberately not exercised** — it fires Google geocoding, and the standing cost rule forbids repeated automated geocodes |
| **Estimates** (`/estimates`) | List render, per-row actions | ✅ 50 rows | None | None |
| **Estimate Builder** | 10 sections, rich-text, date controls, line-item add, live math | ✅ DatePicker buttons (not native inputs); line item added (14→17 inputs); 10 × $250 → line $2,500 / Subtotal $2,500.00 correct | None broken | ⚠️ **Currency formatting inconsistency** — see Known Issues #1 |
| **Invoices** (`/invoices`) | Render, AR aging, stat cards | ✅ All render | None | None |
| **Work Orders** (`/work-orders`) | Render | ✅ | None | None |
| **Tasks** (`/tasks`) | Render, tab switching | ✅ Tab switching works; 6 completed with Done dates | None | None |
| **Calendar** (`/calendar`) | Render, view switching, empty state | ✅ View switching works; empty state is graceful | None | None |
| **Reports** (`/reports`) | Chart render, date controls, export | ✅ 14 charts with real data; DatePicker buttons (not native); per-chart CSV export | None | None |
| **Canvassing** (`/canvassing`) | Render | ✅ | None | Geolocation prompt denied by the Playwright harness — harness limitation, not an app defect |
| **`/content-studio`** | Route existence | n/a | Not broken — **the route does not exist**; the catch-all redirects to `/` gracefully | Unbuilt future feature (AI marketing content). Building it is forbidden by the charter |
| **Settings** (`/settings`) | 15 tabs enumerated (3 more than the charter listed); walk started | Partial | None found before the stage ended | ⚠️ **Incomplete — stage hit its turn limit here.** Carried to next run |

---

## UI Consistency Audit Results

s3 swept **all 18 authenticated routes and all 22 modal sites** — the deepest pass yet.

| Category | Result | Fixed? |
|---|---|---|
| **Icons** | **PASS.** 38/38 import sites are `@heroicons/react/24/outline`; 0 imports from solid, lucide, react-icons, FontAwesome, MUI, feather, tabler. Exactly 2 inline JSX `<svg>` exist — `CanvassingMode.jsx:336` (pin-colour legend swatch) and `StormMap.jsx:1764` (star glyphs inside a Mapbox `setHTML` popup, which cannot host a React icon) — both map-related and charter-permitted. Peak page `/storm-catalog` renders 1031 SVGs, all 1031 Heroicons. | Nothing to fix |
| **Buttons** | **PASS.** Primary action buttons byte-identical across `/tasks`, `/invoices`, `/work-orders`, `/contracts`, `/subcontractors`: `.auth-btn`, `oklch(0.72 0.19 250)`, 14/12px radius, `0 24px` padding, 13px/700, 36px height. Radius families resolve to the token set 12/8/5/999/0px, grouped by purpose. No deviating one-off inline styling. | Nothing to fix |
| **Toolbars / Headers** | **PASS.** All 18 routes: `header.topbar.glass` at **exactly 56px**, correct `<h1>`, title-left / actions-right. Zero height variance. | Nothing to fix |
| **Sidebar / Nav** | **PASS.** 240px `sidebar glass`; 22/22 nav items carry an icon and 22/22 are Heroicons; 18 primary rows uniform at 42px height / 12px radius; exactly **one** `.active` item, correct for the route; vertical rhythm 0px within group / 8px between groups / 53px before a section header — deliberate and repeated. | Nothing to fix |
| **Forms** | **PASS.** **0 native `<select>`** across all 18 routes *and* inside all modals. **0 native date/time/datetime inputs** in JSX anywhere in the client (`index.css:2307-2361` styles them defensively only; nothing renders one). CustomSelect and DatePicker conventions fully respected. Text inputs/textareas carry `.form-input`. Labels uniform at 12px/600. | Nothing to fix |
| **Spacing** | **PASS.** `.glass` panel radius uniform on 6 of 7 sampled pages (Dashboard 11/11, Pipeline 31/31, Leads 2/2, Invoices 3/3, Contracts 2/2). Padding uniform within each page. Fractional values (17.5 / 8.75 / 7 / 5.25 / 3.5px) are documented CSS `clamp()` outputs, not drift. | Nothing to fix |
| **Modals** | **1 ISSUE FOUND → FIXED.** 22/22 sites use `.modal-backdrop`, so all inherit `modal-backdrop-in` (150ms) and `modal-scale-in` (200ms). Header contract identical everywhere (flex space-between, `<h2>` 18px/700, icon-only close, IconX 20×20). Widths vary by type but are consistent within type (400/480 pickers, 520/580 forms, 900 builder). The one deviation is below. | ✅ `e5c4c89` |

**Console across all 18 routes: 0 application errors.** Everything observed was third-party or harness noise — Google Maps `loading=async` advisory (map code is off-limits per charter), Stripe.js HTTP notice, geolocation blocked by the Playwright harness, and 2× 403 on `/api/admin/overview` (the documented platform-admin-only gate; the page still renders).

---

## Bugs Fixed

1. **[Materials — cart drawer]** — `MaterialsView.jsx:587`: the `CartSidebar` backdrop used `oklch(0 0 0 / 0.5)` with no blur, dimming the page less than every other modal in the app. Every other non-blurred backdrop uses `0.6`, **including its own two siblings in the same file** (`ProductModal` L462 and the L893 catalog modal). — **Fixed** by changing the value to `oklch(0 0 0 / 0.6)`. Purely visual; drawer position, width and animation untouched. Commit **`e5c4c89`**, one line changed. Build exit 0 (8.57s). Re-verified live twice: by s3 immediately after the change, and independently by s4 (backdrop `0.6`; `zIndex` 1000, `position: fixed`, `justify-content: flex-end`, 420px, `modal-scale-in` all intact; 3/3 Heroicons; 0 native selects).

No functional bugs were found this run, so this is the only entry.

**Regression checks on the fix (s4):** both sibling modals in the touched file re-opened cleanly — `ProductModal` (`0.6` + `blur(8px)`, z 1000, scale-in) and the L893 catalog modal — and all three backdrops in the file are now consistently `0.6`. Backdrop-click-to-close works. Empty-cart state renders gracefully ("Your cart is empty / Browse the catalog to add products"). At 375px the 420px drawer is guarded by `maxWidth: '90vw'` → measured 338px, no overflow, backdrop still `0.6`.

**One documentation nit, no code impact:** the `e5c4c89` commit message calls the L893 component `OrderDetailModal`; it is actually `SRSCatalogModal` (consumed by `EstimatesView.jsx:2704`). The line number and the change itself are correct — only the prose label in the message body is wrong. Not amended, since rewriting a pushed commit message is a worse trade than this note.

---

## Known Issues (Not Fixed)

1. **Estimate Builder currency formatting is inconsistent** *(new this run, cosmetic)* — `EstimatesView.jsx:2118` renders Subtotal with `toLocaleString(…{minimumFractionDigits:2})` → `$2,500.00`, while `EstimatesView.jsx:2258` renders **the same `subtotal` value** with `toFixed(2)` → `$2500.00`. Both are visible in the builder at once. **Values are correct**; only the thousands separator differs. `toFixed(2)` is the dominant convention in the file (18 uses vs 7 `toLocaleString`). Not fixed: picking one is a formatting-convention refactor, which the charter forbids. **Developer decision** — recommend standardizing on `toLocaleString` for user-facing money.
2. **Panel radius convention split** — literal `20px / 18px` in 56 JSX sites vs `var(--radius-xl)` (flat 20px) in 12. A ~2px elliptical-vs-circular delta. Fixing properly means redefining the token app-wide = design-system change, out of charter.
3. **Backdrop blur/dim sub-groups** — `blur(8px)+0.6` dominant (×10); a `blur(4px)+0.5` trio (CreateLeadModal, EstimatesView L1165, InvoicesView L962); LeadDetail L2459/L2647 at `0.75`/`0.70` for full-bleed immersive viewers; PhotoAnnotator tinted `oklch(0.03 0.02 260 / 0.85)` for photo editing. These are coherent per-context treatments — re-tuning them is a design judgement call, i.e. an enhancement.
4. **Keyboard nav — Esc-to-close absent on most modals app-wide.** Adding it is a new feature; if pursued it must be a shared app-wide hook. Developer feature decision, not a QA bug.
5. **EstimateBuilder does not collapse at phone width (375px)** *(pre-existing, out of scope)* — fixed 280px sidebar (`flexShrink:0`) + `flex:1` editor inside `overflow:hidden` (`EstimatesView.jsx:1838`); at 375px the sidebar eats 280px and content clips. Works fine at 768px+; mobile is paused.
6. **`/content-studio` is not implemented** — no such route exists; the catch-all redirects to `/` gracefully. AI marketing content is a planned future feature; building it is outside the QA charter.
7. **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — no rate-limit or concurrency guard. Needs staging, not production Neon. Untouched.
8. **`DELETE /api/crm/tasks/:id` handler missing** — adding endpoints is forbidden by the charter.
9. **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when the JWT has expired — FEMA-import territory, do not touch. Not a regression.
10. **skip-trace 503** — intentional; no `TRACERFY_API_KEY` configured. Environment state, not a bug.

**Explicitly not changed, by design:** the modal z-index spread (200 / 300 / 400 / 1000 / 9999 / 99998) is **functional stacking order for nested overlays**, not styling drift. Normalizing it would risk real layering regressions. Also untouched: unused Streamline SVGs under `client/src/assets/icons*`, which are imported nowhere and never render — deleting them is cleanup, out of charter.

---

## Test Coverage Gaps

1. **Settings tabs — not completed.** s2 enumerated 15 tabs (3 more than the charter lists) and began walking them when it **hit its 80-turn limit**. No findings were recorded before it stopped. This is the single largest gap and should lead the next run.
2. **s4 verify ended early too.** It completed the fix verification, both sibling-modal regression checks, and the 375px responsive check, then **hit its 40-turn limit** during navigation/back-forward testing. The fix itself is fully verified; browser back/forward behaviour after the change is not.
3. **Neither s2 nor s4 wrote a results file this run** — `C:\tmp\frontend-test-results.txt` (Jul 25) and `C:\tmp\verify-results.txt` (Jul 26) are stale artifacts from earlier runs and do **not** describe tonight's work. Everything in the Frontend and verification sections above was reconstructed from the two stages' session transcripts, which are complete up to the point each stopped. Fresh files exist only for s1 (`api-test-results.txt`) and s3 (`ui-audit-results.txt`).
4. **Keyboard nav** — Esc-to-close, Tab order, focus rings, Enter-submit remain untested app-wide. Highest-value remaining area, but an enhancement outside the QA charter.
5. **Phone-375px sweep** — only the Materials cart drawer (passed) and the known EstimateBuilder finding have been checked at 375px. Mobile is paused → low priority.
6. **Google-geocoding paths deliberately skipped** — storm-map address search and any bulk geocode. Standing cost rule; not a coverage failure but a permanent exclusion.
7. **`GET /api/drift/`** has no bare route (only `/drift/:stormEventId`), so the drift router was verified by source inspection rather than a live call.
8. **Converged axes — do not re-sweep** unless the drift check `git diff --stat 2d7fb57..HEAD -- client/src server/src` shows new page/route/component files: backend (21 runs). **UI consistency is no longer in that category** — this run proved a deep sweep still yields findings where a sampled one does not.

---

## Session Integrity

| Stage | Outcome | Turns | Cost | Result |
|---|---|---|---|---|
| s1 api-test | ✅ success | 21 | $1.97 | Backend converged, 21st 0-fix run; 83 requests, 0 unintentional non-200, 0 fixes |
| s2 frontend-test | ⚠️ **max_turns (80)** | 81 | $6.06 | 13 pages walked end-to-end and passing; stopped mid-Settings; 0 fixes; 1 cosmetic finding logged |
| s3 ui-audit | ✅ success | 68 | $5.87 | 18 routes + 22 modals swept; **1 inconsistency found and fixed**; commit `e5c4c89` |
| s4 verify | ⚠️ **max_turns (40)** | 41 | $2.65 | Fix verified live + both sibling modals + 375px; stopped during back/forward testing; 0 fixes |
| s5 report | this document | — | — | Report, history and resume written; final build re-run below |

**Stage spend s1–s4 ≈ $16.55.** Two of four working stages exited on their turn cap — both after completing substantive work, neither leaving a broken state.

**1 code commit stands for this run:** `e5c4c89` (the backdrop fix). This report adds a `docs:` commit.

**Final build check (s5, at report time):** `cd client && npx vite build` → **exit 0, built in 7.99s, 0 errors.** Only the pre-existing chunk-size advisories appear (mapbox-gl 1703.49kB, index 592.75kB, ReportsView 490.59kB) — unchanged from prior runs.
