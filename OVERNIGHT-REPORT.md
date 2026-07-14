# StormLeads — Overnight QA Report

**Run 52 · 2026-07-14 · branch `feat/financing`**

> Run-number note: the s4 stage artifact self-labeled this "Run 53" (an off-by-one, same
> pattern as prior runs); the canonical number is **Run 52** — the history file's last entry
> was Run 51 (2026-06-19), and s1 reports the **12th consecutive converged backend run**
> (Runs 41–52). Server on `:3001`, UI on `:5173`.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Backend API endpoints tested | 245 routes (~1,300+ requests across the full probe suite) |
| Frontend pages/views tested | Dashboard boot + estimate-builder @768px + `/leads` empty-state edge (runtime spot-check; code byte-identical to the prior 100%-complete tablet-768px sweep) |
| UI-consistency audit dimensions | 7 (icons, forms, modals, buttons, headers, sidebar, spacing) |
| **Bugs found** | **0** |
| **Bugs fixed** | **0** |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| **Total commits this run** | **0** |

A full-convergence run. The decisive fact this run is a **hard precondition**:
`git diff --stat 2d7fb57..HEAD -- client/src server/src` is **empty**. Every commit since the
last converged audit (Run 51, 2026-06-19) is an automated `checkpoint: pre-overnight-run` that
touches no application source, so the frontend and backend code is **byte-identical** to the
prior converged runs — no drift is possible. Every stage confirmed this anyway with live probes
and builds rather than merely asserting it. 0 findings on every axis correctly produced 0 commits
(the charter is "if it works, leave it alone").

---

## Backend API Test Results

s1 re-ran the full standing probe suite against `:3001`. Every result is **byte-identical to the
Run 51 baseline**.

**Verdict: BACKEND CONVERGED — 12th consecutive run with 0 code fixes. 0 unintentional 5xx.**

| Probe | Requests | Result |
|---|---|---|
| `.qa-sweep-all.mjs` | 245 | 200×91, 400×72, 403×6, 404×75, 503×1 — 0 unintentional 5xx |
| `.qa-type-fuzz.mjs` | 1026 | 0 5xx / 0 err |
| `.qa-api-tenant-isolation-probe` | 22 | 22/22 OK (injection ignored, non-admin → 403) |
| `.qa-happy-write-probe.mjs` | 3 | 3/3 OK (PATCH lead/invoice → 200, estimate skip) |
| `.qa-gaps-probe.mjs` | many | 0 5xx; bad-uuid → 400, zero-id → 404 correct |
| `.qa-api-edge-probe.mjs` | many | 0 5xx; sql-inj-search → empty, wrong-method → 404, clamped limits → 200 |

**By category — all passed, 0 failed, 0 fixed:**
- **Auth** — login/refresh validate correctly. Only non-200 is the HTTP login rate limiter (429 ~10/15min).
- **CRM (leads/tasks/activities/invoices)** — full CRUD surface clean. Happy-path `PATCH /crm/leads/:id {priority:"warm"}` → 200; `PATCH /crm/invoices/:id {status:"sent"}` → 200.
- **Estimates / documents / financing / payments** — clean. Financing (the active `feat/financing` dev area) returns its plan data without error.
- **Skip-trace** — `GET /skip-trace/job/:jobId` → 503 "Skip trace service not configured" (no `TRACERFY_API_KEY`; intentional per the zero-paid-API constraint).
- **Admin** — 6× 403 on `/api/admin/*` (the test user is a tenant admin, not platform-admin — correct authz).

**Tenant isolation (22/22):** `tenant_id` injected via query string, POST body, and `X-Tenant-Id`
header are all ignored (returns own-tenant Waterloo data only); foreign/zero UUIDs → 404, never
cross-tenant leakage; `/api/admin/tenants` as non-platform-admin → 403.

**What was fixed:** nothing. Fix yield has been 0 for 12 consecutive runs — the backend is
converged and should not be re-tested unless the developer adds new route files.

---

## Frontend Feature Test Results

The frontend source is byte-identical to the Run 51 sweep (which completed the tablet-768px sweep
100% across the whole app), so no page could have regressed. s4 nonetheless drove the app at
runtime to produce real evidence.

| Page / View | What was tested | Result |
|---|---|---|
| **Dashboard** | Boot at `/`, full real-data render, console | ✅ renders full real data, 0 console errors |
| **EstimateBuilder** (`/estimates` → builder) | Roof Components toolbar wrap @768px (standing fix `aab6753`); builder console | ✅ toolbar wraps — "From preset / Add All / Blank Row" on line 1 (y=1274), "Add from SRS Catalog" on line 2 (y=1318, right=501, in viewport); 0 body/doc overflow; 0 console errors — **4th consecutive verify confirming it holds** |
| **Leads** (`/leads`) | Empty-state edge (`?search=zzzzqqnoexist999`) | ✅ "No leads found", 0 overflow |
| **Whole session** | Console across all navigation | ✅ 0 errors / 0 warnings |

- **What passed:** every driven view rendered correctly with no console errors and no layout overflow.
- **What was broken / how fixed:** nothing broken this run; no fixes required.
- **What still needs attention:** two long-carried items remain **out of charter** (see Known Issues) — Esc-to-close keyboard nav (an enhancement) and EstimateBuilder sidebar collapse at 375px phone width (mobile is paused; works fine 768px+).

> Note: the s2 frontend-test stage hit `error_max_turns` (81/80 turns, $6.11) and did not emit an
> end-of-run summary. Because it was exercising a byte-identical frontend, s4's runtime spot-check
> is the authoritative frontend evidence for this run; no bug was found and no commit was produced
> by either stage.

---

## UI Consistency Audit Results

s3 ran a definitive code-grep over all of `client/src` plus a Playwright runtime spot-check.
**Precondition:** `git diff 2d7fb57..HEAD -- client/src` is empty and the working tree is clean, so
the code is byte-identical to the prior 8 converged audits.

**Verdict: UI-CONSISTENCY CONVERGED — 9th consecutive 0-fix audit. 0 inconsistencies, 0 fixes.**

| Category | Finding | Fixed? |
|---|---|---|
| **Icons** | 0 non-Heroicon icons. Code-grep: 0 solid/20/lucide/react-icons/fa/mui/material. Runtime: Dashboard 70/70 & Settings 31/31 Heroicons (`viewBox 0 0 24 24`), 0 foreign, 0 FontAwesome/Material. Inline `<svg>` only in CanvassingMode + StormMap (decorative FEMA map SVGs — DO NOT TOUCH) + the unimported `Icons.jsx.backup`. | N/A — none found |
| **Buttons** | Runtime Settings 46 buttons, radii group to design tokens. Recurring false-positive: radii `14px/12px` & `10px/8px` are CSS border-radius **clamping** artifacts on short elements, not one-off styles — left alone. | N/A — none found |
| **Toolbars / Headers** | Consistent across pages; no drift (code unchanged). | N/A — none found |
| **Sidebar / Nav** | No issues; code unchanged since prior converged audit. | N/A — none found |
| **Forms** | 0 native `<select>` / `<input type=date/time>` in the entire source (CustomSelect + DatePicker enforced). Runtime Settings: 0 native select, 0 native date. | N/A — none found |
| **Spacing / Alignment** | 0 overflow / alignment issues at driven widths. | N/A — none found |
| **Modals** | All canonical. Only inline `animation:` is LeadDetail:1806/1933, byte-equal to the canonical `modal-scale-in 200ms ease-apple`. | N/A — none found |

Build after the audit was clean (7.94s, only pre-existing chunk-size warnings).

---

## Bugs Fixed (numbered list)

1. *None.* This was a full-convergence run — 0 bugs found on any axis, so 0 code was changed
   (source diff since the pre-run checkpoint is empty; only QA artifacts are dirty in the working
   tree). The most recent standing fix, `aab6753` (Run 50 — estimate-builder toolbar `flex-wrap`
   @768px), was re-verified working at runtime for the 4th consecutive run.

---

## Known Issues (Not Fixed)

- **Keyboard nav — Esc-to-close absent on most modals app-wide.** Of ~17 modal/overlay components
  only a few handle Escape; most close via X/backdrop only. Adding it where it never existed is a
  **new feature** — the QA charter forbids enhancements — so this is tracked as a developer feature
  decision, not a QA bug. If pursued, it must be a shared app-wide hook (committing one component
  alone would *increase* inconsistency).
- **EstimateBuilder does not collapse at phone width (375px).** The builder body is a flex-row with
  a fixed 280px sidebar (`flexShrink:0`, holds the section enable/disable toggles — functional, not
  just nav) + a `flex:1` editor inside an `overflow:hidden` container (`EstimatesView.jsx:1838`). At
  375px the sidebar eats 280px and form content is clipped/unreachable. **Works fine at 768px+** and
  **mobile is paused** (web-app-only focus), so this is low-priority. A proper fix = responsive
  sidebar collapse/stack, which is a design-sized change — deferred.
- **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`,
  `/crm/leads/score-all` — no rate-limit/concurrency guard; needs a staging environment to exercise
  safely, not production Neon. Untouched.
- **`DELETE /api/crm/tasks/:id`** handler is missing — adding endpoints is forbidden by the charter.
- **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when
  the JWT is expired — FEMA-import territory, gracefully handled, DO NOT TOUCH. Not a regression.

---

## Test Coverage Gaps

- **Keyboard nav** — Esc-to-close app-wide, Tab order, focus rings, Enter-submit remain untested.
  Highest-value remaining *area*, but it is an **enhancement outside the QA charter** (a developer
  feature decision, not a bug), so it is intentionally not pursued by these QA runs.
- **Phone-375px sweep** — the EstimateBuilder sidebar collapse is the one identified 375px finding;
  the rest of the phone-width sweep is untouched. Mobile is paused → low priority.
- **Converged axes — do NOT re-test:** backend (12 runs), UI-consistency (9 audits), and the
  tablet-768px sweep (100% complete). Fix yield is 0 on all three. Within the charter the app is
  converged on every axis; the only thing that would warrant re-testing is the developer adding
  **new pages/component files** (drift vector = a new modal with a non-canonical inline animation —
  fast check: grep `components/*.jsx` for inline `animation:...scale`).

---

## Session Integrity

- **s1 api-test:** ✅ success (13 turns, $1.13) — backend re-verified converged (12th run), 0 fixes.
- **s2 frontend-test:** ⚠️ `error_max_turns` (81/80, $6.11) — no end summary; exercised a
  byte-identical frontend, produced no bug and no commit.
- **s3 ui-audit:** ✅ success (13 turns, $1.26) — converged (9th 0-fix audit), 0 changes; build clean 7.94s.
- **s4 verify:** ✅ success (28 turns, $2.23) — Dashboard boots clean, `aab6753` re-verified @768px
  (4th consecutive), edge cases pass, 0 console errors, build clean 7.65s, 0 fixes.
- **s5 report:** this report. **0 commits stand for this run** — every axis converged with 0 findings.
  s1–s4 spend ≈ **$10.73**.
