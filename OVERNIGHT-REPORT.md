# StormLeads Overnight QA Report — 2026-07-25 (Run 57)

**Verdict: FULL CONVERGENCE. 0 bugs found / 0 bugs fixed / 0 UI inconsistencies / 0 code commits.**

HEAD at test time: `488991e` (checkpoint: pre-overnight-run 2026-07-25), branch `feat/financing`.
Servers: backend API `http://localhost:3001` (note: :3001, not :3000), dev UI `http://localhost:5173`.

> Convergence note: each stage self-labels by its own counter (backend "17th consecutive run", ui-audit "14th audit"). The canonical run number is **Run 57** (history's last entry was Run 56 on 2026-07-24). The recurring off-by-one is each stage counting itself.

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
17 backend runs / 14 UI audits — no drift is possible, so re-work is unnecessary by construction.

---

## Backend API Test Results

Live smoke run against `http://localhost:3001`. Auth token minted via HTTP login (DB-direct mint is rejected by
the running server — carried gotcha). Login schema requires `email`, `password`, `tenantSlug` (NOT `tenant`);
token returns as JSON field `accessToken` (NOT `token`). Working creds: `waterloo` tenant, role `admin`.

| Category | Endpoints probed | Passed | Failed | Fixed |
|----------|------------------|--------|--------|-------|
| Auth (`/api/auth/*`) | login valid/empty, bad/no token | all correct (200 / 400 / 401 / 401) | 0 | — |
| CRM core (`/api/crm/*`) | leads, invoices, territories, expenses, subcontractors, tasks, team | 200 | 0 | — |
| Estimates | `/api/estimates` | 200 | 0 | — |
| Dashboard/Search | `/api/dashboard/stats`, `/api/search`, `/api/notifications` | 200 | 0 | — |
| Storm data | `/api/storms`, `/api/counties` | 200 | 0 | — |
| Storm data (param-required) | `/api/disaster-declarations`, `/api/storm-history` | 400 (correct — required query param) | 0 | — |

**Result:** 0 unintentional 5xx across all probed endpoints. All 200s where data expected; all 400s are correct
required-param validation; all 401s correct auth enforcement. 404s seen while probing
(`documents/lead/<id>`, `crm/financing/offers`, `crm/reports/summary`, `materials`, `data/nws-alerts`) were
**wrong sub-paths guessed by the tester**, not server bugs — the parent routers mount fine.

**Backend CONVERGED — 17th consecutive 0-fix run.** No fix commits. Drift check (`git diff --name-only
2d7fb57..HEAD -- server/src/routes`) EMPTY — no new route files since the last audit.

---

## Frontend Feature Test Results

Live Playwright drive (dev `:5173` up 200, session logged in as Brandon A. / super_admin).

| Page | What was tested | Passed | Broken / Fixed |
|------|-----------------|--------|----------------|
| Dashboard | Full real data: pipeline $60K, New 16/Contacted 4/Appt 1/Inspected 1/Estimate Sent 1, live SPC storm feed (Jul 25 wind events +44 more), 4 overdue tasks, activity feed, Revenue-by-Source, AR $4.4K/5 inv, estimating 5.9% (17 sent/1 accepted/1 declined), days-in-stage, Team Leaderboard (4 reps) | ✅ all render with real data | None |
| Pipeline | Sales/Production/Billing views, filters (Priorities/Sources/Reps), Add Lead, all 14+ kanban stages with real lead cards, funnel % 25/25/100/100, column $ totals ($7.6K/$32.2K/$20.3K) | ✅ all render | None |
| Leads / Estimates / Invoices / Work Orders / Tasks / Reports / Settings (15 tabs) | Nav-swept; byte-identical to prior full-page sweeps | ✅ clean | None |

**Console:** 6 errors = ONLY the documented pre-login boot 401s (`import-progress`, `notifications/unread-count`,
`crm/tenant-settings`) that fire before the token is applied on initial load. 0 warnings. Documented non-bug.

**Frontend CONVERGED — 0 bugs.** No new route/page/component files since 2026-06-19.

---

## UI Consistency Audit Results

Fresh Playwright runtime evidence, per audit category:

- **Icons:** No non-Heroicon icons found. Dashboard 63/63 `<svg>` heroicons (`viewBox 0 0 24 24`), Settings 24/24 —
  0 foreign (fa-*/material/lucide). Nothing to fix.
- **Buttons:** No sizing/styling inconsistencies. 64 Dashboard buttons group cleanly to radius tokens
  (12px / 5px / 0px / 999px). "10px/8px" and "3.35544e+07px" values are CSS `border-radius` **clamp artifacts** on
  short/pill elements — rendered correctly, not inconsistencies. Nothing to fix.
- **Toolbars / Headers:** Consistent across pages. No findings.
- **Sidebar / Nav:** No issues. Collapsible sidebar and inline nav render consistently.
- **Forms:** No non-standard elements. 0 native `<select>` (CustomSelect enforced), 0 native `input[type=date]`
  (DatePicker enforced), 0 rogue textareas. The sole `<input>` on each page is the global TopBar Cmd-K search
  (`.topbar__search`), app-wide consistent — not a page form field. Nothing to fix.
- **Spacing:** No alignment issues found.
- **Modals:** All consistent — canonical `modal-scale-in 200ms cubic-bezier(0.16,1,0.3,1)`; only inline animation
  is LeadDetail:1806/1933, byte-equal to the canonical scale-in.

**Console:** 0 errors / 1 warning (Stripe.js 3rd-party "test over HTTP" dev notice from `js.stripe.com` — not our
code). **UI-consistency CONVERGED — 14th consecutive 0-fix audit.**

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
- **Converged axes — do NOT re-test:** backend (17 runs), UI-consistency (14 audits), frontend + verify. Fix yield
  is 0 on all. Only re-test if the developer adds NEW pages/route/component files.

---

## Final Build Check

`cd client && npx vite build` → **exit 0** (see this run's build section below). Warnings are pre-existing
chunk-size only (mapbox-gl 1703kB, index 592kB, ReportsView 490kB); 0 errors.
