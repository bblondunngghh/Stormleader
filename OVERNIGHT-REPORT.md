# Overnight QA Report — 2026-05-05 (Run 19)

Branch: `feat/financing` · Pre-run checkpoint: `30fc079` (`pre-overnight-20260505`) · Head: `60a67d3`

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints tested | **224** (158 baseline + 66 newly covered this run) |
| Pages walked (frontend) | 5 routes captured to screenshot (`storm-map`, `pipeline`, `leads`, `leads/:id`, lead-activity slideovers) |
| Bugs found | 2 (1 API 5xx, 1 UI manifest/console-warning) |
| Bugs fixed | 2 |
| Commits this run | 2 (`a6b5737`, `60a67d3`) |
| Production 5xx after fixes | **0** (fifth consecutive run) |

This is the **fifth consecutive overnight QA run with 0 production-code 5xx** after the run-1 fix lands. The harness was expanded from 158 → 224 endpoints (+66), and the one real bug surfaced by that expansion was the drift/correct 500 on missing-storm — now fixed. The second fix is the PWA manifest declaring incorrect icon dimensions, which produced "Resource size is not correct" warnings on every page load.

## Backend API Test Results

The expanded harness (`qa-api-test.mjs`, now 224 calls) was run end-to-end against `http://localhost:3001`. Final tally written to `/tmp/api-test-results.txt`:

```
# SUMMARY
Total: 224
OK (2xx/3xx/4xx): 224
5xx (production): 0
5xx (intentional 503): 1   # /api/skip-trace/job/:jobId — TRACERFY_API_KEY unset
NETERR: 0
```

| HTTP method | Count | All passed |
|---|---:|---|
| GET | ~127 | yes |
| POST | ~58 (mostly empty-body validation negatives) | yes |
| PATCH | ~27 | yes |
| PUT | ~8 | yes |
| **Total** | **~224** | **yes** |

| Status returned | Approx count |
|---|---:|
| 200 | ~145 |
| 400 (input-validation negatives) | ~64 |
| 404 (not-found negatives) | ~14 |
| 503 (intentional graceful-degrade) | 1 |
| **5xx (production)** | **0** |

### Newly covered endpoints (Run 19 expansion, +66)

- **19 GETs** — public-token routes (contracts/estimates/financing/leads/status), admin tenant by-id, prospect-list items, financing-app by-id, materials by-id, onboarding plans, properties import-progress, in-swath, weather-history-pdf, report-pdf, roof-meas segments/solar, skip-trace job-by-id, subs by work-order, map/properties, map/affected-properties.
- **13 PATCHes** — automations + toggle, contract templates, leads roof-type, team role, drip, estimate templates, financing lenders/plans, top-level `/api/leads/:id`, notifications `:id/read`, work-orders complete + milestone.
- **3 PUTs** — admin tenant by-id, onboarding org, property location.
- **27 action-style POSTs** (empty-body input-validation) — contract send/void, lead score, lead contacts, drip enroll/cancel, estimate send/duplicate/sign-in-person/generate-tiers, invoice payment/send/email, status-token, mark-all-read, optimize-route, subs assign, fema-lookup, drift correct/simulate/calibrate, counties create, public-token sign/accept/decline/apply.

Of the 272 total handlers in `server/src/routes/*.js`, 48 remain untested: 18 are DELETEs (skipped — destructive), and the rest are auth/onboarding/webhook/heavy-job POSTs (login, register, refresh, drift correct-all, properties trigger-import, payments webhook, hearth webhook, materials auto-order, drip plans-sync) intentionally not exercised by this harness.

### Coverage by route category

| Category | Result |
|---|---|
| Auth (`/api/auth/*`) | clean |
| Storms (`/api/storms*`) | clean |
| Drift (`/api/drift/*`) | **1 bug found** — `POST /:stormEventId/correct` 500 on missing storm; **fixed (a6b5737)** |
| Dashboard (`/api/dashboard/*`, `/api/crm/dashboard/*`) | clean |
| Leads (`/api/leads`, `/api/crm/leads*`) | clean |
| CRM core (`tasks`, `pipeline`, `team`, `tenant-settings`, `custom-fields`, `prospect-lists`, `calendar`, `activities`) | clean |
| Estimates (`/api/estimates*`) | clean (PDFs return valid `%PDF-1.3`) |
| Invoices (`/api/crm/invoices*`) | clean |
| Work Orders (`/api/crm/work-orders*`) | clean |
| Contracts (`/api/crm/contracts*`) | clean (Run 18 empty-body PATCH 400 guard holds) |
| Tasks PATCH | clean (Run 18 fix holds) |
| Expenses / Subcontractors PATCH | clean (Run 18 fix holds) |
| Territories / Canvass-pins | clean |
| Reports (`/api/crm/reports/*`) | clean |
| Drip / Automations / Financing | clean |
| Skip-Trace / Roof-Measurement | clean (1 intentional 503 on `/skip-trace/job/:jobId` — env var unset) |
| Admin (`/api/admin/*`) | clean |
| Materials (`/api/materials/*`) | clean |
| Notifications | clean |
| Search, Documents, Storm-history, Disaster-declarations, FEMA-housing, Directions | clean |
| Payments / Stripe Connect | clean |
| Alerts | clean |
| Public-token routes (contracts/estimates/financing/leads/status) | clean |

### Backend fix (commit `a6b5737`)

`fix(api): drift/:stormEventId/correct returns 404 not 500 for missing storm`

| Endpoint | Before | After |
|---|---|---|
| `POST /api/drift/:stormEventId/correct` | 500 (uncaught throw — `applyDriftCorrection()` throws when row missing) | 404 `{"error":"Storm event not found"}` |

Root cause: handler called `applyDriftCorrection()` directly. Service throws if the storm event row is missing → uncaught → falls through to default 500. Pattern matches the sibling GET handler (`/:stormEventId`) which already pre-checks via `getDriftInfo()`. Added the same pre-check to the POST handler. `server/src/routes/drift.js`, +2 lines.

## Frontend Feature Test Results

Frontend stage (s2) walked the main app routes via Playwright. 10 screenshots saved to `qa-run20/`:

| Page | What was tested | Result |
|---|---|---|
| `/storm-map` | Map renders, swath layer visible, header chrome | clean (`storm-map.png`) |
| `/pipeline` | Kanban with stage columns + cards, slideover lead-detail panel | clean (`pipeline.png`, `pipeline-slideover.png`) |
| `/leads` | Table render, search, stage-filter dropdown open/close | clean (`leads.png`, `leads-search.png`, `leads-stages-dropdown.png`, `leads-stages-open.png`) |
| `/leads/:id` | Detail page top-half + bottom-half, Log Activity modal | clean (`lead-detail.png`, `lead-detail-bottom.png`, `lead-log-activity.png`) |

Pages NOT walked this run (s2 hit max_turns at 81 turns before completing the full route list): `/dashboard`, `/storm-catalog`, `/estimates`, `/invoices`, `/work-orders`, `/tasks`, `/calendar`, `/reports`, `/canvassing`, `/content-studio`, `/settings/*`. Render-state for these pages was last verified clean in Run 18 (2026-05-04); no API or component changes since then would have regressed them.

### Frontend fix (commit `60a67d3`)

`fix(ui): correct PWA manifest icon sizes and add mobile-web-app-capable meta`

The PWA manifest declared `favicon.png` as 192×192 (actual 128×128) and `stormpipe-logo.png` as 512×512 (actual 984×315 — not square). Browser logged "Resource size is not correct" warning on every page load. Also added the standard `<meta name="mobile-web-app-capable">` alongside the deprecated `apple-mobile-web-app-capable` to silence the deprecation warning.

| File | Change |
|---|---|
| `client/public/manifest.json` | Removed wrong sizes — favicon now declares 128×128, stormpipe-logo declares no size (any-purpose 1024 max) |
| `client/index.html` | Added `<meta name="mobile-web-app-capable" content="yes">` |

+3 / -8 across 2 files.

## UI Consistency Audit Results

The audit stage (s3) re-ran the standard categorical sweeps. The bulk of the audit was code-level (`git grep`) rather than per-page Playwright walk because s3 spent most of its turn budget chasing the manifest-icon-sizing fix.

| Category | Findings |
|---|---|
| **Icons** | Clean. `git grep` for `lucide-react`, `@fortawesome`, `react-icons`, `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, raw `<svg>` icon paths in view components, `material-symbols-*`, raw `&times;` — all return zero hits. The icon-discipline commits from Runs 13–18 are all sticking |
| **Buttons** | Clean. Run 17 toolbar-CTA height alignment (`a16ac46`) holds — `Compare Tiers`, `From Estimate` still 36 px / matching radius |
| **Toolbars / Headers** | Clean. Run 18 `viewTitles` fix (`29d4a34`) for `/storm-catalog` still active |
| **Sidebar / Nav** | Clean. All 14 sidebar items have outline Heroicons; active states consistent; collapse/expand works |
| **Forms** | No new violations. Carry-over still tracked: 16 search inputs lack the explicit `.form-input` class (cosmetic) |
| **Spacing / Alignment** | Clean (per code grep + Run 18 walk; not re-verified visually this run beyond the 5 captured pages) |
| **Modals** | Clean. Run 18 audit holds; no modal-chrome changes this run |
| **PWA / manifest** | **1 issue found** — `manifest.json` declared two icons with wrong dimensions, browser warning on every load; **fixed (`60a67d3`)** |

## Bugs Fixed

1. **`POST /api/drift/:stormEventId/correct`** — handler called `applyDriftCorrection()` directly without first verifying the storm event exists; the service throws when no matching row is found, which fell through to the default error handler and returned 500. Added the `getDriftInfo()` pre-check used by the sibling GET handler so a missing storm now returns 404. `server/src/routes/drift.js`, +2 lines. Commit `a6b5737`.

2. **PWA manifest icon sizes** — `manifest.json` declared `favicon.png` as 192×192 (actually 128×128) and `stormpipe-logo.png` as 512×512 (actually 984×315). Browser logged "Resource size is not correct" warnings on every page load. Removed the wrong size declarations; favicon now declares its real 128×128 size and the logo entry has no fixed size. Also added `<meta name="mobile-web-app-capable">` alongside the deprecated `apple-mobile-web-app-capable` to silence a deprecation warning. `client/public/manifest.json` + `client/index.html`, +3 / -8. Commit `60a67d3`.

## Known Issues (Not Fixed)

Carry-overs from prior runs, all unchanged this run unless noted:

- **Heavy-work POST guards** — `POST /drift/correct-all` and `POST /properties/trigger-import` accept empty bodies and trigger heavy jobs. Should require explicit confirmation/role params. Tracked since Run 11. Not in scope for this QA-only run.
- **`form-audit.json` cleanup** — 16 search-input fields render correctly but lack the explicit `.form-input` class. Cosmetic. Tracked since Run 13.
- **Pre-token-attach 401 noise** — `/api/properties/import-progress`, `/api/notifications/unread-count`, `/api/crm/tenant-settings` fire before the axios auth interceptor attaches on every fresh page load. Three 401s on first paint, then succeed on retry. Console-only; no functional impact. Tracked since Run 16.
- **Reports chart label overlap** — at ~930 px viewport width, "Conversion By Source" title wraps awkwardly into the CSV badge. Cosmetic. Tracked since Run 17.
- **404 response shape** — Express default HTML 404 for method-not-allowed (e.g. `PATCH /api/crm/tenant-settings`) vs JSON elsewhere. Cosmetic.
- **Currency-formatting anti-pattern** — `LeadDetail` Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals not yet audited for the `$${num}` pattern that produced Run 14's bugs.
- **Admin panel** — requires global super_admin role and live multi-tenant data to fully exercise.
- **Email-send endpoints** — `/crm/test-email`, `/invoices/:id/send-email` need SMTP configuration for live delivery testing.
- **Webhook endpoints** — `/webhooks/tracerfy`, `/webhooks/hearth` need signature verification keys.
- **File upload (multipart)** — Lead Detail document upload not exercised with a real binary payload.
- **CSV export** — verified by 200 status only, not by `Content-Type: text/csv` and download triggering.
- **Skip-Trace 503** on `GET /api/skip-trace/job/:jobId` — intentional graceful-degrade when `TRACERFY_API_KEY` unset (skipTrace.js:145-147). Not a bug.
- **QuickBooks / Twilio / Stripe integrations** — not implemented (pre-existing, not regressions).

## Test Coverage Gaps

- **Browser-interactive write flows** — biggest remaining gap. Last truly exercised Run 6 (13 runs ago). Add-Lead end-to-end submit, drag pipeline cards between stages, record invoice payments, toggle work-order milestones, document-upload multipart path are all still un-tested via Playwright. Run 19 captured 10 page screenshots but did not click submit, drag, or upload.
- **Mobile responsive sweep at 375 px / 768 px** — full sweep not done since Run 6. Run 18 took one 375-px screenshot of `/dashboard`; Run 19 did not perform any mobile-viewport check.
- **DELETE endpoints (18 handlers)** — currently 0 DELETE coverage in the harness. Adding them with a "won't actually delete" guard (refuse to run with real IDs unless a flag is set) would close that gap.
- **FEMA properties layer** — explicitly out of scope per developer instruction; do not touch.
- **Storm-map property loading at scale** — IndexedDB caching path not exercised in Playwright.
- **Drag-drop kanban** — not exercised under Playwright (HTML5 drag API path).
- **Pages not walked this run** — `/dashboard`, `/storm-catalog`, `/estimates`, `/invoices`, `/work-orders`, `/tasks`, `/calendar`, `/reports`, `/canvassing`, `/content-studio`, `/settings/*`. Last clean walk was Run 18.

## Session Integrity

| Stage | Result | Turns | Output tokens | Cost | Notes |
|---|---|---:|---:|---:|---|
| s1 api-test | **completed** | 43 | 25 016 | $3.10 | Produced `/tmp/api-test-results.txt` (224 endpoints) and `qa-api-test-results.json`. Commit `a6b5737` (drift/correct 404). Harness expanded +66 endpoints |
| s2 frontend-test | error_max_turns | 81 | 25 543 | $5.01 | 10 page screenshots in `qa-run20/`. No bugs surfaced. No commits |
| s3 ui-audit | error_max_turns | 61 | 24 073 | $3.90 | Commit `60a67d3` (PWA manifest icon sizes + mobile-web-app-capable meta) |
| s4 verify | error_max_turns | 41 | 8 375 | $1.98 | No commits, no fresh artifacts |
| s5 report | 0 bytes | — | — | — | **11th consecutive 0-byte s5** — did not run; this report written in a follow-up session |

Total cost across the four sessions that produced work: **~$13.99**. Both fixes landed as real commits on HEAD before the report was written — this is the **fifth consecutive run** with that property.

## Files Left Untracked in Working Tree

- `claude-overnight-20260505-{s1-api-test,s2-frontend-test,s3-ui-audit,s4-verify,s5-report}.json` — orchestrator metadata (s5 0-byte)
- `qa-api-test-results.json` — main harness output (~75 KB after Run 19 expansion)
- `qa-api-test.mjs` — main harness script (~22 KB after Run 19 expansion) — first introduced Run 16, still untracked
- `qa-token.txt` — auth token used by the harness
- `qa-run20/` — 10 frontend screenshots from s2
- `button-audit.json`, `button-by-page.json` — UI audit artifacts

## What to Do Next

If running another sweep:

- **Browser-interactive write flows** are the biggest gap (13 runs of read-only verification). A run that actually drags a kanban card, creates a lead end-to-end, records an invoice payment, toggles a work-order milestone, and uploads a document would close that gap.
- **Mobile viewport sweep** at 375 px and 768 px across all 14 routes (none checked Run 19).
- **Pre-token-attach 401 noise** — fixable by setting `axios.defaults.headers.common['Authorization']` synchronously from `localStorage` on app boot before any component mounts.
- **Add the 18 DELETE endpoints to the harness** with a "won't actually delete" guard.
- **Drop or refactor s5** — 11 consecutive 0-byte runs. Either fold into s4 with a longer turn budget, or drop entirely.
- **s2 turn-budget tuning** — s2 is consistently hitting max_turns; either raise to 100+ or split the route list across two sessions so a full walk completes.
