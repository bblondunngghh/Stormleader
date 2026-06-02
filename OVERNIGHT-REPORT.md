# Overnight QA Report — 2026-06-02 (Run 38)

Branch: `feat/financing`  ·  Baseline: `4c72116` (`overnight-checkpoint-20260602`)  ·  Final HEAD: `4782de5`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages exercised (UI consistency audit, 20 routes) | 20 |
| API endpoints exercised (standard sweep) | 118 |
| API endpoints exercised (write / validation probe) | 35 |
| API endpoints exercised (edge / negative probe) | 11 |
| API endpoints exercised (**NEW** tenant isolation probe) | 22 |
| API endpoints exercised (**NEW** multipart upload probe) | 7 |
| **Total API probes** | **193** |
| Bugs found | 3 (1 dashboard AR-aging artifact, 2 multipart upload 500s) |
| Bugs fixed | 1 (AR aging clamp — `4782de5`) |
| Bugs deferred | 2 (multipart upload 500 path — NEW Carry-over #13) |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| Commits landed | 1 (`4782de5`) |
| Files modified by commits | 1 (`server/src/routes/crm.js`) |
| Production 5xx during standard sweep | 0 (**19th consecutive zero-5xx run**) |

## Backend API Test Results

Five probes ran this cycle. The 118-route standard sweep (`.qa-api-probe.mjs` → `.qa-api-results.json`) stayed clean (87× 2xx, 30× 4xx, 1× 503 — the 503 is `skip-trace` returning "service not configured" as designed because `TRACERFY_API_KEY` is unset in the dev env, which is the documented correct response, not a defect). A new tenant isolation probe and a new multipart upload probe were added this run.

| Category | Tested | Passed | Failed | Notes |
|---|---|---|---|---|
| Auth + tenant context | 1 | 1 | 0 | `/auth/me` returns user + tenant |
| Dashboard (legacy + CRM) | 19 | 19 | 0 | All stats / funnel / activity / leaderboard / tasks-today / **AR summary** endpoints 2xx. AR summary surfaced negative `overdue_total` (overpaid invoice artifact) — fixed mid-run, see below |
| CRM leads + activities | 6 | 6 | 0 | Lists, single, activities, filters — all clean |
| Pipeline + tasks | 5 | 5 | 0 | Stages, metrics, tasks list, calendar |
| Estimates + templates + invoices + work orders + contracts | 9 | 9 | 0 | All list / detail clean |
| Expenses + subcontractors + territories | 5 | 5 | 0 | Summary endpoints return correct shapes |
| Materials + skip-trace + roof-measurement | 11 | 10 | 1 (expected 503 — env-gated) | `skip-trace` correctly returns 503 with "service not configured" when `TRACERFY_API_KEY` is unset |
| Storms + maps + counties | 7 | 7 | 0 | bbox validation still rejects missing params with 400 |
| Notifications + search + documents (list) | 5 | 5 | 0 | All clean |
| Admin endpoints | 4 | 4 | 0 | All 4xx with non-super_admin token |
| Public unauthenticated routes | 4 | 4 | 0 | Estimate / contract / financing public endpoints 4xx on bad tokens |
| Financing (full re-sweep) | 14 | 14 | 0 | Re-verified Run 34 / 35 fixes still holding |
| Other CRM (drip-sequences, automations, prospect-lists, etc.) | 28 | 28 | 0 | All clean |
| **Standard sweep total** | **118** | **117** | **1 (intentional 503)** | **0 unintentional 5xx** |
| Write / validation probe (POST + PATCH empty bodies + single-field happy path) | 35 | 35 | 0 | Every create endpoint returns field-specific 400; `PATCH /crm/leads/:id` 2xx round-trip clean |
| Edge / negative probe (malformed JSON, bad UUID, bad token, SQL-injection in search, huge `?limit`, negative `?offset`, wrong method) | 11 | 11 | 0 | All returned expected 4xx or sanitized 2xx; SQL injection in search returned empty list (`{leads:[],contacts:[],estimates:[]}`); `huge-limit` and `neg-offset` returned **valid 200 with results** — confirming Run 35 pagination-clamping fix (`dcc904c`) is still holding |
| **NEW** Tenant isolation probe | 22 | 22 | 0 | See "Tenant Isolation Probe (new this run)" below |
| **NEW** Multipart upload probe | 7 | 5 | 2 | See "Multipart Upload Probe (new this run)" below |

### Tenant Isolation Probe (new this run)

`.qa-api-tenant-isolation-probe.mjs` → `.qa-api-tenant-isolation-results.json`. 22 probes designed to confirm that authenticated tokens cannot escape their tenant scope.

| Attack vector | Probes | Result |
|---|---|---|
| Read foreign-tenant estimate by direct id | 4 (GET, PATCH, PUT, DELETE) | All return **404 "Estimate not found"** (not 403 — the route layer's tenant filter makes foreign rows invisible at SELECT time, which is the safer pattern) |
| Query string `tenant_id=<other-tenant-uuid>` injection on 15 list endpoints | 15 (`/leads`, `/tasks`, `/estimates`, `/documents`, `/notifications`, `/financing/applications`, `/invoices`, `/automations`, `/contracts`, `/expenses`, `/subcontractors`, `/territories`, `/work-orders`, `/drip-sequences`, `/canvass-pins`) | All return `baselineCount === injectedCount` — **query param is ignored, server uses JWT `req.tenantId`** |
| `POST /crm/tasks` with `tenant_id` in body | 1 | Returns 201 with `actualTenant === req.tenantId` (body field stripped) |
| `GET /crm/leads` with spoofed `X-Tenant-Id` header | 1 | Returns row with the **JWT's** tenant_id, ignoring the header |
| `GET /api/admin/tenants` as non-platform-admin | 1 | **403 "Insufficient permissions"** |

**Verdict: zero cross-tenant leakage.** Closes Carry-over from Run 38 suggestion list. This is the strongest tenant-isolation evidence in the QA history and should be re-run on each major auth change.

### Multipart Upload Probe (new this run) — DEFECTS FOUND

`.qa-api-upload-probe.mjs` → `.qa-api-upload-results.json`. 7 probes against multipart upload endpoints.

| Probe | Status | Verdict |
|---|---|---|
| `POST /api/documents/upload` with valid PNG | **500 "Internal server error"** | **DEFECT** — success path is broken |
| `POST /api/documents/upload` with `.exe` payload | **500 "Internal server error"** | Returns 500 instead of a clean 400 "file type not allowed" — symptom likely same root cause as the PNG failure |
| `POST /api/documents/upload` with no file | 400 "No file uploaded" | OK |
| `POST /api/properties/import-csv` with empty rows array | 400 "rows array is required" | OK |
| `POST /api/properties/import-csv` with missing `rows` field | 400 "rows array is required" | OK |
| `POST /api/properties/import-csv` with junk row | 200 — `{ total:1, skipped:1, failed:0 }` (no_match recorded) | OK — graceful soft-fail |
| `POST /api/properties/import-csv` with 10,001 rows | 413 "request entity too large" | OK — body-size limit fired |

**NEW Carry-over #13:** `POST /api/documents/upload` returns 500 on both valid PNG and disallowed extensions. Closes Carry-over #7 ("multipart upload SUCCESS path untested") by *finding the defect* — but does not fix it. Likely candidates: multer middleware misconfiguration, missing storage destination, or `req.file` being undefined when caught by the generic error handler. Needs a focused next-run pass with server-log capture during the failing request to pin the throw site.

### What was fixed (with commit hash)

- **`4782de5`** — `server/src/routes/crm.js` (+5 / −5) — Dashboard AR summary was showing "Overdue: -$1.0K" for tenant `waterloo` because invoice `INV-0013` had `total=$0` but `amount_paid=$1000` (an overpayment recorded in the past). The aging query was summing `(total - amount_paid)` per row, so the overpayment produced a negative receivable that flowed into the dashboard tile. Wrapped the per-row delta in `GREATEST(..., 0)` across all five aging buckets (`outstanding_total`, `overdue_total`, `due_30`, `due_60`, `due_90_plus`). Receivables are not negative — an overpayment is a credit on the customer ledger, not money the business is owed. Verified post-commit: dashboard tile now shows `$0` instead of `-$1.0K`, screenshot at `verify-ar-aging-overdue-zero.png`.

## Frontend Feature Test Results

s2 (`claude-overnight-20260602-s2-frontend-test.json`) hit `max_turns` at 81 turns ($4.50). Per Run 37 guidance ("standard surfaces are saturated; pick high-value untouched"), browser scope this run was the tenant isolation + upload probes (above), driven from Node rather than browser. No new browser PNGs captured.

| Page / Flow | Tested | Result | Notes |
|---|---|---|---|
| Login → Dashboard | Auth flow with valid prefilled creds | PASS | Same as Run 36 / 37 — zero new console errors |
| Dashboard AR-summary tile | Visual inspection | **DEFECT FOUND → FIXED** | "Overdue: -$1.0K" for tenant waterloo — see `4782de5` |
| All 20 routes (UI audit sweep) | Heroicon / button / header / sidebar / form / spacing / modal sweep | PASS (all 7 axes) | See UI Consistency section |

### Still needs attention (deferred to next run)

- **Invoice → Record Payment** (carry-over from Runs 34–37): still untested end-to-end in the browser.
- **Work-order checklist toggle**, **kanban drag-persist round-trip** — still untested in browser.
- **Multipart document upload success path** — now confirmed broken at the API layer (Carry-over #13 above); browser flow still untested.
- **Mobile 768 px sweep** — **30 runs stale** (last comprehensive sweep was Run 6).

## UI Consistency Audit Results

s3 (`claude-overnight-20260602-s3-ui-audit.json`) **completed cleanly** at 99 turns ($4.95) — **first clean exit for s3 in 4 consecutive runs.** Full 7-axis audit ran across 20 routes (`.qa-ui-audit-results.txt`). Three working hypotheses for "/territory and /drip-sequences are missing" were investigated and dismissed (those URLs are not top-level routes; they're sub-panels inside `CanvassingMode.jsx` and `SettingsView.jsx`).

| # | Axis | Result | Action |
|---|---|---|---|
| 1 | Icons (Heroicons outline only) | **PASS** | 37 files import `@heroicons/react/24/outline`; 0 solid imports; 0 react-icons / lucide / FontAwesome. Browser sweep verified 60–1031 SVGs/page all match the Heroicons-outline signature (`viewBox="0 0 24 24"` + `fill="none"` + `stroke="currentColor"`). |
| 2 | Buttons (`.auth-btn` / `.quick-action-btn` / `.nav-link` / `.topbar__btn`) | **PASS** | 1,059 buttons sampled. Internal uniformity within each class group. Single 18 px outlier on `/work-orders` is an icon-only utility button — deliberate, not drift. |
| 3 | Toolbar / header | **PASS** | All 17 real routes: 56 px height, `topbar glass` class, 18 px / 700 h1 — uniform. |
| 4 | Sidebar / nav | **PASS** | 240 px width, 18 nav-links, exactly 1 active per page. |
| 5 | Forms (`.form-input`, `CustomSelect`, `DatePicker`) | **PASS** | 0 native `<select>`, 0 native date inputs in `components/`. Create Lead modal: 9/9 form-input class. CustomSelect + DatePicker universally adopted. |
| 6 | Spacing / alignment | **PASS** | All `.glass` panels share border-radius 20 px / 18 px. Padding varies contextually by design system, not by drift. |
| 7 | Modals (`.modal-backdrop` + `.glass` + IconX) | **PASS** | 13 components use `.modal-backdrop`; 7 fixed-position non-modal exclusions (slide-over, FAB, fullscreen canvas, portaled dropdown, toast, bottom-tab-bar) correctly identified. |

**Verdict: 7/7 PASS, 0 defects, 0 fixes.** **19th consecutive zero-defect UI sweep.** The design system has converged hard — Heroicons-only, `.form-input` universal, `.glass` panels uniform radius, `.modal-backdrop` everywhere it should be.

## Verify + Edge-Cases Stage

s4 (`claude-overnight-20260602-s4-verify.json`) hit `max_turns` at 41 turns ($2.58). Concrete verifications evidenced:

| Check | Result | Notes |
|---|---|---|
| **AR aging clamp** (`4782de5`) re-verified | PASS | `GET /api/crm/dashboard/ar-summary` for tenant waterloo: pre-fix `overdue_total=-1000`, post-fix `overdue_total=0`. Screenshot `verify-ar-aging-overdue-zero.png` captured |
| Run 37 pagination-clamping fix (`dcc904c`) re-verified | PASS | `?limit=999999` and `?offset=-1` both return clean 200 with results — defect class from Run 35 stays closed |
| Tenant isolation across 22 probes | PASS | See Tenant Isolation Probe above |
| Multipart upload SUCCESS path | **FAIL** | `POST /api/documents/upload` returns 500 on valid PNG — Carry-over #13 |
| Final build | PASS | `cd client && npx vite build` → `✓ built in 7.52s`, pre-existing chunk-size warnings only |

## Bugs Fixed

1. **`GET /api/crm/dashboard/ar-summary` returned negative `overdue_total` for tenants with overpaid invoices** — `(total - amount_paid)` summed across rows produced negative values when `amount_paid > total`. Visible as "Overdue: -$1.0K" on dashboard tile for tenant `waterloo` (overpayment recorded against `INV-0013`). → Wrapped per-row delta in `GREATEST(..., 0)` across all five aging buckets. (`4782de5` — `server/src/routes/crm.js`)

## Known Issues (Not Fixed)

- **NEW Carry-over #13: `POST /api/documents/upload` returns 500 on valid PNG upload and on disallowed file types** — multipart upload SUCCESS path is broken. Both the happy path (valid PNG) and the reject path (`.exe`) return generic 500 instead of either a 201 / 200 on the happy path or a clean 400 on the reject path. The "no file" probe correctly returns 400 "No file uploaded", so multer is mounted, but something inside the upload handler throws when `req.file` is populated. Needs server-log capture during a failing request to pin the throw site.
- **#5 Hearth webhook permissive on missing fields** — security-audit candidate; lower priority because Mock provider is the active default for testing.
- **#6 Heavy-work guards on `POST /drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all`** — no `?confirm=true` gate. Contract change; needs product decision.
- **#8 Mobile responsive sweep at 768 px** — last done Run 6 (**30 runs ago**). Highest-value untouched surface per Run 37 / 38 resume guidance.
- **#9 `DELETE /api/crm/tasks/:id` handler missing** — Run 32 Finding A; no frontend caller; still deferred per "don't add new endpoints autonomously" rule.
- **DEV_BYPASS admin 403 noise** — `/.env` has `VITE_DEV_BYPASS_AUTH=true`; AdminDashboard handles gracefully. Dev-only artifact; not a production bug.
- **Uncommitted modal-overlay refactor experiment** in working tree (carry-over from Run 35 — `CreateLeadModal.jsx`, `EmailModal.jsx`, `LeadDetail.jsx`). Build still passes with it in place. **Decide and either commit or revert before Run 39.**
- **Reports chart label overlap** at ~930 px viewport — cosmetic.
- **CSV import success path** still untested at scale (Neon free-tier write-cost rule).
- **`subcontractors.js.bak`** cleanup — safe `git rm`, deferred.
- **`.modal-backdrop` inline-style duplication** — 16 sites repeat ~6 lines. Refactor opportunity, blocked by the uncommitted experiment above.
- **`/subcontractors`** has H1 + H2 both reading "Subcontractors" — content choice, not a defect.

## Test Coverage Gaps

- **Browser write flows (remaining)** — Invoice → Record Payment, Work-order checklist toggle, kanban drag-persist round-trip, document multipart upload (now confirmed broken at API). Pick **exactly one** for Run 39 — Invoice → Record Payment remains the highest-value untouched browser flow.
- **Mobile responsive sweep at 768 px** — 30 runs stale. `browser_resize({width:768, height:1024})` then walk the same page list as Run 36 is the recommended next-run target.
- **Color contrast / a11y sweep** — Playwright + axe-core across pages, check WCAG AA contrast ratios on `.glass` overlays. Never attempted.
- **Keyboard navigation** — Tab-order, focus rings, Esc closes modals, Enter submits forms. Never attempted.
- **Stripe billing flows** — no test mode key available.
- **Live Hearth webhook** — webhook permissiveness audit deferred.

## Session Integrity

| Stage | Outcome | Turns | Cost | Commits |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` (51 / 50) | 51 | $2.93 | 0 |
| s2 frontend-test | `error_max_turns` (81 / 80) | 81 | $4.50 | **1** (`4782de5`) |
| s3 ui-audit | **completed cleanly** (`end_turn`, 99 turns) | 99 | $4.95 | 0 |
| s4 verify | `error_max_turns` (41 / 40) | 41 | $2.58 | 0 |
| s5 report | **0 bytes** | — | — | 0 |

- **1 / 5 sessions completed cleanly** (`s3 ui-audit` — first clean s3 exit in 4 runs).
- **s5 has produced 0 bytes for 27 consecutive runs** — this report was written in a follow-up session. Orchestrator should drop the stage or fold into s4.
- Total measured spend: **~$14.96**.
- The single commit landed in s2 (frontend stage), which is unusual — s2 was triggered by visually noticing the negative AR overdue tile and tracing it back to the SQL aggregate. The dashboard tile was the entry point, but the fix is purely backend.

## Diff vs. Run 37

- `git diff 4c72116..4782de5 --stat` — 1 file, +5 / −5
  - `server/src/routes/crm.js` — 5 × `SUM(total - amount_paid)` → `SUM(GREATEST(total - amount_paid, 0))` across the AR-summary aggregate query
- HEAD advanced: `4c72116` (checkpoint) → `4782de5`
- New artifacts left in working tree (reusable for Run 39):
  - `.qa-api-tenant-isolation-probe.mjs` + `.qa-api-tenant-isolation-results.json`
  - `.qa-api-upload-probe.mjs` + `.qa-api-upload-results.json`
  - `.qa-mint-token.mjs` (helper for issuing a JWT for a second tenant — supports future tenant-isolation re-runs)
  - `verify-ar-aging-overdue-zero.png` (post-fix dashboard screenshot)
- One new defect class added to the carry-over backlog (#13 multipart upload 500). Zero carry-overs from prior runs closed (the AR aging bug was newly surfaced this run, not a carry-over).

## Top-line takeaway

19th consecutive zero-defect UI sweep + 19th consecutive zero unintentional-5xx API sweep + **first clean cross-tenant isolation evidence** + one real-world dashboard defect surfaced and fixed in the same run. Strong convergence on standard surfaces; next-run focus should be the two high-value untouched surfaces (mobile 768 px, multipart upload defect repro) before further sweeps of saturated paths.
