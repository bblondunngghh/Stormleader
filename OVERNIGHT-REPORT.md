# StormLeads — Overnight QA Report

**Run 130 · 2026-09-08 · branch `feat/financing` · baseline `004e3b4` (checkpoint: pre-overnight-run 2026-09-08)**

---

## QA Test Summary

| Metric | Value |
|---|---|
| API endpoints inventoried | **272** across 36 route files (GET 132, POST 88, PATCH 26, PUT 8, DELETE 18) |
| API endpoints exercised | **140** — 132 in the full GET sweep + 8 write endpoints under targeted probe |
| Frontend pages tested | **unmeasured** — see *Test Coverage Gaps*. 5 surfaces are provable from commits |
| UI audit categories run | **1 of 7** (modals). Audits 1–6 not re-run this session |
| Defect families found | **5** |
| Defect families fixed | **5** |
| Individual defect sites fixed | **16** |
| Commits | **5** (`151428c`, `e75f7dd`, `fb9f9ba`, `2f1b469`, `ce00ee2`) |
| Regressions introduced | **0** (17-assertion re-verification, below) |
| Build | **PASS** — `vite build` 7.87s, exit 0 |
| Database | **net zero** — 0 rows created 2026-09-08 in any table |

**Stage completion: 4 of 4 upstream stages terminated on `max_turns`, none completed.**

| Stage | Turns | Terminal | API time | Cost | Artifact |
|---|---|---|---|---|---|
| s1 api-test | 51/50 | `error_max_turns` | 353s | $4.86 | **written** (`C:/tmp/api-test-results.txt`, 05:07) |
| s2 frontend-test | 81/80 | `error_max_turns` | 722s | $8.24 | **not written** |
| s3 ui-audit | 61/60 | `error_max_turns` | 625s | $5.42 | **not written** |
| s4 verify | 41/40 | `error_max_turns` | 368s | $3.38 | **not written** (left a working harness — recovered in s5) |

Upstream cost $21.89. Every stage figure above is read from the stage's own JSON `stop_reason`/`subtype`, not from its self-assessment.

---

## Backend API Test Results

### Full GET sweep — 132 routes, real ids substituted

Harness `server/.qa-r123-getsweep.mjs` → `C:/tmp/qa-r123-getsweep.json`.

| Bucket | Count | Verdict |
|---|---|---|
| 200 | 113 | OK |
| 403 | 5 | **correct** — non-admin token, `/api/admin/*` is gated |
| 400 | 4 | **correct** — required query param absent, returns `{error}`, no crash |
| 5xx | **0** | zero server errors |
| SKIP | 10 | no fixture row / table or column absent |

403: `/api/admin/overview`, `/revenue`, `/tenants`, `/tenants/:id`, `/usage`.
400: `/api/crm/calendar`, `/api/data/directions`, `/api/disaster-declarations`, `/api/properties`.

Matches Run 125's baseline exactly — no regression from the four cross-tenant commits landed on 09-06/09-07 or from tonight's five.

### By category

| Category | Endpoints exercised | Pass | Fail | Fixed tonight |
|---|---|---|---|---|
| auth | 3 (`login`, `me`, token refresh path) | 3 | 0 | — |
| admin | 5 | 5 (403 as designed) | 0 | — |
| CRM core (leads, dashboard, calendar, activities, custom-fields) | ~46 | 46 | 0 | — |
| estimates | 4 (GET list/:id, POST, PUT) | 3 | **1** | `fb9f9ba`, `e75f7dd` |
| invoices | 4 (GET list/:id, POST, PUT) | 3 | **1** | `fb9f9ba`, `e75f7dd` |
| contracts | 5 (GET list/:id/templates, POST, PUT) | 4 | **1** | `fb9f9ba`, `e75f7dd` |
| expenses | 2 (GET, PUT) | 1 | **1** | `e75f7dd` |
| subcontractors | 3 (GET list, POST assign, GET work-order/:id) | 1 | **2** | `151428c` |
| work orders | 4 | 4 | 0 | — |
| payments | 2 | 2 | 0 | `e75f7dd` (read join scoped) |
| materials / storm / counties / properties / alerts / skip-trace | ~60 | 60 | 0 | — |

### What was fixed

**`151428c` — cross-tenant subcontractor PII disclosure.** Two layers, both open:

- `POST /api/crm/subcontractors/assign` validated `work_order_id` against the tenant but took `subcontractor_id` straight from the body, unvalidated.
- `getWorkOrderSubcontractors()` joined `subcontractors` on id alone and selected `s.name, s.company, s.phone, s.email, s.specialty`.

Any caller could attach any subcontractor uuid in the database to their own work order and read back a rival contractor's crew name, company, phone and email. **Proven with a planted row**, not inferred: `ZZ-VICTIM-SUB` / `Rival Roofing LLC` / `victim@rival.example` planted in tenant `dbeb300e`, posted as tenant `791bb51d`. Before: `201` and all five foreign fields returned. After: `400 subcontractor_id not found` and `[]`. Fixed with `assertOwned()` at the write boundary plus `AND s.tenant_id = $2` on the read join.

**`e75f7dd` — UPDATE paths stored another tenant's `lead_id` / `estimate_id`.** `96f7ad2` (09-06) closed the write boundary on the five CREATE paths but left the matching UPDATE paths open, and `lead_id`/`estimate_id` are in every one of those whitelists — so PATCH/PUT was still an unguarded door onto the identical defect. Added `assertOwned()` to `updateContract`, `updateEstimate`, `updateExpense`, `updateInvoice`, and scoped two read joins that could surface the foreign row (`payments.js:263`, `contractService.js:52`).

**`fb9f9ba` — three create endpoints were completely unusable.** `3577c4a` added a blanket "required field" check for `lead_id` to the create routes of estimates, invoices and contracts. On all three tables that column is **nullable**, and most existing rows hold NULL (estimates 8/17, invoices 10/14, contracts 3/4). Measured live:

```
before   POST /api/estimates      -> 400 {"error":"lead_id is required"}
         POST /api/crm/invoices   -> 400 {"error":"lead_id is required"}
         POST /api/crm/contracts  -> 400 {"error":"lead_id is required"}
after    POST /api/estimates      -> 201  EST-091   lead_id null
         POST /api/crm/invoices   -> 201  INV-0015  lead_id null
         POST /api/crm/contracts  -> 201            lead_id null
```

`3577c4a`'s stated intent was preventing 500s; the UUID-format check is what does that, so it was kept and now applies only when an id was actually supplied. Re-verified that half still holds — a malformed `lead_id` on all three routes still returns `400 Invalid lead_id format`.

### Re-verification (recovered from the capped s4)

s4 hit its turn cap without publishing a verdict but left `server/.qa-r131-s4-reverify.mjs`. s5 re-minted a token and ran it against the live server: **16/17 assertions PASS**.

The single non-passing assertion — *"update invoice with foreign `estimate_id` rejected"* returning `200` instead of `400` — was **run down and is a harness expectation error, not a defect.** `updateInvoice`'s `allowedFields` does not include `estimate_id`, so the field is silently ignored: the probed invoice retained its own `estimate_id` (`b4603e30`, own tenant), and the cross-tenant FK audit returns `0` for all six relations. Product behaviour is therefore **17/17**.

Also confirmed by that run: no cross-tenant FK is stored anywhere (`estimates`, `invoices`, `contracts`, `expenses`, `invoices→estimates`, `contracts→estimates` all `0`), own-tenant `lead_id` still accepted on update, own subcontractor still assignable (`201`), and final row counts unchanged (estimates 17, invoices 14, contracts 4, leads 13, subcontractors 64, wo_subs 1).

---

## Frontend Feature Test Results

s2 capped at 81/80 turns and **wrote no artifact**, so page-level coverage for this run is **unmeasured, not passing**. What follows is only what the commits prove.

### `/estimates` — Estimate Builder

- **Tested:** all six save paths (Save Draft, Save & Send, review-mode PDF, Sign Now, Send for Signing, debounced autosave); create round-trip against the live API.
- **Broken → fixed (`fb9f9ba`):** the builder is the *only* client caller of `POST /api/estimates` and has no lead field anywhere — `lead_id` appears in `EstimatesView.jsx` only in list-grouping code. The blanket `lead_id` requirement meant **all five of its save paths returned 400 and the button could not produce an estimate by any route through the UI.** Total loss of the page's primary function.
- **Broken → fixed (`2f1b469`):** the builder had six save paths, each answering "have I saved yet?" differently. `estimate` is a **prop** that stays null for a brand-new estimate even after the review toolbar's PDF or "Sign Now" button has already persisted the row, so the three paths gated on the prop alone (`handleSave`, `handleSend`, the send-for-signing modal) took the create branch a second time and wrote a **duplicate estimate row**. Collapsed all six onto one `savedEstimate = estimate || createdEstimate`, with every create branch recording its result via `setCreatedEstimate`.
- **Still needs attention:** the builder now has one save-state source of truth, but six independent save paths remain. Worth a dedicated s2 regression pass.

### `/invoices` and `/contracts`

- **Tested:** create with and without a lead selected; malformed-uuid rejection.
- **Broken → fixed (`fb9f9ba`):** both pages have a lead picker but treat it as optional (`leadId || null` / `leadId || undefined`), so New Invoice and New Contract failed with `400` whenever the user did not pick a lead.
- **Corrects a standing QA note:** Run 122 recorded the `/invoices` and `/contracts` empty-form 400 as *correct validation*. It was this bug. That note has been wrong in the record for eight runs.

### `/leads/:id` — Lead Detail

- **Tested:** Storm History and Billing Notice modal geometry at a 929×861 viewport.
- **Broken → fixed (`ce00ee2`):** covered under *UI Consistency Audit Results*.

### Not tested this run

`/`, `/pipeline`, `/tasks`, `/calendar`, `/work-orders`, `/materials`, `/subcontractors`, `/expenses`, `/reports`, `/settings`, `/canvassing`, `/storm-map`, `/storm-catalog`, `/admin`, `/alerts`, `/login`, `/register`, `/onboarding`, and the three public token pages. 28 client routes exist; **5 surfaces were touched.**

---

## UI Consistency Audit Results

s3 capped at 61/60 turns and **wrote no artifact**. Only the modal-geometry audit is provable from commits. Audits 1–6 were **not re-run this session** — the statuses below are carried from Run 128 (2026-09-07) and are marked as such.

| Category | This run | Result |
|---|---|---|
| **Icons** | not re-run | Run 128: 2,195/2,204 runtime SVGs are Heroicon `0 0 24 24`; the other 9 are `recharts-surface` on `/reports`. 41 files import `24/outline`, 0 solid, 0 foreign libraries, 0 `fa-*`. **No non-Heroicon icons outstanding.** |
| **Buttons** | not re-run | Run 128: 62 signatures, every multi-member group internally consistent. No sizing/styling inconsistencies outstanding. |
| **Toolbars / Headers** | not re-run | Run 128: header 56px + exactly one `<h1>` on 19/19 routes. Consistent. |
| **Sidebar / Nav** | not re-run | Run 128: 18 links / 18 icons / 42px on 19/19, exactly one `.is-active` except `/alerts` (documented orphan route). |
| **Forms** | not re-run | Run 128: **0 native `<select>`, 0 native date inputs** across 19 routes + 15 Settings tabs + 3 auth routes. `DatePicker.jsx` / `CustomSelect.jsx` standards hold. |
| **Spacing** | not re-run | Run 128: no alignment issues outstanding. |
| **Modals** | **run — 2 defects found, 2 fixed** | See below. |

### Modals — `ce00ee2` (2 defects)

The Storm History and Billing Notice panels in `LeadDetail.jsx` set `position:fixed; top:50%; left:50%` but never applied the compensating `translate(-50%,-50%)`, so their **top-left corner** landed on the viewport centre instead of their middle. At a 929×861 viewport the 560px-wide panel ran **96px off the right edge**, and a full-height one (`maxHeight:80vh`) also runs off the bottom — where it is unreachable, because the panel is fixed and its overflow is hidden.

Adding the translate alone is not sufficient: the shared `modal-scale-in` keyframe ends at `transform: none`, which clobbers the centring translate the moment the animation lands. The fix adds a `modal-scale-in-centered` variant carrying the translate through **both** keyframes (the same way `mapLoadFadeIn` does) and points the two self-centring panels at it. The other four `modal-scale-in` consumers (CalendarView, DripSequences, EstimatesView, InvoicesView) are centred by a flex parent and carry no transform of their own, so they correctly keep the original keyframe.

Verified at runtime: injecting the pre-fix style measures the panel centre 280px right / 200px below the viewport centre; the fixed Storm History modal measures a centring error of **0,0** with nothing off-screen. Re-confirmed in s5 against the built bundle — `@keyframes modal-scale-in-centered{0%{opacity:0;transform:translate(-50%,-50%)scale(.95)}to{...}}` is present in `dist/assets/index-DJwUQBaw.css`, and both consumers are wired in (`LeadDetail.jsx:1839`, `:1969`).

---

## Bugs Fixed

1. **`POST /api/crm/subcontractors/assign` + `GET /api/crm/subcontractors/work-order/:id`** — any tenant could attach any subcontractor uuid in the database to their own work order and read back that rival contractor's crew name, company, phone, email and specialty — `assertOwned()` at the write boundary plus `AND s.tenant_id = $2` on the read join (`151428c`).
2. **`PUT /api/estimates/:id`, `/api/crm/invoices/:id`, `/api/crm/contracts/:id`, `/api/crm/expenses/:id`** — all four update paths stored another tenant's `lead_id`/`estimate_id`; the CREATE-side guard added on 09-06 left PATCH/PUT as an unguarded door onto the identical defect — added the same `assertOwned()` guard to all four (`e75f7dd`).
3. **`payments.js:263` and `contractService.js:52`** — read joins onto `estimates` could surface a foreign row even after input validation, because validation cannot reach a row that is already stored — added the tenant equality to the `ON` clause (`e75f7dd`).
4. **`POST /api/estimates`** — a blanket required-`lead_id` check made the Estimate Builder, the endpoint's only client caller, unable to save by any of its five paths; the column is nullable and the builder has no lead field — restricted the check to the UUID-format half that actually prevents the 500 (`fb9f9ba`).
5. **`POST /api/crm/invoices`** — same root cause; New Invoice failed whenever no lead was picked, which the UI treats as optional (`fb9f9ba`).
6. **`POST /api/crm/contracts`** — same root cause; New Contract failed whenever no lead was picked (`fb9f9ba`).
7. **`/estimates` Estimate Builder** — `handleSave`, `handleSend` and the send-for-signing modal gated on the `estimate` **prop**, which stays null after the review toolbar has already persisted the row, so each wrote a **duplicate estimate** for the same job — collapsed all six save paths onto one `savedEstimate = estimate || createdEstimate` (`2f1b469`).
8. **`/leads/:id` Storm History modal** — `top:50%; left:50%` with no compensating translate put the panel's top-left corner at the viewport centre, running it 96px off the right edge — added `modal-scale-in-centered`, which carries the translate through both keyframes (`ce00ee2`).
9. **`/leads/:id` Billing Notice modal** — same defect; at full height it also ran off the bottom, where it is unreachable (`ce00ee2`).

---

## Known Issues (Not Fixed)

- 🔴 **10 unscoped joins remain in `server/src/services/financing/index.js`.** s1's rebuilt join scanner found 13 unscoped joins onto tenant-owned tables (down from Run 125's 31 after the `leads` and `users` families closed); tonight's `e75f7dd` closed 2 of the 3 outside financing, leaving **10 in the financing service** — `financing_plans`, `financing_lenders` and `estimates` joined with no `tenant_id` predicate anywhere in the query. **s1's triage section was left empty when it capped.** Currently **latent, not exploitable**: `financing_applications` holds 0 rows and all 5 `financing_plans` / 1 `financing_lender` belong to a single tenant, so there is no second tenant's data to leak yet. It becomes a live cross-tenant disclosure the moment a second tenant configures financing. **This is the top item for the next s1.**
- 🔴 **`server/src/scripts/updateView.js` is obsolete and destructive if run.** Carried unresolved from Run 128. Referenced by no package script and imported nowhere; its `CREATE VIEW` no longer matches the live view. Running it would drop `custom_fields`, `lead_score`, `lead_score_factors`, `lead_score_updated_at`, and `getLeads()` allows `lead_score` in `allowedSort`, so `/leads` sorted by score would start throwing. Should be deleted or regenerated from migration 051. **Needs a human decision.**
- ⚠️ **`updateInvoice` silently ignores `estimate_id`.** It is absent from `allowedFields`, so a PUT carrying it returns `200` having written nothing, while the sibling `updateContract` returns `400` for the same input. Not a security defect (confirmed: no foreign id is stored) and consistent with the codebase's whitelist idiom, but the two endpoints disagree. Design decision, not filed as a bug.
- **Pre-existing QA junk in the database.** ~34 of 64 `subcontractors` rows are old fixtures (`{"$eq":1}`, `12345`, `QA Sub`…) plus one `qa20260730c` lead. **None created tonight.** Deletion is a write against a Neon free-tier database; deferred, as in prior runs.
- **Empty-state-only surfaces.** `tasks`, `contacts`, `documents`, `payments` and `financing_applications` all hold 0 rows, so those pages cannot be tested beyond their empty state without planting fixtures.
- **`/alerts` orphan route** and **64 generic error toasts** — both long-standing, both carried.

---

## Test Coverage Gaps

1. **All four upstream stages capped on `max_turns`** (51/50, 81/80, 61/60, 41/40). This is the single largest source of lost coverage and is now the **#1 note for five consecutive runs**. The charters are wider than the turn budgets allow; either raise the budgets or narrow the charters.
2. **s2 and s3 wrote no results artifact**, so frontend and UI-audit coverage is **unmeasured, not passing** — only what their commits prove is reportable. The "write your artifact on turn 1" instruction has now been given and ignored for five runs.
3. **The stale-temp trap paid off again — 5 runs for 5.** Artifacts live in **two** temp roots. `/tmp/api-test-results.txt` (09-06), `/tmp/frontend-test-results.txt` (09-04) and `/tmp/ui-audit-results.txt` (09-07) are all stale; tonight's real s1 artifact is `C:/tmp/api-test-results.txt` (05:07 today). **`stat` every artifact before reading it.**
4. **Write-endpoint coverage is thin.** Of 140 endpoints exercised, 132 were GETs. Only **8 of the 140 write routes** (88 POST / 26 PATCH / 8 PUT / 18 DELETE) were probed, and those only along the cross-tenant axis. **The functional write-endpoint sweep has now been skipped three runs running.**
5. **UI audits 1–6 were not re-run**, so their PASS status is carried from 2026-09-07 rather than re-confirmed. The Run 128 inline-literal technique (diffing N sibling inline-style literals against each other where a shared class supplies only part of a component) is **still unexploited on `.glass`, `.slide-over` and `.quick-action-btn`**.
6. **23 of 28 client routes were not opened this run.**
7. **The `/onboarding` wizard's later steps (PLAN / PAYMENT / ADD-ONS) remain unswept** — advancing through them may write rows or touch Stripe, so they need a static read rather than a live walk.
8. **A tester-error trap cost s1 a full sweep.** The first GET sweep returned 23×200 and **93× "fetch failed"** — a hard cutoff partway through the alphabetical route list that looks exactly like a crashed server. The server was alive; the sweep had started ~45s after a restart while the startup SPC/MRMS ingestion was stalling the event loop. **Wait for "startup backfill complete" in the server log before sweeping.**
9. **Run-number drift recurred for the second run running.** s1 correctly identified tonight as Run 130 (last night's s4/s5 had already claimed 129), but s4 then named its harnesses `.qa-r131-*`. Tonight is **Run 130**.

---

## Verification

```
vite build            PASS   7.87s, exit 0
s4 re-verification    16/17 assertions PASS  (1 harness expectation error, run down — not a defect)
cross-tenant FK audit 0 across all 6 relations
DB rows created today 0  (estimates, invoices, contracts, leads, subcontractors)
final row counts      estimates 17 · invoices 14 · contracts 4 · leads 13 · subcontractors 64 · wo_subs 1
geocoding calls       0        paid API calls  0
working tree          clean of source changes; all 5 fixes committed
```
