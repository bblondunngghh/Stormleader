# Overnight QA Report — StormLeads — 2026-06-16 (Run 48)

Branch: `feat/financing` · Server: `http://localhost:3001` · Client: `http://localhost:5173`
Tenant under test: waterloo (`791bb51d-3293-4839-92e9-bd4d4f873af2`)
Checkpoint: `8914c0a` (pre-overnight-run 2026-06-16) → HEAD `3d234ff`

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend pages exercised / captured | 8 (Dashboard, Leads, Import-leads modal at runtime; Calendar, Canvassing, Invoices, Pipeline, Settings·Reviews captured at 768px) |
| API endpoints tested | 272 routes inventoried (38 route files); ~1,180 probe requests |
| Bugs found | 2 |
| Bugs fixed | 2 |
| UI inconsistencies found | 1 |
| UI inconsistencies fixed | 1 |
| Commits this run | 2 (`c9a6954`, `3d234ff`) |

Net: backend remains converged (8th consecutive 0-fix run). All defects this run were
frontend — one modal-animation drift and one cluster of missing accessible names — both fixed
and committed. No known issues were newly introduced.

---

## Backend API Test Results

Stage s1 re-ran the full standing probe suite against the live server as a confirmation pass.
**Verdict: CONVERGED — 8th consecutive run with 0 code fixes, 0 unintentional 5xx anywhere.**

| Probe / category | Endpoints | Result |
|---|---|---|
| `uncovered-get` GET sweep | 63 | 62 `<500`, 1 intentional 503 (skip-trace, no API key) — 0 unintentional 5xx |
| `gaps` / `edge` / `typefuzz-2` | negative cases | all 400/404/200 as expected, 0 5xx |
| `type-fuzz` | 1026 payloads | 0 5xx |
| `tenant-isolation` | 22 checks | **22/22 pass** — `tenant_id` via query/body/`X-Tenant-Id` all ignored; non-platform-admin → 403 |
| `patch-delete` | foreign/zero ids | all → 404, 0 5xx |

### Happy-path write verification (valid payloads)
| Endpoint | Method | Status | Result |
|---|---|---|---|
| `/api/auth/login` | POST | 200 | token issued (15-min lifetime) |
| `/api/crm/leads?limit=1` | GET | 200 | own-tenant leads |
| `/api/crm/leads/:id` `{notes}` | PATCH | 200 | accepted |
| `/api/crm/leads/:id` `{priority:"high"}` | PATCH | 400 | **correct** — enum is hot/warm/cold (not a bug) |
| `/api/crm/dashboard/stats` | GET | 200 | stats returned |
| `/api/crm/invoices?limit=1` | GET | 200 | invoices returned |
| `/api/crm/invoices/:id` `{status}` | PATCH | 200 | accepted |

### Intentional non-200s (NOT bugs)
- `GET /api/skip-trace/job/:jobId` → 503 (no `TRACERFY_API_KEY` configured)
- `POST /api/auth/login` (repeated) → 429 (rate limiter, ~10/15min)
- `GET /api/storm-history/`, `/heatmap` → 400 (required params missing)

**Fixed: none.** Backend fix yield has been 0 for 8 consecutive runs. Per QA charter
(if it works, leave it alone) no backend changes were made.

---

## Frontend Feature Test Results

| Page / surface | What was tested | Passed | Broken → fix | Still needs attention |
|---|---|---|---|---|
| **Import-leads modal** | Open animation, glass render | ✅ after fix | Inline animation drift → `c9a6954` | — |
| **Leads (LeadList)** | Select-all + per-row checkbox accessible names; @768px Address column; empty-state | ✅ | Unlabeled checkboxes → `3d234ff` | — |
| **Dashboard** | Task-complete button name/type; activity-feed keyboard region; console errors | ✅ | Unnamed button + non-focusable region → `3d234ff` | — |
| **Materials** (regression) | @768px tab-row scroll holds (Run 47 fix) | ✅ | — | — |
| **Calendar** | Captured at 768px (`qa-768-calendar.jpeg`) | screenshot only | — | Not analyzed (s2 ran out of turns) |
| **Canvassing** | Captured at 768px (`qa-768-canvassing.jpeg`) | screenshot only | — | Not analyzed |
| **Invoices** | Captured at 768px (`qa-768-invoices.jpeg`) | screenshot only | — | Not analyzed |
| **Pipeline** | Captured at 768px (`qa-768-pipeline.jpeg`) | screenshot only | — | Not analyzed |
| **Settings · Reviews** | Captured at 768px (`qa-768-settings-reviews.jpeg`) | screenshot only | — | Not analyzed |

The frontend test stage (s2) reached its turn limit before writing a findings summary or
`/tmp/frontend-test-results.txt`. It did capture tablet-768px screenshots of five
non-Dashboard pages, but those images were **not yet analyzed** — they carry forward as
the highest-value next-run target. All committed frontend fixes this run came from the
UI-audit (s3) and verify (s4) stages, which both completed cleanly.

---

## UI Consistency Audit Results

Method: code-level grep over `client/src` (definitive) + Playwright runtime walk (Dashboard,
Leads). **1 genuine inconsistency found + fixed; all other axes converged (5th consecutive).**

| Axis | Result | Fixed? |
|---|---|---|
| **Icons** | 38 `@heroicons/react/24/outline` imports + `Icons.jsx` wrapper; 0 solid/lucide/fontawesome/MUI/react-icons; 0 inline `<svg>` used as UI icon. New files (CalendarView, ImportLeadsModal, MaterialsView) all import via wrappers. | n/a — clean |
| **Buttons** | Consistent within semantic groups: nav-link 42px/r12, topbar 38px/r12, quick-action 36px/r14, CustomSelect 36px/r12, time-filter pills 23px/r999. | n/a — clean |
| **Toolbars / Headers** | Single shared `TopBar` on every page (Help + Notifications + global search, 38px controls); per-page title bars present. No drift. | n/a — clean |
| **Sidebar / Nav** | nav-link 42px/r12; group headers 22px/fw700/11px labels; child links indent 28px; active via `is-active`. Uniform. | n/a — clean |
| **Forms** | 0 native `<select>`, 0 native `<input type="date">` in the entire tree (CustomSelect + DatePicker enforced); `.form-input` applied consistently (36px/r12). | n/a — clean |
| **Spacing / Alignment** | `--space-*` and radius tokens throughout; Leads page body overflow = 0. | n/a — clean |
| **Modals** | Two intentional patterns (`.modal-backdrop` centered ×14, `.slide-over` drawer ×6). One drift fixed: ImportLeadsModal hardcoded `animation:'modal-scale-in 0.25s ease-out'` (250ms/ease-out/no fill-mode) vs canonical 200ms `var(--ease-apple)` `both`. Removed inline override. LeadDetail.jsx:1792/1919 inline overrides are *exactly equal* to canonical → left alone. | ✅ `c9a6954` |

Deliverable: `C:\tmp\ui-audit-results.txt`. Runtime re-verify after fix: computed style =
`modal-scale-in 0.2s cubic-bezier(0.16,1,0.3,1) both`, no inline override.

---

## Bugs Fixed

1. **ImportLeadsModal (UI / modal animation)** — the Import-from-CSV modal hardcoded an inline
   `animation: 'modal-scale-in 0.25s ease-out'` on its `.modal-backdrop > .glass` child,
   diverging from every other modal on three axes (250ms vs 200ms, ease-out vs `--ease-apple`,
   missing `both`). **Fix `c9a6954`:** removed the inline override so it inherits the canonical
   `.modal-backdrop > .glass` rule. Verified at runtime + build clean.

2. **Lead-table & Dashboard (a11y / accessible names)** — the lead-table select-all and per-row
   select checkboxes had no accessible name (screen readers announced a bare "checkbox"); the
   Dashboard task-complete button had no name and no explicit `type`; the Dashboard activity feed
   was not keyboard-focusable. **Fix `3d234ff`:** added `aria-label`s
   ("Select all leads on this page" / "Select lead &lt;address&gt;"), set the task button to
   `type="button"` with `aria-label`/`title`, and made the activity feed `role="region"` +
   `tabindex="0"` + `aria-label`. No visual change. Verified at runtime.

---

## Known Issues (Not Fixed)

Carried from prior runs — each blocked by an external dependency or charter, not a regression:

- **#6 Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`,
  `/crm/leads/score-all` — no rate-limit/concurrency guard. Needs a staging environment, not
  prod Neon (DB-cost charter). Untouched.
- **#9 `DELETE /api/crm/tasks/:id`** handler missing — adding an endpoint is forbidden by charter
  (missing feature, not a bug).
- **Esc-to-close** absent on modals app-wide — pre-existing pattern; belongs to the keyboard-nav
  gap and must be applied consistently in a dedicated stage, not piecemeal.
- **`TopBar` ImportProgress poller** logs a 401 on `/api/properties/import-progress` when the JWT
  is expired — handled gracefully (token guard + silent catch). Touches FEMA import → DO NOT TOUCH.
- **Cosmetic (carried):** `/alerts` has 2 raw `<input type="text">` without `.form-input`;
  `/reports` & `/settings` `.glass` cards use 16px radius vs app-standard 20px; Reports chart
  label overlap at ~930px viewport.

---

## Test Coverage Gaps

1. **Tablet-768px sweep — five pages captured but NOT analyzed.** The frontend stage shot
   `qa-768-{calendar,canvassing,invoices,pipeline,settings-reviews}.jpeg` before running out of
   turns. Reviewing these images is the single highest-value next-run task. Still un-swept at
   768px beyond those: Tasks, Reports, Estimates list+builder, LeadDetail, Subcontractors,
   Expenses, Work Orders, Contracts, remaining Settings tabs. (Done & clean: Dashboard, Leads, Materials.)
2. **a11y / axe-core full sweep — never run.** Only spot accessible-name fixes done so far
   (`3d234ff`). No automated axe-core pass has ever been executed.
3. **Keyboard navigation — never tested.** Tab order, focus rings, Enter-to-submit, and
   Esc-to-close are all unverified app-wide.
4. **Frontend stage (s2) incomplete.** It hit the turn limit (81/80) with no summary and no
   `/tmp/frontend-test-results.txt`; its only durable output was the five screenshots above.

---

## Stage Integrity

| Stage | Outcome | Turns | Commits |
|---|---|---|---|
| s1 api-test | ✅ end_turn | 23 | 0 (backend converged) |
| s2 frontend-test | ⚠️ error_max_turns | 81/80 | 0 (no summary; 5 screenshots only) |
| s3 ui-audit | ✅ end_turn | 28 | `c9a6954` |
| s4 verify | ✅ end_turn | 41 | `3d234ff` (verified s3-staged a11y edits, then committed) |
| s5 report | this report | — | docs commit |

3 of 4 working stages exited cleanly. The one max-turns stage (s2) produced only screenshots,
leaving the tablet-768px analysis as the carried-forward gap.
