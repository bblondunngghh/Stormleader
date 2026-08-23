# Overnight QA Report — 2026-08-22

**Project:** StormLeads / StormPipe
**Branch:** `feat/financing`
**Baseline:** `ad90289` (checkpoint: pre-overnight-run 2026-08-22)
**Head at report time:** `2371b24`
**Stages run:** s1 api-test, s2 frontend-test, s3 ui-audit, s4 verify, s5 report

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages (routes) tested | **19** |
| API route patterns inventoried | **272** (36 route files) |
| API route patterns exercised | **272** — 119 GET, 140 write (182 probes), 18 DELETE (35 probes) |
| Bugs found | **5** |
| Bugs fixed | **4** |
| Bugs open | **1** |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Net DB rows written | **0** (every created row deleted and verified gone) |
| Build | **PASS** (vite, 8.07s) |

Fix commits: `ba35464`, `23e106d`, `2371b24`. Harness commit: `f6cd28b`.

Two of the five stages (s1 api-test, s4 verify) hit their turn cap. Neither lost
work — s1's fix was recovered and committed by s2 as `ba35464`, and s4's fix was
recovered, re-verified and committed by this stage as `2371b24`. See
**Test Coverage Gaps** for what the caps did cost.

---

## Backend API Test Results

Inventory built from source: **272 route patterns across 36 files** — GET 132,
POST 88, PATCH 26, DELETE 18, PUT 8. 109 of the 272 take a path parameter.

| Sweep | Patterns / probes | Result | 5xx |
|---|---|---|---|
| GET sweep | 119 patterns | 97× 200, 9× 400, 8× 404, 5× 403, 13 skipped | **0** |
| Write sweep (POST/PATCH/PUT) | 182 probes over 140 patterns | 34× 200, 9× 201, 121× 400, 16× 404, 2× 403, 31 skipped | **0** |
| DELETE probe | 35 probes over 18 routes | 17× 400, 17× 404, 1 skipped | **0** |
| CRUD lifecycle | 8 entity families, create→read→update→delete→verify-gone | 2 FAIL, rest pass | 1 |

Every non-2xx in the GET and write sweeps was checked individually and is correct
behaviour: the five `/api/admin/*` 403s are platform-admin-only, the 400s are
required-parameter validation, and the 404s are dead-id lookups on the seven
entity families that currently hold zero rows.

### By category

**auth / admin — 6 patterns, 6 pass, 0 fail.** `/api/auth/me` 200; all five
`/api/admin/*` routes correctly 403 for a non-platform-admin token.

**CRM (leads, contacts, tasks, activities, automations, drip, canvass,
prospect-lists, custom-fields, territories, subcontractors) — ~150 patterns,
149 pass, 1 fail.**
One real defect, still open:
`DELETE /api/crm/leads/:leadId/contacts/:contactId` (`server/src/routes/crm.js:325`)
passes only `contactId` to `crmService.deleteContact` and ignores `:leadId`
entirely. Deleting a contact through a `leadId` that does not own it returns
**200 and deletes the row**. Tenant isolation still holds (`req.tenantId` is
enforced), so this is a within-tenant scoping defect, not a cross-tenant leak.
**Not fixed** — see Known Issues.

**documents — 4 patterns, 2 pass, 2 fail → both fixed in `ba35464`.**
1. `POST /api/documents/upload` ran an unguarded `JSON.parse(req.body.tags)` on
   an unvalidated multipart string (`documents.js:96`). Malformed input threw into
   `next(err)` and answered **500**. Now returns **400 `tags must be valid JSON`**.
2. `documents.tags` is **jsonb** (`017_notifications.sql:106`), but the service
   bound a raw JS array, which node-postgres serialises as the Postgres array
   literal `{a,b}` — not valid JSON. **Every tagged upload died with 22P02.** Now
   `JSON.stringify`-d, matching every other jsonb write in the codebase.

**estimates / contracts / invoices / financing / expenses / work-orders —
~80 patterns, all pass.** Estimate templates, contract templates and
subcontractor work-order assignments were each driven through a full
create → read → update → delete → double-delete lifecycle; double-delete
correctly 404s rather than 5xx-ing on all of them.

**First-ever DELETE sweep.** All 18 DELETE routes had never been exercised by any
prior run. The dead-uuid probe found **0 5xx**, **0 cases of 2xx on a nonexistent
id**, and **0 `validateId` gaps** (every malformed id was rejected with 400).

### Verification of the API fixes (s4)

`ba35464` was re-verified end-to-end against an isolated server instance on :3099:
**6 of 8 checks passed; the 2 failures were both control-group assertions, not
defects.** The control group was supposed to be the stale :3001 instance
reproducing the pre-fix behaviour — but :3001 had already been restarted with the
fix, so it returned the fixed responses and the "must still be broken" assertions
failed. Both fix assertions passed on both instances:

- malformed tags → **400** (was 500) ✓
- valid tags array → **201**, and reads back as a real JSON array `["qa2026","roof"]`, not `{a,b}` ✓
- no-tags upload still 201s and stores NULL ✓
- valid-JSON non-array tags does not 500 ✓
- `GET /api/documents` reads the new rows without throwing ✓

All 4 created rows deleted, `leftover qa-r87 rows: 0`.

---

## Frontend Feature Test Results

All 19 routes render with **0 page errors, 0 white screens, 0 horizontal
overflow**. Tested live via Playwright against `http://localhost:5173`, with the
page title asserted as `StormPipe — Roofing CRM` first (two vite servers contend
for :5173 in this environment).

| Page | Tested | Result |
|---|---|---|
| `/dashboard` | Stat-card navigation, incl. `?stage=sold` | Pass — `/leads` genuinely consumes the `stage` param |
| `/leads` | Search, sort, CSV export, pagination | Pass |
| `/estimates` | New Estimate → Review & Share toolbar: Print, PDF, Sign Now, Send for Signing | **2 defects found, both fixed** (below) |
| `/invoices` | Status/date filters | Pass |
| `/contracts` | List render, customer column | Pass |
| `/pipeline` | Drag-and-drop between stages, with revert | Pass — net-zero DB change |
| `/reports` | All 5 presets | Pass |
| `/calendar` | Month / week / day views | Pass |
| `/storm-map` | 6 layer toggles | Pass — FEMA code untouched |
| `/settings` | All 13 tabs | Pass |
| `/tasks` | Empty state | Renders correctly; toggle-complete **not tested** (see gaps) |
| `/expenses`, `/work-orders`, `/subcontractors`, `/materials`, `/documents`, `/territories`, `/alerts`, `/canvass` | Render, primary controls | Pass |

### Defects found and fixed

**1. "Sign Now" saved a row then opened nothing — `23e106d`**
`/estimates` → New Estimate → Review & Share → Sign Now. `EstimateBuilder`
receives `estimate` as a **prop**, so it never changes during the component's
life. The handler created the row but **discarded the response**, then set
`showSignModal(true)` — while the modal was gated on the still-null prop. The
user got a success toast, a real database row, and no modal. Fixed by gating on
`estimate || createdEstimate`; that same value feeds the "have I saved yet"
guard, so a second click no longer creates a second row.
Verified live: modal opens, signature canvas mounts, "Accept & Sign" correctly
disabled until signed; second click created **no second row** and reopened the
modal.

**2. "Download PDF" was dead on a new estimate, and stayed dead after saving — `2371b24`**
Same toolbar, same root cause, different control:
`onClick={() => estimate?.id && downloadEstimatePdf(estimate)}` — on a brand-new
estimate the prop is null, so the button fired **no request, no toast, no error**.
It also remained dead after "Sign Now" had persisted the row, because that path
writes `createdEstimate`, not the prop. Fixed to save-first and reuse
`createdEstimate`, matching the idiom "Send for Signing" already used.
Verified live: 2 clicks → **1 POST, 2 PDF GETs**, toast `PDF downloaded`,
0 page errors, and Sign Now still opens its modal with the canvas mounted.

> **This is the fifth dead control on this one toolbar in four runs**
> (Run 83 Download PDF on the two list paths, Run 84 Sign Now + a missing
> `IconCheck`, Run 85 Sign Now on the new-estimate path, Run 87 PDF on that
> path). The estimate review-and-share toolbar is the application's top defect
> hot spot and should be the first place a future run looks. The shared root
> cause each time: **a control gated on the `estimate` prop, which is null for
> the entire life of a new estimate.** "Print" is the only remaining control on
> the toolbar, and it calls `window.print()` with no dependency on the prop.

### Method worth reusing

Both estimate defects were proved with **zero database writes** by stubbing the
POST with `page.route` → fake 201. That works even on tables with no DELETE
route. Note the endpoint is `/api/estimates`, **not** `/api/crm/estimates` — an
incorrectly-scoped stub silently lets the real request through.

---

## UI Consistency Audit Results

**All 7 prescribed audits pass on all 19 routes. Zero defects found, zero client
source changes.** This is the **8th consecutive converged run**. Measured live in
a single capped Playwright sweep.

| # | Audit | Result |
|---|---|---|
| 1 | **Icons** | **2,182 `<svg>` across 19 routes, 0 foreign.** Every one is `viewBox "0 0 24 24"` once recharts / mapbox-gl / gm- surfaces are excluded (data-viz and map, not icons). 0 `fa-*`, 0 `material-icons`, 0 `mdi-`, 0 `bi-`. Nothing to fix. |
| 2 | **Buttons** | Style groups stable and shared identically across all 19 routes — sidebar nav `42px\|12,16,12,28\|13px\|r12\|500`, sidebar section `42px\|12,16\|14px\|r12\|500`, section label `22px\|4,16\|11px\|r0\|700`. Page-local groups are row actions (`31\|8,14\|11\|r14\|600`, shared identically by `/estimates`, `/invoices`, `/contracts`). **No cross-page outliers.** Nothing to fix. |
| 3 | **Toolbars / Headers** | `.topbar glass` at **exactly 56px on 19/19**; `<h1>` present on **19/19**; title left, actions right. Consistent. Nothing to fix. |
| 4 | **Sidebar / Nav** | **18 links / 18 icons / identical `{0,30,8}px` gaps on 19/19.** Exactly 1 `.is-active` on 18 of 19; `/alerts` has 0, and is the documented orphan route with no sidebar entry — a known non-bug. Nothing to fix. |
| 5 | **Forms** | **0 native `<select>`, 0 `input[type=date]`** anywhere. Every field not using `.form-input` is a previously-verified deliberate exception: the global TopBar Cmd-K search, `.address-search__input` (the wrapper carries the radius and border), the `/alerts` numeric stepper, and the `/storm-map` `input[type=range]` slider. Nothing to fix. |
| 6 | **Spacing / Alignment** | `scrollWidth − clientWidth = 0` on **all 19** routes — no overflow anywhere. `.glass` padding clusters cleanly per page-kind (18 / 16 / 24 / 20). **0 page errors.** Nothing to fix. |
| 7 | **Modals** | 4 opened and measured live (`/tasks` and `/subcontractors` slide-overs, `/expenses` and `/work-orders` modals). **4/4** `modal-scale-in`, **4/4** radius 20px, **4/4** exactly one close button. Backdrop variance (slide-over blur4 vs modal blur8) is per-kind and deliberate. One deferred cosmetic item — see Known Issues. |

Because the visual audits have been converged for eight runs, the remainder of
the s3 stage went to behaviour. Three new static set-difference checks were
built, each self-tested against a known positive before any finding was filed,
and committed as `f6cd28b`:

- **`.qa-r86-nsapi.mjs`** — namespace API method typos (`import * as fooApi` then
  `fooApi.typo()`). This class is caught by **nothing else**: unlike a named
  import it raises no ESM link error and no build failure, so it dies at click
  time. **0 findings / 106 calls / 22 namespace imports.** Self-test 2/2.
- **`.qa-r86-props.mjs`** — callback props a component invokes vs. props each
  parent actually passes. **0 findings / 191 call sites / 147 components.**
  Self-test 2/2 caught (including a renamed binding), 2/2 correctly cleared.
- **`.qa-r86-deadstate.mjs`** — `useState` written by a handler but never read
  ("a button sets a flag nobody renders"). **5 hits, all triaged to non-bugs.**

All three were re-run by the s4 stage and reproduce Run 86 exactly, with the new
`createdEstimate` state correctly *not* flagged as dead.

---

## Bugs Fixed (numbered list)

1. **`POST /api/documents/upload`** — an unguarded `JSON.parse` on the multipart
   `tags` string answered **500** on malformed input instead of 400 —
   *fixed* by validating and returning `400 tags must be valid JSON`
   (`ba35464`, `server/src/routes/documents.js`).

2. **`POST /api/documents/upload`** — `documents.tags` is jsonb but the service
   bound a raw JS array, which node-postgres serialises as `{a,b}`, so **every
   tagged upload failed with 22P02** — *fixed* by `JSON.stringify`-ing the value,
   matching every other jsonb write in the codebase
   (`ba35464`, `server/src/services/documentService.js`). Verified round-tripping
   as a real JSON array.

3. **`/estimates` → New Estimate → Review & Share → Sign Now** — the handler
   created the estimate but discarded the response, then opened a modal gated on
   the never-changing `estimate` prop: a success toast, a real DB row, and no
   modal — *fixed* by gating on `estimate || createdEstimate`, which also stops a
   second click creating a second row
   (`23e106d`, `client/src/components/EstimatesView.jsx`).

4. **`/estimates` → New Estimate → Review & Share → Download PDF** — gated on the
   same null-for-life `estimate` prop, so it fired no request at all on a new
   estimate and stayed dead even after Sign Now had saved the row — *fixed* by
   save-first + reuse of `createdEstimate`, matching the neighbouring
   "Send for Signing" idiom
   (`2371b24`, `client/src/components/EstimatesView.jsx`).

---

## Known Issues (Not Fixed)

1. **`DELETE /api/crm/leads/:leadId/contacts/:contactId` ignores `:leadId`** —
   `server/src/routes/crm.js:325`. The handler calls
   `crmService.deleteContact(req.tenantId, req.params.contactId)`, so a request
   naming a lead that does not own the contact still returns **200 and deletes
   the contact**. Tenant isolation is intact; this is a within-tenant scoping
   defect. **Reason not fixed:** found by s1, which hit its turn cap before
   reaching it, and no later stage picked it up. It is a small, well-understood
   fix (scope the service query by `lead_id`, 404 otherwise) plus a regression
   probe — **it should be the first item of the next api-test stage.**
   *Not previously filed; this is a new finding, not a re-file.*

2. **`/expenses` modal title uses `<h3>` where every other modal uses `<h2>`** —
   cosmetic, documented and deferred since Run 84. Not re-filed.

3. **`ExpensesView.jsx:56` has a genuinely dead `searching` state** — no spinner
   renders during lead search. Real but cosmetic; adding a spinner is an
   enhancement, which the overnight charter forbids. Flagged for a product
   decision rather than fixed.

4. **`ba35464` was committed while the API server was running without a watcher.**
   The server has since been restarted and is serving the fix (confirmed by the
   s4 control-group result), but restarting the API server is not an automated
   step in this pipeline and should not be assumed.

5. **Two orphaned QA upload files remain on disk** —
   `server/uploads/4531031f-….txt` and `514257bc-….txt` (23 bytes each,
   `qa20260822 qa text file`), left by the s1 stage when it hit its turn cap.
   Their database rows were removed; only the disk files remain. Harmless, but
   worth a sweep.

### Do not "fix" this — verified non-bug

`PublicEstimate.jsx:33` stores a connected `stripeAccountId` and never uses it,
and line 611 mounts `<Elements stripe={stripePromise}>` with the **platform**
instance. That is **correct**. `server/src/routes/payments.js:207-208` and
`:349-350` build `application_fee_amount` + `transfer_data.destination` and call
`stripe.paymentIntents.create(params)` with **no** `{stripeAccount}` argument —
i.e. destination charges on the platform account, which must be confirmed
client-side with the platform instance. Passing the connected account to
`loadStripe` **would break customer payments.** The unused state is leftover,
nothing more.

---

## Test Coverage Gaps

1. **Two stages hit their turn cap** — s1 api-test at 51/50 turns and s4 verify at
   41/40. No work was lost (s2 recovered and committed s1's fix as `ba35464`;
   this stage recovered, re-verified and committed s4's as `2371b24`), but the
   caps did cost coverage: s1 never fixed the contact-scope defect it found, and
   s4 never wrote its own stage summary. **The `git status` handoff check has now
   paid out on 5 of the last 6 nights and should stay the first action of every
   stage.**

2. **Seven entity families hold zero rows**, so their `:id` routes 404 before
   handler logic ever runs. A dead-uuid sweep cannot find stored-shape crashes in
   those families. 29 routes were given at least one real id; **8 GET param
   routes could only be run with a dead id** — `/api/crm/drip-sequences/:id`
   (and `/enrollments`), `/api/properties/in-swath/:stormEventId` (and `/count`),
   `/api/counties/:id/status`, `/api/crm/financing/applications/:id`,
   `/api/crm/prospect-lists/:id/items`, `/api/drift/:stormEventId`.

3. **`/tasks` toggle-complete is untested, deliberately.** There are zero tasks
   and no DELETE route for tasks, so creating one would leave a permanent row in
   a free-tier database. The empty state renders correctly. **A future run should
   use the `page.route` stub technique instead** — it needs no DELETE route.

4. **31 write probes and 13 GET patterns were skipped** — routes needing a real id
   in a zero-row family, or an external vendor call. Skips are counted, not
   silently dropped.

5. **FEMA / storm-map property code was not modified**, per the standing rule that
   it is off limits. Its layer toggles were exercised read-only.

6. **No network access to `feature.tnris.org`** in this environment, so county
   bbox import remains untestable here.

7. **This repository has no ESLint** — no config, no lint script — so `no-undef`
   and similar never run. The behavioural set-difference harnesses in
   `server/.qa-r8*.mjs` exist specifically to cover that hole, and now number six
   distinct checks, all reporting zero.

---

## Method Note — the run's most valuable output

The s3 stage's headline is not a defect; it is that **four of the six traps it hit
were bugs in its own checks, and 32 of 45 raw findings were fictional.** Each one
produced confident, plausible-looking output:

- **An apostrophe in JSX *text* destroys a naive string-stripper.**
  `Dashboard.jsx:1168` renders `you're all clear` — JSX text, not a string
  literal. A stripper that treats `'` as a delimiter blanked lines ~1168–1347,
  exactly where the three "never read" variables are in fact read (1300 / 1316 /
  1345). **11 confident false positives out of 16**, one decorated with a
  matching comment directly above the setter. Fix: strip **comments only**, never
  quotes.
- **A regex `<Name ...>` scan truncates at the `>` inside `() =>`.**
  `onClose={() => setX(false)}` ends the tag early and cuts the passed-props set
  short — 24 findings, **21 false**.
- **A non-greedy `{...}` props destructure breaks on arrow-function defaults**,
  and the obvious guard against it (`if (/=>/.test(body)) continue`) then
  **silently drops those components from coverage** — a hole that reads as
  "clean".
- **A Python heredoc mangles regex escapes in JS source**, exactly as Run 84's
  *shell* heredoc did. The rule is now general and language-independent:
  **author harness source with the Write/Edit tool only, never any heredoc.**

The operating rule this yields: **a set difference that cannot find a defect you
have already proven is not evidence of anything.** Every check committed tonight
was self-tested against a known positive first.

---

## Source Artifacts

- `C:/tmp/ui-audit-results.txt` — full UI audit deliverable table (Run 86).
  Note the other `/tmp/*-results.txt` files are **stale** (Aug 19 and Aug 21);
  stat them before trusting them.
- `claude-overnight-20260822-s{1..5}-*.json` — per-stage envelopes (repo root).
  `s1` and `s4` carry `subtype: error_max_turns` and no result text.
- `server/.qa-r86-*.mjs` — the three committed behavioural harnesses; each takes a
  walk root as `argv[2]` so it can be pointed at a pre-fix tree.
- `server/.qa-r87-docverify.mjs` — the `ba35464` end-to-end verification harness
  (untracked).
