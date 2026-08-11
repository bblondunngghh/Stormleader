# StormLeads — Overnight QA Report

**Run 73 · 2026-08-09 · 05:00–06:05 CDT**
Baseline `3a2a51e` (`checkpoint: pre-overnight-run 2026-08-09`) → HEAD `e3ab83f`

---

## QA Test Summary

| Metric | Count |
|---|---|
| Bugs found | 4 |
| Bugs fixed | 4 |
| Bugs found but not fixed | 0 |
| Commits | 4 (all `fix:`) |
| Pages render-swept | 19 of 19 routes |
| Pages interaction-tested | 10 of 19 |
| API routes in catalogue | 272 (36 files — GET 132, POST 88, PATCH 26, PUT 8, DELETE 18) |
| API routes exercised this run | 132 GET (breadth) + 2 contract routes at payload depth |
| API 5xx observed | 0 |
| JSONB columns given write guards | 1 this run (`contracts.content`) |
| UI inconsistencies found | 14 (10 glyph sites, 4 role-label sites) |
| UI inconsistencies fixed | 14 |
| Modals measured live | 5 (plus all 22 `.modal-backdrop` sites read in source) |
| Final build | exit 0, 8.15s |

**Headline:** the run's most serious finding is again a silent data-integrity defect rather
than a crash. A task's doneness is stored in **two columns** (`completed_at` and `status`),
the writer set only one of them, and the two readers disagreed about which one means "done".
Marking a task complete removed it from `/tasks` but left `status='pending'` forever, so the
dashboard's Today panel kept listing it as outstanding on every subsequent load. There was no
error signal at all — `Dashboard.jsx:692` optimistically drops the row from local state right
after the PATCH, so the click looked like it worked and the task only reappeared on reload.
All three tasks in the tenant were already sitting in this contradictory state. Fixed at both
the write boundary and the read boundary (`8e67255`).

**Second theme, now proven three runs running:** an icon audit is not one sweep, it is three.
The render sweep reported icons clean on all 19 routes for the third consecutive run — and a
*source* grep then found 10 more `'+'` glyphs standing in icon slots. The detector rule
inherited from Run 72 required a text node with no letters and no numbers; these are
`"+ New Task"`, where the glyph shares its text node with the label, so the rule excluded
every one of them. Eight of the ten mount only behind a tab or a row click and are invisible
to any render sweep regardless of detector.

---

## Backend API Test Results

Stage s1 catalogued **272 routes across 36 files** and ran a full breadth sweep of all
**132 GET routes** using real row IDs wherever the table had rows (21 routes hit a real id;
16 of 24 entity types have rows). It then went depth-first on the run's named target from
Run 70's carry-forward: **unguarded JSONB write paths**.

**GET sweep result: 132 routes, 99 × 200, 33 × non-2xx, 0 × 5xx.**

All 33 non-2xx responses were verified as correct behaviour, not failures:

- **12 × 400** — explicit required-parameter validation (`bbox`, `lat`/`lng`, `zip`,
  `start`/`end`). Correct rejection, not a crash.
- **5 × 403** — the `/api/admin/*` routes, correctly gated against a non-super-admin caller.
- **16 × 404** — empty tables (drip sequences, territories, financing applications,
  materials orders/products) or `public/:token` routes where a row id is not a valid token.

### Per-category breakdown

| Category | Routes tested | 200 | Non-2xx (all verified correct) | 5xx |
|---|---|---|---|---|
| `crm/dashboard` | 15 | 15 | 0 | 0 |
| `properties` | 10 | 3 | 7 (4 × 404 no row, 3 × 400 param) | 0 |
| `crm/reports` | 6 | 6 | 0 | 0 |
| `crm/financing` | 6 | 3 | 3 (404, empty table) | 0 |
| `skip-trace` | 6 | 5 | 1 (404, no job) | 0 |
| `materials` | 6 | 4 | 2 (404, empty tables) | 0 |
| `crm/work-orders` | 5 | 5 | 0 | 0 |
| `roof-measurement` | 5 | 5 | 0 | 0 |
| `estimates` | 5 | 4 | 1 (404, token route) | 0 |
| `crm/contracts` | 5 | 4 | 1 (404, token route) | 0 |
| `admin` | 5 | 0 | 5 (403, correctly gated) | 0 |
| `crm/leads` + `leads` | 6 | 5 | 1 (404, token route) | 0 |
| `map` | 3 | 0 | 3 (400, `bbox` required) | 0 |
| `crm/territories` | 3 | 1 | 2 (404, empty table) | 0 |
| `crm/drip-sequences` | 3 | 2 | 1 (404, empty table) | 0 |
| `notifications` | 3 | 3 | 0 | 0 |
| `dashboard` (non-CRM) | 3 | 3 | 0 | 0 |
| `crm/subcontractors` | 3 | 3 | 0 | 0 |
| `storms` / `storm-history` | 4 | 2 | 2 (400, param) | 0 |
| `data` | 2 | 0 | 2 (400, param) | 0 |
| `crm/invoices` | 2 | 2 | 0 | 0 |
| `crm/expenses` | 2 | 2 | 0 | 0 |
| `crm/pipeline` | 2 | 2 | 0 | 0 |
| `crm/canvass-pins` | 2 | 2 | 0 | 0 |
| `crm/prospect-lists` | 2 | 2 | 0 | 0 |
| `payments` | 2 | 2 | 0 | 0 |
| `counties` | 2 | 2 | 0 | 0 |
| `alerts` | 2 | 2 | 0 | 0 |
| `auth` (`/me`) | 1 | 1 | 0 | 0 |
| Singletons (`search`, `documents`, `drift`, `onboarding`, `crm/tasks`, `crm/team`, `crm/custom-fields`, `crm/automations`, `crm/tenant-settings`) | 9 | 9 | 0 | 0 |
| `disaster-declarations`, `crm/calendar` | 2 | 0 | 2 (400, param) | 0 |
| **Total** | **132** | **99** | **33** | **0** |

### What was fixed — `b8a76c3`

**`GET /api/crm/contracts/:id/pdf` threw a 500 on 8 of 13 JSONB content shapes.**

`contracts.content` is a JSONB column, and the PDF route read it with three assumptions the
column does not enforce:

1. `JSON.parse(contract.content)` when the stored value is a string — JSONB hands back a
   plain string for a stored JSON string, so any value that is not itself JSON threw
   `SyntaxError` before a single guard ran.
2. `rawContent.sections || []` guards the **container** against falsy only. A truthy
   non-array (`42`, `{...}`) reached `for (const section of ...)` → *"sections is not
   iterable"*.
3. Nothing guarded the **elements**. `[null]` has length 1, so it survived every truthiness
   check and then threw on `section.title`.

Plus `section.body.replace(...)` on a JSONB-sourced number/object/array →
*"replace is not a function"*.

Verified in both directions: pre-fix, the original lines replayed against 13 probe shapes
threw on 8 of 13; post-fix, live against the running server, **13 of 13 returned
`patch=200 pdf=200`, zero 5xx**. Regression: all 6 real contracts returned 200 with `%PDF`
magic bytes. Identity on well-formed data confirmed — contract `fff66d3d` still renders 3,930
bytes with its real section title *"Scope of Work"* intact, so the filter drops nothing.
Probe rows cleaned up; **net DB writes 0**.

This is the same defect and the same fix shape as the estimate PDF (`a023c66`) and the
work-order/invoice `line_items` guards (`81d0cab`), confirming Run 70's carry-forward that
**JSONB columns are the real risk surface**. Found by s1, which hit its turn cap before
committing; verified independently and committed by s2.

---

## Frontend Feature Test Results

Stage s2 tested 10 routes, taking `/dashboard`, `/tasks` and `/settings` to interaction depth
rather than render depth.

### `/dashboard` — PASS (interaction depth)

- **Period filter bar (All Time / 7 / 30 / 90 / YTD) is NOT inert** — prior runs' claim that
  it was is now stale and is retracted. It fires `date_from` on `dashboard/stats`,
  `pipeline/metrics` and `dashboard/activity`; the active state changes; pipeline counts move
  22/6/1/1/1 (All Time) → 6/2/0/0/0 (7 Days). Works.
- All 5 stat cards navigate correctly: Pipeline Value → `/pipeline`, New Leads → `/leads`,
  Close Rate and Avg Days → `/leads?stage=sold` (0 leads, correct), Speed to Lead → `/leads`.
  No `undefined` chips — Run 67's `0692fc2` holds.
- **Verified non-bug:** the leaderboard ignores the period filter *by design* —
  `getLeaderboard(tenantId)` takes no filter argument on either client or server. Not a
  dropped param.
- **Verified non-bug (nearly filed):** "New Leads (7d)" = 0 while the pipeline 7-day panel
  showed 8. DB truth: all 8 leads were created 2026-08-02 10:10 UTC and the 7-day cutoff was
  10:15 UTC — they miss the rolling window by **five minutes**. The stat card uses a rolling
  7 × 24h window; the pipeline uses a calendar-date floor. Both are correct.

### `/tasks` — BUG FOUND AND FIXED (`8e67255`)

- `/tasks` read "Pending 0 / Completed 3" and "No tasks yet", while the dashboard Today panel
  listed **the same 3 tasks** as outstanding with Mark-complete buttons.
- Root cause: doneness stored in two columns. `updateTask` (`crmService.js:405`) sets
  `completed_at` only; `getTasks` reads `completed_at IS NULL`; `getTasksDueToday` (`:1019`)
  reads `status NOT IN ('completed','cancelled')`. `status` is a plain varchar defaulting to
  `'pending'` with no enum and no check constraint, and **nothing ever wrote to it**.
- Fixed at both halves, because a write-path fix cannot clean rows already stored:
  `updateTask` now syncs `status` whenever `completed_at` is written (an explicit `status`
  still wins), and `getTasksDueToday` also requires `completed_at IS NULL` so the three rows
  already in the contradictory state stop appearing.
- Full A–I round trip verified live against the restarted server, including the
  un-complete direction (the guard is not one-way). Probe row deleted; **net DB writes 0**.
- **Still needs attention (minor, not fixed):** the Pending tab's empty state reads *"No tasks
  yet / Create your first task"* even though 3 tasks exist — wrong copy for an empty *filter*
  as opposed to an empty *table*. Cosmetic; left per the no-refactor charter.

### `/settings` — PASS, all 15 tabs (interaction depth)

Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications, Email/SMTP, Financing,
Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews.

- **0 white-screens, 0 page errors across all 15 tabs.**
- Reviews renders (Google Review Requests + Place ID + template) → Run 68's `03cc9fb` holds.
- Component rules hold: **0 native `<select>`, 0 `input[type=date]`** on every tab.
- Financing shows 5 plans with term/APR/dealer fee; Pricing shows the full line-item
  catalogue; Team shows 4 members; Billing shows usage + balance; Payments shows Stripe
  Connect and the fee table.
- **Note for future testers:** Settings → Contracts *navigates away* to `/contracts` and
  leaves the settings tab bar, so a naive tab-bar sweep loses every remaining tab after
  clicking it.

### `/contracts` — PASS

List renders 6 contracts. "New Contract" opens a **full-page builder, not a modal** — page
text shrinks 754 → 412 characters because the list is replaced by the form. Builder renders
template picker, Customer Details, Contract Sections with merge-field placeholders
(`{{customer_name}}` etc.), Add Section, and Preview / Save Draft / Send Contract.

### Click sweep — `/work-orders` `/pipeline` `/expenses` `/subcontractors` `/reports` `/calendar`

**0 crashes, 0 page errors on every safe control.**

- `/pipeline` — Sales / Production / Billing view tabs all switch. Production and Billing are
  near-empty because all 31 leads sit in Sales-side stages, consistent with the stage counts.
  Add Lead modal opens.
- `/expenses` — Add Expense modal opens with Job / Category / Amount / Date / Notes.
- `/subcontractors` — Add modal opens; pagination Next works (65 rows, 25/page).
- `/reports` — all date presets switch; **CSV export actually downloaded**
  `revenue_report_2026-08-09.csv`.
- `/calendar` — Month / Week / Day / List all switch.
- `/work-orders` — "From Estimate" modal lists estimates.

### Dual-state-column sweep (generalising the `/tasks` bug)

Every table that stores state twice (a `status` column plus an event timestamp) was checked
for contradictory rows: contracts, estimates, invoices, work_orders, drip_enrollments, tasks.

- **tasks** — 3 contradictory rows → fixed this run (`8e67255`).
- **invoices** — 2 rows (`INV-0008`, `INV-0013`) with `status='sent'` and `paid_at` set. These
  are the already-known `total=0.00` / `amount_paid>0` rows — a consequence of that documented
  bad data, not a separate defect. Not re-filed.
- **work_orders, contracts, estimates** — 0 contradictions.

---

## UI Consistency Audit Results

Stage s3 prioritised the categories that Run 72 was capped before reaching. Method rule
carried forward and not shortcut: **sweep the SVGs, grep the source, and read the rendered
DOM** — each lens has a blind spot the others cover.

### Icons — 10 violations found and fixed (`e3ab83f`)

Three lenses were run across all 19 routes:

- **Lens A (source imports):** 0 from `/24/solid`, `/20/`, `/16/`; 0 lucide / react-icons /
  fontawesome / @mui / material-icons; 0 `fa-*` classes. **Clean.**
- **Lens B (rendered SVG conformance):** non-conforming SVG = **0 on every route** (excluding
  recharts and map vendor SVGs). 2,200+ SVGs measured across the 19 routes. **Clean.**
- **Lens C (glyph text nodes in clickables, block-independent rule from Run 72):** 1 hit
  app-wide, and it is the documented non-bug — the dashboard's "+44 more events" numeric
  prefix, which is not an icon slot. `/alerts` reports 38 SVG / 0 glyphs, so Run 72's
  `31fbc07` stepper fix holds.

**All three lenses reported clean — and a source grep then found 10 more violations.** The
block-independent rule requires a text node with *no letters and no numbers*; these are
`"+ New Task"`, where the `'+'` shares its text node with the label. Found instead by
`grep -rnE '(^|>)\s*[+x✕✓−–↑↓▾▸]\s+[A-Za-z]'` — symbol followed by a word.

| Page | Element | Expected | Actual | Fixed |
|---|---|---|---|---|
| `/tasks` | "+ New Task" | `PlusIcon` | ASCII `+` in label | Yes |
| `/subcontractors` | "+ Add Subcontractor" | `PlusIcon` | ASCII `+` in label | Yes |
| `/settings` | "+ Add Field" | `PlusIcon` | ASCII `+` in label | Yes |
| `/settings` | "+ Add Item" | `PlusIcon` | ASCII `+` in label | Yes |
| `/settings` | "+ Create Template" | `PlusIcon` | ASCII `+` in label | Yes |
| `/settings` | "+ Add Section" | `PlusIcon` | ASCII `+` in label | Yes |
| lead detail | "+ Upload" | `PlusIcon` | ASCII `+` in label | Yes |
| lead detail | "+ Generate Contract" | `PlusIcon` | ASCII `+` in label | Yes |
| lead detail | "+ Add Expense" | `PlusIcon` | ASCII `+` in label | Yes |
| `/work-orders` | "+ Add" (line item) | `PlusIcon` | ASCII `+` in label | Yes |

Eight of the ten mount only behind a tab or a row click, so no render sweep could have reached
them. `TasksView.jsx` is the proof this is drift rather than house style: the file already
imported `PlusIcon` and already rendered `<PlusIcon/>` at line 161 — one file, both spellings.
`WorkOrdersView.jsx:345`'s empty-state prose said `click "+ Add" to create one` and would have
gone stale; updated to `click "Add"`.

Verified live on 7 of 10 (the other 3 sit behind a template form or a work-order edit modal and
are source-verified): every one shows `svg 14×14`, `viewBox "0 0 24 24"`, `stroke-width 1.5`,
the `'+'` character gone, and **button heights unchanged at 36px**. The `^\+` button scan on
the four measured pages went from 1 hit each to 0.

### Buttons — sizing verified on every fixed site; no new inconsistencies filed

Icon sizing deliberately follows the container rather than a uniform inline style, matching the
approach established in `aca103e`: `.quick-action-btn` already declares
`svg { width:14px; height:14px }` plus inline-flex and gap (`index.css:1807-1833`), so those
three sites take a bare `<PlusIcon />` sized by CSS; `.auth-btn` has no svg rule, so those take
an explicit `14×14` and the button gains `display:flex; gap:6`. Two 11px inline-styled buttons
take a 12px icon to stay in proportion. Button heights measured unchanged (36px `auth-btn`) at
every fixed site. No button-sizing defects were filed this run.

### Toolbars / Headers — not audited this run

Evidenced in Runs 71 and 72; not re-run. **Not re-verified — see Coverage Gaps.**

### Sidebar / Nav — 1 violation found and fixed (part of `8e5762e`)

The sidebar's user-role chip rendered the raw DB enum `super_admin` on **all 19 routes**,
because it is persistent chrome. Fixed. Detail below under Forms/labels.

### Forms — PASS on the component rule, 6th consecutive run

Native `<select>` = 0 and `input[type=date|datetime-local|time|month]` = 0 on **all 19 routes**.
The `DatePicker.jsx` / `CustomSelect.jsx` rules hold app-wide. Form-element *styling* beyond the
native-control rule was not reached — see Coverage Gaps.

### Labels / enum leakage — 4 violations found and fixed (`8e5762e`)

A new detector this run — rendered text nodes matching `^[a-z]+(_[a-z]+)+$`, i.e. raw
snake_case leaking into the UI — generalises Run 72's `8745ec5` into an app-wide sweep. The
same `user.role` value was rendered **four different ways, two of them wrong, and two of them
visible on the same screen**:

| Page | Element | Expected | Actual | Fixed |
|---|---|---|---|---|
| all 19 routes | `.sidebar__user-role` | "Super Admin" | `super_admin` | Yes |
| `/settings` | Profile → Role | "Super Admin" | `Super_admin` | Yes |
| `/settings` | Team card (current user) | "Super Admin" | **"Sales Rep"** | Yes |
| `/admin` | tenant-detail user badge | "SUPER ADMIN" | `SUPER_ADMIN` | Yes |

**Why this is more than cosmetic:** on `/settings?tab=team` the sidebar read `super_admin`
while the Team card *for the same person* read "Sales Rep" — a contradiction visible in a
single screenshot. The ternary at `SettingsView.jsx:1273` had no `super_admin` branch, so the
highest-privilege role fell through to the final `else` and was displayed as the lowest.
`SettingsView.jsx:1092` already defined `const roleLabels = {admin, manager, sales_rep}` and
**nothing referenced it** — the ternary 180 lines below was an incomplete hand-rolled
duplicate. The fix extends that map with `super_admin` and actually uses it. `roleColors` also
lacked `super_admin`, so the avatar took the `sales_rep` blue — the colour signal agreed with
the wrong label; mapped to the admin red.

Verified live: sidebar, profile and team card all read "Super Admin"; the Team tab's 3 members
read Super Admin / Admin / Sales Rep, each matching its DB row (`admin` ×6, `sales_rep` ×1,
`super_admin` ×1). App-wide snake_case sweep went from 1 hit per route to 0.

### Spacing / alignment — not reached this run

**Unevidenced, not passing** — see Coverage Gaps.

### Modals — MEASURED for the first time (Run 72 was capped before reaching this)

**Structure**, from source across all 22 `.modal-backdrop` sites: 20 of 22 have a direct
`.glass` child and therefore receive the `.modal-backdrop > .glass` scale-in
(`index.css:4471`). The 2 that do not are backdrop-only elements with a sibling panel, both
deliberate — `LeadDetail.jsx:2469` (the white-paper inspection report, a documented separate
design context) and `PhotoAnnotator.jsx:206` (full-bleed editor, panel inset
`var(--space-lg)` not 0). Both animate their backdrop; neither is a glass modal. Not filed.

**Measured live** (opened, not inferred):

| Modal | Width | Radius | Padding | Title | Close button |
|---|---|---|---|---|---|
| ImportLeadsModal (`/leads`) | 720 | 20px | 32px | `h2` 20px/700 | static 28×31 |
| ExpensesView Add Expense | 480 | 20px | 24px | `h3` 16px/700 | absolute 18×21 |
| WorkOrders From Estimate | 480 | 20px | 24px | `h2` 18px/700 | static 20×23 |
| TasksView New Task | 420 | 20px/18px | 32px | `div` 22px/800 | `.slide-over__close` 32×32 |
| Subcontractors Add | 480 | 20px/18px | 32px | `div` 18px/700 | `.slide-over__close` 32×32 |

- **PASS:** every modal animates (backdrop `modal-backdrop-in`/`fadeIn`; panel
  `modal-scale-in`).
- **PASS:** backdrop colour and blur variance is per-context — an already-documented non-bug.
- **Confirms the known-and-deferred drift, now measured rather than asserted:** modal titles
  have 5 treatments across 3 tag types (including an `<h3>` heading-level skip in
  ExpensesView), and close buttons have 4 sizes in 2 placement patterns. Per the standing
  "known issues, deliberately not fixed" list, these are **not** half-converted by QA. Left
  as-is, now with numbers attached.
- **New observation, not fixed:** 4 of the 5 close buttons have **no accessible name** — no
  text, no `aria-label`, no `title`. Only SubcontractorsView's carries
  `aria-label="Close"`. Run 72 added aria-labels to the `/alerts` steppers for the same
  reason; this is the same gap one level up.

**Verified non-bug, nearly filed:** `/invoices` "New Invoice" produces no modal and no URL
change. It renders a **full-page InvoiceBuilder in place** (h2 "New Invoice" plus h3 Customer /
Line Items / Details / Summary; the `.lead-table` disappears), exactly like the `/contracts`
builder. Works. A backdrop-only probe reports this as a dead button — it must be verified by
DOM diff.

**Verified non-bug:** `className="modal-scale-in"` at 4 sites (`CalendarView:256`,
`DripSequences:580`, `EstimatesView:2868`, `InvoicesView:1055`) matches **no CSS rule** — only
the `@keyframes` of that name exists. It is a no-op; those modals animate via
`.modal-backdrop > .glass` anyway. Cosmetic dead class, left per the no-refactor rule.

---

## Bugs Fixed

1. **`GET /api/crm/contracts/:id/pdf`** — returned 500 on 8 of 13 JSONB `content` shapes:
   `JSON.parse` on a JSONB-returned plain string, a truthy non-array `sections` reaching
   `for...of`, an unguarded `[null]` element, and `.replace()` on a non-string `body`. Fixed by
   guarding the parse, the container type, and every element; 13/13 shapes now return 200, all
   6 real contracts still render, well-formed content preserved byte-identical. — `b8a76c3`
2. **`/tasks` + dashboard Today panel** — completing a task never cleared it from the
   dashboard. Doneness lives in two columns; the writer set `completed_at` only while
   `getTasksDueToday` read `status`, which nothing ever wrote. No error signal, because the
   dashboard optimistically drops the row on click. Fixed at both the write boundary
   (`updateTask` syncs `status`) and the read boundary (`getTasksDueToday` also requires
   `completed_at IS NULL`), cleaning the 3 rows already in the bad state. — `8e67255`
3. **Sidebar / Settings / Admin role label** — the same `user.role` value rendered four
   different ways, two of them wrong. A `super_admin` fell through an incomplete ternary and
   was displayed as **"Sales Rep"** in the Settings Team card while the sidebar simultaneously
   showed the raw enum `super_admin`. Fixed by extending and actually using the `roleLabels`
   map that already existed but was referenced by nothing, plus the matching `roleColors`
   entry. — `8e5762e`
4. **10 `'+'` glyphs used as icons** — `/tasks`, `/subcontractors`, `/settings` (×4), lead
   detail (×3), `/work-orders`. Literal ASCII `+` standing where a Heroicon belongs. Replaced
   with `PlusIcon`, sized by the container convention; button heights unchanged. — `e3ab83f`

---

## Known Issues (Not Fixed)

**Found this run, deliberately not fixed:**

- **4 of 5 modal close buttons have no accessible name** — no text, no `aria-label`, no
  `title`. Only SubcontractorsView's has one. Needs a decision on whether to apply the Run 72
  `/alerts` stepper treatment app-wide.
- **`/tasks` Pending tab empty-state copy** reads "No tasks yet / Create your first task" when
  3 tasks exist — wrong copy for an empty *filter*. Cosmetic.
- **Modal title and close-button drift** — 5 title treatments across 3 tag types (including an
  `<h3>` heading-level skip in ExpensesView), 4 close-button sizes in 2 placement patterns.
  Now measured rather than asserted. On the standing do-not-half-convert list; needs a design
  decision, not a QA edit.
- **`className="modal-scale-in"` is a dead class at 4 sites** — matches no CSS rule. A no-op;
  those modals animate correctly by another path. Left per the no-refactor rule.

**External / environmental, not application defects:**

- **`feature.tnris.org` is unresolvable** (`getaddrinfo ENOTFOUND`). The auto-import scheduler
  logged this **61 times in roughly five minutes** for `_TX_STATEWIDE` with no visible backoff.
  The DNS failure is external; the retry volume is worth a look.
- **SPC archive 404s** for `260809_rpts_{wind,torn,hail}.csv` — same-day files not yet
  published upstream. Expected.
- **HRRR data unavailable ×25** — falls back to the climatological wind profile, as designed.
- `GET /api/properties/fema-live` — Run 70's 500 was **not reproduced** this run; FEMA NSI
  fetched successfully during the window (866 structures at 06:01). The earlier failure looks
  transient/external. Carried as watch-only.

**Carried forward from prior runs, not re-verified this run:**

- Duplicate `estimate_number` within one tenant (`EST-021`, `EST-022`, `EST-082` each exist
  twice). Pre-existing data, not caused by QA; needs a renumbering decision before a unique
  constraint can be added.
- `EST-082` / `EST-083` malformed rows left in the DB deliberately to keep the new guards
  exercised.
- `INV-0008` / `INV-0013` have `total=0.00` with `amount_paid>0` — documented bad data. The
  dual-column sweep re-surfaced them and correctly did not re-file them.
- **~23 of 29 JSONB columns remain unguarded.** This run guarded `contracts.content`, making 9
  of 29 cumulative across Runs 71–73.

---

## Test Coverage Gaps

**API — write paths were not swept this run.** All 132 GET routes were exercised, but of the
**140 write routes (POST/PATCH/PUT/DELETE), only the contract PATCH was driven with real
payloads**, as part of the JSONB probe. Run 70 had taken write-path validation coverage to 120
of 140; that sweep was not repeated here, so this run's "0 5xx" result covers **132 of 272
routes (48.5%)**, not the whole surface. The depth-first choice was deliberate and it paid —
it produced the contract PDF bug — but breadth on writes is now a run behind.

**API — no auth sweep this run.** Run 70's 251-route unauthenticated sweep was not repeated.

**Frontend — 10 of 19 routes interaction-tested.** `/leads`, `/estimates`, `/invoices`,
`/storm-map`, `/storm-catalog`, `/alerts`, `/canvassing`, `/materials` and `/admin` were
render-swept by s3 for icons and native controls but **were not driven** — their controls,
forms and modals are unexercised. Prior runs found 7 bugs across the 5 routes they reached,
so the untested routes should not be read as clean.

**UI audit — 2 of 7 categories still unevidenced.** Icons, buttons, sidebar/nav, forms
(native-control rule) and modals now have evidence. **Toolbars/headers were not re-run this
run**, and **spacing/alignment has never been measured** — it has now been deferred by a
turn cap for three consecutive runs. **Form-element *styling*** beyond the native-control
rule (glassmorphism conformance, label treatment, focus rings on inputs) is also still
unmeasured. Esc-to-close remains untested for a fourth run.

**Stage 4 produced no output.** s4-verify ran 41 turns and $3.63 but committed nothing and
wrote no results file, so whatever it verified is unrecorded. Its budget was spent with zero
recoverable evidence — the single biggest waste in this run.

**All four upstream stages hit their turn caps again** — 5 consecutive runs at 4-of-4. The
turn cap, not test design, is the binding constraint on coverage.

---

## Session Integrity

| Stage | Outcome | Turns | Cost | API time | Result |
|---|---|---|---|---|---|
| s1 api-test | **MAX_TURNS (50)** | 51 | $4.78 | 8.0 min | 272 routes catalogued; 132 GET swept, 0 5xx; found the contract JSONB bug, capped before committing it |
| s2 frontend-test | **MAX_TURNS (80)** | 81 | $9.38 | 14.4 min | Adopted and committed s1's fix (`b8a76c3`); found the task/dashboard bug (`8e67255`); 10 routes tested |
| s3 ui-audit | **MAX_TURNS (60)** | 61 | $6.81 | 12.8 min | 2 commits (`8e5762e`, `e3ab83f`), 14 UI fixes; first run to measure modals |
| s4 verify | **MAX_TURNS (40)** | 41 | $3.63 | 7.8 min | **No commits, no results file — output entirely unrecorded** |
| s5 report | this document | — | — | — | Report, history, resume; final build exit 0 (8.15s) |

s1–s4 spend **$24.60**, **43.0 min** of API time.

### Infrastructure

- **3 of 4 stages wrote their results `.txt` — a real improvement.** Runs 70–72 managed 1-of-4,
  1-of-4 and 0-of-4. The fix that worked is the one Run 71 proposed: **write the header first
  and append per finding**, rather than composing the file in a final turn that the cap always
  eats. All three files carry a Run 73 header and were verified by header line, not mtime.
- **s1's file is incomplete even so.** `api-test-results.txt` stops after Phase 1 (the GET
  sweep) at 05:04; the contract JSONB work that produced `b8a76c3` was never appended, because
  s1 was capped mid-investigation. The commit message is again the only full record of it.
- **Work is still being stranded at the cap boundary.** s1 ended with a verified-but-uncommitted
  fix that s2 had to re-verify and adopt. This is the third consecutive run with this pattern.
  Nothing was lost, but only because the downstream stage caught it.
- **Environment trap, re-confirmed:** port 5173 serves **two different applications** — `::1`
  is StormLeads (PID 8796), `0.0.0.0` is `C:\Projects\AVApp` (Access Valet Parking). Use
  `http://localhost:5173` only; `127.0.0.1:5173` serves the wrong app.
- **Tester trap, `/settings`:** two buttons are named exactly "Notifications" — the settings tab
  and the topbar bell. `getByRole(...).first()` hits the bell and leaves the panel on the
  previous tab, which reads as "Notifications renders the Storm Alerts panel". Scope to the
  settings tab bar or use `?tab=notifications`.
- **Tester trap, `/dashboard`:** stat card labels are `text-transform: uppercase`, so
  `innerText` returns "PIPELINE VALUE" and a search for "Pipeline Value" finds nothing. Use
  `textContent`.

---

## Carry-Forward for the Next Run

1. **A glyph does not have to be alone in its text node.** Add
   `(^|>)\s*[+x✕✓−–↑↓▾▸]\s+[A-Za-z]` to the standing detector set. The block-independent rule
   from Run 72 was right but incomplete — it excludes every `"+ Label"` button, which is where
   8 of this run's 10 violations lived. The third lens has now earned its keep three runs
   running.
2. **Sweep for raw enums leaking into the UI app-wide.** The `^[a-z]+(_[a-z]+)+$` detector
   introduced this run found a wrong-role display on every route in the app. Run it every run;
   it is cheap and it generalises.
3. **Dual-state columns are a bug family, not an incident.** Any table storing state twice
   (a `status` column plus an event timestamp) with no constraint tying them is a candidate.
   The sweep found tasks this run. Extend it to any column pair where one side has no enum and
   no check constraint.
4. **Write-path breadth is a run behind.** Re-run the 140-route write sweep and the auth
   sweep; this run's 0-5xx result covers GET only.
5. **Spacing/alignment has been deferred three runs in a row.** Front-load it. Consider giving
   s3 a category budget so one category cannot consume the whole stage.
6. **s4 needs an output contract.** It spent $3.63 and produced nothing recoverable. Have it
   write its header file in turn 1 like the other three stages now do.

**Drift baseline for the next run: `e3ab83f`.**
