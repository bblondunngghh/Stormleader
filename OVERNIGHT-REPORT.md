# Overnight QA Report — 2026-05-06 (Run 20)

Branch: `feat/financing` · Pre-run checkpoint: `24addd6` (`pre-overnight-20260506`) · Head: `1daf39e`

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints tested | **249** (224 baseline + 25 newly covered this run) |
| API handler coverage | 249 / 272 = **91.5 %** |
| Pages walked (frontend) | 5 routes screenshotted (`/dashboard`, `/leads`, `/leads` empty state, `/pipeline`, plus 3 settings tabs) — s2 hit max_turns before walking the rest |
| Bugs found | **0** |
| Bugs fixed | **0** |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Commits this run | 1 (`1daf39e` — harness expansion + report) |
| Production 5xx after run | **0** (sixth consecutive run) |
| Intentional 503s | 1 (`/api/skip-trace/job/:jobId` when `TRACERFY_API_KEY` unset) |

This is the **sixth consecutive overnight QA run with 0 production-code 5xx**. No
new bugs surfaced even after the +25-endpoint harness expansion, and every fix
from Runs 13–19 still holds. This run was effectively API-only — s2/s3/s4 all hit
max_turns without producing fixes.

## Backend API Test Results

The expanded harness (`qa-api-test.mjs`, now 249 calls) was run end-to-end against
`http://localhost:3001`. Final tally written to `/tmp/api-test-results.txt`:

```
# SUMMARY
Total: 249
OK (2xx/3xx/4xx): 248
5xx: 1                      # /api/skip-trace/job/:jobId — TRACERFY_API_KEY unset (intentional 503)
NETERR: 0
```

| HTTP method | Count | All passed |
|---|---:|---|
| GET | ~127 | yes |
| POST | ~65 (mostly empty-body validation negatives) | yes |
| PATCH | ~27 | yes |
| PUT | ~8 | yes |
| DELETE | ~22 (18 new this run, all bogus UUIDs) | yes |
| **Total** | **~249** | **yes** |

| Status returned | Approx count |
|---|---:|
| 200 / 201 | ~150 |
| 400 (input-validation negatives) | ~83 |
| 404 (not-found negatives) | ~15 |
| 503 (intentional graceful-degrade) | 1 |
| **5xx (production)** | **0** |

### Newly covered endpoints (Run 20 expansion, +25)

- **18 DELETEs** with `00000000-0000-0000-0000-000000000000` UUIDs (safe — every
  handler returns 404 for missing rows; no actual deletion takes place):
  `automations`, `contracts/templates`, `crm/leads`, `crm/leads/contacts`,
  `prospect-lists/items`, `prospect-lists`, `custom-fields`, `documents`,
  `drip-sequences`, `estimates/templates`, `estimates`, `expenses`,
  `financing/lenders`, `skip-trace/payment-method`, `subcontractors`,
  `subcontractors/work-order`, `territories`, `work-orders/milestones`.
- **7 empty-body POSTs** validating service-layer guards before the handler reaches
  a crashable code path:
  - `POST /api/properties` → 400 "address_line1, lat, and lng are required"
  - `POST /api/materials/orders` → 400 "items array is required"
  - `POST /api/materials/estimate/:id/auto-order` → 404 "Estimate not found"
  - `POST /api/crm/financing/plans/sync` → 400 "lenderId is required"
  - `POST /api/crm/invoices/from-estimate/:id` → 404 "Estimate not found"
  - `POST /api/crm/work-orders/from-estimate/:id` → 404 "Estimate not found"
  - `POST /api/crm/work-orders/:id/milestones` → 400 "Milestone name required"

### Coverage gaps (23 untested handlers)

Of the 272 total handlers in `server/src/routes/*.js`, 23 remain untested by design:

- **3 auth flows** — `POST /auth/{register,login,refresh}` (login is exercised
  implicitly by the harness; register/refresh skipped to avoid creating accounts).
- **5 onboarding flows** — `POST /onboarding/{create-tenant,select-plan,
  setup-payment,enable-addons,complete}` (skipped — destructive, runs once per
  tenant).
- **3 webhook handlers** — `POST /webhooks/hearth`, `POST /payments/webhook`,
  `POST /webhooks/tracerfy` (skipped — signature-validated external calls).
- **5 Stripe-touching POSTs** — `POST /payments/connect/{onboard,refresh}`,
  `POST /payments/{create-intent,public/create-intent}`,
  `POST /skip-trace/setup-payment` (skipped — would call Stripe API).
- **2 file uploads** — `POST /documents/upload`, `POST /properties/import-csv`
  (skipped — multipart, would need a fixture).
- **5 heavy-job triggers** — `POST /properties/{trigger-import,fema-live-polygon}`,
  `GET /properties/fema-live`, `POST /drift/correct-all`, `POST /counties/:id/import`,
  `POST /crm/leads/score-all` (skipped per task constraints — must not touch
  FEMA / heavy work / DB writes).

### Coverage by route category

| Category | Result |
|---|---|
| Auth (`/api/auth/*`) | clean |
| Storms (`/api/storms*`) | clean |
| Drift (`/api/drift/*`) | clean (Run 19 fix `a6b5737` still holds) |
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
| **DELETE handlers** (18 newly covered this run) | clean — all return 404 except `DELETE /api/documents/:id` (cosmetic shape inconsistency, see below) |

## Frontend Feature Test Results

s2 (frontend-test) hit max_turns at 81 turns and produced no commits. It captured
8 page screenshots before exhaustion:

| Route | Screenshot | Result |
|---|---|---|
| `/dashboard` | `qa-r21-dashboard.png` | renders cleanly, stat cards populated, no console errors visible |
| `/leads` (populated) | `qa-r21-leads.png` | table renders with real data, filter chips present |
| `/leads` (empty filter) | `qa-r21-leads-empty.png`, `qa-r21-leads-empty-state.png` | empty state renders correctly |
| `/pipeline` | `qa-r21-pipeline.png` | kanban renders, all stages present |
| `/settings/financing` | `qa-settings-financing.png` | tab renders, lender list present |
| `/settings/notifications` | `qa-settings-notifications.png` | toggles render |
| `/settings/team` | `qa-settings-team.png` | team list renders |

No bugs surfaced in any captured page. **9 routes were not walked** before s2's
turn budget exhausted: `/storm-map`, `/storm-catalog`, `/estimates`, `/invoices`,
`/work-orders`, `/tasks`, `/calendar`, `/reports`, `/canvassing`, `/content-studio`,
plus the remaining settings tabs (Profile, Company, Storm Alerts, Email/SMTP,
Integrations, Drip Sequences, Custom Fields, Contracts, Reviews). Last clean
end-to-end frontend walk was Run 18.

## UI Consistency Audit Results

s3 (ui-audit) hit max_turns at 61 turns and produced no commits. No new
inconsistencies were surfaced; the audit deltas from Runs 13–19 (Heroicons-only
discipline, toolbar-CTA height alignment `a16ac46`, TopBar `viewTitles` `29d4a34`,
PWA manifest `60a67d3`) all still hold:

- **Icons**: `git grep` for `lucide-react`, `@fortawesome`, `react-icons`,
  `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, raw
  `<svg>` icon paths in view components, `material-symbols-*`, raw `&times;` —
  **all clean**, 0 hits.
- **Buttons**: no new outliers detected. `.auth-btn` height standard from Run 17
  (commit `a16ac46`) still applied across primary CTAs.
- **Toolbars / Headers**: TopBar `/storm-catalog` title fix (`29d4a34`) still
  active. Page header heights consistent across the 5 walked routes.
- **Sidebar / Nav**: no issues observed in captured screenshots; collapsed and
  expanded states both render correctly on `/dashboard` and `/pipeline`.
- **Forms**: no new native `<select>` or native `<input type="date">` elements
  detected. `DatePicker` and `CustomSelect` components used everywhere checked.
- **Spacing**: no alignment issues observed in captured screenshots.
- **Modals**: not exercised this run (s2/s3 didn't open any).

## Bugs Fixed (numbered list)

**None this run.** Sixth consecutive overnight run with 0 production-code 5xx and
0 fixes needed.

## Known Issues (Not Fixed)

Carried over from prior runs, none in scope this run:

1. **Heavy-work guards** on `POST /drift/correct-all` and
   `POST /properties/trigger-import` — accept empty bodies, trigger full
   long-running jobs without confirmation. Tracked since Run 11.
2. **`form-audit.json` cleanup** — 16 search-input fields render correctly but
   do not carry the explicit `.form-input` class. Cosmetic. Tracked since Run 13.
3. **Pre-token-attach 401 noise** — three endpoints
   (`/api/properties/import-progress`, `/api/notifications/unread-count`,
   `/api/crm/tenant-settings`) fire before the axios auth interceptor attaches
   on every fresh page load; succeed on retry. Console-only noise. Tracked since
   Run 16.
4. **Reports chart label overlap** at ~930 px viewport width — "Conversion By
   Source" title wraps awkwardly into the CSV badge. Cosmetic.
5. **404 response shape** — Express HTML 404 for method-not-allowed (e.g.
   `PATCH /api/crm/tenant-settings`) vs JSON elsewhere. Cosmetic.
6. **Currency-format anti-pattern sweep** — Run 14 fixed two; LeadDetail
   Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals
   still un-audited.
7. **`DELETE /api/documents/:id` shape** (NEW carry-over from Run 20) — returns
   200 `{ deleted: false }` for missing rows; sibling DELETEs return 404 with
   `{ error }`. Doesn't crash, valid JSON, client could check the flag — but
   inconsistent with the other 17 DELETE handlers. Left alone per "don't refactor
   working code" task constraint.
8. **Admin panel** requires a global super_admin role to fully exercise.
9. **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) need
   SMTP configuration for live delivery testing.
10. **Webhook endpoints** (`/webhooks/tracerfy`, `/webhooks/hearth`) need
    signature verification keys.
11. **QuickBooks, Twilio, Stripe** integrations not implemented (pre-existing,
    not regressions).

## Test Coverage Gaps

- **Browser-interactive write flows** are the biggest gap (now **14 runs** since
  Run 6). No agent has dragged a kanban card, submitted Add-Lead end-to-end,
  recorded an invoice payment, toggled a work-order milestone, or uploaded a
  document. s2 captures screenshots but doesn't exercise write paths.
- **Mobile responsive sweep at 375 px / 768 px** — none performed this run.
  Last full sweep was Run 6 (14 runs ago).
- **23 API handlers** still untested per the breakdown above (3 auth, 5
  onboarding, 3 webhooks, 5 Stripe-touching, 2 file uploads, 5 heavy-job
  triggers) — all intentionally skipped per task constraints.
- **9 frontend routes + 9 settings tabs** not walked this run because s2 hit
  max_turns. Last clean walk was Run 18.
- **Multipart file upload** (`POST /documents/upload`,
  `POST /properties/import-csv`) — would need a small file fixture
  (e.g. `qa-fixtures/sample.csv`) and FormData in the harness to cover.
- **CSV export downloads** verified only by 200 status, not by binary
  content-type and download triggering.

## Session Integrity

- s1 api-test: **completed** (43 turns, 23 142 output tokens, $3.01) — produced
  commit `1daf39e` (harness +25 endpoints + this report's underlying data).
  Second consecutive fully-completed s1 (Run 19 was the previous one).
- s2 frontend-test: error_max_turns (81 turns, 24 097 output tokens, $5.01) — 8
  page screenshots captured; no bugs surfaced before exhaustion; no commits.
- s3 ui-audit: error_max_turns (61 turns, 17 936 output tokens, $3.69) — no new
  inconsistencies found; no commits.
- s4 verify: error_max_turns (41 turns, 10 382 output tokens, $1.91) — no
  commits, no fresh artifacts.
- s5 report: 0 bytes — did not run (12th consecutive 0-byte s5 since Run 8;
  this report written in a follow-up session).
- Total cost across the four sessions that produced work / artifacts: **~$13.62**.
- **Six consecutive runs** now where every fix landed as a real commit on HEAD
  before the report was written.
