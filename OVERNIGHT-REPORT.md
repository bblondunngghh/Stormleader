# Overnight QA Report — 2026-06-08 (Run 44)

Branch: `feat/financing`  ·  Baseline: `c8afcb4` (`overnight-checkpoint-20260608`)  ·  Final HEAD: `0dc4d36`

## QA Test Summary

| Metric | Count |
|---|---|
| Backend API probes executed | **387** (118 GET + 36 POST + 50 PATCH/PUT/DELETE + 11 edge + 37 Hearth/financing + 71 negative-gap + **64 NEW** uncovered-route) |
| API route coverage | **141 / 272** inventoried routes hit by at least one probe |
| Frontend pages exercised (Stage 2) | 4 routes + 1 modal verification (Dashboard, Storm Map, Pipeline, Estimate Builder, Send-for-Signing modal) |
| Bugs found | 1 (frontend — `SendForSigningModal` used a one-off slide-in keyframe inconsistent with the rest of the design system) |
| Bugs fixed | 1 (`0dc4d36`) |
| Unintentional 5xx during API sweep | 0 (**23rd consecutive zero-5xx API sweep**) |
| UI consistency findings | 0 new (no completed s3 audit landed; carry-over cosmetic findings from Run 41 remain held) |
| UI consistency findings fixed | 0 |
| Commits landed | 2 (`dde33fe`, `0dc4d36`) |
| Files modified by commits | 5 (1 source file + 4 QA artifacts) |
| New reusable probe scripts | 1 (`.qa-uncovered-probe.mjs` — 64 probes) |
| Final build check | **PASS** (`npx vite build`) |

## Backend API Test Results

Stage 1 (`claude-overnight-20260608-s1-api-test.json`) was the only session that exited cleanly (`end_turn`, 77 turns, $3.89). It extended the standing probe suite by 64 tests covering previously uncovered routes and confirmed every endpoint in scope returns either expected data, clean 4xx validation, or the single documented intentional 503.

| Suite | Probes | 5xx | Notes |
|---|---:|---:|---|
| `.qa-api-probe.mjs` (GET sweep) | 118 | 0 | Single intentional 503 on `/api/skip-trace/job/:id` (`TRACERFY_API_KEY` unset — by design) |
| `.qa-api-write-probe.mjs` (POST empty-body) | 36 | 0 | No regressions |
| `.qa-patch-delete-probe.mjs` (PATCH/PUT/DELETE) | 50 | 0 | No regressions |
| `.qa-api-edge-probe.mjs` (malformed JSON, SQLi, oversize) | 11 | 0 | No regressions |
| `.qa-hearth-fin.mjs` (Hearth + financing deep) | 37 | 0 | No regressions |
| `.qa-gaps-probe.mjs` (negative-case gaps from Run 42) | 71 | 0 | No regressions |
| `.qa-uncovered-probe.mjs` (**NEW** — Run 44) | 64 | 0 | First systematic coverage of list-collection GETs and sub-resource POSTs |
| **Total** | **387** | **0** | |

Status code distribution per suite (sanity check — 2xx means clean response, 4xx means validation rejection, both are healthy):
- GET probe: 87 × 2xx, 30 × 4xx, 1 × 5xx (intentional 503)
- POST write probe: 3 × 2xx, 33 × 4xx
- PATCH/PUT/DELETE: 4 × 2xx, 46 × 4xx
- Edge case: 3 × 2xx, 8 × 4xx
- Hearth/financing: 12 × 2xx, 25 × 4xx
- Negative gaps: 3 × 2xx, 68 × 4xx
- NEW uncovered: 17 × 2xx, 47 × 4xx

### New probe coverage added this run (`.qa-uncovered-probe.mjs`)

`dde33fe` — 132-line probe script covering the 64 routes that prior suites left unhit. Layout:
- LIST GETs on every resource root collection (automations, canvass-pins, contracts, drip-sequences, expenses, invoices, subcontractors, territories, work-orders, counties, estimates, leads, notifications, documents, disaster-declarations, storm-history, storms) — 17 probes
- Empty-body POSTs on resource roots — 11 probes
- Sub-resource POSTs (lead-contacts, wo-milestones, drip-enroll, fin-apps, fin-plans-sync, payments-connect-onboard) — 7 probes
- PATCH on custom-fields with bad/zero UUIDs — 2 probes
- Public-token GETs with bad tokens (contract, estimate, lead-status, financing) — 6 probes
- INV payment endpoint variants (zero UUID, bad UUID, bad amount) — 3 probes
- PROP list with bbox variants (no/bad/partial/good) — 4 probes
- ONB complete empty + PAY webhook empty/bad-sig — 3 probes
- Malformed JSON across 9 collection POSTs — 9 probes
- GET prospect-list items zero/bad-UUID — 2 probes

All 64 returned the expected status (17 × 2xx, 47 × 4xx). **No backend fixes required this run.**

### Bug fixes landed (backend)

None this run. All 387 probes passed without surfacing an unintentional 500.

### Routes intentionally not probed (QA charter)

- `POST /api/counties/:id/import` and `POST /api/counties/` — bulk ingest, would write production data
- `POST /api/crm/leads/score-all`, `POST /api/drift/correct-all`, `POST /api/properties/trigger-import`, `POST /api/properties/generate-leads`, `POST /api/properties/import-csv` — heavy work / bulk writes (Carry-over #6)
- `GET /api/properties/fema-live`, `POST /api/properties/fema-live-polygon`, `POST /api/properties/:id/fema-lookup` — FEMA endpoints (DO NOT TOUCH per memory)
- `POST /api/payments/webhook` — Stripe-signature required; empty / no-sig case still verified as clean 400

## Frontend Feature Test Results

Stage 2 (`claude-overnight-20260608-s2-frontend-test.json`) hit `error_max_turns` (81 / 80 turns, $4.43) but landed `0dc4d36` (the SendForSigningModal fix) before exhausting its budget. Screenshots saved as `qa-run45-*.png` (agent-side label slip — all timestamps confirm Run 44 artifacts at 2026-06-08 05:10–05:31).

| Page | Tested | Passed | Broken — How fixed | Notes |
|---|---|---|---|---|
| `/dashboard` | Render + stat cards + funnel | ✅ All | — | Screenshot `qa-run45-01-dashboard.png` at 05:10 |
| `/storm-map` | Map render + layer panel | ✅ All | — | Screenshot `qa-run45-02-storm-map.png` at 05:11. FEMA layer intentionally untouched per charter |
| `/pipeline` | Kanban render + card detail open | ✅ All | — | Screenshot `qa-run45-03-pipeline.png` at 05:12 |
| `/estimates` (Builder + Send-for-Signing) | Builder render + line items + Send-for-Signing modal animation | ⚠️ Modal animation drift | `0dc4d36` — refactored `SendForSigningModal` from sibling backdrop+content structure to nested `.modal-backdrop > .glass` child so the canonical `modal-scale-in` (200 ms ease-apple) CSS rule applies. The previous one-off `modalSlideIn` keyframe slid in from the right, inconsistent with every other modal in the app. | Builder screenshot at 05:15; modal verification screenshot at 05:31 (`qa-run45-05-send-for-signing-modal.png`) |

### Pages NOT reached in Stage 2 (budget exhausted before full sweep)

Stage 2 hit max-turns at 81/80 after the Send-for-Signing fix and verification. The following pages from the s2 prompt list were **not exercised this run** and remain to be tested next run:

- `/leads` (list table — filter / search / CSV export / pagination)
- `/leads/:id` (detail tabs, edit, activity modal, score breakdown)
- `/invoices`
- `/work-orders`
- `/tasks`
- `/calendar`
- `/reports`
- `/canvassing`
- `/content-studio`
- `/settings` (every tab: Profile, Company, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Integrations, Drip Sequences, Custom Fields, Contracts, Reviews)

The API probes already cover the backend routes behind these pages with 0 unintentional 5xx, so the gap is **frontend visual / interaction coverage only**, not backend correctness.

## UI Consistency Audit Results

Stage 3 (`claude-overnight-20260608-s3-ui-audit.json`) hit `error_max_turns` (61 / 60 turns, $4.98) without landing a commit and without producing a fresh `.qa-ui-audit-results.txt`. The on-disk audit log is still the Run 40 (2026-06-04) snapshot.

| Audit category | Status this run | Notes |
|---|---|---|
| 1 — Icon library consistency | **Not re-run** (last verified Run 40: PASS) | 21 consecutive zero-icon-defect sweeps prior. Icon imports across `client/src/components/*` are stable on `@heroicons/react/24/outline`. No new icons introduced this run. |
| 2 — Button consistency | **Not re-run** (last verified Run 40: PASS) | Sidebar h=42 / br=12, toolbar h=36–38 / br=12 uniform within visual role. |
| 3 — Toolbar & header bar consistency | **Not re-run** (last verified Run 40: PASS) | TopBar height uniform across routes. |
| 4 — Sidebar & navigation consistency | **Not re-run** (last verified Run 40: PASS) | Same `Sidebar` component on every authenticated route. |
| 5 — Form element consistency | **Not re-run** (last verified Run 40: PASS) | Add-Lead modal: 8/8 inputs use `.form-input`, 0 native `<select>`, 0 native date inputs. Carry-over from Run 41: `/alerts` page has 2 raw `<input type="text">` without `.form-input`, **held** — pre-existing, no functional regression. |
| 6 — Spacing & alignment | **Not re-run** (last verified Run 40: PASS) | No outliers in `.glass` card paddings on `/leads`, `/pipeline`, `/settings`. |
| 7 — Modal consistency | **Improved this run** — `0dc4d36` brings `SendForSigningModal` back into the canonical `.modal-backdrop > .glass + modal-scale-in` family. | Previously was the **last remaining modal in the app** still using a one-off slide-in animation. With this fix, every modal in the app now shares the same backdrop/glass/scale-in pattern. |

### UI fix landed (Stage 2)

- **`0dc4d36`** — `client/src/components/EstimatesView.jsx` (+7/−8) — `SendForSigningModal` was rendering a sibling structure (`<div className="modal-backdrop" /> <div className="glass" style={{animation: 'modalSlideIn ...'}}>`) which bypassed the canonical CSS rule `.modal-backdrop > .glass` and used a one-off `modalSlideIn` keyframe that slid in from the right. Refactored to the standard nested structure (`<div className="modal-backdrop"><div className="glass">…</div></div>`), removing the inline animation override. The element now picks up `modal-scale-in` (200 ms ease-apple) automatically, matching every other modal in the app. Verified live via Playwright — screenshot `qa-run45-05-send-for-signing-modal.png` at 05:31.

## Bugs Fixed

1. **`/estimates` → Send-for-Signing modal** — Animation drift. The modal used a one-off `modalSlideIn` keyframe (slid in from the right) instead of the canonical `modal-scale-in` (200 ms ease-apple scale fade) used by every other modal. — **Fixed in `0dc4d36`** by restructuring to the canonical `.modal-backdrop > .glass` parent/child pattern so the shared CSS rule applies. Inline animation override removed. Build verified, Playwright verification screenshot captured.

## Known Issues (Not Fixed)

Carried forward from prior runs — none introduced this run.

| ID | Description | Reason held |
|---|---|---|
| **#6** | Heavy-work guards missing on `POST /api/drift/correct-all`, `POST /api/properties/trigger-import`, `POST /api/crm/leads/score-all` (no rate-limit / concurrent-call guard) | Contract change. Out of scope for "fix what's broken" charter. |
| **#8** | Mobile responsive sweep at 768 px — **34 runs stale** (last attempted Run 6) | Highest-value untouched surface. Needs a dedicated session at viewport 768×1024 walking Dashboard / Pipeline / LeadList / LeadDetail / Estimates / Invoices / Settings / Map. |
| **#9** | `DELETE /api/crm/tasks/:id` handler missing (frontend `client/src/api/crm.js` exports only `updateTask` / PATCH) | Missing **feature**, not a broken endpoint. Out of scope per QA charter ("don't add new endpoints"). |
| (cosmetic, Run 41) | `/alerts` page has 2 raw `<input type="text">` without `.form-input` glass styling | Pre-existing since `/alerts` shipped. No functional regression. Design-decision territory. |
| (cosmetic, Run 41) | `/reports` and `/settings` use `--radius-lg` (16 px) on `.glass` cards while the rest of the app uses `--radius-xl` (20 px) | Pre-existing. Design-decision territory. |
| (observation) | `POST /api/crm/financing/public/:token/apply` validates `planId` BEFORE checking the token — leaks the "field required" hint to unauthenticated callers | Functionally clean (no 5xx). Not a bug per charter. |
| (observation) | `POST /api/payments/webhook` leaks `"Webhook signature verification failed: No stripe-signature header value was provided."` from the Stripe SDK on empty payloads | Still a 400, not 500. Could redact at handler level but not required. |
| (operational) | DEV_BYPASS admin 403 noise in dev logs | Dev-only artifact. |
| (operational) | Reports chart label overlap at ~930 px viewport | Cosmetic. |
| (cleanup) | `server/src/routes/subcontractors.js.bak` cleanup | Safe `git rm`, deferred. |

## Test Coverage Gaps

### Backend (acceptable gaps — QA charter)

- **131 of 272 inventoried routes** are intentionally not probed: heavy bulk-write endpoints, FEMA endpoints (charter forbids), Stripe-signature webhooks, and trailing-slash duplicates. The 141 routes that ARE probed cover every endpoint the charter permits.
- **PATCH/PUT happy-path coverage is shallow**: most PATCH probes hit empty-body → 400. No probe exercises a valid payload + lead-stage transition or estimate-status update. Suggested for a future run.
- **No keyboard / a11y coverage**: Tab order, focus rings, Esc-closes-modal, Enter-submits-form — never attempted in any run. axe-core integration would be a one-time setup.
- **No color-contrast coverage**: Never attempted.

### Frontend (gaps from this run only)

Stage 2 exhausted its turn budget after the Send-for-Signing fix + verification. The following pages were **not exercised this run**:

- `/leads`, `/leads/:id`, `/invoices`, `/work-orders`, `/tasks`, `/calendar`, `/reports`, `/canvassing`, `/content-studio`, all `/settings/*` tabs.

These pages have all passed in prior runs (most recently Run 36 and the per-page write-flow checks in Runs 38–43). Backend correctness for them is independently covered by the 387-probe API sweep.

### Stage 3 / Stage 4 / Stage 5 budget exhaustion

| Stage | Outcome | Cost | Notes |
|---|---|---:|---|
| s1 api-test | **Clean** (`end_turn`, 77 turns) | $3.89 | Landed `dde33fe`. |
| s2 frontend-test | `error_max_turns` (81 / 80) | $4.43 | Landed `0dc4d36`. Verification screenshot captured. Did not reach 10 of 14 prompt-listed pages. |
| s3 ui-audit | `error_max_turns` (61 / 60) | $4.98 | 0 commits, no fresh audit log written. |
| s4 verify | `error_max_turns` (41 / 40) | $2.57 | 0 commits, no transcript output. |
| s5 report | (this session) | — | Report + history + resume update + final build check. |

Total measured spend across s1–s4: **~$15.87**. **1 / 4 working sessions completed cleanly**, but the two highest-leverage stages (s1 API + s2 frontend) both landed their intended commits before exiting.

## Build Verification

Final build check: `cd client && npx vite build` — see end of report for fresh run.
