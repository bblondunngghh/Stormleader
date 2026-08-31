# StormLeads — Overnight QA Report

**Date:** 2026-08-31
**Branch:** `feat/financing`
**Baseline:** `f85b493` (checkpoint: pre-overnight-run 2026-08-31)
**Head at report time:** `60f83f2`
**Final build:** PASS — `npx vite build`, exit 0, 8.32s

---

## QA Test Summary

| Metric | Value |
|---|---|
| API endpoints tested | **198 distinct paths / 248 path+method pairs** of a 272-route inventory (72.8% / 91.2%) |
| API requests issued | **314** broad sweep + **~120** targeted shape probes |
| Pages tested — UI consistency | **19 of 19** authenticated routes |
| Pages tested — functional interaction | **0** — the frontend stage produced no result (see Coverage Gaps) |
| Bugs found | **2** |
| Bugs fixed | **2** |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Regressions introduced | **0** |
| 5xx responses across the whole sweep | **0** |
| Commits | **3** — 2 fixes, 1 harness carry |
| Net DB rows added by QA | **0** (see DB Hygiene) |

Both defects found tonight were backend data-integrity bugs in the same family, and both
were **silent** — the API answered `200`/`201` while doing the wrong thing. Neither
crashed, which is why both survived prior runs.

### Stage execution

Three of the four working stages terminated on `max_turns` rather than completing. This
is read from each stage's JSON `terminal_reason`, not from its self-assessment.

| Stage | Self-numbered | Terminal reason | Turns | Artifact written | Commits |
|---|---|---|---|---|---|
| s1 api-test | Run 112 | `error_max_turns` | 51 / 50 | **none** (raw harness JSON only) | `c30d968` |
| s2 frontend-test | — | `error_max_turns` | 81 / 80 | **none** | none |
| s3 ui-audit | Run 112 | `completed` | 36 | `ui-audit-results.txt` (both paths) | `47d2d13` |
| s4 verify | Run 113 | `error_max_turns` | 41 / 40 | `s4-verify-results.txt` (§3 unfinished) | `60f83f2` |

⚠️ **Run numbering diverged again:** s1 and s3 both self-numbered "Run 112"; s4 numbered
itself 113. Same class of bookkeeping drift as 2026-08-30 (s2→109, s4→110).

### Input artifact freshness (date-checked, per the standing s5 rule)

| File | Content | Verdict |
|---|---|---|
| `/tmp/ui-audit-results.txt` | Run 112, 2026-08-31 | ✅ **FRESH — used** |
| `C:/tmp/ui-audit-results.txt` | Run 112, 2026-08-31 | ✅ **FRESH — used** |
| `C:/tmp/s4-verify-results.txt` | Run 113, 2026-08-31 | ✅ **FRESH — used** (incomplete) |
| `/tmp/api-test-results.txt` | Run 100, **2026-08-28** | ❌ **3 days stale — NOT used** |
| `C:/tmp/api-test-results.txt` | Run 105, **2026-08-29** | ❌ **2 days stale — NOT used** |
| `C:/tmp/frontend-test-results.txt` | Run 109, **2026-08-30** | ❌ **1 day stale — NOT used** |
| `/tmp/frontend-test-results.txt` | — | ❌ **missing** |

The API numbers in this report were recovered from `C:/tmp/qa-r100-sweep.json` — raw
harness output that s1 wrote at 05:08 and never analyzed before capping. This is the
second consecutive run where a capped stage's unread JSON supplied the entire API
section.

---

## Backend API Test Results

**Inventory:** 272 route patterns across 36 route files (`C:/tmp/route-inventory.txt`).
**Server:** `http://localhost:3001` (the charter says :3000; :3000 is not listening).

### Broad sweep — `.qa-r100-sweep.mjs`, 5 phases

| | |
|---|---|
| Requests | 314 |
| Distinct paths | 198 |
| Path+method pairs | 248 |
| Status spread | `200`: 125 · `400`: 120 · `403`: 8 · `404`: 61 |
| **5xx** | **0** |
| Methods | GET 130 · PATCH 75 · POST 67 · PUT 24 · DELETE 18 |
| Phases | A 130 · B 85 · C 33 · D 33 · E 33 |
| Defects recorded | **0** |

The 120 `400`s and 61 `404`s are the expected results of deliberate bad-input and
unknown-id probes, not failures.

### Coverage by endpoint category

Distinct paths exercised, grouped by mount prefix:

| Category | Paths | Category | Paths |
|---|---|---|---|
| `crm/dashboard` | 15 | `crm/canvass-pins` | 4 |
| `properties` | 12 | `crm/invoices` | 4 |
| `estimates` | 11 | `crm/prospect-lists` | 4 |
| `crm/financing` | 10 | `notifications` | 4 |
| `crm/leads` | 10 | `crm/automations` | 3 |
| `skip-trace` | 9 | `crm/expenses` | 3 |
| `crm/contracts` | 8 | `crm/team` | 3 |
| `crm/work-orders` | 8 | `crm/territories` | 3 |
| `materials` | 7 | `dashboard` / `data` / `documents` / `map` | 3 each |
| `roof-measurement` | 7 | `alerts`, `counties`, `crm/custom-fields`, `crm/pipeline`, `crm/tasks`, `storm-history`, `storms` | 2 each |
| `crm/reports` | 6 | `auth`, `crm/calendar`, `crm/tenant-settings`, `crm/activities`, `disaster-declarations`, `search` | 1 each |
| `onboarding` | 6 | | |
| `admin` | 5 | | |
| `crm/drip-sequences` | 5 | | |
| `crm/subcontractors` | 5 | | |
| `leads` | 5 | | |
| `payments` | 5 | | |

### Targeted probes — jsonb config shapes (automations + drip)

This is where both defects came from. s1 probed `trigger_config` / `action_config`; s4
then probed the fix's own new code and found a second, worse bug behind it.

| Probe group | Result |
|---|---|
| `auth` | login flow exercised; token minted and refreshed |
| `crm/automations` POST/PATCH — `trigger_config` | 7/7 bad shapes → `400` (was `200`) |
| `crm/automations` POST/PATCH — `action_config` | 7/7 bad shapes → `400` (was `200`) |
| `crm/automations` — happy path | `null` → `201` (match-all by design), object → `201`/`200` |
| `crm/automations` — stored column | `{"toStage":"won"}` intact after all 15 rejected writes |
| `crm/drip-sequences` — `trigger_config` | 7/7 POST + 7/7 PATCH bad shapes → `400` |
| `crm/drip-sequences` — step `action_config` | 7/7 → `400` |
| `crm/drip-sequences` — `steps` container | 6 bad shapes → `400` (were 2×`500`, 2×`201`-with-junk) |
| `crm/drip-sequences` — `steps` elements | `[null]` / `['a']` / `[7]` → `400` |
| **Total re-verification** | **50/50 PASS** |

**Engine-level proof (not just status codes).** Automations and drip were fired against
the live DB and the resulting rows counted:

- **Pre-fix:** an object config + a non-matching event created 0 tasks; all 5 scalar
  configs given the *same* non-matching event fired **5/5**.
- **Post-fix:** automations **8/8 PASS**, drip **7/7 PASS** — scalars skip,
  `{toStage:'sold'}` fires on a matching event and only on a matching event, `{}` still
  matches all.

### What was fixed

| Commit | Endpoint(s) | Fix |
|---|---|---|
| `c30d968` | `POST`/`PATCH /api/crm/automations`, `POST`/`PATCH /api/crm/drip-sequences` | New `isPlainObject()` util rejects non-object `trigger_config`/`action_config` with `400` at all four write sites; `matchesConditions()` and `matchesDripConditions()` now fail closed on a non-object config and log a warning |
| `60f83f2` | `POST`/`PATCH /api/crm/drip-sequences/:id` | Route requires a non-empty **array** for `steps` and rejects non-object elements; `createSequence`/`updateSequence` key their step branches on `Array.isArray` so a non-array can never reach the `DELETE` + index rebuild |
| `47d2d13` | — (test harness) | Carried s1's uncommitted `max(updated_at)` snapshot fix in `.qa-r100-sweep.mjs` |

---

## Frontend Feature Test Results

⚠️ **NO FRONTEND FUNCTIONAL TESTING WAS PERFORMED TONIGHT.**

The s2 frontend-test stage ran for 81 turns (~23 minutes of API time, $9.92) and
terminated on `error_max_turns` having produced **no commits, no report artifact, and no
recoverable findings**. The only trace it left is a 1.6 KB Playwright temp file at
`/tmp/playwright-artifacts-OpwlGs/`. Unlike s1 — whose raw sweep JSON was recoverable —
there is nothing to salvage.

Its charter covered 14 pages plus 12 Settings tabs:

| Page | What the charter called for | Result |
|---|---|---|
| `/dashboard` | stat cards, funnel chart, activity feed, tasks due, leaderboard, card navigation | **NOT TESTED** |
| `/storm-map` | map render, storm swaths, layer toggles, address search, Honey Holes | **NOT TESTED** |
| `/pipeline` | kanban render, lead cards, drag between stages, card detail | **NOT TESTED** |
| `/leads` | table, filters (status/source/date), search, CSV export, pagination, sort | **NOT TESTED** |
| `/leads/:id` | every tab, field edit + save, activity modal, score breakdown | **NOT TESTED** |
| `/estimates` | list, create, builder, line items, live preview, save | **NOT TESTED** |
| `/invoices` | list, create, record payment | **NOT TESTED** |
| `/work-orders` | kanban, create, milestones, checklists | **NOT TESTED** |
| `/tasks` | list, create, filter tabs, toggle complete | **NOT TESTED** |
| `/calendar` | render, events, date/event click | **NOT TESTED** |
| `/reports` | charts, date range picker, report type switching | **NOT TESTED** |
| `/canvassing` | map, pin dropping, territories | **NOT TESTED** |
| `/content-studio` | load, content type selection, generation | **NOT TESTED** |
| `/settings` (12 tabs) | Profile, Company, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Integrations, Drip Sequences, Custom Fields, Contracts, Reviews | **NOT TESTED** |

**The one thing that is known about the frontend tonight** comes from s3's static sweep,
not from functional testing: all 19 authenticated routes render, mount their topbar and
sidebar correctly, and leave no stray modal overlay at rest. That establishes the pages
load — it does not establish that any interaction, form, or data flow works.

`C:/tmp/frontend-test-results.txt` on disk is **Run 109 from 2026-08-30** and describes
last night's work. It must not be read as tonight's.

---

## UI Consistency Audit Results

s3 was the only stage to complete cleanly. **0 defects found, 0 fixes required, 0
regressions, 0 app files changed.** Scope: 19 authenticated routes plus a compiled-cascade
analysis of `index.css` (133,818 bytes).

| Audit | Result | Evidence |
|---|---|---|
| **1. Icons** | ✅ PASS — **0 non-Heroicon icons** | 43 imports, all `@heroicons/react/24/outline`; 0 solid, 0 lucide, 0 react-icons, 0 MUI, 0 font-awesome. Runtime: 2,206 `<svg>` across 19 routes, every non-chart/non-map one carrying the `0 0 24 24` Heroicons viewBox. The only 2 inline `<svg>` are the documented map non-bugs (`CanvassingMode.jsx:336` pin-legend swatch, `StormMap.jsx:1764` star glyphs in a Google InfoWindow) |
| **2. Buttons** | ✅ PASS — no unintended inconsistency | 22 page-level button classes measured for height/padding/font-size/radius/weight/background. 9 showed >1 geometry variant; **all 9** resolve to documented deliberate patterns (segmented-control active pills, active-vs-inactive background only, `.row-actions` icon buttons, a `clamp()` radius artifact, Google Maps' own controls) |
| **3. Toolbars / Headers** | ✅ PASS — consistent across all pages | 19/19 routes: `.topbar.glass` present at **exactly 56px** with the correct per-route `<h1>`. Matches Runs 80 and 103 exactly — zero drift |
| **4. Sidebar / Nav** | ✅ PASS, 1 known exception | 19/19: 18 `.nav-link`, 18/18 with icons, every link 42px, gaps `[0,30,8]`, exactly 1 `.is-active`. **Exception:** `/alerts` has 0 `.is-active` — the documented orphan route (nothing links to it; duplicated under Settings → Storm Alerts). Left unfixed: retiring vs. linking it is a developer decision |
| **5. Forms** | ✅ PASS — **0 non-standard elements** | Source grep over all of `client/src`: **0 native `<select>`, 0 `input[type=date]`, 0 `input[type=datetime-local]`**. The CustomSelect / DatePicker rules are fully respected app-wide. All 3 `.form-input` geometry variants are documented deliberate contextual sizes |
| **6. Spacing** | ✅ PASS — no alignment issues | `.glass` padding is consistent *within* each page and varies *between* pages by design (16px list pages, 20px `/reports`, 24px estimates/invoices/contracts/expenses, 14px `/pipeline`). The fractional Dashboard values are the documented Tailwind-rem-against-a-14px-root systemic item |
| **7. Modals** | ✅ PASS — all consistent | 0 stray `.modal-backdrop` / `[role=dialog]` / `.slide-over` on all 19 routes at rest. Standing verified state: 21 of 22 backdrops inherit `modal-scale-in`; the 22nd (`LeadDetail.jsx:2470`) must not (sibling-backdrop pattern). All 22 close buttons at 32×32 |

### Two open UI leads swept and closed

Both remaining named leads in the UI charter were closed this run:

- **Tailwind-utilities layer** — 13 routes / 409 candidate elements / **322 probes**.
  The `utilities` layer genuinely beats `@layer base` at any specificity, but it fires in
  exactly three places and **all three are intended**: arbitrary-value utilities over the
  global button reset (`index.css:91`, a reset that exists to be overridden), the
  documented `!gap-0`/`pb-0` sites, and `sticky` over `.glass`. **0 kills.**
- **mapbox-gl / Google Maps unlayered vendor layer** — 2 map routes / 212 candidates /
  **1,622 probes** / 277 vendor elements. Report-only by charter (map code is off-limits).
  All 4 app rules targeting vendor selectors are alive; the only vendor-side hits are
  Google Maps styling its own controls. **0 kills. Nothing was changed.**

### 🏁 The UI charter is now exhausted

Audits 1–7 have converged for **16 consecutive runs**. Every static dimension and every
interaction state is now measured and closed: `:focus-visible` (R92), `:hover`/`:active`
(R94), inline-vs-state (R98/R101), `!important` (R102), layer order (R106), and Tailwind +
unlayered vendor (R112). **There is no remaining named open lead.** The whole of Audits
1–7 now costs a single tool call. Recommendation: run it as a cheap regression check and
reassign the rest of the s3 budget.

### All three "findings" were bugs in the harness, not the app

Consistent with the standing lesson on this codebase — a finding is more often a bad check
than a broken app. Recorded so the next run does not repeat them:

1. A probe that sets `transition: none !important` before reading **cannot then audit
   `transition`** — the "before" value is the probe's own `none`, so every transition
   declaration scores dead. 5 false hits. Fix: exclude `/^transition/`.
2. A flat `/([^{}]+)\{([^{}]*)\}/g` rule regex **hoists `@media` rules out of their query**.
   `index.css` has exactly one `@media` block (`max-width:768px`, line 3489), all mobile,
   so every rule in it "fails" at desktop width — 4 false positives made convincing by the
   app selectors having *higher* specificity than the utilities they "lost" to.
3. **Re-asserting a shorthand clobbers a longhand declared after it in the same block**
   (`body` `:83-87`, `.sidebar__user` `:399-403`), so correct authored code scores dead.

---

## Bugs Fixed

1. **`PATCH`/`POST /api/crm/automations` + `/api/crm/drip-sequences`** — *A non-object
   `trigger_config` made automations fire on **every** event.* The routes accepted a
   string, number, boolean, array or null for `trigger_config`/`action_config` and
   answered `200`, storing the scalar in the jsonb column. Nothing crashed — a
   named-property read on a scalar yields `undefined` rather than throwing — so
   `matchesConditions()` and `matchesDripConditions()` saw `undefined` for every guard and
   fell through to `return true`. An automation filtered to `{toStage:'sold'}` fired on
   **all** stage changes, creating tasks, changing stages, sending emails and posting
   notifications it was configured not to send. `|| {}` did not catch it: that guards
   *falsy* values only.
   **Fixed** at both halves — write path rejects non-objects with `400` via a new
   `isPlainObject()` util at all four write sites; read path fails closed and logs a
   warning. `null`/`undefined` and `{}` keep their documented match-all meaning.
   Verified by firing real triggers and counting rows: pre-fix 5/5 scalar configs
   over-fired, post-fix automations 8/8 and drip 7/7 PASS. — **`c30d968`**

2. **`PATCH /api/crm/drip-sequences/:id`** — *A non-array `steps` value silently destroyed
   the sequence's real steps.* `steps: "abcd"` returned `200`, `DELETE`d the sequence's
   three real steps (11d send_email / 22d create_task / 33d send_sms) and replaced them
   with four defaulted junk steps. **Data loss behind a success response.** Two guards
   missed it from opposite sides: the route's `Array.isArray(steps) && steps.some(...)`
   validates arrays but *skips* every other type, while `updateSequence()` replaces steps
   on `data.steps !== undefined` and `DELETE`s before rebuilding with an index loop — and
   a string has a `.length` and indexes like an array. Same root shape on `POST` via
   `!steps?.length`, which is not an array check: `steps:"abcd"` and `steps:{length:2}`
   `500`'d, while `steps:['a']`/`[7]` silently created a defaulted row.
   **Fixed** at both halves — the route requires a non-empty array and rejects non-object
   elements; the service keys its step branches on `Array.isArray`. Verified live with
   before/after DB reads: the destructive `PATCH` now `400`s and the 3 real steps are
   byte-identical afterwards; `steps: []` still clears and an omitted `steps` still leaves
   rows untouched. — **`60f83f2`**

**Note on how bug 2 was found:** it was in the *new code shipped by bug 1's own fix*.
`c30d968` added an `Array.isArray(steps) && ...` guard to the PATCH route; s4 probed that
guard rather than trusting it, and found it skipped every non-array type. This is the
strongest argument for keeping the verify stage adversarial toward the same night's fixes.

---

## Known Issues (Not Fixed)

| # | Issue | Why not fixed |
|---|---|---|
| 1 | ⚠️ **No error boundary anywhere in the SPA.** A single bad value white-screens the entire app — sidebar and header included. The amplifier behind four defects (Runs 68, 105, 109 and 2026-08-30's). | Highest-leverage backlog item, but it is an **enhancement**, not a fix — developer's call |
| 2 | **Generic error toasts discard the server's message — 64 sites** vs 22 that surface it. `InvoicesView.jsx:566` shows "Failed to save invoice" when the server said `lead_id is required`; the correct idiom is 26 lines below at `:592`. | App-wide convention change — developer's call |
| 3 | **Form-label drift — 7 distinct treatments.** Real and measured; 8th run deferred. | Converting ~100 inline labels is a refactor, outside the QA charter |
| 4 | **`/alerts` is an orphan route** — nothing links to it; duplicated under Settings → Storm Alerts. Shows 0 active nav links. | Retiring vs. linking it is a design decision |
| 5 | **`EstimatesView.jsx:1318`** uses the `|| []` idiom on a mapped value. | Measured and deliberately not fixed — guarding it means `Array.isArray`-ing every `.map()` in the client |
| 6 | **DB junk rows, all rendering safely:** `qa_options_probe` (both consumers `Array.isArray`-guarded) and 64 subcontractors including rows named `{"$eq":1}` / `{"foo":"bar"}`. | The hygiene sweep matches `'QA-R9%'`, which none of these match. Needs developer go-ahead to delete |
| 7 | **Housekeeping:** 361 QA screenshots committed in the repo root (none added tonight); dead `quickFilters`/`applyQuickFilter` (`LeadList.jsx:62`,`:346`); dead CSS `index.css:959`; stray 0-byte `server/=`. | Cosmetic; no functional impact |
| 8 | **`.qa-r91-neverrun.mjs` has still never been run — 12 nights.** | Carried forward each run |

**Resolved this run:** `C:/tmp/qa-token.txt` had been stale for 3 runs and was 401'ing
every harness request. s4 refreshed it at 05:52. The next s1 no longer needs to mint a
token first.

---

## Test Coverage Gaps

1. ⚠️ **The entire frontend functional charter is unmeasured for this date.** 14 pages and
   12 Settings tabs. s2 capped at `max_turns` with no artifact and no commits. This is the
   single largest gap in the run.
2. ⚠️ **s4's own report is incomplete.** `C:/tmp/s4-verify-results.txt` §3 "Edge cases /
   regression sweep" is a placeholder reading *"see section appended below"* — the section
   was never written, because s4 capped. The regression sweep may or may not have run;
   there is no evidence either way, so it is treated here as **not performed**.
3. ⚠️ **s1 wrote no API report.** All API numbers above were reconstructed from raw
   harness JSON that s1 never read. Second consecutive run with this pattern.
4. **24 of 272 routes were never exercised** (198 of 272 paths reached). 18 are excluded
   by design as side-effecting; 4 are structurally unexercisable (`counties` and
   `material_products` tables absent — `42P01`; `contracts.public_token` and
   `leads.status_token` are not columns — `42703`).
5. **Estimate / invoice / contract *builder* detail response shapes are still unswept.**
   The detail-level shape sweep has reached `/work-orders` only. Named as open for the
   third run.
6. **`/canvassing` pin drop not exercised** — costs a DB write plus a paid geocode.
7. **`/content-studio` and `/leads/:id` are in no sweep**, static or functional.
8. **Sidebar collapse/expand not re-driven** this run (last verified Run 83).
9. **No screenshots taken**, by choice.

---

## DB Hygiene — the "0 writes" claim, scoped honestly

**No table gained rows from QA activity.** Every probe row was deleted and verified:
`automations`, `drip_sequences`, `drip_sequence_steps` and `drip_enrollments` all
confirmed empty afterwards; step-row drift 0; `tasks` and `notifications` drift 0.

**But the night was not write-free.** s1's own sweep recorded one drift entry:
`tenants.max(updated_at)` moved `2026-08-30 05:05:55` → `2026-08-31 05:08:36`, inside s1's
window — the identity `PUT` probes that return `200`. This is the same drift recorded on
2026-08-30. Rows were updated, not added.

---

## Assessment

The backend is in good shape on the evidence available: 314 sweep requests across 198
paths with **zero 5xx**, and both defects found were latent — the UI only ever sends
well-formed values, so neither was reachable through the app today. They matter because
they are reachable through the API, and one of them destroys data behind a `200`.

The **process**, not the product, is the concern. Three of four stages capped on
`max_turns`, s1 for the fifth consecutive run, and s2's entire charter produced nothing
recoverable. Tonight's defect count (2) reflects how much testing actually ran, not how
much of the app is sound.

**Recurring defect shape — tenth consecutive run:** *a value silently loses its expected
type, and the failure is invisible at the call site.* The sub-lesson holds and was proven
twice more tonight: **`|| []` and `|| {}` are not type guards.** They rule out
`null`/`undefined` only. Triage this shape first.

**Recommendations, in priority order:**

1. **Raise the s1/s2 turn budgets or narrow their charters.** Stage capping is now the
   dominant failure mode. s2's charter — 14 pages plus 12 Settings tabs plus interactions
   — is not achievable in 80 turns.
2. **Require every stage to write its artifact *before* spending its remaining budget.**
   s3 did this and is the only stage with a complete record; s4 wrote its artifact early
   but left §3 open and capped before filling it.
3. **Reassign the s3 slot.** The UI charter is exhausted; Audits 1–7 now cost one tool
   call.
4. **Add an error boundary.** Four defects have been amplified from a broken value into a
   whole-app white screen by its absence.
