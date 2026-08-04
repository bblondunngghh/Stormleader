# StormLeads — Overnight QA Report

**Run 67 · 2026-08-03 · branch `feat/financing`**
Baseline: `626c7cd` (Run 66 HEAD) · Checkpoint: `1b29eb0` · Final HEAD: `79c8945`
Stages: s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)
Final client build: **exit 0, 8.09s, 0 errors**

---

## QA Test Summary

| Metric | Count |
|---|---|
| Routes swept (render + computed style) | **19 of 19** authed routes |
| Pages tested at interaction depth | **1** (`/dashboard`) — see Coverage Gaps |
| Overlays / forms opened | 5 overlays, 9 create-forms |
| API endpoints inventoried | **272** |
| API endpoints exercised live | **28 distinct** (83 estimate PDFs swept individually) |
| Endpoints probed for cross-tenant isolation | **16** — 0 leaks |
| **Bugs found** | **6** |
| **Bugs fixed** | **6** (in 5 commits) |
| UI inconsistencies found | **1** |
| UI inconsistencies fixed | **1** |
| Findings reported, not fixed (out of charter) | 8 |
| Verification checks run | 20 → 19 pass, 1 tester error, **0 real failures** |
| Net database writes | **0** (all 7 QA-created rows deleted) |

Three of the five stages (s1 api-test, s2 frontend-test, s4 verify) terminated on their turn
caps rather than completing. All three wrote evidence incrementally, so no findings were lost,
but frontend coverage stopped after the first page. This is the dominant limitation of this run
and is itemised under Coverage Gaps.

---

## Backend API Test Results

### Auth — 1 endpoint, 1 passed, 0 failed
`POST /api/auth/login` verified on two fresh server instances (`:3001`, `:3099`) for two
accounts against tenant `waterloo`. Both returned 200 with correctly scoped tokens.

### CRM — custom fields — 2 endpoints, 1 passed, 1 failed → **fixed `a9fb0e4`**

`POST /api/crm/custom-fields` hard-500'd on any truthy non-string `field_label`
(array / number / boolean / object). Reproduced live on fresh HEAD before the fix:

```
{"field_label":[1,2]} → 500     {"field_label":123}     → 500
{"field_label":true}  → 500     {"field_label":{"a":1}} → 500
CONTROL {}                      → 400 "field_label is required"   (correct)
CONTROL {"field_label":"..."}   → 201                             (correct)
```

Root cause: `crm.js:1104` guarded only for *falsy*, so any truthy non-string passed the check;
`crm.js:1108` then called `field_label.toLowerCase()` → `TypeError`. This defect was carried
open from Run 66 and is now closed.

**A second defect on the same route was found by the scope probe** and fixed in the same commit:
a non-string `field_key` skipped auto-generation (`if (!field_key)`) and was inserted verbatim.
Confirmed by direct DB query — `[1,2]` stored as `{"1","2"}`, `{"a":1}` stored as `{"a":1}`,
`123` and `true` stored raw. `field_key` is the lookup identifier for custom field values, so a
malformed key is worse than a malformed label. The scope probe also confirmed these were the
*only* two crashers on the route (`field_type`, `is_required`, `sort_order` all correctly 400).

### Estimates — 2 endpoints, 1 passed, 1 failed → **fixed `a023c66`**

`GET /api/estimates/:id/pdf` returned a hard 500 — `Cannot read properties of null (reading
'section')`. `estimates.js:226` guarded the *container* (`Array.isArray(line_items)`) but not
the *elements*; `line_items` is a JSONB column, so it can hold `null` / `""` / `1`, and line 234
dereferenced `item.section`.

**This one is UI-reachable.** `EstimatesView.jsx:111` calls it for the "Download PDF" button,
and the two affected rows are EST-082 / EST-083 — the two newest estimates, sitting on page 1 of
the Estimates list. Both dated 2026-06-07, so they predate the QA pipeline's own artifacts by
two months.

Control proving no over-reach: the filter was applied to all 77 estimates holding ≥1 line item —
identity (drops nothing) on **75**, drops something on exactly **2**, the two crashing rows.
Both have stored subtotal 0.00 and `calculateTotals` already scored those elements as 0, so the
PDF now agrees with the stored total instead of throwing.

Found by the *control* column of the IDOR sweep, not by the probe itself: every other route
returned 200 to its owning tenant; this one returned 500 to the owner.

### CRM — dashboard — 6 endpoints, 5 passed, 1 failed → **fixed `d6fa299`**

`GET /crm/dashboard/estimate-summary` returned all zeros against 83 real estimates. Covered in
full under Frontend Feature Test Results below, since it was found from the UI.

Three further dashboard endpoints (`/crm/dashboard/stats`, `/crm/pipeline/metrics`,
`/crm/dashboard/activity`) returned 200 on every request but **ignore all query parameters** —
reported, not fixed. See Known Issues.

### Tenant isolation (cross-tenant IDOR) — 16 endpoints, **0 leaks**

Run 65 swept tenant isolation *statically* (by reading the SQL). This run asked the running
server for another tenant's rows — the first live IDOR probe in the pipeline's history, closing
a carried coverage gap. Method: a server instance with a known `JWT_SECRET`, a genuinely-signed
token for tenant B, requesting real row ids owned by tenant A, with tenant A's own token as the
control on every route (without it, a 404 could mean "route is broken" rather than "isolation
works").

13 of 16 routes returned **404** to the attacker and 200 to the owner. The three that returned
200 to both were disambiguated rather than assumed — re-probed with parents that demonstrably
have children, plus a random-UUID control:

```
GET /crm/leads/:id/activities      A → 4 real rows | B → [] | B random uuid → []   BYTE-IDENTICAL
GET /crm/expenses/summary/:leadId  A → $750/$6000  | B → 0s | B random uuid → 0s   BYTE-IDENTICAL
GET /crm/subcontractors/work-order/:id   A → []    |         B random uuid → []    BYTE-IDENTICAL
```

**Verdict: no data crosses, and the response for another tenant's id is indistinguishable from
one that does not exist — so there is not even an existence oracle.** That these three return
200-with-empty rather than 404 is a cosmetic API-correctness difference on collection endpoints,
not a security issue; changing status codes on working endpoints is a behaviour change and out
of charter.

Not a bug: `/api/properties/*` is not tenant-scoped by design — the table has no `tenant_id`
column and holds 94,680 rows of global public FEMA/NSI reference data.

### Leads — 1 endpoint, 1 passed
`GET /api/leads?stage=<key>` accepted every stage key the dashboard links to after `0692fc2`;
0 rejected across the full days-in-stage link set.

### Verification pass (s4) — 20 checks

19 passed, **0 real failures**. The single reported failure was tester error, confirmed against
the database rather than assumed: the assertion summed only `draft+sent+viewed+accepted` (82)
and omitted `declined` (1), then compared against a list count of 83. DB ground truth for tenant
`791bb51d` is 66 draft + 14 sent + 1 viewed + 1 accepted + 1 declined = **83**, which the API
returns exactly. `d6fa299` reconciles perfectly; the check did not.

Included in the pass: a sweep of **all 83 estimate PDFs → 0 non-200**.

---

## Frontend Feature Test Results

### `/dashboard` — tested at full interaction depth. 2 bugs found, 2 fixed. 0 console errors.

**Rendered:** all panels present — 5 KPI cards, 14-row pipeline funnel, mini storm map, storm
activity (6 events + "+44 more"), today/tasks (4 overdue), activity feed (14), storm conversion,
estimates, revenue by lead source, accounts receivable, estimating conversion, stale leads (10),
days in stage (5), team leaderboard (4 reps). Console: 0 errors, 0 warnings.

**BUG 1 — Estimates panel read 0/0/0/0 and $0 against 83 real estimates. Fixed `d6fa299`.**

Spotted by cross-reading two panels that sit one row apart on the same screen:

```
"Estimates"             → 0 draft, 0 sent, 0 viewed, 0 accepted, $0, $0
"Estimating Conversion" → 17 sent, 1 accepted, 1 declined, 5.9%
```

Both read the `estimates` table for the same tenant. Root cause: `crmService.getEstimateSummary`
hard-coded `AND created_at >= now() - interval '30 days'` while the panel is titled just
"Estimates" with no date qualifier in the UI. The newest estimate in the tenant is 2026-06-07 —
57 days old — so the window caught nothing.

Evidence it is drift rather than intent: both sibling panels on that row (`ar-summary`,
`estimating-conversion`) are all-time with no window; the one place the app *does* window —
Speed to Lead — labels it "(30d)" in the UI; and the dashboard has a global All Time/7d/30d/90d/YTD
control that this endpoint never receives. Fix dropped the hidden window (1 line, single caller
verified by grep).

After (live): `{"draft":66,"sent":14,"viewed":1,"accepted":1,"declined":1,"accepted_value":4500,
"pending_value":295979.6}` — matches the DB exactly, and total_sent 17 now reconciles (14+1+1+1).
Browser re-check confirms the panel reads 66 DRAFT / 14 SENT / 1 VIEWED / 1 ACCEPTED / $4.5K / $296.0K.

**BUG 2 — two KPI cards filtered by a stage that does not exist. Fixed `0692fc2`.**

All 5 KPI cards advertise `cursor:pointer`; all 5 were clicked:

```
Pipeline Value    → /pipeline                 OK
New Leads (7d)    → /leads                    OK
Close Rate        → /leads?stage=closed_won   BROKEN
Avg Days to Close → /leads?stage=closed_won   BROKEN
Speed to Lead     → /leads                    OK
```

The `lead_stage` enum (queried live) is `new, contacted, appt_set, inspected, estimate_sent,
sold, lost, negotiating, in_production, on_hold`. There is no `closed_won`. Live symptom: "0
leads", "No leads found", and a filter chip reading literally **"Stage: undefined"**
(`LeadList.jsx:341` does `stageLabels[stageFilter]` and its map has no `closed_won` key).

**Notably, this now fails silently** — Run 66's `77ae9a2` `stage::text` fix absorbs the unknown
key, so no 400 and no console error is produced. A console-error sweep cannot find this class of
bug; it has to be clicked and read. Both links fixed to `?stage=sold`; verified live by clicking
the real, populated cards (not the empty-state ones), which now land on `/leads?stage=sold` with
the chip reading "Stage: Sold".

**Still needs attention on this page:** the period filter bar is inert — see Known Issues #1.

### All other pages — render/computed-style depth only this run

The 19-route sweep (stage s3) loaded every authed route with **0 console errors** and confirmed
structural consistency across all of them. No page-level interaction testing beyond `/dashboard`
was reached before the stage cap. The 16 remaining CRM pages carry forward untested at
interaction depth for this run — they were covered at that depth in Run 66.

---

## UI Consistency Audit Results

All 7 charter axes executed, plus 2 axes never swept before. **1 defect found, 1 fixed.**

| Axis | Result |
|---|---|
| 1 Icons | **PASS** |
| 2 Buttons | **PASS** |
| 3 Toolbars / Headers | **PASS — byte-identical on 19/19** |
| 4 Sidebar / Nav | **1 FOUND + FIXED** (`79c8945`) |
| 5 Forms | inputs **PASS**; labels — 7 treatments, documented |
| 6 Spacing | **PASS** |
| 7 Modals | **PASS on close**; Esc supported by only 1 of 5 |
| NEW: hover layout shift | **PASS** — 106 controls / 14 routes → 0 shifts |
| NEW: icon-only buttons | **PASS** — 93 buttons, 0 unnamed |

**Icons — no non-Heroicon icons found.** Every `<svg>` on all 19 routes has
`viewBox="0 0 24 24"` except `/reports`, where the 4 outliers are all `class="recharts-surface"`
data-viz, not icons. 0 foreign icon libraries.

**Buttons — no sizing or styling inconsistencies.** `.auth-btn` (primary CTA): 9 instances
across 9 routes, 8 byte-identical (36px | 0 24px | 13px | 700 | `oklch(0.72 0.19 250)`). The 9th
is a deliberate StormCatalog override sized to match its inactive siblings — **Run 65's
`5b52fb7` verified intact**, the pills no longer reflow on click. `.quick-action-btn`: 349
instances across 8 routes, variants per-context and internally consistent.

**Toolbars/Headers — consistent across all pages.** `topbar glass`, height 56px, padding
`0 32px`, `h1` 18px/700 on every single route. Byte-identical on 19/19.

**Sidebar/Nav — 1 real inconsistency, fixed.** `Sidebar.jsx` assigned `DocumentTextIcon` to
**both** Estimates and Contracts — the only duplicate among 18 nav items. Harmless while
expanded, because the text labels disambiguate. But the sidebar **collapses to 68px with zero
text labels** (verified live: 240 → 68 → 240), and in that state the two *adjacent* rows in the
Jobs group render as pixel-identical 34px icons. The only way to tell them apart was hovering for
the native tooltip. Fixed: Contracts → `DocumentCheckIcon` (present in the pinned heroicons
2.2.0, and semantically right for signed contracts). Re-verified: **18 items → 18 unique icon
paths in both states**, all still `viewBox="0 0 24 24" fill="none"`, collapse still works.

*The method that found it, after 65+ runs of icon audits passed: don't **count** icons, **compare**
them.* Hash each nav icon's svg path `d` and look for collisions — 18 items → 17 unique paths →
exactly 1 colliding pair — then ask whether the collision is user-visible. Prior audits only ever
asked "is every icon a Heroicon outline?" (it is, 100%), never "is any icon used twice?"

**Forms — no non-standard elements; one structural inconsistency documented.** 0 native
`<select>`, 0 native `<input type=date|time|datetime-local>` anywhere in the app; `DatePicker`
and `CustomSelect` are used throughout. 31 inputs across 7 routes match the `.form-input`
contract (`index.css:2247`) byte-for-byte. The 2 unstyled `/alerts` inputs are the centre cell of
a composite −/+ numeric stepper whose borders live on the wrapper — a deliberate segmented
control, not a violation.

Worth noting about prior runs: the 19-route sweep found only 1 field on 15 of 19 routes, and
that field is the global TopBar Cmd-K search. **Every real form in this app lives inside a modal
or slide-over**, so earlier runs' "forms PASS" was measured almost entirely on pages with one
input. Opening the modals this run surfaced the label finding below.

**Labels have 7 treatments — documented, not fixed.** `index.css:2239` already defines the
canonical rule (`.form-group label` = 12px / 600 / uppercase / 0.08em / `--text-secondary`) and 22
labels match it exactly; 31 do not. Root cause is structural, not cosmetic: five files wrap
fields in `.form-group` and let the stylesheet style the label, five hand-roll an inline style
object per file, and InvoicesView does both. Deliberately not half-converted — see Known Issues #3.

**Spacing — no alignment issues.** `document.scrollWidth == clientWidth == 1440` on all 19
routes, so there is no accidental page-level horizontal scroll anywhere. Panel border-radius
20px/18px uniform on 19/19; panel gaps 16px dominant. `.main-content` padding is 24px on
`/storm-catalog`, `/alerts`, `/reports` and 0px on the other 16 (those pad their own inner
wrapper) — Run 64 already examined this and ruled the non-list views deliberate; content
alignment is identical on 19/19.

**Modals — all consistent on close.** All 5 overlays close correctly via their X / Cancel control
(verified open → closed, field count returns to baseline): `/tasks` slide-over 420w,
`/subcontractors` slide-over 480w, `/expenses`, `/work-orders`, `/pipeline` modals. Overlay chrome
matches what Runs 61/64 already ruled per-context. `/invoices`, `/contracts`, `/estimates`,
`/materials`, `/alerts` open inline forms rather than overlays — by design, not a missing-modal
defect. Esc-to-close is inconsistent (1 of 5) — see Known Issues #4.

### Two false positives caught before filing

1. **Dashboard "Full Map"** measured 26px tall vs 13px for its 9 sibling Panel action links —
   looked like a wrap defect in the shared `Panel` component. Re-measured at five desktop widths
   *before filing*: 1920 / 1600 / 1440 / 1280 / 1024 → **13px, one line, every time**. The wrap
   occurs only at the ~929px window the browser happened to start in, below the 1024px desktop
   floor, and mobile is paused. Not a defect.
2. **`Sidebar.jsx:2` imports `IconLogOut` from `./Icons`**, which reads as a charter violation.
   `components/Icons.jsx` is a thin alias layer over Heroicons outline containing zero hand-rolled
   SVG. Not a violation — do not re-file.

---

## Bugs Fixed

1. **`POST /api/crm/custom-fields`** — hard 500 on any truthy non-string `field_label` (array /
   number / boolean / object); `crm.js:1104` guarded only for falsy, so `field_label.toLowerCase()`
   threw a `TypeError`. Added an explicit type guard returning 400. Carried open from Run 66; now
   closed. — **`a9fb0e4`**
2. **`POST /api/crm/custom-fields`** — a non-string `field_key` skipped auto-generation and was
   stored verbatim as a Postgres array literal / raw object / number / boolean. Since `field_key`
   is the lookup identifier for custom field values, a malformed key is worse than a malformed
   label. Guarded in the same change. — **`a9fb0e4`**
3. **`GET /api/estimates/:id/pdf`** — hard 500 (`Cannot read properties of null`) when the
   `line_items` JSONB array held a null or non-object entry; the container was guarded but the
   elements were not. Filtered at the source rather than scattering `?.` across 5 dereferences.
   UI-reachable via the Estimates "Download PDF" button on the two newest estimates. — **`a023c66`**
4. **Dashboard → Estimates panel** — read 0/0/0/0 and $0 against 83 real estimates because
   `getEstimateSummary` hard-coded a hidden 30-day window while the panel is titled just
   "Estimates"; the newest estimate is 57 days old. Dropped the window. — **`d6fa299`**
5. **Dashboard → Close Rate / Avg Days to Close KPI cards** — both linked to
   `/leads?stage=closed_won`, a stage absent from the `lead_stage` enum, producing "0 leads" and a
   chip reading "Stage: undefined". Fails silently (no 400, no console error) since Run 66's
   `77ae9a2`. Repointed both to `?stage=sold`. — **`0692fc2`**
6. **Sidebar (all routes)** — Estimates and Contracts shared `DocumentTextIcon`, rendering as
   pixel-identical adjacent rows once the sidebar collapses to 68px and drops its text labels.
   Contracts → `DocumentCheckIcon`; 18/18 unique icon paths in both states. — **`79c8945`**

---

## Known Issues (Not Fixed)

1. **The entire dashboard period filter bar is inert.** *Design/feature decision.* All 5 period
   buttons (All Time / 7 Days / 30 Days / 90 Days / YTD) produce an identical KPI row —
   `$60K | 8 | 0% | — | —` on all five — and the UI even renders a "Clear Filters" button once a
   non-default period is chosen, asserting that a filter is active. The client builds and sends
   the params correctly (`Dashboard.jsx:612-626`); the server drops `req.query` on the floor
   (`crm.js:452`, `:462`) and the service signatures take `tenantId` only. Proven live:
   `?date_from=2030-01-01` returns byte-identical output to no filter at all. This is not
   half-wired drift — it is three unimplemented filter dimensions (date, rep, source) across
   `getDashboardStats`, `getPipelineMetrics` and `getRecentActivity`. Implementing it is feature
   work that would put currently-correct numbers at risk, so it is flagged rather than silently
   built by QA.
2. **Two dashboard stats endpoints disagree.** *Needs a developer decision.* A different endpoint,
   `GET /api/dashboard/stats` (`leads.js`, not `crm.js`), **does** honour `date_from` — and
   returns pipelineValue 1,314,892.39 / leadCount 42 where the CRM one returns $60K / 8. The
   client uses the `crm.js` one. Two endpoints, two answers, only one filterable.
3. **Form labels have 7 treatments; 31 of 53 labels are off-standard.** *Refactor.* The canonical
   rule already exists at `index.css:2239` and 22 labels match it. Not fixed because converting 31
   label sites across 5 files restructures working form markup, and uppercase-vs-sentence is a
   design call — partial normalization is worse than none. **This is the best refactor candidate
   in the backlog, because the target is already defined in CSS.**
4. **Esc-to-close is inconsistent, not absent.** *Small feature, 4 files.* `/subcontractors`
   slide-over closes on Esc; `/tasks` (same CSS class) does not, nor do the `/expenses`,
   `/work-orders`, `/pipeline` modals. Prior runs logged this as a blanket missing enhancement —
   that is inaccurate. It is drift from a pattern already implemented in the repo.
5. **`/alerts` is an orphan route.** *IA decision.* Zero `navigate('/alerts')`, zero links, no
   sidebar entry; only `App.jsx`'s viewRoutes map mentions it and nothing sets that view. It is
   the only route of 19 showing nothing selected in the sidebar, and its functionality is
   duplicated in Settings → Storm Alerts. Fixing means adding a nav entry (IA change) or deleting
   a route (destructive) — both the developer's call.
6. **Three collection endpoints return 200-with-empty rather than 404 for an unknown parent**
   (`/crm/leads/:id/activities`, `/crm/expenses/summary/:leadId`,
   `/crm/subcontractors/work-order/:id`). Confirmed **not** a security issue — the response is
   byte-identical to a random UUID, so there is no existence oracle. Cosmetic API correctness;
   changing status codes on working endpoints is a behaviour change and out of charter.
7. **LeadList page-size pills** use inline `font-weight` 700 (active) / 400 (inactive) against
   `.quick-action-btn`'s 600 base. Deliberate 2-state styling; normalizing is a refactor.
8. **Carried from Run 66 — six pipeline stages are not in the `lead_stage` enum.** *Needs a
   product decision.* `77ae9a2` stopped the 400s, but whether `material_ordered` / `scheduled` /
   `completed` / `invoiced` / `paid` / `collections` belong in the pipeline is a product call.
   `ALTER TYPE … ADD VALUE` cannot be rolled back in Postgres, so an irreversible schema change is
   not QA's to make.

---

## Test Coverage Gaps

1. **Frontend interaction testing stopped after one page.** Stage s2 hit its 80-turn cap having
   completed only `/dashboard` — where it found and fixed 2 bugs. The other 16 CRM pages were
   swept at render/computed-style depth by s3 (0 console errors, structurally consistent) but not
   clicked. **This is the largest gap in the run.** Note that both `/dashboard` bugs were
   click-only defects invisible to a render sweep, so the untested pages are not "probably fine".
2. **Three of five stages terminated on turn caps** — s1 (50), s2 (80), s4 (40). Only s3
   completed. Every stage wrote its evidence file incrementally, so no findings were lost — this
   is a direct fix of Run 66's infra regression, where s1 wrote nothing at all.
3. **10 of 26 tenant-scoped routes could not be IDOR-probed** because no tenant has any rows —
   `drip_sequences`, `financing_applications`, `documents`, `skip_trace_usage`, `automations`,
   `custom_field_definitions` are all globally empty, and `territories` does not exist under that
   name. Probing them would require writing rows to the live Neon DB. `skip_trace_usage` isolation
   was already fixed and verified in Run 65 (`df5d1ce`).
4. **Run 66's gap #2 remains open** — 255 *accepted* wrong-type write shapes from Axis D pass 2
   are still untriaged. The 4 hard failures were captured, but nobody has asked whether the
   accepted values are sane (e.g. `POST /api/crm/automations` returns 201 for an object, a number
   and a boolean as a `name`). Still the largest untriaged evidence set in the pipeline.
5. **Storm Map, Admin and roof drawing remain render-depth only** — no end-to-end workflow has
   ever been exercised on them.
6. **Keyboard navigation is only partially covered.** Esc was measured across 5 overlays this run
   (finding #4 above), but Tab order, focus rings and Enter-submit remain untested app-wide.
7. **The five Run-63 `.qa-*.mjs` harnesses were not re-run** — per the standing resume rule, the
   drift gate (`server/src/routes` + `server/src/services` vs baseline `626c7cd`) was empty.
   Drift baseline for the next run: **`79c8945`**.
8. **Mobile/375px sweep not revisited** (mobile is paused). Google-geocoding and side-effecting
   routes remain permanently excluded per the standing cost rule — enumerated, not silently capped.

---

## Environment and Hygiene

- **The stale `:3001` server is gone.** PID 33112 — started 7/30 05:47, four days stale — was
  killed by s2 and replaced with a fresh instance. Two prior runs reported it and deliberately did
  not kill it, which means **every live UI check in Runs 65 and 66 ran against a July-30 API**.
  This is the first run whose live UI checks exercise current API code.
- `client/vite.config.js` proxy verified clean at `:3001`; tracked tree clean at close, with no
  unfinished fix left in the working directory.
- **Net database writes: 0.** All 7 QA-created `custom_field_definitions` rows were deleted; the
  tenant now has 0, confirmed by the verification stage.
- Stage cost s1–s4: **$24.49**.
- Minor labelling slip for the next run to be aware of: stage s4 wrote its artifacts under an
  `r68-` prefix (`qa-r68-verify.json`, `.qa-r68-*.mjs`, `r68-admin.png`) although this is Run 67.
  The contents are Run 67's.
