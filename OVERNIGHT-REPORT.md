# StormLeads — Overnight QA Report

**Run 75 · 2026-08-14**
Branch `feat/financing` · Baseline `76fe7d3` (tag `pre-overnight-20260814`) · Head `c1dc23c`
API `http://localhost:3001` · Tenant `waterloo` (`791bb51d-3293-4839-92e9-bd4d4f873af2`)

---

## QA Test Summary

| Metric | Count |
|---|---|
| Frontend routes tested | 18 sidebar routes (19 URLs incl. 2 fall-throughs) |
| Settings tabs tested | 15 of 15 |
| Modal/overlay surfaces opened | 8 |
| API endpoints exercised | **261 of 272 (96.0%)** |
| API endpoints skipped (charter-prohibited) | 11 |
| Recorded API requests | 536 in saved artifacts + ~46 in the P1/action passes |
| **Bugs found** | **5** |
| **Bugs fixed** | **3** |
| UI inconsistencies found (new) | 1 |
| UI inconsistencies fixed | 1 |
| 5xx responses observed | 2 (1 real defect, 1 transient upstream) |
| Commits produced | 5 (3 fixes, 2 archived reports) |
| Final `vite build` | **PASS** (exit 0, 8.06 s) |

API breadth is up from 244/272 (89.7%) in Run 74 to **261/272 (96.0%)** — the highest
recorded. The 11 untested routes are all deliberately excluded by charter (paid
third-party keys, bulk geocoding, bulk CSV/county import, outbound email).

### Stage completion

| Stage | Outcome | Turns | Commits |
|---|---|---|---|
| s1 api-test | `error_max_turns` (ran as **two** sessions) | 51 / 50 | `7c373fc` |
| s2 frontend-test | `error_max_turns` | 81 / 80 | `1847292`, `e44cdd8` |
| s3 ui-audit | **completed cleanly (`end_turn`)** | 74 | `f788c22`, `c1dc23c` |
| s4 verify | `error_max_turns` | 41 / 40 | none |

s3 is the **first stage in seven runs to finish without hitting its turn cap**. s1 and s4
both hit the cap in the middle of destructive cleanup work, which is the direct cause of
the data-residue issues in "Known Issues" below.

---

## Backend API Test Results

Route inventory: **272 routes across 36 files** — GET 132, POST 88, PATCH 26, PUT 8,
DELETE 18; 109 carry `:params`.

| Category | Routes exercised | Result |
|---|---|---|
| GET (all categories, real IDs) | 132 / 132 | 99× 200, 12× 400, 5× 403, 15× 404, **0 5xx** |
| Write routes (POST/PATCH/PUT/DELETE) | 129 / 140 | 211× 400, 90× 404, 69× 200, 16× 201, 3× 403, **1× 500** |
| Nullable-coercion sweep (P1, 22 cases) | 8 services | 17× 400, 5× 200, **0 5xx** |
| Idempotent round-trip PATCH | 4 probes | 4 "failures", all confirmed **correct business rules** |
| Action POSTs with real IDs | 24 routes | 1× 500 (transient upstream, see below) |

### Fixed

**`7c373fc` — duplicate customer-facing document numbers (`POST /api/crm/invoices`, `POST /api/estimates`)**
`createInvoice` (`invoiceService.js:48`) and `createEstimate` (`estimateService.js:40`)
derived the document number from `COUNT(*)+1`. Any delete makes `COUNT(*)+1` point back at
a live number, and there is no unique index on `invoice_number`/`estimate_number` to catch
it. Live evidence: `EST-021`, `EST-022` and `EST-082` each existed twice, and invoices held
18 rows while having already issued `INV-0019` — the next create was a guaranteed duplicate
of a live invoice. Both services now use `MAX(numeric suffix)+1`. Verified end-to-end: the
create/create/delete/create sequence that reproduced the collision now issues
`INV-0020/0021/0022` with no repeat. Independently re-verified by s4 at 06:17 — a fresh
create returned `INV-0023` (`MAX+1`), where the old logic would have returned `INV-0022`,
a live number. **PASS.**

### Found, not fixed

**`PATCH /api/crm/subcontractors/:id` returns 500 on `{"name": null}`**
`subcontractors.name` is `NOT NULL`, but `updateSubcontractor`
(`subcontractorService.js`) only checks `data[field] !== undefined` before adding a field
to the `SET` clause. An explicit `null` therefore reaches Postgres as a not-null violation,
which is unhandled and surfaces as `500 {"error":"Internal server error"}` instead of a
`400`. The same handler accepts an *object* for `name` and silently stringifies it — that
is how subcontractor `1acc6d59` acquired the name `{"deep":[1,null]}`. s1 identified this
as fixable and in-charter but hit its turn cap before fixing it.

### Investigated and cleared

- **`POST /api/properties/:id/fema-lookup` 500** — reproduced 3× and returned **200** every
  time; the property row and all handler logic replicated cleanly inside a rolled-back
  transaction. The running server (05:05) post-dates the source file (April), so it was not
  a stale-code artifact. Ruled a **transient upstream failure of the FEMA NSI API**, not a
  code defect.
- **`updatePlan` camelCase/snake_case mismatch** — `financingService.updatePlan`
  destructures `isActive`/`isDefault` while the API returns `is_active`/`is_default`, so a
  snake_case PATCH yields `fields.length === 0` → `404 "Plan not found"` for a plan that
  exists. **The client sends camelCase**, matching the service, so the UI toggle works. An
  audit confirmed `updatePlan` is the *only* camelCase-destructuring update service — the
  "silent broken save" family does not exist elsewhere. Tester-side artifact, not a bug.
- **Bug family #1 ("create coerces, update does not") is now CLOSED.** All 22 remaining
  cases degrade to a graceful 400, never a 5xx, and every client form
  (`InvoicesView.jsx:548,554`, `SubcontractorsView.jsx:239`, `ExpensesView.jsx:78,80`)
  already coerces before sending. Do not re-file.
- **Bug family #2 (`(x||[]).map` element access)** — audited across all JSONB read paths.
  `estimateService.js:595` guards with `item?.quantity`; `workOrders.js:241` filters
  elements; milestones are table rows. Clean.
- **No cross-tenant leakage.** A financing plan that appeared foreign was verified correctly
  tenant-scoped.
- **`canvass_territories` does exist** — the standing gotcha claiming otherwise is stale.

---

## Frontend Feature Test Results

All 19 URLs rendered with **zero console errors and zero failed network requests**.

| Page | Tested | Result |
|---|---|---|
| Dashboard | Widgets, funnel, storm activity, tasks, activity feed, 4 clickable stat cards | PASS — all 4 cards navigate correctly |
| Leads | Sort (score/created/value), pagination (25/50/100), 4 filter dropdowns, page search, CSV export | PASS — Stage=Contacted → 6 rows, URL `?stage=contacted`; CSV downloaded |
| Lead detail (`/leads/:id`) | Deep link, slide-over, score breakdown, activity modal | PASS — breakdown arithmetic verified (0+2+0+0+0+0+2 = 4, badge "Score: 4/100") |
| Pipeline | Native HTML5 drag-and-drop, both directions | PASS — persisted to DB and dragged back |
| Estimates | In-place builder, line-item math, profit margin | PASS — 3 × $250 = $750; 30% → cost $525/profit $225; 40% → cost $450/profit $300 |
| Invoices | In-place builder, Record Payment, 7 payment methods, client-side validation | PASS — $0 amount rejected client-side with no network write |
| Work Orders | 20 orders, kanban, detail, milestones, line items, Export PDF | PASS — regression check of `8a45209`: 5 no-op saves, **0 4xx/5xx** |
| Tasks | Toggle-complete round-trip verified against the DB | PASS — `completed_at` and `status` stay in sync |
| Calendar | Month/Week/Day/List/Today, toolbar title | PASS (tenant has 0 events) |
| Reports | 5 date presets, 9 recharts surfaces, Compare toggle, CSV export | PASS |
| Storm Map | All 6 layer toggles | PASS — 0 console errors, 0 failed requests. FEMA properties not touched, per charter |
| Canvassing | Map, stats bar, Drop Pin | PASS (pin drop not exercised — writes rows) |
| Settings | **All 15 tabs** individually swept | PASS — all render distinct correct content |
| TopBar global search | Ctrl+K dropdown across leads/contacts/estimates | **BROKEN → FIXED (`1847292`)** |

### Broken and fixed

**`1847292` — global search dropdown rendered literal `"null"` and raw enum stages**
`TopBar.jsx:147,155,163` built each result's secondary line by interpolating raw DB columns
into template strings. Confirmed rendered output before the fix: `"null — new"`,
`"null — estimate_sent"`, `"Test null"`, `"null null"`, `"homeowner"`, `"draft"`.

Two defects in the same expressions: (1) `${l.address}` renders the string `"null"` when the
column is null; (2) **fourth appearance of the raw-enum-in-UI family** — every other surface
in the app (`LeadList:32`, `LeadDetail:105`, `Dashboard:62`, `ReportsView:25`,
`ClientStatusPage:6`) maps stages through a `stageLabels` dictionary, and TopBar was the
only consumer interpolating `lead.stage` directly. Joins now drop falsy parts and stages
resolve through the same map, with a `titleCase()` fallback for role and status. Verified
after the fix: "Appt Set", "Estimate Sent", "Homeowner", "Draft" — zero literal `"null"`,
zero raw enums.

Notably, a page-level text scan of all 19 routes found **zero** raw enums. The defect lived
in a dropdown that only exists after typing.

### Still needs attention

- **`MobileTaskSection` ignores two props it is passed.** All 3 call sites pass `icon` and
  `iconColor`; the component uses neither and hardcodes `ClipboardDocumentListIcon`. Gated
  behind `isMobile` (≤768px, `TasksView.jsx:102`), and mobile is paused, so this is a
  developer ticket rather than an in-charter fix.
- **LeadDetail Roof Type dropdown** could not be reliably enumerated — a tester-tooling
  limitation, not evidence of a defect. The same CustomSelect opened correctly 4/4 times on
  `/leads` filters.
- **Esc-to-close remains inconsistent: 1 of 5 modals** (`/subcontractors` only). Unchanged
  from prior runs.
- `/contacts` and `/content-studio` fall through to Dashboard. Neither route exists;
  `/content-studio` is a charter entry for an unbuilt feature.

---

## UI Consistency Audit Results

All 7 audits ran against real browser measurement across 18 routes at 1280×869, dark mode.

| Audit | Verdict |
|---|---|
| **Icons** | **CLEAN.** 43/43 import sites resolve to `@heroicons/react/24/outline`. Every `<svg>` on all 18 routes carries the outline signature (`viewBox="0 0 24 24"` / `fill="none"` / `stroke-width="1.5"`). Zero solid variants; zero lucide/react-icons/fontawesome/material/tabler. The only non-Heroicon SVGs are recharts surfaces on `/reports` (data-viz), a map-pin legend swatch (`CanvassingMode.jsx:336`) and star glyphs inside a Google Maps InfoWindow HTML string (`StormMap.jsx:1764`) — none are UI icons. **No fix needed.** |
| **Buttons** | **CLEAN on primaries.** `.auth-btn` renders *identically* on 8 pages (36px / `0 24px` / 13px / 700 / same oklch) with zero deviation. Row-action buttons agree exactly at 31px across `/estimates` (156 buttons), `/contracts` (19) and `/invoices` (21). Known drift re-confirmed, not re-filed: `.quick-action-btn` computes to 8 distinct heights (21–38px), every one caused by a per-site inline padding override rather than the class. |
| **Toolbars / Headers** | **NOT consistent — structural gap.** 17 of 18 routes have no `.page-header`/`<header>`/`.view-header`; there is no shared page-header component. Consequence: 5 distinct heading treatments (28px/820 → 20px/800), and **there is no `<h1>` anywhere in the app** — every page's top heading is an `<h2>`, and `/reports` has no page-level heading at all. Recorded as a developer ticket; fixing it means touching 18 views, outside the QA charter. |
| **Sidebar / Nav** | **CLEAN.** All 18 items: 18px Heroicons (0 missing), 42px height, 12px radius, 500/600 font weight, exactly one `.is-active` on every route. Padding and font-size differences between parents and children are deliberate hierarchy. |
| **Forms** | **CLEAN.** Zero native `<select>`, zero native date/time inputs across all 18 routes — **third consecutive run holding**. Exactly two `.form-input` height overrides exist in the entire codebase (`Dashboard.jsx:528`, `MaterialsView.jsx:309`); both were investigated and cleared as deliberate compact-context fits. `.address-search__input`'s 0 radius is correct — the wrapper carries the radius and border. |
| **Spacing** | **Known two-system issue CONFIRMED, unchanged.** Root font-size is 14px and Tailwind rem utilities resolve against it, so Dashboard and Pipeline land on fractional pixels (17.5px, 8.75px, 10.5px) while px-var pages land on 24px/16px/12px. Five distinct `.glass` paddings from two coexisting systems. Every fractional pixel in the app traces here. Unifying it means converting Dashboard and Pipeline off Tailwind rem spacing — a refactor, outside charter. |
| **Modals** | **1 defect found and fixed (`f788c22`).** 22 `.modal-backdrop` usages inventoried across 15 components; 19 of 22 use the wrapping-parent pattern and animate correctly. Z-index spread, backdrop variance and title-size variants re-confirmed intentional. |

### The one UI defect — `f788c22`

**`.modal-scale-in` was referenced as a className in four components but never defined as a
CSS selector.** `CalendarView.jsx:260`, `DripSequences.jsx:585`, `EstimatesView.jsx:2872`
and `InvoicesView.jsx:1059` all render `className="glass modal-scale-in"`, but
`modal-scale-in` existed *only* as a `@keyframes` name (`index.css:4282`). The class
computed to `animation-name: none`.

Those four modals animated correctly anyway — purely by accident of also matching the
separate `.modal-backdrop > .glass` rule. **Every screenshot, visual diff and computed-style
sweep passed it**, because there was no rendered artifact to find. The declared contract was
silently unenforced: restructuring any of them to the sibling-backdrop pattern (already used
by PhotoAnnotator and LeadDetail) would have silently dropped the animation with nothing to
grep for. Fixed by defining the selector with the identical 200ms `var(--ease-apple)` timing
the `.glass` rule already applied, leaving all four existing usages behaviourally unchanged.

**Method note:** this was findable only by diffing the set of classNames *used* in JSX
against the set of selectors *defined* in CSS. That is the second run running where the
defect was caught by a set-difference over source rather than by inspecting output.

### Deliberate skips (attempted or considered, then rejected on evidence)

1. **`LeadDetail.jsx:2474`** (Weather Damage Verification Report) — the fix was applied here
   and **reverted**. The panel is centered with `transform: translate(-50%, -50%)` and the
   `modal-scale-in` keyframe ends at `transform: none`, which would have clobbered the
   centering and thrown the modal off-screen-centre. Never apply a transform-based animation
   class to a transform-positioned element.
2. **`PhotoAnnotator.jsx:208`** — safe on positioning and caching, but `getPos` (`:87`) does
   not normalise by `canvas.width / rect.width`, so a 200ms scale animation would create a
   window of skewed drawing coordinates. That introduces a new failure mode into a working
   feature for a cosmetic gain.

---

## Bugs Fixed

1. **`POST /api/crm/invoices` + `POST /api/estimates`** — document numbers derived from
   `COUNT(*)+1` collided with live numbers after any delete (3 duplicate estimate numbers
   already in the data; the next invoice was a guaranteed duplicate) — switched both services
   to `MAX(numeric suffix)+1`; verified end-to-end and independently re-verified by s4.
   **`7c373fc`**
2. **TopBar global search (Ctrl+K)** — result lines interpolated raw DB columns, rendering the
   literal string `"null"` for missing addresses/names and raw enums (`estimate_sent`,
   `homeowner`, `draft`) — joins now drop falsy parts and stages resolve through the shared
   `stageLabels` map with a `titleCase()` fallback. **`1847292`**
3. **Global CSS / 4 modal components** — `.modal-scale-in` was used as a className but never
   defined as a selector, computing to `animation-name: none` and masking a silently
   unenforced contract — defined the selector with the same timing the `.glass` rule already
   supplied. **`f788c22`**

---

## Known Issues (Not Fixed)

### 1. QA probe residue left in the database — this run did NOT achieve net-zero writes

**This is the most important carry-forward.** Both s1 and s4 hit their turn caps in the
middle of cleanup. Verified against the live DB at report time:

| Table | Baseline | Current | Delta |
|---|---|---|---|
| `estimates` | 83 | **95** | +12 (`EST-084`…`EST-095`) |
| `invoices` | 18 | **21** | +3 (`INV-0020/0021/0022`, all draft) |
| `work_orders` | 17 | **20** | +3 ("Work Order - 123 Test St", pending) |
| `material_orders` | 3 | **6** | +3 |
| `leads` (live) | 32 | **24** | −8 (soft-deleted) |

Two further unrestored mutations:

- **Work order `89a5ed32` ("Work Order - Estimate") is wrongly marked `completed`** with
  `completed_at = 2026-08-14T10:24:00Z`, while **all 7 of its milestones are `completed:
  false`**. Caused by a `PUT /api/crm/work-orders/:id/complete` probe. s1 was tracing the
  original value when it hit its cap.
- **Subcontractor `1acc6d59`'s name was overwritten to `{"deep":[1,null]}`** by a fuzz PATCH.
  The original value is not recoverable from the run artifacts or seed data.

Audited and **clean** — no action needed: `alert_configs` was not modified (`updated_at`
still 2026-08-06), and the `tenants` row has intact `name`, `slug` and `branding` with only
`updated_at` bumped. The junk-body `PUT`s were no-ops because those handlers allowlist fields.

**Remediation is already written and ready.** `server/.qa-run75-s4-cleanup.mjs` was corrected
after the incident below and needs only to be run:
`cd server && node .qa-run75-s4-cleanup.mjs`. It soft-deletes the fuzz leads (already done),
hard-deletes today's 18 harness rows, and removes the two orphans. The work-order status and
subcontractor name must be repaired separately.

### 2. s4's "dry run" was not dry — it performed 8 real soft-deletes

`.qa-run75-s4-cleanup.mjs` originally derived its dry-run `SELECT COUNT(*)` from the real
`UPDATE` by regex. The rewrite **silently failed on `SET deleted_at = NOW()`**, so
`DRY=1` executed the live `UPDATE`. Eight probe leads were soft-deleted at 11:21:49Z, the
script then crashed on `rows[0].c` (an `UPDATE` returns no rows) and aborted before its
remaining steps. The eight deletions match the intended plan and are not harmful — the fuzz
rows are now correctly gone from the leads table and pipeline kanban — but they happened
without the review the dry run was supposed to enable, and steps B–D never ran.

The script has since been rewritten to pass an explicit `countSql` alongside every mutation.
**Standing rule: never derive a dry-run query from a mutation by string transformation.**

### 3. `PATCH /api/crm/subcontractors/:id` returns 500 on a null name

Root cause identified (unhandled `NOT NULL` violation — see Backend section). Should return
`400`. Not fixed; s1 ran out of turns. In-charter and cheap to fix next run.

### 4. Pre-existing duplicate document numbers remain

`EST-021`, `EST-022` and `EST-082` each still exist twice. `7c373fc` prevents *new*
collisions but does not backfill old ones. Two simultaneous creates can also still race.
Both need a **unique index plus a backfill migration** — a schema change, not a QA fix.

### 5. `/dashboard` Days-in-Stage is computed from the wrong column

Still open from Run 74. It averages `updated_at`, a generic trigger-maintained timestamp, so
any unrelated lead edit zeroes it. **The data needed is not recorded** — this requires a
`stage_changed_at` column plus a backfill. Developer ticket.

### 6. Deferred design decisions (re-confirmed present, deliberately not changed)

- No `<h1>` anywhere in the app; no shared page-header component (17 of 18 routes).
- Two coexisting spacing systems (Tailwind rem on a 14px root vs. px vars).
- `.quick-action-btn` spans 8 heights via per-site inline padding overrides.
- Esc-to-close works on 1 of 5 modals.
- Two modal surfaces (PhotoAnnotator, LeadDetail inspection report) have no entrance
  animation — see "Deliberate skips".
- Dead assets: `client/src/assets/icons/` (18 Streamline SVGs), `assets/icons-backup/` (18
  more) and `Icons.jsx.backup` (35 inline SVGs) have zero references and are never bundled.
  Removal is a developer call.

---

## Test Coverage Gaps

1. **Three of four stages hit their turn cap** (s1, s2, s4 — only s3 completed). Each cap
   truncated remaining work; s4's was the most costly, ending mid-cleanup with three of its
   six planned tasks never started.
2. **s4 verified only one of the three fixes.** `7c373fc` was re-verified against the live
   API and passed. **`1847292` (TopBar search) and `f788c22` (modal-scale-in) were never
   independently re-verified in a browser** — both rest solely on the fixing stage's own
   testing. Both should be re-checked first next run.
3. **No edge-case pass ran at all.** Empty states, required-field validation, browser
   back/forward and the 375px responsive check were all in s4's charter and none were
   executed.
4. **11 API routes untested by charter:** skip-trace (5 — paid key), property geocode/CSV
   import/trigger-import/import-progress (4 — costs money or starts a real bulk import),
   `financing/plans/sync` (paid adapter), `invoices/:id/send-email` (outbound mail).
5. **Three collection handlers never execute** because their tables are empty in this tenant:
   drip-sequences, canvass territories, financing applications.
6. **The estimate half of the numbering re-verification did not run.** s4's probe used
   `/api/crm/estimates`; the correct path is `/api/estimates`. It 404'd and there were no
   turns left to retry. The invoice half passed.
7. **Concurrency is untested.** Every sweep is single-threaded and sequential, so the
   document-number race condition cannot be observed by this harness.
8. **Server-side correctness is invisible to the frontend sweep.** It sees rendered text and
   HTTP status only — a 200 that stored the wrong value is indistinguishable from success.
9. **Data-shape blindness.** Every finding this run came from data that happens to exist in
   this tenant. A fully-populated tenant would have shown a clean global search.

---

## Corrections to Prior Findings

- **The `warm` priority on task "QA72 verify task write" is NOT residue.** `tasks.priority`
  is typed as the `lead_priority` enum, and `TasksView.jsx:16-20` maps `hot/warm/cold` →
  `High/Medium/Low`. The value is valid and renders as "Medium". s2's report described it as
  "a LEAD priority on a TASK" rendering as "WARM" — both halves were wrong. Do not re-file.
- **s1's claim that "all probe rows were deleted; counts unchanged at 18/83" is false as of
  end of run.** It was true when written at 05:07, then invalidated by s1's own validation
  sweep at 05:23–05:24. Verified counts are 21 invoices / 95 estimates.
- **`canvass_territories` exists** — the standing gotcha saying otherwise is stale.

---

*Generated by the overnight QA pipeline, stage s5-report. All counts in this report were
independently re-queried against the live database rather than taken from stage
self-assessments.*
