# Overnight QA Report — 2026-06-05 (Run 41)

Branch: `feat/financing`  ·  Baseline: `11458bd` (`overnight-checkpoint-20260605`)  ·  Final HEAD: `5f108be`

## QA Test Summary

| Metric | Count |
|---|---|
| Backend API probes executed | **252** (118 GET + 36 POST + 11 edge + 38 Hearth/financing + 49 PATCH/PUT/DELETE) |
| Frontend pages exercised (UI consistency audit) | 17 routes (header axis) / 14 routes (form + spacing axes) |
| Bugs found | 2 (both backend — Hearth webhook 400 leaks JS error, financing 500 on unknown provider) |
| Bugs fixed | 2 (`bc9214f`, `5f108be`) |
| Unintentional 5xx during sweep | 0 (**22nd consecutive zero-5xx API sweep**) |
| Carry-overs closed | 1 (#5 Hearth webhook — final piece) |
| UI consistency findings (cosmetic) | 2 (`/alerts` page raw inputs missing `.form-input`, `/reports`+`/settings` use 16 px radius vs. 20 px elsewhere) |
| UI consistency findings fixed | 0 (held — no functional regression, design-decision territory) |
| Commits landed | 2 (`bc9214f`, `5f108be`) |
| Files modified by commits | 2 (`server/src/services/financing/index.js`, `server/src/services/financing/providers/index.js`) |
| New reusable probe scripts | 2 (`.qa-hearth-fin.mjs`, `.qa-patch-delete-probe.mjs`) |

## Backend API Test Results

Stage 1 (`claude-overnight-20260605-s1-api-test.json`) was the only session that exited cleanly (`end_turn`, 49 turns, $3.39). It landed both fixes, expanded the standing probe suite by two scripts, and finished with zero unintentional 5xx across **252 probes**.

| Suite | Probes | 5xx at baseline | 5xx now | Notes |
|---|---:|---:|---:|---|
| `.qa-api-probe.mjs` (GET sweep) | 118 | 0 | 0 | Single intentional 503 on `/api/skip-trace/*` (`TRACERFY_API_KEY` unset — by design) |
| `.qa-api-write-probe.mjs` (POST empty-body) | 36 | 0 | 0 | No regressions vs. Run 40 baseline |
| `.qa-api-edge-probe.mjs` (malformed JSON, SQLi, oversize) | 11 | 0 | 0 | No regressions |
| `.qa-hearth-fin.mjs` (NEW — Hearth + financing) | 38 | 2 | 0 | Both 5xx closed this run — see fixes below |
| `.qa-patch-delete-probe.mjs` (NEW — PATCH/PUT/DELETE) | 49 | 0 | 0 | First systematic coverage of mutating verbs with empty bodies + zero-UUID path params |
| **Total** | **252** | **2** | **0** | |

### Endpoint categories covered this run

- **Auth** — `GET /api/auth/me` (200), token mint flow used by all probes.
- **Admin** — `/api/admin/{overview,tenants,revenue,usage}` — 403 (correct, tenant-admin not platform-admin).
- **CRM core** — `/api/crm/{leads,tasks,activities,canvass-pins,automations,documents}` GET + write probes — all clean.
- **Estimates / Invoices / Contracts / Work-orders / Expenses / Materials / Subcontractors** — list + ID probes, PATCH/DELETE on zero-UUIDs — all return 4xx not 5xx.
- **Financing (public)** — `/api/financing/public/{plans,apps,apply}` with bad tokens, missing/bad `planId`, malformed JSON — all clean (404/400 as appropriate).
- **Financing (authenticated)** — `/api/crm/financing/{lenders,plans,applications}` list + create + PATCH + DELETE + sync — all clean after `5f108be` lands.
- **Hearth webhook** — `/api/webhooks/hearth` with empty / null / non-JSON / array / huge / missing-fields / bad-signature payloads — all clean after `bc9214f` lands.
- **Alerts / Notifications / Search / Storms** — GET sweep clean.
- **Pagination clamping** (`dcc904c` from Run 35) re-verified — `?limit=-1` and `?offset=-N` still 200.
- **Tenant isolation** — not re-run this sweep; `.qa-api-tenant-isolation-probe.mjs` from Run 38 last passed cleanly with no surface changes since.

### What was fixed (with commit hash)

- **`bc9214f`** — `server/src/services/financing/index.js` (+12/−6) — Closes Carry-over #5 in full. The Hearth webhook handler called `req.body.toString('utf8')` on the assumption `body-parser`'s `raw()` always produced a `Buffer`. When no body was sent (or the content-type was wrong), `req.body` was `undefined` or `{}` and the call threw `TypeError: Cannot read properties of undefined (reading 'toString')` — which the global handler surfaced as a `400` with the JS error verbatim. Now guards with `Buffer.isBuffer(req.body)` before the `toString`, returns `{error:'Missing or invalid request body'}` otherwise. The catch block also stopped leaking `err.message` (was: `400 "Cannot read properties of undefined…"` — now: generic `"Webhook processing failed"`), so signature-verification failures and parse failures no longer tell attackers *why* the body was rejected. The permissive happy path (`{status:'ignored', reason:...}`) still returns informative reasons for legitimate-but-non-actionable bodies (null JSON, missing `application_id`, etc.).
- **`5f108be`** — `server/src/services/financing/providers/index.js` (+1/−0) — `POST /api/crm/financing/lenders` with `provider:'fake'` returned a bare `500 "Internal server error"`. Root cause: `getAdapter('fake')` threw a plain `Error('Unknown financing provider: fake')` with no `status` property, so the global handler defaulted to 500. Added `err.status = 400` to the throw so this user-input validation error surfaces as a 400 with a clear message. Service-layer fix — all three callers benefit (`connectLender`, `syncPlans`, `handleWebhook`).

## Frontend Feature Test Results

Stage 2 (`claude-overnight-20260605-s2-frontend-test.json`) hit `error_max_turns` at turn 81/80 ($4.14). No commits landed; transcript not preserved beyond the stage JSON. Screenshots were saved during the run.

| Page | Probe | Outcome | Evidence |
|---|---|---|---|
| `/` (Dashboard) | Load + visual screenshot | Rendered, all tiles present | `qa-run42-01-dashboard.png` (450 KB) |
| `/settings` → Financing tab | Tab load | Rendered with empty state | `qa-run42-02-financing.png` (498 KB), `qa-run42-financing-tab.png` (434 KB) |
| `/settings` → Financing → Connect Lender modal | Modal open | Rendered with provider/key/merchant-id fields | `qa-run42-03-financing-connected.png` (426 KB) |
| `/leads` → Import Leads modal | Modal open | Rendered at 20 px radius (Run 40 fix `5526fa2` holds) | `qa-run42-04-import-modal.png` (171 KB) |

The naming on the saved screenshots is `qa-run42-*` despite this being Run 41 — an agent-side labeling slip, not duplicate work. Date stamps (all Jun 5, 05:09–05:24) confirm these are this run's artifacts.

**Browser write-flow walk on the new financing UI did not complete** before the stage timed out. The Connect Lender modal was opened (screenshot present) but no submission was recorded. The Plan Sync button and the applications list were not exercised. These remain the highest-value targets for Run 42.

## UI Consistency Audit Results

Stage 3 (`claude-overnight-20260605-s3-ui-audit.json`) hit `error_max_turns` at turn 61/60 ($4.64). It did produce four reusable audit artifacts before timing out:

### Audit 1 — Buttons (`button-audit.json`)

1,059+ button snapshots across all 17 routes, grouped by `{height, padding, border-radius, font-size, font-weight, background}`. **No new defects flagged** — primary action button (h=36, p=`0 16px`, r=12, fs=13) is dominant on every page; sidebar nav-link uniform (h=42, br=12); pipeline column action chips internally uniform. Dashboard shows 10 unique shapes which is the expected variety (filter chip, stat-card icon button, "View All" link, segmented "7 Days / 30 Days" range, etc.) — same shape inventory as Run 40.

### Audit 2 — Headers (`header-audit.json`)

17 routes audited. **All pass.**
- TopBar (`<header class="topbar glass">`) uniform across every route: height **56 px**, padding `0 32px`.
- Page H1 uniform across every route: **18 px / weight 700 / `oklch(0.95 0.005 260)`**.
- Per-page sub-toolbars present on `/leads` (`lead-list-toolbar glass`, 110 px) and `/calendar` (FullCalendar's own `fc-header-toolbar`) — both expected.
- `/storm-catalog` correctly renders H1 as `"Storm Archive"` (content choice, not a bug).

### Audit 3 — Forms (`form-audit.json`)

14 routes audited.

| Page | Native `<select>` | Native date inputs | Total inputs | Inputs missing `.form-input` |
|---|---:|---:|---:|---:|
| `/` `/pipeline` `/leads` `/tasks` `/estimates` `/invoices` `/reports` `/materials` `/work-orders` `/contracts` `/expenses` `/settings` | 0 | 0 | 0 | 0 |
| `/subcontractors` | 0 | 0 | 1 | 0 |
| `/alerts` | 0 | 0 | 3 | **2** — both `<input type="text">` with empty class string |

**Finding (cosmetic, not fixed):** `/alerts` page has 2 raw `<input type="text">` elements rendered without the project's `.form-input` glass styling. They still function. Not a regression — likely the alert-config search/filter inputs which have never had styling applied. Held under the "don't refactor working features" rule; flagged for design decision.

### Audit 4 — Spacing (`spacing-audit.json`)

12 routes audited for `.glass` card padding and border-radius patterns.

| Page | Dominant `.glass` pattern | Notes |
|---|---|---|
| `/` | `17.5px` padding, r=20px / 18px | Apple-style asymmetric corner (canonical) |
| `/pipeline` | `14px` padding, r=20px / 18px | Tighter padding for kanban density (intentional) |
| `/leads` | `12px 24px`, r=20px / 18px | Toolbar pattern |
| `/estimates` `/invoices` `/contracts` `/expenses` | `24px`, r=20px | Detail-card pattern |
| `/work-orders` | `16px`, r=20px | Compact list pattern |
| **`/reports`** | `20px`, **r=16px** | **Diverges** — only page using 16 px corner radius |
| **`/settings`** | `24px`, **r=16px** | **Diverges** — only other page using 16 px corner radius |
| `/subcontractors` | `16px`, r=20px / 18px | OK |

**Finding (cosmetic, not fixed):** `/reports` and `/settings` use `--radius-lg` (16 px) on their `.glass` cards while the rest of the app uses `--radius-xl` (20 px) or the Apple asymmetric `20/18` pair. Held — both pages have been at 16 px since their original implementation; changing them now risks unintended layout shifts. Flagged for design decision in next UI sweep.

### Audit 5 — Icons / Sidebar / Modals (NOT re-run this sweep)

Stage 3 timed out before running the icon, sidebar, and modal sub-audits. Last clean exit (Run 40) confirmed:
- 100 % `@heroicons/react/24/outline` across 37 files (Run 40 evidence still valid — no icon imports added by Run 41 commits)
- Sidebar: 240 px wide, h=42 nav-links, 1 active per page
- Modals: `.modal-backdrop` overlay class on all 4 modal components, radius drift closed by Run 40's `5526fa2`

## Bugs Fixed

1. **`/api/webhooks/hearth` — undefined-body crash leaking JS error in 400 response** — `Buffer.isBuffer()` guard added before `toString('utf8')`; catch block no longer echoes `err.message`. Fixed by **`bc9214f`**. Closes Carry-over #5 in full.
2. **`POST /api/crm/financing/lenders` — unknown provider returned bare 500** — `getAdapter()` now attaches `err.status = 400` so the global handler emits a clean 400 with the unknown-provider message. Fixed by **`5f108be`**.

## Known Issues (Not Fixed)

| # | Description | Reason held |
|---|---|---|
| **(cosmetic)** | `/alerts` page has 2 raw `<input type="text">` without `.form-input` glass styling | No functional regression; pre-existing since alert-config page shipped. Needs UX decision on whether those inputs (filter / search) should adopt full glass styling or stay minimal. |
| **(cosmetic)** | `/reports` and `/settings` use 16 px corner radius on `.glass` cards while the rest of the app uses 20 px | Pre-existing since both pages shipped; not a regression. Changing the radius mid-stream risks unintended layout shifts. Flagged for design call. |
| **#6** | Heavy-work guards missing on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` (no rate limit / concurrent-run guard) | Contract change — needs design before adding rate-limit middleware. |
| **#8** | Mobile responsive sweep at 768 px viewport is **33 runs stale** (last done Run 6) | Out of scope this run; stage 2 timed out before viewport resize. |
| **#9** | `DELETE /api/crm/tasks/:id` route does not exist | Missing **feature**, not a broken endpoint. Per QA charter ("don't add new endpoints, only fix what's broken"), skipped. |
| **DEV_BYPASS admin 403 noise** | Dev-only artifact | Not a production bug. |
| **Reports chart label overlap at ~930 px viewport** | Cosmetic | Layout decision pending. |
| **`subcontractors.js.bak` in tree** | Stale backup file | Safe `git rm` deferred for visibility. |
| **`/subcontractors` has H1 + H2 both reading "Subcontractors"** | Content choice | Not a structural bug. |
| **Untested browser write flows** | Invoice → Record Payment modal write step, Work-order checklist toggle, kanban drag persist, document multipart upload (clean at API since Run 39) | Stage 2 timed out before reaching these. |

## Test Coverage Gaps

- **Stage 2 (frontend) hit `error_max_turns`** after exercising the Financing tab and Import Leads modal. The Connect Lender modal *submission* step (which would have re-verified `5f108be` end-to-end through the UI), the Plan Sync button, and the applications list were not exercised.
- **Stage 3 (UI audit) hit `error_max_turns`** after Audits 1–4. The icon, sidebar, and modal sub-audits (Audits 5–7) were not re-run. Last clean evidence is from Run 40; no surface changes this run would have invalidated those findings, but they are not freshly verified.
- **Stage 4 (verify) hit `error_max_turns`** at turn 41/40 ($1.86). The final build check was not run inside the overnight session — see Build Check below for the report-writer's verification.
- **Stage 5 (report) wrote 0 bytes — never executed.** This report was written in a follow-up session. **30th consecutive non-functional s5.** The overnight orchestration should drop the s5 stage or fold report-writing into s4 — this pattern has now been stable for over a month.
- **Mobile viewport (768 px) sweep** — 33 runs stale.
- **Accessibility / axe-core sweep** — never attempted.
- **Keyboard navigation sweep** (Tab order, focus rings, Esc-closes-modal, Enter-submits) — never attempted.
- **CSV import success path** — still untested under the Neon free-tier write-budget rule.

## Session Integrity

- **s1 api-test** — `end_turn` cleanly, 49 turns, $3.39. **Landed `bc9214f` and `5f108be`**. Produced `.qa-hearth-fin.mjs`, `.qa-patch-delete-probe.mjs`, `.qa-hearth-fin-results.json`, `.qa-patch-delete-results.json`, refreshed `.qa-api-results.json`.
- **s2 frontend-test** — `error_max_turns` (81/80, $4.14). 0 commits; 5 screenshots saved (`qa-run42-*.png`).
- **s3 ui-audit** — `error_max_turns` (61/60, $4.64). 0 commits; 4 audit JSONs written (`button-audit.json`, `header-audit.json`, `form-audit.json`, `spacing-audit.json`).
- **s4 verify** — `error_max_turns` (41/40, $1.86). No transcript, no commits, no screenshots.
- **s5 report** — 0 bytes (**30th consecutive non-functional s5**). This report written in a follow-up session.
- **Total measured spend:** ~$14.03. **1 / 5 sessions completed cleanly.**

## Diff vs. Run 40

- `git diff 11458bd..5f108be --stat` — 2 files (both backend), +13 / −6 total.
- HEAD advanced: `11458bd` (checkpoint) → `bc9214f` → `5f108be`.
- Source file changes: `server/src/services/financing/index.js` (+12/−6), `server/src/services/financing/providers/index.js` (+1/−0).
- New artifacts left in working tree (reusable probes — keep):
  - `.qa-hearth-fin.mjs` and `.qa-hearth-fin-results.json`
  - `.qa-patch-delete-probe.mjs` and `.qa-patch-delete-results.json`
- New artifacts left in working tree (audit JSONs — overwritable each run):
  - `header-audit.json`, `form-audit.json`, `spacing-audit.json`, `button-audit.json`
- Run-specific screenshots (safe to delete after report-acceptance):
  - `qa-run42-01-dashboard.png`, `qa-run42-02-financing.png`, `qa-run42-03-financing-connected.png`, `qa-run42-04-import-modal.png`, `qa-run42-financing-tab.png`

## Build Check

Run by report-writer at end-of-report (`cd /c/Projects/stormleads/client && npx vite build`):
```
✓ built in 7.58s
```
Same chunk-size warnings as Run 40 (Mapbox 1.70 MB and `index` 593 kB above the 500 kB threshold — both pre-existing, not introduced by Run 41).
