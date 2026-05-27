# Overnight QA Report — 2026-05-27 (Run 34)

Branch: `feat/financing`  ·  Baseline: `e2ac767` (`overnight-checkpoint-20260527`)  ·  Final HEAD: `f4e7aa3`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages exercised (UI consistency audit) | 13 protected routes |
| Pages exercised (empty-state sweep) | 16 routes |
| API endpoints exercised (sweep) | 96 |
| API endpoints exercised (financing negative cases) | 19 |
| API endpoints exercised (creation-endpoint empty-body) | 11 |
| Bugs found | 1 |
| Bugs fixed | 1 (1 backend) |
| UI inconsistencies / anti-patterns found | 0 |
| UI inconsistencies / anti-patterns fixed | 0 |
| Commits landed | 1 (`f4e7aa3`) |
| Files modified | 1 |
| Production 5xx during sweep | 0 (**16th consecutive zero-5xx run**) |

## Backend API Test Results

s1 (api-test) hit `max_turns` at 51 turns ($4.25) but landed **1 commit before timeout** and produced two artifact files: `.qa-api-results.txt` (96-endpoint sweep) and `.qa-financing-neg-results.txt` (19 financing negative-case probes).

| Category | Tested | Passed | Failed | Notes |
|---|---|---|---|---|
| Auth + tenant context | 1 | 1 | 0 | `/auth/me` returns user + tenant |
| Dashboard (legacy + CRM) | 18 | 18 | 0 | All stats / funnel / activity / leaderboard / tasks-today endpoints 2xx |
| CRM leads + activities | 5 | 5 | 0 | List, single, activities, filters, recent — all 2xx; bogus id → 404 |
| Pipeline + tasks | 5 | 5 | 0 | Stages, metrics, tasks list, calendar — all clean |
| Estimates + templates | 2 | 2 | 0 | List 86KB payload, templates 4.6KB |
| Invoices + work orders + contracts | 7 | 7 | 0 | All list/detail endpoints + milestone templates clean |
| Expenses + subcontractors + territories | 5 | 5 | 0 | Summary endpoints return correct shapes |
| Materials + skip-trace + roof-measurement | 11 | 11 | 0 | All metadata / usage / balance endpoints clean |
| Storms + maps + counties | 7 | 7 | 0 | Bbox validation rejects missing params with 400 (correct) |
| Notifications + search + documents | 5 | 5 | 0 | All clean |
| Admin endpoints | 4 | 4 | 0 | Overview, tenants, revenue, usage all 2xx (with super_admin JWT) |
| Public unauthenticated routes | 4 | 4 | 0 | Estimate public link 200; bad tokens 404 |
| **Financing negative cases** | **19** | **17** | **2 → fixed** | See bug below |
| Creation-endpoint validation (empty bodies) | 11 | 11 | 0 | All return clean 400 with field-specific messages — zero 500s |
| 404 / 400 negative tests | 12 | 12 | 0 | Invalid UUIDs return 400, missing UUIDs return 404 |
| **Total endpoints exercised** | **126** | **125** | **1** | |

### What was fixed (with commit hashes)

- `f4e7aa3` — `server/src/services/financing/index.js` (+10 / −2) — `syncPlans` (line 107) and `createApplication` (line 193) threw plain `Error()` with no status, so the global error handler surfaced them as 500. Now both attach `err.status = 404`. Same pattern as Run 33's `abfe6a8` fix for `leads/from-storm`. Verified post-commit:
  - `POST /api/crm/financing/plans/sync` with bogus `lenderId` → `404 "Lender not found"` ✓
  - `POST /api/crm/financing/applications` referencing a missing plan → `404 "Plan not found or inactive"` ✓

## Frontend Feature Test Results

s2 (frontend-test) **completed cleanly** at 98 turns ($5.82). This is the **first clean exit of s2 in 6 consecutive runs** — a long-running carry-over since Run 29. 0 commits by design (verification, not fixes).

| Page | Tested | Result | Notes |
|---|---|---|---|
| Login → Dashboard | Auth flow with valid prefilled creds (`waterlooconstruction1@gmail.com / 2Wealth&health / waterloo`) | PASS | Zero console errors after token attaches |
| `/leads` → Add Lead modal → submit | **Browser write flow** (carry-over since Run 29) | **PASS** | Created lead `fa4d1995`, verified in DB via API, confirmed kanban "New" column updated (16→17 leads, $7.6K→$20.1K), cleaned up test row |
| `/pipeline` | Render + console error sweep | PASS | Clean |
| `/estimates` | Render + console error sweep | PASS | Clean |
| `/settings` → Financing tab | Render + console error sweep | PASS | Clean |
| Pre-token 401 noise | Reproduction + root-cause trace | **Resolved as non-defect** | The 11 401s previously seen were the orchestrator's stale `brandon/1234` creds failing login. With valid prefilled creds, login → dashboard produces zero console errors. The Run 33 "Pre-token-attach 401 noise" carry-over was a misdiagnosis |

**Tooling discovery worth flagging:** `browser_click` MCP tool silently fails on React `onClick` handlers for portal-rendered modal buttons. Workaround: `browser_evaluate` + `form.requestSubmit()`. Documented in `overnight_resume.md` for future runs.

**Still needs attention (deferred to next run):** Invoice → Record Payment, Work-order checklist toggle, document multipart upload, kanban drag-persist round-trip, mobile 375 / 768 px sweep.

## UI Consistency Audit Results

s3 (ui-audit) **completed cleanly** at 73 turns ($4.03). Parallel code-only Explore agents (read-only) + Playwright browser sweep across 9 protected routes (`/dashboard /leads /pipeline /estimates /tasks /invoices /work-orders /contracts /subcontractors /expenses /materials /reports /settings`). Full findings in `qa-reports/ui-audit-results-2026-05-27.md`.

| # | Audit | Result | Action |
|---|---|---|---|
| 1 | **Icons** — Heroicons outline only | PASS | 33 files import from `@heroicons/react/24/outline`; zero solid / lucide / FA / Material / inline-UI-SVG imports. The only inline `<svg>` are Leaflet popup graphics in `CanvassingMode.jsx:336` and `StormMap.jsx:1764` (decorative, not UI icons) |
| 2 | **Buttons** — `.auth-btn` / `.quick-action-btn` | PASS | Primary 36 px, oklch(0.72 0.19 250), 14 px / 12 px radius, 13 px font — identical across 9 pages (`Add Lead`, `+ New Task`, `New Estimate`, `New Invoice`, `New Work Order`, `New Contract`, `+ Add Subcontractor`, `Add Expense`, `Import`/`Export`). 99 inline `style={{}}` overrides exist but only tune icon+text layout (gap, flex), not visible size/color — no user-visible drift |
| 3 | **Toolbar / header** — TopBar 56 px, h1 18 px / 700 | PASS | Uniform across 9/9 pages. LeadList filter toolbar below TopBar is intentional column-filter row, not a duplicate header |
| 4 | **Sidebar / nav** — 240 px wide | PASS | Identical across all protected routes; 5 top-level + group icons all `@heroicons/react/24/outline`; active state uses 3 px blue left-border via `.nav-link.is-active::before`; group collapse persisted to `localStorage.sidebar-groups` |
| 5 | **Forms** — `.form-input`, `CustomSelect`, `DatePicker` | PASS | Zero native `<select>` rendered. Zero native `<input type="date">` rendered. Only non-`.form-input` is the TopBar `Cmd+K` search (legitimately uses `.topbar__search-input`) |
| 6 | **Spacing / alignment** — card padding 20 px, gap 20 px, radius 16 px | PASS | Dashboard stat cards 121 × 137, padding 17.5 px, radius 20 / 18 px — all 4 identical. Section `h2` headers uniform at `12.25 px / 720` |
| 7 | **Modals** — `.modal-backdrop` + `.glass` + IconX close | PASS | 4/4 production modals compliant (`EmailModal`, `ActivityModal`, `CreateLeadModal`, `ImportLeadsModal`); animations inherit from `modal-scale-in 200ms ease-apple`. Three fixed-position overlays (`EstimatesView.jsx:1584`, `LeadDetail.jsx:687/1061`, `RoofDrawingTool.jsx:501`) are intentionally not modals — different UX patterns |

**Zero defects, zero fixes.** Third consecutive zero-defect UI audit; surface has converged.

## Verify + Edge-Cases Stage

s4 (verify) **completed cleanly** at 28 turns ($3.49). Re-verified the s1 financing fix end-to-end and exercised broader edge cases. 0 commits, 0 defects.

| Check | Result | Notes |
|---|---|---|
| **Financing 404 fix** (`f4e7aa3`) re-verified | PASS | Both endpoints return 404 instead of 500 |
| Empty-state sweep across 16 routes | PASS | All render correct h1 + ≥273 chars of `.main-content`; only console noise was 2× `GET /api/admin/overview 403` (DEV_BYPASS artifact, not a production bug) |
| Empty-body validation across 11 creation endpoints | PASS | Leads, tasks, estimates, invoices, contracts, work-orders, expenses, subcontractors, drip-sequences — all return clean 400 with field-specific error messages. Zero 500s |
| Mobile 375 px sweep | PASS | Dashboard / Pipeline / Leads / Estimates / Invoices — no horizontal overflow (`docScrollW=369 vs vw=375`), sidebar collapses to width 0, no mobile bottom-tab-bar (known TODO, not a regression) |
| Final build | PASS | `cd client && npx vite build` → `✓ built in 7.46s`, pre-existing chunk-size warnings only |

## Bugs Fixed

1. **POST /api/crm/financing/plans/sync returned 500 on bogus lenderId**, and **POST /api/crm/financing/applications returned 500 when the referenced plan was missing or inactive** — both service functions threw plain `Error()` with no `err.status`, so the generic error handler surfaced them as 500. → Added `err.status = 404` at both throw sites; verified each endpoint now returns 404 with a clear message. Same pattern as Run 33's `abfe6a8` fix for `leads/from-storm`. (`f4e7aa3` — `server/src/services/financing/index.js`)

## Known Issues (Not Fixed)

- **Financing applications snake_case-vs-camelCase contract bug** (latent) — `server/src/routes/financing.js:122-127` validates `lead_id` and `lender_id` (snake_case), but `server/src/services/financing/index.js:181` destructures camelCase (`leadId`, `planId`). Caller sending `lead_id` has the service ignore it and insert `null`. No frontend caller found in `client/src/api/`, so the bug is latent. Out of scope for the 404 fix; documented in `overnight_resume.md` for a future targeted run.
- **DEV_BYPASS admin 403 noise** — `/.env` has `VITE_DEV_BYPASS_AUTH=true` so the sidebar always shows `Brandon Admin / super_admin` (DEV_USER), but the actual API JWT is whoever logged in (e.g. `Miles Martin / admin`). Admin link renders → `GET /api/admin/overview` returns 403. AdminDashboard handles it gracefully. Dev-only artifact; user runs with this config intentionally. Not a production bug.
- **DELETE /api/crm/tasks/:id handler missing** — surfaced by Run 32's catch-all 404 fix; no frontend caller. Deferred per "don't add new endpoints autonomously" rule. (Finding A from Run 32, still open.)
- **Heavy-work guards on `POST /drift/correct-all`, `POST /properties/trigger-import`, `POST /crm/leads/score-all`** — no `?confirm=true` gate. Contract change, needs product decision.
- **Hearth webhook permissive on missing fields** — security-audit candidate.
- **Reports chart label overlap** at ~930 px viewport — cosmetic.
- **Multipart file-upload SUCCESS path** still untested (no `qa-fixtures/`).
- **CSV import success path** untested per "no bulk DB writes" rule (Neon free tier).
- **`subcontractors.js.bak`** cleanup — safe `git rm`, deferred.
- **`.modal-backdrop` CSS class** still requires 6-line inline overlay at each of 16 sites — refactor opportunity, deliberately skipped per "don't refactor working features".
- **`/subcontractors`** has H1 + H2 both reading "Subcontractors" — content choice.

## Test Coverage Gaps

- **Browser write flows (remaining)** — Add Lead is now verified end-to-end. Still untested in browser: Invoice → Record Payment, Work-order checklist toggle, kanban drag persist round-trip, document multipart upload. Next run should pick **exactly one** of these (Invoice → Record Payment recommended — touches money math).
- **Mobile responsive sweep at 768 px** — last comprehensive sweep was Run 6 (25 runs ago). 375 px was spot-checked this run; 768 px was not.
- **CSV bulk import success path** — blocked by Neon free-tier write-cost rule.
- **Multipart upload success path** — blocked by missing `qa-fixtures/` binary fixtures.
- **Stripe billing flows** — no test mode key available.

## Session Integrity

| Stage | Outcome | Turns | Cost | Commits |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` (51 / 50) | 51 | $4.25 | **1** (`f4e7aa3`) |
| s2 frontend-test | **completed** | 98 | $5.82 | 0 (verification) |
| s3 ui-audit | **completed** | 73 | $4.03 | 0 (zero defects) |
| s4 verify | **completed** | 28 | $3.49 | 0 (zero defects) |
| s5 report | **0 bytes** | — | — | 0 |

- **3 / 5 sessions completed cleanly** (best ratio since Run 26).
- **s5 has produced 0 bytes for 25 consecutive runs** — orchestrator should drop the stage or fold into s4. This report was written in a follow-up session.
- Total measured spend: **~$17.59**.

## Diff vs. Run 33

- `git diff bdd1d10..f4e7aa3 -- server/src/services/financing/index.js` — +10 / −2 (two `err.status = 404` attach sites)
- HEAD advanced: `bdd1d10` → `e2ac767` (checkpoint) → `f4e7aa3`
