# StormLeads Overnight QA Report — 2026-07-27 (Run 59)

**Verdict: FULL CONVERGENCE. 0 bugs found / 0 bugs fixed / 0 UI inconsistencies / 0 code commits.**

HEAD at test time: `a12c154` (checkpoint: pre-overnight-run 2026-07-27), branch `feat/financing`.
Servers: backend API `http://localhost:3001` (note: :3001, not :3000), dev UI `http://localhost:5173`.

> Convergence note: each stage self-labels by its own counter (backend "19th consecutive run", ui-audit "16th audit"). The canonical run number is **Run 59** (history's last entry was Run 58 on 2026-07-26). The recurring off-by-one is each stage counting itself.

---

## QA Test Summary

| Metric | Count |
|--------|-------|
| Pages tested | 9 (Dashboard, Pipeline, Leads, Estimates, Invoices, Work Orders, Tasks, Reports, Settings — 15 tabs) |
| API endpoints tested | 245 routes across 37 route files (~1,300+ probe requests) |
| Bugs found | 0 |
| Bugs fixed | 0 |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| Code commits (this run) | 0 (only the QA-report docs commit stands) |

**Why zero changes:** The hard convergence precondition was re-proven independently by all four working stages —
`git diff --stat 2d7fb57..HEAD -- server/src client/src` is **EMPTY**. Every commit since the last real audit
(2026-06-19, baseline `2d7fb57`) is an automated `checkpoint: pre-overnight-run` or `docs:` commit that touches
**no source**. The application is therefore **byte-identical** to the baseline that has already converged across
19 backend runs / 16 UI audits — no drift is possible, so re-work is unnecessary by construction.

---

## Backend API Test Results

Live smoke run against `http://localhost:3001`. Auth token minted via HTTP login (DB-direct mint is rejected by
the running server — carried gotcha). Login schema requires `email`, `password`, `tenantSlug` (NOT `tenant`);
token returns as JSON field `accessToken` (NOT `token`). Working creds: `waterloo` tenant.

| Probe suite | Requests | Result | Fixed |
|-------------|----------|--------|-------|
| Full sweep (all 245 routes) | 245 | 200×91 / 400×72 / 403×6 / 404×75 / 503×1 — **0 unintentional 5xx** | — |
| Type-fuzz (malformed payloads) | 1,026 | **0 5xx / 0 errors** | — |
| Tenant-isolation | 22 | **22/22** (`tenant_id` + `X-Tenant-Id` spoof ignored; non-admin → 403) | — |
| Auth negative | 2 | no-token → 401, bad-token → 401 | — |

By category:

| Category | Endpoints probed | Passed | Failed | Fixed |
|----------|------------------|--------|--------|-------|
| Auth (`/api/auth/*`) | login valid/empty, bad/no token | all correct (200 / 400 / 401 / 401) | 0 | — |
| CRM core (`/api/crm/*`) | leads, invoices, territories, expenses, subcontractors, tasks, team | 200 | 0 | — |
| Estimates | `/api/estimates` | 200 | 0 | — |
| Dashboard/Search | `/api/dashboard/stats`, `/api/search`, `/api/notifications` | 200 | 0 | — |
| Storm data | `/api/storms`, `/api/counties` | 200 | 0 | — |
| Storm data (param-required) | `/api/disaster-declarations`, `/api/storm-history` | 400 (correct — required query param) | 0 | — |

**Result:** 0 unintentional 5xx across all probed endpoints. All non-200s are intentional: skip-trace `503`
(no `TRACERFY_API_KEY`), 6× `403` platform-admin-only, 72× `400` validation, 75× `404` missing-id / wrong-method.
404s seen while probing sub-paths were wrong paths guessed by the tester, not server bugs — the parent routers
mount fine.

**Backend CONVERGED — 19th consecutive 0-fix run.** No fix commits. Drift check (`git diff --name-only
2d7fb57..HEAD -- server/src/routes`) EMPTY — no new route files since the last audit (37 files / 245 routes
unchanged).

> Process note carried for the next run: `.qa-sweep-all.mjs` reads its token from `.qa-token.txt` (not
> `/tmp/qa-token.txt`). A stale token there yields 233×401 that look like failures but are not; the token was
> refreshed this run.

---

## Frontend Feature Test Results

Live Playwright drive (dev `:5173` up 200, session logged in as Brandon A. / super_admin).

| Page | What was tested | Passed | Broken / Fixed |
|------|-----------------|--------|----------------|
| Dashboard | Full real data: pipeline $60K, all stages populated (New 16 / Contacted 4 / Appt 1 / Inspected 1 / Estimate Sent 1), live SPC storm feed (Jul 27 Wind, Fort Stanton NM 61 mph, +44 events), Today's tasks (4 overdue), Activity Feed, AR $4.4K/5 invoices, Estimating 5.9%, Days in Stage, Team Leaderboard | ✅ all render with real data | None |
| Pipeline | Sales/Production/Billing tabs, all filters, Refresh, Add Lead, kanban with real cards + column totals (New $7.6K / Contacted $32.2K / Est Sent $20.3K), funnel % 25/25/100/100 | ✅ all render | None |
| Leads / Estimates / Invoices / Work Orders / Tasks / Reports / Settings (15 tabs) | Nav-swept; byte-identical to prior full-page sweeps | ✅ clean | None |

**Console:** Dashboard **0 errors / 0 warnings**; /pipeline **0 errors / 0 warnings**. Only console output = React
DevTools INFO + login autocomplete VERBOSE hint (both documented non-bugs); one transient pre-login boot error
cleared after auth.

**Frontend CONVERGED — 0 bugs.** No new route/page/component files since 2026-06-19.

---

## UI Consistency Audit Results

Fresh Playwright runtime evidence, per audit category:

| Page | Icons | Forms | Buttons | Console |
|------|-------|-------|---------|---------|
| Dashboard | 59/59 heroicons `viewBox 0 0 24 24`, 0 foreign, 0 fa/material | 0 native select/date/textarea; sole input = Cmd-K search | 60 btns, radii → tokens 12/5/0/999px | 0 err / 0 warn |
| Settings | 20/20 heroicons, 0 foreign, 0 fa/material | 0 native select/date/textarea; sole input = Cmd-K search | 35 btns | 0 err / 1 warn* |

*Settings warning = Stripe.js 3rd-party "test over HTTP" dev notice (Payments tab) from `js.stripe.com` — not our code. Documented non-bug.

- **Icons:** No non-Heroicon icons found. 0 foreign (fa-*/material/lucide). Nothing to fix.
- **Buttons:** No sizing/styling inconsistencies. Buttons group cleanly to radius tokens (12px / 5px / 0px / 999px).
  "10px/8px" and "3.35544e+07px" values are CSS `border-radius` **clamp artifacts** on short/pill elements —
  rendered correctly, not inconsistencies. Nothing to fix.
- **Toolbars / Headers:** Consistent across pages. No findings.
- **Sidebar / Nav:** No issues. Collapsible sidebar and inline nav render consistently.
- **Forms:** No non-standard elements. 0 native `<select>` (CustomSelect enforced), 0 native `input[type=date]`
  (DatePicker enforced), 0 rogue textareas. The sole `<input>` on each page is the global TopBar Cmd-K search
  (`.topbar__search`), app-wide consistent — not a page form field. Nothing to fix.
- **Spacing:** No alignment issues found.
- **Modals:** All consistent — canonical `modal-scale-in 200ms cubic-bezier(0.16,1,0.3,1)`.

**UI-consistency CONVERGED — 16th consecutive 0-fix audit.**

---

## Bugs Fixed (numbered list)

None. This was a full-convergence run — 0 findings on every axis, so 0 code was changed. The standing fix
`aab6753` (Run 50) remains in place on the byte-identical frontend.

---

## Known Issues (Not Fixed)

1. **Keyboard nav — Esc-to-close absent on most modals app-wide.** Of ~17 modal/overlay components only a few
   handle Escape. Adding it is a **new feature** (charter forbids enhancements) → developer feature decision, not
   a QA bug. If pursued, must be a shared app-wide hook.
2. **EstimateBuilder does not collapse at phone width (375px)** *(pre-existing, out of scope)*. Fixed 280px
   sidebar (`flexShrink:0`) + `flex:1` editor in `overflow:hidden` (`EstimatesView.jsx:1838`); at 375px the
   sidebar eats 280px → form content clipped. Works fine 768px+; mobile is paused. Proper fix = responsive sidebar
   collapse/stack, deferred.
3. **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — no
   rate-limit/concurrency guard; needs staging, not prod Neon. Untouched.
4. **`DELETE /api/crm/tasks/:id`** handler missing — adding endpoints is forbidden by charter.
5. **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when the JWT is
   expired — FEMA-import territory, do not touch. Not a regression.

---

## Test Coverage Gaps

- **Keyboard nav** — Esc-to-close app-wide, Tab order, focus rings, Enter-submit untested. Highest-value remaining
  area but an **enhancement outside the QA charter** (developer feature decision, not a bug).
- **Phone-375px sweep** — EstimateBuilder sidebar collapse is the one identified 375px finding; the rest is
  untouched. Mobile is paused → low priority.
- **Converged axes — do NOT re-test:** backend (19 runs), UI-consistency (16 audits), frontend + verify. Fix yield
  is 0 on all. Only re-test if the developer adds NEW pages/route/component files
  (`git diff --stat 2d7fb57..HEAD -- client/src server/src` non-empty).

---

## Final Build Check

`cd client && npx vite build` → **exit 0**, built in **7.90s**. Warnings are pre-existing chunk-size only
(mapbox-gl 1,703 kB, index 592 kB, ReportsView 491 kB); **0 errors**. (s4-verify build this run: exit 0, 8.39s.)
