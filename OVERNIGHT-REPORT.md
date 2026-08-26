# StormLeads — Overnight QA Report

**Run date:** 2026-08-26
**Branch:** `feat/financing`
**Baseline:** `6320fbe` (`checkpoint: pre-overnight-run 2026-08-26`)
**Head at report time:** `18837f7`
**Build:** PASS — `vite build`, 7.86s, exit 0, 0 errors
**Net DB writes:** 0 (every stage stubbed or restored its writes; verified per-stage)

---

## Stage completion — 2 of 4 test stages hit the turn cap

This is load-bearing context for every number below. Two stages terminated on
`max_turns`, not on completion, so their coverage is partial and their artifacts
are missing.

| Stage | Terminal reason | Turns | Result |
|---|---|---|---|
| s1 — api-test | **`max_turns` (50)** | 51 | 1 backend defect found + fixed, then capped. **No results file written.** |
| s2 — frontend-test | `end_turn` (completed) | 74 | 13/13 pages, 0 defects. Artifact written. |
| s3 — ui-audit | `end_turn` (completed) | 63 | 2 defects found + fixed. Artifact written. |
| s4 — verify | **`max_turns` (40)** | 41 | Capped mid-verification. **No verdict produced.** |
| s5 — report | (this stage) | — | Report, history, resume, commit, build. |

**This is the eighth consecutive night with multiple capped stages.**

---

## QA Test Summary

| Metric | Value |
|---|---|
| API endpoints — inventory | **272 route patterns** across 36 route files (inventory rebuilt tonight) |
| API endpoints — executed live tonight | **133 of 272 (48.9%)** — 132 GET + 1 targeted POST |
| API endpoints — *not* executed tonight | **139** (all POST/DELETE/PATCH/PUT bulk sweeps) — s1 capped first |
| Frontend pages driven end-to-end | **13 of 13** charter routes, + **15 of 15** Settings tabs, + 4 sub-surfaces |
| Routes regression-swept (UI audit) | **18** authenticated routes |
| Modals opened and measured | **8** |
| **Total bugs found** | **3** |
| **Total bugs fixed** | **3** (100%) |
| UI audit findings | **6** — 4 fixed, 2 deferred (documented developer decision) |
| Commits made | **3** — `842cda3`, `aff13c2`, `18837f7` |
| 5xx responses observed after fixes | **0** |
| Page errors across the entire frontend run | **0** |

Split by area: **1 backend defect**, **2 frontend/UI defects**. All three were
found by a *newly targeted* check, not by a repeat sweep.

---

## Backend API Test Results

Server: `http://localhost:3001`, tenant `waterloo`, role `admin`. Route inventory
regenerated tonight at 05:01 to `C:/tmp/route-inventory.{txt,json}`.

### Coverage by method

| Method | In inventory | Executed tonight | 5xx | Notes |
|---|---|---|---|---|
| GET | 132 | **132 (100%)** | **0** | 105x200, 12x400, 5x403, 10x404 |
| POST | 88 | 1 (targeted) | 0 | Only `POST /api/crm/work-orders`, as the probe for defect #2 |
| DELETE | 18 | 0 | — | **Not run — s1 capped** |
| PATCH | 26 | 0 | — | **Not run — s1 capped** |
| PUT | 8 | 0 | — | **Not run — s1 capped** |
| **Total** | **272** | **133 (48.9%)** | **0** | |

The GET sweep is clean: zero 5xx across all 132 patterns. The non-200s are all
expected — the 5x403 are the `/api/admin/*` role guard correctly rejecting a
plain `admin`, and the 400s/404s are missing-required-param and
empty-table-for-this-tenant responses documented in prior runs.

**Regression note:** last night reached 258 of 272 executed, including PATCH/PUT
at 34 of 34 for the first time in the pipeline's history. **Tonight reached
133.** The write-handler sweeps did not regress — they were never run, because
s1 spent its budget on the defect below and then hit the cap.

### Endpoint category detail

- **auth** (`/api/auth/*`, 5 routes) — `GET /api/auth/me` 200 in the sweep. Login
  verified working by every stage (all four stages authenticated successfully).
  `refresh` was exercised indirectly and correctly all night — see "Verified
  non-bugs".
- **admin** (`/api/admin/*`, 6 routes) — 5x403 for role `admin` (correct guard).
  **Defect #1 found here** and re-verified with a real `super_admin` token.
- **CRM leads / pipeline / tasks / activities / calendar / canvassing** — all GET
  patterns 200 or a correct empty-table 404. No 5xx.
- **estimates / invoices / contracts** — all GET patterns clean. Write paths were
  proven from the frontend instead (see next section), not by API sweep.
- **work-orders** — **Defect #2 found here**, on the create path.
- **alerts / counties / notifications / tenant-settings / financing** — GET clean.

### What was fixed

**`842cda3` — prototype-key lookups bypassed two whitelist fallbacks and 500'd.**

`MAP[userInput] ?? fallback` on a plain object literal is unsafe: the object
inherits `Object.prototype`, so `constructor` / `__proto__` / `toString` /
`valueOf` / `hasOwnProperty` all return an **inherited truthy value** and the
fallback never fires. Ordinary unknown keys fell back correctly — which is
exactly why every prior sweep passed. The whitelist only leaked on inherited
names.

Two request-reachable sites, both confirmed 500 before / clean after:

1. `server/src/routes/admin.js:126` — `SORTABLE[sort]` was spliced into an
   `ORDER BY` interpolation, so an inherited `Function` stringified into the SQL
   text and Postgres raised a syntax error.
   `GET /api/admin/tenants?sort=constructor` gave a **500** (5 of 5 prototype
   keys). `super_admin`-only; the 403 guard for plain `admin` is unchanged.
2. `server/src/services/workOrderService.js:150` — `MILESTONE_TEMPLATES[templateKey]`
   returned a `Function`, so `template.milestones` was `undefined` and
   `defs.map()` threw. `milestone_template` is **body-controlled**, and
   `createWorkOrder` INSERTs the `work_orders` row *before* calling this
   (`:320`) — so **each 500 also left an orphan work order with zero
   milestones** (4 of 4 probes).

Both fixed with `Object.prototype.hasOwnProperty.call` before the lookup.
Verified after a server restart (mtime-vs-process-start checked, per the Run 91
stale-server trap): admin **5/5 prototype keys now 200**, work orders **4/4 now
201** with the correct 7 default milestones and **0 orphans**. Net DB writes 0.

Confirmed still present in the tree at report time — `admin.js:130`,
`workOrderService.js:156`.

**Deliberately not changed:** `stormHistoryService.js:49` carries the same
pattern but is called only with hardcoded `'hail'`/`'tornado'`, so it is not
request-reachable and is out of charter.

---

## Frontend Feature Test Results

**13 of 13 charter routes driven end-to-end — zero app defects found.** Every
route was *driven*, not merely rendered. Across the whole run: **0 page errors,
0 API responses >=400, 0 net DB writes.** Nothing was broken, so nothing was
committed from this stage.

Full record: `C:/tmp/frontend-test-results.txt`.

| Page | What was tested | Result |
|---|---|---|
| `/dashboard` | 5 stat cards + 2 buttons all navigate (7/7); period filters 7d/30d/90d/YTD/All fire the correct `date_from`; funnel tile to `/leads?stage=contacted`; leaderboard row to `?assigned_rep=`; activity item opens the lead slide-over; Set Goal reveals inputs | **PASS** |
| `/storm-map` | Map renders; all 5 layer toggles (Hail, Wind, Tornado, Thunderstorm, Honey Holes) produce 0 new page errors each; address search, swath slider, hail legend present | **PASS** |
| `/pipeline` | 3 boards switch (Sales 7 cols / Production 5 / Billing 4); card opens quick panel; **drag-and-drop New to Contacted works** — counts 9 to 8 / 2 to 3, and `PATCH /api/crm/leads/<id> {"stage":"contacted"}` | **PASS** |
| `/leads` | Search + 4 filters + sort, each verified against outgoing query params (`&stage=new` 9 rows, `&priority=hot` 2, `&source=storm_map` 5, `&min_score=80` 1) | **PASS** |
| lead detail (slide-over) | All 11 sections render; score-breakdown modal; stage picker; **save path proven** (`PATCH ... {"stage":"contacted"}`); Log Activity, Quick Call, Generate Contract, Share Status Page | **PASS** |
| `/estimates` | List + **full Estimate Builder**: 9-section rail, Blank Row adds a line item, **live totals recalculate** ($0.00 to $3.00), **Save Draft fires `POST /api/estimates`** + toast | **PASS** |
| `/invoices` | 5 filter tabs; New Invoice editor; From Estimate empty state correct; row Edit full editor; **Record Payment fully proven on INV-0007** via `POST /invoices/<id>/payments {"amount":4397,...}` + toast; correctly absent on drafts | **PASS** |
| `/work-orders` | 10 WOs, board columns, New Work Order modal, WO detail with 7 milestones; **milestone toggle fires `PATCH /work-orders/<id>/milestones {"completed":true}`** | **PASS** |
| `/tasks` | Empty dataset; both tabs switch with distinct empty states; **task create fires `POST /api/crm/tasks {"title":...,"priority":"warm"}`** | **PASS** |
| `/calendar` | All 4 views switch (Month/Week/Day/List); next goes to September, Today returns to August | **PASS** |
| `/reports` | All 5 date presets fire correct ranges on **both** `/reports/revenue` and `/reports/pipeline`; 9 recharts surfaces; empty-range correctly swaps to the no-data state and back | **PASS** |
| `/canvassing` | Map renders, stat bar correct, Drop Pin enters placement mode | **PASS** (pin drop not completed — see gaps) |
| `/settings` | **All 15 tabs** driven via `?tab=`: profile, company, billing, payments, team, alerts, notifications, email, financing, automations, drip-sequences, custom-fields, pricing, contracts, reviews. 0 page errors, no `undefined`/`NaN`/`[object Object]` in any panel | **PASS** |
| `/content-studio` | Does not exist — `path="*"` redirects to `/` | Known non-bug |

### What was broken and how it was fixed

**Nothing.** Zero frontend defects were found by s2, so there is nothing to
report in this column and no commit from this stage.

### What still needs attention

- **`/settings` to Custom Fields still shows the leftover "QA Options Probe"
  row.** User-visible, left over from a prior QA run. Needs a developer's
  go-ahead to delete — see Known Issues.
- **Data drift, not a defect:** `/work-orders` shows Pending 7 where memory
  recorded 0. The data changed; the page is correct.

### The finding that matters more than the zero

**Eight separate "dead controls" turned out to be tester selector errors, not app
bugs.** Each one initially looked like a broken feature. The costliest four are
now documented recipes:

1. `CustomSelect` options are class-less **portal** `div`s that fire on
   `onMouseDown` — `[role=option]`, `[class*=option]` and `[class*=dropdown]` all
   return **0 matches**. Locate the portal by `zIndex === '9999'` on a
   `document.body` child.
2. `.stat-card` matches **nothing** on the dashboard — the real selector is
   `.glass.cursor-pointer.group`.
3. The Pipeline drop target is `min-w-[280px]`; `[class*="column"]` matches
   **zero** elements, which makes the working Kanban look undraggable.
4. Inputs with no `type` attribute are invisible to `input[type="text"]`.

An existing rule also had to be **refined**: the Run 77 "dead input pipeline"
tell (`:hover` count 0) fired twice tonight — once genuinely (all 15 Settings
tabs frozen at an identical `len=466`, fixed by closing and re-navigating the
browser) and once as a **false alarm**. It now requires a confirming click
before it can be trusted.

---

## UI Consistency Audit Results

18 authenticated routes swept, 8 modals opened and measured. Build PASS, net DB
writes 0 (every non-GET stubbed for the whole session). Full record:
`C:/tmp/ui-audit-results.txt`.

**Scope decision:** prior runs recorded the seven static audits as *converged*,
and named the one open gap — **modal interiors**: "a violation inside an
unopened modal is invisible to every runtime sweep run so far." This run took
that gap. It produced **both** of the night's UI defects. The static seven got a
one-call regression pass only, not a re-spend.

| Audit category | Result | Detail |
|---|---|---|
| **Icons** | **PASS — no non-Heroicon icons found** | 43 of 43 heroicon imports are `24/outline`; zero from `/24/solid`, `/20/solid`, `/16`. Zero lucide, react-icons, fontawesome, material-icons, phosphor, feather. Runtime foreign-SVG count **0 on 18/18** routes. The only 2 inline `<svg>` are documented non-icons (a map-pin legend swatch, and star glyphs inside a Google InfoWindow HTML string). |
| **Buttons** | **PASS on 18 routes — 1 defect found inside modals, fixed** | Radius census over 18 routes resolves to documented families only (12px default, 999px pills, 8px 28x28 icon buttons, 0px nav links, plus `clamp()` serialisation artifacts). The `/alerts` 8px pair is the documented numeric stepper. **Modal interiors were a different story — see defect (a).** |
| **Toolbars / Headers** | **PASS — consistent across all pages** | `.topbar` is 56px **and** carries `.glass` on **18/18**. Exactly one `<h1>` on **18/18**. |
| **Sidebar / Nav** | **PASS — no issues** | 18 nav links / 18 nav icons on 18/18; inter-item gaps identical on every route. `.nav-link.is-active` = 1 on 17/18; `/alerts` = 0 is the documented orphan route with no sidebar entry. |
| **Forms** | **PASS on components — DRIFT on labels (deferred)** | **Zero native `<select>`** in the entire `src` tree and 0 at runtime on 18/18. **Zero native date/time inputs**, source *and* runtime. CustomSelect / DatePicker rules fully respected. `.form-input` signature uniform (36px / 12px / 13px) **including inside modals**. The only non-`.form-input` inputs are the 2 documented `/alerts` stepper inputs. **Label drift is real and unfixed — see Known Issues.** |
| **Spacing** | **PASS — 1 collision found and fixed** | `scrollWidth - clientWidth = 0` on **18/18** (no horizontal overflow). Nav gaps identical across all routes. One real collision: the `<h3>` in the Expenses modal overlapped its close button — fixed in `aff13c2`. |
| **Modals** | **2 DEFECTS FOUND AND FIXED** | 22 close buttons audited: 6 on `.slide-over__close`, **16 hand-rolled inline**. All now carry a class; every measured instance is **32x32 at dTop 25 / dRight 25** with a working, reverting `:hover`. Entrance animation resolves to `modal-scale-in` on every panel measured. 0 overlays open at rest on 18/18. The z-index spread (101/300/400/1000/9999) is documented functional stacking order, deliberately **not** normalised. |

### The two modal defects

**(a) `aff13c2` — 16 of 22 modal close buttons had no box at all.**
The six slide-over closes use `.slide-over__close` (32x32, flex-centred, with a
hover background). Every `.modal-backdrop` dialog hand-rolled its close inline
and **set no size**, so each collapsed to its bare icon: an **18x18 to 20x23
non-square** hit target, at **three different offsets** (top13/right13,
top27/right25, top28/right25), with **no hover feedback anywhere**. Added
`.modal-close` (`index.css:1645`) — the same box as `.slide-over__close` minus
the absolute positioning, because backdrop modals put their close in a flex
header row. 11 files touched.

The inline chrome those 16 carried was **already redundant** — the global
`button { border:none; background:none; cursor:pointer }` reset at
`index.css:91` supplies all of it. And the inline `background:'none'` is
precisely *why* a hover state could never have been added to them.

**(b) `18837f7` — an inline style killed one close button's hover.**
`SubcontractorsView.jsx:261` carried `className="slide-over__close"` **and** an
inline style re-declaring `background:'none'`. **Inline beats a stylesheet rule
regardless of specificity**, so `.slide-over__close:hover` could never apply. It
was the only one of the six slide-over closes with no hover feedback.

**Static analysis passes this** — the class *is* applied and the CSS *is*
defined. The only tell was runtime: `matches(':hover') === true` while the
background stayed transparent.

**This is the fourth consecutive run whose defect is "a declaration silently
loses the cascade to something that outranks it."** Triage this shape first.

**One accounting note:** the audit recorded 22 close buttons (6 + 16). A
source-level count at report time finds **16 `className="modal-close"` plus 9
`className="slide-over__close"` = 25**. The extra 3 are in `LeadDetail.jsx`,
which holds one panel close plus three nested modal closes that the runtime
sweep did not open separately. **All 25 carry a class**, so the fix is complete
either way — but the "22" figure is a count of measured instances, not of source
sites.

---

## Bugs Fixed

1. **`GET /api/admin/tenants?sort=<prototype-key>` returned 500 on every
   inherited `Object.prototype` name.** `SORTABLE[sort] ?? 't.created_at'` on a
   plain object literal returned an inherited `Function` for `constructor`,
   `__proto__`, `toString`, `valueOf` and `hasOwnProperty`, so the fallback never
   fired and the Function stringified into the `ORDER BY` clause, producing a SQL
   syntax error. **Fixed** with `Object.prototype.hasOwnProperty.call` before the
   lookup (`admin.js:130`). Verified 5/5 prototype keys now 200. — `842cda3`
2. **`POST /api/crm/work-orders` with a prototype-key `milestone_template`
   returned 500 *and* left an orphan work order.** Same root cause:
   `MILESTONE_TEMPLATES[templateKey]` returned a `Function`, so
   `template.milestones` was `undefined` and `defs.map()` threw — **after** the
   `work_orders` row was already INSERTed, leaving a row with zero milestones
   (4 of 4 probes). `milestone_template` is body-controlled, so this is
   client-reachable. **Fixed** with the same guard (`workOrderService.js:156`).
   Verified 4/4 now 201 with the correct 7 default milestones and **0 orphans**.
   — `842cda3`
3. **16 of 22 modal close buttons (Calendar, CreateLead, Email, Estimates x2,
   Expenses, ImportLeads, Invoices x2, Materials x3, PhotoAnnotator,
   WorkOrders x3) had no box** — a bare **18x18 to 20x23 non-square** hit target
   at three inconsistent offsets with **no hover feedback**. **Fixed** by adding
   `.modal-close` (`index.css:1645`) and applying it at all 16 sites; all
   measured instances are now **32x32 at dTop 25 / dRight 25** with a working
   hover. — `aff13c2`
4. **The Expenses modal `<h3>` title overlapped its close button.** The `h3`
   block box ran under the button. **Fixed** in the same pass as #3. — `aff13c2`
5. **The Subcontractors slide-over close button had a permanently dead
   `:hover`.** An inline `background:'none'` sat alongside
   `className="slide-over__close"`; inline wins over any stylesheet rule, so the
   class's `:hover` could never apply. **Fixed** by deleting the redundant inline
   style (`SubcontractorsView.jsx:261`) — the global `button` reset at
   `index.css:91` already supplied it. — `18837f7`

Counted as **3 bugs** by commit and root cause (1 backend, 2 UI); the 5 entries
above are the distinct user-visible failures those 3 commits resolved. All three
commits were confirmed present in the working tree at report time, and the tree
builds clean.

---

## Known Issues (Not Fixed)

1. **Form label drift — deliberately deferred, developer decision required.**
   Canonical is `.form-group label` (`index.css:2249`) = 12px / 600 / uppercase /
   0.08em. Measured inside modals: `/tasks` and `/subcontractors` are
   **canonical**; `/work-orders` is `12px/600/none/normal` and `/expenses` is
   `12px/400/none/normal` — **drift**. Scope is 4 separate `labelStyle` objects
   (`AutomationSettings.jsx:57`, `CreateLeadModal.jsx:177`,
   `DripSequences.jsx:48`, `WorkOrdersView.jsx:1164`) plus **~100 inline-styled
   `<label>` elements across 19 files**; only 6 files use `.form-group` at all.
   **Not fixed on purpose:** converting a subset leaves the app inconsistent
   along a *new* axis, and converting all ~100 is a refactor, which the QA
   charter excludes. This needs to be *chosen*, not slipped in. It is a single
   mechanical pass whenever you want it.
2. **`qa_options_probe` custom field is still live in the production DB.**
   Tenant `waterloo`, created 2026-08-05, label "QA Options Probe" — and it is
   **user-visible in Settings to Custom Fields**. The nightly hygiene sweep
   matches `'QA-R9%'`, which this label does not match, so it escapes cleanup
   every night. **Confirmed safe to delete:** 0 leads carry a value under that
   key and 0 leads have any `custom_fields` data at all. Needs one `DELETE` plus
   your go-ahead — the report stage does not write to the production DB.
3. **`automationEngine.js:75-77` enum bug remains open and is server-only.** s2
   confirmed the Tasks UI side is clean, so it **cannot be reproduced from the
   frontend**. Needs a server-side fix.
4. **`.qa-r91-neverrun.mjs` is still unrun** — carried over from prior nights.
5. **Three uncommitted QA harnesses from s1** — `server/.qa-r97-allowedcols.mjs`,
   `.qa-r97-protolookup.mjs`, `.qa-r97-wotemplate.mjs`, left behind when the
   stage capped. `allowedcols` is a genuinely new check (PATCH `allowedFields`
   whitelists vs. real DB columns — a name in the list that is not a column makes
   that PATCH 500, but only when a client sends that exact field) and it ships
   with a self-test. Worth committing and running.
6. **Dead code, carried over:** `quickFilters` / `applyQuickFilter`
   (`LeadList.jsx:62`, `:346`) — defined, never rendered, never called. Dead CSS:
   `.stat-card:hover .stat-card__icon img` (`index.css:959`) —
   `.stat-card__icon` has 0 JSX consumers. Both developer calls.
7. **Stray 0-byte `server/=`** in the working tree (shell-redirect accident,
   pre-existing).

---

## Test Coverage Gaps

1. **139 of 272 API route patterns were not executed tonight — every bulk write
   sweep (POST 87, DELETE 18, PATCH 26, PUT 8).** s1 spent its budget finding and
   fixing the prototype-key defect and then hit the 50-turn cap. For contrast,
   last night executed 258 of 272 including PATCH/PUT at 34/34. **This is a
   stage-capacity gap, not a regression** — nothing broke, the sweeps simply
   never ran.
2. **s1 wrote no results file.** `C:/tmp/api-test-results.txt` is still the
   **Run 95 file dated 2026-08-25**, and `/tmp/api-test-results.txt` (a
   different directory — `/tmp` resolves to
   `C:/Users/brand/AppData/Local/Temp`) is the **Run 82 file dated 2026-08-19**.
   **Neither reflects tonight.** Do not read either as current. **This is the
   second consecutive night s1 has produced no artifact.**
3. **s4 (verify) produced no verdict.** It capped at 40 turns after
   authenticating, screenshotting the Expenses modal close-button hover (06:06)
   and writing a `super_admin` probe for the admin fix (06:07) — but it never
   wrote a conclusion. **Tonight's three fixes therefore have no independent
   verification pass.** They rest on (a) the fixing stage's own before/after
   evidence, which was concrete in each case, (b) a source-level confirmation
   during this report stage that all three changes are present in the tree, and
   (c) a clean build. That is weaker than a real s4 verdict.
4. **`/canvassing` pin drop was not completed** — finishing it would incur a DB
   write plus a paid geocode, against the standing cost constraints. Placement
   mode was verified; the write was not.
5. **14 of 272 routes remain permanently excluded by design** — bulk import,
   outbound email, paid geocoding, webhooks. An intentional boundary, not a gap.
6. **No screenshots were taken by s2, by choice** — structured DOM and network
   assertions were used instead. More precise as evidence, and it avoids adding
   to the ~300 stray PNGs already in the repo root.
7. **Two fixes from prior nights still verify structurally only.** No lead in
   this tenant has a `contact_email`, and the sampled lead-linked estimate has
   null `lead_email`/`lead_phone`, so `f9b0c8f` and `a04aa8e` can be shown to
   read the correct keys but **cannot be demonstrated end-to-end**. Seed fixtures
   are needed.

---

## Notes for the next run

- **Two capped stages again — eight consecutive nights.** Recovery works, but it
  is costing roughly a stage of throughput per night, and it has now cost the API
  write sweeps two nights running.
- **Highest-value unrun check, named and ready:** for every element carrying
  **both** a `className` and an inline `style`, diff the inline properties
  against that class's `:hover`/`:focus`/`:active` block. **Any overlap is a dead
  state.** This is what found defect (b), it has not been run app-wide, and it is
  cheap. Static analysis **cannot** see this class of bug.
- **Re-run the API write sweeps first.** They are proven (34/34 two nights ago)
  and they were simply skipped tonight.
- **Commit and run `server/.qa-r97-allowedcols.mjs`** — new check, self-tested,
  currently uncommitted.
- **New trap, cost 2 turns:** `client/src/components/*.jsx` have **mixed line
  endings**. A multi-line exact-string patch written with `\n` matches **only**
  the LF files and reports 0 occurrences on the CRLF ones — which looks exactly
  like "the code changed since I read it." Detect each file's own EOL and
  re-encode the pattern. The migration script was written to **abort without
  writing** if any pattern failed to match exactly once, which is what made this
  visible as a clean 5-way MISS instead of a silent partial edit.
- **Drift baseline for the next run:** the `docs: QA report 2026-08-26` commit.

---

## Verified non-bugs — do not re-file

- **401s on `/api/properties/import-progress`, `/api/notifications/unread-count`
  and `/api/crm/tenant-settings` are the token-refresh interceptor working**
  (`api/client.js:31-77`). The browser logs the network 401 regardless; the app
  stayed authenticated across all 18 routes. These were the *only* console errors
  of the entire night.
- **The Tasks priority control displays "Medium" but submits `warm`** —
  `TasksView.jsx:16` maps hot to High, warm to Medium, cold to Low, and those are
  the valid `lead_priority` enum values. Correct.
- **`/invoices` "All 14" vs. tabs summing to 11** — the other 3 are
  `status=void`, which has no tab by design.
- **`/alerts` inputs at 26px / 0 radius / no `.form-input`** are the numeric
  stepper (`AlertSettings.jsx:308-316`); the flanking plus/minus buttons carry
  the split radii seen in the button census.
- **`/alerts` `.nav-link.is-active` = 0** is correct — orphan route, no nav entry.
- **Button radii 10px/8px, 14px/12px and 3.35544e+07px** are CSS `clamp()`
  serialisation artifacts, not outliers.
- **`/reports` non-24x24 SVGs** are recharts surfaces — data-viz, not icons.
- **`/content-studio` does not exist** — `App.jsx` `path="*"` redirects to `/`.
- **`/work-orders` Pending 7 (memory said 0)** is data drift, not a regression.

---

*Report generated by stage s5 on 2026-08-26. Build verified PASS at report time
(`vite build`, 7.86s, exit 0).*
