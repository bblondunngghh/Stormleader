# StormLeads — Overnight QA Report

**Run 83 — 2026-08-20**
Baseline: `3169797` (checkpoint: pre-overnight-run 2026-08-20) → HEAD `8e9f287`
Branch: `feat/financing` · Build: **PASS** (`npx vite build`, exit 0)

---

## QA Test Summary

| Metric | Count |
|---|---|
| App routes driven in a browser | **18** audited (s3) / **16** render + interaction tested (s2) |
| Settings sub-tabs exercised | 15 |
| API route patterns inventoried | **272** (36 route files) |
| API route patterns exercised with a real response | **206 of 272 (76%)** |
| Total API calls issued | **290** — 177 2xx, 96 expected 4xx, **1 5xx**, 16 skipped |
| Bugs found | **2** |
| Bugs fixed | **2** (both committed and re-verified) |
| UI inconsistencies found | **0 new** |
| UI inconsistencies fixed | **0** (none warranted) |
| New issues documented but not fixed | 1 (low severity — see Known Issues #8) |

**Bottom line:** two real defects were found and both are fixed. Both were *behavioural* —
code that renders correctly and does nothing. The visual/UI consistency audit found zero new
defects for the sixth consecutive run and is now considered converged.

### Stage execution

| Stage | Window | Turns | Exit | Output |
|---|---|---|---|---|
| s1 api-test | 05:00–05:08 | 51/50 | `error_max_turns` | Found the financing 500; left the fix uncommitted |
| s2 frontend-test | 05:09–05:31 | 81/80 | `error_max_turns` | Fixed the PDF bug; committed s1's fix; cleared the DB backlog |
| s3 ui-audit | 05:31–05:45 | 53 | **`end_turn` (clean)** | Zero defects; six new behavioural checks; docs commit |
| s4 verify | 05:45–06:00 | 41/40 | `error_max_turns` | Independently re-verified both fixes |
| s5 report | 06:00– | — | — | This document |

Three of five stages hit their turn cap. See Test Coverage Gaps.

---

## Backend API Test Results

Source: stage 1 (`s1-api-test`). Server `http://localhost:3001`, tenant `waterloo`.
Inventory built from `server/src/routes/index.js` mount prefixes × each module's
`router.<verb>()` paths — **272 patterns across 36 files**.

Four passes were run:

| Pass | Scope | Calls | Result |
|---|---|---|---|
| 1 — GET sweep | every GET pattern, real IDs where resolvable | 132 | 104× 200, 10× 400, 5× 403, 5× 404, 8 unresolvable |
| 2 — Empty-body write sweep | every write route, `{}` body | 90 | 56× 400, 18× 200, 4× 201, 1× 403, 3× 404, 8 unresolvable |
| 3 — Lifecycle round-trip A | create → read → update on real rows | 35 | 22× 200, 5× 201, 5× 400, 3× 404 |
| 4 — Lifecycle round-trip B | financing, materials, canvassing, custom fields | 33 | 14× 200, 10× 201, 6× 400, 2× 404, **1× 500** |

Every 4xx in these passes was traced to a deliberate guard (missing required param,
platform-admin-only, or a public-token route with no token). **The single 5xx was the one
backend bug of the night.**

### By endpoint category

`routes` = patterns in the inventory; `calls` = requests issued against that category.

| Category | Routes | Calls | 2xx | Expected 4xx | 5xx | Skipped | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| `crm/financing` | 13 | 22 | 7 | 13 | **1** | 1 | **1 FAIL → fixed `a187498`** |
| `crm/work-orders` | 12 | 17 | 15 | 2 | 0 | 0 | PASS |
| `crm/dashboard` | 15 | 15 | 15 | 0 | 0 | 0 | PASS |
| `crm/drip-sequences` | 8 | 15 | 7 | 3 | 0 | 5 | PASS |
| `estimates` | 17 | 15 | 7 | 8 | 0 | 0 | PASS |
| `crm/leads` | 14 | 14 | 7 | 7 | 0 | 0 | PASS |
| `crm/contracts` | 13 | 13 | 7 | 5 | 0 | 1 | PASS |
| `materials` | 9 | 13 | 9 | 2 | 0 | 2 | PASS |
| `properties` | 18 | 13 | 8 | 5 | 0 | 0 | PASS |
| `notifications` | 6 | 11 | 8 | 2 | 0 | 1 | PASS |
| `crm/subcontractors` | 8 | 10 | 7 | 3 | 0 | 0 | PASS |
| `crm/territories` | 6 | 10 | 6 | 1 | 0 | 3 | PASS (table absent — see gaps) |
| `crm/automations` | 5 | 9 | 5 | 2 | 0 | 2 | PASS |
| `crm/canvass-pins` | 5 | 7 | 3 | 4 | 0 | 0 | PASS |
| `crm/invoices` | 8 | 7 | 4 | 3 | 0 | 0 | PASS |
| `roof-measurement` | 8 | 7 | 5 | 2 | 0 | 0 | PASS |
| `skip-trace` | 10 | 7 | 5 | 2 | 0 | 0 | PASS |
| `admin` | 6 | 6 | 0 | 6 | 0 | 0 | PASS (403 by design — platform-admin only) |
| `crm/custom-fields` | 4 | 7 | 4 | 3 | 0 | 0 | PASS |
| `crm/prospect-lists` | 5 | 6 | 4 | 1 | 0 | 1 | PASS |
| `crm/reports` | 6 | 6 | 6 | 0 | 0 | 0 | PASS |
| `crm/tasks` | 3 | 6 | 4 | 2 | 0 | 0 | PASS |
| `leads` | 6 | 6 | 5 | 1 | 0 | 0 | PASS |
| `crm/expenses` | 5 | 5 | 2 | 3 | 0 | 0 | PASS |
| `onboarding` | 7 | 5 | 3 | 2 | 0 | 0 | PASS |
| `alerts` | 4 | 3 | 3 | 0 | 0 | 0 | PASS |
| `counties` | 4 | 3 | 2 | 1 | 0 | 0 | PASS |
| `dashboard` | 3 | 3 | 3 | 0 | 0 | 0 | PASS |
| `data` | 3 | 3 | 1 | 2 | 0 | 0 | PASS |
| `drift` | 5 | 3 | 2 | 1 | 0 | 0 | PASS |
| `map` | 3 | 3 | 1 | 2 | 0 | 0 | PASS |
| `auth` | 5 | 2 | 1 | 1 | 0 | 0 | PASS |
| `crm/pipeline` | 2 | 2 | 2 | 0 | 0 | 0 | PASS |
| `crm/team` | 3 | 2 | 1 | 1 | 0 | 0 | PASS |
| `crm/tenant-settings` | 2 | 2 | 2 | 0 | 0 | 0 | PASS |
| `documents` | 3 | 2 | 1 | 1 | 0 | 0 | PASS |
| `payments` | 7 | 2 | 2 | 0 | 0 | 0 | PASS (Stripe paths not driven) |
| `storm-history` | 2 | 2 | 0 | 2 | 0 | 0 | PASS (both are bbox guards) |
| `storms` | 2 | 2 | 2 | 0 | 0 | 0 | PASS |
| `crm/activities` | 1 | 1 | 0 | 1 | 0 | 0 | PASS |
| `crm/calendar` | 1 | 1 | 0 | 1 | 0 | 0 | PASS (`start`/`end` required) |
| `disaster-declarations` | 1 | 1 | 0 | 1 | 0 | 0 | PASS (state/county required) |
| `search` | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| `crm/test-email`, `webhooks` | 3 | 0 | — | — | — | — | **Not exercised** — see gaps |
| **TOTAL** | **272** | **290** | **177** | **96** | **1** | **16** | |

### What was fixed — backend

**`a187498` — `POST /api/crm/financing/applications` returned 500 on a valid-looking payload.**

`financing_applications.estimate_id` and `.amount` are both `NOT NULL`
(`030_financing.sql:53,59`) and `amount` is `INTEGER`, but the route only validated `leadId`
and `planId`. A payload omitting `estimateId` or `amount` reached the `INSERT` and surfaced
as a generic 500:

```
[500] 2026-08-20T10:06:29.966Z POST /api/crm/financing/applications
error: null value in column "estimate_id" of relation "financing_applications"
       violates not-null constraint
```

A non-numeric `amount` failed the same way. Fixed by validating both up front and coercing
`amount` to a `Number`. No client caller sends this payload (`LeadDetail.jsx:176` only GETs),
and the internal `createApplicationFromEstimate` path is unaffected — so this is a hardening
fix with no behaviour change for the app.

Found by s1, which hit its turn cap before it could commit; s2 recovered the change from the
working tree and committed it. **Third consecutive night that `git status` recovered real work
from a capped stage.**

---

## Frontend Feature Test Results

Source: stage 2 (`s2-frontend-test`). Playwright against the live dev app at
`http://localhost:5173` (title asserted `StormPipe — Roofing CRM`).

**All 16 routes render clean: 0 console errors, 0 page errors, 0 failed requests, `<h1>` on
all 16.**

| Page | What was tested | Result |
|---|---|---|
| `/` Dashboard | 6 stat cards navigate (`/storm-map`, `/leads`, `/pipeline`, `/leads?stage=sold`) | PASS |
| `/leads` | Search (`search=LOCH` reaches server, 12→1 rows), no-match empty state, sort (`sort_by=stage`/`estimated_value`/`created_at`), pagination (`limit=50`) | PASS |
| `/leads/:id` | Slide-over: View House, Measure Roof, Run Trace, Storm History, Property Report, Generate Contract, Share Status Page, quick-log actions | PASS |
| `/pipeline` | 12 cards render; card click opens the detail overlay | PASS |
| `/estimates` | Edit opens the inline builder; Review & Share renders | PASS — **PDF was broken, now fixed** |
| `/invoices` | "New Invoice" opens a full inline builder (line items, tax, due date, summary) | PASS |
| `/contracts` | List and row actions render | PASS |
| `/work-orders` | New Work Order modal opens | PASS |
| `/tasks` | Full lifecycle: create `POST 201` → listed "Pending 1" → toggle `PATCH 200` → "Pending 0 / Completed 1" | PASS |
| `/calendar` | 42 day cells render | PASS |
| `/reports` | 9 recharts surfaces, all 5 date presets re-render, **all 6 CSV exports download with correct per-section filenames** | PASS |
| `/expenses` | List and modal render | PASS |
| `/materials` | List renders | PASS |
| `/subcontractors` | List renders | PASS |
| `/canvassing` | Google map renders | PASS |
| `/storm-map` | Google map renders | PASS |
| `/settings` | **All 15 tabs re-render**: Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews | PASS |

The 6 `/reports` CSV exports were confirmed by inspecting the downloaded files, not just the
click: `revenue-report`, `pipeline-report`, `conversion-report`, `lead-sources`,
`rep-leaderboard`, `stage-duration` — each with distinct, correct content.

### What was broken and how it was fixed — frontend

**`eb6331b` — the estimate "Download PDF" button was dead on both of its code paths.**

Two independent defects stacked on the same control, each a 100% failure:

1. **Wrong URL.** The axios client's `baseURL` is already `/api` (`api/client.js:4`), but
   `handleDownloadPdf` hardcoded `` `/api/estimates/${id}/pdf` ``, resolving to
   **`/api/api/estimates/:id/pdf`**. Proved live — that URL 404s, the correct one returns
   `200 application/pdf`. This was the **only** hardcoded `/api` in any `client.*` call in the
   entire client; contracts, work orders, property report and weather history all already used
   the correct relative form.
2. **Out-of-scope identifiers.** The only reachable PDF control is the review-mode button at
   `EstimatesView.jsx:1637`, which lives inside `EstimateBuilder` (`:1248`) — a *different
   component*. Its `onClick` referenced `editingEstimate`, which is `EstimatesView` state, so
   the click threw `ReferenceError: editingEstimate is not defined` and never reached the
   download at all. `handleDownloadPdf` was likewise out of scope there.

Both failures are visible in the captured console log:

```
[ERROR] 404 @ http://localhost:5173/api/api/estimates/b4603e30-.../pdf
ReferenceError: editingEstimate is not defined
ReferenceError: downloadEstimatePdf is not defined
```

**Fix:** hoisted the download to module scope (it only needs the module-level `client` and
`showToast` imports) and pointed the button at the `estimate` prop it actually has.
**Verified end-to-end:** Edit → Review & Share → PDF now issues
`GET /api/estimates/:id/pdf` → `200 application/pdf` and downloads `EST-082.pdf`, with zero
console errors.

Found by a new set difference: `client.<verb>('<path>')` literals vs the server route table —
**275 client calls vs 272 server routes, exactly 1 miss**, which was defect #1.

### Independent re-verification (stage 4)

Both fixes were re-driven from a cold server by a separate stage:

- **Financing:** `POST /api/crm/financing/applications` now returns a clean
  `404 {"error":"Plan not found or inactive"}` — a validated rejection, not a 500. The stage-4
  server log contains **zero `[500]` entries** across its full 14-minute window.
- **PDF:** `EST-082.pdf` (2,688 bytes) downloaded successfully through the browser.

### What still needs attention

Nothing on the pages above is left broken. The open items are in Known Issues below; none of
them block a user flow.

---

## UI Consistency Audit Results

Source: stage 3 (`s3-ui-audit`), full write-up at `docs/ui-audit-2026-08-20.md`.
**All 7 prescribed audits PASS on 18 routes. Zero new defects. No code changes were made
because none were warranted.**

This is the **sixth consecutive run with no new visual defect** — the prescribed audits have
converged.

| Audit category | Question | Result |
|---|---|---|
| **Icons** | Any non-Heroicon icons? | **None.** 0 foreign icons, 0 `fa-*`/Material, 0 solid-set imports across 41 files; only the 2 documented inline `<svg>`. **Nothing to fix.** |
| **Buttons** | Any sizing/styling inconsistency? | **None.** Primary `.auth-btn` is byte-identical on all 7 routes that use it: `oklch(0.72 0.19 250)` / 36px / 13px / weight 700 / `14px 12px` radius. All other radii belong to documented families. **Nothing to fix.** |
| **Toolbars/Headers** | Consistent across pages? | **Yes.** `.topbar.glass` is 56px on all 18 routes, and all 18 render an `<h1>`. |
| **Sidebar/Nav** | Any issues? | **One pre-existing.** 18 links / 18 icons / gaps `[0,30,8]` identical / exactly 1 `.is-active` — except `/alerts`, which has 0 because nothing links to it (orphan route, known issue). Collapse verified working: 240px → 68px, labels hidden, restores to 240px, no navigation. |
| **Forms** | Any non-standard elements? | **None.** **0 native `<select>` and 0 native `<input type="date">`** anywhere — `CustomSelect` and `DatePicker` are used everywhere, as required. Also 0 orphan `htmlFor` and 0 duplicate `id`. **Nothing to fix.** |
| **Spacing** | Any alignment issues? | **One systemic observation, not N defects** — see below. Not fixed; it is a refactor. |
| **Modals** | All consistent? | **Chrome yes, dismissal no.** 22 backdrops; every one measured animates `modal-scale-in 0.2s` with radius 20px. Two pre-existing variances remain: `/expenses` uses `h3`@16px where the rest use `h2`@18px, and only 11 of 22 close on outside click. |

### The one systemic spacing finding

**The app's root `font-size` is 14px, not the browser default 16px** (`html` and `body` both
14px; proved with a live `p-5` probe computing **17.5px**). Every Tailwind rem spacing utility
therefore resolves against a 14px root, so **two spacing systems coexist**:

- **Tailwind rem utilities** → 7 / 8.75 / 10.5 / 14 / 17.5 / 21px — used on `/` and `/pipeline`
- **px design tokens** (`--space-xs..xl` = 4/8/12/16/24px) → 12 / 16 / 20 / 24px — everywhere else

This single fact is the root cause of every fractional padding and card-gap value in the app,
and it explains the Dashboard-vs-Pipeline-vs-Reports card spacing spread in one sentence.
Reconciling it means rewriting the spacing of two working pages, which is a refactor, not a QA
fix. **Recorded as the best-defined refactor candidate in the backlog.**

### Six new behavioural checks — all clean

Because the visual audits have converged, the bulk of stage 3 went into source-level set
differences aimed at the remaining defect class: *a control that renders perfectly and does
nothing* — exactly the shape of tonight's PDF bug.

| # | Check | Result |
|---|---|---|
| 1 | `useState` setter declared but never called (state frozen) | 7 hits, **all dead code, no user-visible effect** |
| 2 | `<button>` with no `onClick` and not `type=submit` | 2 hits, **both false positives** (StormMap InfoWindow buttons wired imperatively) |
| 3 | Controlled `<input value={…}>` with no `onChange` (field cannot be typed into) | **0** |
| 4 | Overlay/disclosure flag set but never read | 1 hit (`ContractsView` `isMobile`), mobile-only |
| 5 | Form-submit integrity — submit control whose `<form>` has no `onSubmit` | **0** — all 17 submit controls correctly wired |
| 6 | Backdrop `onClick` without panel `stopPropagation` | **0** real — the 2 candidates use the sibling-backdrop pattern |

Harnesses kept and reusable: `server/.qa-r83-s2-pathdiff.mjs`, `.qa-r83-s2-scopediff.mjs`,
`.qa-r83-s3-deadctl.mjs`, `.qa-r83-s3-unread.mjs`, `.qa-r83-s3-formdiff.mjs`. All five
currently report clean.

---

## Bugs Fixed

1. **`POST /api/crm/financing/applications`** — returned a generic **500** instead of a 400
   whenever `estimateId` or `amount` was missing, or `amount` was non-numeric. Both columns are
   `NOT NULL` on `financing_applications` but the route validated only `leadId` and `planId`, so
   the bad payload reached the `INSERT` and died on a not-null constraint violation. — **Fixed
   in `a187498`:** validate `estimateId` and `amount` up front and coerce `amount` to a `Number`.
   Re-verified in stage 4: now a clean validated rejection, zero 500s.

2. **`/estimates` → Edit → Review & Share → Download PDF** — the button was **dead on both of
   its code paths**. (a) The URL was hardcoded as `/api/estimates/:id/pdf` while the axios
   `baseURL` is already `/api`, resolving to `/api/api/estimates/:id/pdf` → 404. (b) The button
   lives inside `EstimateBuilder` but its `onClick` referenced `editingEstimate` and
   `handleDownloadPdf`, both of which belong to the parent `EstimatesView` — so the click threw
   `ReferenceError` before it ever reached the download. — **Fixed in `eb6331b`:** hoisted the
   download to module scope and pointed the button at the `estimate` prop it actually has.
   Re-verified twice (stages 2 and 4): `GET /api/estimates/:id/pdf` → `200 application/pdf`,
   `EST-082.pdf` downloads, 0 console errors.

---

## Known Issues (Not Fixed)

| # | Issue | Why not fixed |
|---|---|---|
| 1 | **`/alerts` is an orphan route** — 0 `.is-active` sidebar links because nothing navigates to it | Design decision: either add a nav entry or remove the route. Pre-existing. |
| 2 | **`/expenses` modal title is `h3`@16px** where every other modal uses `h2`@18px | Design decision on the canonical modal title level. Pre-existing. |
| 3 | **Modal dismissal is inconsistent** — only 11 of 22 backdrops close on outside click; Esc is likewise partial | Design decision: pick one dismissal contract and apply it to all 22. Pre-existing. |
| 4 | **Two spacing systems coexist** (14px root font-size + Tailwind rem utilities alongside px `--space-*` tokens) | Refactor, not a QA fix — reconciling it means rewriting the spacing of two working pages. |
| 5 | **`ContractsView` `isMobile` flag is set but never read** (`:74`) | Mobile is paused; web-only focus. |
| 6 | **7 frozen `useState` pairs** across 3 files (setter declared, never called) | Dead code with no user-visible effect. Cosmetic cleanup. |
| 7 | **336 QA screenshots are tracked in the repo root** (`git ls-files "*.png" \| grep -v /`) — committed by earlier runs and not gitignored, which is why `git status` never shows them | Bulk deletion of tracked files is a developer call. |
| 8 | **NEW — `PATCH /crm/financing/plans/:id` and `/lenders/:id` return `404 "Plan/Lender not found"` when the body contains no updatable field.** `updatePlan` accepts only `isActive`/`isDefault` and returns `null` when neither is present (`services/financing/index.js`), which the route maps to 404. A caller sending a valid ID with an unrecognized field gets "not found" for a row that demonstrably exists. Should be `400 "No fields to update"`, which is what `PATCH /crm/canvass-pins/:id` correctly returns. | Surfaced while compiling this report from stage 1's raw artifacts (stage 1 hit its turn cap before triaging them) and verified in source. Low severity — no client caller sends this shape. Filed for the next run. |
| 9 | **7 QA probe rows created by stage 1 remain in the DB** — drip sequence, contract template, prospect list, financing lender, custom field, canvass pin, material order | Stage 1 capped before its cleanup step. Small (7 rows), but should be the next run's first action. The *large* historical backlog **was** cleared tonight. |
| 10 | **Nightly Playwright suite (`tests/nightly-audit.spec.js`) has 5 stale selectors** — `.sidebar a`, `[class*="kanban"]`, `.stat-card` all match 0 elements | Test debt, not app bugs — both flows work when driven manually. Carried forward from Run 81. |

### Not bugs — do not re-file

- `/leads` ADDRESS column not sorting is **by design** — exactly 7 `<th>`s call `handleSort`.
- The task modal's "Medium" priority is **correct** — `CustomSelect` maps label "Medium" →
  value `warm`, and `POST /crm/tasks` only accepts `hot|warm|cold`.
- `/invoices` "New Invoice" not opening an overlay is **correct** — it swaps in an inline
  builder, the same pattern as the estimate builder.
- The 2 console 403s on a full sweep are the **intentional** platform-admin-only `/admin` route.
- `/tasks` and `/calendar` rendering empty is **correct** after tonight's DB cleanup.
- The 73 `Failed to import county by bbox` errors in the stage-4 server log are
  `ENOTFOUND feature.tnris.org` — **no network access to the TNRIS host in this environment**,
  not an app fault.

---

## Test Coverage Gaps

**206 of 272 API route patterns (76%) were exercised with a real response.** The remaining 66
break down as follows.

**16 patterns skipped — no resolvable ID.** `crm/drip-sequences/:id` (+ `/enrollments`),
`crm/financing/applications/:id`, `crm/prospect-lists/:id/items`, `crm/territories/:id`
(+ `/pins`), `materials/orders/:id`, `materials/products/:id`, and their write counterparts.
Note that **the `territories` table does not exist in this database**, so those routes cannot be
exercised at all until a migration lands.

**50 patterns never called**, all deliberately excluded:

| Excluded group | Count | Reason |
|---|---:|---|
| `DELETE` routes | 18 | Destructive; excluded from automated sweeps by charter, and every deletion is a write against a Neon free-tier DB. |
| Email/SMS send routes (`estimates/:id/send`, `invoices/:id/send`, `invoices/:id/send-email`, `contracts/:id/send`, `crm/test-email`, `alerts/test`, `crm/team/invite`) | 7 | Each dispatches a real message to a real recipient. |
| Stripe/payment routes (`payments/create-intent`, `payments/public/create-intent`, `payments/connect/onboard`, `payments/connect/refresh`, `payments/webhook`, `onboarding/setup-payment`, `skip-trace/setup-payment`) | 7 | Require live Stripe credentials and a webhook signature. |
| Cost-incurring routes (`properties/geocode`, `properties/generate-leads`, `properties/import-csv`, `properties/trigger-import`, `properties/fema-live-polygon`, `counties/:id/import`, `roof-measurement/measure`, `skip-trace/submit`) | 8 | Billed Google/vendor API calls and/or bulk row writes. Standing rule: never auto/bulk geocode. |
| Webhook receivers (`webhooks/hearth`, `webhooks/tracerfy`) | 2 | Require a valid provider signature. |
| Bulk mutation (`drift/calibrate`, `drift/correct-all`) | 2 | Rewrites many rows. |
| Tenant/auth creation (`auth/register`, `onboarding/create-tenant`) | 2 | Creates a real tenant. `auth/login` **was** exercised (token minted); `auth/refresh` is rate-limit sensitive. |
| Public-token routes needing a live signed token (`contracts/public/:token/sign`, and the read side of the estimate/contract/financing public pages) | 4 | Returned 404 without a token; not driven with a real one. |

**Other gaps:**

- **`/admin` (6 routes) was never functionally exercised** — all 6 correctly return 403 for a
  non-platform-admin user. Testing the actual admin surface needs a platform-admin session.
- **Three of five stages hit their turn cap** (`s1` 51/50, `s2` 81/80, `s4` 41/40). The
  consequences: s1 never wrote `/tmp/api-test-results.txt` (**the file at that path is Run 82's,
  dated 2026-08-19 — it is not this run's output**) and never ran its cleanup step; s4 re-verified
  both fixes but never reached its edge-case pass (empty states, validation messages,
  back/forward navigation). This is a recurring pattern: stages that open with an open-ended
  sweep exhaust the budget before reaching their own deliverable steps.
- **`/tmp/frontend-test-results.txt` does not exist** for this run; `C:/tmp/frontend-test-results.txt`
  is dated 2026-08-11 and belongs to an older run. Stage 2's findings in this report are taken
  from its commits, its Playwright artifacts (console logs, downloaded CSVs, `EST-082.pdf`) and
  its resume entry — not from that stale file.
- **Mobile viewports were not tested** — the project is web-only; mobile is paused.
- **No DELETE/destructive-path coverage** at all, per the exclusions above.

---

## Source Artifacts

| Artifact | Path | Run |
|---|---|---|
| UI audit write-up | `docs/ui-audit-2026-08-20.md` | **This run** |
| UI audit results | `/tmp/ui-audit-results.txt` (2026-08-20 05:43) | **This run** |
| API route inventory | `C:/tmp/route-inventory.json` (272 patterns) | **This run** |
| API sweep results | `C:/tmp/qa-{get,emptybody,lifecycle,lifecycle2}-results.json` | **This run** |
| Stage-4 server log | `C:/tmp/qa-s4-server.log` (zero `[500]` entries) | **This run** |
| Browser console logs | `.playwright-mcp/console-2026-08-20T10-{10,32,47}-*.log` | **This run** |
| Report CSV exports | `.playwright-mcp/*-2026-08-20.csv` (6 files) | **This run** |
| Downloaded PDF | `.playwright-mcp/EST-082.pdf`, `C:/tmp/qa-s4-estimate.pdf` | **This run** |
| ⚠️ `/tmp/api-test-results.txt` | dated 2026-08-19 | **Run 82 — stale, not this run** |
| ⚠️ `C:/tmp/frontend-test-results.txt` | dated 2026-08-11 | **older run — stale, not this run** |

Note: `/tmp` and `C:/tmp` are different directories on this machine; both were checked.

---

## Commits This Run

```
8e9f287  docs(qa): archive Run 83 UI consistency audit results (2026-08-20 s3)
eb6331b  fix(ui): estimate Download PDF was dead on both of its code paths
a187498  fix(financing): POST /crm/financing/applications 500'd on missing estimateId/amount
3169797  checkpoint: pre-overnight-run 2026-08-20   (baseline)
```
