# StormLeads — Overnight QA Report

**Date:** 2026-09-06 · **Run 127** · **Branch:** `feat/financing`
**Baseline:** `4851b86` (`overnight-checkpoint-20260906`) → **HEAD:** `0b3838a`
**Stages:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report

> **Run-number note:** the off-by-one that split the last two runs did **not** recur.
> All stages labelled tonight *Run 127* and named harnesses `.qa-r127-*` consistently.
> Resynchronisation held.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Commits landed | **7** (all fixes; 0 reverts) |
| Distinct defects found | **21** |
| Distinct defects fixed | **21** (100% of found) |
| — of which security / tenant-isolation | **14** |
| Security defects **still open** after tonight | **3 create + 5 update paths** (Known Issues #1, #3) |
| API endpoints exercised | **13 of 272** (4.8%) — the tenant-isolation sweep + 2 date probes |
| Route inventory (denominator) | **272 endpoints / 37 route files** |
| Pages tested | **Not measurable — see Coverage Gaps.** 4 surfaces evidenced from commits |
| Routed-page inventory (denominator) | **30 `<Route>` entries / 44 components** |
| UI inconsistencies found / fixed | **0 / 0 — the 7 audit categories were not measured** |
| Client build | **PASS — 7.82s** (re-run in s5, exit 0) |
| DB net change | **Zero** (after s5 cleanup — see Known Issues #5) |

### Stage outcomes — from each stage's JSON `stop_reason`, not its self-assessment

| Stage | Turns | Terminal reason | Results artifact | Commits |
|---|---|---|---|---|
| s1 api-test | 51/50 | `max_turns` | **header stub only** | 2 (+1 edit left uncommitted) |
| s2 frontend-test | 81/80 | `max_turns` | **none written** | 3 (1 recovered from s1) |
| s3 ui-audit | 61/60 | `max_turns` | **none written** | 2 |
| s4 verify | 41/40 | `max_turns` | **none — no verdict** | 0 |
| s5 report | — | (this stage) | this file | 1 |

**All four working stages capped for the second consecutive night.** No stage reached its
own conclusion. Everything below is derived from the commits and from direct re-verification
performed in s5, not from stage self-reports.

> ⚠️ **The stale-artifact trap fired again (3 runs, 3 hits).** `/tmp/frontend-test-results.txt`
> and `/tmp/ui-audit-results.txt` are **2026-09-04 files, two days old**. `/tmp/api-test-results.txt`
> is tonight's but contains only a header and a to-do list — no results were ever appended.
> Reading any of the three as tonight's output would have fabricated two entire report sections.

---

## Backend API Test Results

Two of the three s1 charter items completed. The third — the full endpoint sweep — never started.

### Tenant isolation / cross-tenant PII (`leads` join family) — 9 defects, all fixed

Run 126 fixed six instances of this family and predicted eight more joins of the same shape.
**All eight were still live.** Proved exploitable rather than inferred: a lead was planted in
tenant `dbeb300e` and attacked as tenant `791bb51d`. Before: **6 of 6 attacks succeeded.**
After: **0 of 7.**

| Location | Leaked columns | Result |
|---|---|---|
| `routes/crm.js:1069` calendar tasks | `contact_name`, `address` | fixed |
| `routes/crm.js:1081` calendar activities | `contact_name`, `address` | fixed |
| `crmService.js:730` getRecentActivity | `contact_name`, `address`, `stage` | fixed |
| `dashboardService.js:111` getActivity | `contact_name`, `address` | fixed |
| `documentService.js:26` listDocuments | `address` | fixed |
| `searchService.js:21` contact search | `address` | fixed |
| `dripService.js:211` getEnrollments | `contact_name`, `contact_email`, `address` | fixed by inspection |
| `emailService.js:160` overdue reminders | `contact_name`, `contact_email` | fixed by inspection |

Plus the **write boundary**: `logActivity()` took `lead_id` straight from the request body with
no ownership check, so `POST /api/crm/activities` accepted another tenant's lead (201) and stored
the dangling reference. Now guarded.

`emailService.js:160` was the worst-consequence instance and is not request-reachable — it is the
9am overdue-invoice cron, where a foreign `lead_id` mails **the wrong tenant's customer**.

Each join is now scoped to the owning row's tenant (`AND l.tenant_id = <alias>.tenant_id`) rather
than to a literal, so the predicate holds for every caller. — `83ba6b4`

**Independently re-verified in s5: all 30 `leads` joins in `server/src` now carry a tenant
predicate. Zero unscoped. The READ side of this family — Run 126's "highest-priority item in the
repo" — is CLOSED.** The write side is not; see Known Issues #1 and #3.

`server/src/utils/assertOwned.js`, left orphaned by Run 126 (imported by nothing, with a
byte-identical private copy in `crmService`), was wired up as the shared guard and the duplicate
removed. **s5 confirms it is genuinely live: 6 importers, 13 call sites.**

### Write-boundary guards on create endpoints — 5 defects fixed, 3 more found open in s5

Run 126 predicted these five were still open. All five were, and all five are proven:

| Endpoint | Unguarded fields | Before | After |
|---|---|---|---|
| `POST /api/crm/contracts` | `lead_id`, `estimate_id` | 201, foreign ref stored | 400 `lead_id not found` |
| `POST /api/crm/invoices` | `lead_id`, `estimate_id` | 201 | 400 |
| `POST /api/crm/expenses` | `lead_id` | 201 | 400 |
| `POST /api/crm/work-orders` | `lead_id`, `estimate_id`, `assigned_to` | 201 | 400 |
| `POST /api/estimates` | `lead_id` | 201 | 400 |

Guarded in the **service** rather than the route, so the check sits on the same side of the
boundary as the INSERT and covers every caller.

**Regression tested, not just attack tested:** all 5 still return 201 for a lead the caller owns
(with a real `estimate_id` and `assigned_to`), and `POST /crm/expenses` with no `lead_id` at all
still returns 201, since these columns are nullable and `assertOwned` passes absent values through.
DB net zero; lead count unchanged at 13. — `96f7ad2`

> ⚠️ **This fix is incomplete, and the incompleteness was found in s5, not by the stage that made
> it.** `96f7ad2` treated Run 126's list of five as the full set of create paths. It is not:
> `POST /api/documents`, `POST /api/crm/drip-sequences/:id/enroll` and
> `POST /api/financing/applications` take a client-supplied `lead_id` to an INSERT with no guard.
> **Known Issues #3** — first item for Run 128.

### Error-message hygiene — 1 defect, fixed

`22007` (invalid_datetime_format) and `22008` (datetime_field_overflow) were the only two branches
left in the `errorHandler` `PG_BAD_INPUT_CODES` chain returning Postgres' own message text, which
names the internal column type:

```
POST /api/crm/tasks {"due_date":"notadate"}
  -> 400 invalid input syntax for type timestamp with time zone: "notadate"
POST /api/crm/tasks {"due_date":"9999999-01-01"}
  -> 400 timestamp out of range: "9999999-01-01"
```

Unlike the four codes already sanitised, this one is reachable from ordinary input — any bad date
on `/crm/calendar` or a task's `due_date`. Both probes verified live before the fix. — `9ddc61b`

> This edit was left **uncommitted** when s1 capped, and was recovered and committed by s2.
> This is the same failure mode that, on 2026-09-03, let a half-applied edit get swept into a
> checkpoint and ship a dead panel. Handled correctly this time.

### Endpoint coverage

**13 of 272 endpoints (4.8%)** were exercised: 6 read paths, `POST /crm/activities`, the 5 create
endpoints, and `POST /crm/tasks`. The remaining **259 endpoints were not touched tonight.**
The s1 third priority — "full endpoint sweep" — never began.

---

## Frontend Feature Test Results

s2 wrote no results artifact, so page-level coverage is **unmeasured**. The following four
surfaces are evidenced by the commits themselves. All were proved with **zero DB writes**, using
stubbed GET responses — the house standard adopted after Run 126.

### `/calendar` — CalendarView · **BROKEN → FIXED**

`tasks.priority` is the `lead_priority` enum (`hot|warm|cold`), and the app deliberately presents
it under two vocabularies depending on the **entity**: tasks read High/Medium/Low
(`TasksView.jsx:16`, `Dashboard.jsx:77`), leads read Hot/Warm/Cold (`LeadList.jsx:41`,
`Pipeline.jsx:111`, `CreateLeadModal.jsx:8`).

CalendarView was the only surface using the **lead** vocabulary for **tasks**, and disagreed with
itself in two places:

1. `:141` rendered the raw column value, so a task badge read `HOT` on `/calendar` while the exact
   same task read `HIGH` on `/tasks` and on the dashboard.
2. `:28` `priorityOptions` offered Hot/Warm/Cold in `CalendarCreateModal` — which calls
   `createTask()`, so it is unambiguously a task form. A user picking "Hot" got a task the rest of
   the app labels "HIGH".

Proved live with the same three stubbed tasks rendered through both views. Stored enum values are
untouched, and the `calendar-event-content__priority--hot|warm|cold` CSS modifiers stay keyed on the
raw enum — that is the Run 80 fix and is verified still applying the right colour. — `c7257b7`

### `/leads/:id` — LeadDetail activity timeline · **BROKEN → FIXED**

`LeadDetail.jsx:1357` falls back to the type when an activity has no subject. `activities.type` is
a Postgres enum whose domain is `call, email, text, door_knock, note, status_change,
task_completed, system` — three values carry an underscore.

The fallback is reachable, not theoretical: `crmService.js:325` stores `subject || null`, and the
Log Activity modal leaves subject optional. Users saw **"door_knock logged"**, **"status_change
logged"** and **"task_completed logged"** — raw database values — in the timeline.

Fixed with a label map reusing the vocabulary the app already had (`CalendarView.jsx:14`
`typeLabels`), extended to the four values CalendarView does not render. Verified by stubbing one
subject-less activity of every enum type: all 8 render correctly, **0 strings containing an
underscore**. — `39dee53`

### `/status/:token` — ClientStatusPage (customer-facing) · **3 DEFECTS → FIXED**

1. `STAGE_LABELS` keyed a milestone on `completed`, which is a **work order** status, not a
   `lead_stage` value. The "Job Complete" step could never be reached, so **every customer's
   timeline sat permanently one step short of the end.**
2. `lost` and `on_hold` are real stages but off the customer-facing pipeline, so
   `STAGE_ORDER.indexOf(currentStage)` returned `-1` and every step evaluated false. **A lead that
   reached Contract Signed then went on hold showed the customer a timeline claiming nothing had
   happened at all.**
3. Stage-history dates never rendered. The endpoint (`routes/leads.js:55`) selects
   `subject, notes, created_at` and has never sent a `description`, but the client read
   `entry.description?.match(...)` — permanently empty. Even once fed real text, the `(\w+)`
   capture stopped at the first word ("Appt Set" → "appt", matching no stage key) and the
   `changed to` anchor missed the dominant "Status changed from X to Y" form entirely.

Verified with a stubbed response: `on_hold` renders **7 completed milestones where it previously
rendered 0**, all **5 history dates appear where 0 did**, and **10/10 real seeded subject forms**
map to a valid `lead_stage`. — `09fa4b5`

### `/contract/:token` — PublicContract (customer-facing) · **BROKEN → FIXED**

`PublicContract.jsx:122` gated the entire "Prepared For" block on `contract.customer_name`. A
contract row **has no `customer_*` columns** — that is the *estimate* idiom. `getContractByToken`
returns `contact_name`, `address`, `contact_phone`, `contact_email` from the joined lead. All four
reads were `undefined`, the `&&` guard failed silently, and **the customer opened their own
contract with no indication of who it was for.**

Verified against the live endpoint response keys — no `customer_*` at all. Now reads the joined
lead columns with the content JSONB and `signer_name` as fallbacks. — `0b3838a`

### Still needs attention

- **26 of 30 routed pages were not exercised tonight.**
- The customer-facing surfaces (`/status/:token`, `/contract/:token`) had **four defects between
  them in a single night**, all user-visible, all on pages a paying customer sees. This area is
  under-tested relative to its risk.

---

## UI Consistency Audit Results

> **⚠️ Not measured. Reporting "pass" here would be fabrication.**

s3 capped at 61/60 turns and wrote no artifact. Both of its commits (`09fa4b5`, `0b3838a`) are
**content/logic defects**, not consistency findings. The `/tmp/ui-audit-results.txt` on disk is a
**2026-09-04 file** and describes a different run.

| Category | Status | Notes |
|---|---|---|
| Icons — non-Heroicon icons | **UNMEASURED** | 2nd consecutive night |
| Buttons — sizing/styling | **UNMEASURED** | 2nd consecutive night |
| Toolbars / headers | **UNMEASURED** | 2nd consecutive night |
| Sidebar / nav | **UNMEASURED** | 2nd consecutive night |
| Forms — non-standard elements | **UNMEASURED** | 2nd consecutive night |
| Spacing / alignment | **UNMEASURED** | 2nd consecutive night |
| Modals — consistency | **UNMEASURED** | 2nd consecutive night |

**0 UI inconsistencies found, 0 fixed** — because the audit did not run, not because the UI is clean.

Carried forward from Run 126 and still unaddressed: **nine** `ToggleSwitch` implementations exist
(a prior run recorded four; the three it missed were the off-standard ones). Re-derive populations
rather than trusting any prior count.

---

## Bugs Fixed

**Security / tenant isolation (14)**

1. `GET /api/crm/calendar` (tasks) — unscoped `leads` join leaked another tenant's customer name + street address — added `AND l.tenant_id = t.tenant_id` (`83ba6b4`)
2. `GET /api/crm/calendar` (activities) — same, via `a.tenant_id` — scoped join (`83ba6b4`)
3. `crmService.getRecentActivity` — leaked customer name, address, stage — scoped join (`83ba6b4`)
4. `dashboardService.getActivity` — leaked customer name + address — scoped join (`83ba6b4`)
5. `documentService.listDocuments` — leaked street address — scoped join (`83ba6b4`)
6. `searchService` contact search — leaked street address — scoped join (`83ba6b4`)
7. `dripService.getEnrollments` — leaked name, email, address — scoped join (`83ba6b4`)
8. `emailService` overdue reminders (9am cron) — **would email the wrong tenant's customer** — scoped join (`83ba6b4`)
9. `POST /api/crm/activities` — `logActivity()` stored any tenant's `lead_id` unchecked — `assertOwned()` guard (`83ba6b4`)
10. `POST /api/crm/contracts` — stored foreign `lead_id` / `estimate_id` — `assertOwned()` in service (`96f7ad2`)
11. `POST /api/crm/invoices` — stored foreign `lead_id` / `estimate_id` — `assertOwned()` (`96f7ad2`)
12. `POST /api/crm/expenses` — stored foreign `lead_id` — `assertOwned()` (`96f7ad2`)
13. `POST /api/crm/work-orders` — stored foreign `lead_id` / `estimate_id` / `assigned_to` — `assertOwned()` (`96f7ad2`)
14. `POST /api/estimates` — stored foreign `lead_id` — `assertOwned()` (`96f7ad2`)

**API correctness (1)**

15. `errorHandler` (all date-taking endpoints) — SQLSTATE 22007/22008 echoed the internal column type ("timestamp with time zone") to the caller — mapped both to a generic message (`9ddc61b`)

**Frontend (6)**

16. `/calendar` — task priority rendered in the **lead** vocabulary (`HOT`) while `/tasks` and the dashboard showed `HIGH` for the same task; the Create Task modal also offered Hot/Warm/Cold on a form that calls `createTask()` — both switched to the task vocabulary (`c7257b7`)
17. `/leads/:id` — timeline printed raw enum values: "door_knock logged", "status_change logged", "task_completed logged" — added a full-enum label map (`39dee53`)
18. `/status/:token` — "Job Complete" milestone keyed on `completed`, a work-order status not in `lead_stage`, so every customer timeline stopped one step short — removed; `in_production` is now terminal (`09fa4b5`)
19. `/status/:token` — `lost`/`on_hold` returned `indexOf === -1`, showing customers a timeline claiming nothing had happened — `currentIdx` falls back to the furthest stage reached (`09fa4b5`)
20. `/status/:token` — stage-history dates never rendered: client read a `description` field the endpoint never sends, and the regex captured one word — now reads `subject`, anchors on the last `" to "` (`09fa4b5`)
21. `/contract/:token` — "Prepared For" block gated on `customer_name`, a column contracts do not have, so customers saw no indication who the contract was for — reads the joined lead columns (`0b3838a`)

---

## Known Issues (Not Fixed)

1. 🔴 **Five UPDATE paths still accept client-supplied FKs with no ownership guard.** *(Newly
   identified in s5.)* The `96f7ad2` fix guarded only the **create** paths. `updateContract`
   (`contractService.js:116`), `updateInvoice` (`invoiceService.js:117`), `updateExpense`
   (`expenseService.js:64`), `updateWorkOrder` (`workOrderService.js:364`) and `updateEstimate`
   (`estimateService.js:186`) all list `lead_id` — and contracts / invoices also `estimate_id`,
   work-orders also `assigned_to` — in `allowedFields` with no `assertOwned()` call. A foreign
   reference can still be **attached** via PUT.
2. 🔴 **All 3 `estimates` joins are unscoped**, which makes the above reachable: `getContract`
   (`contractService.js:52`) selects `e.estimate_number, e.total`, so a contract pointed at a
   foreign `estimate_id` via PUT would disclose **another tenant's estimate number and dollar
   total**. Also `payments.js:263`, `financing/index.js:336`. Static finding — **not empirically
   attacked**, because s4 capped before verifying anything.
3. 🔴 **Three CREATE paths were missed by tonight's own write-boundary fix and are still
   unguarded.** *(Newly identified in s5 — this corrects an earlier draft of this report, which
   called create-path reachability closed.)* `96f7ad2` enumerated the create paths as five and
   fixed those five; it did not sweep for the rest. All three below take a **client-supplied**
   `lead_id` and reach an INSERT with no `assertOwned()`:

   | Route | Service | Client-supplied FK |
   |---|---|---|
   | `POST /api/documents` (`documents.js:98`) | `createDocument` (`documentService.js:57`) | `lead_id: req.body.lead_id` |
   | `POST /api/crm/drip-sequences/:id/enroll` (`drip.js:117`) | `enrollLead` (`dripService.js:177`) | `const { leadId } = req.body` |
   | `POST /api/financing/applications` (`financing.js:157`) | `createApplication` (`financing/index.js:216`) | `{ ...req.body }` → `lead_id`, `estimate_id` |

   `financing/index.js:216` is the worst of the three: it writes `customer_name` and
   `customer_email` alongside a foreign `lead_id`, and `financing/index.js:291` then writes an
   `activities` row against that same `lead_id`. Note the adjacent `plan_id` **is** correctly
   scoped (`financing/index.js:195` selects it `WHERE fp.tenant_id = $1`), which shows the guard
   was understood at this call site and simply not applied to `lead_id`/`estimate_id`.
   **This is the same class as the five fixed in `96f7ad2` and should be the first item of Run
   128** — the fix is mechanical (`assertOwned` is already exported and live in 6 services).
   Static finding: route→service→INSERT traced by reading, **not attacked live.**
4. 🟡 **19 of 23 `users` joins are unscoped** (employee name / email, not customer PII). Lower
   severity. Static candidates — triage empirically before filing as bugs; the Run 126
   set of 62 static candidates largely triaged out.
5. 🟡 **s4 rotated a live customer status token and could not revert it.** Its setup script
   planted fixtures and referenced a `.qa-r127-s4-teardown.mjs` it never got to write. s5 removed
   the 3 genuinely-inserted rows (2 activities, 1 task) and restored **DB net zero**. But the
   `client_status_tokens` insert used `ON CONFLICT (lead_id) DO UPDATE SET token`, which hit a
   **pre-existing row** (created 2026-07-30; row count unchanged at 4) and overwrote its token.
   The row was deliberately **not** deleted — that would destroy live data. **Any status link
   previously sent to the customer on lead `dc8135aa` is now dead and must be re-issued.**
6. 🔴 **No independent verification of tonight's 7 commits.** s4 capped with no verdict for the
   **fourth consecutive night**. Every fix above rests on its own stage's evidence plus the s5
   re-checks listed below.
7. **No ESLint** in the repo. Decision pending for four runs.
8. **No React error boundary** — any render throw blanks the whole app.
9. **64 generic error toasts** ("Something went wrong") with no actionable detail.
10. **361 QA screenshots** accumulated in the working tree.
11. **`C:/tmp/qa-token.txt` stale since 2026-07-27** — the s4 harnesses depend on it; refresh as a
    stage-0 step.

---

## Test Coverage Gaps

1. **Frontend page coverage is unmeasured.** s2 wrote no artifact. 4 of 30 routed pages are
   evidenced by commits; the other 26 have no recorded result either way.
2. **All 7 UI-consistency categories are unmeasured, for the second consecutive night.** s3 spent
   its full budget on two content defects and wrote no artifact.
3. **Endpoint sweep never started.** 13 of 272 endpoints (4.8%) exercised; the s1 third priority
   was not begun.
4. **No verification stage output** (see Known Issues #6).
5. **Root cause of 1–4 is structural, not incidental: all four working stages exhausted their turn
   budgets (51/50, 81/80, 61/60, 41/40).** This is a two-night pattern and is now costing more
   coverage than any defect found. Two mitigations, in order of value:
   - **Raise the budgets or narrow the charters.** The charters are wider than 40–80 turns allow.
   - **Write the results artifact on turn 1, not the last turn.** Instructed three runs running,
     ignored three runs running. s1 wrote its header first and was partially reportable; s2, s3
     and s4 wrote nothing and are not. A capped stage that wrote early still reports; a capped
     stage that saved it for last loses everything.
6. **Not tested by policy:** `/storm-map` address search (Google Places + Geocoder, billable per
   keystroke) remains a standing exclusion.

---

## Verification Performed in s5

Because no stage reached a verdict, s5 re-verified the load-bearing claims directly:

- ✅ **All 30 `leads` joins in `server/src` carry a tenant predicate** — 0 unscoped. The **read**
  side of this family is closed.
- ❌ **The `write` side is NOT closed.** Sweeping every service that references `lead_id` against
  its `assertOwned` count surfaced **three route-reachable create paths tonight's own fix missed**
  (Known Issues #3). The draft of this report called create-path reachability closed; that claim
  was wrong and has been corrected. **This is the third consecutive run in which a prior run's
  enumeration was treated as a closed set and was not** — Run 126 predicted 8 joins (all real, but
  the set was bigger), Run 126-s3 recorded 4 ToggleSwitches where there were 9, and tonight's
  `96f7ad2` enumerated 5 create paths where there are 8.
- ✅ **`assertOwned.js` is genuinely wired in** — 6 importers, 13 call sites, no duplicate private
  copy. (Run 126 left it orphaned; that trap is closed.) It is now available to fix #3 mechanically.
- ✅ **No QA harness is referenced by application code** — the 12 untracked `.qa-*.mjs` files are
  standalone; nothing in `server/src`, `client/src` or any `package.json` imports them.
- ✅ **Working tree clean** — no half-applied edits from the four capped stages, unlike 2026-09-03.
- ✅ **Client build PASS — 7.82s**, exit code 0 (re-run in s5, not inherited from a stage).
- ✅ **DB net zero** — the s4 orphaned fixtures removed; baseline `{tasks:0, acts:2, toks:4}`
  restored; 0 `QA-R127`-named leftovers; lead count 13.
- ⚠️ Known Issues #1–#4 are **static findings from the s5 sweep and were not attacked live.**

---

*Report generated by s5-report, Run 127, 2026-09-06.*
