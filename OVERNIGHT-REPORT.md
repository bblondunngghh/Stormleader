# StormLeads — Overnight QA Report

**Date:** 2026-09-02
**Branch:** `feat/financing`
**Baseline:** `4e3352b` (tag `pre-overnight-20260902`) → **HEAD `68c968a`**
**Final build:** `npx vite build` — **exit 0, built in 8.05s**

---

## QA Test Summary

| Metric | Count |
|---|---|
| Routes/pages exercised | **19** statically audited · **6** driven functionally in a browser |
| API endpoints tested | **10 distinct** (8 `PATCH` + 1 `POST` + login) of a **272-route / 36-file** inventory |
| API requests issued | **~680** (331-request typed-column sweep, re-run after the fix, + 18 verification probes) |
| Bugs found | **5** |
| Bugs fixed | **4** |
| Bugs open | **1** (found during report reconstruction — see Known Issues) |
| UI style inconsistencies found | **0** (Audits 1–7, 18th consecutive convergence) |
| UI copy-correctness defects found | **3** (all fixed) |
| Regressions introduced | **0** |
| Commits | **4** — all fixes |
| Net DB rows written by QA | **0** (one accidental column update, reverted and independently re-verified) |

### Stage outcomes

| Stage | Run | Terminal reason | Turns | Artifact |
|---|---|---|---|---|
| s1 api-test | 117 | ✅ `end_turn` | 45/40+ | complete (223 lines) |
| s2 frontend-test | 118 | ⚠️ `error_max_turns` | 81/80 | **none written** |
| s3 ui-audit | 119 | ✅ `end_turn` | 58 | complete (9,088 bytes) |
| s4 verify | 120 | ⚠️ `error_max_turns` | 41/40 | partial (`C:/tmp/qa-r120-s4-api.txt`) |
| s5 report | 121 | — | — | this document |

Two of four working stages capped on their turn budget. Their output was recovered
from raw harness JSON and from the working tree rather than discarded — see
Test Coverage Gaps.

---

## Backend API Test Results

Route inventory regenerated this run: **272 routes across 36 files** — unchanged
from Run 114. `POST 88 | GET 132 | PATCH 26 | PUT 8 | DELETE 18` (140 write
routes); 109 of 272 paths carry a `:param`.

The night's backend charter was **scalar (non-`jsonb`) column type confusion** —
probing every whitelisted `PATCH` field with values Postgres cannot accept for
that column's declared type, and asserting a 4xx rather than a 500.

### Coverage by entity

| Entity | Endpoint | Fields | Types covered | Result |
|---|---|---|---|---|
| CRM lead | `PATCH /api/crm/leads/:id` | 17 | enum, numeric, varchar, `text[]`, timestamptz, jsonb | PASS |
| Core lead | `PATCH /api/leads/:id` | 10 | enum, numeric, varchar, uuid | PASS |
| Estimate | `PATCH /api/estimates/:id` | 24 | uuid, numeric, date, bool, jsonb | PASS |
| Invoice | `PATCH /api/crm/invoices/:id` | 8 | numeric, date, enum, uuid | PASS |
| Work order | `PATCH /api/crm/work-orders/:id` | 10 | enum, uuid, date, **time**, varchar | **1 FAIL → fixed** |
| Contract | `PATCH /api/crm/contracts/:id` | 3 | uuid, varchar | PASS |
| Expense | `PATCH /api/crm/expenses/:id` | 5 | uuid, numeric, date, varchar | PASS |
| Subcontractor | `PATCH /api/crm/subcontractors/:id` | 8 | numeric, varchar | PASS |
| Work order (create) | `POST /api/crm/work-orders` | — | time | **1 FAIL → fixed** |
| Task | `PATCH /api/crm/tasks/:id` | 7 | — | **NOT TESTED** — `tasks` has 0 rows, no fixture |

**Totals: 331 requests. Before the fix — `200:168 / 400:161 / 500:2`. After the
fix — `200:168 / 400:163 / 500:0`.**

### Decisive result — typed columns are fully guarded

**155 typed-column probes returned zero 2xx.** `numeric`, `int4`, `bool`, `date`,
`timestamptz`, `time`, `uuid`, `text[]`, `jsonb` and all five pg enums
(`lead_stage`, `lead_priority`, `invoice_status`, `work_order_status`,
`notification_type`) rejected every wrong type. `time` was the only gap in the
schema. Combined with Run 114's `jsonb` container work, **type confusion at the
SQL boundary is now closed in both directions.**

### What was fixed

**`1849a13` — invalid `time` value returned 500 instead of 400.**
Postgres parses a `time` literal permissively: a token it cannot read as a time
component it tries to read as a *time zone name*. So `"not-a-time"` raises
`22023 invalid_parameter_value` ("time zone \"not-a-time\" not recognized")
rather than the `22007`/`22P02` every other datetime type raises. `22023` was
absent from `PG_BAD_INPUT_CODES` in `server/src/middleware/errorHandler.js`, so
it fell through as a 500.

Measured pg behaviour for a `time` cast — this is why only *some* inputs 500'd:

```
"abc" / "1" / "true" / "" / "x y z"  -> 22007  (already mapped -> 400)
"25:99" / "99:99:99"                 -> 22008  (already mapped -> 400)
"not-a-time" / "12:00 Mars/Phobos"   -> 22023  UNMAPPED -> 500
"13:00" / "12:00 UTC"                -> accepted
```

`work_orders.scheduled_time_start` / `scheduled_time_end` are the only `time`
columns in the schema and both are written straight from the request body on
create (`workOrderService.js:303-306`) and update (`:386`), so one error-mapping
entry fixed both verbs. The widening masks nothing: all 9 `generate_series` /
`TO_CHAR` call sites use a constant step, so no server-authored SQL can raise
`22023`.

### Regression / verification (s4, Run 120)

18 probes over 2 endpoints, re-run after a server restart and fresh token:

| Check | Result |
|---|---|
| V1 — four `22023` shapes on `PATCH` | **4/4 → 400** |
| V1b — two `22023` shapes on `POST` (create path) | **2/2 → 400**, no row created |
| V2 — seven pre-existing datetime codes still 4xx | **6/7 PASS**, 1 expected `200` (`""` → NULL via the deliberate `emptyToNull` path, `workOrderService.js:369`) |
| V3 — `22P02`, `23503`, `23514`/enum, `22007`, `22023` on `time_end` not masked | **5/5 → 4xx** |
| V4 — write safety | rows `10 → 10` PASS · junk rows created `0` PASS |

### Secondary backend results

- **A named open lead was stale for 37 runs and is now closed with proof.** The
  standing gotchas carried an `automationEngine.js` → `tasks.priority` enum bug
  addressed explicitly to an api-test stage. It was already fixed in `5329a7e`
  on both client and server; `normalizeTaskPriority` was proven **total** —
  13/13 inputs including `undefined`/`null`/`""`/`"bogus"`/`42`/`{a:1}` map to a
  valid `lead_priority` label. No automation or drip config can raise `22P02`
  here. The gotchas entry has been removed.
- **The 168 accepted-but-wrong writes are cosmetic, closed by a type argument.**
  All 168 are `varchar`/`text`; Postgres coerces the bound parameter to text on
  the way in, so the value always reads back as a JS string. Run 68's
  white-screen crash needed a **`jsonb`** column, where a boolean stays a
  boolean — no `.replace()` path can break here. Input-validation gap, not a
  latent crash surface.
- **`f7bb323` holds.** Run 114's estimates `jsonb` defect (`discounts`/
  `signers`/`deposit`) re-probed 6/6 → 400, columns never moved.

---

## Frontend Feature Test Results

⚠️ **The s2 stage capped on its turn budget without writing an artifact.** The
results below are reconstructed from its two commits and its raw harness JSON in
`C:/tmp/`. `/tmp/frontend-test-results.txt` and `C:/tmp/frontend-test-results.txt`
are both **Run 114, dated 2026-09-01 — one day stale** and were *not* read as
tonight's data.

### Dashboard (`/dashboard`)

- **Tested:** every internal deep link the page generates, against the query keys
  the destination route actually reads (12 internal query-string links app-wide).
- **Broken:** the Stale Leads panel's "View All" navigated to
  `/leads?sort=updated_at`, but `LeadList` reads `sort_by`/`sort_dir`
  (`LeadList.jsx:126-127`) and never reads `sort`. The key was silently ignored,
  `LeadList`'s own `setSearchParams` round-trip then stripped it from the URL,
  and the list loaded with the default `created_at`/`DESC` — losing the panel's
  entire point.
- **Fixed:** `e19a5a3` — the link now sends `sort_by=updated_at&sort_dir=ASC`.
  `updated_at` is already in `crmService`'s `allowedSort` whitelist (`:56`), so
  this is a client-only param-name fix. Verified live: the URL survives and the
  outgoing request carries the new params.

### Lead Detail (`/leads/:id`) → Expenses (`/expenses`)

- **Tested:** the "Add Expense" quick action deep link.
- **Broken:** `LeadDetail.jsx:1538` does
  `window.location.href = '/expenses?leadId=' + leadId`, but `ExpensesView`
  **never read the param** — the user landed on a plain, unfiltered expense list
  with no modal and had to re-pick the job by hand.
- **Fixed:** `3d9c358` — `ExpensesView` now mirrors `ContractsView`'s existing
  `fromEstimate`/`leadId` idiom: opens the modal on the param, resolves the id to
  the lead's address for the picker, and clears the param on save/close. Verified
  both directions — with the param the modal opens prefilled
  "14910 Hartsmith Dr."; without it, no modal.
- **Note:** this fix was written by s2 and left **uncommitted in the working
  tree** when the stage capped. s3's `git status`-as-a-first-action rule
  recovered and committed it. That rule has now rescued a capped stage's work on
  **five separate nights**.

### API-contract sweeps (static, whole client)

| Harness | Scope | Result |
|---|---|---|
| `.qa-r118-clienturls.mjs` | 285 client-issued URLs vs 272 mounted server routes | **0 unmatched, 0 method mismatches.** Self-test caught 3/3 planted positives, 2/2 negative controls silent |
| `.qa-r118-deeplinks.mjs` | query keys internal links generate vs keys the destination reads | 8 links → 1 suspect (the Dashboard bug). **Widened** to match `location.href` / `location.assign` / `window.open`, not just `navigate()`/`to=`/`href=` — which is why the first pass missed the Add Expense link. Now **12 links, 0 suspect** |
| `.qa-r118-queryparams.mjs` | 60 call sites, 94 query keys, 18 distinct | **0 dead params** |

### Contracts / Invoices / Expenses (`/contracts`, `/invoices`, `/expenses`)

Driven live with real data by s3 — see the UI audit section below. Filtering was
exercised in both directions on all three routes; row rendering unaffected
(4 / 14 / 2 rows still render unfiltered).

### Still needs attention

- **The frontend *functional* charter remains largely unmeasured for the second
  consecutive night.** s2 spent 81 turns / $8.61 / ~17 min and produced two real
  defects, but no systematic page-by-page interaction testing: forms, create/edit
  flows, validation, and the 12 Settings tabs were not exercised. s3's static
  sweep proves all 19 routes *render*; it proves nothing about interactions.

---

## UI Consistency Audit Results

All 19 in-app routes swept. Audits 1–7 converged for the **18th consecutive
run**, and now cost a single aggregating browser call.

| # | Category | Non-Heroicon / non-standard found? | Result |
|---|---|---|---|
| 1 | **Icons** | **None.** 2,232 runtime `<svg>` elements; 0 foreign icon classes (`fa-*`, `material-icons`, `lucide`, `bi-*`) on 19/19 routes | ✅ PASS — nothing to fix. Only non-24 viewBoxes are the 9 recharts surfaces on `/reports` (data-viz, non-bug) |
| 2 | **Buttons** | **No sizing/styling inconsistencies.** Primary `.auth-btn` background is `oklch(0.72 0.19 250)` on every route that has one; 0 unnamed buttons on 19/19 | ✅ PASS — remaining variance is the documented deliberate segmented-control / secondary families |
| 3 | **Toolbars / Headers** | **Consistent across all pages.** 56px header + exactly one `<h1>` on 19/19; all titles correct | ✅ PASS |
| 4 | **Sidebar / Nav** | **No issues.** 18–22 buttons, icons == buttons, 0 raw anchors on 19/19; exactly 1 `.is-active` on 17/19 | ✅ PASS — both apparent deltas were chased down and **cleared, not filed**: `.is-active`=2 on `/reports` and `/tasks` is the sidebar plus a legitimate *in-page* segmented control (`reports-preset-btn`, `task-filter-tab`), and the 18-vs-22 button count is the active route's nav group auto-expanding. `/alerts`=0 is the documented orphan route |
| 5 | **Forms** | **No non-standard elements.** **0 native `<select>`, 0 native date/time inputs app-wide** — the `CustomSelect` / `DatePicker` rules are fully respected | ✅ PASS. Non-`.form-input` inputs are the documented set: TopBar ⌘K search (42px), `/alerts` numeric stepper (26px), `.address-search__input`, custom `appearance:none` checkboxes |
| 6 | **Spacing** | `.glass` padding varies between pages | ⚠️ Systemic, already recorded as the 14px-root Tailwind-rem refactor item — not per-instance alignment bugs. Not fixed (refactor, outside QA charter) |
| 7 | **Modals** | **All consistent.** 0 stray overlays at rest on 19/19; 0 horizontal overflow on 19/19 | ✅ PASS |

**Zero style/consistency defects were found.** The three UI defects fixed this
run were **copy correctness**, a dimension opened for the first time tonight —
see Bug 4 below.

### Dimensions opened and closed clean this run (do not re-spend)

- **Disabled-state consistency — CLOSED CLEAN.** 93 `disabled=` usages across 29
  files. A global rule at `index.css:4480` covers
  `button/input/select/textarea:disabled` (opacity .5, `cursor: not-allowed`,
  `pointer-events: none`), plus `.auth-btn:disabled` at `:2436`. **No call site
  passes a `disabled` prop to `CustomSelect` or `DatePicker`, and neither
  component accepts one** — so no custom control is logically disabled but
  visually live.
- **Silent text clipping with real data — CLOSED CLEAN.** 14 routes swept for
  elements whose `scrollWidth` exceeds `clientWidth` while holding their own
  text. One signature app-wide (the 11px muted address sub-line on
  `/contracts`, `/estimates`, `/invoices` — 191px of content in a 188px box) and
  it is **not** a defect: `overflow` is `visible` so nothing is cut, and the
  painted text still ends **13px inside** the parent cell's padding box. Measured
  as spill-vs-parent, not as a raw `scrollWidth` delta.
- **Empty-state *coverage*** — every list view renders an empty message. Only
  `TasksView` uses the `.empty-state` class; the rest are inline-styled. That
  split belongs to the documented form-label-drift family, not a new finding.

---

## Bugs Fixed

1. **`PATCH` / `POST /api/crm/work-orders`** — an invalid `time` value
   (`"not-a-time"`, `"12:00 Mars/Phobos"`, any string whose trailing token isn't
   a real zone name) returned **500 instead of 400**, because Postgres raises
   `22023` for a bad `time` — not the `22007`/`22P02` every other datetime type
   raises — and `22023` was missing from `PG_BAD_INPUT_CODES`. **Fixed** by
   adding `22023` to `server/src/middleware/errorHandler.js`, with its message
   sanitized like `22P02` (the raw pg text echoes the rejected value back as a
   time zone name). One entry covered both create and update. — **`1849a13`**

2. **Dashboard → Stale Leads "View All"** — the link sent `?sort=updated_at`, a
   key `LeadList` never reads, so the sort intent was silently dropped and the
   list loaded newest-first instead of least-recently-touched-first. **Fixed** by
   sending the params the destination actually reads,
   `?sort_by=updated_at&sort_dir=ASC` (`Dashboard.jsx`, client-only — `updated_at`
   was already whitelisted server-side). — **`e19a5a3`**

3. **Lead Detail → "Add Expense"** — deep-linked to `/expenses?leadId=<id>`, but
   `ExpensesView` never read the param, so the user landed on an unfiltered list
   with no modal. **Fixed** by mirroring `ContractsView`'s existing
   `fromEstimate`/`leadId` idiom: open the modal on the param, resolve the id to
   the lead's address, clear the param on save/close. — **`3d9c358`**

4. **`/contracts`, `/invoices`, `/expenses` — filtered-to-empty lists claimed the
   user had no data at all.** All three render their empty message on a bare
   `rows.length === 0`, but all three filter **server-side and refetch**. So a
   zero-match filter showed empty-*database* copy while the filter control still
   visibly read the chosen status:

   | Route | Filter | Rendered | Actually in DB |
   |---|---|---|---|
   | `/contracts` | status=Signed | "No contracts yet — create your first one" | **4** |
   | `/invoices` | status=Overdue | "No invoices yet" + "Create your first invoice…" | **14** |
   | `/expenses` | category=Permit | "No expenses yet — add your first one" | **2** |

   **Fixed** by making each message conditional on its own filter state, using
   the idiom the codebase already has (`MaterialsView`, `TasksView`) rather than
   inventing one. Unfiltered copy untouched — it is the ternary's false branch.
   `WorkOrdersView` was checked and **deliberately not changed**: its kanban has
   no filter and groups client-side, so `length === 0` genuinely means none. —
   **`68c968a`**

---

## Known Issues (Not Fixed)

### 🔴 New this run — the same defect as Bug 4, on a fourth route that was missed

**`/estimates` filtered to a zero-match status shows empty-database copy while 16
estimates exist.** `EstimatesView` was not part of `68c968a` and has the
identical pattern:

- `statusFilter` (`EstimatesView.jsx:55`) is sent server-side as `params.status`
  (`:64`) and refetches on change (`:74`) — the same server-side filter shape as
  the three routes that were fixed.
- Two empty-copy sites, both a bare `estimates.length === 0`:
  **desktop table `:621-625`** and mobile card list `:360-364`, both rendering
  *"No estimates yet — create your first one"*.
- **Reachable today.** The tenant holds **16 estimates** — `draft` 14, `viewed`
  1, `declined` 1, and **zero `sent`, zero `accepted`**. The desktop
  `CustomSelect` (`:577`) offers both. **Repro: `/estimates` → status "Sent"
  (or "Accepted") → "No estimates yet — create your first one" with 16 estimates
  present.**

Found while reconstructing the capped s4 stage's work — s4's own harness
(`server/.qa-r120-s4-eststatus.mjs`) shows it was testing exactly this hypothesis
when it hit its turn cap. Not fixed here because this stage's charter is
reporting only, and the fix wants the same both-directions browser verification
the other three received. **The fix is the ternary already used in
`ContractsView`/`InvoicesView`/`ExpensesView` — one line per site, two sites.**

### Carried forward (all developer decisions)

- **No error boundary anywhere in the SPA** — the amplifier behind four past
  defects. Highest-leverage backlog item; an enhancement, so developer's call.
- **64 generic error toasts discard the server's actionable message** vs 22 that
  surface it (`InvoicesView.jsx:566` is the wrong idiom, `:592` the right one).
  App-wide convention change.
- **Form-label drift** — 7 treatments, ~100 inline labels. **11th run deferred.**
  Refactor, outside the QA charter.
- **`/alerts` is an orphan route** — nothing in the nav links to it, and it is
  duplicated under Settings → Storm Alerts. Design decision.
- **`.glass` padding varies between pages** — part of the 14px-root Tailwind-rem
  refactor, not per-instance bugs.
- **`22007`/`22008` leak the raw pg message** (e.g. `invalid input syntax for
  type time: "abc"`), exposing the column type name. Deliberate `else` branch in
  `errorHandler.js`, pre-existing.
- **`EstimatesView.jsx:1318`** — measured previously and deliberately not fixed;
  guarding it means `Array.isArray`-ing every `.map()` in the client.
- **DB junk rows, user-visible, awaiting go-ahead to delete:** a subcontractor
  named `{"$eq":1}`, a territory `12345`, and a `qa_options_probe` custom field.
- **361 QA screenshots committed to the repo root.** This run added **0**.
- **`server/.qa-r91-neverrun.mjs` has never been run — 15 nights.**

---

## Test Coverage Gaps

1. ⚠️ **The frontend functional charter is largely unmeasured — second
   consecutive night.** s2 capped at 81/80 turns and wrote **no artifact**. It
   did produce two real defects and three committed harnesses, but no
   page-by-page interaction testing: create/edit forms, validation, and the 12
   Settings tabs were not exercised. Its work was recovered from raw JSON in
   `C:/tmp/` and from an uncommitted fix in the working tree — a total loss was
   avoided, not a complete stage.
2. ⚠️ **s4 (verify) capped at 41/40 turns.** It completed and wrote its API
   verification (18/18 meaningful probes pass) and its DB revert, but never
   logged a resume entry or reported the `/estimates` hypothesis it was mid-way
   through. Its three read-only probes were re-run during this report stage to
   recover their results.
3. **`PATCH /api/crm/tasks/:id` cannot be exercised** — the `tasks` table has 0
   rows in this tenant, so 7 whitelisted fields (including the only other
   `timestamptz` pair) remain the last unprobed typed columns in the CRM core.
   Creating a single fixture unblocks this.
4. **7 tenant-singleton write routes were not covered** by the typed-column
   harness because they have no `:id`: `/api/alerts/config`,
   `/api/crm/tenant-settings`, `/api/materials/credentials`,
   `/api/onboarding/org`, `/api/roof-measurement/config`,
   `/api/skip-trace/config`, `/api/notifications/preferences`. `alert_configs`
   has `numeric`, `int4` and `text[]` columns written from the body.
5. **`POST` create-path type confusion is essentially unmeasured.** This run
   probed `PATCH` almost exclusively (one `POST` spot-check). 88 `POST` routes
   exist, and `createX` functions often bypass the `allowedFields` whitelist and
   destructure directly — `createWorkOrder` does.
6. **`GET` response shapes are unasserted.** 132 `GET` routes return 200, but
   nothing systematically checks the response *shape* against what the client
   reads.
7. **The `territories` table does not exist** — 4 routes remain structurally
   unexercisable.
8. **Not swept, static or functional:** `/content-studio`, the estimate /
   invoice / contract **builder** detail shapes (3rd run named as open), and
   `/canvassing` pin drop (deliberately skipped — DB write plus a paid geocode).
9. **`prefers-reduced-motion` and a print stylesheet** are the only unmeasured UI
   dimensions left. Both are **enhancements rather than QA** — confirm scope
   before spending a run on either.
10. **No screenshots taken**, by choice — 361 are already committed to the repo
    root.

---

## DB Safety

**Net zero rows.** Scoped honestly, per stage:

- **s1 (Run 117):** all 8 probed rows restored **byte-identical including
  `updated_at`**. No side-table drift (`activities`, `notifications`, `tasks`,
  `automation_runs`, `lead_stage_history`). The `POST` create probe was rejected,
  so no `work_orders` row was created (10 → 10).
- **s2 (Run 118):** static analysis plus browser navigation. No write path
  exercised; **unverified** in the absence of an artifact.
- **s3 (Run 119):** **0 writes** — filter-only interaction, read-only `GET`s.
- **s4 (Run 120):** **one accidental write.** The `scheduled_time_start: ""`
  probe legitimately succeeded (the `emptyToNull` path at
  `workOrderService.js:369` is deliberate) and cleared a real value on work order
  `a85b7ae6…`. s4 wrote `server/.qa-r120-s4-revert.mjs` and ran it, then capped.
  **This report stage independently re-verified the revert landed:**
  `scheduled_time_start = 00:30:00`, `scheduled_time_end = 01:30:00`,
  `updated_at = 2026-08-20T10:03:44.830Z` — **byte-identical to the pre-probe
  state**. `work_orders` count 10; 0 junk rows created.
- **No geocoding, no bulk operations, no QA rows added, 0 screenshots written to
  the repo.**

---

## Notes for the Next Run

- ⚠️ **Stage capping is the dominant failure mode, not any individual defect.**
  s2 has now capped two nights running and s4 one; between them they account for
  every coverage gap above. The defect count reflects how much testing actually
  ran, not how sound the app is. **Raise the s2/s4 turn budgets or narrow their
  charters.**
- **What let s1 and s3 finish: batching.** s1 broke an eight-run capping streak
  by collapsing discovery into ~20 calls (one for env+login+inventory, one for
  all 12 whitelists, one 331-request harness). s3 ran all 7 audits in **one**
  aggregating browser call. Never one call per route.
- **Require every stage to write its artifact before spending its remaining
  budget.** Both completing stages did; neither capped stage did.
- **Read each stage's JSON `terminal_reason`, not its self-assessment** — and
  **always check `C:/tmp/*.json` and `*.txt` before writing a capped stage off.**
  Both rules paid again tonight.
- **`git status` as a first action** recovered a complete, uncommitted fix for
  the **fifth** separate night. Keep it first.
- **Date-check every input artifact.** `frontend-test-results.txt` was one day
  stale in both locations tonight; reading it as current would have fabricated
  the entire frontend section.
- **Suggested next targets** — s1: create a `tasks` fixture, then the 7
  tenant-singleton routes, then `POST` create paths. s3: copy correctness of the
  other conditional states (loading / error / partial-result), the same shape
  that produced tonight's Bug 4 — starting with the open `/estimates` defect.
- **Verified non-bug, do not re-file:** s4's `.qa-r120-s4-staleorder.mjs`
  reports **DIVERGENT** for `updated_at ASC` vs `days_stale DESC`, which looks
  like it contradicts fix `e19a5a3`. It does not. `days_stale` is
  `extract(day from now() - updated_at)::int`, which truncates to whole days —
  **10 of this tenant's 13 leads tie at exactly 5d**, so the panel's own ordering
  is tie-dominated and its tie order is arbitrary. `updated_at ASC` is a strict
  refinement of the same intent. The harness's address-sequence equality check is
  simply too strict for tied data.

---

*Generated by the s5 report stage (Run 121), 2026-09-02.*
