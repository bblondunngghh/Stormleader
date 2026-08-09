# StormLeads — Overnight QA Report

**Run 72 · 2026-08-08 · 05:00–06:00 CDT**
Baseline `0cf5a7b` (`checkpoint: pre-overnight-run 2026-08-08`) → HEAD `aca103e`

---

## QA Test Summary

| Metric | Count |
|---|---|
| Bugs found | 12 |
| Bugs fixed | 10 |
| Bugs found but not fixed | 2 |
| Commits | 8 (all `fix:`) |
| Pages render-swept | 19 of 19 routes |
| Pages interaction-tested | 5 of 19 |
| API routes in catalogue | 272 |
| API routes exercised this run | 10 (depth-first, not a breadth sweep) |
| JSONB columns given write guards | 2 this run (8 of 27 cumulative) |
| UI inconsistencies found | 15 (9 glyph sites, 136 buttons, 2 wording splits) |
| UI inconsistencies fixed | 14 (1 deferred, in a do-not-touch component) |
| DB migrations added | 1 (`049_invoice_payment_method.sql`) |
| Final build | exit 0, 8.01s |

**Headline:** the most serious finding is again a silent write failure, not a crash. The
Record Payment modal collects a payment method and a check/claim number, shows a green toast
naming the method back to the user — and `recordPayment(id, amount)` posted only the amount.
No column existed to store either value. A contractor typing a check number was told it was
recorded; it was gone. 200 OK, no console message, no error signal anywhere. This is the
third consecutive run in which the highest-severity defect produced **no error signal at
all** (Run 70: estimate autosave; Run 71: dashboard filter bar; Run 72: this).

**Coverage caveat, stated up front:** all four upstream stages hit their turn caps again —
**4 of 4 for the fourth consecutive run**. Coverage is depth-first by design and most of this
application was not exercised. The sections below distinguish *tested and passing* from *not
tested*; those are not the same claim, and most of this app remains the second.

---

## Backend API Test Results

Route catalogue: **272** across 37 route files (`crm.js` 51, `properties.js` 18,
`estimates.js` 17, `financing.js` 13, `contracts.js` 13, `workOrders.js` 12, …).

Run 71's carry-forward named **JSONB columns** the highest-value target, and specifically
called out `invoices.line_items` and `work_orders.line_items` as "structurally identical to
`estimates.line_items`, which produced three separate white-screens across Runs 69–71". That
prediction was correct: both columns were unguarded, and one of them was already serving 500s.

| Category | Routes probed | Result | Fixed in |
|---|---|---|---|
| Work orders (JSONB element deref) | 1 (`GET /api/crm/work-orders/:id/pdf`) | 2 of 21 PDFs were 500 → all 21 now 200 | `86eb187` |
| Work orders (JSONB write validation) | 2 (`POST`, `PATCH /api/crm/work-orders/:id`) | 4 of 4 hostile shapes now 400, was 200-and-stored | `81d0cab` |
| Invoices (JSONB write validation) | 2 (`POST`, `PATCH /api/crm/invoices/:id`) | 4 of 4 hostile shapes now 400, was 200-and-stored | `81d0cab` |
| Invoices (payment recording) | 1 (`POST /api/crm/invoices/:id/payment`) | method + reference now persist; were discarded | `629e073` |
| Estimates (control group) | 2 (`POST`, `PATCH /api/estimates`) | already 400s all 4 shapes — used as the reference | — |
| CRM dashboard (label check) | 1 (`GET /api/crm/dashboard/days-in-stage`) | wording aligned to app-wide vocabulary | `aca103e` |
| Auth | 1 (`POST /api/auth/login`) | token mint OK | — |
| **Total exercised live** | **10** | **0 5xx after fixes** | |

### What was fixed

**`86eb187` — work-order PDF 500'd on a null element inside `line_items`.**
`workOrders.js:220` does `Array.isArray(wo.line_items) ? wo.line_items : []`, which guards the
**container** and not the **elements**. `[null]` has length 1, so it passes the `length > 0`
check at `:231` and then dereferences null at `:239` (`item.description`) and `:246`
(`it.quantity`) → TypeError → 500. This is the *same defect and the same fix* as the estimate
PDF (`a023c66`, Run 67); the work-order PDF was simply never checked for it. Verified: two
known-bad IDs went 500 → 200 with a valid `%PDF` header, the control row was unchanged, and a
regression sweep of **all 21 work-order PDFs returned 21×200, 0×5xx**.

**`81d0cab` — work-order and invoice `line_items` accepted ANY shape into JSONB.**
`POST`/`PATCH` on both routes stored a string, an object, a number or a boolean into the
`line_items` JSONB column and returned 200. `estimates.js:20` already carried exactly this
guard; the two sibling routes never got it. Confirmed by direct probe against the estimate
route as a control: estimate → 400 on all four bad shapes, work order → 200 **and stored** on
all four, invoice likewise.

The impact is silent data loss rather than a crash: `line_items: "a string"` *replaces* the
row's line items, and because every consumer guards the container
(`Array.isArray(...) ? ... : []`), the UI and the PDF then render **zero** line items while
subtotal, tax and total keep their previous values. Nothing throws and nothing warns — the
document just quietly loses its contents.

Verified both halves: 8 of 8 malformed payloads rejected with
`400 {"error":"line_items must be an array"}` and the stored value left unchanged, **and** a
valid array still writes and round-trips out of Postgres intact on both routes. The second
half matters as much as the first — a guard that also blocks the happy path is a worse bug
than the one it fixes.

**`629e073` — recording an invoice payment silently discarded the method and check number.**
The modal collects 7 payment methods and a reference/check/claim number; the success toast
says "Payment of $X recorded via insurance". `recordPayment(id, amount)` posted only
`{ amount }`, the route destructured only `amount`, and the service UPDATE touched only
`amount_paid`/`status`/`paid_at`. There was no column for either value.

Migration `049` adds two nullable TEXT columns. The method is whitelisted server-side against
`PAYMENT_METHODS` and the reference is trimmed and capped at 200 chars — so unlike the JSONB
columns in `81d0cab`, these two cannot take junk. `COALESCE` preserves the last recorded
method when a later partial payment omits one. Verified end-to-end: the round-trip now reads
back `INV-0007 | 603.00 | insurance | CLAIM-QA72-XYZ` from Postgres.

### Why JSONB keeps producing these — confirmed, not assumed

Run 70 concluded that strongly-typed Postgres columns absorb bad shapes (the cast fails and
the global error handler maps it to a clean 400), so **the type system performs the validation
the JS layer omitted**. JSONB has no cast to fail: it stores whatever it is handed, verbatim.
That is why these two routes leaked while strongly-typed columns elsewhere did not, and it is
why element sanitizing deliberately stays on the consumer side as well — **a write guard
cannot clean rows that are already stored.** The `86eb187` 500 was caused by exactly such a
pre-existing row, written long before any guard existed.

---

## Frontend Feature Test Results

All 19 routes were render-swept. **Five were interaction-tested.** Both numbers matter — the
five that were driven produced most of the run's findings, so the other fourteen are
*unexercised*, not clean.

### `/invoices` — interaction-tested
- **Tested:** Record Payment modal — method dropdown (7 options), reference field, submit, toast, DB round-trip.
- **Broken → fixed:** method and reference silently discarded (`629e073`, above).
- **Verified:** before — request body was `{"amount":1}` while the toast claimed "recorded via insurance". After — the body carries `payment_method` and `reference`, and both are present in Postgres.
- **Also fixed here:** `line_items` JSONB write guard (`81d0cab`).

### `/work-orders` — interaction-tested (API depth)
- **Tested:** PDF generation across the full set of 21 work orders; POST/PATCH shape validation.
- **Broken → fixed:** 2 of 21 PDFs returned 500 (`86eb187`); both write routes accepted any JSONB shape (`81d0cab`).
- **Verified:** 21 of 21 PDFs now 200.

### `/tasks` — interaction-tested
- **Tested:** task rows, priority rendering, both task modals.
- **Broken → fixed:** every list rendered `{task.priority}` raw, so a user who picked "Medium" in the modal saw **"WARM"** in the row (`8745ec5`). `tasks.priority` is the `lead_priority` enum — `hot|warm|cold` — verified against the live DB, while the modals offer High/Medium/Low.
- **Verified by computed style, not source:** `.task-row__priority` → "MEDIUM", `oklch(0.78 0.17 85)` (`--accent-amber`).

### `/dashboard` — interaction-tested
- **Tested:** task priority chips, stage labels on follow-ups and lead rows, days-in-stage panel.
- **Broken → fixed (three defects):**
  1. `priorityColors` (`Dashboard.jsx:61`) was keyed `urgent/high/medium/low`. **None of those four keys can ever occur**, so the lookup at its only call site was always `undefined` and every dashboard priority rendered with no colour. `Dashboard.jsx:1204`'s `task.priority === 'urgent'` was dead for the same reason — a high-priority task never got the red treatment it was written to get (`8745ec5`).
  2. `stageLabels` (`Dashboard.jsx:55`) was keyed `new_lead / inspection / negotiation / closed_won / closed_lost` — five keys that can never occur — while six real enum values had no entry at all. Both call sites fall back to the raw value, so nothing crashed; the stages just rendered as database keys, and `on_hold` rendered as **"ON_HOLD"**, underscore and all (`1f1e68b`).
  3. Stage wording then diverged from the rest of the app — see below (`aca103e`).
- **Verified:** priority chip → "MEDIUM" at `oklch(0.78 0.17 85)`; a span sweep for raw enum leakage (`/^[a-z]+_[a-z_]+$/`) returns nothing from the stage badges.

### `/alerts` — interaction-tested
- **Tested:** alert-threshold steppers, full-page icon sweep.
- **Broken → fixed:** `StepperInput` rendered its increment/decrement controls as two 28×28 icon buttons whose entire content was the text characters `U+2212` and `+`. Both thresholds render one stepper each, so **four such buttons were live on the page at load** — and they had **no accessible name at all** (`31fbc07`).
- **Verified:** symbol-glyph text nodes in clickables 4 → 0; total SVG count 34 → 38 (exactly +4); all four new icons `viewBox="0 0 24 24" fill="none" stroke-width="1.5"`; button box preserved at 28×28 and colours preserved.

### `/materials` — interaction-tested
- **Tested:** catalogue grid, Add-to-cart button geometry across all rendered products.
- **Broken → fixed:** see Buttons audit below (`9502b9c`).

### Render-depth only — not interaction-tested
`/pipeline`, `/leads`, `/storm-map`, `/storm-catalog`, `/calendar`, `/canvassing`,
`/estimates`, `/reports`, `/contracts`, `/expenses`, `/subcontractors`, `/settings`, `/admin`.
These rendered without error and passed the SVG sweep. **No workflow on any of them was
driven.** Do not read this as passing.

---

## UI Consistency Audit Results

This is the first run in which a **second** audit category produced a finding. Categories 3–7
still never ran.

### Icons — 9 code sites found (11 rendered controls), 8 fixed, 1 deferred

| Site | Glyph | Fixed as | Commit |
|---|---|---|---|
| `AlertSettings.jsx:309,321` StepperInput (4 live on `/alerts`) | `U+2212`, `+` | Minus/PlusIcon + aria-labels | `31fbc07` |
| `RoofDrawingTool.jsx:635,778` remove facet / line | `U+2715` | Heroicons (file imported none) | `31fbc07` |
| `TerritoryManager.jsx:262` draw territory | `U+2713` | Heroicon | `31fbc07` |
| `AutomationSettings.jsx:156` New Automation | `+` | `PlusIcon` | `aca103e` |
| `ContractsView.jsx:556` Add Section | `+` | `PlusIcon` | `aca103e` |
| `DripSequences.jsx:223,404` New Sequence / Add Step | `+` | `PlusIcon` | `aca103e` |
| `StormProperties.jsx:347` dropdown chevron | `U+25BE` | **NOT FIXED** — do-not-touch component | — |

**Why five prior icon audits missed the steppers — and the method fix.** Run 70 established
that an emoji is a *text node* and therefore invisible to a `querySelectorAll('svg')` sweep.
That lesson was applied, but the detector written from it enumerated Unicode **blocks**
(arrows `2190-21FF`, misc-technical `2300-23FF`, geometric `25A0-25FF`, dingbats `2600-27BF`,
emoji). `U+2212 MINUS SIGN` lives in Mathematical Operators (`2200-22FF`) and `+` is plain
ASCII — so a block-enumerating detector is **structurally incapable** of finding a +/− stepper,
no matter how many blocks are added. It was replaced with a block-independent rule: any text
node of ≤3 characters containing no letter and no digit (`\p{L}`/`\p{N}`), sitting inside a
clickable, excluding ordinary punctuation. That rule found the steppers immediately, and then
found the four `+` label prefixes.

The `RoofDrawingTool` and `TerritoryManager` sites are invisible to **any** render-depth sweep
— both components mount only behind an interaction — and were caught by the source grep
instead. Neither lens alone was sufficient; this is Run 70's three-lens rule holding for the
fourth consecutive run.

**Accessibility side-effect:** the four `/alerts` stepper buttons had no accessible name at
all. All now carry `aria-label`.

**Final state:** a 19-route re-sweep reports **0 non-conforming SVGs and 0 clickable symbol
glyphs** remaining.

### Buttons — 1 outlier found (136 rendered buttons), fixed

`MaterialsView.jsx:444` inline-overrode `borderRadius: '12px'` on a button that already
carries `.quick-action-btn`, whose class rule (`index.css:1809`) is the app's signature
elliptical "squircle" `border-radius: 14px / 12px`. This is the single most-repeated button on
the page — it renders once per product — so **136 buttons on `/materials` had a plain-circular
radius** while every other quick-action button in the app had the elliptical one.

Established as an outlier rather than a deliberate small-size variant before touching it:
the same small variant (`font-size: 11px`) elsewhere keeps 14px / 12px on `/estimates` ×153,
`/contracts` ×21 and `/invoices` ×18 (192 buttons); `MaterialsView`'s own other radii use the
elliptical form; and the other three quick-action buttons on `/materials` itself already
computed 14px / 12px. The override contradicted its class, the rest of the app, and its own
file. The fix is a **deletion** — no new value introduced.

Verified live: before `{"12px": 136, "14px / 12px": 3}` → after `{"14px / 12px": 139}`, a
single value across all 139 buttons.

### Labels / vocabulary — 2 splits found, both fixed

The app has one stage vocabulary, used identically by `LeadList.jsx:32`, `LeadDetail.jsx:104`,
`ReportsView.jsx:25` and Pipeline's columns: **Inspected | Estimate Sent | Negotiating | Sold
| In Production**. Two places disagreed, and **one of them was introduced by this run's own
`1f1e68b`**, which correctly added the missing enum keys but spelled them *Inspection /
Negotiation / Won / Production*. For a window during this run, `/leads` said "Inspected" while
`/dashboard` said "Inspection" for the same lead. The second split was server-side
(`crm.js:833`, days-in-stage), and that panel renders *beside* the Pipeline panel — so one
screen showed one lead stage under two different names. Both aligned in `aca103e`; legacy
non-enum keys kept as aliases so no stage loses its label.

This is Run 70's carry-forward #2 in a new form: **a fix can introduce a defect as well as
activate one.** It was caught only because a later stage re-read the change.

### Toolbars/Headers, Sidebar/Nav, Forms, Spacing, Modals — NOT AUDITED

Stage 3 was chartered with seven audit categories and hit its 60-turn cap after the first two.
**Categories 3–7 produced no findings because they were never run**, not because they passed.
This is the third consecutive run in which the icon audit consumed most of the UI stage.
Esc-to-close (0 of 4 modals in Run 69) remains unretested for a fourth run.

---

## Bugs Fixed

1. **`GET /api/crm/work-orders/:id/pdf` (API)** — `[null]` inside `line_items` passed the `Array.isArray` container check and was then dereferenced → 500 on 2 of 21 work orders. *Fixed:* per-element filter, matching the estimate-PDF fix from Run 67. All 21 PDFs now 200. — `86eb187`
2. **`POST`/`PATCH /api/crm/work-orders/:id` (API)** — Accepted a string, object, number or boolean into the `line_items` JSONB column and returned 200. *Fixed:* container-type guard matching the `estimates.js` precedent; 4 of 4 hostile shapes → 400, valid arrays still write. — `81d0cab`
3. **`POST`/`PATCH /api/crm/invoices/:id` (API)** — Same defect on the sibling route; malformed input silently *replaced* the invoice's line items while totals kept their old values. *Fixed:* same guard. — `81d0cab`
4. **`POST /api/crm/invoices/:id/payment` (full-stack)** — Payment method and check/claim number were collected by the modal, named back to the user in the success toast, and discarded entirely; no column existed. *Fixed:* migration `049` adds two nullable TEXT columns; method whitelisted server-side, reference trimmed and capped at 200 chars. — `629e073`
5. **`/tasks` + `/dashboard` (UI)** — Task priority rendered the raw enum, so choosing "Medium" displayed **"WARM"**. *Fixed:* label map over the real `hot|warm|cold` enum. — `8745ec5`
6. **`/dashboard` (UI)** — `priorityColors` was keyed on four values that can never occur, so every dashboard priority rendered with no colour and the `'urgent'` branch was dead code. *Fixed:* re-keyed to the real enum. — `8745ec5`
7. **`/dashboard` (UI)** — `stageLabels` was keyed on five non-existent stages while six real ones had no entry; `on_hold` rendered as "ON_HOLD". *Fixed:* real enum keys added, legacy keys kept as aliases. — `1f1e68b`
8. **`/alerts`, `RoofDrawingTool`, `TerritoryManager` (UI)** — 5 glyph-in-icon-slot sites, including 4 buttons live on `/alerts` at page load with no accessible name. *Fixed:* Heroicons + `aria-label`; detector rewritten to be block-independent. — `31fbc07`
9. **`/materials` (UI)** — 136 Add-to-cart buttons inline-overrode the app's squircle radius. *Fixed:* deleted the redundant inline style and let the class supply it. — `9502b9c`
10. **4 components + `crm.js` (UI)** — 4 more `+` glyphs in icon slots, and the stage vocabulary split two ways (one split introduced earlier the same night by `1f1e68b`). *Fixed:* Heroicons; both label maps aligned to the app-wide wording. — `aca103e`

---

## Known Issues (Not Fixed)

1. **`U+25BE` used as a dropdown chevron — `StormProperties.jsx:347`.** Not fixed
   deliberately: this is inside the FEMA storm-properties panel that the charter marks
   **do-not-touch** (developer-owned; changes there get reverted). Documented for the developer
   rather than changed.

2. **`CanvassingMode`'s `OUTCOME_OPTIONS` carries a dead `emoji` field (6 emoji).** Grepped
   app-wide and never consumed — only `label` and `color` are read. Left alone per the
   no-refactor rule, but flagged: it is a loaded gun. Rendering `opt.emoji` would put 6 emoji
   into icon slots in a single line of code.

3. **`⚡` (U+26A1) still in 5 icon slots — carried from Run 71, needs a design decision.**
   `LeadDetail.jsx:613` and `LeadList.jsx:420-423`. Re-confirmed present this run. The
   `LeadDetail` one is a mechanical swap, but the four `LeadList` entries are `CustomSelect`
   option-label **strings**; giving them icons requires `CustomSelect` to render nodes in
   options — a component change, not a swap.

4. **Duplicate `estimate_number` within a single tenant — needs a DB migration.** `EST-021`,
   `EST-022` and `EST-082` each exist twice under tenant `791bb51d`; no unique constraint on
   `(tenant_id, estimate_number)`. Pre-existing. Carried from Run 71, unchanged.

5. **`GET /api/properties/fema-live` 500 — external, not actionable.** NSI connect timeout.
   Carried from Runs 70–71, unchanged.

6. **19 of 27 JSONB columns still have no write guard.** See gaps below.

7. **Chunk-size build warning** — `mapbox-gl` 1.70 MB, `index` 594 kB. Pre-existing and
   cosmetic; outside the QA charter.

---

## Test Coverage Gaps

**1. JSONB write guards — 19 of 27 base-table columns still unguarded.** This run guarded
`work_orders.line_items` and `invoices.line_items`, bringing the cumulative total to **8 of
27** (`custom_field_definitions.options` from Run 69; `estimates` ×4 and `material_orders.items`
from Run 71). *Number reconciliation:* Run 71 reported "29 JSONB columns" and this run's
commit messages say 27 — both are right. The database has **29** JSON/JSONB columns, of which
**2 belong to `lead_summary_view`**, a view rather than a base table; 27 are writable base-table
columns. Still unguarded and populated: `contracts.content`, `contract_templates.content`,
`leads.custom_fields`, `leads.lead_score_factors`, `activities.metadata`, `tenants.branding`,
`financing_lenders.config`, `subscription_plans.features`, `automations.trigger_config` /
`action_config`, `drip_sequences.trigger_config`, `drip_sequence_steps.action_config`,
`documents.tags`, `content_library.content`. **`contracts.content` is the highest-value
remainder for Run 73** — it is the largest untested JSONB surface and drives a
customer-facing rendered document, the same shape that produced this run's PDF 500.

**2. No breadth sweep this run.** Run 70 exercised 252 of 272 routes (92.6%). This run went
depth-first per Run 71's carry-forward and exercised **10**. The 252-route result is now two
runs stale and is **not** re-verified against tonight's server-side changes to `workOrders.js`,
`invoices.js`, `invoiceService.js` and `crm.js`.

**3. Interaction testing reached 5 of 19 routes.** Those 5 produced nearly every finding, which
is itself the evidence that the other 14 are unexercised rather than clean.

**4. Five of seven UI audit categories never ran** (toolbars/headers, sidebar/nav, forms,
spacing, modals). Buttons was entered for the first time and immediately produced a
136-instance finding on the first page examined — which is a reason to expect the five
unexamined categories to hold findings too, not a reason to assume they are clean.

**5. Turn caps are the binding constraint — 4 of 4 stages capped, fourth consecutive run.**

| Stage | Outcome | Turns | Cost | API time |
|---|---|---|---|---|
| s1 api-test | MAX_TURNS | 51 / 50 | $4.87 | 9.9 min |
| s2 frontend-test | MAX_TURNS | 81 / 80 | $8.82 | 15.1 min |
| s3 ui-audit | MAX_TURNS | 61 / 60 | $6.59 | 10.9 min |
| s4 verify | MAX_TURNS | 41 / 40 | $3.56 | 5.8 min |
| **s1–s4** | **4 of 4 capped** | | **$23.83** | **41.7 min** |

Spend is up 19% on Run 71 ($19.95) for a comparable finding count.

**6. Work stranded at the cap boundary — third consecutive run.** s4 ended with five files of
verified-but-uncommitted fixes in the working tree. In Runs 70 and 71 a downstream stage
adopted the stranded work; this run it reached the **final** stage, so this report's stage
adopted it as `aca103e` after independently re-verifying it (live API check plus a build). Had
the pipeline ended one stage earlier, that work would have been lost. This is now a structural
property of the pipeline, not an incident.

**7. Results files were not written — fourth consecutive run, and the most misleading yet.**
None of `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt` or
`/tmp/ui-audit-results.txt` exists; a filesystem-wide search for any results file written
today returned nothing. What *is* in `/tmp` is **five files named `stage-1-api-test.txt`
through `stage-5-report.txt`** — every one of which is a stage's **prompt**, not its output.
Run 71 warned that one such file was there; this run has a full set, so a reader trusting
filenames would report five prompts as five results and conclude the run documented itself
perfectly. **Every finding in this report was reconstructed from commit messages, probe
scripts, and live re-verification.** Commit messages remain the pipeline's only reliable
evidence channel. *Suggested fix, unchanged from Run 71: have each stage write its results
file first and append per finding, rather than composing it at the end where the cap always
lands.*

**8. Permanently excluded** (standing project rules, not gaps): Google geocoding and all bulk
geocoding; bulk DB writes; FEMA map property loading, filtering, IndexedDB caching and
storm-swath intersection (developer-owned); mobile/375px (web-only focus).

---

## Database Hygiene

- **New rows written: 0.** Every JSONB probe used a rejection path (400s create nothing) or a GET.
- **One row was mutated and left in place — needs a cleanup decision.** `INV-0007` currently
  reads `amount_paid 603.00` (of `total 5000.00`), `payment_method 'insurance'`,
  `payment_reference 'CLAIM-QA72-XYZ'`, `status 'sent'`. The reference string and **$3.00 of the
  amount paid** are QA probe artifacts from verifying `629e073`, not real payments. This is
  deliberate and disclosed rather than silently reverted, because the values are the live proof
  that the fix works — but it is test data in a real invoice and should be cleared before the
  tenant's books are trusted.
- **`work_orders`: 2 rows still hold `[null]` in `line_items`, left in the DB deliberately**, so
  the new `86eb187` guard stays exercised against real data rather than only against fuzzing.
  Matches the `EST-082`/`EST-083` precedent from Runs 70–71, which remain in place.
- Migration `049_invoice_payment_method.sql` is additive and nullable (two TEXT columns) —
  applied and verified by round-trip.

---

## Verification

- Final build: `npx vite build` → **exit 0, 8.01s**.
- Live re-verification this stage: `GET /api/crm/dashboard/days-in-stage` → 200 with
  `{"stage":"inspected","label":"Inspected"}` (was "Inspection"), and Estimate Sent / Appt Set /
  New / Contacted all matching the app-wide vocabulary.
- Server freshness confirmed by mtime-vs-boot, not commit time (Run 70's lesson): API PID 27968
  booted 05:52:16, `crm.js` mtime 05:51:43 — so the running process includes the adopted change.
- `⚡` re-confirmed present in 5 slots (carried, not silently dropped from the ledger).
- JSONB column count re-counted directly against `information_schema` to reconcile the 27-vs-29
  discrepancy between this run's and Run 71's reports.
- Drift baseline for Run 73: **`aca103e`**.
