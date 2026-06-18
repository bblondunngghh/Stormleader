# StormLeads — Overnight QA Report

**Run 50 · 2026-06-18 · branch `feat/financing`**

> Run-number note: the s3/s4 stage artifacts self-labeled this "Run 50/51"; the canonical
> number is **Run 50** — the history file's last entry was Run 49 (2026-06-17), and the backend
> is on its **10th consecutive converged run** (Runs 41–50). Server on `:3001`, UI on `:5173`.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Backend API endpoints tested | 245 routes (~1,300+ requests across the full probe suite) |
| Frontend pages/views tested | Estimates (list + builder) deep tablet/phone/desktop sweep; Dashboard + Estimates UI-consistency spot-check |
| UI-consistency audit dimensions | 7 (icons, forms, modals, buttons, headers, sidebar, spacing) |
| **Bugs found** | **1** (estimate-builder toolbar overflow @768px) |
| **Bugs fixed** | **1** (`aab6753`) |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| New edge-case finding (not fixed — deferred) | 1 (EstimateBuilder sidebar clipping @375px) |
| **Total commits this run** | **1** (`aab6753`) |

One genuine bug found and fixed this run. Backend converged for the 10th consecutive run;
UI-consistency converged for the 7th consecutive audit — both produced 0 changes per the QA
charter ("if it works, leave it alone").

---

## Backend API Test Results

s1 re-ran the full standing probe suite against `:3001` with an admin JWT minted DB-direct
(`node .qa-mint-token.mjs`, 12h, bypasses the HTTP login rate limiter).

**Verdict: BACKEND CONVERGED — 10th consecutive run with 0 code fixes. 0 unintentional 5xx.**

| Probe | Requests | Result |
|---|---|---|
| `.qa-sweep-all.mjs` | 245 | 200×91, 400×72, 403×6, 404×75, 503×1 — 0 unintentional 5xx |
| `.qa-type-fuzz.mjs` | 1026 | 0 5xx / 0 err |
| `.qa-typefuzz-2.mjs` | many | 0 5xx; all 400/404/200 correct |
| `.qa-api-tenant-isolation-probe` | 22 | 22/22 OK (injection ignored, non-admin → 403) |
| `.qa-happy-write-probe.mjs` | 3 | 3/3 OK (PATCH lead/invoice → 200, estimate skip) |
| `.qa-gaps-probe.mjs` | many | 0 5xx; bad-uuid → 400, zero-id → 404 correct |
| `.qa-uncovered-probe.mjs` | many | 0 5xx; bad-json → 400, webhook handling correct |
| `.qa-pagination-probe.mjs` | 22 | 0 broken |

**By category — all passed, 0 failed, 0 fixed:**
- **Auth** — login/refresh validate correctly. Only non-200 is the HTTP login rate limiter (429 ~10/15min), bypassed for testing by the DB-direct mint.
- **CRM (leads/tasks/activities/invoices)** — full CRUD surface clean. Happy-path `PATCH /crm/leads/:id {priority:"warm"}` → 200; `PATCH /crm/invoices/:id {status:"sent"}` → 200.
- **Estimates / documents / financing / payments** — clean. Stripe `POST /payments/webhook` → 400 on missing signature header (correct, by design).
- **Skip-trace** — `GET /skip-trace/job/:jobId` → 503 "Skip trace service not configured" (no `TRACERFY_API_KEY`; intentional per the zero-paid-API constraint).
- **Admin** — 6× 403 on `/api/admin/*` (the test user is tenant admin, not platform-admin — correct authz).

**Tenant isolation (22/22):** `tenant_id` injected via query string, POST body, and `X-Tenant-Id`
header are all ignored (returns own-tenant Waterloo data only); foreign/zero UUIDs → 404, never
cross-tenant leakage; `/api/admin/tenants` as non-platform-admin → 403.

**Code changes this category: NONE.** Fix yield has been 0 for 10 runs — the backend is converged
and should not be re-tested; the high-value gaps are all frontend.

---

## Frontend Feature Test Results

s2 (frontend) ran a deep responsive walk of the **Estimates** area, found and fixed one bug, then
hit its 80-turn limit (no end summary, but the fix was committed before turns ran out). Screenshots:
`qa-375-estimate-builder.jpeg`, `qa-768-estimate-builder.jpeg`, `qa-768-estimate-builder-fixed.jpeg`,
`qa-estimates-after-back.jpeg`.

### Estimates — list
- **Tested:** render after back-navigation from the builder, KPI cards, table, row actions.
- **Passed:** list renders 83 estimates with KPI cards and Edit/Delete/Copy/Tiers actions; back-nav builder → list works cleanly (`qa-estimates-after-back.jpeg`).

### Estimates — builder (EstimateBuilder)
- **Tested:** "Roof Components" line-items toolbar at 768px (tablet), 375px (phone), and 1280px (desktop).
- **Broken → Fixed (`aab6753`):** at ≤768px the toolbar (*From preset / Add All / Blank Row / Add from SRS Catalog*) was a `nowrap` flex row wider than its ~392px column, so **"Add from SRS Catalog" overflowed to x=851 and was clipped/unreachable** (the body could not scroll to it). Fix: added `flex-wrap:wrap` + `gap` to the header row and the button group so the buttons flow onto a second line on narrow viewports. Desktop layout unchanged (still single line); 0 body overflow.
- **Verified (s4):** @768px — From-preset/Add-All/Blank-Row on line 1, Add-from-SRS-Catalog wraps to line 2 (x=329, right=501, fully inside the 768 viewport), both header row and button group `flexWrap:wrap`, body/doc overflow 0. @1280 desktop — all 4 buttons single line, 0 overflow. 0 console errors.
- **Still needs attention:** EstimateBuilder does **not** collapse at phone width (375px) — see "Known Issues" #1. Works correctly at its intended tablet/desktop widths (768px+).

---

## UI Consistency Audit Results

s3 ran a definitive code-level grep over **all** of `client/src` (authoritative for icons / forms /
modal-animation) plus a Playwright runtime spot-check of Dashboard and the recently-changed
EstimatesView.

**Result: CONVERGED — 7th consecutive 0-fix UI-consistency audit. No code changes.**

| Dimension | Finding | Fixed? |
|---|---|---|
| **Icons** | 100% `@heroicons/react/24/outline`. 0 solid / lucide / react-icons / fontawesome / material-icons. RT: Dashboard 70/70 outline, Estimates 38/38 outline, 0 foreign. (Inline `<svg>` only in CanvassingMode.jsx & StormMap.jsx — decorative map SVGs, allowed.) | n/a — clean |
| **Buttons** | Radii group into design tokens; the "14/12px" & "10/8px" pairs are CSS `border-radius` clamping on short elements (documented prior), not one-off inconsistencies. | n/a — clean |
| **Toolbars / Headers** | Consistent across pages; recently-changed EstimatesView header row verified 0-overflow @768px. | n/a — clean |
| **Sidebar / Nav** | Uniform; no issues. | n/a — clean |
| **Forms** | 0 native `<select>`, 0 native `<input type="date"/"time">` in the entire src tree. CustomSelect + DatePicker enforced. | n/a — clean |
| **Spacing** | No alignment/overflow issues found at runtime. | n/a — clean |
| **Modals** | Canonical `.modal-backdrop > .glass` = `modal-scale-in 200ms ease-apple` (index.css 4431/4440); slide-over 250ms variant (4445, intentional); only inline animation is LeadDetail 1806/1933, both *exactly* canonical. | n/a — clean |

The 3 components changed since the last audit (EstimatesView `aab6753`, ImportLeadsModal, and
Calendar/Tasks/WorkOrders `8f55a02`) introduced no icon/form/animation drift.

---

## Bugs Fixed

1. **EstimateBuilder (Estimates → builder) — "Roof Components" toolbar overflow at tablet width** — at ≤768px the toolbar was a `nowrap` flex row wider than its ~392px column, pushing "Add from SRS Catalog" off-screen (x=851), where it was clipped and unreachable (body couldn't scroll to it). **Fixed in `aab6753`** by adding `flex-wrap:wrap` + `gap` to the header row and button group so buttons wrap to a second line on narrow viewports; desktop unchanged, 0 body overflow. Verified at runtime @768px and @1280px.

---

## Known Issues (Not Fixed)

1. **EstimateBuilder does not collapse at phone width (375px)** *(new finding this run; pre-existing, not caused by `aab6753`).* The builder body is a flex-row with a fixed **280px** sidebar (`flexShrink:0`, which holds the section enable/disable toggles — functional, not just nav) + a `flex:1` editor inside an `overflow:hidden` container (`EstimatesView.jsx:1838`). At 375px the sidebar eats 280px and the form content (Customer/Title/etc.) is pushed off the right edge and clipped/unreachable (body overflow reads 0 because it's clipped, not scrollable). Screenshot: `qa-375-estimate-builder.jpeg`. **Works correctly at 768px+** (the intended tablet/desktop tool width). A proper fix is a responsive sidebar collapse/stack — a design-sized, risky change, deferred to a dedicated next-run stage rather than landed blind in a test stage.
2. **Esc-to-close missing on most modals (app-wide keyboard-nav gap).** Of 17 components with modals/overlays, only a few (SubcontractorsView, Pipeline slide-overs, TopBar/AddressSearch dropdowns, PhotoAnnotator, RoofDrawingTool) handle Escape; most (EstimatesView, ImportLeadsModal, CreateLeadModal, EmailModal, ActivityModal, Settings, Invoices, Expenses, Drip) close only via X / backdrop. An in-progress **uncommitted** Esc handler exists in `LeadDetail.jsx` in the working tree (belongs to this stage) — **left untouched**: committing it for one component alone would increase inconsistency. The fix must be a shared hook applied to all modals.
3. **#6 Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — no rate-limit/concurrency guard. Testing this does bulk work → needs staging, not prod-tier Neon. Untouched.
4. **#9 `DELETE /api/crm/tasks/:id`** handler missing (frontend only exports `updateTask`/PATCH). Adding endpoints is forbidden by the QA charter. Untouched.
5. **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when the JWT is expired — handled silently, touches FEMA-import territory → DO NOT TOUCH. Not a regression.

---

## Test Coverage Gaps

- **Keyboard nav** — Esc-to-close still missing app-wide; Tab order, focus rings, Enter-submit untested. Highest-value remaining gap; should be a dedicated, app-wide stage (a shared hook), not a per-component patch. (s2 of the prior two runs started and abandoned this.)
- **Tablet-768px sweep — partial.** Done & clean: Dashboard, Leads, Materials, Tasks, Work Orders, Calendar, Estimates (list + builder verified this run). Still un-swept at 768px: **Invoices, Reports, LeadDetail, Subcontractors, Expenses, Contracts, Settings tabs.**
- **Phone-375px** — EstimateBuilder sidebar collapse (Known Issue #1) is the first 375px-specific finding; the rest of the phone-width sweep is untouched.
- **Backend (10 runs) + UI-consistency (7 audits)** — both converged; fix yield 0. Do **not** keep re-testing these.

---

## Session Integrity

| Stage | Outcome | Turns | Cost |
|---|---|---|---|
| s1 api-test | ✅ success — backend re-verified converged, 0 fixes | 19 | $1.73 |
| s2 frontend-test | ⚠️ max-turns (81/80) — landed this run's only commit (`aab6753`) before turns ran out, then stopped; no end summary, captured 4 estimate-builder screenshots | 81 | $7.10 |
| s3 ui-audit | ✅ success — converged (7th 0-fix audit), 0 changes | 23 | $1.87 |
| s4 verify | ✅ success — verified `aab6753` @768/@1280, build clean 7.62s, surfaced the 375px edge-case, 0 fixes | 35 | $2.54 |
| s5 report | this report | — | — |

**1 commit stands for this run: `aab6753`.** s1–s4 spend ≈ **$12.24**. 3 of 4 working stages exited
cleanly; the max-turns stage (s2) still produced this run's only commit.

---

## Deliverables

- `C:\tmp\api-test-results.txt` (s1) · `C:\tmp\ui-audit-results.txt` (s3) · `C:\tmp\verify-results.txt` (s4)
- Screenshots: `qa-375-estimate-builder.jpeg`, `qa-768-estimate-builder.jpeg`, `qa-768-estimate-builder-fixed.jpeg`, `qa-estimates-after-back.jpeg`
- Final `npx vite build`: clean (verified at report close).
