# StormLeads Overnight QA Report — 2026-08-16 (Run 77)

**Baseline:** `f63e32c` (checkpoint: pre-overnight-run 2026-08-16)
**HEAD at report time:** `ed388d7`
**Build:** `npx vite build` — PASS (exit 0, 8.04s; only the pre-existing chunk-size warnings)
**Net DB writes across all stages:** 0 rows created, updated, or deleted

## Report provenance — read this first

Two of the five stages hit the harness turn cap and produced **no written report**:

| Stage | Outcome | Turns | Commits | Report artifact |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51 | none | **none** |
| s2 frontend-test | success | 70 | `4384bf8` | `tests/audit-reports/frontend-test-2026-08-16-run77-s2.txt` |
| s3 ui-audit | success | 56 | `9df54f4` | `tests/audit-reports/ui-audit-2026-08-16-run77-s3.txt` |
| s4 verify | `error_max_turns` | 41 | `ed388d7` | **none** |
| s5 report | this stage | — | this commit | this file |

The s1 and s4 sections below were **reconstructed in s5 from raw harness output**
(`C:/tmp/qa-r77-*.json`, `C:/tmp/route-inventory.json`, `server/.qa-r77*.mjs`), not
from a stage summary. s1 left 8 unresolved candidate findings and s4 left 1; all 9
were adjudicated in s5 and are reported below with their verification evidence.
This is the 7th consecutive run with at least one capped stage.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend routes tested | 19 protected + 3 public `/contract/:token` |
| Settings tabs tested | 15 (all) |
| API endpoints inventoried | 272 |
| API endpoints exercised | 125 (all GET, with real resource ids) |
| API endpoints **not** exercised | 147 (140 write routes + 7 GET with no resolvable id) |
| Bugs found | 3 |
| Bugs fixed | 3 |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| Candidate findings raised and killed on verification | 23 |
| 5xx responses observed | 0 |

**Signal-to-noise:** 26 candidates were raised across the run; 3 survived
verification. The ~9:1 over-report rate is consistent with Runs 75–76 and is the
reason every candidate below carries its kill or confirm evidence.

---

## Backend API Test Results

Endpoints were tested black-box against `http://localhost:3001` with **real resource
ids resolved from live list endpoints** — not dead UUIDs. (Runs 70/73 probed with a
dead uuid, which 404s *before* handler logic and is structurally incapable of finding
stored-shape crashes.)

### Coverage by method

| Method | In inventory | Exercised | Result |
|---|---|---|---|
| GET | 132 | 125 | 111×200, 9×400, 4×403, 1×404, **0×5xx** |
| POST | 88 | 0 | not reached — stage capped |
| PATCH | 26 | 0 | not reached — stage capped |
| DELETE | 18 | 0 | not reached — stage capped |
| PUT | 8 | 0 | not reached — stage capped |

### GET sweep by category

| Category | Tested | Pass | Notes |
|---|---|---|---|
| Auth / tenant | all reached | pass | token minted once (login is rate-limited) |
| CRM (leads, tasks, contacts, dashboard) | all reached | pass | 1×400 on `/api/crm/calendar` (requires a date range) |
| Estimates / invoices / contracts | all reached | pass | — |
| Work orders / expenses / subcontractors | all reached | pass | — |
| Financing / drip / automations | partial | pass | 3 routes unreachable (empty tables) |
| Storms / map / properties / FEMA | all reached | pass | 7×400, all missing-required-`bbox`/date validation |
| Admin | 4 | 4×403 | **correct** — non-superadmin token, platform-admin-only |
| Public share links | 1 | 1×404 | dead token; `/estimate/:token` unreachable, see gaps |

**Every non-200 was verified as correct behaviour**, not a defect: the 400s are
required-parameter validation (the sweep deliberately sends no params), the 403s are
tenant-role enforcement, and the 404 is a non-existent public token.

### Structural checks (set differences over the route table)

1. **Shadowed routes** (`.qa-r77-shadow.mjs`) — routes declared but unreachable
   because Express matches in declaration order. **0 intra-file shadowings**
   (e.g. no `/:id` declared ahead of a literal sibling) and **0 clashes across all
   9 inter-router mount pairs** (`/crm` vs `/crm/invoices`, `/crm/work-orders`,
   `/crm/reports`, `/crm/automations`, `/crm/canvass-pins`, `/crm/drip-sequences`,
   `/webhooks` vs `/webhooks/hearth`). Clean.
2. **Dead query filters** (`.qa-r77-qparams.mjs` + `.qa-r77-qprobe.mjs`) — 37 GET
   routes declare query params; each was probed with an unmatchable value to see
   whether the row count moved. **4 candidates, all 4 killed** (see below).
3. **Dropped update fields** (`.qa-r77-whitelist.mjs`) — fields the client sends on
   an update vs the server's `allowedFields` whitelist. This is the family of Run
   74's `8a45209`. **4 candidates, all 4 killed** (see below).

### s1's 8 candidates — all adjudicated in s5, all false positives

| # | Candidate | Verdict and evidence |
|---|---|---|
| 1 | `/api/crm/tasks?completed=true` returns the same 4 rows as unfiltered | **Not a bug.** `crmService.js:369-372` applies `t.completed_at IS NOT NULL` / `IS NULL` correctly. The harness assumed `true` was an unmatchable value; all 4 tasks are in fact completed, so 4→4 is the right answer. |
| 2 | `properties-affected/list?contacted=true` → 50 = 50 | **Not a bug.** `crmService.js:856-858` accepts `'contacted'` / `'uncontacted'`; anything else means "all". The harness sent `true`, which is out of domain. |
| 3 | `properties-affected/list?housesOnly=true` → 50 = 50 | **Not a bug.** `crm.js:731,736` — `housesOnly` **defaults to `'true'`**, so the probe re-sent the default. The unmatchable value would have been `false`. |
| 4 | `/api/storms?timeRange=1` → 50 = 50 | **Not a bug.** `stormService.js:76` keys an intervals map on `12h\|24h\|3d\|7d\|14d\|30d`; `1` is not a key, so no filter is applied. Out-of-domain probe value. |
| 5 | `AdminDashboard.jsx:289` sends `subscriptionTier`/`subscriptionStatus`, whitelist drops them | **Not a bug** — already a documented Run 74 non-bug. `updatePlan` destructures camelCase deliberately; it is the only such service. |
| 6 | `DripSequences.jsx:90` sends `is_active`, not in any `allowedFields` | **Not a bug.** `dripService.js:93` handles `is_active` in an explicit if-chain rather than an `allowedFields` array. The harness only recognised the array pattern. |
| 7 | `SettingsView.jsx:2685` sends `unit`/`default_unit_price`/`section`, dropped | **Not a bug.** The call targets `PATCH /estimates/templates/:id`, a **dedicated handler** at `estimates.js:124` that destructures all five fields explicitly. The harness paired the call with `estimateService`'s *estimate* whitelist. |
| 8 | `api/crm.js:16` sends `roof_type`, not in `updateLead`'s whitelist | **Not a bug.** The call targets `PATCH /crm/leads/:id/roof-type`, a **dedicated handler** at `crm.js:239`. The harness paired it with the generic lead-update whitelist by path prefix. |

**Lesson (harness, not app):** 4 of these 8 came from a static diff pairing a client
call with the *wrong* server handler, and 3 more from probing a filter with a value
that is either the default or outside the accepted domain. A dead-filter probe is
only valid if the probe value is provably unmatchable *and* the baseline is non-zero.

### API fixes committed this run

**None.** s1 committed nothing — it found no confirmed defect before hitting the
turn cap, and s5's adjudication of its 8 candidates confirms there was nothing to fix.

---

## Frontend Feature Test Results

All 19 protected routes rendered with **0 page errors, 0 failed application requests,
and 0 `undefined` / `NaN` / `[object Object]` / `Invalid Date` strings** in rendered
text. The only non-2xx was `/admin` → 403 on `/api/admin/overview`, which is the
documented platform-admin-only behaviour.

| Page | Tested | Result |
|---|---|---|
| `/dashboard` | stat cards, funnel, activity feed, tasks due, team leaderboard, all 5 date ranges | **1 defect — fixed.** Leaderboard rep click filtered nothing. All 5 date ranges issue correctly-dated API calls. Pipeline value $134K (All Time/YTD) vs $0 (7/30/90d) confirmed correct — every valued lead predates 2026-05-18. |
| `/leads` | search (match + no-match), 7 sortable columns, filters, filter pills, Clear All, pagination | Pass after fix. Non-sortable columns (Address, Phone, Email, Source, Storm, Rep, Follow-up, Days) have no `onClick` **by design** — only 7 columns call `handleSort`. |
| `/calendar` | event click-through | **1 defect — fixed.** Event click did not open the lead. View switching **untested — 0 events exist**. |
| `/estimates` | list, filter tabs | Pass. Builder line items untested. |
| `/invoices` | list, filter tabs | Pass. Record Payment untested. |
| `/contracts` | list, filter tabs | Pass. |
| `/expenses` | list, filter tabs | Pass. **Open ticket:** `?leadId=` is ignored. |
| `/tasks` | list, filter tabs | Pass. **Cosmetic:** "Pending 0" shows the first-run empty state. |
| `/work-orders` | list, filter tabs | Pass. Milestones/checklists untested. |
| `/pipeline`, `/storm-map`, `/canvassing`, `/reports`, `/storm-catalog`, `/alerts`, `/admin`, `/settings` + remaining routes | render, console, network | Pass — 0 errors. `/reports` type switching untested. |
| `/settings` — all 15 tabs | click, switch, render, form elements | **All 15 switch and render, 0 errors. ZERO native `<select>`, ZERO native date inputs — 5th consecutive run.** |
| `/contract/:token` (public) | 3 tokens rendered | Pass — 0 errors, correct white-paper card. **All 3 are `status=void`**, so only the voided stub was exercised. |

---

## UI Consistency Audit Results

All 7 charter audits ran under **real measurement** (computed styles read in the live
document) across all 19 routes. **0 defects found. 0 code changes.**

| Audit | Finding | Fixed? |
|---|---|---|
| **1. Icons** | **No non-Heroicon icons.** 43/43 imports are `@heroicons/react/24/outline`; 0 solid variants, 0 other libraries, 0 `fa-*` or Material classes, **0 non-conforming `<svg>` on any of 19 routes**. The only 2 inline `<svg>` are the documented map-legend swatch and Google InfoWindow stars. 4th clean run. | n/a — nothing found |
| **2. Buttons** | **No sizing/styling inconsistencies.** `.auth-btn` measured **identical** (36px height / 0–24px padding / 13px font / 700 weight) on 7 pages. Nav and toolbar buttons uniform. | n/a — nothing found |
| **3. Toolbars / Headers** | **Consistent.** `topbar glass` measures **56px on all 19 routes**. Every route has exactly one `<h1>`. | n/a — nothing found |
| **4. Sidebar / Nav** | **No issues.** 18 `.nav-link`, heights `[42]`, radius `[12px]`, icons `[18]`, identical gaps on every route; exactly one `.is-active` except the documented `/alerts` orphan. | n/a — nothing found |
| **5. Forms** | **No non-standard elements.** **ZERO native `<select>` and ZERO native `<input type="date">` — 6th consecutive run.** `CustomSelect` and `DatePicker` are used everywhere. | n/a — nothing found |
| **6. Spacing** | No new issues. All fractional pixel values trace to the **already-documented** two-coexisting-spacing-systems root cause (Tailwind rem on a 14px root vs px vars). Not re-filed. | pre-existing backlog |
| **7. Modals** | **All consistent.** 4 modals opened; **all 4 compute `animation-name: modal-scale-in` at 20px radius** — Run 75's fix is holding. | n/a — nothing found |

### Two prior tickets closed by measurement

- **Run 75's "there is no `<h1>` anywhere in the app" is RESOLVED.** `TopBar.jsx:45`
  renders one per route. The `viewRoutes` → `routeToView` → `viewTitles` chain matches
  **19/19**, and the title text was read at runtime on 8 routes. Sidebar and
  BottomTabBar nav ids all resolve, so nothing falls through `handleNavigate`'s `|| '/'`.
- **Seven set differences over UI name kinds all came back clean** — including the
  className/CSS-var/keyframes kinds that produced the Run 75 and Run 76 headline bugs.
  Four kinds were new: props passed vs destructured, `htmlFor` vs `id`, localStorage
  written vs read, `CustomEvent` dispatched vs listened.

### The most instructive kill (harness false positive)

`@keyframes spin` looked airtight-missing for `.address-search__spinner`: app CSS
defines only `icon-spin`/`appleSpinStep`, there is **no `tailwind.config`**, and there
are **zero `animate-spin` usages**. It is **not** a defect — the keyframe ships in
**Tailwind's theme** (`tailwindcss/theme.css` v4.2.2, imported via
`@import "tailwindcss/theme" layer(theme)`). Killed by (1) injecting the element and
reading computed `transform` 250 ms apart, and (2) grepping the **built**
`dist/assets/*.css`, which proves it is not a dev-only accident.

**Generalised:** any set difference whose "defined" side reads only application source
will over-report whenever a **vendor stylesheet** supplies the name. Enumerate
`document.styleSheets` (recursing into `@layer`) or grep the built bundle instead.

---

## Bugs Fixed

1. **`/dashboard` team leaderboard — clicking a rep filtered nothing.**
   `Dashboard.jsx:1836` navigated to `/leads?assigned_rep=<id>`, but `LeadList.jsx:119-128`
   never read that param — and its URL-sync effect at `:190-201` rebuilt the query string
   from its own state, **stripping the param from the address bar on arrival**. The user
   got all 24 leads with no trace a filter was intended. The server had always supported
   the filter, under the different name `assigned_rep_id` (`crm.js:23`).
   *Fixed* in `4384bf8`: `LeadList` reads `assigned_rep`, sends `assigned_rep_id`, keeps it
   in the URL, and surfaces it through the existing filter-pill / Clear All pattern.
   Verified: 1 row, rep column "Miles M", pill "Rep: Miles Martin", pill-remove restores 24.

2. **`/calendar` — clicking an event did not open the lead.**
   `CalendarView.jsx:96` navigated to `/leads?leadId=<id>`, but a lead opens via
   `useParams` on the `/leads/:id` route, never from a `leadId` query param. The click
   landed on the bare lead list.
   *Fixed* in `4384bf8`: repointed to `/leads/<id>`. Verified the target route opens the
   slide-over. Could not be driven through the UI — the calendar has 0 events.

3. **`/leads` — the rep filter pill read "Assigned rep" for a rep with no leads.**
   A regression in fix #1. The new pill derived its label from the returned rows
   (`leads.find(l => l.assigned_rep_id === repFilter)`), so the name only resolved when
   the filter matched at least one lead. Clicking a zero-lead rep on the leaderboard —
   precisely the case where the pill is the *only* thing on screen naming the filter,
   because the table shows the generic "No leads found" state — rendered "Rep: Assigned rep".
   *Fixed* in `ed388d7`: the label now resolves from the `teamMembers` list `LeadList`
   already fetches on mount, independently of the result set, falling back to the
   row-derived name and then to "Assigned rep". Verified: rep with 4 leads → "Rep: Brandon
   Admin" (unchanged), rep with 0 leads → "Rep: QA User", non-uuid rep id → no crash.

**Both s2 defects share one shape:** *a view navigates with a query param the destination
view never reads, so the click silently does nothing*. Both were found by a set difference
over `navigate()` / `<Link to>` targets and client query-param names versus the
`<Route path>`s and `req.query` names that actually read them — the 4th consecutive run
where the finding came from a set difference over code rather than from inspecting output.

---

## Known Issues (Not Fixed)

### Needs a design decision

1. **Roof-type price map does not cover the value the database actually stores.**
   `LeadDetail.jsx:728` prices the estimate preview from an inline map keyed
   `composition | asphalt | metal | slate | tile | wood | built-up`. The only
   `roof_type` value present in `properties` is **`asphalt_shingle`**, which matches
   no key, so it falls through to the `|| 6` default ($6.00/sqft instead of asphalt's
   $5.50). Line `:729` then renders `(asphalt_shingle)` — **the label claims the roof
   type was recognised while the price silently used the default.** Currently 1 of 1
   priced rows. Needs a decision on the canonical value set before it can be fixed
   safely. *(Found by s4 via `server/.qa-r77s4-rooftypes.mjs`; s4 was capped before
   reporting it. Re-verified in s5.)*
2. **`/expenses?leadId=` is ignored.** `LeadDetail.jsx:1538` "Add Expense" sets
   `window.location.href = /expenses?leadId=...`, but `ExpensesView.jsx` has **no
   `useSearchParams` at all** — no modal opens and nothing filters. It degrades rather
   than dies. A correct fix needs a `defaultLeadId` prop on `ExpenseModal`; passing a
   synthetic `expense` object would take the UPDATE branch at `ExpensesView.jsx:78`
   with no id. Also note it forces a full SPA reload. *Contrast: `ContractsView` does
   read `leadId`/`fromEstimate` and `StormMap` does read `stormId` — this is a single
   gap, not a family.*

### Needs a DB migration

3. **`/dashboard` Days-in-Stage is measured from `updated_at`**, a generic
   trigger-maintained timestamp, so any unrelated lead edit zeroes it. **The data
   needed is not recorded** — this requires a `stage_changed_at` column plus a backfill.
   Carried forward from Run 74.

### Latent risks (working today, will bite on reuse)

4. **Dead CSS that is a loaded gun.** `.lg-storm-row*` (`index.css:1294-1354`) and
   `.tab-content` (`:4369`) have **zero JSX consumers**, and `.lg-storm-row__badge`
   references the undefined `--tc` inside a border shorthand. Anyone reusing that block
   inherits Run 76's border-deleting failure for free. Recommend deleting both blocks.
5. **`.address-search__spinner` depends on a vendor keyframe.** `index.css:3014`
   animates `spin`, which app CSS never defines (the other 27 keyframes are local); it
   resolves only because Tailwind's theme supplies it. Works in dev and in the
   production bundle today. Recommend adding a local 4-line `@keyframes spin`.

### Cosmetic / backlog (re-confirmed, deliberately not re-filed)

6. `/tasks` "Pending 0" shows the first-run empty state ("Create your first task") on a
   filtered view even though 4 completed tasks exist.
7. Two coexisting spacing systems (Tailwind rem on a 14px root vs px vars) — the root
   cause of every fractional pixel measurement.
8. `.quick-action-btn` renders at 8 different heights; form labels use 7 treatments;
   Esc-to-close is implemented on 0 of 4 modals.
9. `/alerts` is an orphan route — no sidebar item takes `.is-active` for it.

### Operational

10. **QA fuzz residue is still not cleaned — 5th consecutive stage carrying it.**
    ~99 estimates, ~85 `123 Test St` drafts, `QA72`/`QA76` tasks, a `QA Options Probe`
    custom field, and leads carrying literal `true` / `12345` values. s3 was read-only
    by charter and s4 was capped before reaching it. **This is user-visible in
    `/leads`, `/pipeline` and `/estimates` and should be the first task of the next run.**

---

## Test Coverage Gaps

1. **All 140 write endpoints are untested.** POST (88), PATCH (26), DELETE (18) and
   PUT (8) were never exercised — s1 built its id-resolution and GET harnesses and hit
   the turn cap before running the write harness. **This is the single largest gap in
   the run**, and it covers exactly the family that produced Run 74's `8a45209`
   ("create coerces, update does not"). API breadth this run was **125 of 272 (46%)**,
   down from Run 74's 244 of 272 (89.7%).
2. **7 GET routes had no resolvable id** and were declared as holes rather than probed
   with a dead uuid: `/api/admin/tenants/:id`, `/api/crm/drip-sequences/:id` (+
   `/enrollments`), `/api/crm/financing/applications/:id`, `/api/crm/territories/:id`
   (+ `/pins`), `/api/skip-trace/job/:jobId`. All are empty tables, not defects.
3. **The signed/active public contract layout has never been rendered.** All 3
   contracts carrying a token are `status=void`, so only the "This contract has been
   voided." stub was exercised.
4. **`/estimate/:token` is unreachable from the API surface** — the estimates list
   response carries no token-ish field. Needs a share token from the DB or the
   per-estimate detail route.
5. **Never exercised this run:** `/leads/:id` tab-by-tab, estimate builder line items,
   invoice Record Payment, work-order milestones and checklists, `/reports` type
   switching, and `/calendar` view switching (0 events exist to drive it).
6. **Wrong values that are well-formed are invisible to every sweep run tonight.**
   A 200 carrying a wrong number is indistinguishable from a 200 carrying a right one;
   nothing this run validated response *values* against expected business results.
7. **Two of five stages produced no report** (s1, s4 — both `error_max_turns`). Their
   findings were recoverable only because they wrote raw JSON artifacts to disk.
   7th consecutive run with capped stages.

---

## Notes for the next run

- **Start with the write-endpoint sweep.** It is the largest gap and the highest-yield
  bug family historically. The id-resolution harness (`server/.qa-r77-ids.mjs`,
  `.qa-r77-ids2.mjs`) already resolved 36 real ids and can be reused directly.
- **Then run the fuzz-residue cleanup.** Fifth stage carrying it.
- **Set differences over UI name kinds are exhausted** — seven kinds ran clean this
  run. Untried kinds: DB column names selected in SQL vs field names read in JSX;
  toast/notification message keys; icon component name vs the action it labels;
  `data-*` attributes set vs queried.
- **Traps confirmed this run:** login is rate-limited (~10 tries → 15-min lockout), so
  mint once per stage and cache the token; the API is on **port 3001**, not 3000;
  PowerShell 5.1 mangles `git commit -m @'...'@` here-strings — write the message to a
  file and use `git commit -F`; and if the Playwright input pipeline appears to die,
  the tell is that `mouse.move` produces no `:hover` — `browser_close` and re-navigate.
