# StormLeads — Overnight QA Report

**Run date:** 2026-08-25
**Branch:** `feat/financing`
**Baseline:** `80c54c6` (tag `pre-overnight-20260825`)
**Head at report time:** `9339aa4`
**Build:** PASS — `vite build`, 7.93s, 0 errors
**Net DB writes:** 0 (verified by global row-count snapshot on every write sweep)

---

## QA Test Summary

| Metric | Value |
|---|---|
| API endpoints — inventory | **272 route patterns** across 36 route files |
| API endpoints — executed live | **258 of 272** (94.9%); 14 deliberately excluded for real side effects |
| PATCH/PUT write handlers exercised against a real row | **34 of 34** — first time in the pipeline's history |
| Pages / routes swept (UI audit) | **18 authenticated routes** |
| Frontend pages with a recorded coverage artifact | **0** — see [Test Coverage Gaps](#test-coverage-gaps) |
| Bugs found | **6** (1 backend, 5 frontend/UI) |
| Bugs fixed | **6** (6 fix commits, all verified) |
| UI inconsistencies found | **1** |
| UI inconsistencies fixed | **1** |
| Harness/tooling bugs found & fixed | **1** (jsonb-corrupting restore — had silently corrupted one real row; repaired) |
| Changes made then reverted | **1** (`323bf72` → `db6c7d5`, reclassified as enhancement) |
| 5xx responses anywhere | **0** |
| Commits since baseline | **12** (6 fixes, 5 QA harnesses, 1 revert) |

### Stage execution

Four QA stages ran; **three of the four hit the turn limit** and terminated
before writing their results or committing their final work. This is the
seventh consecutive night with capped stages and it materially truncated
coverage — the limit, not completion, is what ended those stages.

| Stage | Run # | Outcome | Turns | Duration | Commits |
|---|---|---|---|---|---|
| s1 — api-test | 95 | **CAPPED** (turn limit) | 51 | 9.8 min | 5 |
| s2 — frontend-test | 95 | **CAPPED** (turn limit) | 81 | 13.3 min | 5 |
| s3 — ui-audit | 94 | **COMPLETED** (`end_turn`) | 51 | 10.8 min | 2 |
| s4 — verify | 96 | **CAPPED** (turn limit) | 41 | 5.7 min | 0 |
| s5 — report | — | this report | — | — | 1 |

Stage 4 was cut off holding 7 uncommitted read-only verification harnesses.
**Those harnesses were recovered and executed during this reporting stage**, so
its findings are included below rather than lost — see
[Stage 4 recovery](#stage-4-recovery--verification-of-tonights-fixes).

---

## Backend API Test Results

Source: stage 1 (Run 95). Server `http://localhost:3001`, tenant `waterloo`.
Totals below are from the sweep harnesses committed in `2a6972f` and `9d0ca27`.

| Category | Endpoints executed | Passed | Failed | Notes |
|---|---|---|---|---|
| Full route inventory | 258 of 272 | 258 | 0 | 0 5xx anywhere; 0 application defects on the GET surface |
| PATCH/PUT write handlers | **34 of 34** | 34 | 0 | Previously capped at 24/34 for four consecutive nights |
| State-transition routes | 3 of 3 | 3 | 0 | `work-orders/:id/complete`, `notifications/:id/read`, `automations/:id/toggle` |
| Lead filtering (`/api/leads`) | — | — | **1 failed** | `needs_followup=true` returned 400 for every tenant — fixed in `d49813c` |
| Excluded by design | 14 | n/a | n/a | Bulk import, outbound email, paid geocoding, webhooks — real side effects, not oversight |

The 10 write handlers that every prior sweep had failed to reach were closed
this run: 7 backing tables held no row for this tenant (so the request 404'd in
the ownership lookup before the handler body ran) and 3 state transitions had
been deliberately held back. Each is now exercised properly rather than with an
empty body — seed one tenant-owned row, PATCH a **real** field, assert the
column actually changed, then delete.

### What was fixed

- **`d49813c` — `/api/leads?needs_followup=true` returned 400 for every tenant, on every request.**
  `leadService.getLeads` compared the `lead_stage` enum column directly against
  `'closed_won'` and `'closed_lost'`. Neither label exists in the enum (it holds
  `new, contacted, appt_set, inspected, estimate_sent, sold, lost, negotiating,
  in_production, on_hold`), so Postgres raised `22P02` and the error handler
  turned it into a hard 400. The filter could never return a row.
  Fixed by comparing as text, matching the idiom already used by the stage
  filter a few lines above in the same function. Verified against SQL ground
  truth: the predicate matches 13 of 13 leads and the endpoint went
  **400 → 200, total=13**.
  *An empty-query GET sweep is structurally incapable of finding this — the
  crash lived in a query param no sweep was passing.*

### What was reverted

- **`323bf72` → reverted by `db6c7d5`.** `/api/crm/leads` silently dropped the
  `unassigned` and `needs_followup` query params. The change was correct and
  tested, but the filters have **zero callers**: `quickFilters`
  (`LeadList.jsx:62`) is never referenced and `applyQuickFilter` (`:346`) is
  never called — neither is rendered, so no quick-filter button exists in the
  UI and nothing in `client/src` sends those params. The endpoint was therefore
  not returning wrong data for any request the application actually makes.
  Adding unadvertised filter support for zero callers is a feature, not a fix,
  and the charter forbids enhancements. Correctly reverted.

### Harness bug fixed (tooling, not application code)

- **`2a6972f` — a jsonb-corrupting restore in the QA write harness.**
  node-postgres binds a JS array as a **Postgres array literal**, not JSON.
  `restoreRow` read `jsonb` back as a JS value and bound it straight, so
  restoring `line_items = []` wrote `'{}'` — a jsonb **object**. It silently
  corrupted `work_orders` row `f8a24416` during the run. Caught by the restore
  verifier and repaired to `[]`; the table is back to array=10, 0 objects. The
  same latent defect sat in `.qa-r91-realidwrite.mjs` and only failed to fire
  because nothing had ever mutated. Both now serialize objects/arrays to text
  and cast `::jsonb`. Self-tested on the exact row that corrupted:
  *"restored: verified clean"*.

### Tester-error traps documented, not filed as bugs

These read exactly like broken endpoints and are not:

1. The **financing** routes take camelCase (`isActive`/`isDefault`) while the
   rest of the API is snake_case — verified correct against the real caller,
   `SettingsView.jsx:1936`.
2. The notifications column is **`is_read`**, not `read`.
3. `markRead` scopes by `req.user.id`, so seeding a notification against an
   unordered `LIMIT 1` user produces a **correct 404** that looks like a defect.
4. `custom-fields` is backed by **`custom_field_definitions`**, not
   `custom_fields`; the earlier `42P01` was a harness mapping error.

---

## Frontend Feature Test Results

Source: stage 2 (Run 95), which **capped at 81 turns and left no results
artifact**. The five commits below are the recoverable record of what it did.
All four defects are the same family — *the JSX reads a key the API never
sends* — and all four are in the contract / work-order flows.

| Page / component | What was tested | Result |
|---|---|---|
| `/contracts` — lead search dropdown | Result rows against the live `/api/crm/leads` payload | **BROKEN → fixed** (`be61054`) |
| `/contracts` — `selectLead()` | Field population after picking a lead | **BROKEN → fixed** (`f9b0c8f`) |
| `/contracts` — ContractBuilder `fromEstimate` prefill | Email/phone carry-over from a lead-linked estimate | **BROKEN → fixed** (`a04aa8e`) |
| `/work-orders` — EstimatePickerModal | Row title and subtitle against the estimates payload | **BROKEN → fixed** (`716471a`) |
| All other prescribed pages | — | **No evidence of testing** — see Test Coverage Gaps |

### What was broken and how it was fixed

1. **`be61054` — the contract lead-search dropdown showed a dash for every result.**
   The row rendered `lead.owner_name || lead.first_name || '—'`. Neither key
   exists on the lead payload (leads carry `contact_name`,
   `contact_first_name/last_name`, `owner_first_name/last_name`), so the name
   line was a bare dash for **every** search hit — only the address underneath
   carried any information. The same file already documented this exact trap in
   the prefill effect at `:316-331`; the dropdown had been missed by that
   earlier fix. Live proof on real rows: `BAISDON` now renders
   **BAISDON HANNAH**, `TYNES` renders **TYNES RAYMOND L** (both previously `—`).
   A lead with no contact and no owner name still falls back to `—` with its
   address.

2. **`f9b0c8f` — picking a lead for a contract populated only the address.**
   `selectLead()` read `lead.owner_name`, `lead.first_name`, `lead.email` and
   `lead.phone`. All four are absent from the payload, so choosing a lead set
   name, email and phone to `''` and filled in the address alone — and left
   **Send Contract disabled**, since that button is gated on `customerEmail`.
   This was the *third* site in this one file with the same defect. Live proof:
   searching `BAISDON` and clicking the result now fills CUSTOMER NAME with
   `BAISDON HANNAH` (previously blank, address only), with no `undefined`/`null`
   leaking into a field.

3. **`a04aa8e` — estimate-to-contract conversion dropped the lead's email and phone.**
   ContractBuilder's `fromEstimate` prefill fell back to `lead_name` and
   `lead_address` but not `lead_email`/`lead_phone`, though the estimate detail
   query joins all four in for exactly this purpose
   (`estimateService.js:164-165`). Converting a lead-linked estimate therefore
   left CUSTOMER EMAIL blank, and **Send Contract is gated on it**
   (`disabled={saving || !customerEmail}`, `ContractsView.jsx:505`) — so the
   flow's primary action was unusable without retyping data the app had already
   fetched. Proven with a response-merge intercept (zero DB writes): before,
   email and phone blank + Send disabled; after, both prefilled + Send enabled.

4. **`716471a` — the work-order estimate picker read two keys the API never sends.**
   `EstimatePickerModal` rendered `est.title` and `est.contact_name`. Neither is
   a key on the estimates list payload — the query aliases them as
   `estimate_name` and `lead_name` (`estimateService.js:122`) — so both reads
   were `undefined` and all 16 rows fell through to their fallbacks. Effect: an
   estimate the user had named showed as a generic `Estimate #EST-0xx`, and the
   customer name never rendered at all. The correct idiom was one file away in
   the invoice picker (`InvoicesView.jsx:372-374`); matched it. Measured on the
   live modal: EST-084 now renders `S4 Round Trip Probe` and EST-001 renders
   `Test Customer`; still 16 rows, unnamed rows keep their fallback.

### What still needs attention

- **`quickFilters` / `applyQuickFilter` in `LeadList.jsx` are dead code** —
  defined, never rendered, never called. Removing them or wiring them up is a
  developer decision, not a QA one. Left untouched.
- **The contract/work-order flows yielded 4 key-mismatch defects in one night,
  3 of them in a single file (`ContractsView.jsx`).** The remaining views have
  not been swept for this class.

---

## UI Consistency Audit Results

Source: stage 3 (Run 94) — the **only stage that completed cleanly**. 18
authenticated routes, 0 net DB writes.

The 7 prescribed audits have now been converged for **12 consecutive runs**, so
they were given a cheap ~3-turn regression pass (all clean) and the run was
spent on the one interaction state never measured in the pipeline's history:
**`:hover` and `:active`**. That produced the night's defect.

| Category | Result | Detail |
|---|---|---|
| **Icons** | **CLEAN** | 0 solid-Heroicon imports, 0 foreign icon libraries, 0 inline `<svg>` used as an icon outside the two documented map files (`CanvassingMode`, `StormMap`). Source grep is definitive here and beats a browser sweep — a violation inside an unopened modal is invisible at runtime. |
| **Buttons** | **CLEAN** | 575 visible buttons. Primary `.auth-btn` is 42px / 12px radius / 13px on all 18 routes. Every outlier signature maps to an already-documented per-context family: `/subcontractors` 28px/8px row-actions ×50, `/materials` 27px ×136, `/storm-catalog` 23px/999px segmented pill, `/settings` 31px/8px tabs. |
| **Toolbars / Headers** | **CLEAN** | `.topbar` 56px + `.glass` on **18/18**; exactly one `<h1>` on **18/18**. |
| **Sidebar / Nav** | **CLEAN** | 18 nav links / 18 icons on **18/18**, identical gaps; exactly 1 `.is-active` on **17/18** — `/alerts` = 0 is the documented orphan route. |
| **Forms** | **CLEAN** | 0 native `<select>`, 0 `input[type=date\|time\|datetime-local]`, at **both** source and runtime. |
| **Spacing** | **CLEAN** | 0 horizontal overflow on **18/18**. |
| **Modals** | **CLEAN (exterior only)** | 0 overlays open at rest on 18/18. Modal *internals* were last verified in Run 84; the `.modal-backdrop` vs `.modal-scale-in` count gap is a documented non-bug (21 of 22 inherit the animation from `.modal-backdrop > .glass`). |
| **`:hover` / `:active`** *(new dimension)* | **1 DEFECT — fixed** | See below. |

### The defect — `25f5472`

**`.stat-card` hover lift overrode the card's explicit `transform` opt-out.**

`.stat-card:hover` (`index.css:949`) declares `transform: none` **deliberately**:
the card carries `backdrop-filter: blur(40px) saturate(1.5)` *directly*, and a
transform makes it a stacking context — the same family as the 2026-03-29
dashboard glass-card regression caused by `.main-content > *`.

The late generic card-lift utility `.glass[class*="card"]:hover`
(`index.css:4339`) beat it **twice over**: declared **3,390 lines later** *and*
more specific (**0,3,0 vs 0,2,0**). The opt-out was dead.

Measured live with a real mouse (input pipeline verified alive first):

```
before   resting: none   hovered: matrix(1, 0, 0, 1, 0, -1)
after    resting: none   hovered: none
```

Fixed with `.glass[class*="card"]:not(.stat-card):hover`. The stat card keeps its
intended hover feedback — border-color `oklch(0.4 0.02 265/0.18)` →
`oklch(0.5 0.03 265/0.25)` and background `oklch(0.14 0.02 265/0.55)` →
`oklch(0.16 0.025 265/0.6)`, confirmed on `/estimates` and `/invoices`.
Regression guard: `.glass.report-card` on `/reports` still lifts and still gains
its hover box-shadow, so the generic utility keeps working for cards that want it.

> **This is the third consecutive run whose defect was "a broad selector declared
> late wins the cascade against a component's own decision"** (Run 92:
> `:focus-visible` and `[class*="dropdown"]`; Run 94: `.glass[class*="card"]`).
> **Triage this shape first next run.**

### Dimensions closed this run (measured, clean — do not re-spend)

- **Hover never reflows layout** — **0 of 47** `:hover`/`:active` rules touches
  padding, border-width, font-size, width or margin.
- **No sticky hover in JS** — **0 of 33** `onMouseEnter`/`onMouseLeave` tags.
  An inline style cannot express `:hover`, so this codebase does hover
  imperatively in 33 places; every pair restores the property it set. The
  *negative* side was verified, not assumed.
- **The broad `button:not(...):active { transform: scale(0.97) }` rule is SAFE** —
  across **575 buttons on 17 routes** there are **0** transform-positioned
  buttons (the single hit is an identity matrix on a Google Maps internal
  control) and **0** buttons parenting a `backdrop-filter` element.

### Verified non-bugs — do not re-file

- `.glass[class*="card"]` matches **only** its intended targets (`stat-card
  glass`, `glass report-card`) — no BEM children, no glass descendants. Latent,
  not a live defect.
- `.stat-card:hover .stat-card__icon img` (`index.css:959`) is **dead CSS** —
  `.stat-card__icon` has 0 JSX consumers. Removal is a developer call.
- `/admin`'s 2 console errors are the proven-intentional 403s.

---

## Stage 4 recovery — verification of tonight's fixes

Stage 4 capped before reporting. Its 7 read-only harnesses were recovered and
executed during this reporting stage. **No new application defects were found.**

### API fixes re-verified against the live server — PASS 15/15

| Check | Result |
|---|---|
| `/api/leads?needs_followup=true` | **200**, rows=13, total=13 (was 400) — `d49813c` holds |
| `…&limit=5` / `…&stage=new` / `…&unassigned=true` | 200 / 5 rows, 200 / 9 rows, 200 / 11 rows |
| `needs_followup=false` \| `=1` \| `=garbage` | 200, 13 rows — no crash on any value |
| Revert check: `/crm/leads` bare vs with both params | **13 = 13 → params ignored, revert intact** |

### UI fixes re-verified against real API payloads

- **`716471a` — CONFIRMED.** Old keys `title`, `contact_name` **absent** from the
  payload; new keys `estimate_name`, `customer_name`, `lead_name`,
  `lead_address`, `estimate_number` all **present**. 1 of 16 estimates carries a
  real `estimate_name`; the other 15 correctly fall through to their fallback.
- **`be61054` — CONFIRMED and observable.** Rows rendering a bare dash:
  **OLD 13/13 → NEW 10/13**. The remaining 3 have neither a contact nor an owner
  name and correctly fall back to `—` with their address.
- **`f9b0c8f` — CONFIRMED structurally, not observable on this dataset.** Old
  keys `owner_name`/`first_name`/`email`/`phone` absent; new keys
  `contact_name`/`contact_email`/`contact_phone` present. But **no lead in this
  tenant has a contact email** (`contact_email` is null on all 13), so
  `customerEmail` is populated for 0 leads before *and* after. Send Contract
  correctly stays disabled. The name fix is observable; the email fix is not.
- **`a04aa8e` — CONFIRMED structurally, not observable on this dataset.** 9 of 16
  estimates are lead-linked and the detail payload does carry `lead_name`,
  `lead_address`, `lead_email`, `lead_phone` as real keys — but all four are
  null on the sampled row. The fix was proven by response-merge intercept, not
  by real data.

### Two harness "failures" triaged to tester error — not application defects

`.qa-r96-s4-payloadkeys.mjs` reported 2 assertion failures. Both are harness
faults:

1. It requests **`/api/crm/estimates`**, which **404s**. The estimates router is
   mounted at **`/api/estimates`** (`server/src/routes/index.js:62`). With 0 rows
   returned, every key read as "ABSENT" and the estimate assertions failed
   spuriously. Re-run against the correct path, all keys are present and the fix
   verifies. **The harness has a wrong-path bug; the application does not.**
2. Its `a04aa8e` check concluded "no lead-linked estimate exists" for the same
   reason — the real figure is **9 of 16**.

---

## Bugs Fixed

1. **`/api/leads` (backend)** — `?needs_followup=true` returned **400 for every
   tenant on every request**; the enum column was compared against two labels
   that don't exist in `lead_stage`, raising `22P02`. — Compared as text instead,
   matching the adjacent stage filter. 400 → 200, total=13. (`d49813c`)
2. **`/contracts` — lead-search dropdown** — every result row rendered a bare
   dash, because `owner_name`/`first_name` are not keys on the lead payload. —
   Read `contact_name` / `contact_first_name`+`last_name` / `owner_first_name`+
   `owner_last_name` instead. (`be61054`)
3. **`/contracts` — `selectLead()`** — picking a lead filled in the address only;
   name, email and phone were set to `''` and **Send Contract stayed disabled**. —
   Reused the prefill effect's idiom for the four real keys. (`f9b0c8f`)
4. **`/contracts` — ContractBuilder `fromEstimate` prefill** — converting a
   lead-linked estimate dropped the lead's email and phone, disabling the flow's
   primary action. — Added the `lead_email`/`lead_phone` fallbacks the detail
   query already joins in. (`a04aa8e`)
5. **`/work-orders` — EstimatePickerModal** — read `est.title` and
   `est.contact_name`, neither of which the API sends; named estimates showed as
   generic `Estimate #EST-0xx` and the customer name never rendered. — Switched
   to the `estimate_name` / `customer_name`+`lead_name` aliases. (`716471a`)
6. **App-wide CSS — `.stat-card` hover** — a late, more-specific generic card-lift
   utility re-applied `translateY(-1px)` over the card's deliberate
   `transform: none` opt-out, creating a stacking context on an element that
   carries `backdrop-filter` directly. — Excluded with `:not(.stat-card)`.
   (`25f5472`)

**Plus, in tooling rather than the application:** the QA write harness's
`restoreRow` bound a JS array as a Postgres array literal, writing a jsonb
object where an array belonged. It corrupted one real `work_orders` row during
the run; the corruption was caught by the restore verifier and **repaired**.
(`2a6972f`)

---

## Known Issues (Not Fixed)

1. **Leftover QA row in the production DB: the `qa_options_probe` custom field
   definition.** Tenant `waterloo`, created 2026-08-05, `field_label` = "QA
   Options Probe", `field_type` = select. It is **user-visible in Settings →
   Custom Fields**. The Run 95 hygiene sweep matches `'QA-R9%'`, which this label
   does not match, so it slips past cleanup every night.
   **New evidence tonight — it is safe to remove:** 0 leads carry a value under
   that key, and **0 leads have any `custom_fields` data at all** (distinct keys
   in use: none). Not deleted here because this reporting stage does not make
   production DB writes; it needs one `DELETE` and a developer's go-ahead.
2. **Stage 4's 7 verification harnesses are uncommitted** (`server/.qa-r96-s4-*.mjs`),
   left behind when the stage capped. They are read-only and useful, but
   `.qa-r96-s4-payloadkeys.mjs` **contains the wrong-path bug described above**
   (`/api/crm/estimates` → should be `/api/estimates`) and should be corrected
   before it is committed or trusted.
3. **`/tmp/api-test-results.txt` was never updated tonight** — it is still the
   Run 82 file dated **2026-08-19**. Commit `9d0ca27` states that three
   tester-error traps are "documented in /tmp/api-test-results.txt"; **that
   documentation was never written there.** The traps survive only in the commit
   messages (and are reproduced in this report). Stage 2 produced no results
   file at all.
4. **Dead code — `quickFilters` / `applyQuickFilter`** (`LeadList.jsx:62`, `:346`):
   defined, never rendered, never called. Design decision.
5. **Dead CSS — `.stat-card:hover .stat-card__icon img`** (`index.css:959`):
   `.stat-card__icon` has 0 JSX consumers. Developer call.
6. **14 of 272 routes deliberately unexecuted** — bulk import, outbound email,
   paid geocoding, webhooks. Excluded for real side effects and cost, not
   oversight. Not a defect; a permanent, intentional boundary.
7. **Stray 0-byte file `server/=`** in the working tree (a shell-redirect
   accident, pre-existing before this run). Harmless; left in place.

---

## Test Coverage Gaps

1. **Three of four stages hit the turn limit** (s1 at 51, s2 at 81, s4 at 41).
   Coverage was bounded by budget, not by completion. This is the seventh
   consecutive night this has happened and it costs roughly a stage of
   throughput per night.

2. **The frontend stage produced no coverage record.** Its charter listed ~14
   pages plus 12 Settings tabs; the only evidence of what it actually visited is
   4 fix commits, all in `ContractsView.jsx` and `WorkOrdersView.jsx`. **There is
   no evidence that `/dashboard`, `/storm-map`, `/pipeline`, `/leads`,
   `/leads/:id`, `/estimates`, `/invoices`, `/tasks`, `/calendar`, `/reports`,
   `/canvassing`, `/content-studio` or the Settings tabs were exercised
   tonight.** They were swept structurally by the UI audit (18 routes render
   clean, no console errors, no overflow), but their *features* were not tested.

3. **The `needs_followup` filter cannot currently be proven to filter.** All 13
   leads in this tenant pass the predicate (stage distribution: 9 `new`, 2
   `contacted`, 1 `appt_set`, 1 `inspected` — **0** in `sold`/`lost`), so
   `?needs_followup=true` returns 13/13, identical to unfiltered. The fix is
   confirmed correct against SQL ground truth, but a positive/negative
   discrimination test needs a lead in a closed stage.

4. **`/api/leads?stage=sold` returning 0 rows is data drift, not a regression.**
   Confirmed against SQL: `sold` is a valid `lead_stage` label but **no lead in
   this tenant is in that stage.** Recorded so a future run does not re-file it.

5. **Two UI fixes are unobservable on the current dataset.** No lead has a
   `contact_email` and the sampled lead-linked estimate has null
   `lead_email`/`lead_phone`, so `f9b0c8f`'s and `a04aa8e`'s email/phone paths
   verify structurally (correct keys, present on the payload) but cannot be
   demonstrated end-to-end without a seeded fixture.

6. **Modal interiors remain the largest unmeasured UI surface.** Default state,
   `:focus-visible` (Run 92) and `:hover`/`:active` (Run 94) are now all measured
   on the 18 top-level routes. A violation inside an unopened modal is invisible
   to every runtime sweep run so far. **`:disabled`, `:checked` and
   `[aria-expanded]` are also still unmeasured.**

7. **The remaining views have not been swept for the key-mismatch class** that
   produced 4 of tonight's 6 defects.

---

## Verification

- `vite build` — **PASS**, 7.93s, 0 errors (largest chunk `mapbox-gl` 1,703 kB,
  a pre-existing size warning, not an error).
- Live API re-verification of both backend commits — **PASS 15/15**.
- Net DB writes across all write sweeps — **0**, confirmed by global row-count
  snapshot; 0 QA rows remaining across 10 tables; 0 orphan `prospect_list_items`.
- One `work_orders` row corrupted mid-run by the harness bug — detected and
  **repaired**; table verified back to array=10, 0 objects.
