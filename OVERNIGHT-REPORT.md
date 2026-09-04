# StormLeads — Overnight QA Report

**Date:** 2026-09-03
**Branch:** `feat/financing`
**Baseline:** `7662ce8` (tag `pre-overnight-20260903`) → **HEAD `cc13c6d`**
**Final build:** `npx vite build` — **exit 0, built in 7.99s**
**Stages:** s1 api-test (Run 122) · s2 frontend-test (Run 122) · s3 ui-audit (Run 123) · s4 verify (Run 124) · s5 report (Run 125)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages/routes exercised in a browser | **18** (functionally driven, not just rendered) |
| API endpoints exercised live | **200** of a **272-route / 36-file** inventory (132 `GET` + 34 `POST` + 34 `POST` no-body) |
| API endpoints statically analysed | **62** `POST` guard sites + **23** falsy-guard sites |
| Bugs found | **5** |
| Bugs fixed and committed | **4** |
| Bugs found but left incomplete | **1** (see Known Issues #1 — currently broken in the working tree) |
| UI consistency inconsistencies found | **0 measured** — audits 1–7 did not run this night (see below) |
| UI consistency inconsistencies fixed | **0** |
| Regressions introduced by the fixes | **0** |
| DB writes | **net zero** — tenant-scoped counts byte-identical before/after |

### Stage outcomes — three of five stages hit their turn cap

| Stage | Terminal reason | API time | Cost | Artifact written |
|---|---|---|---|---|
| s1 api-test | **capped** (`tool_use`) | 691 s | $5.66 | ❌ none |
| s2 frontend-test | **completed** (`end_turn`) | 745 s | $6.23 | ✅ `frontend-test-results.txt` |
| s3 ui-audit | **capped** (`tool_use`) | 385 s | $5.34 | ❌ none |
| s4 verify | **capped** (`tool_use`) | 522 s | $4.42 | ❌ none |

Stage cost s1–s4: **$21.65**.

This shapes the whole report and is stated up front deliberately: **`/tmp/api-test-results.txt` and `/tmp/ui-audit-results.txt` on disk are dated 2026-09-02 and belong to Runs 117 and 119.** They are *not* tonight's output. The API and UI sections below were reconstructed from tonight's raw harness JSON in `C:/tmp/`, the commit record, and one re-run of the write-free half of s4's lost verification — not from those stale files.

---

## Backend API Test Results

Route inventory regenerated this run: **272 routes across 36 files** — unchanged from Runs 114/117.
`GET` 132 · `POST` 88 · `PATCH` 26 · `PUT` 8 · `DELETE` 18 (140 writes). 109 of 272 paths carry a `:param`.

### Coverage by category

| Sweep | Endpoints | Result |
|---|---|---|
| Full `GET` sweep | 132 | **0 × 5xx.** 200 × 96, 400 × 23, 403 × 5, 404 × 7, 1 skipped |
| `POST` guard sweep (with body) | 34 | **0 × 5xx** — all 34 → 400 |
| `POST` guard sweep (empty body) | 34 | **0 × 5xx** — all 34 → 400 |
| `POST` routes skipped (side-effecting) | 28 | not exercised by design |
| Static `POST` guard analysis | 62 | inventory of guards / early-4xx per route |
| Falsy-guard (`if (!field)`) analysis | 23 | all return 400; 4 are type-aware |
| **Explicit-`null` PATCH probe** | **14** | **12 × 500 + 1 silent data loss → 2 defects** |

The `null` probe was the productive dimension this run. Prior runs closed wrong *types* (`{}`, `[]`, `42`, `"abc"`); an explicit `null` is valid JSON and passed every one of those guards.

### auth / storm / admin / reports (read paths)
132 `GET` routes returned no 5xx. The 403s are correct `admin`-role rejections; the 404s are routes whose `:param` had no resolvable fixture. **14 `GET` routes returned 200 with expected response fields missing** — recorded, not yet triaged (see Coverage Gaps).

### CRM — leads, tasks, expenses, subcontractors, work orders
**Defect → fixed in `43e843e`.** An explicit `null` for a whitelisted field backed by a `NOT NULL` column reached the SET clause untouched. Postgres answered `23502 not_null_violation`, which was absent from `PG_BAD_INPUT_CODES`, so the error handler fell through to a **500 "Internal server error"**. 11 field/endpoint pairs across 5 tables were reachable: `tasks.title/status`, `expenses.category/amount/date`, `invoices.subtotal/total`, `subcontractors.name/specialty/status`, `work_orders.title`. `23502` now maps to 400 and uses `err.column` to name the field — a name the caller already sent, so nothing leaks.

### Estimates / invoices / work orders (jsonb columns)
**Defect → fixed in `824ae24`.** The array/object guards exempted `null`. `JSON.stringify(null)` is the string `"null"`, which JSONB stores as a *jsonb null* rather than SQL `NULL` — so it satisfied the `NOT NULL` constraint and **replaced the row's line items while `subtotal`/`total` kept their old values, all behind a 200.** Silent data loss. `estimates.deposit` is the one genuinely nullable column of the seven and `EstimatesView.jsx:1582` deliberately sends `deposit: null` to clear it, so it is exempted explicitly.

This fix was **written by s1 and left uncommitted when s1 capped at 51/50 turns.** s2 found it via `git status`, verified it live 8/8 in both directions, confirmed it was frontend-safe, and committed it. That is the fifth consecutive night the "`git status` first" rule has recovered real work.

### Independent re-verification (recovered this stage)
s4 wrote `server/.qa-r124-s4-serverfix.mjs` to verify both server fixes, then capped — its output went to stdout and was lost. s5 re-ran **only the write-free half** (every expect-400 case fails before the `UPDATE`), with row counts and `max(updated_at)` asserted before and after:

```
43e843e  NOT NULL null-guard    11 probes → 400   PASS 9 / SKIP 2 / UNVERIFIABLE 2
824ae24  jsonb null-guard        4 probes → 400   PASS 4
         estimates.line_items 400 "line_items must be an array"
         estimates.insurance_details 400 "insurance_details must be an object"
         invoices.line_items 400 · work_orders.line_items 400
write safety: counts + max(updated_at) identical — nothing written
RESULT  pass 13  fail 0  skip 2  unverifiable 2
```

**13/13 reachable probes pass.** Both of tonight's server fixes are now independently confirmed against the running server.

---

## Frontend Feature Test Results

s2 was the one stage that completed. **18 routes driven in a browser: 0 page errors, 0 console errors, 0 blank pages, net-zero DB writes** (counts byte-identical before/after across all 8 core tables).

| Area | Tested | Result |
|---|---|---|
| `/estimates` | status filter → empty, then cleared | **Broken → fixed `282f51f`** |
| `/leads` | 6 server-side filters incl. score + rep | **Broken → fixed `282f51f`** |
| `/contracts` `/invoices` `/expenses` `/leads` `/estimates` `/tasks` | list-load failure (500 stub on each `GET`) | **Broken → fixed `cc13c6d`** |
| Settings | **15/15** tabs driven individually via `?tab=` | Pass — 0 native `<select>`, 0 native date/time inputs |
| Settings | **7/7** create/edit controls | Pass — all open an inline form with real fields |
| Entity create forms | **6/6** opened and submitted empty | Pass — validation correct on all six |
| Dashboard | **9/9** stat cards clicked | Pass — every one lands with correct intent |
| Calendar | **4/4** views | Pass — Month 42 cells / Week 103 / Day 97 / List, titles track |
| `/tasks` | filter tabs | Pass — correctly distinct copy per tab |
| `/reports` | 5 date ranges | Pass — **reference implementation** for period-scoped empty copy |
| `/pipeline` | kanban render + card → slide-over | Pass — 13 draggable cards, headers carry count + value |
| Estimate builder | line items, arithmetic end to end | Pass — 3 × $250 → $750, +30% margin → $525, second row → $950 |
| `/leads/:id` | slide-over | Pass — **has no tab bar at all**; charter item retired |

### What was broken and how it was fixed

**`282f51f` — filtered-to-empty lists claimed the user had no data.** Follow-up to `68c968a`, which fixed Contracts/Invoices/Expenses but never enumerated every view with the shape.
- `EstimatesView` — missed entirely. `statusFilter` is sent server-side as `params.status` and refetches, but both empty-copy sites tested a bare `estimates.length === 0`. Reachable today: the tenant holds 16 estimates (14 draft / 1 viewed / 1 declined) and **zero sent, zero accepted**, while the status control offers all five.
- `LeadList` — *already had the ternary*, so every prior run's eye slid past it, but its condition omitted `scoreFilter` and `repFilter`, which are also sent server-side (`min_score`, `assigned_rep_id`). A partial instance of the same defect.

**`cc13c6d` — a failed list load told the user their data did not exist.** Six list views swallowed the fetch error (`catch { /* keep existing */ }`) and rendered the empty-*database* copy, because on an initial load there are no existing rows to keep. A 500 on the list endpoint produced a confident, fully-rendered page reading "No contracts yet — create your first one", with zeroed stat headers and **no toast, banner, or any other sign of failure.** Proved live with a 500 stub on each list `GET`:

```
/contracts   4 rows in DB → "0 contracts"        + "No contracts yet - create your first one"
/invoices   14 rows in DB → "$0 TOTAL INVOICED"  + "Create your first invoice..."
/estimates  16 rows in DB → "0 estimates"        + "No estimates yet - create your first one"
/leads      13 rows in DB → "0 leads"            + "Generate leads from the Storm Map..."
```

Verified both directions on all six routes. `SubcontractorsView`, `MaterialsView` and `WorkOrdersView` were considered and **deliberately excluded** — they already surface the failure with an error toast; `StormCatalog`'s "No storms found." claims nothing about the database.

### Still needs attention
- `/pipeline` **drag between stages** — not performed; it is a real stage write and needs a revert plan.
- `/leads/:id` activity modal and score-breakdown popup — not opened.
- `/storm-map` layer toggles — covered Run 114; FEMA properties are out of charter by standing instruction.

---

## UI Consistency Audit Results

**s3 hit its turn cap and wrote no artifact. Audits 1–7 were not measured this night.** s3 spent its budget on a functional defect it found early (`cc13c6d`, above) rather than on the consistency sweep.

The honest status per category is therefore *unmeasured tonight*, with the last real measurement being Run 119 (2026-09-02), which found **0 style defects for the 18th consecutive run**:

| Audit | Measured tonight? | Last known state (Run 119, 2026-09-02) |
|---|---|---|
| 1. Icons | ❌ no | 2,232 runtime `<svg>`, **0 foreign icon classes** on 19/19 routes. Only non-24 viewBoxes are the 9 recharts surfaces on `/reports` (data-viz, non-bug) |
| 2. Buttons | ❌ no | Primary `.auth-btn` background `oklch(0.72 0.19 250)` on every route that has one; 0 unnamed buttons on 19/19 |
| 3. Toolbars / headers | ❌ no | 56 px header + exactly one `<h1>` on 19/19, all titles correct |
| 4. Sidebar / nav | ❌ no | 18–22 buttons, icons == buttons, 0 raw anchors on 19/19 |
| 5. Forms | ⚠️ partial | s2 confirmed **0 native `<select>`, 0 native date/time inputs across all 15 Settings tabs** — `CustomSelect`/`DatePicker` compliance holds |
| 6. Spacing | ❌ no | `.glass` padding varies — systemic, part of the deferred rem-refactor item, not per-instance bugs |
| 7. Modals | ❌ no | 0 stray overlays at rest on 19/19; 0 horizontal overflow on 19/19 |

**No non-Heroicon icons, button inconsistencies, header inconsistencies, sidebar issues, non-standard form elements, spacing issues, or modal inconsistencies were found tonight — because those checks did not run.** Audit 5 is the single exception and it passed. Carrying Run 119's numbers forward as if they were tonight's would be fabrication; they are shown above only as the last known state.

The one *copy*-consistency dimension that did run produced both of tonight's UI defects — see `282f51f` and `cc13c6d`.

---

## Bugs Fixed

1. **[`PATCH` — tasks, expenses, invoices, subcontractors, work_orders]** — an explicit `null` for a required field returned **500** instead of 400; `23502 not_null_violation` was missing from `PG_BAD_INPUT_CODES`. — Mapped `23502` → 400, naming the offending column from `err.column`. Verified 11/11. **`43e843e`** (`server/src/middleware/errorHandler.js`, +15)

2. **[`PATCH /api/estimates|invoices|work-orders`]** — `line_items: null` **silently wiped a `NOT NULL` jsonb column behind a 200**, leaving `subtotal`/`total` stale. `JSON.stringify(null)` stores a *jsonb null*, which satisfies `NOT NULL`. — Added an explicit null test to the array and object branches, exempting `estimates.deposit`, which the UI sends `null` to clear. Verified 8/8 both directions. **`824ae24`** (3 route files, +27/−6)

3. **[`/estimates`, `/leads`]** — filtering to zero matches rendered empty-*database* copy ("No estimates yet — create your first one") while the user's 16 estimates still existed. `EstimatesView` had no guard; `LeadList` had one that omitted 2 of its 6 server-side filters. — Used the established ternary idiom, with the condition covering every server-side filter. **`282f51f`** (2 components, +7/−3)

4. **[`/contracts`, `/invoices`, `/estimates`, `/leads`, `/expenses`, `/tasks`]** — a **failed** list load rendered the same empty-database copy with zeroed stat headers and no error indication of any kind. — Added a `loadError` flag set in the `catch` and cleared on every success, checked ahead of the filter branch. Verified on 6/6 routes in both directions. **`cc13c6d`** (6 components, +60/−28)

Defects 3 and 4 are the same family — *empty-state copy that asserts something about the database which the current context does not support*. Three separate runs have now found instances of it (`68c968a`, `282f51f`, `cc13c6d`), and a seventh instance is still open below.

---

## Known Issues (Not Fixed)

1. 🔴 **`client/src/components/AutomationSettings.jsx` is BROKEN in the working tree — uncommitted, and the build does not catch it.**
   s4 found the **7th instance** of the empty-state family (Settings → Automations swallows its load error identically) and began applying the `cc13c6d` fix at 05:50:19, then hit its turn cap mid-edit. The result calls `setLoadError(false)` at line 82 and `setLoadError(true)` at line 85, but **no `loadError` state is ever declared** — `useState` appears 7 times in the file and none of them is `loadError`. Line 253 still has the bare `automations.length === 0`.
   `npx vite build` **passes** (7.99 s) because this is a runtime `ReferenceError`, not a compile error: the `try` throws at line 82, the `catch` throws again at line 85, and `setLoading(false)` never runs.
   **Left as-is deliberately** — this stage's charter is reporting, and completing another stage's unverified edit without its diagnostic context is how regressions get committed. It needs either a revert or 2 lines: declare `const [loadError, setLoadError] = useState(false);` and add the ternary at line 253. **Decide before the next run starts**, or the next `git status` sweep will pick it up as recovered work and may commit it in this state.

2. ⚠️ **No error boundary anywhere in the SPA.** The amplifier behind five past defects, including tonight's #1. Highest-leverage backlog item; an enhancement, so it is the developer's call.

3. **64 generic error toasts discard the server's actionable message** vs 22 that surface it (`InvoicesView.jsx:566` wrong, `:592` right). Confirmed again tonight on `/invoices` and `/contracts` empty-form submit: a 400 arrives, the row is correctly not created, but the user sees only "Failed to save invoice". App-wide convention change — deferred.

4. **Form-label drift — 7 treatments, ~100 inline labels.** 12th run deferred. Refactor, outside the QA charter.

5. **`/alerts` orphan route** — nothing links to it; duplicated under Settings → Storm Alerts. Design decision.

6. **`22007`/`22008` still leak the raw pg message** (`invalid input syntax for type time: "abc"`), exposing the column type name. Deliberate `else` branch in `errorHandler.js`; pre-existing and unchanged by `43e843e`, which added a sibling `23502` branch.

7. **`EstimatesView.jsx:1318`** — measured previously, deliberately not fixed; guarding it means `Array.isArray`-ing every `.map()` in the client.

8. **DB junk rows, user-visible, awaiting go-ahead:** subcontractor `{"$eq":1}`, territory `12345`, `qa_options_probe` custom field.

9. **361 QA screenshots committed to the repo root.** This run added **0**, by choice.

10. **`server/.qa-r91-neverrun.mjs` has never been run — 16 nights.**

11. **10 untracked `.qa-*.mjs` harnesses** in `server/` from tonight (9 × `r122`, 1 × `r124`) plus 5 `claude-overnight-*.json` stage artifacts in the repo root. Not committed by this stage — its commit is scoped to `OVERNIGHT-REPORT.md` and `docs/`.

---

## Test Coverage Gaps

**Caused by stage capping — the dominant failure mode, three of five stages tonight:**

- ⚠️ **The UI consistency audit did not run.** Audits 1, 2, 3, 4, 6 and 7 are entirely unmeasured tonight. This is the second time in three nights the s3 charter has gone unmeasured.
- ⚠️ **s1 wrote no API artifact and s4 wrote no verification artifact.** Both were reconstructed here from raw JSON and a re-run; the reconstruction is sound but cost this stage most of its budget. **Require every stage to write its artifact *before* spending its remaining budget** — the one stage that did (s2) is the one whose results needed no reconstruction.

**Structural — not caused by capping:**

- **`PATCH /api/crm/tasks/:id` still cannot be exercised.** `tasks` holds **0 rows** in this tenant. s1 created a fixture at ~05:07, probed it, and removed it (net-zero), so 7 whitelisted fields remain the last unprobed typed columns in the CRM core. **Creating one durable fixture unblocks it.**
- **`contract_templates.name` / `.type` are unverifiable, and this may be a real user-facing bug.** All 4 template rows have `tenant_id = NULL` and `is_default = true`; the waterloo tenant owns **zero**. `updateTemplate` filters `WHERE id = $2 AND tenant_id = $1`, so a PATCH 404s ("Template not found or not editable") before ever reaching the null guard. **Candidate defect, unverified: Settings → Contracts lists 4 default templates — if the UI offers Edit on them, that click 404s for every tenant.** The next s2 should drive that path.
- **28 `POST` routes skipped** as side-effecting, and **`POST` create-path type confusion remains largely unmeasured** — `createX` functions often bypass the `allowedFields` whitelist and destructure directly (`createWorkOrder` does).
- **14 `GET` routes returned 200 with expected response fields missing** — captured in `qa-r122-sweep.json`, not yet triaged. This is the "`GET` response shapes unasserted" gap narrowing: 132 routes return 200, and now 14 are known to disagree with what the client reads.
- **7 tenant-singleton write routes uncovered** (no `:id`, so the harness skipped them): `/api/alerts/config`, `/api/crm/tenant-settings`, `/api/materials/credentials`, `/api/onboarding/org`, `/api/roof-measurement/config`, `/api/skip-trace/config`, `/api/notifications/preferences`.
- **`territories` table still does not exist** — 4 routes structurally unexercisable.
- **Not swept:** `/content-studio` (unbuilt, not broken); `/canvassing` pin drop (skipped by choice — DB write + paid geocode); `/pipeline` drag.
- **`prefers-reduced-motion` and a print stylesheet** remain the only unmeasured UI dimensions. Both are enhancements rather than QA — confirm scope with the developer first.

### DB hygiene — the "net zero" claim, scoped honestly

Tenant-scoped counts for `791bb51d` (waterloo), before and after the full night:

```
leads 13 · tasks 0 · estimates 16 · invoices 14 · work_orders 10 · contracts 4 · expenses 2 · subcontractors 64
```

Byte-identical to s2's pre-run snapshot. No geocoding, no bulk operations, no QA rows left behind, 0 screenshots written.

One tester-error trap worth recording: an **unscoped** `select count(*) from estimates` returns **17**, not 16 — the 17th row belongs to a different tenant. That looked like real overnight drift for several minutes. **Always scope count queries by `tenant_id` in a multi-tenant DB before reporting drift.** The only genuine side effect all night was a `tenants.updated_at` bump at 05:05:40 from s1's write probe.

---

*Report generated by the s5 report stage (Run 125), 2026-09-03. Build verified `exit 0` at time of writing.*
