# StormLeads — Overnight QA Report

**Date:** 2026-07-30 (Run 62)
**Branch:** `feat/financing` · **HEAD at start:** `2f7f014` → **HEAD now:** `27af095`
**Code baseline:** `e5c4c89` (2026-07-29) — the converged reference the drift gate measures against
**Stages run:** s1 api-test · s2 frontend-test · s3 ui-audit · s4 verify · s5 report (this document)

---

## QA Test Summary

| Metric | Count |
|---|---|
| App routes swept live | **12** (`route-sweep.json`) |
| Settings tabs walked | **15 of 15** — the #1 carried gap, now **CLOSED** |
| Settings inline forms opened and field-inspected | **6** |
| API endpoints inventoried | **272** across 36 route modules / 36 mount prefixes |
| Functional bugs found | **3** |
| Functional bugs fixed | **3** |
| UI inconsistencies found | **3 sites** |
| UI inconsistencies fixed | **3 sites** |
| Code commits (fixes) | **4** — `9cc9562`, `8278871`, `966cd81`, `27af095` |
| Final build | **exit 0**, 8.14s, 0 errors |

**Verdict: the streak is broken. After 21 consecutive 0-fix backend runs and 18 near-silent UI audits, this run found and fixed 3 real functional bugs — including a hard crash — plus 3 UI deviations.**

The headline is **`27af095`: the Subcontractors add/edit slide-over threw a `ReferenceError` and crashed on open.** `XMarkIcon` was rendered at `SubcontractorsView.jsx:263` but never imported. Verified against the pre-fix blob — the usage existed with no matching import, so every open of that panel took down the view. This is the most severe defect found in the last several runs, and it sat in a code path no prior audit had opened.

> **Lesson to carry forward, confirming last run's:** convergence counters measure *where we have looked*, not *where the bugs are*. Leading with the carried gap — Settings, then the views reachable from it — is what surfaced all four fixes.

### Read this before trusting any artifact

**All four working stages (s1–s4) died on `max_turns`, and none wrote a results file.**

| Path | Date | Status |
|---|---|---|
| `C:\tmp\api-test-results.txt` | Jul 29 | **STALE** — describes Run 61, not this run |
| `C:\tmp\frontend-test-results.txt` | Jul 25 | **STALE** |
| `C:\tmp\ui-audit-results.txt` | Jul 29 | **STALE** |
| `C:\tmp\verify-results.txt` | Jul 26 | **STALE** |

This report is reconstructed from artifacts the stages *did* leave on disk, all timestamped Jul 30:
`C:\tmp\route-inventory.txt` (272 endpoints), `route-sweep.json`, `settings-tabs-sweep.json`,
`settings-ui-sweep.json`, `settings-interactions.json`, `settings-inline-forms.json`,
six `server/.qa-*.mjs` harnesses, three verification screenshots, and the four commit diffs.

**Drift gate vs baseline `e5c4c89` — non-empty by exactly this run's 5 files, all `M` (modified), 0 new:**
```
client/src/components/AutomationSettings.jsx | 6 ++----
client/src/components/SettingsView.jsx       | 8 +++-----
client/src/components/SubcontractorsView.jsx | 2 +-
server/src/routes/auth.js                    | 3 +++
server/src/routes/roofMeasurement.js         | 3 +++
5 files changed, 12 insertions(+), 10 deletions(-)
```
No new route, page, or component files; no dependency or build-config change. **Next run's baseline is `27af095`.**

---

## Backend API Test Results

**Inventory (fresh this run, `C:\tmp\route-inventory.txt`):** 272 endpoints across 36 route modules and 36 mount prefixes — 132 GET · 88 POST · 26 PATCH · 18 DELETE · 8 PUT.

Largest surfaces: `/api/properties` (18), `/api/estimates` (17), `/api/crm/dashboard` (15), `/api/crm/leads` (14), `/api/crm/financing` (13), `/api/crm/contracts` (13), `/api/crm/work-orders` (12), `/api/skip-trace` (10).

s1 built a four-part harness rather than a flat GET sweep, deliberately targeting the **write paths** that 21 prior GET-heavy runs had left thin:

| Harness | Scope |
|---|---|
| `.qa-inventory.mjs` | Static extraction of all 272 routes → `route-inventory.json` |
| `.qa-write-validation.mjs` | Empty-body + bad-id probe of **every** write route; asserts 4xx, never 5xx |
| `.qa-crud-lifecycle.mjs` | create → read back → update → delete → verify-gone, with a cleanup stack |
| `.qa-crud-part2.mjs` | Re-run of 3 cases that first failed on **tester-supplied** bad enums, not defects |
| `.qa-subactions.mjs` | Sub-actions: create-from / convert / enroll / assign / toggle / token |

The validation harness explicitly **skips and lists** 13 classes of side-effecting route rather than silently capping — real email sends, Stripe money movement, paid Tracerfy skip-trace, bulk Neon writes, geocoding, storm ingestion, and admin cross-tenant mutation. No silent truncation.

### Bugs found and fixed

| Endpoint | Category | Symptom | Fix |
|---|---|---|---|
| `PUT /api/roof-measurement/config` | Validation | A missing `roof_measurement_enabled` flag was accepted and written as `NULL` instead of rejected | `9cc9562` |
| `PATCH /api/auth/me` | Error handling | A duplicate email raised unhandled PG `23505` → **500** | `8278871` |

**`9cc9562`** — the sibling route `PUT /api/skip-trace/config` writes the `enabled` column of the *same* table via the *same* upsert idiom and already guarded with a 400. The fix applies that exact guard, so the two routes now behave identically.

**`8278871`** — three lines mapping PG unique-violation `23505` to a **409** with a usable message, instead of letting it fall through to the generic 500 handler.

### Re-verification at report time

The s4 verify stage died before it could confirm these. I re-ran `server/.qa-s4-verify-api.mjs` against the live server (`:3001`) while writing this report:

```
14/14 passed, 0 failed
```

Covering: `{}` / no-body / `{bogus:1}` → 400; explicit `null` → 200 (correctly distinguished from `undefined`); `true` and `false` → 200 and both read back correctly; no-auth → 401; **skip-trace sibling guard still intact at 400**; duplicate email → **409 not 500**; email unchanged after the failed PATCH; own current email → 200 (**no false 409 on self**); no-auth → 401. Original config value captured and restored.

**Not recoverable:** the full per-endpoint pass/fail totals from the s1 harness runs. The harnesses print results to stdout and s1 was killed by the turn cap before persisting them. The harnesses are committed to disk and re-runnable.

---

## Frontend Feature Test Results

### Route sweep — 12 routes, all rendering

From `route-sweep.json`. Every route returned `blank: false`, `errorish: false`.

| Route | Evidence of real render |
|---|---|
| `/storm-catalog` | 200 storms found, 14 buttons, filter + sort controls |
| `/estimates` | 83 estimates, 50 rows, 156 buttons, stat cards |
| `/contracts` | 6 contracts, 6 rows, 24 buttons |
| `/work-orders` | 17 work orders, 3 buttons, from-estimate action |
| `/materials` | SRS catalog, 153 buttons, category nav |
| `/invoices` | $44.8k invoiced / $30.3k collected, 17 rows, AR aging |
| `/expenses` | $920 total, 4 rows, category + date filters |
| `/tasks` | 24 pending / 6 completed, 27 buttons |
| `/calendar` | July 2026 grid, Month/Week/Day/List views |
| `/canvassing` | Google map, pin stats, Drop Pin |
| `/subcontractors` | 65 total, 25 rows, 56 buttons |
| `/reports` | 9 chart surfaces, 4 rows, date range + CSV |

### Settings — 15 of 15 tabs (the carried #1 gap, now closed)

Last run enumerated the tabs and hit its cap before walking them. This run walked all 15: Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications, Email / SMTP, Financing, Automations, Drip Sequences, Custom Fields, Pricing / Line Items, Contracts, Reviews.

Every tab rendered non-empty. **0 native `<select>` and 0 native `<input type="date">` across all 15** — `CustomSelect` and `DatePicker` conventions hold.

Six inline forms were opened and their fields inspected (`settings-inline-forms.json`) — all revealed the expected inputs:

| Tab | Trigger | Fields revealed |
|---|---|---|
| Profile | Edit Profile | text, text, email |
| Team | Add Member | text, text, email, password (min 8) |
| Custom Fields | + Add Field | label, auto-generated key |
| Contracts | + Create Template | name, section title, section content (merge fields) |
| Automations | + New Automation | rule name, task title, days |
| Drip Sequences | + New Sequence | name, number, email subject, email body |

**Tester error, not a defect:** the first probe (`settings-interactions.json`) reported `opened: false` for all six, because it only looked for `.modal` / `.slide-over`. These are **inline forms** rendered in place — the corrected probe confirmed all six open properly. Likewise `Create Automation` was logged `FOUND: false` when the button is labelled `+ New Automation`. Both were label/selector mismatches in the harness.

### Bug found and fixed

**`27af095` — Subcontractors add/edit slide-over crashed on open.**
`XMarkIcon` was rendered at `SubcontractorsView.jsx:263` but omitted from the `@heroicons/react/24/outline` import at line 5. Confirmed against the pre-fix blob: the JSX usage existed with no import, so opening "+ Add Subcontractor" or any row's edit action threw a `ReferenceError` and took down the view. One-word import fix; verified live (`subcontractor-slideover-fixed.png`, `s4-verify-subcontractor-add.png`).

### Still needs attention

Browser back/forward behaviour remains untested — carried for the third consecutive run.

---

## UI Consistency Audit Results

Scope this run was Settings' 15 tabs at element level (`settings-ui-sweep.json`) plus the 12 swept routes.

| Category | Result |
|---|---|
| **Icons** | **PASS.** `nonHero: 0` on all 15 Settings tabs. 21 Heroicons rendered across Billing (13), Team (4), Payments (3), Storm Alerts (1); no solid variants, no foreign libraries, no inline SVGs used as icons. |
| **Buttons** | **3 deviations found, all fixed** (`966cd81`). Two one-off inline-styled buttons bypassed the standard class. |
| **Toolbars / Headers** | **PASS.** All 15 tabs render the same 15-item tab strip with identical active-tab styling (`padding: 8px 12px; border-radius: var(--radius-sm)`). |
| **Sidebar / Nav** | **PASS.** No deviation observed across the 12 swept routes. |
| **Forms** | **PASS.** 0 native `<select>`, 0 native date inputs across all 15 tabs. Label variants consistent (1 variant per tab that has labels). |
| **Spacing** | **1 deviation found and fixed** — a hardcoded panel radius. |
| **Modals** | **PASS** within scope. Settings uses inline forms rather than modals; no `.modal-backdrop` is expected or required there. |

### UI fixes — `966cd81`

1. **`AutomationSettings.jsx:150`** — "+ New Automation" carried an 8-property inline style block (`padding: 8px 18px`, own radius, own background, own font weight) instead of the shared `.auth-btn` class. Replaced with `className="auth-btn"` + `flexShrink: 0`.
2. **`SettingsView.jsx:2102`** — "+ Add Field" in `CustomFieldsTab` had the same problem with *different* padding (`6px 16px`), so the two buttons did not even match each other. Replaced with `className="auth-btn"`.
3. **`SettingsView.jsx:2726`** — `PricingTab`'s glass panel used a literal `borderRadius: '20px / 18px'` instead of the design token. Replaced with `var(--radius-lg)`.

All three are the same underlying problem: element-level styling that drifted from the design system because it was written inline instead of using the shared class or token.

---

## Bugs Fixed

1. **`PUT /api/roof-measurement/config`** — a missing `roof_measurement_enabled` flag was accepted and persisted as `NULL` rather than rejected — added the same `=== undefined` → 400 guard the sibling `PUT /api/skip-trace/config` already used, so the two routes writing the same column now behave identically. `9cc9562`
2. **`PATCH /api/auth/me`** — submitting an email already used by a teammate raised an unhandled PostgreSQL `23505` unique violation and returned **500** — mapped `err.code === '23505'` to **409** with an actionable message. `8278871`
3. **Subcontractors — add/edit slide-over** — rendered `XMarkIcon` at line 263 without importing it, throwing a `ReferenceError` that crashed the view every time the panel opened — added `XMarkIcon` to the existing Heroicons import. `27af095`
4. **Settings — Automations / Custom Fields / Pricing** *(UI consistency)* — two action buttons used mismatched one-off inline styles instead of `.auth-btn`, and one glass panel hardcoded `20px / 18px` instead of `var(--radius-lg)` — replaced all three with the shared class and token. `966cd81`

---

## Known Issues (Not Fixed)

- **Estimate Builder currency formatting inconsistent** *(carried, developer decision)* — `EstimatesView.jsx:2118` renders Subtotal via `toLocaleString` → `$2,500.00`; `EstimatesView.jsx:2258` renders **the same `subtotal`** via `toFixed(2)` → `$2500.00`, both visible at once. Values are correct; only the thousands separator differs. `toFixed(2)` dominates the file (18 uses vs 7). Standardizing is a formatting-convention refactor the charter forbids. **Recommend `toLocaleString` for user-facing money.**
- **Panel radius convention split** *(carried)* — literal `20px / 18px` vs `var(--radius-xl)`, ~2px delta. This run fixed the one instance inside its audit scope (`966cd81`); the broader split remains a design-system change, out of charter.
- **Esc-to-close absent on most modals** *(carried)* — needs a shared hook; an enhancement, not a QA bug.
- **EstimateBuilder does not collapse at 375px** *(carried, pre-existing)* — fixed 280px sidebar in `overflow:hidden` at `EstimatesView.jsx:1838`. Fine at 768px+; mobile paused.
- **`DELETE /api/crm/tasks/:id` handler missing** — adding endpoints is forbidden by charter.
- **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — no rate-limit or concurrency guard; needs staging, not production Neon.
- **skip-trace 503** — intentional, no `TRACERFY_API_KEY` set. Env state, not a bug.
- **`/content-studio` not implemented** — no such route; the catch-all redirects to `/` gracefully. Planned future feature.
- **Deliberately NOT changed:** the modal z-index spread (200/300/400/1000/9999/99998) is **functional stacking order** for nested overlays — normalizing it risks real layering regressions.

---

## Test Coverage Gaps

- **Per-endpoint API pass/fail totals were not persisted.** s1 built and ran five harnesses covering all 272 routes but was killed by its 50-turn cap before writing `api-test-results.txt`. The harnesses survive on disk and are re-runnable — **re-run them first next session**; that is the cheapest large coverage win available.
- **Browser back/forward** — untested for the third consecutive run. s4 died before reaching it.
- **The 12-route sweep is a render check, not a walkthrough.** It confirms each route mounts with real data and no error state; it does not exercise per-page workflows. Only Settings was walked at interaction depth this run.
- **Keyboard navigation** — Esc, Tab order, focus rings, Enter-submit still untested app-wide.
- **Phone-375px sweep** — not revisited this run. Mobile paused, low priority.
- **Google-geocoding paths permanently excluded** — storm-map address search and any bulk geocode, per the standing cost rule.
- **Side-effecting routes intentionally excluded** — real email, Stripe, paid Tracerfy, bulk Neon writes, storm ingestion, admin cross-tenant mutation. Listed explicitly by the validation harness rather than silently skipped.

---

## Session Integrity

**All four working stages exited on `max_turns`.** Each completed substantive work and committed it before stopping; none left a broken state.

| Stage | Outcome | Turns | Cost | Result |
|---|---|---|---|---|
| s1 api-test | **MAX_TURNS (50)** | 51 | $6.45 | 272-route inventory; 5 harnesses built; **2 API bugs fixed** (`9cc9562`, `8278871`) |
| s2 frontend-test | **MAX_TURNS (80)** | 81 | $7.31 | 12 routes swept; **Settings' 15 tabs walked — carried gap closed**; 6 inline forms verified |
| s3 ui-audit | **MAX_TURNS (60)** | 61 | $5.99 | Settings element-level audit; **3 UI deviations fixed** (`966cd81`) |
| s4 verify | **MAX_TURNS (40)** | 41 | $3.21 | **Subcontractors crash found and fixed** (`27af095`); screenshot-verified |
| s5 report | this document | — | — | Re-verified both API fixes live (**14/14**); final build **exit 0, 8.14s** |

Stage spend s1–s4 ≈ **$22.97**.

**Recurring infrastructure problem:** four of four stages hit their turn cap, and four of four failed to persist a results file — the same failure mode as Run 61, where two of four did. The caps are the binding constraint on this pipeline, and results files are being written last, so they are the first thing lost. **Recommendation: have each stage write its results file incrementally as it goes, not as a final step.** That single change would have preserved tonight's full API pass/fail matrix.

Final build re-run at report time: **exit 0, built in 8.14s, 0 errors.** Chunk-size advisories only (mapbox-gl 1703.49 kB, index 592.75 kB, ReportsView 490.59 kB) — unchanged from prior runs.
