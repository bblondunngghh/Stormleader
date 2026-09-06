# StormLeads — Overnight QA Report

**Date:** 2026-09-05 · **Run 126** · **Branch:** `feat/financing`
**Baseline:** `7120921` (`pre-overnight-20260905`) → **HEAD:** `5798949`
**Stages:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report

> **Run-number note (recurring):** s1 labelled tonight *Run 125* and named its harnesses
> `.qa-r125-*`; s2 and s4 labelled it *Run 126* (`.qa-r126-*`). This is the identical
> off-by-one that split 2026-09-04 (s2 *Run 123* / s3 *Run 124*) and that last night's
> report asked to resynchronise. It was not resynchronised. This report uses **126**.

---

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints exercised | **177 probes** — 132 GET sweep + 5 public token routes + 7 cross-tenant create probes + 23 `tasks` lifecycle assertions + 12 `contract_templates` assertions |
| Route inventory | **272 routes / 36 files** (GET 132 · POST 88 · PATCH 26 · PUT 8 · DELETE 18) — unchanged since Run 114 |
| Pages tested (frontend) | **Not measurable — see Coverage Gaps.** Evidenced from commits: `/estimates` (builder), `/materials`. The 14-page charter was not demonstrably swept. |
| Server errors (5xx) | **0** across all 132 GET routes |
| Bugs found | **10** |
| Bugs fixed | **10** (6 commits) |
| UI inconsistencies found | **4** (1 placeholder glyph + 3 off-standard toggles) |
| UI inconsistencies fixed | **4** |
| Regressions introduced | **0** |
| Build | **PASS — 8.01s** (s5 final check, exit 0) |
| Database | **Net zero** — no rows added, removed or left behind |
| Stage cost (s1–s4) | **$24.39** (s1 $5.16 · s2 $7.26 · s3 $6.53 · s4 $5.44) |

### 🔴 Run integrity: all four working stages hit their turn cap

Every stage terminated on `error_max_turns`, not on completing its charter:

| Stage | Turns | Artifact written | Commits |
|---|---|---|---|
| s1 api-test | 51/50 | ✅ `/tmp/api-test-results.txt` (05:10) | 2 |
| s2 frontend-test | 81/80 | ❌ none | 2 |
| s3 ui-audit | 61/60 | ❌ none — **its charter explicitly required one** | 2 |
| s4 verify | 41/40 | ❌ none — **no verdict of any kind** | 0 |

**This is the third consecutive night that capping is the dominant failure mode, and the
first night on which all four stages capped.** The defect counts below reflect how much
testing ran, not how sound the application is.

> ⚠️ **Stale-artifact trap, avoided.** `/tmp/frontend-test-results.txt` (2026-09-04 05:28)
> and `/tmp/ui-audit-results.txt` (2026-09-04 05:43) are **last night's files**. s2 and s3
> never overwrote them. Reading them as tonight's would have fabricated two entire
> sections — the exact failure last night's report warned about after it happened with
> `/tmp/api-test-results.txt`. **The frontend and UI-audit sections below are reconstructed
> from commits and source verification only, and are scoped accordingly.**

---

## Backend API Test Results

Source: `/tmp/api-test-results.txt`, written by s1 at 05:10 — genuine and current
(self-labels 2026-09-05, cites tonight's commits).

### Phase 1 — exhaustive GET sweep

All **132** GET routes in the inventory, with real ids substituted.

| Result | Count |
|---|---|
| 2xx | 113 |
| 4xx (expected) | 9 — 5×403 admin-only, 4×400 missing required param |
| **5xx** | **0** |
| Skipped (backing table/column absent) | 10 |

Identical to Run 123 — **no drift**.

### Phase 2 — public customer-facing token routes (never swept by any prior run)

These live outside the authenticated app shell, so no prior 19-route sweep reached them.
Probed with **no** `Authorization` header, exactly as a customer's browser sends them.

| Endpoint | Valid token | Bogus token |
|---|---|---|
| `GET /api/estimates/public/:token` | 200 full estimate | 404 clean JSON |
| `GET /api/crm/contracts/public/:token` | 200 full contract | 404 clean JSON |
| `GET /api/leads/status/public/:token` | 200 company + customer + status | 404 clean JSON |
| `GET /api/crm/financing/public/:token/plans` | 200 | 404 clean JSON |
| `GET /api/crm/financing/public/:token/applications` | 200 | 404 clean JSON |

**5/5 work · 5/5 reject an invalid token with a clean 404 · 0 server errors, no stack leaks.**
This closes a blind spot carried as a 🔑 priority from 2026-09-04.

### Phase 3 — `tasks` table (fixture written and abandoned two nights running; now closed)

**23 assertions, 0 failures.** Create 201 · 6 list filters · all 7 PATCH whitelist fields ·
42 wrong-type/null probes · 3 consumer reads. `tasks` count restored 0 → 0.
Type handling: `due_date` / `completed_at` / `assigned_to` / `priority` all 400 on wrong
types; `title` / `status` coerce arrays to a Postgres array literal — accepted, not a crash.

### Phase 4 — `contract_templates` (3-night-old ticket) — **RESOLVED AS A NON-BUG**

Predicted defect: *"all 4 templates are `tenant_id NULL` and `updateTemplate` filters
`WHERE id=$2 AND tenant_id=$1`, so Edit 404s for every tenant."*

**Correct at every layer — 12/12 assertions pass.** `SettingsView` renders Edit/Delete
behind `{!isBuiltin && ...}`; built-ins show only Clone plus a "Built-in" badge, so the 404
path is **unreachable from the UI**. The server independently refuses PATCH/DELETE on a
built-in with 404 (defence in depth), row unchanged. The real path works: Clone → 201 →
appears with `is_default=false` → Edit → 200 and persists → Delete → 200. DB net zero 4 → 4.

**Do not re-file.**

### Phase 5 — multi-tenant isolation — 🔴 6 confirmed cross-tenant PII disclosures

The 62 static tenant-scope candidates carried from last night were triaged **empirically** —
rows provably belonging to another tenant were attacked with the `waterloo` token.

**Correctly refused (11):** GET / PATCH / POST-send / DELETE on a foreign estimate (404, row
unchanged); PATCH / DELETE on a foreign `estimate_template` and `financing_plan` (404/400,
rows unchanged).

**Confirmed disclosures — all fixed:**

| Endpoint | Leaked | Fix |
|---|---|---|
| `POST /api/crm/tasks` | accepted foreign `lead_id` + `assigned_to` (201 → now 400) | `3a3d752` |
| `GET /api/crm/tasks` | foreign **user** first/last name | `3a3d752` |
| `GET /api/crm/dashboard/tasks-today` | foreign **customer** name + street address | `3a3d752` |
| `GET /api/crm/contracts` | foreign customer PII | `1e94206` |
| `GET /api/crm/invoices` | foreign customer PII | `1e94206` |
| `GET /api/crm/expenses` | foreign customer PII | `1e94206` |
| `GET /api/estimates` | foreign customer PII | `1e94206` |
| `GET /api/crm/work-orders` | foreign customer PII | `1e94206` |

**Root cause (one family):** every create endpoint taking a client-supplied `lead_id`
accepted a lead owned by *any* tenant, and every matching list query joined
`LEFT JOIN leads l ON l.id = <x>.lead_id` **with no tenant predicate**.

**Fix:** `assertOwned()` at the `tasks` write boundary (create + update), and **13 `leads`
joins across 5 services** scoped with `AND l.tenant_id = <x>.tenant_id` — closing the
disclosure *structurally*, including for any cross-tenant row already stored, which
per-endpoint input validation alone would not reach.

**Verified:** re-probe reports 0 leaks · regression harness confirms every legitimate
same-tenant row still resolves its lead fields (contracts 1/1, invoices 4/4, expenses 0/0,
estimates 9/9, work-orders 4/4) · full 132-route GET sweep unchanged at 113×2xx / 0×5xx.

⚠️ **This family is NOT fully closed — see Known Issues #1.**

---

## Frontend Feature Test Results

> **Scope warning.** s2 capped at 81/80 without writing an artifact. What follows is
> reconstructed from its two commits and verified against current source by s5. **s2's
> actual page coverage is unknown**; the 14-page charter (`/dashboard`, `/storm-map`,
> `/pipeline`, `/leads`, `/leads/:id`, `/estimates`, `/invoices`, `/work-orders`, `/tasks`,
> `/calendar`, `/reports`, `/canvassing`, `/content-studio`, `/settings`) **cannot be
> reported as swept.**

### `/estimates` — estimate builder — 2 defects found, 2 fixed

**Both are silent data-loss bugs: the user's input is discarded, the save returns 200, and
nothing anywhere reports a problem.**

**1. Footer Notes discarded on save (`25edc26`).** The Footer Notes panel sits directly
above "Save All", but `footer_notes` appeared in **none** of the four payloads that button
and its siblings send (`handleSave`, `handleSaveAndSend`, "Download PDF" save, "Sign Now"
save). `footerNotes` is held outside `form` in its own always-visible panel, so the
`...form` spread never picked it up. The server's `updateEstimate` whitelist skips
`undefined`, so every save returned **200 and wrote nothing**.

The hydration effect had the mirror-image gap — it rebuilt `form` from the row but never
called `setFooterNotes`, so the editor opened **blank** on an estimate that already had
footer notes, and the one payload that *did* send `footer_notes` (Send for Signing) then
wrote that blank back over the stored value. Both halves fixed.

**2. "Send for Signing" dropped five fields (`a380a7a`).** The send-for-signing modal built
its own payload instead of the shared one, missing `financing_enabled`,
`financing_plan_ids`, `insurance_details`, `upgrades` and `deposit`.

For an *existing* estimate this is invisible — `updateEstimate`'s whitelist skips
`undefined`, so stored values survive. But the same line calls **`createEstimate`** when the
builder has no saved estimate yet, and "Send for Signing" is ungated in the builder header.
**A rep who builds a new estimate with insurance details, upgrades, a deposit or a financing
plan and sends it without first clicking "Save Draft" loses all five silently.** Nothing
errors; the estimate simply goes out without them.

Proved live with **zero database writes**, capturing the outgoing request with a Playwright
route that aborts it: before, the flow sent a 19-key POST against Save Draft's 24; after,
all 24, byte-identical to the other four payloads.

**s5 verification:** all five save payloads at `EstimatesView.jsx:1598`, `:1616`, `:1688`,
`:1707`, `:2826` are now character-identical and all carry `footer_notes`; hydration seeds
`setFooterNotes` at `:1365`. ✅

**Still needs attention:** a **sixth**, narrower payload at `EstimatesView.jsx:1408` — the
2-second debounced autosave — still sends only `{...form, financing_enabled,
financing_plan_ids}`. It is **not** a live defect: it only ever runs against an existing
`estimate.id` via `updateEstimate`, whose whitelist skips the absent fields, so nothing is
overwritten. Flagged because it is the same divergent-payload shape that produced both of
tonight's defects, and it is the one remaining copy that has not been unified.

---

## UI Consistency Audit Results

> **Scope warning.** s3 capped at 61/60. Its charter required creating
> `/tmp/ui-audit-results.txt`; **it did not** — the file at that path is from 2026-09-04.
> Which of the 7 audits actually ran tonight is unknown. Audits 1 and 3–7 have **no
> evidence of execution tonight** and are reported as unmeasured, not as clean.

| # | Audit | Result tonight |
|---|---|---|
| 1 | **Icons** — Heroicons 24/outline only | **Unmeasured.** No non-Heroicon icons were reported or fixed. Converged clean on 2026-09-04. |
| 2 | **Buttons** — sizing / styling | **1 defect family found, fixed** (`5798949`) — see below |
| 3 | **Toolbars / headers** | **Unmeasured tonight.** Converged clean 2026-09-04. |
| 4 | **Sidebar / nav** | **Unmeasured tonight.** Converged clean 2026-09-04. |
| 5 | **Forms** — `.form-input`, `CustomSelect`, `DatePicker` | **Unmeasured tonight.** Converged clean 2026-09-04. |
| 6 | **Spacing / alignment** | **1 defect found, fixed** (`29fadca`) — placeholder glyph |
| 7 | **Modals** | **Unmeasured tonight.** Converged clean 2026-09-04. |

### Audit 2 — three off-standard toggle switches in the estimate builder (`5798949`)

Run 78-s3 standardised the app's toggle to **44×24 · radius 12 · 18px knob · on
`var(--accent-green)` · off `oklch(0.30 0.02 260 / 0.6)` · knob `var(--text-primary)`**, and
recorded that *"the app has FOUR ToggleSwitch implementations."* **It has nine.** The
enumeration never entered the estimate builder, which holds three:

| Control | Was | Problem |
|---|---|---|
| Insurance Claim (`:2394`) | 42×24, on `oklch(0.55 0.18 250)`, knob `oklch(1 0 0)` | hardcoded blue at L=0.55 |
| Financing Options (`:2587`) | 42×24, on `oklch(0.55 0.18 145)`, knob `oklch(1 0 0)` | hardcoded green at L=0.55 |
| Require deposit (`:2686`) | 36×20, on `oklch(0.72 0.19 250)`, knob white + shadow | a population of **one** |

All three hardcoded their colours instead of using a token, and both "on" colours are
**near-misses of real tokens at a materially darker lightness** — `--accent-blue` is
`oklch(0.72 0.19 250)` but insurance used L=0.55; `--accent-green` is `oklch(0.75 0.18 155)`
but financing used `oklch(0.55 0.18 145)`. On a dark-mode-first UI an "on" toggle at L=0.55
reads visibly dimmer than the identical control in Settings / Alerts / Onboarding.

They also **disagreed with each other** — insurance blue, financing green, deposit blue — in
the same stack of panels. Not contextual sizing: all three sit in full-width `.glass` panels
with `var(--space-xl)` padding, the roomiest context in the app, and the financing panel has
no icon, so its green could not have been echoing a section accent.

All three aligned to 44×24, including knob travel (`left 21→23`, and `2/18 → 3/23`) to
preserve the 3px end gap. **Deliberately not touched:** the 10 compact section toggles in the
same builder (34×18, documented as deliberate in Run 78-s3, verified still 34×18 after the
change), and `AutomationSettings.jsx:274` / `DripSequences.jsx:462` (40×22, byte-identical to
each other, token-driven, in dense list rows).

Verified live: both reachable toggles measure 44×24, radius 12px, on `oklch(0.75 0.18 155)`,
knob 18px, travel 3px→23px, no shadow — identical to the Settings standard in both states.
The financing toggle is behind `hasLender` and this tenant has no lender configured, so it
was fixed by identical code but **not live-measured**.

### Audit 6 — non-standard empty-value placeholder (`29fadca`)

The BRANCH column of the SRS Order History table fell back to a **double hyphen**
(`MaterialsView.jsx:768`). That was the **only** `--` placeholder in the client; the app's
idiom is the em-dash — **71 sites across 12 components**, including every other table cell
that can be empty (Contracts, Estimates, Invoices, Expenses, LeadList, Subcontractors).

**Visible, not latent:** all 6 SRS orders in this tenant have a NULL `branch_name`, so the
whole column rendered `--` beside neighbours that render an em-dash under the same condition.

**Deliberately left alone:** `MaterialsView.jsx:821` (`|| 'Not specified'`) — same column but
in the order-detail info grid, where its siblings always have values, so there is no adjacent
em-dash to clash with; and `Dashboard.jsx:719` (`|| '-'`) — inside `if (isMobile)`, and mobile
is paused.

**s5 verification:** `grep "|| '--'"` across `client/src` returns **zero** matches. ✅

---

## Bugs Fixed

1. **`POST /api/crm/tasks` + `GET /api/crm/tasks` + `GET /api/crm/dashboard/tasks-today`** —
   accepted a `lead_id` and `assigned_to` belonging to any tenant, and both read paths joined
   `leads`/`users` with no tenant predicate, rendering another tenant's data straight back to
   the caller (customer name `ZZ-VICTIM-CUSTOMER`, address `999 SECRET STREET`, and a foreign
   user's real name) — **fixed** by `assertOwned()` at the shared write boundary (400 when the
   row is not the tenant's) plus scoping both joins to `t.tenant_id`. `3a3d752`
2. **`GET /api/crm/contracts`** — leaked another tenant's customer name and street address via
   an unscoped `leads` join — **fixed** by `AND l.tenant_id = c.tenant_id`. `1e94206`
3. **`GET /api/crm/invoices`** — same disclosure — **fixed** by `AND l.tenant_id = i.tenant_id`. `1e94206`
4. **`GET /api/crm/expenses`** — same disclosure — **fixed** by scoped join. `1e94206`
5. **`GET /api/estimates`** — same disclosure — **fixed** by `AND l.tenant_id = e.tenant_id`. `1e94206`
6. **`GET /api/crm/work-orders`** — same disclosure — **fixed** by `AND l.tenant_id = wo.tenant_id`. `1e94206`
7. **`/estimates` (builder)** — Footer Notes silently discarded on all four save paths, and the
   editor opened blank on an estimate that had them, after which Send for Signing wrote the
   blank back over the stored value — **fixed** by adding `footer_notes` to the four payloads
   and seeding `setFooterNotes` at hydration. `25edc26`
8. **`/estimates` (builder) — "Send for Signing"** — dropped `financing_enabled`,
   `financing_plan_ids`, `insurance_details`, `upgrades` and `deposit` when it created a
   not-yet-saved estimate, sending it out without them and reporting success — **fixed** by
   unifying its payload with the other four (19 keys → 24). `a380a7a`
9. **`/materials` — Order History** — the BRANCH column used `--` where the app's other 71
   empty-value placeholders use an em-dash, visible on all 6 of this tenant's orders —
   **fixed** by replacing it with `—`. `29fadca`
10. **`/estimates` (builder) — three toggle switches** — 42×24 / 42×24 / 36×20 with hardcoded
    colours that disagreed with the app's 44×24 standard, with each other, and with real
    tokens at a visibly darker lightness — **fixed** by aligning all three to the standard,
    including knob travel. `5798949`

---

## Known Issues (Not Fixed)

### 1. 🔴 The cross-tenant PII family is only PARTIALLY closed — 8 identical joins remain

s1 fixed the six instances it **proved**. **s5 found eight more `leads` joins of the exact
same shape still unscoped** — tenant-scoped outer query, `LEFT JOIN leads` with no tenant
predicate, **lead PII selected into the response**:

| Location | Selects |
|---|---|
| `routes/crm.js:1069` (calendar — tasks) | `l.contact_name, l.address` |
| `routes/crm.js:1081` (calendar — activities) | `l.contact_name, l.address` |
| `services/crmService.js:730` (`getRecentActivity`) | `l.address, l.contact_name, l.stage` |
| `services/dashboardService.js:111` (dashboard activity) | `l.contact_name, l.address` |
| `services/documentService.js:26` | `l.address AS lead_address` |
| `services/dripService.js:211` (enrollments) | `l.contact_name, l.contact_email, l.address` |
| `services/searchService.js:21` (global search) | `l.address AS lead_address` |
| `services/emailService.js:160` (overdue reminders, background job) | `l.contact_name, l.contact_email` |

**The `activities` path is a complete, end-to-end instance that is still open on *both*
sides.** `logActivity()` (`crmService.js:311`) takes `lead_id` straight from the request body
with **no ownership check**, and three separate read paths join `leads` unscoped and select
customer name and address. That is precisely the defect fixed for `tasks` in `3a3d752`, still
live for activities.

`emailService.js:160` is the worst-consequence variant: a cross-tenant `lead_id` on an invoice
would send an overdue-payment reminder **to the wrong tenant's customer**.

> **Confidence:** identified by source inspection and verified present in the current tree by
> s5; **not empirically attacked tonight** (s5's charter is report-only). s1 proved the
> identical shape exploitable on six sibling endpoints, so these should be treated as
> live until disproven. **This is the highest-priority item in the repository.**

### 2. 🔴 Cross-tenant foreign keys are still ACCEPTED at the write boundary

Only `tasks` validates ownership. `contracts`, `invoices`, `expenses`, `estimates`,
`work_orders` and `activities` all still accept a `lead_id` owned by another tenant. No PII is
disclosed on the six fixed read paths any more, but **a dangling cross-tenant reference can
still be stored**, and it will surface through any join that is not yet scoped (see #1).

### 3. ⚠️ `server/src/utils/assertOwned.js` is an unwired orphan — do not commit as-is

s4 wrote a generalised `assertOwned()` helper at 05:49, one minute before capping, and left it
**untracked and imported by nothing**. `crmService.js:405` defines its **own local copy**,
which is what `3a3d752` actually ships — so **the build is not broken and tonight's fix is
self-contained**. The file is dead code that duplicates a live function. It is deliberately
left uncommitted; committing it would add an unused module, and *last night's report documents
the opposite failure* — a checkpoint sweeping in a capped stage's half-applied edit and
shipping a dead panel. **Either wire it up and delete the local copy, or delete the file.**

### 4. 🔴 No ESLint in the project

Carried and unaddressed. Still the highest-leverage structural fix available: 2026-09-04's
worst defect (a dead Settings panel from `setLoadError is not defined`) is exactly what
`no-undef` catches and a green Vite build provably cannot.

### 5. Carried forward, unchanged

- ⚠️ **No error boundary anywhere in the SPA** — the amplifier behind five past defects.
- **64 generic error toasts discard the server's message** (`InvoicesView.jsx:570`).
- **Form-label drift** — 7 treatments, ~100 inline labels. Deferred a 13th run.
- **Empty-state styling is split** — only `TasksView` uses `.empty-state`; 9 other list views
  inline-style theirs. Refactor candidate, not a defect.
- **`ActivityModal` has no Esc handler** — closes via backdrop + `aria-label="Close"`, so not
  a trapped modal. Known and deferred.
- **`/alerts` orphan route** · **`22007`/`22008` still leak the raw pg message** (a deliberate
  `else` in `errorHandler.js`).
- **`territories` table does not exist** — 4 routes structurally unexercisable.
- **DB junk rows awaiting go-ahead:** subcontractor `{"$eq":1}`, territory `12345`,
  `qa_options_probe`.
- **361 QA screenshots at the repo root** (337 tracked) — **this run added 0.**
- **`server/.qa-r91-neverrun.mjs`** — written, never run, 18 nights.
- **10 untracked `.qa-*.mjs` harnesses** + 5 `claude-overnight-*.json` in the tree; this
  commit is scoped to `OVERNIGHT-REPORT.md` and `docs/` only.

---

## Test Coverage Gaps

1. 🔴 **s4 (verify) produced no verdict, for the third consecutive night.** Capped at 41/40
   having written two harnesses and the orphan helper. Its entire charter — independently
   re-verify every fix, empty states, form validation, browser back/forward, 375px responsive —
   is **unmeasured**. All six fixes were verified by the stages that made them; none received
   **independent** re-verification. `.qa-r126-s4-crosstenant-verify.mjs` is a well-formed
   plant-repoint-read-revert harness that **left no output — whether it ran is unknown.**
   It also reads a token from `C:/tmp/qa-token.txt`, last written **2026-07-27**.
2. 🔴 **s2 and s3 wrote no artifact.** s3's charter *explicitly* required
   `/tmp/ui-audit-results.txt`. Frontend page coverage and UI audits 1, 3, 4, 5 and 7 are
   **unknown for tonight** — reported above as unmeasured, not as passing.
3. ⚠️ **Only 132 of 272 routes (49%) are swept at all.** 88 POST / 26 PATCH / 8 PUT / 18
   DELETE remain largely unprobed. `createX` frequently bypasses `allowedFields` and
   destructures directly.
4. ⚠️ **GET response shapes still unasserted.** 132 routes return 200; nothing checks the
   payload against what the client actually reads. R122's 14 known disagreements remain
   untriaged.
5. ⚠️ **3 PUT tenant-singleton routes still unclassified** — `/api/alerts/config`,
   `/api/crm/tenant-settings`, `/api/materials/credentials` return 200 to an empty body. Row
   counts prove no row was *created*; they cannot prove no column was *mutated*. The other 4
   singletons were never probed.
6. **10 GET routes skipped** for absent backing tables/columns (`territories`,
   `drip_sequences/:id`, `prospect-lists/:id/items`, `skip-trace/job/:jobId` and others).
7. **The financing toggle fix was not live-measured** — it is behind `hasLender` and this
   tenant has no lender configured. Fixed by code identical to the two verified toggles.
8. 🚫 **Deliberate exclusions, not oversights:** `/storm-map` address search (Google Places +
   Geocoder, **billable per keystroke** — standing exclusion); FEMA map property code
   (off-limits, actively developed); paid/destructive `/leads/:id` controls (Measure Roof, Run
   Trace, Share Status Page, Remove Lead, Generate Contract); `/work-orders` milestone toggling
   and `/canvassing` pin drop (writes). **No screenshots taken, by choice.**

---

## Database Hygiene

**Net zero.** Tenant-scoped counts for `791bb51d` (waterloo) are identical to the pre-run
snapshot: `leads 13 · tasks 0 · estimates 16 · invoices 14 · work_orders 10 · contracts 4 ·
expenses 2 · subcontractors 63`. `contract_templates` 4 → 4. Zero fixture leftovers — every
planted foreign lead and every repointed row was reverted. Both frontend defects were proved
with **zero writes**, by capturing the outgoing request with a Playwright route that aborts it.

> 🚫 **Standing tester-error trap:** an **unscoped** `SELECT count(*) FROM estimates` returns
> **17**, not 16 — the 17th row belongs to another tenant. Always scope count queries by
> `tenant_id` before reporting drift.

---

## Recommendations for the Next Run

1. 🔑 **Fix the 8 remaining unscoped `leads` joins, starting with `activities`** — it is open
   on both the write and read sides and is the same defect already proved exploitable six
   times tonight. This is a security-class item, not a cosmetic one.
2. 🔑 **Extend `assertOwned()` to the other five create paths**, then delete or wire up the
   orphan `server/src/utils/assertOwned.js`.
3. 🔴 **Raise the turn budgets or narrow the charters.** Four of four stages capped. Two of
   them lost their entire evidence trail. This is now a three-night trend and it is costing
   more coverage than any single defect found.
4. 🔑 **Make "write your artifact FIRST" a hard rule.** Written twice before and ignored twice.
   s1 wrote first and needed no reconstruction; s2, s3 and s4 did not and are unreportable.
5. 🔑 **Give s4 a runnable, self-contained charter** — it has now produced no verdict three
   nights running. Start by refreshing `C:/tmp/qa-token.txt` and running
   `.qa-r126-s4-crosstenant-verify.mjs`, which is already written.
6. **Decide on ESLint.** The structural answer to a whole class of defect.
7. **Resynchronise the run number** — split for the second night running.
