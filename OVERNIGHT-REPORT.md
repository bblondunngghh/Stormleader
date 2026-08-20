# StormLeads — Overnight QA Report

**Run 82 — 2026-08-19**
Baseline: `835ac57` (checkpoint: pre-overnight-run 2026-08-19) → HEAD `4ae1238`
Branch: `feat/financing` · Build: **PASS** (`vite build` exit 0, 7.97 s)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend routes driven in a browser | 16 (+ 4 modals, + 2 builder flows end-to-end) |
| API route patterns inventoried | 272 (36 route files) |
| API endpoint patterns tested | 124 GET patterns / **162 total calls** |
| API 5xx responses | **0** |
| Bugs found | **5** |
| Bugs fixed | **2** (covering 13 individual field/endpoint failures) |
| Bugs found but not fixed | **3** (all newly confirmed tonight, see Known Issues) |
| UI inconsistencies found | **0 new** |
| UI inconsistencies fixed | 0 (none outstanding to fix) |
| DB hygiene | QA fuzz cleanup **completed** after being deferred 11 stages |

Stage outcomes: s3 (ui-audit) completed cleanly. **s1 (51/50), s2 (81/80) and s4 (41/40) all hit
`error_max_turns`.** Their work was recovered from the working tree, the DB, and their scratch
artifacts; see *Test Coverage Gaps*.

---

## Backend API Test Results

Sweep method: every GET route pattern called with real IDs where resolvable (pass 1), then
re-called with valid query parameters so the handler body actually executes (pass 2) — a 400 in
pass 1 proves validation fired, not that the handler works.

**Aggregate:** 162 calls — `200`:127, `404`:12 (absent/dead ID, expected), `400`:10 (validation,
expected), `403`:5 (platform-admin-only, expected), `SKIP`:8. **Zero 5xx. Zero failures.**

| Category | Patterns tested | Passed | Failed |
|---|---|---|---|
| Auth / session (`/api/auth/*`) | 1 | 1 | 0 |
| Platform admin (`/api/admin/*`) | 5 | 5 (403 as designed) | 0 |
| CRM dashboard (`/api/crm/dashboard/*`) | 15 | 15 | 0 |
| CRM reports (`/api/crm/reports/*`) | 6 | 6 | 0 |
| Legacy dashboard (`/api/dashboard/*`) | 3 | 3 | 0 |
| CRM leads, pipeline, tasks, calendar, team, settings | 10 | 10 | 0 |
| Legacy leads (`/api/leads/*`) | 3 | 3 | 0 |
| Estimates | 5 | 5 | 0 |
| Contracts | 5 | 5 | 0 |
| Invoices | 2 | 2 | 0 |
| Work orders | 5 | 5 | 0 |
| Subcontractors | 3 | 3 | 0 |
| Expenses | 2 | 2 | 0 |
| Financing | 6 | 6 | 0 |
| Automations & drip sequences | 4 | 4 | 0 |
| Territories, canvass pins, prospect lists | 7 | 7 | 0 |
| Properties | 8 | 8 | 0 |
| Map | 3 | 3 | 0 |
| Storms, storm history, drift, declarations, counties | 8 | 8 | 0 |
| Materials | 6 | 6 | 0 |
| Roof measurement | 5 | 5 | 0 |
| Notifications | 3 | 3 | 0 |
| Payments | 2 | 2 | 0 |
| Documents, search, onboarding, data, alerts | 7 | 7 | 0 |
| **Total** | **124** | **124** | **0** |

8 patterns were **skipped by charter**, not by failure: `/api/skip-trace/*` (6),
`/api/properties/import-progress`, `/api/properties/reverse-geocode` — import, geocode and
skip-trace are prohibited because they cost money.

Slowest handlers observed (all successful): `/api/storm-history/heatmap` 10.7 s,
`/api/storm-history` 1.27 s, `/api/data/directions` 625 ms.

### What was fixed on the backend

| Commit | Fix |
|---|---|
| `6c21288` | `estimateService.updateEstimate` silently dropped 9 estimate-builder fields; migration `050_estimate_builder_fields.sql` adds the columns and the whitelist now accepts them. |
| `8a5fd0d` | `POST /api/crm/contracts` read camelCase body keys while its only caller sends snake_case — every contract "Save Draft" 400'd. Now accepts both. |

**No backend defect was found by the HTTP status sweep.** Both fixes — and all three open
findings below — came from *set differences over source*: comparing what the client sends
against what the server whitelists, and comparing literal values in the code against the enum
labels the database will actually accept. This is the 7th consecutive run where the night's
finding came from that technique rather than from inspecting responses.

---

## Frontend Feature Test Results

| Page | What was tested | Result |
|---|---|---|
| `/estimates` | Estimate builder full round trip: type Estimate Name, set Profit Margin 67, Save Draft, reload, reopen | **BROKEN → FIXED** (`6c21288`) — see Bug 1 |
| `/contracts` | Contract builder: create from lead, Save Draft, reopen, template selection | **BROKEN → FIXED** (`8a5fd0d`) — see Bug 2 |
| `/` (dashboard) | Render, topbar, nav, panel geometry, console errors | PASS |
| `/pipeline` | Render, stage columns, active nav state | PASS |
| `/leads` | Render, list columns, filters | PASS |
| `/tasks` | Render + modal open/close | PASS (Esc-to-close does not work — known) |
| `/calendar` | Render, event badges | PASS |
| `/invoices` | Render, list, action buttons | PASS |
| `/work-orders` | Render + modal | PASS (2 cosmetic deltas — known) |
| `/expenses` | Render + modal | PASS (label casing + heading level — known) |
| `/subcontractors` | Render + modal | PASS |
| `/reports` | Render, recharts surfaces | PASS |
| `/materials` | Render | PASS |
| `/canvassing` | Render | PASS |
| `/storm-catalog` | Render | PASS |
| `/alerts` | Render | PASS (no active nav link — known orphan route) |
| `/settings` | Render | PASS |

Sixteen routes were driven through four batched Playwright sweeps (16 routes aggregated per
call) plus four opened modals. Zero page errors and zero failed requests were observed.

**Still needs attention:** `/estimates` and `/contracts` were each fixed and verified once, by
the stage that found them. Neither has yet been re-verified in a browser by an independent
stage — s4, which exists to do exactly that, ran out of turns. Both fixes are confirmed at the
schema and source level (all 9 columns present on `estimates`; `contracts` confirmed to have no
`customer_*` columns, validating the fix's approach), but an independent UI re-verification is
outstanding.

---

## UI Consistency Audit Results

All seven prescribed audits ran against 16 routes and 4 modals. **Result: 7/7 PASS, zero new
visual defects.** Full detail in `docs/ui-audit-2026-08-19.md` (`4ae1238`).

| Audit | Finding | Fixed? |
|---|---|---|
| **Icons** | 43/43 imports are `@heroicons/react/24/outline`. **Zero** solid variants, zero foreign libraries, zero `fa-*`. The only non-Heroicon `<svg>` are 6 `recharts-surface` elements on `/reports` (data-viz, not icons). The 5 SVGs measuring 0×0 on every route are the mobile-only `bottom-tab-bar` (`display:none` on desktop). | n/a — nothing to fix |
| **Buttons** | `.auth-btn` is byte-identical on 9/9 primary create buttons (36 px / `0 24px` / 13 px / `14px / 12px` / weight 700). `.quick-action-btn` = 53 base uses + 8 variants; **every** variant resolves to an active/inactive state or a semantic colour (Delete/Void red, PDF purple, Send blue). | n/a — no inconsistency |
| **Toolbars / Headers** | `.topbar.glass` measures **56 px on 16/16 routes**; `<h1>` present on 16/16. | n/a — consistent |
| **Sidebar / Nav** | `.nav-link` uniform at 42 px / `12px 16px` / 13.5 px / radius 12 px; child links 42 px with 28 px indent; exactly one `.is-active` per route. | n/a — consistent |
| **Forms** | **Zero native `<select>` and zero native `<input type="date">`** across 16 routes and 4 modals — `CustomSelect` and `DatePicker` are used everywhere, as required. `.form-input` is 36 px / radius 12 px everywhere except the 2 documented compact cases. | n/a — compliant |
| **Spacing** | Gaps between `.glass` siblings: 12 px (11 instances) / 16 px (9) + 4 contextual one-offs. | No — contextual, deliberate |
| **Modals** | All 4 opened modals carry `modal-scale-in`; backdrop blur varies 8 / 4 / none per the documented per-context pattern. | n/a — consistent |

### Source-level set differences run this run (all three now CLOSED)

1. **JSX props passed vs props the component destructures** — 194 components, 83 with usages.
   4 hits, all killed: `Panel` and `ToggleSwitch` are same-name collisions across files;
   `SmsComposer` really is passed 5 props it never reads, but only ever needed `name` (dead
   arguments, not a defect).
2. **Form-bound `useState` vars never read outside their own `value={}` binding** — 93 bound
   vars across 76 files. 1 hit, killed: `AddressSearch.jsx`'s `query` is display-only.
3. **Client payload keys vs the server's `allowedFields` whitelist, extended to every remaining
   entity** — subcontractors, expenses, tasks, invoices, work orders, leads and tenant-settings
   **all match exactly**. Contracts was the one real hit, fixed in `8a5fd0d`.

**The prescribed UI audits have converged.** For five consecutive runs, every geometric or
colour outlier has resolved to an active/inactive state, a documented deliberate variant, or an
entry already on the known-issues list. The defects still living in this app are **behavioural**
— a control that renders perfectly and does nothing — not visual.

---

## Bugs Fixed

1. **`/estimates` (estimate builder) — nine fields were silently never saved.**
   The builder has full UI, state and hydration code for Estimate Name, Estimate Date,
   Introduction, Inspection Notes, Footer Notes, Profit Margin, Discounts, Signers and Deposit,
   and sent all nine in every Save Draft / Save & Send / autosave payload. None of them had a
   column on `estimates`, so `estimateService.updateEstimate`'s `allowedFields` whitelist
   dropped every one. The PATCH returned **200**, the UI showed "Estimate saved", and nothing
   was written — reopening reset all nine controls to defaults, making the hydration code at
   `EstimatesView.jsx:1324-1367` dead code.
   *Fixed* by migration `050_estimate_builder_fields.sql` (mirrors 048, which added the panels
   sitting directly beside these) plus the whitelist entries; `''` is coerced to `NULL` for the
   date and numeric columns. `createEstimate` takes them too, so a new estimate doesn't lose
   them on first save. Reproduced and re-verified end-to-end in the browser. — `6c21288`

2. **`/contracts` (contract builder) — saved nothing and always reloaded blank.** Four defects
   on one path:
   - `POST /api/crm/contracts` destructured `leadId`/`templateType` while its only caller,
     `ContractsView`, sends snake_case → **every "Save Draft" 400'd** with `lead_id is required`
     while a valid `lead_id` sat in the body. Both spellings now accepted.
   - The payload sent `customer_name/email/phone/address` at the top level, but `contracts` has
     no `customer_*` columns and the whitelist is `lead_id/estimate_id/template_type/content`
     → all four silently discarded. They now ride inside `content`.
   - Edit-hydration read those same absent columns → reopening a contract always showed empty
     customer fields. Now reads `content.*` with joined `contact_name`/`address` as fallback.
   - The template picker read `contract.template_id`; a contract records `template_type`, so
     the picker always showed the first template and **every save filed as `standard`**.
   *Note:* this fix was written by the s2 stage, which hit `max_turns` before committing it. It
   was found sitting in the working tree by s3, verified against `contractService.js`, and
   committed rather than lost. — `8a5fd0d`

---

## Known Issues (Not Fixed)

### Newly confirmed tonight — three live defects, all unfixed

These were found by s1 in its final turns, proven with rolled-back probes against the live
database, and never written up because the stage hit `max_turns`. They were recovered from its
scratch scripts and **independently re-confirmed during this reporting stage**. All three are
the same root cause as last night's `5329a7e`: **a vocabulary written into an enum column that
the enum does not contain.**

Actual enum labels (from the live DB):
- `activity_type` = `call | email | text | door_knock | note | status_change | task_completed | system`
- `notification_type` = `lead_assigned | lead_status_changed | task_due_soon | task_overdue | estimate_viewed | estimate_accepted | estimate_declined | storm_alert | new_storm_leads | mention`

1. **Every automation "notify" action fails silently.** `automationEngine.js:115-116` inserts
   `type = 'automation'` into `notifications` → `22P02 invalid input value for enum
   notification_type: "automation"`. `fireTrigger()` catches and logs the error, so the user
   sees a saved, active, apparently-working automation that **never delivers a notification**.
   Impact is total, not partial — no reachable configuration avoids it.

2. **Every drip-sequence "notify" step fails, and stalls the enrollment.**
   `dripService.js:356-357` inserts `type = 'drip_sequence'` → same `22P02`. Worse than a silent
   no-op: in `processScheduledSteps`, the "advance to next step" UPDATE sits *after*
   `executeStepAction` inside the same `try` (`dripService.js:251-279`), so when the insert
   throws, the enrollment is never advanced and `next_run_at` is never moved. **The enrollment
   is retried on every scheduler tick forever and the sequence never progresses past a notify
   step.**

3. **Every financing webhook fails after mutating the database.**
   `services/financing/index.js:291-292` runs
   `INSERT INTO activities (tenant_id, lead_id, type, direction, notes, created_by) VALUES (…, 'financing', 'inbound', …)`.
   Two independent errors: `activities` has **no `direction` and no `created_by` column**
   (`42703`, which fires first), and `'financing'` is not an `activity_type` label (`22P02`).
   This insert is **not** inside a try/catch, and it runs *after* the
   `UPDATE financing_applications` has already committed — so an approved/funded/declined event
   updates the application status, then throws, and `hearthWebhook.js:19-22` returns **400
   "Webhook processing failed"** to the lender. The lender treats delivery as failed and
   retries, re-running the UPDATE and 400ing again, and **no financing activity is ever logged
   on the lead.**

*Not fixed because this reporting stage's charter is the report.* All three are small, local
fixes and should be the next run's first code task. The `taskPriority.js` normalizer added in
`5329a7e` is the precedent to follow.

### Carried forward (previously known, unchanged)

- `/alerts` is an orphan route — no sidebar link points to it, so it renders with zero
  `.is-active` nav links. Developer call, not a bug.
- `/expenses` modal labels are `12px/400/none` instead of the standard
  `12px/600/uppercase/0.96px`; `/work-orders` modal labels are `12px/600/none`. Backlog.
- `/expenses` modal heading is `<h3>` 16 px where every other modal uses `<h2>` 18 px —
  heading-level skip. Backlog.
- Esc-to-close works on the `/subcontractors` modal but not on `/tasks`, `/expenses` or
  `/work-orders`. Inconsistent by design; needs a decision.
- `/work-orders` "From Estimate" button (`:967`) is an inline-styled orange clone of the
  identical `/invoices` button (`:220`) and is missing its icon. Cosmetic; works.
- `MobileTaskSection` is passed Material Icons ligature names (`priority_high`, `today`,
  `calendar_month`) which it destructures and never renders, hardcoding one
  `ClipboardDocumentListIcon` and dropping `iconColor`. A real icon-rule violation, but it sits
  inside the `if (isMobile)` branch (`TasksView.jsx:102`) and **mobile is paused** — out of
  charter.
- The nightly Playwright suite's 5 failures are stale selectors, not app bugs
  (`tests/nightly-audit.spec.js`). Test debt. **Do not re-diagnose as an app bug.**

---

## Database Hygiene

**The QA fuzz cleanup — deferred eleven consecutive stages — was completed tonight by s4.**

Deleted, inside a single transaction, after writing a full backup to
`C:/tmp/qa-s4-fuzz-backup.json`: **18 leads**, 1 estimate, 2 invoices, 2 work orders,
4 activities, 2 contacts. Four junk `contract_templates` rows (`{"1","2","3"}`, `12345`,
`QA Contract Template`, `Test Template`) were removed separately.

Verified during this stage by re-running s4's own read-only matcher: **0 rows match any junk
pattern**, and `0` dependents across all 11 child tables. Tenant `waterloo` now holds 12 leads,
8 estimates, 4 contracts, 10 invoices, 6 work orders, 4 tasks; `contract_templates` holds
exactly the 4 real templates. Highest estimate number is back to `EST-082`.

This matters on the production Neon free tier, where storage is capped at 0.5 GB.

---

## Test Coverage Gaps

1. **Three of five stages hit their turn cap** — s1 (51/50), s2 (81/80), s4 (41/40). Only s3
   finished cleanly. This is the third consecutive night a capped stage has left real work
   stranded, and the pattern is now unambiguous: **stages that open with an open-ended sweep
   exhaust their budget before reaching their own deliverable steps.**

2. **s1 never wrote up its most valuable finding.** It completed and saved the full GET sweep at
   05:05, then spent its remaining turns proving the three enum defects above — and hit the cap
   before writing a single line about them. They existed only as rolled-back probe scripts in
   `server/.qa-r82-prove*.mjs`. Had `git status` and the scratch directory not been checked,
   **three confirmed production defects would have been lost.**

3. **No frontend per-page test log was produced.** `/tmp/frontend-test-results.txt` still holds
   Run 75's output (dated 2026-08-11); s2 hit its cap before writing tonight's. Page-level
   coverage in this report is reconstructed from s3's Playwright sweeps and from the two builder
   flows s2 verified before it ran out. The two capped stages' page-by-page observations are
   unrecoverable.

4. **No independent re-verification of tonight's two fixes.** That is s4's charter; s4 spent its
   budget on the DB cleanup (correctly — it was 11 stages overdue) and never reached the
   verification pass, the edge-case pass (empty states, validation, back/forward navigation) or
   the 375 px mobile-width pass.

5. **Write-path API coverage remains thin.** All 162 calls were GETs. POST/PATCH/DELETE paths
   were exercised only incidentally, through the two builder flows. **Every defect found tonight
   was on a write path** — which is precisely where the sweep does not look.

6. **8 endpoints permanently skipped by charter** — `/api/skip-trace/*` (6),
   `/api/properties/import-progress`, `/api/properties/reverse-geocode`. These cost money per
   call and will never be covered by this pipeline.

7. **Untested by charter:** FEMA map property loading, filtering, IndexedDB caching and storm
   swath intersection — under active development by the developer, changes will be reverted.

---

## Working Tree

Clean of real work. 47 untracked QA harness artifacts remain and are all safe to delete:
`server/.qa-r82-*.mjs` (26), `server/.qa-r82s2-*.mjs` (5), `server/.qa-s4-*.mjs` (16),
`.qa-s4-cols.mjs`, and 5 `claude-overnight-20260819-*.json` stage envelopes.
