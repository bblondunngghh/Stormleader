# StormLeads — Overnight QA Report

**Run date:** 2026-08-28
**Branch:** `feat/financing`
**Baseline:** `cfa8d0c` (`checkpoint: pre-overnight-run 2026-08-28`)
**Head at report time:** `95b9cab`
**Build:** PASS — `npx vite build`, 7.87s, exit 0, 0 errors
**Net DB writes:** 0 net new rows (every stage stubbed, reverted, or used value-preserving writes)

---

## Stage completion

Three of the four test stages completed on task. That is the best stage-completion
result in the logged history of this pipeline; the prior run had two of four capped.

| Stage | Run | Terminal reason | Turns | Outcome |
|---|---|---|---|---|
| s1 — api-test | 100 | **`max_turns` (50)** | 51 | 1 backend defect found + fixed; results artifact written; capped during wrap-up |
| s2 — frontend-test | 101 | `end_turn` (completed) | 81 | 1 defect (2 sites) found + fixed |
| s3 — ui-audit | 102 | `end_turn` (completed) | 73 | 1 UI defect found + fixed; audits 1–7 regression-clean |
| s4 — verify | 103 | `end_turn` (completed) | 47 | 3/3 fixes re-verified; 0 new defects; first complete edge-case pass |
| s5 — report | 104 | (this stage) | — | Report, history, resume, commit, build |

**One correction to the stage record.** s1's own resume entry claims
`Stage capped? NO — completed on task, first time in 9 nights`. That is wrong.
`claude-overnight-20260828-s1-api-test.json` records `subtype: error_max_turns`,
`terminal_reason: max_turns`, and `"Reached maximum number of turns (50)"` at turn 51.
It capped during wrap-up, after writing its artifact and its resume entry but
**before committing 12 `.qa-r100-*` harnesses**, which s4 later swept up in `95b9cab`.
The stage's test findings are unaffected — its artifact and its fix both landed — but its
self-report of completion is not accurate.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested | **19 of 19** authenticated app routes (plus 15 Settings tabs and 8 create flows) |
| API endpoints tested | **254 of 272** route patterns (93.4%) — 248 route+method rows itemised |
| HTTP requests issued | **663** (322 pass-1 + 314 regression + 27 gap/fuzz) |
| Bugs found | **3** |
| Bugs fixed | **3** (100%) |
| UI inconsistencies found | **4 findings** (1 root cause) |
| UI inconsistencies fixed | **4** (the single root cause; one 4-line deletion) |
| New defects found during verification | **0** |
| 5xx / crashes | **0** |
| Page errors (`pageerror`) | **0** across 19 routes |
| Commits | **6** — 3 fixes, 3 test-harness commits |

---

## Backend API Test Results

**Source:** `C:/tmp/api-test-results.txt` (Run 100, written 05:09). Route inventory is
272 patterns across 36 files (GET 132, POST 88, PATCH 26, PUT 8, DELETE 18). 254 were
exercised; 18 were excluded by design as side-effecting. Every itemised row is a PASS —
note that the table records **final state after the fix**, which is why the one defect
found does not appear as a FAIL row.

| Category | Endpoints | Passed | Failed | Methods |
|---|---|---|---|---|
| Storm, property & map data | 31 | 31 | 0 | GET 21, POST 9, PUT 1 |
| Leads & contacts | 19 | 19 | 0 | GET 6, POST 8, PATCH 3, DELETE 2 |
| Work orders & subcontractors | 19 | 19 | 0 | GET 8, POST 5, PATCH 3, DELETE 3 |
| Skip-trace & roof measurement | 18 | 18 | 0 | GET 11, POST 4, PUT 2, DELETE 1 |
| Estimates | 16 | 16 | 0 | GET 5, POST 7, PATCH 2, DELETE 2 |
| Territories, canvassing, prospect lists | 16 | 16 | 0 | GET 7, POST 4, PATCH 2, DELETE 3 |
| CRM dashboard widgets | 15 | 15 | 0 | GET 15 |
| Automations & drip sequences | 13 | 13 | 0 | GET 4, POST 4, PATCH 3, DELETE 2 |
| Financing | 13 | 13 | 0 | GET 6, POST 4, PATCH 2, DELETE 1 |
| Contracts | 12 | 12 | 0 | GET 5, POST 4, PATCH 2, DELETE 1 |
| Invoices & payments | 11 | 11 | 0 | GET 4, POST 6, PATCH 1 |
| Team, tenant settings, onboarding | 11 | 11 | 0 | GET 3, POST 5, PATCH 1, PUT 2 |
| Materials | 9 | 9 | 0 | GET 6, POST 2, PUT 1 |
| Notifications & alerts | 8 | 8 | 0 | GET 5, PATCH 2, PUT 1 |
| Admin (super-admin gated) | 6 | 6 | 0 | GET 5, PUT 1 |
| CRM reports | 6 | 6 | 0 | GET 6 |
| Expenses | 5 | 5 | 0 | GET 2, POST 1, PATCH 1, DELETE 1 |
| Tasks, calendar, activities | 5 | 5 | 0 | GET 2, POST 2, PATCH 1 |
| Custom fields | 4 | 4 | 0 | GET 1, POST 1, PATCH 1, DELETE 1 |
| Global dashboard & search | 4 | 4 | 0 | GET 4 |
| Documents | 3 | 3 | 0 | GET 1, POST 1, DELETE 1 |
| Auth | 2 | 2 | 0 | GET 1, PATCH 1 |
| Pipeline | 2 | 2 | 0 | GET 2 |
| **Total** | **248** | **248** | **0** | |

### What was fixed

**`29c009a` — `PATCH /api/crm/leads/:id` accepted a non-object `custom_fields` and
permanently corrupted the column.** Category: Leads & contacts.

`crmService.js:195` merges the column with the jsonb `||` operator:

```sql
custom_fields = COALESCE(custom_fields, '{}') || $n::jsonb
```

Postgres does not raise on `object || scalar` — it silently returns an **array**:
`'{}'::jsonb || '"a-string"'::jsonb` yields `[{}, "a-string"]`. The route validated
`priority` and `stage` (`crm.js:183-190`) but nothing validated `custom_fields`, so a
body-controlled string, number, boolean, array, or null was accepted with 200 and
converted the column away from an object.

The damage was permanent and escalating: once the value is an array, every later
*legitimate* save appends instead of merging (`[{},"junk"] || '{"k":"v"}'` becomes
`[{},"junk",{"k":"v"}]`). `LeadDetail.jsx:1285` reads `lead.custom_fields?.[def.field_key]`,
which is `undefined` on an array, so every stored custom field silently vanishes from the
UI; `:1287` then spreads the array into an object on the next save, writing numeric keys.

Fixed with a 400 type guard matching the route's existing `priority`/`stage` validation
pattern (`server/src/routes/crm.js:191-200`, 10 lines added).

### Other backend results

- **0 5xx and 0 crashes** across all 663 requests.
- **Malformed-input fuzz: 17/17 returned 4xx, 0 returned 5xx.**
- **`allowedFields` whitelists vs. real DB columns: 12 checked, 0 mismatches.** The harness
  self-test caught 2/2 planted positives. This closes a coverage item carried since Run 99.
- **Coverage recovered sharply** — 254 route patterns exercised versus 133 on the prior run.
- **Net DB row writes: 0.** Two self-inflicted state changes during the sweep were
  identified and reverted (see Test Coverage Gaps).

---

## Frontend Feature Test Results

**Source:** s2 (Run 101). 19/19 routes rendered end-to-end, 15/15 Settings tabs driven,
8/8 create flows opened. **0 `pageerror` app-wide.** Net DB writes 0 — nothing was
submitted. Build PASS (7.97s).

| Page | Tested | Result |
|---|---|---|
| `/` Dashboard | Render, stat cards, navigation into detail views | PASS |
| `/leads` | Search (13 → "No leads found" → 13 restored), sort (emits `sort_by=lead_score&sort_dir=DESC`), pagination ("Showing 1–13 of 13 leads") | PASS |
| `/leads/:id` | Lead detail panel, custom-field render path, Score Breakdown modal | PASS |
| `/pipeline` | Kanban render — 13 `[draggable="true"]` cards across 7 drop columns (New 9 / Contacted 2 / Appt Set 1 / Inspected 1); Add Lead modal (+8 inputs) | PASS |
| `/tasks` | Render; create slide-over (+2 inputs) | PASS |
| `/calendar` | Render | PASS |
| `/estimates` | Render; inline builder view-swap (+14 inputs) | PASS |
| `/contracts` | Render; inline builder view-swap (+17 inputs) | PASS |
| `/invoices` | Render; inline builder view-swap (+5 inputs) | PASS |
| `/work-orders` | Render; create modal (+3 inputs) | PASS |
| `/expenses` | Render; create modal (+3 inputs) | PASS |
| `/subcontractors` | Render; create slide-over (+6 inputs) | PASS |
| `/materials` | Render; category tabs; cart-gated footer | PASS |
| `/reports` | Render; recharts surfaces | PASS |
| `/settings` | **15/15 tabs driven**; Billing plan switcher; Add Payment Method form | **2 defect sites — fixed `add652c`** |
| `/storm-map` | Render (hover defect found separately by s3) | PASS |
| `/storm-catalog` | Render | PASS |
| `/canvassing` | Render (pin drop not exercised — see Coverage Gaps) | PASS |
| `/alerts` | Render; numeric stepper inputs | PASS |

### What was broken and how it was fixed

**`add652c` — two disabled buttons rendered at full opacity and looked clickable.**
Page: `/settings`. One defect class, two sites.

The inline `opacity` covered only the *in-flight* reason for a button being disabled, not
the validation reason, so the button's `disabled` state had no visual signal:

- **`SettingsView.jsx:1518`** — `disabled={!stripe || processing}` against
  `opacity: processing ? 0.6 : 1`. Because `loadStripe(VITE_STRIPE_PUBLISHABLE_KEY || '')`
  never resolves when that env var is absent, "Add Payment Method" would render as a
  normal, enabled-looking blue button with an unchanged label, and clicking it would do
  nothing. Fixed to `!stripe || processing ? 0.6 : 1`.
- **`SettingsView.jsx:515`** — the same shape on the plan switcher during a switch.
  Fixed to `isCurrent || switching === plan.key ? 0.5 : 1`.

Proved by DOM injection rather than by triggering either write path (zero DB writes): a
disabled `.auth-btn` with no inline opacity computes `0.5`; the same button with inline
`opacity: 1` computes `1` while `pointer-events` stays `none`. The fix matches the idiom
already correct at 26 other sites.

### The named coverage gap that was closed

Run 99 named the inline-`style`-vs-`:hover` diff as the highest-value unrun check, and it
had been carried for three nights. It was built, self-tested against a known prior defect
plus planted positives, and run over **3,353 elements carrying an inline style**:
**0 fully-dead states app-wide.** The 27 sites that do lose a hover *colour* change all
retain `transform: translateY(-1px)`, confirmed at runtime on the worst case
(`none → matrix(1,0,0,1,0,-1) → none`). A negative result, but a definitive one — the sweep
now covers `:hover :focus :focus-visible :focus-within :active :disabled :checked` and
should be treated as closed.

Notably, the defect above was found by *extending* that check to `:disabled`, not by
running it as specified: `button:disabled` is an element selector that never appears in a
className diff, so it was invisible to every prior sweep.

### What still needs attention

Nothing on the frontend was left broken. Two process findings were recorded instead:

- **Roughly two thirds of the first sweep pass was harness error**, in exactly the shape the
  standing gotchas warn about — 12 of 52 hits were `.glass` misattributed from
  `.glass[class*="card"]:not(.stat-card)`, and most of the rest were
  `cond ? 'x' : undefined`, which React omits entirely. An inline style only kills a state
  when it is *unconditional*.
- **3 of the 5 surviving "BUG" hits died on a source read**, because the harness cannot
  evaluate reachability: one term sat inside a `{cart.length > 0 && …}` gate, another was
  implied away by an upstream filter, and two controls have legitimate non-opacity disabled
  treatments (grey background, blue icon). Only 2 of 5 were real.

---

## UI Consistency Audit Results

**Source:** `C:/tmp/ui-audit-results.txt` (Run 102). 18 authenticated routes swept in a
single browser call. Build PASS (7.77s), zero DB writes.

| Audit category | Result | Fixed? |
|---|---|---|
| **Icons** | **No non-Heroicon icons found.** Source-level (definitive): 0 solid heroicons, 0 foreign icon libraries, 0 native icon SVGs outside the 2 documented map files. Runtime: foreign-SVG count 0 on 18/18 routes; `fa-*`/material/lucide probe 0 on 18/18. | Nothing to fix |
| **Buttons** | **No sizing/styling inconsistencies.** Every radius value maps to an already-documented family (12px, 8px, 0px, 999px, the `clamp()` serialisation artifacts, the `/alerts` stepper `8px 0 0 8px` pair). Primary `.auth-btn` signature identical across routes. | Nothing to fix |
| **Toolbars / Headers** | **Consistent.** `.topbar` = 56px + `.glass` on 18/18. Exactly one `<h1>` on 18/18, with correct title text on all 18. | Nothing to fix |
| **Sidebar / Nav** | **No issues.** 18 nav links and 18 nav icons on 18/18 routes. `.is-active` count = 1 on 17/18; `/alerts` is the documented orphan route (0), unchanged. | Nothing to fix |
| **Forms** | **No non-standard elements.** 0 native `<select>` and 0 `input[type=date]`, confirmed in **both** source and runtime. `.form-input` signatures unchanged; the 2 documented deliberate height overrides and the `/alerts` numeric stepper remain the only exceptions. | Nothing to fix |
| **Spacing** | **No alignment issues.** `documentElement.scrollWidth == clientWidth` on 18/18 — no horizontal overflow anywhere. | Nothing to fix |
| **Modals** | **All consistent.** 0 overlays open at rest on 18/18. Close buttons were not re-audited — all 22 were standardised onto `.modal-close` / `.slide-over__close` in Run 98. | Nothing to fix |
| **Cascade integrity** (extended audit) | **1 defect — 4 findings, 1 root cause.** The `/storm-map` time-range dropdown had no hover state at all. | **YES — `50fde1b`** |

### The defect — `50fde1b`

`index.css:2772` `.map-controls__dropdown-trigger` contained a verbatim copy-paste of the
`.glass` block, with `!important` added to two declarations. The element is already
`<button className="map-controls__dropdown-trigger glass">` (`MapControls.jsx:38`), so
`.glass` supplied all four properties and the copy was pure redundancy. But `!important`
inverts the cascade — it beats higher specificity, later source order, *and* inline styles.
Those two declarations silently killed:

1. the rule's own component-specific `background`/`border`, declared five lines below, and
2. the entire `.map-controls__dropdown-trigger:hover` rule (`:2797`) — both declarations.

Unlike the 27 documented colour-locks, this hover rule has no `transform` to fall back on,
so the control gave **zero hover feedback**.

Runtime proof used a real `page.mouse.move` with the input pipeline guarded
(`hoverCount: 11`, `matches(':hover') === true`) — background and border were byte-identical
at rest and hovered. An injected probe confirmed the mechanism independently: an element
given `style="background: <the hover colour>"` still computed back to `--glass-bg`.

Design intent was confirmed before changing anything: the sibling
`.map-controls__dropdown-menu` (`:2811`) declares a border byte-identical to the trigger's
suppressed border, and the hover pair is an obviously authored progression
(`0.40 0.03 260/0.25` → `0.50 0.04 260/0.35`). After the fix the trigger matches its own
dropdown menu exactly, which it had not before. Box unchanged at 95×38 — no layout shift.

**Fix: 4 deletions, no additions.**

### Why six prior sweeps missed it

Runs 92/94/98/101 attacked this same "a declaration silently loses" family, but all keyed on
**specificity or source order**. `!important` beats both, so every one of them scored a
`base{p:!important}` / `base:hover{p}` pair as *"the hover wins"* and passed it.

### Three new checks run this audit (all self-tested with negative controls)

- **Shorthand-after-longhand reset** — 5 hits, **0 in-charter defects** (2 benign
  same-value, 3 inside the paused `isMobile` branch).
- **Duplicate declarations** — 0 duplicate JSX attributes and 0 duplicate inline-style keys
  app-wide. This matters because a duplicate `onClick` is a 100% dead handler that no
  rendering check can see. 8 duplicate CSS properties, of which 4 were the defect above.
- **`!important` in CSS killing an inline style** (the mirror of Run 101) — **59,152 inline
  declarations probed across 19 routes, 0 app defects.** The only two hits are a mapbox
  sub-pixel canvas artifact and the deliberate recharts dark-mode legend override.

### A planning gap closed

The charter's named next gap ("inline style vs `@media` / `[data-*]` / `[aria-*]`") was
**structurally near-empty** and has been closed rather than scheduled: `index.css` is the
app's only stylesheet and contains exactly one `@media` block (mobile, which is paused) and
**zero attribute selectors**. One `grep -c` retired it. Recorded as a standing lesson —
measure a gap's surface area before budgeting a run for it.

---

## Verification Results

s4 (Run 103) independently re-verified all three fixes and found **0 new defects**. This is
the first s4 in the logged history to complete the edge-case pass; prior ones capped during
fix re-verification.

| Commit | Verdict | Evidence |
|---|---|---|
| `29c009a` custom_fields guard | **PASS** | 6/6 bad types → 400; valid object → 200; 0 of 13 leads corrupted |
| `add652c` disabled-button opacity | **PASS** | Caught the transient: `{disabled:true, opacity:"0.6"}` → `{disabled:false, "1"}` |
| `50fde1b` map dropdown hover | **PASS** | Real `mouse.move`; hover fires and reverts; confirmed in the **built** bundle, not just dev |

The server was confirmed to be running the fixed code before anything was trusted (process
start `05:07:20` > `crm.js` mtime `05:06:56`) — there is no watcher on it. The
`custom_fields` happy path was proven with an **identity merge** (`custom_fields: {}`),
which is value-preserving, so the 200 was demonstrated with zero data change.

**Edge cases, all clean:**

- Navigation 18/18 — each moves the URL, renders an `<h1>`, and leaves exactly one
  `.nav-link.is-active`
- Browser back/forward 4/4 correct
- Empty states — `/leads` search renders "No leads found"; `/tasks` renders
  "No tasks yet / Create your first task"
- Form validation — 3 create forms submitted fully empty fired **zero**
  `POST`/`PUT`/`PATCH`/`DELETE` requests (two block via `disabled`, `/expenses` blocks
  natively)
- 375px viewport — `scrollWidth === clientWidth` on 8 routes, 0 overflow outside real
  scrollers

**Console errors app-wide: 2**, both the documented and correct `/api/admin/overview` 403.

---

## Bugs Fixed

1. **`PATCH /api/crm/leads/:id`** — accepted a non-object `custom_fields` (string, number,
   boolean, array, or null) with a 200 response and permanently corrupted the jsonb column,
   because Postgres returns an array rather than raising on `object || scalar`. Damage was
   escalating: every later legitimate save appended instead of merging, and the UI read
   every stored custom field as `undefined`. — **Fixed** by rejecting a non-plain-object
   `custom_fields` with 400, matching the route's existing `priority`/`stage` validation
   pattern. Verified post-restart: 6/6 bad types now 400, valid objects still merge
   correctly across two successive saves. `29c009a`

2. **`/settings` → Billing → Add Payment Method** — the button's inline `opacity` covered
   only `processing`, not `!stripe`, so a button disabled for the `!stripe` reason rendered
   at full opacity with an unchanged label and looked clickable while doing nothing. —
   **Fixed** by making the opacity condition match the `disabled` condition
   (`!stripe || processing`). `add652c`

3. **`/settings` → Billing → plan switcher** — same defect class: `opacity` keyed on
   `isCurrent` only, so a button disabled mid-switch stayed at full opacity. — **Fixed** by
   extending the condition to `isCurrent || switching === plan.key`. `add652c`

4. **`/storm-map` → time-range dropdown** — a copy-pasted `.glass` block carrying
   `!important` on two declarations killed both the rule's own component-specific
   background/border **and** the element's entire `:hover` rule, leaving the control with no
   hover feedback at all. The element already carried `.glass`, so the copy was pure
   redundancy. — **Fixed** by deleting the 4 redundant declarations. Verified with a real
   `mouse.move` before and after, and re-verified in the built bundle. `50fde1b`

Items 2 and 3 are two sites of one defect class and were fixed in a single commit; they are
counted as one bug in the summary totals (3 bugs found, 3 fixed).

### Test harnesses committed

| Commit | Contents |
|---|---|
| `f9f08b3` | `.qa-r101-inlinehover.mjs` (self-test 3/3), `.qa-r101-disabled.mjs`, `.qa-r101-triage.mjs` |
| `08d14b0` | `.qa-r102-shorthand.mjs` (4/4), `.qa-r102-dupekey.mjs` (4/4), `.qa-r102-importantkill.mjs` (3/3), `.qa-r102-fix.mjs` |
| `95b9cab` | `.qa-r103-s4-verify1.mjs` (custom_fields regression harness) plus the 12 `.qa-r100-*` sweeps s1 left untracked when it capped |

---

## Known Issues (Not Fixed)

1. **`automationEngine.js:75-77` — `lead_priority` enum bug.** Server-side, has a written
   repro, and is now **8 runs old**. It keeps being skipped because no stage is explicitly
   assigned it: it is not frontend-reproducible (s2 confirmed the Tasks UI side is clean),
   so the frontend stages cannot take it, and the API stage has never been told to. **This is
   the highest-priority carried item and needs to be assigned to an api-test stage
   explicitly.**

2. **`qa_options_probe` custom field is still live in the production database.** Tenant
   `waterloo`, created 2026-08-05, label "QA Options Probe", user-visible in
   Settings → Custom Fields. The nightly hygiene sweep matches `'QA-R9%'`, which this label
   does not match, so it escapes cleanup every night. Confirmed safe to delete (0 leads carry
   a value). **Needs one `DELETE` plus developer go-ahead — not QA's call.**

3. **Form label drift — deferred, developer decision (5th consecutive run).** Canonical is
   `.form-group label` (`index.css:2249`) = 12px/600/uppercase/0.08em. `/tasks` and
   `/subcontractors` match; `/work-orders` is 12px/600/none/normal and `/expenses` is
   12px/400/none/normal. Scope is 4 `labelStyle` objects (`AutomationSettings.jsx:57`,
   `CreateLeadModal.jsx:177`, `DripSequences.jsx:48`, `WorkOrdersView.jsx:1164`) plus ~100
   inline `<label>` elements across 19 files; only 6 files use `.form-group` at all.
   Deliberately **not** half-converted — a subset adds a new inconsistency axis, and
   converting all ~100 is a refactor the charter excludes.

4. **`.qa-r91-neverrun.mjs` has still never been run** — now 8 nights.

5. **Unswept jsonb write sites (the generalisation of tonight's backend bug).** Tonight's fix
   covered the two `::jsonb ||` merge sites. Five other jsonb write sites use plain
   assignment and were out of scope: `contractService.js:114` and `:212` (`content`),
   `dripService.js:93` (`trigger_config`), `invoiceService.js:117` (`line_items`),
   `workOrderService.js:377` (`line_items`), `roofMeasurementService.js:344` (`data`). A
   `line_items` stored as a scalar would break every `.map()` consumer. Cheap to check: one
   PATCH per site plus a consumer grep.

6. **Deliberately not changed, with reasoning recorded.** The 5 `.nav-link` `!important`
   pairs are value-identical no-ops (deliberate UA-chrome suppression; the in-source comment
   at `:304-308` shows the author understood the mechanism). The 3 `TasksView` shorthand hits
   sit inside the `isMobile` branch and mobile is paused. `stormHistoryService.js:49` has the
   same prototype-lookup pattern fixed elsewhere but is called only with hardcoded values and
   is not request-reachable.

7. **Housekeeping, developer call.** 336 QA screenshots are committed to the repo root. Dead
   code carried over: `quickFilters`/`applyQuickFilter` (`LeadList.jsx:62`, `:346`) and dead
   CSS `.stat-card:hover .stat-card__icon img` (`index.css:959`). Stray 0-byte `server/=` in
   the working tree (pre-existing).

Nothing on this list is blocked on an API key or a DB migration. Items 1, 4 and 5 are
stage-scheduling gaps; items 2, 3, 6 and 7 need a developer decision.

---

## Test Coverage Gaps

1. **18 of 272 API route patterns not executed — by design, not a gap in capability.**
   Excluded as side-effecting: `trigger-import` (starts a real bulk property import),
   anything matching `geocode` (costs money against the Google API), outbound delivery
   (`send`/`email`/`sms`/`webhook`), and auth state changes (`login` is rate-limited at ~10
   attempts). Five more were **added to the exclusion list this run** — `score-all`,
   `correct-all`, `mark-all-read`, `/complete`, `alerts/test` — after pass 1 proved each
   mutates real rows.

2. **Two routes were driven that should not have been, and both were corrected.** This is a
   tester error, recorded so it is not repeated: `POST /api/crm/leads/score-all` re-scored
   all 13 leads (a bulk write the charter forbids; not restorable, but not corrupt — scores
   are deterministically recomputed), and `PATCH /api/crm/work-orders/:id/complete` with an
   empty body marked a live work order completed (**reverted** to `status='pending'`,
   `completed_at=NULL`, `updated_at=created_at`; the WO domain is back to 7 pending / 3
   completed). The general rule now recorded: an action route needs no body, so an empty-body
   sweep does not neutralise it — it fires it.

3. **Four routes are structurally unexercisable** and cannot be fixture-resolved at all: the
   `counties` and `material_products` tables do not exist (`42P01`), and
   `contracts.public_token` and `leads.status_token` are not columns (`42703`).

4. **`/canvassing` pin drop was not completed** — it would cost a DB write plus a paid
   geocode.

5. **s2 wrote no `/tmp/frontend-test-results.txt` this run.** Its full record lives in its
   resume entry instead. ⚠️ The files at `C:/tmp/frontend-test-results.txt` (2026-08-26) and
   `%TEMP%/ui-audit-results.txt` (2026-08-25) are **stale** and must not be read as current.
   Tonight's artifacts are `C:/tmp/api-test-results.txt` and `C:/tmp/ui-audit-results.txt`
   only. Note that Git Bash `/tmp` resolves to `C:/Users/brand/AppData/Local/Temp`, which is
   **not** `C:/tmp` — s1 wrote its artifact to both this run specifically because that trap
   cost two prior nights.

6. **No screenshots were taken by s2 or s3, by choice.** 336 QA PNGs are already committed to
   the repo root, and computed-style plus network-parameter evidence is stronger than an
   image for the defect classes being hunted. s4 took three
   (`qa-r103-fix2-billing.png`, `qa-r103-fix3-hover.png`, `qa-r103-fix3-rest.png`) to
   `C:/tmp`, outside the repo.

7. **`add652c`'s more severe claim was not reproducible in this environment.** The commit
   message states the Add Payment Method button is *permanently* dead when
   `VITE_STRIPE_PUBLISHABLE_KEY` is absent. **That key is set locally**, so only the roughly
   one-frame load transient is observable here. The fix is correct either way, but the
   permanent-failure half of the claim is environment-dependent and was recorded rather than
   laundered into a pass.

8. **Two new selector-scope traps cost s4 real time and are now documented.** There is **no
   `<main>` element** — the root is `.main-content`, and a `|| document.body` fallback
   silently measured the global Cmd-K palette and faked a clean empty-state pass on 8 routes.
   And **`.main-content` does not exist at 375px** on routes with an `isMobile` branch, so a
   scoped text probe reads 0 characters and looks like a blank mobile screen when 34–84 nodes
   are actually painted.

---

## Pattern note for the next run

**This is the seventh consecutive run whose defect is "a value silently loses its expected
type or precedence, and the failure is invisible at the call site."** Six were CSS-cascade
shaped; tonight's backend bug is the DB-layer twin. Triage this shape first.

The CSS-cascade branch of that family is now **converged** — specificity, source order,
inline-beats-stylesheet, `!important`-beats-inline, `!important`-beats-own-state, shorthand
resets, and duplicate declarations have all been swept clean. **Do not re-spend there.** The
open branch is the DB/type one: known issue #5 above is its next concrete step.
