# StormLeads — Overnight QA Report

**Run 84 — 2026-08-21**
Baseline: `1b99913` (checkpoint: pre-overnight-run 2026-08-21) → HEAD `e791163`
Branch: `feat/financing` · Build: **PASS** (`npx vite build`, exit 0, 8.00s)

---

## QA Test Summary

| Metric | Count |
|---|---|
| App routes driven in a browser | **18** (s3 audit sweep, documented) — s2's page-level coverage is unrecorded, see Coverage Gaps |
| API route patterns inventoried | **272** across 36 route files |
| API route patterns exercised with a real response | **210 of 272 (77%)** |
| Total API calls issued | **301** — 149 2xx, 151 expected 4xx, **1 5xx**, 44 skipped |
| Bugs found | **4** |
| Bugs fixed | **4** (all committed; 3 of 4 independently re-verified at report time) |
| UI inconsistencies found | **0 new** |
| UI inconsistencies fixed | **0** (none warranted) |
| Commits this run | 4 (`76f009a`, `b72b6be`, `6462647`, `e791163`) |

**Bottom line.** Four real defects were found and all four are fixed. Two were backend
error-mapping defects (a false 404 and a 500 that should have been a 400); two were frontend
behavioural defects on the estimate review toolbar — a button that was 100% dead and an
unimported icon that would have crashed the modal the moment the first defect was fixed.

The seven prescribed visual/UI consistency audits found **zero** new defects for the **seventh
consecutive run** and are treated as converged. Every defect this run came from a *behavioural*
check — source-level set differences and negative-input API probes — not from measuring styles.

### Stage execution

| Stage | Duration | Turns | Exit | Output |
|---|---|---|---|---|
| s1 api-test | 9.1 min | 51 | **capped** (`error_max_turns`, 50) | 2 fixes committed; no results file written |
| s2 frontend-test | 30.9 min | 81 | **capped** (`error_max_turns`, 80) | no commits, no results file written |
| s3 ui-audit | 15.4 min | 62 | success | 2 fixes + `docs/ui-audit-2026-08-21.md` + harness |
| s4 verify | 8.6 min | 41 | **capped** (`error_max_turns`, 40) | verification harness written; results not written |
| s5 report | — | — | — | this report |

Three of five stages hit the turn cap. `git status` was clean at report time — unlike the four
previous nights, no stage left completed work uncommitted. The cost of the caps this run was
*reporting*, not *work*: s1's and s4's findings had to be reconstructed from their raw JSON
artifacts and harness sources, and s2's page-by-page results are unrecoverable.

---

## Backend API Test Results

Source: `C:/tmp/qa-r84-get-results.json` (05:04), `C:/tmp/qa-r84-write-results.json` (05:05),
`C:/tmp/route-inventory.txt` (05:03). All three are this run's.

**Method.** Every route in the inventory was probed twice over: a GET sweep against real
tenant IDs, and a write sweep sending each POST/PUT/PATCH two deliberately invalid bodies —
`empty` (`{}`) and `junk` (unrecognised keys and wrong-typed values). The write sweep is a
negative test: a 400 is the **pass** condition, a 500 is the failure, and a 2xx means the
endpoint accepted a body it should have rejected.

### Aggregate

| Sweep | Route patterns | Calls | 2xx | 4xx (expected) | 5xx | Skipped |
|---|---|---|---|---|---|---|
| GET | 132 | 119 | 99 | 20 | **0** | 13 |
| Write (empty + junk variants) | 122 | 182 | 50 | 131 | **1** | 31 |
| **Total** | **254 probed / 272 inventoried** | **301** | **149** | **151** | **1** | **44** |

Every one of the 20 GET non-2xx responses is correct behaviour, verified individually:

- **403 × 5** — `/api/admin/*` (`overview`, `revenue`, `tenants`, `tenants/:id`, `usage`).
  Platform-admin-only; the QA user is a tenant admin. Correct.
- **400 × 8** — required query params absent: `/api/crm/calendar` (start/end),
  `/api/data/directions` (from/to lat-lng), `/api/disaster-declarations` (state/county),
  `/api/map/swaths`, `/api/map/affected-properties`, `/api/properties`,
  `/api/properties/fema-live` (bbox), `/api/storm-history` + `/heatmap` (lat/lng, bbox).
  Each returns a specific, actionable message. Correct.
- **404 × 7** — placeholder IDs for rows that do not exist: `counties/:id/status`,
  `contracts/public/:token`, `financing/applications/:id`, `drift/:stormEventId`,
  `leads/status/public/:token`, `materials/products/:id`. Correct.

### By endpoint category

Categories are grouped by route prefix. "Correct 4xx" counts responses that are the *expected*
answer for the input sent (a rejected junk body, a permission denial, a missing row).

| Category | GET | Write | 2xx | Correct 4xx | 5xx | Skipped | Result |
|---|---|---|---|---|---|---|---|
| auth | 1 | 8 | 1 | 8 | 0 | 0 | PASS |
| admin | 5 | 2 | 0 | 7 | 0 | 0 | PASS (403 by design) |
| leads | 6 | 24 | 15 | 15 | 0 | 0 | PASS |
| estimates | 5 | 19 | 11 | 11 | **1** | 1 | **1 FIXED** (`b72b6be`) |
| financing | 6 | 11 | 5 | 11 | 0 | 1 | **1 FIXED** (`76f009a`) |
| contracts | 5 | 12 | 5 | 10 | 0 | 2 | PASS |
| invoices | 2 | 9 | 5 | 3 | 0 | 3 | PASS |
| work-orders | 5 | 12 | 10 | 7 | 0 | 0 | PASS |
| tasks | 1 | 4 | 1 | 4 | 0 | 0 | PASS |
| dashboard | 18 | 0 | 18 | 0 | 0 | 0 | PASS |
| reports | 6 | 0 | 6 | 0 | 0 | 0 | PASS |
| materials | 6 | 6 | 7 | 5 | 0 | 0 | PASS |
| subcontractors | 3 | 6 | 4 | 5 | 0 | 0 | PASS |
| expenses | 2 | 4 | 2 | 4 | 0 | 0 | PASS |
| canvass-pins | 2 | 6 | 4 | 4 | 0 | 0 | PASS |
| territories | 3 | 4 | 4 | 3 | 0 | 0 | PASS |
| prospect-lists | 2 | 2 | 2 | 2 | 0 | 0 | PASS |
| automations | 1 | 6 | 4 | 3 | 0 | 0 | PASS |
| drip-sequences | 3 | 8 | 5 | 6 | 0 | 0 | PASS |
| custom-fields | 1 | 4 | 1 | 4 | 0 | 0 | PASS |
| notifications | 3 | 6 | 5 | 4 | 0 | 0 | PASS |
| alerts | 2 | 4 | 6 | 0 | 0 | 0 | PASS |
| team / tenant-settings | 2 | 6 | 4 | 4 | 0 | 0 | PASS |
| onboarding | 1 | 11 | 5 | 6 | 0 | 1 | PASS |
| storms / storm-history / drift | 5 | 4 | 2 | 3 | 0 | 4 | PASS |
| properties / map | 13 | 11 | 9 | 8 | 0 | 7 | PASS |
| counties / data / documents | 5 | 7 | 2 | 8 | 0 | 1 | PASS |
| calendar / search / pipeline | 4 | 0 | 3 | 1 | 0 | 0 | PASS |
| payments | 2 | 5 | 2 | 0 | 0 | 5 | NOT TESTED (Stripe) |
| skip-trace | 6 | 3 | 0 | 0 | 0 | 9 | NOT TESTED (paid API) |
| roof-measurement | 5 | 3 | 0 | 0 | 0 | 8 | NOT TESTED (paid API) |
| webhooks | 0 | 2 | 0 | 0 | 0 | 2 | NOT TESTED (external caller) |

### What was fixed

**`76f009a` — `PATCH /api/crm/financing/plans/:id` and `.../lenders/:id` returned a false 404.**
`updatePlan` and `updateLender` each return `null` for two different reasons — the row does not
exist, *or* the body carried no field the service knows how to update — and both routes mapped
that single `null` to 404. A `PATCH` with a valid ID for a row that `GET /plans` demonstrably
returns answered `404 "Plan not found"`, which is simply false. Fixed by guarding in the route,
mirroring each service's own predicates (`isActive`/`isDefault` for plans; `isActive`/`config`/
`apiKey`/`merchantId` for lenders) so the two cannot drift, and returning
`400 "No fields to update"` — the convention already used by ten sibling route files.
Verified against the running server at fix time: `{}` and `{foo:"bar"}` 400 on both routes, a
real ID with a real field still 200s, a dead UUID still 404s, and the existing `apiKey` type
guard keeps priority.

**`b72b6be` — a bad status value returned 500 instead of 400 on every CHECK-constrained write.**
`PATCH /api/estimates/:id` with `{"status":"bogus"}` reached Postgres, tripped
`estimates_status_check`, and came back `500 "Internal server error"`. The value came entirely
from the caller, so it is a 400 — the same reasoning that already places `23503`
(foreign_key_violation) in `PG_BAD_INPUT_CODES`. Added `23514` (check_violation) to that set,
with its own message branch: the raw Postgres text is
`new row for relation "estimates" violates check constraint "estimates_status_check"`, which
leaks the table and constraint names, so it is sanitized the way `22P02` and `22001` already
are. **The fix is handler-agnostic** — it covers every CHECK-constrained column in the schema,
not just `estimates.status`. This was the only 5xx in the entire 301-call sweep.

### Independent re-verification at report time

s4 (verify) was written to re-drive both API fixes but hit its turn cap before recording
results. Its harness (`server/.qa-r85-verify-api.mjs`) was re-run for this report against the
live server on `:3001`:

```
PASS  plans/:id DEAD uuid + real field   -> 404   "Plan not found"
PASS  plans/:id bad-format id            -> 400   "Invalid id format"
PASS  lenders/:id DEAD uuid + real field -> 404   "Lender not found"
PASS  estimates PATCH status="bogus"     -> 400   "One or more values are not permitted..."
PASS  estimates PATCH status=12345       -> 400   "One or more values are not permitted..."
PASS  estimates PATCH status=["x"]       -> 400   "One or more values are not permitted..."
PASS  estimates PATCH status="draft"     -> 200   (real value still accepted)
SKIP  plans/:id   (no plan rows to test with)
SKIP  lenders/:id (no lender rows to test with)

7 pass, 0 fail, 2 skip
```

`b72b6be` is fully re-confirmed, including that the sanitized message leaks no table or
constraint name and that a legitimate value still succeeds. For `76f009a`, the 404 and
id-format paths are re-confirmed, but **the no-op-body → 400 path could not be re-driven**:
zero `financing_plans` / `financing_lenders` rows remain after the run's DB cleanup. That
assertion rests on s1's own verification recorded in the commit; it is listed under Coverage
Gaps rather than claimed here.

---

## Frontend Feature Test Results

**s2 (frontend-test) hit its turn cap at 81/80 turns without writing
`/tmp/frontend-test-results.txt` and without committing anything.** Its page-by-page findings
are lost. What follows separates what is *evidenced* from what is *not*.

> **Note on stale artifacts.** `/tmp/api-test-results.txt` (2026-08-19) and
> `C:/tmp/frontend-test-results.txt` (2026-08-11) exist but belong to earlier runs. They were
> `stat`-checked and excluded. The only genuinely current results file is
> `/tmp/ui-audit-results.txt` (05:53).

### Evidenced — every route renders and is clean

All 18 routes below were loaded in a real browser during the s3 sweep, with an accessibility
snapshot and computed-style measurement taken on each. Every one rendered its header, its
`<h1>`, its sidebar with exactly one active link, and produced **zero console or page errors**.
`scrollWidth - clientWidth = 0` on all 18 — no horizontal overflow anywhere.

| Route | Rendered | Console errors | Notes |
|---|---|---|---|
| `/` (dashboard) | PASS | 0 | 18 dashboard API calls all 200 |
| `/leads` | PASS | 0 | |
| `/pipeline` | PASS | 0 | |
| `/estimates` | PASS | 0 | **2 defects found in review mode — fixed, see below** |
| `/contracts` | PASS | 0 | |
| `/invoices` | PASS | 0 | |
| `/work-orders` | PASS | 0 | |
| `/materials` | PASS | 0 | |
| `/expenses` | PASS | 0 | modal opened live, verified |
| `/subcontractors` | PASS | 0 | slide-over opened live, verified |
| `/tasks` | PASS | 0 | slide-over opened live, verified |
| `/calendar` | PASS | 0 | |
| `/reports` | PASS | 0 | |
| `/storm-map` | PASS | 0 | FEMA property loading not touched (policy) |
| `/storm-catalog` | PASS | 0 | |
| `/canvassing` | PASS | 0 | |
| `/settings` | PASS | 0 | |
| `/alerts` | PASS | 0 | orphan route — 0 active nav links (known issue) |

### `/estimates` — 2 defects found and fixed (`6462647`)

Both sit on the **estimate review-mode toolbar** (`/estimates` → Edit → *Review & Share*).
This is the **same toolbar** Run 83 fixed *Download PDF* on. **Three dead controls in two runs
— treat it as a hot spot.**

**1. "Sign Now" was 100% dead.** `EstimateBuilder` has two mutually exclusive return branches:
an early `if (reviewMode) { return … }` at `EstimatesView.jsx:1619`, and the editor return at
`:1831`. The "Sign Now" button (`:1656`) lives in the **review** branch and called
`setShowSignModal(true)` — but `{showSignModal && estimate && <InPersonSignModal/>}` was
rendered **only in the editor branch** (`:2786`), which is unreachable while `reviewMode` is
true. Clicking the button set state that nothing read: no modal, no DOM change, and no console
error to hint at it. **No rendering check or visual audit can see this** — the modal never
enters the DOM at all. Confirmed dead in Playwright before the fix with a real mouse down/up
and input liveness asserted (the `:hover` chain resolved to "Sign Now", so the click landed).

**2. The modal would have crashed on render anyway.** `<IconCheck>` (`:2929`, the "Accept &
Sign" button) was **never imported** — the `./Icons` import listed 12 names and `IconCheck` was
not among them, though `Icons.jsx:181` exports it. Rendering `InPersonSignModal` would have
thrown `ReferenceError: IconCheck is not defined`. It was latent *only* because defect 1 meant
the modal never rendered. **Fixing defect 1 alone would have turned a dead button into a white
screen.**

**Fix.** Hoisted the modal into a `signModal` const before the `reviewMode` branch and rendered
`{signModal}` in **both** returns; added `IconCheck` to the existing `./Icons` import.

**Verified live after the fix:** "Sign Now" opens *Sign Estimate In Person*, exactly one
`.modal-backdrop` is present, the signature canvas mounts, "Accept & Sign" is correctly
disabled while the signer name is empty, `IconCheck` renders at `viewBox "0 0 24 24"`, **zero
console and page errors**. Build PASS. No estimate was signed and no DB row was written.

### Not evidenced — s2's charter

s2 was assigned interaction testing (not just rendering) across `/dashboard`, `/storm-map`,
`/pipeline`, `/leads`, `/leads/:id`, `/estimates`, `/invoices`, `/work-orders`, `/tasks`,
`/calendar`, `/reports`, `/canvassing`, `/content-studio`, and all 12 `/settings` tabs. It
capped before reporting. **Nothing in this report claims those interactions passed.** The only
recoverable trace of its work is described immediately below.

### Recovered from s2's artifacts — 2 untriaged candidates for the next run

s2 left a label-coverage harness (`C:/tmp/qa-r84-labeldiff.mjs`, 05:37) that diffs 16 frontend
label maps against the backing DB enums. It was re-run for this report. Fourteen of sixteen maps
are complete. Two report missing keys; **both were triaged for this report and neither is a
user-visible defect today**, but one is worth a look:

- **`CalendarView.jsx:typeLabels`** is missing 5 of the 8 `activity_type` values
  (`text`, `note`, `status_change`, `task_completed`, `system`). Renders via
  `{typeLabels[type] || type}` at `:134` — the raw enum value is shown, never a blank.
  **Cosmetic at worst, not a defect.**
- **`ClientStatusPage.jsx:STAGE_LABELS`** omits `lost` and `on_hold` and adds `completed`
  (which is not in the `lead_stage` enum — the same family as the documented "six pipeline
  stages are not in the enum" issue). The timeline maps over `STAGE_ORDER = Object.keys(...)`,
  so `STAGE_LABELS[stage]` always resolves and **the page cannot crash**. However, for a lead
  in `lost` or `on_hold`, `STAGE_ORDER.indexOf(stage)` is `-1`, so the customer-facing progress
  timeline would light **no** stage at all. Whether that is a defect or the intended treatment
  for a dead lead is a **design decision**, and driving it end-to-end needs a signed public
  status token. **Filed for the next run, not fixed.**

---

## UI Consistency Audit Results

Source: `/tmp/ui-audit-results.txt` (05:53) and `docs/ui-audit-2026-08-21.md`, both this run's.
All seven audits were measured **simultaneously in one capped Playwright sweep** over the 18
routes, per the standing guidance carried forward from Run 83.

**Result: ZERO new visual defects. Seventh consecutive converged run. No code changes were
warranted or made for any of the seven audits.**

| # | Audit | What was measured | Result |
|---|---|---|---|
| 1 | **Icons** | 2,182 `<svg>` elements across 18 routes; every icon import site in `client/src` | **0 non-Heroicon icons.** 0 `fa-*` / material / mdi / bi classes. 0 solid, `/20`, or `/16` Heroicon imports. 0 lucide / react-icons / fontawesome / mui imports anywhere. **Nothing to fix.** |
| 2 | **Buttons** | 888 visible `<button>` elements, grouped by computed height / padding / radius / font | Every outlier resolves to a documented, deliberate variant (icon-only, pill, toolbar, destructive). **No new sizing or styling inconsistency.** |
| 3 | **Toolbars / Headers** | header element on every route | **56px height + `topbar glass` class on 18/18.** An `<h1>` present on 18/18. **Fully consistent.** |
| 4 | **Sidebar / Nav** | `.nav-link` count, icon count, active-state count, inter-item gaps | 18 links / 18 icons / exactly 1 `.is-active` on **17 of 18** routes. Gaps `{0, 30, 8}px` identical on 18/18. The one exception is `/alerts` with 0 active links — the **documented orphan route** (see Known Issues #2), not a new finding. |
| 5 | **Forms** | native `<select>` count; `input[type=date]` count | **0 native `<select>` and 0 native date inputs on 18/18.** The `CustomSelect` and `DatePicker` rules hold everywhere in the app. **Nothing to fix.** |
| 6 | **Spacing** | `.glass` padding families; document overflow | Padding consistent within each family. The fractional 17.5px values are the documented systemic effect of Tailwind rem utilities resolving against a **14px root font-size** — not a defect. `scrollWidth - clientWidth = 0` on 18/18: **no alignment or overflow issues.** |
| 7 | **Modals** | 3 modals opened live via safe, non-destructive triggers | All three carry `modal-scale-in` (the Run 75 fix still holds), panel radius 20px / `20px 18px`, exactly one close button, `position: absolute`. Backdrop variance is **per-kind and deliberate**: slide-over `oklch(0.16 0.015 260/0.35)` blur16 vs modal `oklch(0 0 0/0.6)` blur8. |

Modal detail (opened live, no rows written):

| Route | Kind | Panel | Animation | Close | Esc closes |
|---|---|---|---|---|---|
| `/tasks` | slide-over | 420px, `20/18px` | `modal-scale-in` | 1, absolute | **no** |
| `/expenses` | modal-backdrop | 480px, `20px` | `modal-scale-in` | 1, absolute (header) | **no** |
| `/subcontractors` | slide-over | 480px, `20/18px` | `modal-scale-in` | 1, absolute | yes |

The Esc-key inconsistency and `ExpensesView`'s `<h3>` modal title were **re-confirmed
unchanged**; both are already on the known-and-deferred list and were not re-filed.

### Where the run was actually spent

Because the seven audits are converged, the bulk of s3 went into two new source-level
behavioural checks (`server/.qa-r84-s3-undefref.mjs`, committed):

- **CHECK A — JSX component tags with no import or declaration.** An uppercase JSX tag whose
  only whole-word occurrences in a file are tag positions is neither imported nor declared, and
  throws a `ReferenceError` at *render* time. **1 hit, real, fixed** — the `IconCheck` defect.
  The existing Run 83 harness explicitly skips this entire class
  (`if (/^[A-Z]/.test(id)) continue`), and **this repo has no ESLint at all**, so `no-undef`
  never runs against it.
- **CHECK B — cross-branch dead state.** In a component with an early-return branch plus a main
  return, a `useState` pair whose *setter* fires inside the early branch while that branch never
  *reads* the state means the control calling it is 100% dead. **1 hit, real, fixed** — the
  "Sign Now" defect.

Both checks are **self-tested against the pre-fix file**, so a zero is evidence rather than a
broken check. This mattered: CHECK B's first version returned `0` on the very file containing
its motivating defect, because it required *every* setter to sit inside the branch. All of
CHECK B's false positives collapse to one shape — the setter, or a sibling in the same handler,
flips the branch condition — and that suppression is now encoded, so the pre-fix file yields
exactly 1 real defect with 0 false positives.

---

## Bugs Fixed

1. **`PATCH /api/crm/financing/plans/:id`, `PATCH /api/crm/financing/lenders/:id`** — A no-op
   body (`{}` or unrecognised keys) against a **valid, existing** row returned
   `404 "Plan not found"` / `"Lender not found"`, which is false: the service returns `null`
   both for a missing row and for a body with no updatable field, and the route mapped that one
   `null` to 404. — **Fixed** by guarding in the route with predicates mirroring each service's
   own, returning `400 "No fields to update"` (the convention in ten sibling route files).
   `server/src/routes/financing.js`, commit **`76f009a`**.

2. **Every CHECK-constrained write, app-wide (surfaced on `PATCH /api/estimates/:id`)** — A
   caller-supplied value that violates a Postgres CHECK constraint (e.g. `{"status":"bogus"}`)
   returned `500 "Internal server error"` instead of a 400. — **Fixed** by adding `23514`
   (check_violation) to `PG_BAD_INPUT_CODES` with its own sanitized message branch, since the
   raw Postgres text leaks the table and constraint names. Handler-agnostic: covers every
   CHECK-constrained column in the schema. `server/src/middleware/errorHandler.js`, commit
   **`b72b6be`**.

3. **`/estimates` → Edit → Review & Share — "Sign Now"** — The button was **100% dead**. It set
   `showSignModal` from inside the `reviewMode` early-return branch, but the modal was rendered
   only in the editor branch, which is unreachable while `reviewMode` is true. Clicking it
   produced no modal, no DOM change, and no error. — **Fixed** by hoisting the modal into a
   `signModal` const before the branch and rendering `{signModal}` in **both** returns.
   `client/src/components/EstimatesView.jsx`, commit **`6462647`**.

4. **`/estimates` → `InPersonSignModal` → "Accept & Sign" icon** — `<IconCheck>` was used at
   `EstimatesView.jsx:2929` but was **never imported** (the `./Icons` import listed 12 names,
   and `IconCheck` was not one of them, though `Icons.jsx:181` exports it). Rendering the modal
   would have thrown `ReferenceError: IconCheck is not defined` — a white screen. Latent only
   because bug 3 meant the modal never rendered. — **Fixed** by adding `IconCheck` to the
   existing import. Same commit **`6462647`**.

---

## Known Issues (Not Fixed)

Carried forward and re-confirmed unchanged this run. None is a regression; each is deferred for
a stated reason.

1. **Six pipeline stages are not in the `lead_stage` enum.** *Needs a DB migration.*
   `ALTER TYPE … ADD VALUE` **cannot be rolled back** in Postgres, so this is not QA's call.
2. **`/alerts` is an orphan route.** Nothing links to it and it has no sidebar entry — the only
   route of 18 with zero active nav links. Duplicated under Settings → Storm Alerts.
   *Design decision:* add a nav entry or retire the route.
3. **Esc-to-close is inconsistent, not absent.** The `/subcontractors` slide-over closes on Esc;
   `/tasks` (same CSS class), `/expenses`, `/work-orders` and `/pipeline` do not. *Design
   decision* — pick one behaviour and apply it.
4. **Outside-click dismissal is inconsistent.** 11 of 22 `.modal-backdrop` elements close on
   outside click; the other 11 have no `onClick` handler (CalendarView:255, CreateLeadModal:79,
   EmailModal:92, EstimatesView:2871, ExpensesView:91/:387, InvoicesView:1054,
   MaterialsView:462/:585/:893, SettingsView:710). Same family as #3.
5. **Form labels have 7 treatments.** `index.css:2239 .form-group label` is the canonical rule
   (12px / 600 / uppercase / 0.08em) and 22 labels match it; 31 do not — Pipeline,
   ContractsView, ExpensesView, InvoicesView and WorkOrdersView hand-roll inline styles.
   **Best refactor candidate in the backlog**, since the target rule already exists in CSS.
   Deferred as a refactor, which is outside the QA charter.
6. **Estimate Builder shows two currency formats at once.** `EstimatesView.jsx:2118` uses
   `toLocaleString` → `$2,500.00` while `:2258` uses `toFixed(2)` → `$2500.00` for the **same**
   subtotal, both visible simultaneously. Recommend standardizing on `toLocaleString`.
7. **30 write endpoints accept an empty or junk body with a 2xx.** The write sweep got 50 such
   responses across 30 route patterns (e.g. `PATCH /api/crm/leads/:id`,
   `PUT /api/crm/tenant-settings`, `POST /api/estimates/:id/duplicate`). These do not crash and
   do not corrupt data with the bodies sent, but they store wrong-typed values rather than
   rejecting them — a latent crash surface documented since Run 68 and **deferred for a fourth
   run**. Closing it means a validation pass across 30 handlers, which is a feature-sized
   change, not a bug fix. *Recommend scheduling it as its own task.*
8. **`automationEngine.js:75-77` inserts `cfg.priority || 'medium'` into `tasks.priority`**,
   which is the `lead_priority` enum (`hot|warm|cold`). Every value
   `AutomationSettings.jsx:41-46` offers (low/medium/high/urgent) is an invalid enum label.
   Note: with `b72b6be` this now fails as a clean 400 rather than a 500, but the **UI still
   offers values the DB cannot store**.
9. **`ContractsView.jsx:74` computes `isMobile` and never reads it**, and `MobileTaskSection`
   (`TasksView.jsx:645`) destructures `icon`/`iconColor` and uses neither while its three call
   sites pass Material Icons ligature names. **Both are inside mobile-only branches and are out
   of charter while mobile work is paused.**
10. **~5 status-pill treatments app-wide**; `borderRadius:'999px'` hard-coded at 6 sites where
    `--radius-pill` exists; rem-vs-px font sizes at 10 sites; close-button placement has 2
    patterns. Cosmetic consistency backlog.
11. **`ExpensesView`'s modal title is an `<h3>`** where every other modal uses `<h2>`.
12. **336 QA screenshots are committed to the repo root.** Housekeeping; developer's call.
13. **The repo has no ESLint configuration at all** — no config file and no lint script. This is
    why bug 4 (an unimported component) could reach the codebase: `no-undef` never runs. Two
    consecutive runs have now found defects that a standard lint setup would have caught at
    author time. *Strongest single recommendation in this report.*

---

## Test Coverage Gaps

1. **s2's entire frontend interaction charter is unrecorded.** s2 capped at 81/80 turns without
   writing a results file or committing. Interaction testing for `/dashboard`, `/storm-map`,
   `/pipeline`, `/leads`, `/leads/:id`, `/invoices`, `/work-orders`, `/tasks`, `/calendar`,
   `/reports`, `/canvassing`, `/content-studio` and the 12 `/settings` tabs — button clicks,
   form submits, drag-and-drop, filter and tab switching — **has no result for this run**. All
   18 routes are confirmed to *render* cleanly (s3), which is strictly weaker. **This is the
   largest gap in the run.**

2. **62 of 272 API route patterns (23%) never received a real response.** They fall into four
   groups, all deliberate:
   - **All 18 `DELETE` routes** were excluded — destructive, and DB hygiene policy on the Neon
     free tier forbids creating throwaway rows purely to delete them.
   - **Paid third-party APIs — 28 further patterns:** all of `roof-measurement` (8), 9 of
     `skip-trace` (the 10th is a DELETE, counted above), `payments`/Stripe (5),
     `onboarding/setup-payment`, and `properties/{geocode, reverse-geocode, import-csv,
     trigger-import, import-progress}`. Testing these costs real money and is barred by the
     run charter.
   - **The remaining 16** need an external caller, a signed token, an unreachable host, or a
     bulk write: `webhooks/{hearth,tracerfy}`; the four `drift/*` write routes; the four
     send-email routes (`contracts/:id/send`, `estimates/:id/send`, `invoices/:id/send`,
     `invoices/:id/send-email`); `contracts/:id/void`; `invoices/:id/payment`;
     `financing/plans/sync`; `properties/fema-live-polygon` and `properties/generate-leads`
     (FEMA code is off-limits by policy, and lead generation is a bulk write); and
     `counties/:id/import`, which depends on `feature.tnris.org` — **not reachable from this
     environment** (`ENOTFOUND`, seen 73 times in a previous run's server log).

3. **`76f009a`'s primary assertion could not be independently re-verified at report time.** The
   "real ID + no-op body → 400" path needs at least one `financing_plans` and one
   `financing_lenders` row, and the DB has **zero of each** after the run's cleanup. The 404
   and invalid-ID paths *were* re-confirmed. The primary path rests on s1's own live
   verification recorded in the commit message. **To close this, the next run should seed one
   plan and one lender before verifying, then clean up.**

4. **Edge cases assigned to s4 were never reached.** Empty states (no leads / no estimates / no
   tasks), form validation with empty required fields, browser back/forward navigation, and
   responsive degradation at 375px were all in s4's charter; it capped after re-verifying the
   API fixes.

5. **Mobile viewports (≤768px) are out of charter** while mobile work is paused. Several known
   issues (#9) sit inside `if (isMobile)` branches and are therefore untested by design.

6. **FEMA map property loading, filtering, IndexedDB caching and storm-swath intersection were
   not touched**, by explicit policy — that code is under active development.

7. **The `admin` route family (7 patterns) is only tested for its 403 boundary.** The QA user is
   a tenant admin, not a platform super-admin, so admin functionality itself is unverified.

8. **The audit measures the app in dark mode at desktop width only.** Light mode and
   intermediate breakpoints are not covered by the seven audits.

---

## Recommendations for the Next Run

1. **Add ESLint.** Two runs in a row have produced defects that `no-undef` alone would have
   caught at author time (Known Issue #13). This is the highest-leverage change available.
2. **Re-audit the estimate review-mode toolbar first.** Three dead controls in two runs
   (`Download PDF` in Run 83; `Sign Now` and `IconCheck` tonight). Drive **every** control on
   that toolbar end-to-end.
3. **Keep spending the run on behavioural set differences.** The seven visual audits have
   returned zero for seven consecutive runs; every defect for the last three runs came from a
   source-level set difference or a negative-input probe. One capped sweep for regression is
   enough.
4. **Self-test every set difference against a known positive** before trusting a zero. CHECK B
   returned `0` on the very file holding its motivating defect until it was corrected.
5. **Raise the turn caps, or split the stages.** Three of five stages capped this run. The cost
   was reporting fidelity, not work — but s2's entire charter was lost to it.
6. **Write harnesses with an editor tool, never a shell heredoc.** A heredoc silently collapses
   backslashes inside *string* literals (regex *literals* survive), which turns
   `new RegExp('[^\\w$.]')` into a silently wrong character class.

---

*Report generated by the s5 report stage. Every number above is traceable to an artifact
timestamped within this run: `C:/tmp/qa-r84-{get,write}-results.json`,
`C:/tmp/route-inventory.txt`, `/tmp/ui-audit-results.txt`, `docs/ui-audit-2026-08-21.md`, the
four stage-envelope JSON files, and the four commits between `1b99913` and `e791163`. Stale
result files from earlier runs were `stat`-checked and excluded.*
