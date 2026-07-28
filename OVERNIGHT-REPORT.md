# StormLeads — Overnight QA Report

**Date:** 2026-07-28 (Run 60)
**Branch:** `feat/financing` · **HEAD:** `3f2f9ec`
**Baseline:** `2d7fb57` (2026-06-19) — app source byte-identical to this converged baseline
**Stages run:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages exercised (live Playwright) | Dashboard, Settings, Pipeline, Leads (empty-state) — representative live health checks |
| API endpoints exercised (live smoke) | 23 representative endpoints across 8 categories (full 245-route sweep already converged on baseline) |
| Bugs found | **0** |
| Bugs fixed | **0** |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Code commits (fixes) | **0** |

**Verdict: FULL CONVERGENCE on every axis** — backend (20 consecutive clean runs), UI consistency (17 audits), frontend, and verify. The committed source is byte-identical to the converged baseline `2d7fb57`; every drift vector is empty, so no re-sweep was warranted and no code was changed.

**Drift gate (the charter's own re-test trigger) — all vectors EMPTY:**
- `git diff --stat 2d7fb57..HEAD -- client/src server/src` → empty
- `client/src/components` + `client/src/pages` → empty (0 new/changed files)
- `server/src/routes` → empty (0 new route files)
- dep/build config (`package.json`, `package-lock.json`, `vite.config.js`, `index.html`) → empty

---

## Backend API Test Results

Source is byte-identical to a baseline whose full 245-route sweep already converged across 19 prior runs (200×91 / 400×72 / 403×6 / 404×75 / 503×1, plus 1,026-payload type-fuzz, 22/22 tenant-isolation, 2/2 auth-negative — all previously clean). Rather than redundantly re-sweep unchanged code, s1 ran a **live health smoke test** against the running server (`:3001`).

| Category | Endpoints exercised | Pass | Fail |
|---|---|---|---|
| Auth | 2 (`/api/auth/login` empty-body → 400, valid → 200) | 2 | 0 |
| CRM core | leads, tasks, team, contracts, invoices, automations, work-orders, drip-sequences, expenses, subcontractors, territories | 11 | 0 |
| Estimates | `/api/estimates` (auth + no-auth 401) | 2 | 0 |
| Dashboard | `/api/dashboard/stats` | 1 | 0 |
| Notifications | `/api/notifications` | 1 | 0 |
| Financing (branch feature) | `/api/crm/financing/plans`, `/api/crm/financing/lenders` | 2 | 0 |
| Materials | `/api/materials/products` | 1 | 0 |
| Reports | `/api/crm/reports/revenue`, `/api/crm/reports/pipeline` | 2 | 0 |
| **Total** | **23** | **23** | **0** |

- **0 unintentional 5xx.** Error handling correct: empty login body → 400 (not 500), no-auth → 401, bad id (`/api/leads/notanumber`) → 400 (not 500).
- The only non-200s were 3× 404 from wrong-path guesses during probing (financing/materials/reports routers have no bare `GET /`); corrected sub-paths all returned 200.
- **Fixed:** nothing — no bugs found, no commits (charter commits only fixes). Backend is on its **20th consecutive converged run.**

---

## Frontend Feature Test Results

Source byte-identical to baseline; every drift vector (source, pages, components, route files, dep/build config) came back empty. s2 ran a **live Playwright runtime health check** rather than re-sweeping unchanged pages.

| Page | Tested | Passed | Broken / Fixed | Needs attention |
|---|---|---|---|---|
| **Dashboard** (`/`) | Full render with real data — pipeline $60K across 14 stages, live SPC storm feed (Fort Stanton NM 61mph, +44 events Jul 27), tasks w/ overdue count, activity feed, revenue-by-source, AR $4.4K, estimating conversion 5.9%, days-in-stage, team leaderboard | ✅ All render | None broken · nothing fixed | None |
| **Login flow** | Login → redirect to `/` (dashboard renders at root when authenticated) | ✅ | None | Benign note: `/dashboard` redirects to `/` (by design) |
| **Console** | Runtime errors/warnings on authenticated dashboard | ✅ 0 errors / 0 warnings (React DevTools info notice only) | None | None |

- **Broken and fixed:** none — no code was broken, so nothing to fix, nothing to commit.
- **Still needs attention:** nothing new. Two long-standing out-of-charter gaps carried forward (see *Known Issues*).

---

## UI Consistency Audit Results

Source byte-identical to a baseline already converged across 16 prior UI audits; drift gate empty on every vector. s3 ran a **live Playwright health check** across Dashboard and Settings instead of a redundant 7-audit re-sweep.

| Audit category | Finding | Fixed? |
|---|---|---|
| **Icons** | Dashboard 59/59 Heroicons (`viewBox 0 0 24 24`, stroke); Settings 20/20 Heroicons. **0 foreign icons** (no FontAwesome / Material / Lucide / solid-variant). | N/A — none found |
| **Buttons** | Consistent radii tokens (12/5/0/999px) + documented CSS `clamp()` artifacts (`10px`/`8px`, `3.35544e+07px` = 2²⁵ max-radius clamp, not bugs); oklch accent tokens `oklch(0.72 0.19 250 / .12–.15)`. | N/A — consistent |
| **Toolbars / Headers** | Consistent across probed pages. | N/A |
| **Sidebar / Nav** | All nav icons Heroicons; layout consistent, active state intact. | N/A |
| **Forms** | 0 native `<select>`, 0 native `<input type=date>`, 0 native `<textarea>` (CustomSelect + DatePicker enforced). Sole page `<input>` is the global TopBar Cmd-K search, not a form field. | N/A — none found |
| **Spacing** | No alignment issues observed on live render. | N/A |
| **Modals** | Canonical `modal-scale-in 200ms cubic-bezier(0.16,1,0.3,1)`; consistent. | N/A |
| **Console** | Dashboard 0 err / 0 warn; Settings 0 err / 1 warn (third-party Stripe.js HTTP notice, external to our code). | N/A |

- **UI is on its 17th consecutive 0-fix audit.** 0 inconsistencies, 0 fixes, 0 commits.

---

## Bugs Fixed (numbered list)

None. This was a full-convergence run — 0 findings on every axis, so 0 code changed. The source is byte-identical to the converged baseline `2d7fb57` (2026-06-19); every commit since is an automated `checkpoint:`/`docs:` commit touching no source, so no drift is possible. `git log --oneline 2d7fb57..HEAD | grep -i fix` is empty (0 fix commits to verify).

---

## Known Issues (Not Fixed)

These are carried, out-of-charter items — not regressions and not QA bugs:

1. **Keyboard nav — Esc-to-close absent on most modals app-wide.** Of ~17 modal/overlay components only a few handle Escape. Adding it is a **new feature** (charter forbids enhancements) → developer feature decision. If pursued, must be a shared app-wide hook.
2. **EstimateBuilder does not collapse at phone width (375px).** Fixed 280px sidebar (`flexShrink:0`) + `flex:1` editor in `overflow:hidden` (`EstimatesView.jsx:1838`); at 375px the sidebar eats 280px → form content clipped. Works fine 768px+; mobile is paused. Proper fix = responsive sidebar collapse/stack, deferred.
3. **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — no rate-limit/concurrency guard; needs staging, not prod Neon. Untouched.
4. **`DELETE /api/crm/tasks/:id` handler missing** — adding endpoints is forbidden by charter.
5. **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when JWT expired — FEMA-import territory, do not touch. Not a regression.
6. **skip-trace 503** — intentional, no `TRACERFY_API_KEY` configured (env state, not a bug).

---

## Test Coverage Gaps

- **Keyboard nav** (Esc-to-close app-wide, Tab order, focus rings, Enter-submit) — untested. Highest-value remaining area but an **enhancement outside the QA charter**, so it is a developer feature decision, not a bug.
- **Phone-375px sweep** — EstimateBuilder sidebar collapse is the one identified 375px finding; the rest is untouched. Mobile is paused → low priority.
- **Converged axes — do NOT re-test:** backend (20 runs), UI consistency (17 audits), frontend, and verify. Fix yield has been 0 on all. **Only re-test if the developer adds NEW page/route/component files** — drift check: `git diff --stat 2d7fb57..HEAD -- client/src server/src` returning non-empty.

---

## Environment Notes (carried gotchas)

- Server runs on **:3001** (charter text still says 3000); dev UI on **:5173**.
- Token: mint via HTTP login `POST /api/auth/login` with `{email:'waterlooconstruction1@gmail.com', password:'2Wealth&health', tenantSlug:'waterloo'}` → `accessToken`. Body needs `tenantSlug` (not `tenant`); field is `accessToken` (not `token`). DB-direct token mint is rejected by the running server (in-memory `JWT_SECRET` ≠ `.env`).

---

## Final Build Check

`cd client && npx vite build` → **exit 0, built in 7.97s, 0 errors.** Only the pre-existing chunk-size advisories (>500 kB after minification): `mapbox-gl` 1,703.49 kB, `index` 592.75 kB, `ReportsView` 490.59 kB. No new warnings introduced.
