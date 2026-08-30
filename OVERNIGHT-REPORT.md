# StormLeads — Overnight QA Report

**Run date:** 2026-08-30
**Baseline:** `d926e71` (tag `pre-overnight-20260830`)
**Head at report time:** `74c5107`
**Branch:** `feat/financing`

---

## ⚠️ Run integrity — read before the numbers

**Three of the four working stages terminated at `max_turns`.** This report is scoped to what
those stages actually produced, which is substantially less than a full pipeline pass. Where a
stage produced nothing, the section below says so rather than carrying an older run's numbers
forward.

| Stage | Terminal reason | Turns | Commits | Artifact written | Cost |
|---|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51 / 50 | 0 | **none** | $5.02 |
| s2 frontend-test | `completed` | 76 | 3 | `C:/tmp/frontend-test-results.txt` | $9.47 |
| s3 ui-audit | `error_max_turns` | 61 / 60 | 0 | **none** | $6.76 |
| s4 verify | `error_max_turns` | 41 / 40 | 0 | `C:/tmp/s4-verify-results.txt` (written *before* the cap) | $4.52 |
| s5 report | — | — | 1 | this file | — |

Total stage cost $25.77; 47 min API time / 58 min wall.

**Two reporting traps hit this run, both recorded so the next report stage avoids them:**

1. **The three result files this stage's prompt names are stale.** `/tmp/api-test-results.txt`
   is Run 100 (**2026-08-28**), `/tmp/ui-audit-results.txt` is Run 94 (**2026-08-25**), and
   `/tmp/frontend-test-results.txt` does not exist at that path at all. Tonight's artifacts are
   in **`C:/tmp/`**, which is *not* the same directory as `/tmp/` under the Bash tool. Reading the
   prompt-named paths literally would have reported three-to-five-day-old results as tonight's.
2. **Stage self-assessment disagrees with stage exit status.** s4 reports itself complete and its
   findings are sound, but its JSON records `error_max_turns`. Read `terminal_reason` from the
   stage JSON, not the stage's own summary.

**Run numbering is inconsistent within this night:** s2 self-numbered **Run 109**, s4 self-numbered
**Run 110**. Both ran on 2026-08-30. Numbering is per-stage, not per-night.

---

## QA Test Summary

| Metric | Count | Source |
|---|---|---|
| Routes tested | **19** | s2 (19/19 render), s4 (18/18 regression + 19/19 at 375px) |
| API endpoints tested | **198 distinct paths / 248 path+method pairs** of a 272-route inventory | s1 harness output (unanalyzed by s1 — see below) |
| API requests issued | **483** | 314 sweep + 120 typed-field + 27 jsonb + 22 real-ID |
| 5xx / crashes | **0** | across all 483 requests |
| Bugs found | **1** | s2 |
| Bugs fixed | **1** | `4a9d847` |
| Regressions introduced | **0** | s4, 18/18 routes byte-identical |
| UI inconsistencies found | **not measured** | s3 capped before producing any result |
| New open leads surfaced | **1** | found during this report stage — see Known Issues #2 |
| Final build | **PASS** | vite, exit 0 |

**s1's harness output has now been read for the first time.** s1 has capped four consecutive runs,
and its harness results have never been analyzed by any stage — this was the single oldest carry in
the backlog. The JSON it left behind was analyzed during this report stage; the API section below is
built from that data. **That carry is now closed.**

---

## Backend API Test Results

**No stage reported on the API this run — s1 capped at turn 51 with zero commits and no artifact.**
The numbers below come from four harness output files s1 wrote to `C:/tmp/` before it capped, read
and analyzed for the first time during this report stage.

**Inventory:** 272 route patterns across 36 route files (GET 132, POST 88, PATCH 26, DELETE 18, PUT 8).

**Coverage:** 198 distinct path patterns / 248 path+method pairs exercised across 314 requests, in
five phases (A: authed GET, B: POST/DELETE, C/D/E: PATCH/PUT variants).

**Result: 0 defects, 0 5xx, 0 DB drift recorded by the sweep.** Every malformed-input probe returned
4xx. Status distribution: 200 x125, 400 x120, 404 x61, 403 x8.

| Category | ep+method | Requests | 5xx | Statuses |
|---|---|---|---|---|
| admin | 6 | 8 | 0 | 403 x8 (intentional — non-superadmin) |
| alerts | 3 | 5 | 0 | 200 x5 |
| auth | 2 | 4 | 0 | 200 x1, 400 x3 |
| counties | 3 | 3 | 0 | 200, 400, 404 |
| crm/activities | 1 | 1 | 0 | 400 |
| crm/automations | 5 | 9 | 0 | 200 x1, 400 x4, 404 x4 |
| crm/calendar | 1 | 1 | 0 | 400 |
| crm/canvass-pins | 5 | 7 | 0 | 200 x2, 400 x4, 404 x1 |
| crm/contracts | 12 | 16 | 0 | 200 x4, 400 x5, 404 x7 |
| crm/custom-fields | 4 | 6 | 0 | 200 x1, 400 x4, 404 x1 |
| crm/dashboard | 15 | 15 | 0 | 200 x15 |
| crm/drip-sequences | 8 | 10 | 0 | 200 x2, 400 x3, 404 x5 |
| crm/expenses | 5 | 7 | 0 | 200 x2, 400 x4, 404 x1 |
| crm/financing | 13 | 17 | 0 | 200 x5, 400 x10, 404 x2 |
| crm/invoices | 6 | 8 | 0 | 200 x4, 400 x2, 404 x2 |
| crm/leads | 13 | 17 | 0 | 200 x5, 400 x8, 404 x4 |
| crm/pipeline | 2 | 2 | 0 | 200 x2 |
| crm/prospect-lists | 5 | 5 | 0 | 200 x1, 400 x1, 404 x3 |
| crm/reports | 6 | 6 | 0 | 200 x6 |
| crm/subcontractors | 8 | 10 | 0 | 200 x3, 400 x5, 404 x2 |
| crm/tasks | 3 | 5 | 0 | 200 x1, 400 x4 |
| crm/team | 3 | 5 | 0 | 200 x1, 400 x4 |
| crm/tenant-settings | 2 | 4 | 0 | 200 x4 |
| crm/territories | 6 | 8 | 0 | 200 x3, 400 x4, 404 x1 |
| crm/work-orders | 11 | 15 | 0 | 200 x7, 400 x2, 404 x6 |
| dashboard | 3 | 3 | 0 | 200 x3 |
| data | 3 | 3 | 0 | 400 x3 |
| disaster-declarations | 1 | 1 | 0 | 400 |
| documents | 3 | 3 | 0 | 200, 400, 404 |
| drift | 4 | 4 | 0 | 400 x2, 404 x2 |
| estimates | 16 | 20 | 0 | 200 x7, 400 x7, 404 x6 |
| leads | 6 | 8 | 0 | 200 x4, 400 x2, 404 x2 |
| map | 3 | 3 | 0 | 400 x3 |
| materials | 9 | 11 | 0 | 200 x7, 400 x1, 404 x3 |
| notifications | 5 | 9 | 0 | 200 x3, 400 x3, 404 x3 |
| onboarding | 6 | 8 | 0 | 200 x4, 400 x4 |
| payments | 5 | 5 | 0 | 200 x2, 400 x3 |
| properties | 13 | 15 | 0 | 200 x6, 400 x8, 404 x1 |
| roof-measurement | 8 | 10 | 0 | 200 x5, 400 x5 |
| search | 1 | 1 | 0 | 200 |
| skip-trace | 10 | 12 | 0 | 200 x5, 400 x5, 404 x2 |
| storm-history | 2 | 2 | 0 | 400 x2 |
| storms | 2 | 2 | 0 | 200 x1, 404 x1 |
| **Total** | **248** | **314** | **0** | |

**Supplementary probes (also s1, also unanalyzed until now):**

- **Typed-field probe** — 120 probes across 2 targets, wrong-type values into typed fields.
  60 x 400 (rejected), 60 x 200 (legitimately accepted). **0 defects.**
- **jsonb shape probe** — 27 mutate-then-revert probes. 15 correctly **rejected** with 400;
  **4 accepted with 200 and flagged `check consumers`** — s1 capped before checking them.
  **Those four are the new open lead in Known Issues #2.**
- **Real-ID probe** — 22 requests against real resource IDs, all 200/201.

**Fixed this run: none.** No API defect was found, and s1 committed nothing.

**Server-side validation independently confirmed by s4** on the four create routes:
`POST /api/crm/invoices`, `/estimates`, `/contracts` returned 400 `lead_id is required` (UUID format
also checked); `POST /api/crm/work-orders` returned 400 `title is required` (+ type and status enum
checks). An empty invoice-builder submit returns 400 and writes nothing.

---

## Frontend Feature Test Results

s2 was the only stage to complete. 19 routes swept; s4 independently re-swept 18.

### Routes covered (19)

`/` · `/storm-map` · `/storm-catalog` · `/pipeline` · `/leads` · `/alerts` · `/tasks` ·
`/canvassing` · `/estimates` · `/invoices` · `/materials` · `/work-orders` · `/expenses` ·
`/subcontractors` · `/contracts` · `/admin` · `/reports` · `/settings` · `/calendar`

| Check | Result |
|---|---|
| Route render sweep | **19/19** — `<h1>` present, 0 page errors, 0 horizontal overflow, exactly 1 `.is-active` nav link (`/alerts` = 0, documented orphan route) |
| Empty states | **17/17** render a real empty state with every array emptied, 0 page errors |
| Total API outage (every `/api/` GET returns 500) | **18/18** degrade gracefully — shell intact, 18 nav links, `<h1>` present, 0 page errors |
| Single-endpoint 500s | **6/6** (tenant-settings, notifications, unread-count, import-progress, leads list, team) |
| Regression sweep after the fix (s4) | **18/18** routes byte-identical to pre-run baselines (dashboard 1999 / leads 1596 / work-orders 817 / contracts 626) |
| Responsive @ 375px (s4) | **19/19** — `scrollWidth === clientWidth`, sidebar hidden, bottom tab bar present, every route paints content, 0 page errors |
| Browser history (s4) | **4/4** back/forward transitions, correct `<h1>` each time |
| Console errors app-wide | Only the 2 known, intentional `/admin` 403s |

### `/work-orders` — the one defect

**Broken:** a truthy non-array `milestones` value white-screened the **entire SPA**
(`milestones.filter is not a function`) — sidebar and header included, because the app has no
error boundary. `WorkOrdersView.jsx:113` and `:843` used `res.data?.milestones || []`, which guards
only *falsy* values; a truthy non-array passes straight through to `.filter` at `:162`.

**Fixed** in `4a9d847` with `Array.isArray(...) ? ... : []` at both sites.

**Verified (s4, 6 shapes stubbed):** baseline byte-identical (list 817 / detail 1211, three `0/7`
counters); scalar, number, object, empty and nulled shapes all degrade to an empty milestone list
(list 777 / detail 1036, `<h1>` intact, 0 page errors). `number` and `empty` are coverage the fix
commit itself did not test. Both fix sites confirmed live.

**This corrects a claim recorded in Run 105** — that the app convention `res.data.X || []` "cannot
produce a non-array." It rules out `null`/`undefined` only.

### Interactions newly covered this run (all passing)

- **Global search** (Ctrl+K) — `GET /api/search?q=…` returns and renders lead results
- **Notification bell** — opens, +505 chars, "Mark all read" plus a real storm notification
- **Help menu** — opens, +1618 chars
- **CSV export** (`/leads`) — `stormpipe-export-2026-08-30.csv`, header + 13 rows matching the 13
  visible leads, every cell quote-escaped
- **Reports presets** — This Month / Quarter / Year / All Time all switch, 9 recharts surfaces each
- **Calendar `dateClick`** — a real pointer on a day cell opens the Create Task modal
- **Work-order card expander** — fires `GET /crm/work-orders/:id/milestones`, renders `0/7` x3
- **Create-form validation** — `/work-orders` empty submit keeps the modal open with 2 `:invalid`
  elements and 0 write attempts

### Needs attention

- **`/calendar` shows no events — by data, not by defect.** 0 tasks in the tenant, the
  `appointments` table does not exist (`42P01`), and `work_orders` has no `scheduled_start`
  column (`42703`). Worth a product decision, not a bug fix.
- **`/estimates` → Edit** remains deliberately unguarded at `EstimatesView.jsx:1318`
  (`templates.map`). Measured in a prior run and knowingly not fixed: it uses the *correct*
  `|| []` idiom and only breaks if the server lies about the type. Guarding it means
  `Array.isArray`-ing every `.map()` in the client — the refactor the charter forbids.

---

## UI Consistency Audit Results

**NOT RUN THIS RUN.** s3 capped at turn 61 with **zero commits and no artifact**. None of the seven
audit categories were measured tonight.

| Audit | Icons | Buttons | Headers | Sidebar/Nav | Forms | Spacing | Modals |
|---|---|---|---|---|---|---|---|
| Measured 2026-08-30? | **No** | **No** | **No** | **No** | **No** | **No** | **No** |

s3 left evidence of what it was working on before it capped — the **Tailwind `utilities`-layer vs
component-class sweep** that the previous run named as the next branch: a probe script
(`qa-r110-twlayer.js`, 05:36), an `index.css` backup (05:38), and a 23 KB defined-class dump
(05:42). It produced no conclusion. s4 moved the stray `defined-classes.json` out of the repo root.

**Carried forward as context only — this is 2026-08-29 data, not tonight's:** the last completed
audit found all seven categories regression-clean across 19 routes (0 foreign icons and every app
SVG `viewBox="0 0 24 24"`; every button radius/height signature mapping to a documented family;
exactly one `<h1>` on 19/19; 18 nav links + 18 icons on 19/19; 0 native `<select>` and 0 native
`<input type="date">` at both source and runtime; 0 horizontal overflow; 0 overlays open at rest).
The one UI fix that night was `d41e868`, and it was re-verified tonight (below).

**The CSS cascade branch was declared converged on 2026-08-29** — specificity, source order, inline,
`!important` and layer order have all been swept. Do not re-spend there. The remaining measured
extension is the mapbox-gl unlayered-stylesheet probe (**measure and report only — map code is
off-limits**) and the Tailwind-layer sweep s3 started tonight.

---

## Verification Results (s4)

All three in-scope fixes re-verified live, each with coverage beyond its original commit:

1. **`4a9d847`** (tonight's fix) — PASS, 6 shapes, both sites. Detailed above.
2. **`f8354cf`** (2026-08-29) — PASS. `/contracts` stubbed with `{contracts:'oops'}`, a mode the
   original commit did not test, returned len 432, `<h1>Contracts</h1>`, "No contracts" empty state,
   0 page errors. **Confirms that guard is a real `Array.isArray` and is immune to the exact
   failure mode that produced `4a9d847`.**
3. **`d41e868`** (2026-08-29) — PASS. 5/5 sampled FullCalendar rules render their source values
   live, and the built bundle carries `.calendar-view .fc .fc-toolbar-title{…font-size:18px…}`
   winning **without `!important`** — only possible outside `@layer base`.

**0 new defects. 0 regressions. Build PASS (vite, exit 0).**

---

## Bugs Fixed

1. **`/work-orders` (`WorkOrdersView.jsx:113`, `:843`)** — a truthy non-array `milestones` value
   white-screened the entire SPA, sidebar and header included, because `res.data?.milestones || []`
   guards only falsy values and `.filter` runs at `:162`. **Fixed** by replacing both sites with
   `Array.isArray(res.data?.milestones) ? res.data.milestones : []`. Commit **`4a9d847`**.
   Verified across 6 response shapes by two independent stages.
   *Reachability: latent.* `routes/workOrders.js:141` sends `res.json({ milestones })` from a table,
   so it is always an array today; fixed anyway per the standing rule that a whole-SPA blank is too
   severe a realization to leave unguarded.

*Supporting commits (no app code):* `57264f3` carried s1's six uncommitted Run 108 harnesses after
it capped; `74c5107` added the read-only triage probes used to rule out the rest of the family.

---

## Known Issues (Not Fixed)

1. **⚠️ The SPA has no error boundary anywhere.** Any render throw blanks the whole application
   including the sidebar and header. **It is the amplifier behind tonight's defect and the Run 68 /
   105 / 109 defects — four now.** Adding one is an enhancement and therefore outside the QA
   charter, but it is the single highest-leverage robustness item in the backlog.
   **Developer decision required.**

2. **🆕 `PATCH /crm/drip-sequences/:id` accepts a malformed `trigger_config` with a 200.**
   Surfaced during this report stage from s1's unanalyzed jsonb probe: string, number, bool and
   array shapes were all persisted into the `trigger_config` jsonb column without a guard
   (`dripService.js:53` and `automations.js:53` both write it with a bare `JSON.stringify` /
   `|| {}`, which rules out falsy only). **Same family as the already-fixed `f9bb21e`** (contracts
   `content` accepted a scalar).
   **Characterized during triage — this does *not* crash.** Client consumers read named properties
   (`DripSequences.jsx:117` then `.toStage`; `AutomationSettings.jsx:107` then `.fromStage` /
   `.source`), and reading a named property off a primitive yields `undefined` rather than throwing.
   **The real consequence is silent over-firing:** `automationEngine.js:45` `matchesConditions()`
   returns `true` for a corrupted config, so the automation matches **every** event of its trigger
   type instead of its configured subset. Latent (the UI always sends an object; only a direct API
   call reaches it). **Not fixed — belongs to an api-test stage, and no stage has been assigned it.**

3. **Generic error toasts discard the server's actionable message — 64 sites.** e.g.
   `InvoicesView.jsx:566` `catch { showToast('Failed to save invoice','error') }` shows a generic
   string when the server said exactly `lead_id is required`. The correct idiom already exists 26
   lines below in the same function (`handleSend` at `:592`). Measured app-wide: **64 bare
   `catch {` + toast sites vs 22 that surface the server error.** The comment at
   `server/src/routes/contracts.js:54-59` documents a past defect that this pattern actively hid.
   App-wide convention change — **developer's call.**

4. **Form-label drift — deferred for the 7th run.** Canonical `.form-group label`
   (`index.css:2249`) is 12px/600/uppercase/0.08em; `/work-orders` is 12px/600/none/normal and
   `/expenses` is 12px/400/none/normal. Scope: 4 `labelStyle` objects + ~100 inline `<label>`
   across 19 files, only 6 of which use `.form-group`. Deliberately not half-converted — a subset
   adds a new inconsistency axis. **Developer decision.**

5. **Production DB junk rows, all rendering safely.** The `qa_options_probe` custom field (tenant
   `waterloo`, created 2026-08-05) stores `options` as the jsonb string `"abcde"`; re-confirmed
   harmless this run — both consumers are `Array.isArray`-guarded (`SettingsView.jsx:2228`,
   `LeadDetail.jsx:1319`) and it renders live with 0 page errors. Also 64 subcontractor rows
   including ones literally named `{"$eq":1}` and `{"foo":"bar"}`. The nightly hygiene sweep
   matches `'QA-R9%'`, which none of these labels match, so they escape cleanup every night.
   **Deletion needs developer go-ahead — not QA's call.**

6. **`.qa-r91-neverrun.mjs` has still never been run — 11 nights.**

7. **`C:/tmp/qa-token.txt` is stale.** s4 found s1's `.qa-r108-fixtures.mjs` returning
   401 `Invalid or expired token` on every request. The harnesses are not broken. **The next s1
   must mint a fresh token first, once** — login is rate-limited to ~10 attempts / 15 min.

8. **⚠️ Pipeline health: stage capping is now the dominant failure mode.** s1 has capped **four
   consecutive runs** and s3 capped tonight; between them they produced 0 commits and 0 written
   artifacts. Two stages capping was flagged as a pipeline problem last run; tonight three did.
   **Recommend raising the turn budgets or narrowing the per-stage charters** — this is now costing
   more coverage than any individual defect.

### Housekeeping (developer call)

336 QA screenshots committed to the repo root; dead code `quickFilters` / `applyQuickFilter`
(`LeadList.jsx:62`, `:346`); dead CSS `.stat-card:hover .stat-card__icon img` (`index.css:959`);
stray 0-byte `server/=`.

---

## Test Coverage Gaps

**Stages that produced no report:**

- **API testing (s1)** — capped with no artifact and no commits for the 4th straight run. Its raw
  harness output was recovered and analyzed in this report stage, so the endpoint numbers above are
  real; but **no stage triaged them at the time**, which is why the `trigger_config` lead sat
  unexamined until now.
- **UI consistency audit (s3)** — capped with no artifact. **All 7 audit categories are unmeasured
  for 2026-08-30.**

**Routes and surfaces not covered tonight:**

- **`/content-studio` and `/leads/:id`** were not in either stage's 19-route sweep.
- **The 15 Settings tabs were not individually walked** (only `?tab=custom-fields` was opened).
- **`/canvassing` pin drop not exercised** — costs a DB write plus a paid geocode.
- **The estimate / invoice / contract *builder* detail shapes** remain unswept; the detail-level
  shape sweep reached `/work-orders` only.

**Structural exclusions (by design, not gaps in effort):**

- **18 of 272 route patterns deliberately not driven** — `trigger-import` (starts a real bulk
  property import), `geocode` (costs money), outbound delivery (`send|email|sms|webhook`), auth
  state (`login` is rate-limited), plus the action routes `score-all`, `correct-all`,
  `mark-all-read`, `/complete`, `alerts/test`.
- **4 routes structurally unexercisable:** the `counties` and `material_products` tables do not
  exist (`42P01`); `contracts.public_token` and `leads.status_token` are not columns (`42703`).
- **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) still need SMTP
  configuration for live delivery testing.
- **FEMA map property code was not touched or tested** — off-limits per the standing charter.
- **No screenshots taken by choice** (336 QA PNGs already in the repo root); computed-style and
  network-parameter evidence was used instead.

---

## Database Hygiene

**Net row growth attributable to QA: none.** The jsonb probe is mutate-then-revert and
create-then-delete by charter, and its cleanup path is confirmed in the harness source.

Comparing the 52-table snapshots taken at 05:05 and 05:55:

| Table | Change | Assessment |
|---|---|---|
| `storm_events` | 7507 to **7513** (+6) | Background NOAA ingest, not a QA write |
| `tenants` | `max(updated_at)` 05:02:47 to 05:05:55 | s1 window — identity `PUT` probes returning 200 |
| `users` | `max(updated_at)` 05:01:35 to 05:40:49 | s3 window |

**Note the scope of the per-stage "0 DB writes" claims:** s2 and s4 each measured zero drift across
*their own* windows, and both are correct. s1 and s3 did cause `updated_at` movement in their
windows. No table gained rows from QA activity.

---

## Recurring Pattern

**This is the ninth consecutive run whose defect is "a value silently loses its expected type or
precedence, and the failure is invisible at the call site."** Tonight's `4a9d847` is the client-layer
variant; the new `trigger_config` lead is the DB-layer variant of the same shape. **Triage this
shape first.**

The specific sub-lesson from this run, now proven twice: **`|| []` and `|| {}` are not type guards.**
They rule out `null`/`undefined` only. Every remaining instance of that idiom on a value that reaches
`.map`, `.filter`, `.reduce` or `Object.keys` is a latent instance of tonight's bug.
