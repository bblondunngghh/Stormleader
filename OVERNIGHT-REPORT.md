# Overnight QA Report — StormLeads

**Run 49** · 2026-06-17 · branch `feat/financing` · checkpoint `9a73d99`

> Run-number note: the s3 (ui-audit) and s4 (verify) stages self-labeled this "Run 50,"
> but the canonical number is **Run 49** — the history file's last entry is Run 48
> (2026-06-16), and the backend is on its **9th consecutive converged run (Runs 41–49)**.
> This report and the history file use Run 49. (The off-by-one in s3/s4 labels recurs each run.)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend pages tested | 13 (a11y/axe-core sweep) + 8 (UI-consistency runtime walk) + 3 (runtime re-verify) |
| API endpoints tested | 272 routes · ~1,330 requests |
| Bugs found | 3 (all a11y/axe-core violations) |
| Bugs fixed | 3 |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| Code commits this run | **1** — `8f55a02` (a11y fixes on Tasks, Work Orders, Calendar) |
| Build | `npx vite build` clean, 7.55s |

**Headline:** This run landed the **first real axe-core accessibility sweep** — a coverage gap
that had been carried for 8+ runs. Three WCAG violations were found and fixed in a single commit
(`8f55a02`), verified working at runtime, and the build is clean. Backend (9th run) and
UI-consistency (6th audit) both remain converged with zero fixes.

---

## Backend API Test Results

**Stage s1 (api-test): ✅ completed cleanly — backend CONVERGED, 9th consecutive 0-fix run.**

Full standing probe suite re-run against the live server (`:3001`), ~1,330 requests across the
entire 272-route surface. Admin token minted DB-direct via `.qa-mint-token.mjs` (bypasses the
HTTP login rate limiter).

| Probe | Requests | Result |
|---|---|---|
| Full sweep (`.qa-full-sweep`) | 272 routes | **0 unintentional 5xx** |
| Tenant isolation | 22 | **22/22** — no cross-tenant leak |
| Type-fuzz (`.qa-type-fuzz`) | 1026 malformed payloads | **0 5xx** |
| Happy-path writes | 3 | 2×200, 1 skip (no row) |
| Edge cases (`.qa-api-edge`) | 11 | 0 5xx, all codes correct |
| Gaps probe (`.qa-gaps`) | 12 | 0 5xx, all codes correct |

**Full-sweep status distribution (272 routes):**
`200`×96 (healthy reads + valid no-op writes) · `400`×89 (validation rejecting empty `{}` —
correct) · `403`×6 (platform-admin-only routes; admin token is tenant-admin — correct) ·
`404`×76 (sample UUID `0000…` not found — correct) · `503`×1 (**intentional** — skip-trace,
no `TRACERFY_API_KEY`) · 4 skipped (auth login/register/refresh/logout + hearth webhook need
special bodies).

By category — every category passed; **0 endpoints failed, 0 fixed (nothing was broken):**

| Category | Tested | Pass | Fail / Fixed |
|---|---|---|---|
| Auth | login/register/refresh/logout + token guards | all | 0 / 0 |
| CRM (leads, tasks, activities, pipeline) | included in 272 | all | 0 / 0 |
| Estimates / Invoices / Payments | included in 272 | all | 0 / 0 |
| Work orders / Documents / Team / Search / Notifications | included in 272 | all | 0 / 0 |
| Financing | included in 272 | all | 0 / 0 |
| Skip-trace | 1 | n/a | 503 intentional (paid API off) |
| Admin / platform | 6 | all | 403 correct (non-platform-admin) |

**Tenant isolation (22/22):** foreign-tenant estimate GET/PUT/DELETE/PDF → 404; `tenant_id`
injection via query string / request body / `X-Tenant-Id` header all ignored (own-tenant data
only); `/api/admin/tenants` as non-platform-admin → 403; baseline vs injected row counts
identical across 14 list endpoints.

**Edge / error handling (0 5xx):** malformed JSON → 400; bad UUID → 400; no-auth → 401; bad
token → 401; unknown route → 404; SQL-injection in search → 200 empty (neutralized); huge
limit / negative offset → 200 (graceful); wrong HTTP method → 404.

**Intentional non-200s (NOT bugs):** skip-trace 503 (`TRACERFY_API_KEY` unset — paid API
deliberately off); auth 429 (login rate limiter); `PATCH lead {priority:"high"}` → 400 (correct
— the priority enum is `hot/warm/cold`).

**Conclusion:** Backend has converged for 9 consecutive runs (Runs 41–49); fix yield = 0.
No code changes this stage (charter: *if it works, leave it alone*). Deliverable:
`C:\tmp\api-test-results.txt`.

---

## Frontend Feature Test Results

**Stage s2 (frontend-test): ⚠️ hit the 80-turn limit (81/80) — no end-of-run summary, but it
DID land this run's one code commit before turns ran out.**

This stage ran the long-deferred **axe-core 4.10.2 accessibility sweep** via Playwright across a
13-page WCAG 2.1 A/AA pass. It found and fixed three violations (commit `8f55a02`), then ran out
of turns partway into a follow-on keyboard-nav effort (see *Known Issues* — it left one
uncommitted unused import).

| Page | Tested | Result / Fix |
|---|---|---|
| **Tasks** | axe-core: task-complete toggle buttons | **BROKEN → FIXED.** Toggle buttons had no accessible name (axe `button-name`, critical, 15 nodes). Added `type=button`, `aria-pressed`, stateful `aria-label`. |
| **Work Orders** | axe-core: kanban board keyboard access | **BROKEN → FIXED.** Horizontally-scrollable board had no keyboard access (axe `scrollable-region-focusable`, serious). Added `role=region`, `aria-label="Work orders board"`, `tabindex=0`. |
| **Calendar** | axe-core: FullCalendar chevron icons | **BROKEN → FIXED.** Prev/next chevron spans rendered `role=img` with no alt text (axe `role-img-alt`, serious, 2 nodes). Stripped the role and marked icons `aria-hidden` via a `datesSet` hook (re-applies on nav). |
| Other 10 pages in the 13-page WCAG sweep | axe-core A/AA | **PASS** — 0 violations (per the commit message's full-sweep note). |

**Needs attention (carried):** the keyboard-nav follow-on (Esc-to-close on modals app-wide, Tab
order, focus rings, Enter-submit) was started but not finished — s2 ran out of turns. See
*Known Issues* and *Coverage Gaps*.

---

## UI Consistency Audit Results

**Stage s3 (ui-audit): ✅ completed cleanly — CONVERGED, 6th consecutive 0-fix UI audit.**

Method: definitive code-level grep over **all** of `client/src` + Playwright runtime walk of 8
pages (Dashboard, Calendar, Settings, Invoices, Pipeline, Tasks, Work Orders, Leads) plus the
Import-leads modal.

| Category | Finding | Fixed? |
|---|---|---|
| **Icons** | 38 `@heroicons/react/24/outline` imports across 37 files. **0** solid/lucide/react-icons/FontAwesome/Material. Runtime: 0 foreign SVGs on every page. Only inline `<svg>` in live components are the decorative map SVGs in `CanvassingMode`/`StormMap` (allowed, FEMA-adjacent). | n/a — clean |
| **Buttons** | Radii group cleanly into design-system tokens (12px primary, 8px tabs/secondary, 0px text). The `14/12px` & `10/8px` values are CSS border-radius *clamping* on short elements, not one-off styles. | n/a — clean |
| **Toolbars / Headers** | Shared TopBar renders consistently on every page. | n/a — clean |
| **Sidebar / Nav** | Shared Sidebar consistent across the walk. | n/a — clean |
| **Forms** | **0** native `<select>` and **0** native `<input type="date"/"time">` in the entire tree — `CustomSelect` / `DatePicker` enforced. `.form-input` applied (42px, r12). Leads filter chips are `CustomSelect` buttons, not native selects. | n/a — clean |
| **Spacing** | `--space-*` / `--radius-*` tokens throughout; no measured overflow drift. | n/a — clean |
| **Modals** | The recurring failure mode (new modal files reintroducing inline-animation drift) is clean: only `LeadDetail.jsx:1792/1919` carry inline animation and both are byte-identical to canonical. New `CalendarView.jsx` clean; ImportLeadsModal verified at runtime as `.modal-backdrop > .glass` with `modal-scale-in 0.2s cubic-bezier(0.16,1,0.3,1) both`. | n/a — clean |

No code changes (charter). Deliverable: `C:\tmp\ui-audit-results.txt`.

---

## Verification Stage

**Stage s4 (verify): ✅ completed cleanly — all fixes verified at runtime, build clean.**

Re-verified the run's only code commit (`8f55a02`) via Playwright + direct DOM inspection:

| Fix | Verified |
|---|---|
| **Tasks** toggle buttons | `type=button` ✓; `aria-pressed` correct on both states (pending=`false`/"…as done", completed=`true`/"…as not done") ✓; stateful `aria-label` with task title ✓ |
| **Work Orders** kanban | `role=region` ✓; `tabindex=0` ✓; `aria-label="Work orders board"` ✓; scroll contained in `overflow:auto` ✓ |
| **Calendar** fc-icons | `role="img"` stripped (0/2) ✓; `aria-hidden=true` (2/2) ✓; **re-applies on nav** — clicked Next, fresh icons re-hidden ✓ |
| Calendar prev/next button name | accessible name comes from FullCalendar's `title="Previous/Next Month"` (valid accname fallback) — no button-name violation introduced ✓ |
| Console errors (all 3 pages) | 0 app errors ✓ |
| Responsive @375px overflow (all 3 pages) | bodyOverflow 0, docOverflow 0 ✓ |
| `npx vite build` | clean, 7.55s (pre-existing mapbox/Reports chunk-size warnings only) ✓ |

No regressions, no new issues, 0 code changes this stage. Deliverable: `C:\tmp\verify-results.txt`.

---

## Bugs Fixed (this run)

All three were fixed in a single commit — `8f55a02 fix(a11y): resolve axe-core violations on
Tasks, Work Orders, Calendar` — and verified at runtime by s4.

1. **[Tasks / TasksView.jsx]** — task-complete toggle buttons had no accessible name (axe
   `button-name`, **critical**, 15 nodes). **Fixed:** added `type=button`, `aria-pressed`, and a
   stateful `aria-label` describing the toggle action and naming the task.
2. **[Work Orders / WorkOrdersView.jsx]** — the horizontally-scrollable kanban board had no
   keyboard access (axe `scrollable-region-focusable`, **serious**). **Fixed:** added
   `role=region`, `aria-label="Work orders board"`, and `tabindex=0`.
3. **[Calendar / CalendarView.jsx]** — FullCalendar's decorative prev/next chevron icons rendered
   with `role=img` and no alt text (axe `role-img-alt`, **serious**, 2 nodes). **Fixed:** stripped
   the `role` and set `aria-hidden` on the icons via a `datesSet` hook so it re-applies on every
   month navigation; the buttons keep their accessible name via FullCalendar's `title` attribute.

---

## Known Issues (Not Fixed)

- **Keyboard nav — incomplete.** s2 began a keyboard-nav pass (Esc-to-close on modals app-wide,
  Tab order, focus rings, Enter-submit) but ran out of turns before finishing. It left one
  **uncommitted** working-tree edit in `client/src/components/ImportLeadsModal.jsx` — an added but
  **unused** `import useEffect`. Harmless (build passes, modal renders canonically), but it is
  dead code from the abandoned effort. Left in place per charter (prior stages deliberately did
  not touch it); should be either completed or reverted next run.
- **#6 Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`,
  `/crm/leads/score-all` — no rate-limit / concurrency guard. Testing this does real bulk work →
  needs staging, not prod-tier Neon. Untouched.
- **#9 `DELETE /api/crm/tasks/:id`** handler missing — adding endpoints is forbidden by charter.
- **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when
  the JWT is expired — handled gracefully, touches FEMA import territory → DO NOT TOUCH. Not a
  regression.
- **axe-core not a local dependency.** The s2 sweep installed axe-core 4.10.2 transiently; it was
  **not** added to `package.json` (charter forbids enhancements). s4 therefore re-verified the
  three fixes by targeted DOM-attribute inspection rather than re-running axe. If recurring
  axe-core sweeps are wanted, adding it as a dev-dependency is a design decision for the developer.
- **(cosmetic, carried)** `/alerts` has 2 raw `<input type="text">` without `.form-input` glass
  styling; `/reports` & `/settings` `.glass` cards use 16px radius vs app-standard 20px; Reports
  chart label overlap at ~930px viewport.

---

## Test Coverage Gaps

- **s2 (frontend-test) hit the 80-turn limit** and produced no clean end-of-run summary or
  `frontend-test-results.txt` deliverable — though it did land commit `8f55a02` first. The
  unfinished keyboard-nav work is the direct cause of the dangling uncommitted import.
- **Keyboard navigation** — still not fully swept: Esc-to-close is missing on modals app-wide;
  Tab order, focus rings, and Enter-submit are untested. Highest-value remaining gap; should be a
  dedicated stage applied consistently app-wide.
- **Tablet-768px sweep** — done & clean: Dashboard, Leads, Materials, Tasks, Work Orders, Calendar
  (all 0-overflow @375px). Still un-swept at 768px: Invoices, Reports, Estimates list+builder,
  LeadDetail, Subcontractors, Expenses, Contracts, Settings tabs. The 5 previously-captured
  `qa-768-*.jpeg` screenshots remain un-analyzed.
- **Backend (converged, 9 runs) and UI-consistency (converged, 6 audits)** — do NOT keep
  re-testing these; fix yield has been 0. Future runs are best spent on the keyboard-nav and
  remaining tablet-768px gaps above.

---

*Stage outcomes: s1 ✅ ($1.84) · s2 ⚠️ max-turns 81/80 ($5.58, landed `8f55a02`) · s3 ✅ ($2.07) ·
s4 ✅ ($1.76) · s5 this report. s1–s4 spend ≈ $11.25. 3/4 working stages exited cleanly; the
max-turns stage still produced this run's one commit.*
