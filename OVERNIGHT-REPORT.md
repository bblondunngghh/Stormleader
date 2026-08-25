# StormLeads — Overnight QA Report

**Run date:** 2026-08-24
**Branch:** `feat/financing`
**Baseline:** `bf112c9` (tag `pre-overnight-20260824`)
**Head at report time:** `5b73c95`
**Build:** PASS — `vite build`, 7.92s, 0 errors

---

## QA Test Summary

| Metric | Value |
|---|---|
| Pages tested | **25 routes** (19 authenticated + 6 public) + 15 Settings tabs + 4 modal interiors + 4 inline builders |
| API endpoints — inventory | **280 route patterns** across 37 route files (135 GET, 90 POST, 27 PATCH, 20 DELETE, 8 PUT) |
| API endpoints — executed live tonight | **26 probes** across 18 distinct endpoints (see Backend section for the exact breakdown) |
| API endpoints — statically analysed tonight | **109** routes with path params (set difference), **280** patterns inventoried |
| Bugs found | **4** (1 backend, 3 UI) |
| Bugs fixed | **4** (5 fix commits — the heading defect took two, see below) |
| UI inconsistencies found | **3** |
| UI inconsistencies fixed | **3** |
| Net DB rows written | **0** (verified) |
| Page errors | **0** across 19/19 authenticated routes and both `/status/:token` branches |
| New QA harnesses committed | **10** (3 run, 4 self-tested, 3 authored-but-unrun) |

### Commits this run

| Commit | Type | Subject |
|---|---|---|
| `5a3978e` | fix (API) | photo-only milestone PATCH wiped the completed flag |
| `ce8bf6b` | qa | validateId set-difference + bad-id probe (Run 91) |
| `682e4cc` | fix (UI) | keyboard focus reshaped every control in the app |
| `b8b462c` | fix (UI) | dropdown animation hit every BEM child and the always-visible trigger |
| `a97fe00` | qa | self-tested over-broad CSS selector check (Run 92) |
| `c56f3d4` | fix (UI) | public pages had no heading element of any level (5 of 6 pages) |
| `5b73c95` | fix (UI) | the 6th public page still had no heading element |

### Stage outcomes

Four of five stages hit their turn cap. This is the sixth consecutive night with
multiple caps and it is the single biggest process risk in the pipeline.

| Stage | Run | Outcome | Effect on results |
|---|---|---|---|
| s1-api-test | 91 | **CAPPED 51/50** | Found the milestone bug but never committed it; authored 3 harnesses and ran **none**. The full API sweep did not happen. |
| s2-frontend-test | 91 | **Completed** | Recovered and committed s1's fix; closed two carried gaps; 19 routes + 15 tabs + modal interiors clean. |
| s3-ui-audit | 92 | **CAPPED 61/60** | Committed all 3 fixes and its harness **before** capping, so nothing was lost. |
| s4-verify | 93 | **CAPPED 41/40** | Left the 6th public-page fix and a token lookup uncommitted; **recovered and committed in this stage** as `5b73c95`. |
| s5-report | 93 | Completed | This report. |

**`git status` first paid out again — twice.** s1's fix was recovered by s2, and
s4's fix was recovered by this stage. That habit has now recovered real work on
6 of the last 9 nights.

---

## Backend API Test Results

The full 280-pattern sweep **was not run this cycle** — s1-api-test capped before
executing any of the harnesses it authored. What follows is what actually
executed, by category. Anything not listed here was not exercised tonight.

| Category | Endpoints tested | Passed | Failed | Method |
|---|---|---|---|---|
| Work orders / milestones | 1 (`PATCH /api/crm/work-orders/:id/milestones/:mid`) | 4/4 after fix | 1 defect pre-fix | End-to-end repro + SQL differential |
| Admin | 4 (`overview`, `tenants`, `revenue`, `usage`) × 2 roles = 8 probes | 8/8 | 0 | Real minted tokens, both roles |
| Path-param validation | 13 routes with no `validateId` | 13/13 | 0 | Non-UUID / numeric / injection-shaped ids |
| Auth / token minting | 1 (`POST /api/auth/login`) | 1/1 | 0 | Real login, `tenantSlug` + `accessToken` |
| **Live total** | **18 distinct endpoints, 26 probes** | **26/26 after fix** | **1 defect found** | |
| Path-param scoping (static) | 109 routes with path params | 0 category-A, 0 category-B | 0 | Self-tested set difference |
| Route inventory (static) | 280 patterns / 37 files | n/a | n/a | Source enumeration |

### What was fixed

**`5a3978e` — `PATCH` milestone: a photo-only update wiped the completed flag.**

`workOrderService.updateMilestone` bound `req.body.completed` straight into
`SET completed = $3`. On a partial PATCH that field is `undefined`, which
node-postgres sends as **NULL**, so the flag was overwritten and `completed_at`
was dropped by the CASE.

This is a live user path, not a synthetic one: `WorkOrdersView.jsx:97` uploads a
milestone photo with `{ photo_url }` alone — so **attaching a photo to a finished
milestone marked it incomplete and lost its completion timestamp.**

Fixed with `COALESCE($3::boolean, completed)` and by holding `completed_at`
unchanged when the binding is NULL.

> ⚠️ **The end-to-end repro passed 4/4 on first run and that was misleading.**
> s1 had already restarted the server (file mtime 05:10:12, server start
> 05:10:32), so the "before" measurement was actually the post-fix state. The fix
> was proven instead by `.qa-r91-milestone-sqldiff.mjs`, which runs the OLD and
> NEW statements directly against one existing row with the photo-only binding:
> **OLD wipes (`completed=null`), NEW preserves (`completed=true`, `completed_at`
> set).** Row restored; restore verified; 0 milestones left with
> `completed IS NULL`.

### Carried question closed: `/admin` 403 is correct authorization

This sat on the "documented-intentional" list for **five runs on an unproven
hypothesis**. s2 ran the probe s4 had written and never got to:

- as `super_admin` → **200** on all four admin endpoints
- as `admin` (what the browser actually sends) → **403** on all four

The 403 is correct. The page renders at all only because
`VITE_DEV_BYPASS_AUTH=true` shows a `super_admin` `DEV_USER` in the SPA while the
real token carries role `admin`. **Moved from "unproven" to verified non-bug — do
not re-file.**

### Bug class ruled out: `validateId` gaps

s1 hypothesised that `validateId(...names)` defaulting to `['id']` when called
bare would leave `:leadId`/`:contactId` routes unguarded — the exact shape of last
night's `eb6737a`. A set difference of each route's real path params against what
its `validateId()` call guards returned **109 routes → 0 category-A, 0
category-B. The class does not exist here.**

The zero is credible **because the harness was self-tested first**: two synthetic
defects were planted (one per category), the harness caught both, then `crm.js`
was restored and re-verified. A set difference reporting zero is worthless
without that step.

---

## Frontend Feature Test Results

19/19 authenticated routes render with **0 page errors and 0 console errors**
(except `/admin`, whose two console entries are the now-proven-intentional 403s).
All 15 Settings tabs clean. Re-confirmed in this stage by an independent sweep.

| Page | Tested | Result | Needs attention |
|---|---|---|---|
| `/` Dashboard | Render, stat cards, card→route navigation | PASS — cards navigate correctly | — |
| `/leads` | Render, search, sort | PASS — verified via outgoing query params | — |
| `/pipeline` | Render, stage columns | PASS | — |
| `/estimates` | Builder math live: 3 × $250 = $750, subtotal/total/preview | PASS | — |
| `/contracts` | Render, "Send Contract" disabled state | PASS — disabled is `!customerEmail` validation, not a defect | — |
| `/invoices` | Render | PASS | "New Invoice" is a full-page builder, **not** a modal |
| `/work-orders` | Milestone toggle 0/7 → 1/7 → reverted | PASS | — |
| `/materials` | Render (183 buttons — largest surface in app) | PASS | "Add" is a client-side cart, **not** a modal |
| `/expenses` | Render, modal opened | PASS | `ExpensesView.jsx:56` dead `searching` state (cosmetic) |
| `/subcontractors` | Render | PASS | — |
| `/tasks` | Render, slide-over opened | PASS | — |
| `/calendar` | Render | PASS | — |
| `/reports` | Render | PASS | — |
| `/storm-map` | All 5 app storm-map layers toggled | PASS | — |
| `/storm-catalog` | Render | PASS | — |
| `/canvassing` | Render | PASS | — |
| `/settings` | **All 15 tabs** | PASS — all clean | — |
| `/alerts` | Render | PASS | 0 active sidebar entries — known orphan route |
| `/admin` | Render, 4 endpoints × 2 roles | PASS — 403 proven intentional | — |
| **6 public routes** | `/login` `/register` `/onboarding` `/estimate/:token` `/contract/:token` `/status/:token` | Render clean — but **zero headings between them** | **FIXED** (`c56f3d4`, `5b73c95`) |

### Coverage advanced this run

The gap Run 90 named as most valuable — "take the audit battery **inside** modals
and builders" — was closed for the first time. 4 modals opened and 4 inline
builders exercised, all clean.

**The 6 public routes had never been rendered by any audit in the pipeline's
history.** The documented "19 routes" sweep is authenticated-only. These are the
pages prospects and homeowners actually see.

### Two candidates died on inspection rather than becoming tickets

- `/contracts` "Send Contract" disabled → plain `!customerEmail` validation.
- Four "create" buttons are **inline view swaps, not modals** — a modal-only
  detector reports those as dead buttons. `/invoices` "New Invoice",
  `/contracts` "New Contract" and `/materials` "Add" are full-page builders or a
  client-side cart.

---

## UI Consistency Audit Results

The 7 prescribed audits have now converged for **11 consecutive runs**. Rather
than re-spend a run on them, s3 ran the cheap regression (source greps, which are
definitive — a browser sweep cannot see inside an unopened modal — plus one
computed-style sweep) and spent the run on **two dimensions no prior run had
touched**. Both produced real defects.

Regression figures below are from an independent re-measurement taken during this
reporting stage, not copied from an earlier run.

| # | Category | Measured | Result | Fixed |
|---|---|---|---|---|
| 1 | **Icons** | Source grep, all of `client/src` | **0** foreign icon libs (lucide / react-icons / fontawesome / mui); **0** non-outline Heroicon imports; inline `<svg>` only in the 2 documented map files | n/a — none found |
| 2 | **Buttons** | 1,033 visible `<button>` across 19 routes | Consistent; every outlier resolves to a documented deliberate variant | n/a — none found |
| 3 | **Toolbars / headers** | `.topbar` on 19 routes | **56px + `topbar glass` on 19/19**; exactly **1 `<h1>` on 19/19** | n/a — none found |
| 4 | **Sidebar / nav** | `.nav-link` on 19 routes | **18 links / 18 icons on 19/19**; gaps identical on 19/19; active=1 on 18/19 | `/alerts` active=0 — known orphan route, deferred |
| 5 | **Forms** | Source grep + runtime | **0** native `<select>`, **0** `input[type=date\|time\|datetime-local]` in JSX on 19/19 | n/a — none found |
| 6 | **Spacing** | Document overflow, `.glass` padding | **0 overflow on 19/19**; padding drift is the documented systemic 17.5px Tailwind-rem-at-14px-root | n/a — deferred, systemic |
| 7 | **Modals** | `.modal-backdrop` / `.slide-over` at rest | **0 open at rest on 19/19**; 4 interiors opened and audited | Title heading drift deferred (see Known Issues) |
| **8** | **Interaction states — `:focus-visible`** ⭐ | 273 focusable elements / 5 routes | **204 elements in 10 classes changed shape on focus** | **FIXED `682e4cc`** |
| **9** | **Over-broad selectors** ⭐ | 636 CSS rules | `[class*="dropdown"]` substring match hit every BEM child + an always-visible glass trigger | **FIXED `b8b462c`** |
| **10** | **Public routes** ⭐ | 6 routes, first time ever rendered | **0 `h1`/`h2`/`h3`/`h4` across all six** | **FIXED `c56f3d4` + `5b73c95`** |

⭐ = dimension measured for the first time in the pipeline's history.

### The headline — `:focus-visible` reshaped 204 controls (`682e4cc`)

Every previous audit measured only the **default** state. One `:focus-visible`
measurement found the largest-blast-radius UI defect in many runs.

`index.css:4384` set `border-radius: var(--radius-sm)` inside a bare
`:focus-visible` block. **A bare pseudo-class has class-level specificity (0,1,0)**
and this block sits after every component rule — so it won the cascade against
each control's own radius the moment that control took keyboard focus.

```
.nav-link          12px      -> 8px   (x90, every sidebar item, every page)
.quick-action-btn  14px/12px -> 8px   (x55)
.topbar__btn       12px      -> 8px   (x10)
.auth-btn          14px/12px -> 8px   (primary action button)
.form-input        12px      -> 8px
.nav-group__header 0px       -> 8px   (square controls rounded instead)
```

The declaration was also **unnecessary** — browsers already derive the outline's
corner radius from the element's own `border-radius`.

**Verified: 10 distinct changes → 0, with the focus ring still rendering on
270/273.** The lone exception is a third-party Mapbox attribution button,
unaffected by this change. Asserting the ring survives is mandatory — silently
deleting the a11y indicator would be a worse bug than the one being fixed.

### Same bug family — `[class*="dropdown"]` (`b8b462c`)

A **substring** match, so it selected far more than dropdown containers.

Opening Notifications ran **four simultaneous scale-in animations** — the panel
plus `__header`, `__list` and `__empty` — each child scaling **inside its
already-scaling parent**, each with a different resolved `transform-origin` (180 /
189 / 190px, because `top center` resolves per element width). Help did the same
with `__header` + `__body`.

It also matched `.map-controls__dropdown`, an **always-visible wrapper**. Because
`animation-fill-mode: both` holds the final `scale(1)`, that wrapper carried a
**permanent transform**, permanently creating a stacking context around a
`.glass` child with `backdrop-filter` — **exactly the documented glass breakage**
(`feedback_no_animation_on_glass_parents`).

And it **silently overrode three components' own animations**: `.search-dropdown`
and `.notification-dropdown` declare `fadeIn`, `.map-controls__dropdown-menu`
declares `dropdown-fade-in`; all three computed `dropdown-in`. Unifying them is
the rule's evident intent, so that was kept — now applied once per container.

**Verified:** containers still compute `dropdown-in`; every BEM child now computes
`animation-name: none` / `transform: none`; the map wrapper and trigger are
`anim=none tf=none` with the trigger still `backdrop-filter: yes`. No map logic
touched.

### Public pages had no heading element at all (`c56f3d4`, `5b73c95`)

All 19 app routes carry an `<h1>` via `TopBar` view titles. The **six public,
customer-facing routes had zero headings of any level between them** — "Sign in",
"Create your account", "Company details", "ESTIMATE EST-090" and "CONTRACT" were
all plain `<div>`s. The worst place in the app to have no document outline.

`c56f3d4` promoted the existing title element on five of them. The sixth,
`/status/:token`, is reachable only with a real share token, so it could not be
rendered until one was resolved from the database — s4 wrote that lookup and the
fix, then capped before verifying or committing. **Recovered and verified in this
stage as `5b73c95`:**

```
before: 0 headings; DIV 462x33 @ top 73; 22px/700; margin 0; innerText 246
after:  1 h1;        H1  462x33 @ top 73; 22px/700; margin 0/padding 0; innerText 246
```

Byte-identical text length, pixel-identical box, 0 page errors, 0 overflow. The
error branch renders one `h1` "Page Not Found" at 18px/600 with margin `0 0 8px`
— its own inline `marginBottom`, no UA margin leaked.

The swap is **visually neutral by construction**: the universal reset at
`index.css:13` zeroes the UA heading margin, and every promoted title already set
`font-size` and `font-weight` explicitly, so no UA heading default survives. The
same proof held on the other five pages, where `document.body.innerText.length`
was byte-identical before and after on all five (113 / 156 / 189 / 234 / 1089).

### New harness — `server/.qa-r92-broadselector.mjs` (`a97fe00`)

Detects the bug class both CSS defects belong to: selectors that are **broad but
carry class-level specificity** (bare pseudo-class, `[attr*=]`) while setting
properties components own — radius, animation, transform, geometry.

**`--selftest` runs it against the pre-fix CSS at `682e4cc~1` and requires it to
rediscover both proven defects. It catches both, out of 636 rules.** On the fixed
tree 6 findings remain, all benign: bare **element** selectors (`html`, `body`,
`button` — specificity 0,0,1, so they always lose to a class) and
`::-webkit-scrollbar*` pseudo-elements. The distinction that matters is
element-vs-pseudo-class breadth, not "broad" alone.

---

## Bugs Fixed

1. **`PATCH /api/crm/work-orders/:id/milestones/:mid`** — a partial (photo-only)
   PATCH bound `undefined` into `SET completed = $3`, which node-postgres sends as
   NULL, wiping the completed flag and dropping `completed_at`. Attaching a photo
   to a finished milestone marked it incomplete. — Fixed with
   `COALESCE($3::boolean, completed)` and by holding `completed_at` unchanged on a
   NULL binding. Proven by a SQL differential against a real row (OLD wipes, NEW
   preserves); row restored. **`5a3978e`**

2. **App-wide, every keyboard-focusable control** — a bare `:focus-visible` block
   at `index.css:4384` set `border-radius: var(--radius-sm)`. Bare pseudo-classes
   carry class-level specificity and the block sits after every component rule, so
   **204 elements in 10 classes visibly changed shape on keyboard focus** (every
   sidebar item on every page, x90). — Removed the declaration; browsers already
   derive the outline radius from the element's own. Verified 10 changes → 0 with
   the ring still on 270/273. **`682e4cc`**

3. **Notifications / Help / map controls** — `[class*="dropdown"], [class*="popover"]`
   is a substring match, so it animated every BEM child (Notifications ran 4
   simultaneous scale-ins, children scaling inside the scaling parent) and put a
   permanent transform on an always-visible wrapper around a `.glass` child with
   `backdrop-filter` — the documented glass breakage. It also silently overrode 3
   components' own animations. — Replaced the substring selectors with an explicit
   container list. **`b8b462c`**

4. **All 6 public routes** — `/login`, `/register`, `/onboarding`,
   `/estimate/:token`, `/contract/:token`, `/status/:token` had **zero
   `h1`/`h2`/`h3`/`h4` between them**, while all 19 app routes have an `<h1>`. —
   Promoted the existing title element on each; no new markup, no new CSS. Proven
   visually neutral by byte-identical `innerText.length` and pixel-identical box
   geometry on every page. **`c56f3d4`** (5 pages) + **`5b73c95`** (the 6th,
   recovered from s4's capped run).

---

## Known Issues (Not Fixed)

### Deferred by decision — cosmetic or systemic

- **`/alerts` has 0 `.is-active` sidebar entries** — orphan route with no matching
  nav item. Confirmed again tonight on 19/19 sweep. Cosmetic.
- **`.glass` padding drift** — 17.5px resolves from a Tailwind rem against a 14px
  root. Systemic and consistent per family; changing it is a design decision.
- **Modal title heading drift** — `/materials` uses `h3`/16px, `/work-orders` uses
  `h2`/18px, `/expenses` uses `h3`. Cosmetic; needs a design ruling on the
  canonical modal title level.
- **2 duplicate CSS blocks** (`.form-input` transition, `.public-estimate-error`
  colour) — **verified, not assumed**: all custom properties are defined and both
  resolve to the intended value. Dead declarations only. Merging is a refactor the
  QA charter forbids.
- **6 remaining `broadselector` findings** — all benign: bare **element** selectors
  (specificity 0,0,1, always lose to a class) and scrollbar pseudo-elements.
- **`ExpensesView.jsx:56` dead `searching` state** — no spinner renders during lead
  search. Real but cosmetic.
- **No delete anywhere in the app asks for confirmation** — `confirm(` appears
  **zero** times in the codebase. App-wide and apparently deliberate; a design
  decision, not a bug.
- **Dead files on disk** — `client/src/components/Icons.jsx.backup` and
  `client/src/assets/icons-backup/` (17 duplicated SVGs). Not imported, no runtime
  effect; noted so a future audit does not re-flag them.

### Blocked — needs a key, a network path, or the user's call

- **Skip-trace returns 503 without `TRACERFY_API_KEY`** — intentional, cannot be
  tested here.
- **County import fails `ENOTFOUND feature.tnris.org`** — no network access to that
  host from this environment.
- **Pre-existing QA rows are user-visible** — the `qa_options_probe` custom field
  and lead `Qa20260730c`. Not from this run, irreversible to delete safely. **Left
  for the user's call.**
- **Two orphaned QA upload files on disk** (23 bytes each) from a prior stage cap;
  the DB rows were already removed.

### Process

- **Four of five stages hit their turn cap** (s1 51/50, s3 61/60, s4 41/40) — the
  sixth consecutive night. s3 committed before capping so lost nothing; s1 and s4
  each capped holding an uncommitted fix, both recovered by a later stage. The
  recovery habit works, but it is costing roughly one stage of throughput per
  night.

---

## Test Coverage Gaps

1. **The full API sweep did not run this cycle.** s1-api-test capped before
   executing anything. The last full 280-pattern sweep was **Run 82, 2026-08-19**.
   Tonight's backend coverage was 18 endpoints live plus static analysis — a
   **gap, not a pass.**

2. **Three authored API harnesses are still unrun** — no output files exist for
   any of them. Committed so the authoring cost is not lost a second time:
   - **`.qa-r91-realidwrite.mjs` — the highest-value remaining item in the whole
     pipeline.** 34 PATCH/PUT handlers have never been executed against a real
     row. This targets the documented blind spot behind two of the last five real
     bugs. **It performs writes — read it before running, do not execute blind at
     the end of a stage.**
   - `.qa-r91-neverrun.mjs`
   - `.qa-r91-validateid.mjs` (superseded by `.qa-r91-validategap.mjs`, which ran
     clean)

3. **A dead-UUID sweep proves validation, not handlers.** It 404s inside
   validation *before* the handler body executes. Run 87 got a real id into only
   **29 of 119** param GET routes, so most handler bodies remain unproven.

4. **`:hover` and `:active` are still unmeasured.** Focus went unmeasured for 11
   runs and paid out immediately on the first look; these are the same shape of
   gap. Watch specifically for hover rules that change **geometry** —
   padding/border-width/height cause layout shift, transform does not.

5. **4 GET handlers have never executed their bodies** — `drip_sequences`,
   `prospect_lists` and `financing_applications` hold zero rows, so the handlers
   return empty without exercising their logic.

6. **Modal interiors are only partly covered** — 4 of 22 `.modal-backdrop` /
   `.slide-over` instances have been opened and audited.

7. **This repo has no ESLint at all** — no config, no lint script, so `no-undef`
   never runs. The committed `.qa-*.mjs` set differences exist specifically to
   cover that hole; all currently report zero.

8. **The prescribed result files were not written this cycle.**
   `/tmp/frontend-test-results.txt` does not exist.
   `/tmp/api-test-results.txt` is from **Run 82 (2026-08-19)** and
   `/tmp/ui-audit-results.txt` is from **Run 84 (2026-08-21)** — both stale, and
   **neither reflects tonight's run.** Nothing in this report is drawn from them.

---

## Verification

- `vite build` — **PASS**, 7.92s, 0 errors (warning is the pre-existing mapbox-gl
  chunk size).
- 19/19 authenticated routes re-swept in this stage: 0 page errors, topbar 56px +
  `topbar glass` on 19/19, 1 `<h1>` on 19/19, 18 nav links / 18 icons on 19/19, 0
  native selects, 0 date inputs, 0 overflow, 0 modals open at rest.
- `/status/:token` verified in both branches, before and after the fix, across a
  stash/restore of the exact diff.
- **Net DB writes: 0.** Verified — 0 rows created in the last 2 hours, 0 stray
  records, the milestone row restored and the restore confirmed, and 0 milestones
  left with `completed IS NULL`. Tonight's only database access from this stage
  was a read-only token lookup.
