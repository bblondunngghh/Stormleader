# StormLeads — Overnight QA Report

**Run 70 · 2026-08-06 · branch `feat/financing`**
Baseline: `675a891` (checkpoint: pre-overnight-run 2026-08-06) · Final code HEAD: `8adf59e`
Stages: s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)
Final client build: **exit 0, 8.26s, 0 errors**

---

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints inventoried | **272** (36 route files) — independently re-counted at s5 |
| API endpoints exercised live | **252 of 272** (92.6%) — 132 GET + 120 write |
| Server 5xx across every API phase | **0** |
| Pages tested at interaction depth | **5 of 19** authed routes — see Coverage Gaps |
| **Bugs found** | **7** |
| **Bugs fixed** | **7** (7 commits, all verified live) |
| UI inconsistencies found | **3** (across 6 component sites) |
| UI inconsistencies fixed | **3** |
| False positives correctly dismissed | **3** |
| Findings reported, not fixed | **6** |
| Final client build | **exit 0**, 8.26s |

Seven bugs found, seven fixed — the highest yield of any run to date. **Four were silent data-integrity
bugs, not crashes**, which is a category shift worth noting: prior runs were dominated by white-screens
that announce themselves. This run's headline defects produced *no error signal at all*.

- **No estimate edit had been reaching the database.** All 84 estimates hold `valid_until = NULL`, the
  builder renders that as `''`, and Postgres rejects `''` for a date column — so every autosave PATCH
  400'd. A bare `catch {}` swallowed it and `Saving…` simply disappeared, so edits looked saved.
- **Merely opening an estimate wrote a row.** One unintended `PATCH` fired ~2s after the builder
  mounted, rewriting `line_items`, `customer_name`, `notes` and `updated_at`. On a Neon free-tier DB,
  browsing estimates was costing a write per open.

These two interact, and the interaction is the reason the second one had been invisible for so long:
while the autosave was 400ing, the write-on-open silently failed too. Fixing the autosave (`ea15a50`)
is what *turned the latent bug into a real write*, and s4 caught it in the same night. Both fixes are
correct and both are required — an edit must save, and an open must not.

**All four upstream stages terminated on their turn caps** (s1 51/50, s2 81/80, s3 61/60, s4 41/40).
Stage cost s1–s4 ≈ **$25.05**. This is the dominant constraint on the run and the primary coverage gap.

---

## Backend API Test Results

All backend work is stage s1, which wrote `C:\tmp\api-test-results.txt` at 05:08 — **the only stage
this run to persist its charter results file.** Everything below is drawn from that file.

### Environment — a false alarm correctly dismissed

s1 opened by checking server freshness and nearly filed a bug that was not one. PID 22796 started
05:07:58 on 2026-08-05; Run 69's fix `447aabd` was committed at 05:10:29, which *looks* like a server
running pre-fix code. It was not: `server/src/routes/crm.js` has mtime 05:07:33 — edited 25 seconds
*before* the server booted, and committed 2.5 minutes after.

> **Method rule established: commit time is not edit time.** Compare file mtime to process start
> time, never the commit date. The server was restarted anyway so tonight ran on committed code.

### Route inventory — 272 routes / 36 files

| Method | Routes |
|---|---|
| GET | 132 |
| POST | 88 |
| PATCH | 26 |
| DELETE | 18 |
| PUT | 8 |
| **Total** | **272** |

140 of 272 are write routes; 109 require a real id in the path.

By category (largest first, re-derived independently at s5 — the totals reconcile exactly with s1):

| Category | File | Routes | Category | File | Routes |
|---|---|---|---|---|---|
| CRM | `crm.js` | 51 | Payments | `payments.js` | 7 |
| Properties | `properties.js` | 18 | Onboarding | `onboarding.js` | 7 |
| Estimates | `estimates.js` | 17 | Territories | `territories.js` | 6 |
| Financing | `financing.js` | 13 | Reports | `reports.js` | 6 |
| Contracts | `contracts.js` | 13 | Notifications | `notifications.js` | 6 |
| Work orders | `workOrders.js` | 12 | Leads | `leads.js` | 6 |
| Skip trace | `skipTrace.js` | 10 | Admin | `admin.js` | 6 |
| Materials | `materials.js` | 9 | Expenses / Drift / Canvassing / Automations / Auth | 5 each | 25 |
| Subcontractors | `subcontractors.js` | 8 | Counties / Alerts | 4 each | 8 |
| Roof measurement | `roofMeasurement.js` | 8 | Map / Documents / Data APIs / Dashboard | 3 each | 12 |
| Invoices | `invoices.js` | 8 | Storms / Storm history | 2 each | 4 |
| Drip | `drip.js` | 8 | Webhook / Search / Hearth / Disaster decl. | 1 each | 4 |

### Phase 1 — GET sweep: 132 tested, 132 passed, 0 failed

| Status | Count | Assessment |
|---|---|---|
| 200 | 98 | Pass |
| 400 | 23 | Pass — missing required query params, correctly validated |
| 404 | 6 | Pass — correct for absent resources |
| 403 | 5 | Pass — `/api/admin/*` correctly refusing a non-platform-admin token |
| **5xx** | **0** | **Pass — no GET regression vs Run 69** |

### Phase 2 — Write-path sweep: 120 tested, 120 passed, 0 failed

**This closes the pipeline's largest standing gap.** Prior runs had cumulatively exercised 3 of 140
write routes; this run probed **120**.

Method: every `:param` filled with a **valid but nonexistent UUID** plus an empty body `{}`. A real id
is deliberately never used, because `PATCH`/`PUT` with `{}` against a live row can null out real
columns. This reaches the validation and error paths while touching no real data.

| Status | Count | Assessment |
|---|---|---|
| 400 | 67 | Pass — correct validation rejection |
| 404 | 41 | Pass — correct for a nonexistent id |
| 200 | 11 | Pass — all 11 triaged individually, none are bugs (below) |
| 403 | 1 | Pass |
| **5xx** | **0** | **Pass — no write route crashes on a missing or empty body** |

The 11 empty-body 200s were each traced to source rather than assumed benign:

- `PUT /api/alerts/config` — `alertService.js:215` returns `getAlertConfig()` when `setClauses.length === 0`.
  A correct read-through; it does **not** wipe config. Verified directly.
- `POST /api/webhooks/hearth` — `{"status":"ignored","reason":"no application_id"}`, a correct guard.
- `POST /api/crm/leads/score-all` (scored 30) and `POST /api/drift/correct-all` (corrected 20) — intended
  bulk operations. `drift/correct-all` is not tenant-scoped, but `storm_events` is global NOAA reference
  data on the same design as `/api/properties/*`. **Not a leak.**
- `POST /api/alerts/test` (no recipients configured), `POST /api/notifications/mark-all-read` (updated 0),
  `PUT /api/onboarding/org`, `POST /api/onboarding/complete`, `PUT /api/crm/tenant-settings`,
  `PUT /api/materials/credentials`, `POST /api/webhooks/tracerfy` — no-op or idempotent on an empty body.

**20 write routes excluded, deliberately and non-silently** — real money, outward effect, or bulk
writes: geocode (1), import (3), send/test-email (5), payments/Stripe (6), skip-trace (4), plans/sync (1).
These remain the only untested write routes.

### Phase 3 — Type-confusion probe: 13 shapes, 0 failed

Run 69 flagged type confusion as the highest-yield axis. s1 inverted the usual search direction —
grep the **client** for the crash shape first, then ask whether the API guards the field feeding it:

```
AlertSettings.jsx:163   (config?.email_recipients || []).map(...)
```

`email_recipients` **is** whitelisted on `PUT /api/alerts/config` with no value-type validation
(`alertService.js:208` whitelists names only) — byte-identical to `d575bf7`, Run 69's white-screen.

Result: 13 shapes → 400×9, 200×4, **0 5xx**. Row restored to original values.

**Verdict: not exploitable, and the reason matters.** The columns are strongly typed (`email_recipients`
is `text[]`, `min_hail_size_in` `numeric`, `digest_hour` `int4`) and the global error handler maps
Postgres cast failures to a clean 400. The type system is performing the validation the JS layer omits.
The 4 accepted shapes are harmless (`[null]` → `{NULL}`, React renders nothing; `[{x:1}]` → coerced to
text; object/array on `alert_mode` → coerced by the varchar column).

> **Conclusion that redirects the next run: the `d575bf7` shape does *not* generalise.** It was dangerous
> on `custom_field_definitions.options` specifically because that column is **JSONB**, which accepts any
> shape verbatim. **JSONB columns are the real risk surface — not "unvalidated fields" in general.**

### Phase 4 — Data correctness: 12 list endpoints, 11 pass, 1 false positive

Tests 200-responses-with-wrong-data, where no error signal exists. 11 of 12 honour `limit` **and**
`offset` correctly. Hostile limits (`abc`, `-1`, `0`, `99999999`) produced no 5xx and no table dumps.
`/api/crm/subcontractors` and `/api/materials/orders` 400 on `limit=abc|-1` — stricter, also correct.

**False positive correctly dismissed:** `/api/materials/products` ignores `limit` and `offset` (136 rows
for every value). Not a bug — it serves a static in-memory `MOCK_PRODUCTS` array (`materials.js:527`)
pending distributor-API integration, and `MaterialsView.jsx:38` deliberately never sends those params
("fetch all and filter client-side for instant tab switching"). Adding pagination would be a *feature*,
which the charter forbids. **Do not re-file.**

### Phase 5 — Auth enforcement: 251 routes, 0 failed

All 272 routes probed with **no credentials** (20 cost/outward-effect routes excluded):

| Outcome | Count |
|---|---|
| 401/403 protected | 236 |
| Reachable, public **by design** (`/api/auth/*`, `/api/webhooks/*`, `/public/*`) | 14 |
| Reachable, unexpected | 1 |

The one unexpected: `POST /api/onboarding/create-tenant` → 400 with a full validation error. That is
**signup** — it must be public, and it validates its input. **Pass, not a bug.**

**No route is missing its `authenticate` / `tenantScope` middleware.**

---

## Frontend Feature Test Results

> **Evidence caveat, stated up front.** s2 and s3 both hit their turn caps before writing
> `frontend-test-results.txt` / `ui-audit-results.txt`. The files at those paths are **stale** — Run 67
> (2026-08-03) and Run 69 (2026-08-05) respectively — and were **not** used as a source here. Everything
> below is reconstructed from committed evidence only: the seven commit messages (each carries its own
> live-verification block), four `r70-*.png` screenshots, and 25 probe scripts, cross-referenced by
> timestamp against the stage windows. **Pages exercised but not fixed left no durable record and are
> not claimed.**

### `/estimates` — estimate builder (s2, re-verified s4) — 4 bugs, 4 fixed

The deepest-tested page of the run and the source of 4 of 7 bugs.

| Tested | Result |
|---|---|
| Click **Edit** on the estimate list | **BROKEN → fixed** (`482d4bc`) — white-screened the whole SPA |
| Autosave round-trip | **BROKEN → fixed** (`ea15a50`) — 400'd for every estimate, silently |
| Open builder without editing | **BROKEN → fixed** (`8adf59e`) — wrote a DB row per open |
| Subtotal / total money formatting | **BROKEN → fixed** (`4177dd5`) — two formats on screen at once |
| Line-item math | **Pass** — 15 presets sum to $1,534.00; qty 1→30 on the $400 item gives $13,134.00 |
| Builder render with malformed rows still in DB | **Pass** — `body.innerText` 0 → 1578 chars, 0 page errors |

**White-screen (`482d4bc`).** `EstimatesView.jsx:1317` loaded `estimate.line_items || []`. That guards a
*missing array* but not a *null element inside one*, and `item.srs_product_id` at `:1491` runs in the
render body — so the throw takes down the entire app, not one panel. Ground truth from a read-only query
over 84 estimates: `EST-083` = `[null]` (newest, and therefore the **first Edit button on the page**),
`EST-082` = `[null,"",1]`. Both are 2026-06-07 drafts — **the same two rows behind the PDF 500 fixed in
`a023c66`**, so the junk elements were never cleaned. Sanitized once at the state boundary, covering all
five consumers in one change.

**Silent autosave failure (`ea15a50`).** `updateEstimate` passed `valid_until` straight through while
`createEstimate` has always coerced it (`:72`, `valid_until || null`). Blast radius is **total, not an
edge case** — all 84 estimates have `valid_until IS NULL`, so the builder holds `''` for every one.
Verified live: `PATCH /api/estimates/:id` 400 → 200.

**Write-on-open (`8adf59e`).** Root cause is the effect's *dependency*, not the debounce: hydration at
`:1309` replaces `form` with a fresh object and `[form, estimate?.id]` cannot distinguish that from a
keystroke. Fixed by **identity** rather than by a timer — the hydrated object is held in
`hydratedFormRef` and the effect returns early when `form` is that exact object. Every user mutation
goes through `setForm(f => ({ ...f }))` and so yields a different object (one hydration site, eight edit
sites, all spread-copies). No debounce tuning and no dirty-flag bookkeeping to keep in sync.
Verified with malformed `EST-082` still in the database: open → **0 PATCH requests (was 1)**, 0 page
errors; edit a field → PATCH 200. Row restored afterward.

**Still needs attention:** `EstimatesView.jsx:1366` catches the autosave rejection with a bare
`catch { setAutoSaveStatus('') }`. Left alone deliberately (it is now on the non-error path), but it is
the reason this bug survived undetected. See Known Issues #1.

### `/invoices` — Record Payment modal (s3) — 1 bug, 1 fixed

All 7 payment-method buttons (check / cash / card / ACH / insurance / financing / other) rendered an
**emoji** in the icon slot. Fixed in `8e022bd`. Verified live: all 7 now render `viewBox="0 0 24 24"`
`stroke-width=1.5` at 16×16, matching the app-wide signature shared by 2,209 SVGs.
Screenshot: `r70-payment-icons-after.png`.

### `/work-orders` — empty state (s3) — 1 bug, 1 fixed

A 48px wrench **emoji** filled the empty-state icon slot; replaced with `WrenchScrewdriverIcon` at the
same 48px / 0.3 opacity (`8e022bd`). Screenshot: `r70-workorders-empty-after.png`.

### `/leads` and `/leads/:id` (s3) — 1 bug, 1 fixed

`LeadDetail`: the priority, stage and roof-type dropdown triggers rendered `U+25BE` instead of
`ChevronDownIcon`, so the page displayed **two different chevrons simultaneously** — every `CustomSelect`
on the same view uses `ChevronDownIcon` (`CustomSelect.jsx:86`). The roof-type trigger was also
internally inconsistent: 13px inline text in the placeholder state, a 10px muted `<span>` otherwise.
`LeadList`: the table sort indicator used `U+25B2`/`U+25BC` across all 7 sortable columns. Fixed in
`e29e005`. Verified live: `chevronOffset 0` (vertically centred) on all three `LeadDetail` triggers;
sort indicator moves CREATED → STAGE on click and the chevron path flips between `ChevronDown` and
`ChevronUp` on the second click, so ASC/DESC still renders correctly.

### Public estimate → financing application (s1, committed s2) — 1 bug, 1 fixed

`createPublicApplication` passed `estimate.total` straight into `financing_applications.amount`. That
column is `INTEGER` holding **cents**, while `estimates.total` is `NUMERIC` **dollars** (`"15000.00"`) —
which Postgres rejects outright for an integer column. Fixed in `e569bde`.

Units were **verified against the schema and the adapter contract, not assumed**:

| Column | Type | Unit |
|---|---|---|
| `financing_applications.amount` | `integer` | cents |
| `financing_plans.min/max_amount` | `integer` | cents (`index.js:129` stores adapter-normalized `p.minAmount`; `hearth.js:38` already ×100) |
| `estimates.total` | `numeric` | dollars |

`hearth.js:48` sends `loan_amount: amount / 100`, confirming the cents contract from the other direction.
This fix was left **uncommitted in the working tree** when s1 hit its turn cap at 05:11:45; s2 verified
and committed it rather than leaving a partial fix on disk.

### Pages with no durable interaction record

`/`, `/pipeline`, `/storm-map`, `/storm-catalog`, `/alerts`, `/tasks`, `/calendar`, `/canvassing`,
`/reports`, `/materials`, `/contracts`, `/expenses`, `/subcontractors`, `/settings`, `/admin` — 14 of 19
routes. See Coverage Gaps #2.

---

## UI Consistency Audit Results

Stage s3, plus one finding from s2. **3 inconsistencies found, 3 fixed, across 6 component sites.**
s3 hit its cap at 61/60 turns before writing `ui-audit-results.txt` or archiving to
`tests/audit-reports/`, so per-category *pass* results are not evidenced — the table below marks those
honestly rather than reporting them as clean.

| Category | Finding | Status |
|---|---|---|
| **Icons** | **Yes — 2 defects, 6 sites.** Emoji in icon slots (7 payment-method buttons, 1 empty state); text glyphs `U+25BE`/`U+25B2`/`U+25BC` as dropdown and sort icons (3 `LeadDetail` triggers, 7 `LeadList` columns) | **Fixed** — `8e022bd`, `e29e005` |
| **Forms / money formatting** | **Yes — 1 defect.** Estimate builder rendered the same subtotal two ways at once | **Fixed** — `4177dd5` |
| **Buttons** | No sizing/styling defect recorded | Not evidenced — s3 capped |
| **Toolbars / headers** | No defect recorded | Not evidenced — s3 capped |
| **Sidebar / nav** | No defect recorded | Not evidenced — s3 capped |
| **Spacing / alignment** | No defect recorded; the two icon fixes added `inline-flex`/`gap:4` so glyphs sit on the text baseline | Not evidenced — s3 capped |
| **Modals** | Record Payment modal audited (icons). Esc-to-close **not** re-tested this run | Partially evidenced |

### Why five prior icon audits missed the emoji — a method defect, now closed

Every prior audit swept `document.querySelectorAll('svg')` and checked `viewBox` / `fill` / `stroke-width`.
**An emoji is a text node, so it is structurally invisible to an SVG-based sweep.** Those audits were
incapable of finding this class of defect. Found only by grepping the source for emoji codepoints.

### And why a source grep alone is *also* insufficient

The `LeadList` sort indicator was **missed by a source grep** for literal triangle characters, because
the source writes them escaped (`'▲'`). It was caught only by reading the rendered DOM text on a live
page.

> **Standing rule for future audits: sweep the SVGs, grep the source, *and* read the rendered DOM.
> No one of the three is sufficient.**

### Deliberately not changed

Pipeline's inline storm-data glyphs and the lead-score bolt. Heroicons has no hail or wind icon, and
`CloudIcon` is already bound to `'cold'` priority at `Pipeline.jsx:107` — substituting there would
recreate the duplicate-icon defect that `79c8945` fixed in the Sidebar.

### Money-formatting consistency (`4177dd5`)

The line-items panel (`:2130`) formatted subtotal with thousands separators while the Summary panel
beside it hand-rolled `toFixed(2)`, putting both on screen at once:

```
Subtotal   $13,134.00     <- line-items panel
Subtotal   $13134.00      <- Summary panel
Total      $13134.00      <- the most prominent number on the page
```

Standardized on `formatCurrency`, already imported at `:6` and already used at `:2103`/`:2419`/`:2483` —
the same helper and the same fix shape as `b7775a8`, which corrected five money sites in this file.
Covers subtotal, discount lines, tax, total, and the estimated cost/profit line. `formatCurrency` also
renders negatives as `-$1,234.56` rather than `$-1,234.56`, which the discount row (rendered as
`-{value}`) depends on. Verified live: both panels read `$13,134.00`. Zero DB writes.

---

## Bugs Fixed

1. **`/estimates` builder — clicking Edit white-screened the entire app.**
   `TypeError: Cannot read properties of null (reading 'srs_product_id')`. `estimate.line_items || []`
   guarded a missing array but not a null element inside one, and the read runs in the render body.
   Fixed by sanitizing once at the state boundary (`Array.isArray` filter), covering all five consumers.
   Verified with the malformed rows still in the database. — **`482d4bc`**

2. **`/estimates` builder — autosave failed silently for all 84 estimates.**
   `updateEstimate` passed `valid_until: ''` through to a Postgres `date` column, which 400'd every
   PATCH; a bare `catch` hid it. No edit in the builder was reaching the database. Coerced to `null`,
   matching `createEstimate:72`. Verified 400 → 200. — **`ea15a50`**

3. **`/estimates` builder — opening an estimate wrote to the database on its own.**
   The autosave effect's `[form, estimate?.id]` dependency could not distinguish hydration from a
   keystroke, so every open fired one PATCH, rewriting `line_items`, `customer_name`, `notes` and
   `updated_at`. Fixed by object identity via `hydratedFormRef`. Verified: 1 PATCH → 0 on open, PATCH
   200 still fires on a real edit. — **`8adf59e`**

4. **Public estimate → financing — dollars written into a cents column.**
   `createPublicApplication` passed `estimates.total` (`numeric`, dollars) into
   `financing_applications.amount` (`integer`, cents). Units verified against the schema and the Hearth
   adapter contract in both directions. — **`e569bde`**

5. **`/estimates` builder — the same subtotal rendered two different ways at once.**
   Summary panel hand-rolled `toFixed(2)` beside a panel using thousands separators (`$13134.00` vs
   `$13,134.00`). Standardized on the already-imported `formatCurrency`. — **`4177dd5`**

6. **`/invoices` + `/work-orders` — emoji used as icons instead of Heroicons.**
   7 payment-method buttons and the work-orders empty state. Replaced with the correct Heroicons at
   matching sizes. Invisible to five prior SVG-based audits because an emoji is a text node. — **`8e022bd`**

7. **`/leads` + `/leads/:id` — text glyphs used as dropdown and sort icons.**
   `U+25BE` on 3 `LeadDetail` dropdown triggers (showing two different chevrons on one page) and
   `U+25B2`/`U+25BC` on all 7 `LeadList` sortable columns. Now byte-identical to `CustomSelect`'s
   chevron (10×10, opacity 0.5, strokeWidth 2.5). — **`e29e005`**

---

## Known Issues (Not Fixed)

1. **Autosave errors are still swallowed silently.** `EstimatesView.jsx:1366` —
   `catch { setAutoSaveStatus('') }`. `ea15a50` moved it off the error path but did not remove it; this
   bare catch is precisely why bug #2 went undetected across 69 prior runs. A user whose save fails sees
   `Saving…` vanish and nothing else. **Needs a design decision** on error surfacing, so it is out of
   charter for an unattended fix.

2. **Run 66 type-confusion residue still in the live DB.** `PUT /api/materials/credentials` echoes
   `preferred_branch_id: "true"` and `preferred_branch_name: "true"` — stored junk from Run 66, not
   created by this run's probes. The write-path guard stops new junk but cannot clean stored rows.
   **Needs a data migration.**

3. **Malformed estimate rows remain by design.** `EST-083` = `[null]`, `EST-082` = `[null,"",1]`
   (2026-06-07 drafts). Left in place deliberately so the new render guards stay exercised against real
   junk — `482d4bc` and `8adf59e` were both proven *with these rows present*. A cleanup migration would
   also be legitimate; leaving them is the more conservative choice.

4. **`GET /api/properties/fema-live` returns 500 — external, not app code.**
   `nsi.sec.usace.army.mil:443` connect timeout. Carried from Run 69. Worth a graceful-degradation
   ticket so a third-party outage does not surface as a server error.

5. **20 write routes permanently excluded from automated testing.** geocode (1), import (3),
   send/test-email (5), payments/Stripe (6), skip-trace (4), plans/sync (1) — real money, real email to
   real customers, or bulk writes. These require a staging environment with stubbed providers, not a
   test-harness change.

6. **JSONB columns are an unswept risk surface.** Phase 3 established that strongly-typed Postgres
   columns absorb bad shapes safely, and that `custom_field_definitions.options` was dangerous
   *because it is JSONB*. No systematic sweep of JSONB columns has been run. **This is the single
   highest-value target for Run 71.**

---

## Test Coverage Gaps

1. **All four upstream stages terminated on their turn caps** — s1 51/50, s2 81/80, s3 61/60, s4 41/40.
   This is the run's dominant constraint. Every other gap below is downstream of it. Stage cost
   s1–s4 ≈ $25.05 for ~58 minutes of wall-clock work.

2. **Interaction testing reached 5 of 19 authed routes** — `/estimates`, `/invoices`, `/work-orders`,
   `/leads`, `/leads/:id`. Up from 4 of 19 last run. The hit rate on pages that *were* exercised is
   7 bugs across 5 pages, so **the remaining 14 routes should not be assumed clean.**

3. **INFRA — 3 of 4 stages again failed to write their charter `.txt` results file.** Only s1 wrote
   (`api-test-results.txt`, 05:08). `frontend-test-results.txt` still carries **Run 67** (2026-08-03)
   and `ui-audit-results.txt` still carries **Run 69** (2026-08-05); a reader trusting mtimes would
   silently report stale data as current. **Identical to Run 69 — the incremental-write rule declared
   fixed in Run 67 is now 1-of-4 for the second consecutive run.** s3 also skipped its
   `tests/audit-reports/` archive, which it did produce in Runs 67 and 69.
   *Mitigation that worked:* the seven commit messages each carry a full live-verification block, which
   is why this report has per-bug evidence despite three missing files. **Commit messages are currently
   the pipeline's most reliable evidence channel — the `.txt` rule is not.**

4. **Write-path coverage is validation-depth, not payload-depth.** 120 of 140 write routes were probed,
   but with an *empty body and a nonexistent id* — this proves no route crashes on bad input, which is
   real and valuable, but it exercises **zero** successful-write logic. Realistic-payload write testing
   remains at roughly the 3-route historical figure.

5. **No tenant-isolation / IDOR probe ran this run.** 10 of 26 tenant-scoped routes still cannot be
   probed at all (no second tenant has rows). Run 67's 16-route probe found 0 leaks; that remains the
   most recent evidence.

6. **UI audit categories other than icons are unevidenced.** Buttons, toolbars/headers, sidebar/nav and
   spacing produced no recorded findings, but s3 capped before writing results — **absence of a finding
   here is not evidence of consistency.** Esc-to-close (0/4 modals in Run 69) was not re-tested.

7. **Untested by standing policy or prior decision:** Storm Map, Admin and roof drawing remain
   render-depth only (map component code is charter-excluded); tab *order* and Enter-to-submit still
   untested; Google geocoding and side-effecting routes permanently excluded per the cost rule;
   mobile/375px paused per the web-only focus.

---

## Carry-Forward for Run 71

1. **Sweep JSONB columns for the type-confusion shape.** Phase 3 proved the `d575bf7` shape does not
   generalise to typed columns — JSONB is where it does. Highest-value target.
2. **Raise the s2/s3 turn caps, or make the results-file write the first action rather than the last.**
   Four capped stages and three missing files have the same root cause.
3. **Grep for the Run 69 shape again** — a truthiness or length check standing in for a type check.
   It produced 3 of 5 bugs in Run 69 and 1 of 7 here (`482d4bc`). Not exhausted.
4. **Audit method: SVG sweep + source grep + rendered-DOM read.** Each of the three missed a real defect
   this run that another caught.
5. **Compare file mtime to process start time, never commit date,** when checking server freshness.

**Drift baseline for Run 71: `8adf59e`.**

---

*Report generated by stage s5-report. Build verified `exit 0` (8.26s) at time of writing.*
