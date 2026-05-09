# Overnight QA Report — 2026-05-09 (Run 22)

Branch: `feat/financing` · Pre-run checkpoint: `0ebefc2` (`overnight-checkpoint-20260509`) · Head: `7169023`

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints tested | **265** (253 baseline + 12 newly covered this run) |
| API handler coverage | 265 / 272 = **97.4 %** |
| Pages walked (frontend) | 12 routes screenshotted by s2 + 4 verify screenshots from s4 |
| Bugs found (production 5xx) | **0** |
| Bugs fixed | **0** |
| New findings (deferred, not fixed) | 0 |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Commits this run | 1 (`7169023` — harness expansion) |
| Production 5xx after run | **0** (eighth consecutive run) |
| Intentional 503s | 1 (`GET /api/skip-trace/job/:jobId` when `TRACERFY_API_KEY` unset) |

This is the **eighth consecutive overnight QA run with 0 production-code 5xx**
(Runs 15–22). The +12 endpoint harness expansion is the largest single jump
since Run 19; coverage moved from 93.0 % to 97.4 % in one run. Every fix from
Runs 13–19 still holds. Frontend stages (s2/s3/s4) all hit max_turns but s2
captured a complete 12-route walk before exhaustion and s4 captured 4
verification screenshots; no UI regressions surfaced. s5 was 0 bytes (14th
consecutive).

## Backend API Test Results

The expanded harness (`qa-api-test.mjs`, now 265 calls) was run end-to-end
against `http://localhost:3001`. Final tally from `qa-api-test-results.json`
(re-verified post-run):

```
Total: 265
200: 128
201:   2
400:  84   (input-validation negatives)
404:  50   (not-found negatives)
503:   1   (intentional graceful-degrade — TRACERFY_API_KEY unset)
5xx (production): 0
NETERR: 0
```

| HTTP method | Count | All passed |
|---|---:|---|
| GET | 132 | yes |
| POST | 80 | yes |
| PATCH | 27 | yes |
| PUT | 8 | yes |
| DELETE | 18 | yes |
| **Total** | **265** | **yes** |

### Newly covered endpoints (Run 22 expansion, +12)

`qa-api-test.mjs` now covers 12 endpoints from the previously skipped list.
Each was handler-reviewed first to confirm an input-validation guard runs
**before** any external API / heavy work / Stripe call. Commit `7169023`:

| Endpoint | Method | Status | Response | Notes |
|---|---|---:|---|---|
| `/api/properties/import-csv` | POST | 400 | `rows array is required` | JSON body endpoint (not multipart). Handler:208 rejects before `batchGeocode()`. |
| `/api/documents/upload` | POST | 400 | `No file uploaded` | Multer leaves `req.file` undefined when not multipart; handler:57 catches. |
| `/api/properties/fema-live` | GET | 400 | `bbox required` | Returns before `fetchByBbox` hits FEMA NSI. |
| `/api/properties/fema-live-polygon` | POST | 400 | `GeoJSON geometry required in body` | Returns before `fetchByPolygon` hits FEMA NSI. |
| `/api/counties/:id/import` | POST | 404 | `County not found` | Returns before `triggerImport` runs. |
| `/api/payments/create-intent` | POST | 400 | `estimateId is required` | Returns before any Stripe call. |
| `/api/payments/public/create-intent` | POST | 400 | `Estimate token is required` | Returns before any Stripe call. |
| `/api/skip-trace/setup-payment` | POST | 400 | `paymentMethodId required` | Returns before Stripe customer / payment-method calls. |
| `/api/onboarding/select-plan` | POST | 400 | Zod `{"planKey":["Required"]}` | Schema rejects before DB writes. |
| `/api/onboarding/setup-payment` | POST | 400 | Zod `{"paymentMethodId":["Required"]}` | Schema rejects before Stripe call. |
| `/api/onboarding/enable-addons` | POST | 400 | Zod `{"skipTrace":["Required"],"roofMeasurement":["Required"]}` | Schema rejects. |
| `/api/onboarding/complete` | POST | 200 | `{ok:true}` | **Idempotent** — sets `onboarding_completed=true`; already true on Waterloo, only side effect is `updated_at` bump. Verified safe before adding. |

### Coverage by route category

| Category | Result |
|---|---|
| Auth (`/api/auth/*`) | clean |
| Storms (`/api/storms*`) | clean |
| Properties (`/api/properties/*`) | clean (incl. new fema-live + fema-live-polygon + import-csv) |
| CRM core (`/api/crm/*`) | clean |
| Leads / activities / contacts | clean |
| Estimates / Invoices / Work-orders | clean |
| Tasks / Documents / Drip / Custom-fields | clean (incl. new documents/upload) |
| Subcontractors / Materials / Expenses / Contracts | clean |
| Drift / Counties / Parcels | clean (incl. new counties/:id/import) |
| Skip-trace (Tracerfy) | clean (1 intentional 503; new setup-payment now covered) |
| Webhooks (Tracerfy, Hearth, Stripe) | clean (Run 21's Hearth carry-over still open) |
| Notifications / Search / Reports | clean |
| Team / Profile / Tenant settings | clean |
| Public estimate / Onboarding | clean (4 onboarding endpoints newly covered) |
| Payments (Stripe-touching) | clean (3 new endpoints — guards run before Stripe) |

### Coverage gaps (7 untested handlers)

Of the 272 total handlers in `server/src/routes/*.js`, 7 remain untested.
Run 21 listed 19; Run 22 reduced to 7. The previously listed "5 heavy-job
triggers" included `properties/fema-live-polygon`, `properties/fema-live`,
and `counties/:id/import`, which **do** have early input guards and are now
in coverage. The remaining 7:

- **2 auth flows** — `POST /auth/{register,login}` (login is exercised
  implicitly by harness preamble; register skipped to avoid creating
  accounts).
- **1 onboarding flow** — `POST /onboarding/create-tenant` (would create a
  real tenant).
- **2 Stripe-touching POSTs** — `POST /payments/connect/{onboard,refresh}`
  (both call `stripe.accountLinks.create` regardless of body — no
  body-validation guard runs first).
- **3 heavy-job triggers without guards** — `POST /properties/trigger-import`,
  `POST /drift/correct-all`, `POST /crm/leads/score-all` (all three accept
  empty bodies and immediately fire the background work).

## Frontend Feature Test Results

Stage 2 (Playwright walk) hit `max_turns` at 81 turns but **completed a full
12-route walk** before exhaustion, capturing `qa-2026-05-09/01-12.png`. **No
new bugs were surfaced** before exhaustion; no commits were produced by
stage 2 or stage 3. Stage 4 captured 4 additional verification screenshots
in the project root (`qa-2026-05-09-*.png`).

### s2 walk — 12 routes captured

| Route | Screenshot | Notes |
|---|---|---|
| `/dashboard` | `01-dashboard.png` (446 KB) | Stat cards, funnel, activity feed, tasks-due-today, leaderboard all render. Glass styles intact. |
| `/storm-map` | `02-storm-map.png` (534 KB) | Map renders, layer panel visible. FEMA properties not exercised per task constraint. |
| `/pipeline` | `03-pipeline.png` (475 KB) | Kanban renders all stages. `Add Lead` CTA visible. |
| `/leads` | `04-leads.png` (326 KB) | Table renders with filters, pagination, stage chips. |
| `/leads/:id` | `05-lead-detail.png` (200 KB) | Detail view renders with editable fields and tabs. |
| `/estimates` | `06-estimates.png` (361 KB) | List with templates and builder route accessible. |
| `/invoices` | `07-invoices.png` (354 KB) | Stat cards, list, Overdue counter render correctly. |
| `/work-orders` | `08-work-orders.png` (529 KB) | List + milestone view renders. |
| `/tasks` | `09-tasks.png` (386 KB) | Filter tabs, list render. |
| `/calendar` | `10-calendar.png` (279 KB) | Calendar grid renders (placeholder view). |
| `/reports` | `11-reports.png` (421 KB) | Charts and stat cards render. |
| `/canvassing` | `12-canvassing.png` (1.2 MB) | Territory drawing UI renders with map. |

### s4 verify — 4 additional screenshots

| Screenshot | Purpose |
|---|---|
| `qa-2026-05-09-dashboard.png` (455 KB) | Re-verify dashboard glass styles after report write. |
| `qa-2026-05-09-leads.png` (336 KB) | Re-verify leads table renders. |
| `qa-2026-05-09-pipeline.png` (484 KB) | Re-verify pipeline kanban renders. |
| `qa-2026-05-09-add-lead-modal.png` (237 KB) | Pipeline `Add Lead` slideover modal opens cleanly. |

### Routes not walked this run

`/storm-catalog`, plus all 12 `/settings/*` tabs (Profile, Company, Team,
Storm Alerts, Notifications, Email/SMTP, Financing, Integrations, Drip
Sequences, Custom Fields, Contracts, Reviews), `/content-studio`. Last full
walk including settings tabs was Run 18 (2026-05-04). Tracked as carry-over.

## UI Consistency Audit Results

Stage 3 hit `max_turns` at 61 turns and produced no commits. A `git grep`
sanity-check post-run confirmed the icon-discipline baseline still holds:

| Audit category | Finding | Fixed? |
|---|---|---|
| **Icons** — non-Heroicon imports | 0 hits for `lucide-react`, `@fortawesome`, `react-icons`, `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, `material-symbols-*`, raw `&times;` | n/a — clean |
| **Icons** — inline SVGs as icons | 0 (decorative SVGs in map/chart layers only, not used as UI icons) | n/a — clean |
| **Buttons** — primary CTA height alignment | All toolbar primary CTAs use `.auth-btn`; no outliers found by code grep | n/a — Run 17 fix (`a16ac46`) and Run 13 standardization (`23c3746`) still hold |
| **Buttons** — danger / delete styling | Consistent `.btn-danger` usage across LeadDetail, EstimatesView, WorkOrders | n/a — clean |
| **Toolbars / Headers** | TopBar `viewTitles` correct on `/storm-catalog` (Run 18 fix `29d4a34` still holds) | n/a — clean |
| **Sidebar / Nav** | Active states, icon set, spacing all consistent in s2 snapshots | n/a — clean |
| **Forms** — `.form-input` class | 16 search-input fields still lack the explicit class (cosmetic carry-over from Run 13) | not fixed — cosmetic, tracked |
| **Forms** — native `<select>` / `<input type="date">` | 0 found in components — `CustomSelect` and `DatePicker` used everywhere | n/a — clean |
| **Spacing & Alignment** | Stat-card gaps, glass-panel padding consistent in dashboard/leads/pipeline screenshots | n/a — clean |
| **Modals** | Pipeline Add-Lead slideover renders with correct backdrop and scale-in animation; `XMarkIcon` close positioned consistently (`qa-2026-05-09-add-lead-modal.png`) | n/a — clean |

## Bugs Fixed (Run 22)

None. The s1 agent's expanded harness exercised 12 previously-untested
endpoints and all 12 returned the correct status codes (10 × 400, 1 × 404,
1 × 200 for the idempotent onboarding/complete). No production 5xx surfaced;
no UI regressions surfaced before s2/s3/s4 hit max_turns.

## Known Issues (Not Fixed)

Carry-overs unchanged from Run 21 (Run 21's Hearth-webhook security
observation remains the most recent new finding):

1. **Heavy-work guards** on `POST /drift/correct-all`,
   `POST /properties/trigger-import`, and `POST /crm/leads/score-all` —
   accept empty bodies, immediately trigger full job. Tracked since Run 11.
   (`properties/fema-live-polygon`, `properties/fema-live`, and
   `counties/:id/import` previously listed as heavy-work were verified to
   have early guards this run and added to harness coverage.)
2. **`form-audit.json` cleanup** — 16 search-input fields lack `.form-input`
   class. Cosmetic. Tracked since Run 13.
3. **Pre-token-attach 401 noise** — three endpoints
   (`/api/properties/import-progress`, `/api/notifications/unread-count`,
   `/api/crm/tenant-settings`) fire before axios auth interceptor on every
   fresh page load. Console-only noise. Tracked since Run 16. Fixable by
   setting `axios.defaults.headers.common['Authorization']` synchronously
   from `localStorage` on app boot.
4. **Reports chart label overlap** at ~930 px viewport width — "Conversion
   By Source" title wraps awkwardly into the CSV badge. Cosmetic.
5. **404 response shape** — Express HTML 404 for method-not-allowed (e.g.
   `PATCH /api/crm/tenant-settings`) vs JSON elsewhere. Cosmetic.
6. **Currency-format anti-pattern sweep** — Run 14 fixed two; LeadDetail
   Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView
   totals still un-audited.
7. **`DELETE /api/documents/:id` shape** — returns 200 `{ deleted: false }`
   for missing rows; sibling DELETEs return 404 `{ error }`. Cosmetic.
   Tracked since Run 20.
8. **`GET /api/skip-trace/job/:jobId` returns 503** when `TRACERFY_API_KEY`
   unset — intentional graceful-degrade, not a bug. Working as coded since
   Run 14.
9. **Hearth webhook permissive on missing fields** — `POST /api/webhooks/hearth`
   with empty body returns 200 `{status:"ignored",reason:"no application_id"}`
   instead of 400. Suggests `handleWebhook` may not strictly verify
   signature when body fields are missing. Worth a future security audit;
   out of scope this run. Tracked since Run 21.
10. **Admin super-panel** — requires global `super_admin` role to fully
    exercise; not testable from a tenant account.
11. **Email-send endpoints** — `/crm/test-email`, `/invoices/:id/send-email`
    need SMTP configuration for live delivery testing.
12. **Webhook signature paths** — `/webhooks/tracerfy`, `/webhooks/hearth`,
    `/payments/webhook` empty-body paths covered (Run 21); valid-signature
    delivery paths still need real signing keys.
13. **File upload paths** — `POST /documents/upload` no-file path covered
    this run (Run 22); success path with a real binary fixture still
    untested. `POST /properties/import-csv` empty-rows path covered this
    run; success path intentionally skipped per "no bulk DB writes".
14. **CSV export download** — verified by 200 status only, not by binary
    content-type and download triggering.
15. **QuickBooks, Twilio, Stripe integrations** — not implemented
    (pre-existing, not regressions).

## Test Coverage Gaps

- **Browser-interactive write flows** absent since Run 6 — drag a kanban
  card, create a lead end-to-end, record an invoice payment, toggle a
  work-order milestone, upload a document. Biggest remaining gap (16 runs).
- **Mobile responsive sweep** at 375 px and 768 px — none performed since
  Run 6.
- **Multipart upload SUCCESS path** — `POST /documents/upload` with a real
  PNG/PDF and `POST /properties/import-csv` with a real row would need a
  small `qa-fixtures/` directory and FormData support in the harness
  `call()`.
- **Stripe / Tracerfy live-call paths** — would require sandbox accounts
  and signing keys.
- **Onboarding `create-tenant`** — destructive (one-time per tenant), not
  safe to add to the regression harness.
- **Heavy-job body guards** — `POST /drift/correct-all`,
  `POST /properties/trigger-import`, `POST /crm/leads/score-all` accept
  empty bodies and fire work. Each is auth-only and tenant-scoped (limited
  blast radius), but a `?confirm=true` body sentinel would prevent
  accidental fires.
- **Pages not walked Run 22** — `/storm-catalog`, `/content-studio`, all
  12 `/settings/*` tabs.

## Session Integrity

| Stage | Outcome | Turns | Output tokens | Cost (USD) | Commits |
|---|---|---:|---:|---:|---|
| s1 api-test | **completed** | 41 | 24 335 | 3.02 | 1 (`7169023`) |
| s2 frontend-test | error_max_turns | 81 | 21 227 | 4.33 | 0 (12 screenshots produced) |
| s3 ui-audit | error_max_turns | 61 | 20 493 | 3.85 | 0 |
| s4 verify | error_max_turns | 41 | 7 349 | 2.03 | 0 (4 screenshots produced) |
| s5 report | 0 bytes | 0 | 0 | 0.00 | 0 (this report written in a follow-up session) |
| **Total** | | | **73 404** | **~13.23** | **1** |

- s1 fully completed for the **fourth consecutive run** (Runs 19–22).
- s2 hit max_turns at 81 but **walked all 12 primary routes** before
  exhaustion — best s2 outcome since Run 18.
- s5 has been 0 bytes for **14 consecutive runs** since Run 8 — recommend
  folding into s4 with a longer turn budget, or dropping entirely.
- **Eight consecutive runs** now where every fix landed as a real commit on
  HEAD before the report was written.

## Final build check

`cd /c/Projects/stormleads/client && npx vite build` — passes (re-verified
during s1 prior to commit `7169023`; re-run at end of this report write).

## Files in this report

- `OVERNIGHT-REPORT.md` (this file)
- `docs/overnight-history.md` (appended)
- `qa-api-test-results.json` (~95 KB, 265 endpoints, full per-endpoint payload previews)
- `qa-api-test.mjs` (harness, +33 lines for the 12 new endpoints)
- `qa-2026-05-09/` — 12 frontend screenshots from s2 (all primary routes)
- `qa-2026-05-09-{dashboard,leads,pipeline,add-lead-modal}.png` — 4 verify screenshots from s4
- `claude-overnight-20260509-s{1..5}-*.json` — per-stage orchestrator metadata
