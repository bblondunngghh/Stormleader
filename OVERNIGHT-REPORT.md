# StormLeads — Overnight QA Report

**Date:** 2026-09-07 · **Run 128** · **Branch:** `feat/financing`
**Baseline:** `d147796` (`pre-overnight-20260907`) → **HEAD at report time:** `f25f660`
**Stages:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report

> **Stage integrity — read this before trusting any count below.**
> **All four working stages terminated on `error_max_turns`,** not on completion:
> s1 51 turns, s2 81, s3 61, s4 41. Every number in this report was re-derived in s5
> from the repository, the artifacts and the live database — not copied from any stage's
> self-assessment.
>
> **Only one of the three expected artifacts is tonight's.** `stat` results:
> `ui-audit-results.txt` = 2026-09-07 05:46 (**tonight**);
> `api-test-results.txt` = 2026-09-06 (Run 127); `frontend-test-results.txt` = 2026-09-04 (Run 123).
> Both stale files exist in **two** temp roots (`/tmp` → AppData and `C:\tmp`) and are stale in
> both. s1 and s2 wrote **no** artifact tonight, so their coverage is **unmeasured, not passing.**
>
> **Run-number drift recurred.** s1–s3 labelled themselves Run 128 (`.qa-r128-*`); s4 labelled
> itself Run 129 (`.qa-r129-s4-joinproof.mjs`). Filed as Run 128.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Commits landed | **4** (all fixes; 0 reverts) |
| Defect families found | **6** |
| Individual defect sites found | **31** |
| Defect sites fixed | **31** (100%) |
| — security / tenant-isolation | **24** sites (3 families) |
| — frontend correctness | **1** site (1 family) |
| — UI consistency | **7** sites (2 families) |
| Pages / routes exercised | **22 routes + 15 Settings tabs** (37 surfaces) — all by s3 |
| API endpoints exercised | **Unmeasured** — see Test Coverage Gaps |
| Regressions introduced | **0** |
| Build | **PASS** — `vite build` 7.90s, exit 0 (re-run in s5) |
| Database | **Row-level net zero** — 0 rows created 2026-09-07 in any table. One **schema** write (see below). |

**Database caveat, stated explicitly:** this run is *not* net zero at the schema level.
s4 executed a `DROP VIEW` / `CREATE VIEW` on `lead_summary_view` against the live database.
That DDL is a genuine security fix and is correct, but it was applied **without a committed
migration** — see Bug 6.

---

## Backend API Test Results

s1 capped at 51 turns and wrote no artifact, so there is **no endpoint-by-endpoint pass/fail
matrix for this run.** What follows is what s5 could verify directly against the source and the
database. A category with no entry was **not measured**, not passed.

| Category | Endpoints tested | Passed | Failed | Outcome |
|---|---|---|---|---|
| Tenant isolation — read path | 17 join sites across 9 files | 0 | 17 | Fixed, `31ed5f0` |
| Tenant isolation — write path | 5 create/update paths | 0 | 5 | Fixed, `31ed5f0` |
| Tenant isolation — DB view | 1 view (2 joins) | 0 | 1 | Fixed in DB by s4; migration committed in s5 |
| Auth, CRM, estimates, invoices, work orders, materials, reports (functional sweep) | — | — | — | **Not measured this run** |

### What was fixed

**`31ed5f0` — cross-tenant user disclosure via unscoped `users` joins and unchecked rep ids**

*Read side:* every `LEFT JOIN users` resolved on `id` alone. A lead, task, activity, document,
estimate, work order, canvass pin or territory carrying a foreign `assigned_rep_id` / `user_id` /
`created_by` / `uploaded_by` returned **another tenant's first and last name**. **17 join sites**
across `canvassing.js`, `crm.js`, `territories.js`, `crmService.js`, `documentService.js`,
`estimateService.js`, `leadService.js` and `workOrderService.js` now also match on `tenant_id`.

*Write side:* `assigned_rep_id`, `lead_id` and `assigned_to` arrive in the request body and were
stored unvalidated, which is how the dangling foreign reference was created in the first place.
**7 `assertOwned()` call sites** added, covering `createLead`, quick-create, `updateLead` (both
implementations), `bulkAssign` and `updateWorkOrder` — matching the guard `createTask` and
`createWorkOrder` already had.

### Verification (recovered in s5)

s4 capped before reporting a verdict but left `server/.qa-r129-s4-joinproof.mjs`, a pure-`SELECT`
harness. s5 ran it. **Result: PASS.**

```
foreign user f5c01c73… (Brandon Blond) belongs to tenant 5a358592…
pre-fix   u.id = l.assigned_rep_id                : LEAKS -> Brandon Blond
shipped   + AND u.tenant_id = l.tenant_id         : no row (correct)
STATIC SWEEP — JOIN users with no tenant predicate: 0
PASS — 31ed5f0 join fix
```

The pre-fix join shape leaks a **real** foreign user; the shipped shape suppresses it; and no
unscoped `JOIN users` remains anywhere in `server/src`.

### Standing security item — now closed

The cross-tenant `leads`-join family, carried as the repository's top open item for several runs,
is **closed on both sides**. Correcting the record: `emailService.js` (the worst-consequence case,
where a foreign `lead_id` emailed the *wrong tenant's* customer) and the `logActivity()` write
boundary were closed **last night** by `83ba6b4`, not tonight. Current state, verified in s5:
0 unscoped `JOIN leads`, 0 unscoped `JOIN users`, and `assertOwned` live across 8 service/route
files with 30 references.

---

## Frontend Feature Test Results

s2 capped at 81 turns and wrote no artifact. **26 of the app's routes were not measured by s2 at
all.** One page was tested in depth and one defect landed.

### `/estimates` — Estimate Builder — **1 defect, fixed `dc5dab9`**

**Tested:** all six save paths in `EstimateBuilder` (debounced autosave, Save Draft, Save & Send,
two review-mode saves, Send for Signing), compared as payload literals.

**Broken:** the debounced autosave sent `{ ...form, financing_enabled, financing_plan_ids }` —
**17 keys** — while the other five paths all send the same **24**. Seven builder fields live in
their own state outside `form` (discounts, signers, profit margin, footer notes, insurance
details, upgrades, deposit) and none is in the autosave effect's dependency array. Editing one
saved nothing and showed no banner; the next edit to any `form` field then fired the autosave,
which returned a clean 200 and rendered **"Saved!"** while carrying none of the seven.
`updateEstimate`'s whitelist skips `undefined`, so the stored values were silently the old ones.
A rep who set a profit margin, added a discount or filled in insurance details, edited the
customer name, saw "Saved!" and closed the builder **lost all of it**.

**How fixed:** autosave now sends the same 24-key payload as Save Draft.

**Proved live with zero database writes** by fulfilling the PATCH from a Playwright route:
margin 30 → 45 produced no request and no banner; editing the customer name then sent a 17-key
PATCH with no `profit_margin` while the header read "Saved!"; Save Draft on the same state sent 24.
After the fix the autosave sends 24 keys with `profit_margin` 45, byte-identical to Save Draft's
key set, and merely opening an estimate still writes nothing.

**Still needs attention:** the other 26 routes. See Test Coverage Gaps.

### Route render sweep (from s3's pass, not s2)

22 routes and 15 Settings tabs render with **0 uncaught page errors**. The rendered-text sweep
(snake_case, SCREAMING_CASE, `undefined`, `NaN`, `[object Object]`, `Invalid Date`) is **clean** —
a positive regression confirmation for `39dee53` and `c7257b7`.

---

## UI Consistency Audit Results

Source: `ui-audit-results.txt`, 2026-09-07 05:46 — the one artifact genuinely from tonight.
Coverage: 19 authenticated routes + `/login`, `/register`, `/onboarding` + 15 Settings tabs +
22 modal sites statically + 4 modals opened live.

| Category | Result |
|---|---|
| **Icons** | **PASS.** No non-Heroicon icons. 41 files import `@heroicons/react/24/outline`; 0 from `24/solid`, 0 lucide/react-icons/font-awesome/material/@mui. Inline `<svg>` in exactly 2 files (`CanvassingMode.jsx`, `StormMap.jsx`) — both documented map surfaces. Runtime: 2,195 of 2,204 `<svg>` are 24×24; the other 9 are all `recharts-surface` chart geometry on `/reports`. Nothing fixed because nothing was wrong. |
| **Buttons** | **PASS.** 62 distinct signatures grouped by class + radius + font-size + weight + padding; every group with >1 member internally consistent. All radius families deliberate. Primary action colour uniform at `oklch(0.72 0.19 250)` across all 22 routes. |
| **Toolbars / Headers** | **PASS.** 19/19 routes: header exactly 56px, exactly one `<h1>`, title left / actions right. Identical to Runs 80, 103, 112, 127. |
| **Sidebar / Nav** | **PASS.** 19/19: 18 `.nav-link`, all 18 with an `<svg>`, every item 42px, gaps uniform. Exactly one `.is-active` on 18/19; `/alerts` reports 0 — the documented orphan route (`AlertSettings` has no sidebar entry), not a new finding. |
| **Forms** | **PASS.** 0 native `<select>` and 0 native date/time inputs on any route, Settings tab or auth page — in runtime *and* in source. `CustomSelect` and `DatePicker` used universally. `.form-input` identical everywhere: 36px, radius 12px, padding 0 16px, 13px. Three non-`.form-input` text inputs found and each accounted for (TopBar global search one-off; `/storm-map` Places search — standing billable exclusion; Stripe iframe element). |
| **Spacing** | **PASS.** Header 56px and nav 42px uniform across 19/19. No stray full-viewport overlay at rest on 18/19; `/storm-map`'s full-bleed container is intended. Modal padding within the design scale. |
| **Modals** | **2 DEFECT FAMILIES, 7 SITES — ALL FIXED.** Backdrop class 22/22, scale-in animation reached on all 22, widths content-appropriate. Blur and close-button defects below. |

### Modal defects found and fixed

**`3e9fe18` — five modals had no backdrop blur (5 sites).**
`.modal-backdrop` supplies *only* the fade-in animation, so all 22 usages hand-write
`position`/`inset`/`background`/`backdropFilter`/`zIndex` inline — the standard exists as 22
sibling style literals, not as CSS. Diffing those literals **against each other** gives 17 with a
blur and 5 without: `WorkOrdersView.jsx:236/:640/:775`, `EstimatesView.jsx:746`,
`MaterialsView.jsx:587`. Confirmed live: with New Work Order open,
`getComputedStyle('.modal-backdrop').backdropFilter === "none"` while Add Expense on the adjacent
page returned `blur(8px)`. Those five read as a flat scrim over a busy table instead of the
frosted panel every other modal produces.

**`f25f660` — two modal close buttons were a 20×23 icon, not the shared 32×32 box (2 sites).**
`.modal-close` exists because of an earlier sweep, and its own comment records the symptom it was
written to fix. Re-deriving N over every `<button>` rendering an X icon finds **44**: 25 carry the
shared class, 19 are hand-rolled — but **17 of the 19 are a different control** (image-remove
chips, milestone removes, filter-tag clears, TerritoryManager inline form) and were correctly
excluded. Two were genuine modal-header closes the original sweep missed:
`EstimatesView.jsx:761` and `LeadDetail.jsx:2715`. Both also carried inline `background:'none'`,
which as a style attribute **outranks `.modal-close:hover`** — adding the class alone would have
left them with no hover feedback, so the redundant inline declarations were removed too.

### False positives explicitly killed (recorded so they are not re-filed)

- `/register`'s visually-different first field is **`autoFocus`** — `oklch(0.26 0.02 260 / 0.55)` is exactly `.form-input:focus`.
- The 14 radius-0 `/materials` category tabs have **no shared tab class to have missed**; the app has no design-system tab component, and three page-local tab styles is the established pattern.
- The 16px/12px modal panels are **not overriding a default** — `.glass` declares no `border-radius` at all.
- `/onboarding`'s h42 CTA is a **deliberate** larger signup CTA, applied consistently at `OnboardingPage.jsx:276` and `:364`.
- Tailwind v4 reports `rounded-full` as 33554432px; renders identically to the app's 999px.

---

## Bugs Fixed

1. **API / 9 server files — cross-tenant user disclosure (read).** 17 `LEFT JOIN users` sites resolved on `id` alone, returning another tenant's first and last name for any foreign `assigned_rep_id` / `user_id` / `created_by` / `uploaded_by`. — Every join now also matches `tenant_id`. `31ed5f0`
2. **API / `createLead`, quick-create, `updateLead` ×2, `bulkAssign`, `updateWorkOrder` — unvalidated foreign keys (write).** Body-supplied `assigned_rep_id` / `lead_id` / `assigned_to` stored unchecked, creating the dangling cross-tenant reference in the first place. — 7 `assertOwned()` guards added. `31ed5f0`
3. **`/estimates` Estimate Builder — autosave reported "Saved!" while discarding seven fields.** Autosave sent 17 keys where the five sibling save paths send 24; discounts, signers, profit margin, footer notes, insurance details, upgrades and deposit were silently dropped. — Autosave now sends the same 24-key payload. `dc5dab9`
4. **`/work-orders` ×3, `/estimates`, `/materials` — five modal backdrops rendered with no blur.** — `backdropFilter: 'blur(8px)'` added to match the other 17. `3e9fe18`
5. **`/estimates`, `/leads/:id` — two modal-header close buttons were hand-rolled 20×23 non-square targets with suppressed hover.** — Adopted `.modal-close` (32×32, radius 8px, `aria-label="Close"`) and deleted the inline `background:'none'` that outranked its `:hover`. `f25f660`
6. **Database / `lead_summary_view` — the same unscoped joins, one copy deeper.** `31ed5f0` fixed the `users` joins in the JS query strings, but `lead_summary_view` holds another copy **inside the database**, and `getLeads()` (`crmService.js:69`) reads `rep_first_name` / `rep_last_name` / `rep_email` straight out of it — so a lead carrying a foreign `assigned_rep_id` still resolved that tenant's user. The primary-contact `LATERAL` had the same shape, matching on `lead_id` alone and supplying another tenant's `contact_first_name`, `contact_last_name`, `primary_phone` and `primary_email`. — Both clauses now match on `tenant_id`. Applied to the live database by s4; **migration `051_lead_summary_view_tenant_scope.sql` committed in s5** so the fix survives a rebuild.

---

## Known Issues (Not Fixed)

1. **`server/src/scripts/updateView.js` is obsolete and destructive if run.** It is referenced by
   no package script and imported nowhere, and its `CREATE VIEW` no longer matches the live view.
   Running it today would **drop `custom_fields`, `lead_score`, `lead_score_factors` and
   `lead_score_updated_at`** — the migration 042 columns — and `getLeads()` accepts `lead_score`
   in its `allowedSort` whitelist, so `/leads` sorted by score would begin throwing. Its
   tenant-scoping edit was committed tonight so the working tree is clean and the script is at
   least not *also* disclosive, but **the script should be deleted or regenerated from migration
   051.** Left for a human decision rather than deleted unasked.
2. **Pre-existing QA junk rows in the database.** 64 `subcontractors` rows include roughly 34
   fixtures from earlier runs (`{"$eq":1}` and `12345` repeated, plus `QA Sub`, `QA Sub 2809`,
   `QA Roofing`), and one lead `qa20260730c 456 Convert St`. **None was created tonight** — 0 rows
   were created on 2026-09-07 in any table. Deleting them is a write against a Neon free-tier
   database and was deferred, as in prior runs.
3. **`/alerts` is an orphan route** — `AlertSettings` has no sidebar entry, so no nav item is
   active there. Long-standing, documented, not a regression.
4. **64 generic error toasts** (the documented known-and-deferred item). `/admin` surfacing
   "Failed to load overview data." for a non-platform-admin is an instance of this: the 403 itself
   is correct authorization; only the wording is generic.
5. **`contacts`, `tasks`, `documents` and `financing_applications` are empty (0 rows).** Those
   surfaces are only testable in their empty state without seeding, which is a write.

---

## Test Coverage Gaps

1. **Backend endpoint sweep — not performed.** s1 capped at 51 turns having landed its fix but
   never ran a broad endpoint pass, and wrote no artifact. Auth, CRM, estimates, invoices, work
   orders, materials and reports have **no pass/fail data for this run**.
2. **Frontend — 26 of 30 routes unmeasured by s2.** s2 capped at 81 turns after `/estimates`.
   The route-level data in this report comes from s3's sweep, which is a UI audit, not a
   functional test: it proves pages render and are visually consistent, **not** that their
   interactions work.
3. **Two of tonight's five UI fixes were verified by build only, not in a browser.** The
   `MaterialsView` cart drawer needs items added to a cart (a write) and the `LeadDetail`
   street-view modal drives Google Maps (billable). Both are one-line changes already proven live
   on their siblings, and are recorded as **verified-by-build, not verified-in-browser**.
4. **Standing exclusions, deliberately not exercised:** `/storm-map` address search (Google Places,
   billable per keystroke); FEMA property loading / filtering / IndexedDB (developer-owned);
   sidebar collapse (its toggle sits adjacent to SIGN OUT); `/onboarding` wizard steps past the
   first (advancing writes and touches Stripe) — read statically only.
5. **No login attempts were spent** (login is rate-limited); the sweep reused an existing session.
6. **Turn caps are now the dominant coverage constraint.** Four of four working stages capped, for
   the third consecutive run. Two stages lost their entire evidence trail. This costs more
   coverage than any defect found tonight.

---

## Notes for the Next Run

1. 🔴 **Raise the turn budgets or narrow the charters.** Four of four capped, three runs running.
   This has been the #1 note for four runs and is the single largest source of lost coverage.
2. 🔑 **Write the results artifact on turn 1.** Instructed four runs, ignored four runs. Tonight
   s3 did it and is fully reportable; s1 and s2 did not and are not.
3. 🔑 **`stat` every artifact — the stale-temp trap has now paid off 4 runs for 4.** Tonight two of
   three artifacts were stale, in **two different temp roots**. Reading them as tonight's would
   have fabricated two whole sections.
4. 🔑 **Search one layer deeper than the code.** Tonight's best find is Bug 6: the fix landed in
   every JS query string while a **copy of the same join lived inside the database** as a view.
   When a fix is a join-shape change, ask what else stores that join — views, materialized views,
   triggers, cached SQL.
5. 🔑 **The Run 128 style technique generalises and is still unexploited elsewhere:** when a shared
   class supplies only *part* of a component, the real standard lives as N sibling inline-style
   literals — diff them against each other, not against the class. Re-run on `.glass`,
   `.slide-over` and `.quick-action-btn`.
6. ⚠️ **Run-number drift recurred** — s1–s3 said 128, s4 said 129. Resync.
7. **A capped stage can still leave a working harness.** Running s4's leftover `joinproof` harness
   in s5 recovered the entire backend verification section. Always check for them.
8. **Suggested targets — s1:** the functional endpoint sweep now skipped twice. **s2:** any of the
   26 unmeasured routes. **s3:** the `.glass` / `.slide-over` literal diff. **s4:** decide
   `updateView.js` — delete or regenerate.
9. Drift baseline for the next run: the `docs: QA report 2026-09-07` commit (head after this entry).
