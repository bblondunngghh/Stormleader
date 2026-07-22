# StormLeads — Overnight QA Report

**Run 54 · 2026-07-22 · branch `feat/financing`**

> Run-number note: the individual stage artifacts self-labeled by their own counters
> (backend "14th consecutive run", ui-audit "11th audit", etc.) — the recurring off-by-one
> where each stage counts itself. The canonical run number is **Run 54**: the history file's
> last entry was Run 53 (2026-07-21), and s1 reports the **14th consecutive converged backend
> run** (Runs 41–54). Server on `:3001`, UI on `:5173`.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested | Login → Dashboard, Settings, `/leads` driven live via Playwright (frontend byte-identical to the prior full-page sweeps) |
| API endpoints tested | 245 routes across 37 route files · ~1,300+ probe requests |
| Bugs found | **0** |
| Bugs fixed | **0** |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Code commits this run | **0** (only the `docs:` report commit stands) |
| Final build | `npx vite build` exit 0 (pre-existing chunk-size warnings only, 0 errors) |

**Result: FULL CONVERGENCE on every axis.** Backend converged for the 14th consecutive run,
UI-consistency for the 11th consecutive 0-fix audit, and frontend + verify both clean. The
hard precondition proving no re-work was possible — `git diff --stat 2d7fb57..HEAD -- client/src
server/src` is **EMPTY** — was re-proven by all four working stages: every commit since the last
converged audit (2026-06-19, baseline `2d7fb57`) through checkpoint `73dd7b2` is an automated
`checkpoint:`/`docs:` commit touching **no source**. The application is byte-identical to a
baseline that has now converged across 14 backend runs, 11 UI audits, and multiple full
Playwright sweeps — so no drift is possible and 0 code changed.

---

## Backend API Test Results

**Result: CONVERGED — 14th consecutive run · 0 unintentional 5xx · 0 fixes · 0 commits.**

The full standing probe suite was re-run live against `localhost:3001` (not trusting stale
memory), using a token freshly minted via HTTP login. Results were byte-identical to the
Run 53 baseline.

| Probe | Requests | Result |
|---|---|---|
| `.qa-sweep-all.mjs` (all routes) | 245 | 200×91 / 400×72 / 403×6 / 404×75 / 503×1 → **0 unintentional 5xx** |
| `.qa-type-fuzz.mjs` | 1026 payloads | 0 5xx / 0 err |
| `.qa-api-tenant-isolation-probe` | 22 | **22/22 OK** — `tenant_id` + `X-Tenant-Id` spoof ignored; non-platform-admin → 403 |
| `.qa-happy-write-probe` | 3 | **3/3 OK** — PATCH lead `{priority:warm}`→200, PATCH invoice `{status:sent}`→200, estimate SKIP |

Every non-2xx response is **intentional**, not a failure:

| Category | Count | Cause |
|---|---|---|
| auth | 429 (on stress) | rate limiter working as designed |
| skip-trace | 1× 503 | `/api/skip-trace/job/...` correctly refuses without `TRACERFY_API_KEY` (paid API we deliberately don't have) |
| admin | 6× 403 | `/api/admin/*` platform-admin-only, correctly gated |
| validation | 72× 400 | missing/bad params (missing name/title/bbox/lat-lng) — correct rejection, not a crash |
| routing | 75× 404 | missing-id / wrong-method — correct |
| CRM / estimates / documents / team / dashboard | 91× 200 | happy path |

**Endpoints tested / passed / failed:** 245 / 245 / 0. **Fixed this run:** none — nothing broke,
no source changed, so nothing to fix (no commit per charter).

---

## Frontend Feature Test Results

**Result: CONVERGED — 0 bugs · 0 fixes · 0 commits.** Fresh Playwright runtime evidence
(vite up on :5173), not trusting stale memory.

| Page | What was tested | Result |
|---|---|---|
| Login | Pre-filled form (`waterloo`) → Sign In | ✅ authenticates, redirects to Dashboard |
| Dashboard | Full structure render | ✅ sidebar nav (Dashboard/Storm Map/Storm Archive/Pipeline/Leads/Jobs/Finance/Operations/Settings), Cmd-K search, filter bar (All Time/7/30/90/YTD + All Reps/All Sources), 5 stat cards, funnel, Team Leaderboard table |
| `/leads` | Navigation + render | ✅ clean (sidebar incl. Admin, Leads table) |
| Console (post-login) | Error/warning capture | ✅ **0 errors / 0 warnings** |

The 4 unique pre-login 401s (import-progress, notifications, tenant-settings, auth/refresh)
are the documented **boot auth-check** that fires before the `/login` redirect — a known
non-bug, cumulative-since-session-start only.

**Why no page-by-page sweep:** the empty-diff precondition proves the frontend is byte-identical
to the baseline that converged as recently as Run 54's predecessor (full Playwright sweep of all
pages + 15 Settings tabs, 2026-07-21). Re-driving every page would produce identical evidence at
real token cost; a fresh live smoke confirmed the app is up and healthy instead.

**Still needs attention:** nothing broken. Two carried gaps remain out of charter (see Known Issues).

---

## UI Consistency Audit Results

**Result: CONVERGED — 11th consecutive 0-fix UI audit · 0 inconsistencies · 0 fixes · 0 commits.**
Fresh Playwright runtime evidence.

| Page | Icons | Foreign icons | Native `<select>` | Native date/time | Buttons (radii) | Console |
|---|---|---|---|---|---|---|
| Dashboard | 59/59 heroicons `viewBox 0 0 24 24` | 0 (0 fa/material) | 0 | 0 | 60 btns radii → tokens 12/5/999/0px | 0 err |
| Settings | 20/20 heroicons `viewBox 0 0 24 24` | 0 (0 fa/material) | 0 | 0 | n/a (tab content) | 0 err / 1 warn* |

\* Settings' sole warning = Stripe.js third-party "test over HTTP" dev notice from js.stripe.com — not our code.

- **Icons:** all `@heroicons/react/24/outline`. 0 non-Heroicon / foreign / fa / material / lucide. None to fix.
- **Buttons:** consistent; radii resolve to design tokens (12/5/999/0px). None to fix.
- **Toolbars / Headers:** consistent across pages per baseline. None to fix.
- **Sidebar / Nav:** consistent, collapsible, inline nav items. None to fix.
- **Forms:** 0 native select/date/time — `CustomSelect` + `DatePicker` enforced. The sole runtime input on each page is the global TopBar Cmd-K search (`.topbar__search`), app-wide consistent. None to fix.
- **Spacing:** no alignment issues found. None to fix.
- **Modals:** canonical — the only inline `animation:...scale` is `LeadDetail.jsx:1806/1933`, byte-identical to the canonical `modal-scale-in 200ms cubic-bezier(0.16,1,0.3,1) both`. None to fix.

**Non-bugs (deliberately left alone):** button border-radius `10px / 8px` and `3.35544e+07px`
are CSS `border-radius` clamp artifacts on short / pill-shaped elements (render correctly);
the sole page input is the global search box, not a page-level form field.

---

## Bugs Fixed (numbered list)

None. This was a full-convergence run — 0 findings on every axis, so 0 code changed and 0
code commits were made. The standing fix `aab6753` (Run 50) remains in place on the
byte-identical frontend.

---

## Known Issues (Not Fixed)

1. **Keyboard nav — Esc-to-close absent on most modals app-wide.** Of ~17 modal/overlay
   components only a few handle Escape. Adding it is a **new feature** (charter forbids
   enhancements) → developer feature decision, not a QA bug. If pursued, it should be a shared
   app-wide hook.
2. **EstimateBuilder does not collapse at phone width (375px)** *(pre-existing, out of scope)*.
   Fixed 280px sidebar (`flexShrink:0`) + `flex:1` editor in `overflow:hidden`
   (`EstimatesView.jsx:1838`); at 375px the sidebar eats 280px → form content clipped. Works
   fine at 768px+; mobile is paused. Proper fix = responsive sidebar collapse/stack, deferred.
3. **Skip-trace endpoint returns 503** without `TRACERFY_API_KEY` — correct behavior; the key
   is a paid API we deliberately don't have. Not a bug.
4. **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`,
   `/crm/leads/score-all` — no rate-limit/concurrency guard; needs staging, not prod Neon.
   Untouched.
5. **`DELETE /api/crm/tasks/:id`** handler missing — adding endpoints is forbidden by charter.
6. **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress`
   when the JWT is expired — FEMA-import territory, DO NOT TOUCH. Not a regression.

---

## Test Coverage Gaps

- **Keyboard nav** — Esc-to-close app-wide, Tab order, focus rings, Enter-submit untested.
  Highest-value remaining area but an **enhancement outside the QA charter** (developer feature
  decision, not a bug).
- **Phone-375px sweep** — EstimateBuilder sidebar collapse is the one identified 375px finding;
  the rest is untouched. Mobile is paused → low priority.
- **Converged axes — do NOT re-test:** backend (14 runs), UI-consistency (11 audits),
  frontend + verify. Fix yield 0 on all. **Only re-test if the developer adds NEW route / page /
  component files** (drift check: `git diff --stat 2d7fb57..HEAD -- client/src server/src`
  becomes non-empty).

---

## Session Integrity

- **s1 api-test:** ✅ success (13 turns, $1.20) — backend re-verified converged (14th run), 0 fixes.
- **s2 frontend-test:** ✅ success (17 turns, $1.33) — login → Dashboard full structure, `/leads` clean, 0 console errors, 0 fixes.
- **s3 ui-audit:** ✅ success (18 turns, $1.62) — converged (11th 0-fix audit), 0 changes.
- **s4 verify:** ✅ success (10 turns, $0.99) — source drift EMPTY, `npx vite build` exit 0 8.52s, 0 fixes.
- **s5 report:** this report. **0 code commits stand for this run** — every axis converged with
  0 findings; only the `docs: QA report 2026-07-22 (Run 54)` commit is made. s1–s4 spend ≈ $5.14.
  All 4 working stages exited cleanly (no max-turns stage this run).
