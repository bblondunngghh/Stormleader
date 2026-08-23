# Overnight QA Report — 2026-08-23

**Project:** StormLeads / StormPipe
**Branch:** `feat/financing`
**Baseline:** `dc8556d` (checkpoint: pre-overnight-run 2026-08-23, tag `pre-overnight-20260823`)
**Head at report time:** `1692ad2`
**Stages run:** s1 api-test (Run 88), s2 frontend-test (Run 88), s3 ui-audit (Run 89), s4 verify (Run 90), s5 report

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages (routes) tested | **19** |
| API route patterns inventoried | **272** (36 route files) |
| API route patterns exercised | **272** — 132 GET, 88 POST, 26 PATCH, 18 DELETE, 8 PUT |
| Bugs found (new, this run) | **0** |
| Bugs fixed | **1** (carried open from 2026-08-22) |
| Bugs open | **0** carried defects; 1 unresolved *question* (see Known Issues) |
| UI inconsistencies found | **0** — 9th consecutive converged run |
| UI inconsistencies fixed | **0** — nothing was found to fix |
| Net DB rows written | **0** (every created row deleted and verified gone) |
| Build | **PASS** (vite, 8.29s) |
| Page errors | **0** on 19/19 routes |

Fix commit: `eb6737a`. Harness commits: `ae63532`, `1692ad2`.

**This was a convergence run.** No new defect was found in either the API sweep, the
frontend sweep, or the UI audit. The single fix landed tonight closes the one item
that last night's run left open. Three new detection dimensions were built instead,
each self-tested against a planted positive before a zero result was trusted.

Two of the five stages hit their turn cap: **s1 api-test** (51/50) and **s4 verify**
(41/40). s1's fix work was committed before the cap and was not lost, but its final
three sweeps were never run — see *Test Coverage Gaps*. s4 reached its cap during an
investigation, so it concluded nothing; nothing was lost, but nothing was settled.

---

## Backend API Test Results

Inventory: **272 route patterns across 36 route files**, re-derived from source this
run (`C:/tmp/route-inventory.json`, regenerated 05:05).

| Category | Route file(s) | Patterns | Result |
|---|---|---|---|
| CRM (leads, contacts, tasks, pipeline) | `crm.js` | 51 | 1 fixed, rest pass |
| Properties | `properties.js` | 18 | Pass |
| Estimates | `estimates.js` | 17 | Pass |
| Contracts | `contracts.js` | 13 | Pass |
| Financing | `financing.js` | 13 | Pass |
| Work orders | `workOrders.js` | 12 | Pass |
| Skip trace | `skipTrace.js` | 10 | Pass (503 without `TRACERFY_API_KEY`, intentional) |
| Materials | `materials.js` | 9 | Pass |
| Drip / invoices / subcontractors / roof measurement | 4 files | 32 | Pass |
| Onboarding / payments | 2 files | 14 | Pass |
| Admin | `admin.js` | 6 | 403 under the browser's token — unresolved, see below |
| Reports / territories / leads / notifications | 4 files | 24 | Pass |
| Auth | `auth.js` | 5 | Pass |
| Automations / canvassing / expenses / drift | 4 files | 20 | Pass |
| Alerts / counties / dashboard / dataApis / documents / map | 6 files | 23 | Pass |
| Storm history / storms / disaster declarations / search / webhooks | 6 files | 8 | Pass |

### What was fixed

**`eb6737a` — `DELETE /api/crm/leads/:leadId/contacts/:contactId` ignored `:leadId`.**

`crm.js:325` called `crmService.deleteContact(tenantId, contactId)`; the `:leadId`
path param was declared but never read. A request naming a lead that did **not** own
the contact returned **200 and deleted the row anyway**. `req.tenantId` was still
enforced throughout, so this was a **within-tenant scoping defect, not a cross-tenant
leak**. `deleteContact` now takes `leadId` and scopes the `DELETE` by `lead_id`, so a
non-owning lead yields `rowCount 0` → **404**.

Verified by `server/.qa-r88-contactscope.mjs` (9 assertions): **9/9 on the fixed
tree**, and **6/9 against the stale pre-fix instance** still running on `:3001` — the
3 failures are exactly the scoping assertions, so the probe is self-tested against a
known positive rather than assumed correct. Malformed-UUID 400s, repeat-delete 404,
and the legitimate delete path all still hold. Net DB writes: **0**.

This defect was **found by s1 on 2026-08-22**, which hit its turn cap before fixing
it, and was carried on the open list overnight. Tonight's s1 made it the first item.

### Detection built (no defects found by any of it)

- **`ae63532` — orphan path-param set difference** (`server/.qa-r88-orphanparam.mjs`).
  Generalizes the contact-DELETE defect into a reusable check: for every route with
  2+ path params, diff the params *declared* against the params the handler actually
  *reads*. Self-tested — pointed at `git archive eb6737a~1` it reports exactly the one
  known finding; on the fixed tree, **0**. Coverage reconciled independently: 272
  routes scanned, 5 multi-param. A raw grep finds 6; the 6th is `subcontractors.js.bak`,
  a dead file, correctly excluded. No sub-router uses `mergeParams`, so no parent
  params are hidden.
  Because "reads the param" does not prove "the SQL scopes by it", the other 4 were
  also read at the query level and all are correct.
- **`ae63532` — enum 500 check** (`.qa-r88-enum500.mjs`): CHECK-constrained write routes
  return 400, never 500 — **0 5xx over 6 probes**.
- Confirmed the Run 80 automation-priority handoff was already fixed by `5329a7e`:
  both `automationEngine` and `dripService` call `normalizeTaskPriority`.

---

## Frontend Feature Test Results

**19/19 routes tested. Zero defects found.** No client source change was made, because
nothing was broken. Build passes, working tree clean, **net-zero DB writes**.

| Page | What was tested | Result |
|---|---|---|
| `/estimates` — builder | Line-item math: 3×$1200 + 2×$500 = **$4,600**; 30% margin → $3,220 cost / $1,380 profit | Pass |
| `/estimates` — review toolbar | **Download PDF** and **Sign Now** on the new-estimate path | **Pass — the app's #1 hot spot is now fully healthy** |
| `/invoices` | Record Payment: prefills balance, rejects overpay with no request, valid payment POSTs and toasts | Pass |
| `/work-orders` | Milestones 0/7 → 1/7 (14%); photo-required guard blocks with no PATCH | Pass |
| `/tasks` | **Toggle-complete — closed a standing gap** (untested since Run 85) | Pass |
| `/settings` | All **15 tabs** | Pass |
| `/leads` | Lead detail slide-over, score breakdown | Pass |
| `/calendar` | Render + event modal | Pass |
| Remaining 10 routes | Load, render, console | Pass — 0 page errors |

### Standing gap closed

`/tasks` **toggle-complete** had been untested since Run 85: the dataset holds 0 tasks
and there is no DELETE route for tasks, so creating one leaves a permanent row on the
free tier. s2 stubbed the **read** side with 4 synthetic tasks and verified the
behaviour end-to-end with **zero writes** — counters moved `Pending 3 / Completed 1` →
`2 / 2`, the correct `PATCH /crm/tasks/:id {"completed_at":…}` fired, and the row left
the Pending list.

### The estimate toolbar — four runs of regressions, now clean

The Review & Share toolbar has produced five dead controls across four runs (R83, R84,
R85, R87), every time with the same root cause: a control gated on the `estimate`
**prop**, which is null for the entire life of a new estimate. This run exercised it
directly and **both remaining controls work**: PDF downloads, Sign Now opens with its
signature canvas. Runs 85 and 87's fixes both hold.

### Needs attention (deliberately not changed)

- **Pre-existing QA rows are now user-visible**: a `qa_options_probe` custom field and
  a lead named `Qa20260730c`. Left by an earlier run, not this one. Deletion is
  irreversible, so this is flagged for your call rather than actioned.
- **No delete anywhere in the app asks for confirmation** — `confirm(` appears **zero**
  times across all components. This is app-wide and appears deliberate; adding
  confirmation is an enhancement, outside the QA charter.

---

## UI Consistency Audit Results

**7/7 prescribed audits pass on 19/19 routes. Zero visual defects — the 9th
consecutive converged run.** Zero client source changes. Full table at
`C:/tmp/ui-audit-results.txt`.

| Audit | Checked | Result |
|---|---|---|
| **1. Icons** | Non-Heroicon icons, solid variants, foreign libs, inline `<svg>` | **0 found, nothing to fix.** Now closed at *source* level |
| **2. Buttons** | Border-radius sets, style-signature groups, disabled state | **0 outliers.** All groups map to documented families |
| **3. Toolbars / Headers** | `.topbar glass` height, `<h1>` presence | **56px on 19/19**, `<h1>` on 19/19, titles correct |
| **4. Sidebar / Nav** | Link count, icon count, inter-item gaps, active state | **18 links / 18 icons**, identical gaps on 19/19. `/alerts` = 0 `.is-active` (documented orphan route, deferred) |
| **5. Forms** | Native `<select>`, `input[type=date]`, non-`.form-input` | **0 native selects, 0 date inputs** — source-level, covers unrendered modals |
| **6. Spacing** | Horizontal overflow, `.glass` padding | `scrollWidth − clientWidth = 0` on 19/19. Padding drift is one systemic Tailwind-rem-vs-14px-root thing (deferred) |
| **7. Modals** | Scale-in animation, radius, close button | **21/22 animated via CSS inheritance; the 22nd must not be.** See below |

### Audits 1 and 5 upgraded from browser sweep to source grep

For nine runs these were run as runtime sweeps. **A runtime sweep only sees what
rendered** — a native `<select>` inside a modal that never opened is structurally
invisible to it. Greps over all of `client/src` now close them definitively: **0**
native `<select>`, **0** `input[type=date]`, **0** solid-variant imports, **0** foreign
icon libraries, **0** inline `<svg>` outside the two documented map files. Every icon
import is `24/outline` (37) or `./Icons` (17), whose sole import is `24/outline`. All
**33** `Icons.jsx` aliases verified semantically correct.

### A near-miss that would have broken a working modal

A className count shows **22 `.modal-backdrop` but only 6 `.modal-scale-in`**, which
reads as 16 unanimated modals. **It is not a defect.** `index.css:4468` gives the
animation to any direct `.glass` / `form.glass` child of a backdrop, covering **21 of
22** for free (confirmed at runtime on two modals, both computing `modal-scale-in
0.2s`). The 22nd — `LeadDetail.jsx:2470`, the sibling-backdrop pattern — **must not**
get the class: the keyframe ends at `transform: none`, which would clobber its
`translate(-50%,-50%)` centering and throw the panel off-screen. "Fixing" the count
would have broken a working modal.

### Three new check dimensions, each self-tested, all clean

- **Icon semantics** — maps accessible name → svg path signature and flags one action
  rendered with two different Heroicons, a real defect no computed-style sweep can
  see. Self-test passed against a planted positive. **0 conflicts across 69 action
  names / 41 distinct icons.**
- **CSS duplicate-selector conflicts** (`1692ad2`, `server/.qa-r89-cssdupe.mjs`) —
  636 blocks / 667 selectors / 6 duplicated / **2 conflicts, both verified benign at
  runtime.**
- **Disabled-state consistency** — the global `button:disabled` rule covers every
  button; only 2 inline overrides exist and both dim correctly. **Check closed.**

---

## Bugs Fixed

1. **`DELETE /api/crm/leads/:leadId/contacts/:contactId`** — the `:leadId` path param
   was declared but never read, so deleting a contact through a lead that did not own
   it returned **200 and removed the row** (within-tenant scoping defect; tenant
   isolation intact). — **Fixed in `eb6737a`**: `deleteContact` now takes `leadId` and
   scopes the `DELETE` by `lead_id`, so a non-owning lead yields 404. Verified 9/9 on
   the fixed tree and 6/9 against the pre-fix instance, with the 3 failures being
   exactly the scoping assertions.

No other defect was found this run.

---

## Known Issues (Not Fixed)

1. **`/admin` returns 403 under the browser's token — root cause unconfirmed.** The
   browser session runs `VITE_DEV_BYPASS_AUTH=true`, so the SPA renders `DEV_USER`
   (role `super_admin`) while every API call carries the real `brandon` token, whose
   role is `admin`. That mismatch is the *hypothesis* for "Failed to load overview
   data." s4 wrote a read-only probe to settle it (`server/.qa-r90-adminrole.mjs`,
   mints a token for the real `super_admin` user and GETs the four admin endpoints)
   but **hit its turn cap before running it.** Until it runs, whether `/admin` is a
   dev-environment artifact or a genuinely broken page is **unproven either way**.
   The two console 403s have been on the documented-intentional list for several runs,
   which is exactly why this deserves a definitive answer. *Make this the first item
   of the next verify stage — the probe is already written.*
2. **`/alerts` has 0 `.is-active` sidebar entries** — orphan route, no matching nav
   link. Cosmetic; deferred since an earlier run.
3. **`.glass` padding drift** — Tailwind rem units against a 14px root produce
   8.75/10.5/17.5/21px. One systemic cause; a fix is a design decision, not a bug fix.
4. **Modal title heading drift** — `/materials` cart uses `H3/16px`, `/work-orders`
   uses `H2/18px`; `/expenses` uses `<h3>` where others use `<h2>`. Per-file inline
   style objects. On the known-and-deferred list since Run 84.
5. **Two duplicate CSS blocks** (`.form-input` transition, `.public-estimate-error`
   colour). Both were checked rather than assumed — every custom property is defined
   and both resolve to the **intended** value (the error text renders `rgb(220,38,38)`,
   the correct red), so this is **not** the Run 76 undefined-`var()` shape it
   resembles. They are dead declarations with zero user-visible effect; merging them
   is a pure refactor, which the charter forbids.
6. **`ExpensesView.jsx:56`** — genuinely dead `searching` state, so no spinner renders
   during lead search. Real but cosmetic; adding one is an enhancement.
7. **Pre-existing QA rows are user-visible** — `qa_options_probe` custom field, lead
   `Qa20260730c`. Left by an earlier run. Irreversible to delete, so left for your call.
8. **No delete confirmation anywhere in the app** — `confirm(` appears zero times.
   App-wide and apparently deliberate; changing it is a design decision.
9. **Two orphaned QA upload files on disk** (`server/uploads/4531031f-….txt`,
   `514257bc-….txt`, 23 bytes each) from a prior run's turn cap. DB rows were removed;
   only the disk files remain.
10. **Skip-trace returns 503** without `TRACERFY_API_KEY`. Intentional, needs a key.

---

## Test Coverage Gaps

1. **s1's last three sweeps were written but never run.** `.qa-r88-realids.mjs`,
   `.qa-r88-realids2.mjs` and `.qa-r88-emptytables.mjs` were authored at 05:06–05:08
   and the stage hit its turn cap at 51/50. They left **no output files**, so their
   results are unknown — this is a gap, not a pass. They target the single largest
   known hole: a dead-UUID sweep 404s in validation *before* the handler body runs, so
   it proves "nothing crashes on validation", not "the handler works". Run 87 got a
   real id into only **29 of 119** param GET routes. The scripts are on disk and ready
   to run.
2. **`/admin` verification incomplete** — see Known Issues #1. Probe written, not run.
3. **Modal and builder *contents* are still only spot-checked.** Nine runs have
   measured the 19 routes **at load**. The new icon-semantics check shares this blind
   spot by design (it only sees what rendered). **This is the single best remaining
   gap** — the next run should take the audit battery *inside* modals and builders.
4. **Four GET handlers have still never executed their bodies** — `drip_sequences`,
   `prospect_lists` and `financing_applications` hold zero rows, so every sweep 404s
   before the handler runs. `.qa-r88-emptytables.mjs` was written to close this (create
   one row, GET with a real id, delete it — net zero writes) but fell inside gap #1.
5. **`/calendar` event creation cannot be driven synthetically** — its modal opens via
   FullCalendar `dateClick`, which needs a real pointer event. A trigger-hunting sweep
   reports `NO_TRIGGER_BUTTON`; that is a harness limitation, not a missing feature.
6. **No ESLint in this repo** — no config, no lint script, so `no-undef` never runs.
   The committed `.qa-r8*.mjs` set differences exist to cover that hole; all currently
   report zero.
7. **County import errors are environmental** — `ENOTFOUND feature.tnris.org`; no
   network access to the TNRIS host from this environment.

---

## Verification

- **Build:** `npx vite build` — **PASS** (8.29s).
- **Net DB rows written:** **0**. Every row created during testing was deleted and a
  hygiene probe confirmed zero leftovers.
- **Working tree:** clean apart from stage-result JSONs and the three unrun s1 scripts
  plus two s4 probes, all untracked and deliberately retained for the next run.
