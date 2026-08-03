# StormLeads — Overnight QA Report

**Run 66 · 2026-08-02 · branch `feat/financing`**
Baseline: `7783290` (Run 65 HEAD) · Checkpoint: `e5082d9` · Final HEAD: `626c7cd`
Stages: s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)
Final client build: **exit 0, 7.95s, 0 errors**

---

## QA Test Summary

| Metric | Count |
|---|---|
| Pages rendered and swept | 17 of 17 routes |
| Pages tested at interaction depth | 7 |
| API endpoints inventoried | 272 (36 route modules) |
| API write routes type-fuzzed | 84 (38 excluded for safety, enumerated below) |
| Total API requests issued | ~7,000 |
| **Bugs found** | **8** |
| **Bugs fixed** | **7** |
| Bugs open | 1 |
| UI inconsistencies found | 1 |
| UI inconsistencies fixed | 1 |
| Code commits | 7 |

Seven fixes landed: four backend, three frontend. One new backend defect was found late and is left open with a live reproduction. The single carried defect from Run 65 — ten hard 500s from unvalidated pagination — was closed this run.

**The method that produced the results.** The `server/src/routes` drift gate was empty again and the 272-route harnesses had passed in Run 63, so no stage re-ran them. Instead s1 executed **Axis D (type confusion in write bodies)** — the #1 carried gap, never run in this pipeline's history. It found 6 hard 500s on its first execution. Every backend fix this run traces to that axis or to a click-through that render-depth sweeps cannot reach.

---

## Backend API Test Results

Coverage is expressed against the 272-route inventory (`C:\tmp\route-inventory.txt`, regenerated this run).

| Category | Routes | Result |
|---|---|---|
| CRM core (`crm.js`) | 51 | 1 defect found, **still open** (custom-fields) |
| Properties | 18 | pass |
| Estimates | 17 | 1 data-scope defect (client side) — fixed `626c7cd` |
| Financing | 13 | 1 hard 500 — fixed `e9c5024` |
| Contracts | 13 | pass |
| Work orders | 12 | pass |
| Skip trace | 10 | pass (503 without `TRACERFY_API_KEY`, as designed) |
| Materials | 9 | 2 hard 500s — fixed `a2edcdb` |
| Subcontractors | 8 | 2 hard 500s — fixed `a2edcdb` |
| Invoices / roof measurement / drip | 24 | pass |
| Payments / onboarding | 14 | pass |
| Leads (`leads.js`) | 6 | 3 hard 500s — fixed `a2edcdb`; stage filter — fixed `77ae9a2` |
| Dashboard | 3 | 2 hard 500s — fixed `a2edcdb` |
| Auth | 5 | pass (2 excluded — would invalidate the QA session) |
| Admin | 6 | pass (1 excluded — platform-admin scope) |
| All remaining modules | 63 | pass |

### Test passes executed

| Pass | Requests | Routes | 5xx before | 5xx after |
|---|---|---|---|---|
| Axis D pass 1 — whole-body type confusion | 410 | 84 write routes | 6 | **0** |
| Axis D pass 2 — per-field shape confusion | 4,448 | 84 write routes | — | **4 (open)** |
| Write-body validation sweep | 164 | 45 | 0 | 0 |
| Axis C fuzz harness re-run (`.qa-r65-fuzz.mjs`) | 1,932 | 92 | 10 | **0** |
| s4 independent re-verification harness | 34 checks | — | — | 32 pass · 2 tester-error false positives · **0 real failures** |

### What was fixed

**`a2edcdb` — negative pagination and NUL bytes returned 500 instead of 400.**
Ten endpoints across five route files hard-500'd on client-supplied query params. Negative values parse as valid integers, so the existing guard — which already 400s `?limit=abc` because NaN raises 22P02 — let them straight through to the driver. Postgres then raised `2201W` (LIMIT must not be negative), `2201X` (OFFSET), and `22021` (invalid UTF8 byte 0x00). All three are client-input faults, so they were added to the existing `PG_BAD_INPUT_CODES` set in `errorHandler.js` — one change fixing all five route files, rather than five divergent per-file clamps. This closes the defect carried open from Run 65.

**`e9c5024` — `PATCH /api/crm/financing/lenders/:id` crashed on a non-string apiKey.**
`updateLender()` passed `updates.apiKey` straight to `encrypt()`, where `cipher.update(plaintext, 'utf8')` throws `ERR_INVALID_ARG_TYPE` for any array, object, number or boolean. The route validated nothing. `apiKey` was the only crashing field — `merchantId` and `config` fall through to a clean 404, and a non-boolean `isActive` was already translated by the 22P02 mapping.

**`6127783` — over-long field values returned 500 instead of 400.** *(reachable from the UI)*
Unlike the pagination case, this one is user-reachable: typing a 26-character phone number into **Add Contact** on a lead returned a hard 500, because `contacts.phone` is `varchar(20)` and `crmService.addContact` passes the value straight to the INSERT. Postgres `22001` is caused entirely by client input, so it joined the same `PG_BAD_INPUT_CODES` set — fixing every varchar column in the app rather than one route. The raw message leaks the column's declared width, so it is sanitized the way 22P02 already is.

**`77ae9a2` — 6 of the 14 dashboard funnel stages still landed on a 400.**
Found by clicking all 14 funnel rows after the `04ccf30` fix. `crmService.DEFAULT_PIPELINE_STAGES` advertises 14 stage keys and renders every one as a clickable row, but the `lead_stage` enum holds only 10. The six it lacks — `material_ordered`, `scheduled`, `completed`, `invoiced`, `paid`, `collections` — made Postgres raise 22P02 on the enum cast. The app was linking to a filter its own API rejects. Filtering now runs on `stage::text`, so an unknown key matches nothing instead of throwing. Write paths are untouched and still validate against `validStages`.

### Routes deliberately excluded (38)

Not silently capped — enumerated: platform-admin-scope mutations; `POST /api/auth/refresh` and `/register` (would invalidate the QA session); bulk county/geo ingestion; `POST /api/crm/invoices/:id/send-email` (sends real email); Stripe payment mutations; paid Tracerfy calls; Google-geocoding paths (standing cost rule); storm ingestion.

---

## Frontend Feature Test Results

All 17 routes were reached by clicking real `.nav-link` elements, not `pushState`. **Render sweep: 17/17 pass, 0 console errors, 0 error boundaries.**

### Dashboard — 1 bug found, fixed (and a second beneath it)
- **Tested:** stat cards, funnel panel, click-through on all 14 stage rows, browser back after each.
- **Broken:** clicking any funnel row navigated to `/leads?stage=<Display Label>` instead of the stage key. The API rejected the label with 400, so every row landed the user on "0 leads", a filter chip reading literally `Stage: undefined`, and two console errors — even though the row itself showed a non-zero count.
- **Fixed:** `04ccf30`. `getPipelineMetrics` already returns both `stage` (display) and `key` (filter) for exactly this purpose; `PipelineBars` used `row.stage` for both. One word.
- **Then:** the full 14-row click-through exposed a second, deeper defect — see `77ae9a2` above. Key mapping is now 14/14 correct and all 14 stages return 200. Browser back/forward re-exercised 14/14.

### Estimates — 2 bugs found, both fixed
- **Tested:** list, builder, KPI card row, Send-for-Signing flow, status filtering.
- **Broken (1):** the four KPI cards derived from the fetched page of 50, while the "Total Estimates" card beside them used the server's full count — the row silently mixed two scopes. With 83 estimates, the page reported **0 Accepted / $0.0K** while a real accepted **$4,500** estimate existed outside the newest 50.
- **Fixed:** `626c7cd`. Roll-ups now ride along on the COUNT query the list already runs — full filtered set, no extra round trip, no extra table scan. Cards verified at 83 / 15 / 1 / $4.5K against the database; `status=draft` still totals 66; empty result sets return zeroed stats with HTTP 200.
- **Broken (2):** "Send for Signing" dim state — see UI audit below. Fixed `e1a7657`.

### Calendar — pass *(carried gap closed; was render-depth only for 2 runs)*
All 4 views switch correctly (Month 42 cells / Week / Day / List); prev/next/today navigate; the `Today` disabled-state toggle is correct behaviour, not a bug. Date-click opens a prefilled Create Task modal; submit correctly stays disabled while the title is empty. 0 native `<select>`, 0 native date inputs.

### Canvassing — pass *(carried gap closed)*
Google Maps loads live; "Drop Pin" arms placement mode; map click opens the New Pin sheet with GPS and 6 outcome buttons; "Save Pin" correctly disabled until an outcome is picked. No DB write occurs before Save, so the flow is safe to exercise.

### Materials + cart — pass *(carried gap closed)*
136 products, 13 category pills. Filter, search and empty-state all correct. Cart line math verified exactly through add / qty+ / qty− / remove-line / remove-all ($77.98 → $115.42 → $152.86 → back → empty). No order submitted.

### Storm Archive — pass *(carried gap closed)*
200 storms; type filter, date range and search all correct. **Run 65's fix `5b52fb7` re-verified intact** — all 6 date-range pills measure exactly 36px and the active pill is byte-identical in height to the inactive ones; the row no longer reflows on click.

### Pipeline, Leads, Contracts, Work Orders, Invoices, Expenses, Tasks, Subcontractors, Reports, Settings, Storm Map — render + console clean
No defects at the depth reached. Leads was additionally verified as the funnel's landing target (correct counts, correct chip, correct dropdown state).

### Still needs attention
- **Storm Map, Admin, and roof drawing** remain render-depth only — no workflow has been exercised end to end.
- The **cart badge vs. drawer footer count** show different units (badge "3" vs footer "2 items"). Both values are correct; which one to display is a product labelling call, not a malfunction. Raised, not fixed.

---

## UI Consistency Audit Results

The seven charter axes have converged at static/default-state depth across Runs 61–65 and were re-confirmed by measurement this run. Because both of Run 65's finds were *"a styling rule that silently does not apply,"* this run targeted axes never swept at all.

| Category | Result |
|---|---|
| **Icons** | Pass. No non-Heroicon icons. (Reports' 9 non-Heroicon SVGs are `recharts-surface` chart elements — data-viz, not icons.) |
| **Buttons** | **1 defect found and fixed** — see Finding 1. Sizing/height drift from Runs 64–65 re-measured and holding. |
| **Toolbars / Headers** | Pass. Consistent across pages. |
| **Sidebar / Nav** | Pass. 3 collapsible groups (Jobs / Finance / Operations) expand correctly; 17 nav-links resolve. |
| **Forms** | Pass. 0 native `<select>`, 0 native `input[type=date]` app-wide. `.form-input` used throughout, including in the Calendar and Canvassing flows tested this run. |
| **Spacing** | Pass. No new alignment defects. |
| **Modals** | Pass. Consistent; validation gating correct on the modals exercised. |
| **NEW — stateful styling (`:disabled`)** | **1 defect found and fixed.** 34 button sites carry both a `disabled` predicate and an inline opacity predicate; all 34 were parsed and compared. |
| **NEW — Tailwind vs. app-CSS cascade collisions** | Pass, 0 defects. 238 elements carry a utility class, 106 mix an app class with a Tailwind utility; no collision is harmful because `.glass` declares only background / backdrop-filter / border / position, which the paired utilities do not contest. |
| **NEW — status badge / empty-state consistency** | Variance observed, out of charter — see Known Issues. |

### Finding 1 — Estimate Builder "Send for Signing" (FIXED, `e1a7657`)

The button's dim state and its real disabled state keyed off **unrelated predicates**, so it was wrong in *both* directions:

```
disabled={saving || sending}            <- the real gate
opacity: !form.customer_email ? .5 : 1  <- an unrelated predicate
```

With no customer email it rendered at opacity 0.5 — the app's exact disabled treatment — with a tooltip saying you could not use it, yet `disabled=false`, `pointer-events:auto`, `cursor:pointer`. **Clicking it opened the Send modal.** Conversely, while saving or sending it was genuinely disabled, but the inline `opacity:1` overrode the global `button:disabled` rule, so it looked fully enabled.

Dimming on `customer_email` was not merely inconsistent, it was wrong: the modal it opens states recipients may come from the Authorization section instead, and the real guard already lives there (`disabled={sending || recipients.length === 0}`). The outer button was discouraging a supported workflow. The fix deletes the inline opacity so the app-wide rule governs — one deletion leaves no second predicate to drift.

**Verified live after:** email empty → `disabled=false`, opacity 1, identical to its two enabled siblings; forced disabled → 0.5 + `not-allowed` + `pointer-events:none`.

### Verified and dismissed (do not re-file)

- **`ImportLeadsModal.jsx:310`** looked like Finding 1's twin. Textually different, **logically equivalent** — `!columnMapping.address` implies `validRows.length===0`, so the two predicates can never disagree.
- **`!gap-0` / `!overflow-hidden` / `!text-right`** use Tailwind's v3-style *leading* `!`, and Tailwind 4.2.2 moved it to a suffix — this looked exactly like dead CSS. The **built stylesheet was checked**: v4.2.2 still emits the escaped-prefix selectors with `!important`. Not a bug.
- **4 disabled-state mismatches dismissed** because the state is communicated through another visual channel (background colour change, a "Switching…" label, `cursor: not-allowed`).
- **`MaterialsView.jsx:703`** — the `cart.length===0` clause is unreachable; the whole footer is wrapped in `{cart.length > 0 && …}`. Dead condition, not visible.
- **`className="row-actions"`** is styled by a component-local `<style>` block in the same file.

---

## Bugs Fixed

1. **`GET /api/leads`, `/api/crm/leads`, `/api/crm/dashboard/properties-affected/list`, `/api/crm/subcontractors`, `/api/materials/orders`** — ten hard 500s from `?limit=-1`, `?offset=-5` and NUL bytes in `stage`; negative values parse as valid integers so the existing NaN guard let them through — mapped Postgres `2201W`/`2201X`/`22021` into the existing `PG_BAD_INPUT_CODES` set in `errorHandler.js`, fixing all five route files at once. (`a2edcdb`)
2. **`PATCH /api/crm/financing/lenders/:id`** — hard 500 on any array/object/number/boolean `apiKey`, because the value went straight into `cipher.update(plaintext,'utf8')` — added a type guard returning 400. (`e9c5024`)
3. **`POST /api/crm/leads/:id/contacts` (and every varchar column app-wide)** — a 26-character phone into `varchar(20)` returned a hard 500; **reachable from the Add Contact UI** — mapped Postgres `22001` into `PG_BAD_INPUT_CODES` with a sanitized message that does not leak the column width. (`6127783`)
4. **Dashboard → Pipeline funnel** — clicking any of the 14 stage rows sent the display label instead of the stage key, producing a 400, "0 leads", and a chip reading `Stage: undefined` — pass `row.key` instead of `row.stage`. (`04ccf30`)
5. **Estimate Builder → "Send for Signing"** — rendered at the app's disabled opacity while fully clickable, and rendered fully enabled while genuinely disabled — deleted the unrelated inline opacity predicate so the app-wide `button:disabled` rule governs. (`e1a7657`)
6. **`GET /api/crm/leads?stage=…`** — 6 of the 14 funnel stages 400'd because `DEFAULT_PIPELINE_STAGES` advertises 14 keys but the `lead_stage` enum holds 10 — filter on `stage::text` so an unknown key matches nothing instead of throwing; write-path validation untouched. (`77ae9a2`)
7. **Estimates KPI cards** — the four derived cards counted only the fetched page of 50 while the "Total Estimates" card beside them used the server count, so the page showed **0 Accepted / $0.0K** against a real accepted $4,500 estimate — server-side roll-ups added to the existing COUNT query. (`626c7cd`)

---

## Known Issues (Not Fixed)

### 1. `POST /api/crm/custom-fields` — hard 500 on a non-string `field_label` — **NEW, OPEN**

Found by Axis D pass 2 (4,448 requests) and **re-verified live against current HEAD at report time**:

```
POST /api/crm/custom-fields {"field_label":[1,2]}   -> 500 Internal server error
POST /api/crm/custom-fields {"field_label":123}     -> 500
POST /api/crm/custom-fields {"field_label":true}    -> 500
POST /api/crm/custom-fields {"field_label":{"a":1}} -> 500
CONTROL: {} (missing field_label)                   -> 400 "field_label is required"  (correct)
```

**Root cause:** `crm.js:1104` guards only for *falsy*, so any truthy non-string passes; `crm.js:1108` then calls `field_label.toLowerCase()` to auto-generate `field_key`, which throws `TypeError`. **The fix is a one-line type guard** beside the existing required-check — mechanical, but it is a new defect found after the verification stage closed, so it gets its own change and its own verification rather than being appended untested. Not reachable from the UI (the form always sends a string), and no rows are written, since the throw precedes the INSERT.

### 2. Six pipeline stages are not in the `lead_stage` enum — **developer decision required**

`77ae9a2` stopped the 400s, but the underlying question is a product call: `material_ordered`, `scheduled`, `completed`, `invoiced`, `paid` and `collections` render as funnel rows yet can never hold a lead. `authService.DEFAULT_PIPELINE_STAGES` — the list actually seeded into `pipeline_stages` — has the same gap on `completed`, so this is not specific to the fallback list. Expanding the enum is the product fix, but **`ALTER TYPE … ADD VALUE` cannot be rolled back in Postgres**, so an irreversible production schema change is not QA's call. **Do these six stages belong in the pipeline or not?**

### 3. Environment — the `:3001` dev server is three days stale — **developer action required**

`:3001` is still PID **33112**, started **7/30 05:47**, running as `node server/src/index.js` with **no watcher**. `client/vite.config.js` proxies `/api` to it, so **every live UI check this run ran against a July-30 API.** Client-only fixes are unaffected, but no stage exercised this run's API fixes through the real UI. Proof of the delta, same request against both ports:

| Request | `:3001` | fresh instance |
|---|---|---|
| `GET /api/leads?limit=-1` | 500 | 400 |
| `GET /api/crm/subcontractors?offset=-5` | 500 | 400 |
| `PATCH /crm/financing/lenders/:id {apiKey:[1]}` | 500 | 400 |

A `node --watch` server (PID 18928) now exists but cannot bind `:3001` because 33112 holds it. **Kill PID 33112.** QA did not kill it.

> s4 flipped the vite proxy to a temporary port to verify a fix and did not restore it. **`client/vite.config.js` has been restored to `:3001` in this session** — it is clean as of this report.

### 4. Carried, unchanged from prior runs

- **Estimate Builder currency formatting** — `EstimatesView.jsx:2118` uses `toLocaleString` (`$2,500.00`) while `:2258` uses `toFixed(2)` (`$2500.00`) for the same subtotal, both visible at once. Values correct; formatting-convention refactor is out of QA charter.
- **Cart badge vs. footer count** — `MaterialsView.jsx:103` sums quantities, `:700` counts lines. Both defensible; a labelling call.
- **Status-pill variance** — the app has ~5 pill treatments, not one convention plus one outlier. Normalizing is a per-context refactor, ruled out of charter in Run 65.
- **Token hygiene** — 6 sites use literal `borderRadius:'999px'` where `--radius-pill` exists; 10 sites use rem font sizes against 1,465 px ones. Visually equivalent; not a defect.
- **Pagination disabled dim** — `LeadList` uses inline opacity 0.4 vs. the app-wide 0.5. Measured live. Does not contradict anything; 0.4 is used by 7 sites as "nothing to act on".
- **Esc-to-close keyboard nav** and **EstimateBuilder at 375px** — enhancement and paused-mobile respectively.

### 5. Recurring — QA rows become visible in the live app

Write-path harnesses leave rows that users can see. **Cleaned this run: 11 stale rows** — 4 subcontractors and 4 estimate_templates with names like `12345` / `true` / `{"x","y"}`; 2 leftover `QA Territory` rows visible in the live Territories panel; 1 control contact. Net DB writes by the verification stage: **0**. This recurs every run the write harnesses execute and needs to stay on the checklist.

---

## Test Coverage Gaps

1. **`POST /api/crm/custom-fields` fix** — highest-value item, defect confirmed live, one-line fix, needs its own verification pass.
2. **Axis D pass 2 triage is incomplete.** 4,448 requests ran and 4 failures were captured, but s1 hit its turn cap before triaging the 255 *accepted* shapes — cases where a wrong type was stored rather than rejected (e.g. `POST /api/crm/automations` accepting an object, a number and a boolean as a name, all 201). Those are not crashes, but no one has asked whether the stored value is sane. **This is the largest untriaged evidence set in the pipeline.**
3. **Storm Map, Admin, and roof drawing** remain render-depth only — no end-to-end workflow has ever been exercised.
4. **Keyboard navigation** — Esc, Tab order, focus rings, Enter-submit — still untested app-wide.
5. **Axes A and B were not re-run** (auth enforcement, tenant isolation). They passed in Run 65 and routes have not drifted, but the Run-65 tenant-isolation sweep was static; a live cross-tenant IDOR probe has never run.
6. **The `.qa-*.mjs` route harnesses were not re-run** — correct, the drift gate was empty. **Drift baseline for next run: `626c7cd`.**
7. **Phone-375px sweep** not revisited. Mobile paused, low priority.
8. **Permanently excluded** — Google-geocoding paths (standing cost rule) and side-effecting routes (real email, Stripe, paid Tracerfy, bulk Neon writes, storm ingestion, admin cross-tenant mutation). Enumerated above, not silently capped.

---

## Session Integrity

| Stage | Outcome | Turns | Cost | Result file |
|---|---|---|---|---|
| s1 api-test | **MAX_TURNS (50)** | 51 | $4.44 | JSON artifacts only — `api-test-results.txt` **not written** |
| s2 frontend-test | **MAX_TURNS (80)** | 81 | $7.63 | written incrementally, survived |
| s3 ui-audit | **MAX_TURNS (60)** | 61 | $7.06 | written incrementally, survived |
| s4 verify | **MAX_TURNS (40)** | 41 | $4.10 | written incrementally, survived |
| s5 report | this report | — | — | — |

Stage spend ≈ **$23.24**. Turn caps remain the binding constraint for the **sixth consecutive run**.

**Infra note — one regression against Run 65.** s2, s3 and s4 all wrote incrementally and survived. **s1 did not write `C:\tmp\api-test-results.txt` at all** — that file is still Run 65's, dated Aug 1. s1's evidence survived only because its harnesses dumped JSON (`qa-r66-axisD.json`, `qa-r66-axisD-pass2.json`, `write-validation-raw.json`, `qa-r66-repro.sh`), which this report was reconstructed from. **s1 must write its .txt incrementally like the other three stages.**

**s4 left work uncommitted at its cap.** Its first session died mid-edit with two files modified — the server half of the estimates KPI fix written, the client half not, leaving `stats` set into state and never read. A continuation session completed, verified and committed it as `626c7cd`. Worth recording, because an unfinished fix sitting in the working tree is more dangerous than no fix.

### Tester-error gotchas recorded this run

- **Never assert an animatable computed property in the same tick as a state change.** `.quick-action-btn` carries `transition: opacity .1s`, so `getComputedStyle` returns the *pre-transition* value. This nearly produced a false finding in s3 and a false negative in s4 — in both cases a disabled button read `opacity: 1`, looking exactly like "the global disabled rule does not apply to this class." It does. Wait a frame. `cursor` and `pointer-events` are not animatable and flip immediately, which is what exposed the error.
- **FullCalendar's `dateClick` does not fire on a synthetic `element.click()`.** It needs a real pointer event. A synthetic click returns 0 overlays and looks exactly like "the UI says click a date and nothing happens." Not a bug. Cost 3 turns.
- **Each fresh server instance has its own in-memory JWT secret** — a token minted against one port 401s against another. Mint per instance.
- **Canvassing's `main.innerText` matches `/error/`** only because of Google's own "Report a map error" attribution link. Not an app error.

### Lesson

Run 62's rule held for the fifth run running: **convergence counters measure where we have looked, not where the bugs are.** The drift gate was empty, the 272-route harnesses had passed, and the backend had been "converged" for 23 runs — and the first execution of a never-run axis produced 6 hard 500s immediately, with 4 more behind them.

The second theme is sharper this run: **two of the seven fixes were bugs that only appear when you click.** The Dashboard renders perfectly and its funnel counts are correct; only clicking a row exposed the label/key drift, and only clicking *all fourteen* rows exposed the enum gap beneath it. A render-depth sweep passes both. The estimates KPI bug is the same shape in data — the numbers are internally consistent and plausible, and wrong; visible only by comparing them against the database.
