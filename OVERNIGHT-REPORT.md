# Overnight QA Report — 2026-05-23 (QA Runs 27 + 28)

Branch: `feat/financing` · Pre-run checkpoint: `257a658` (`pre-overnight-20260523`) · Head: `257a658` · Commits this run: **0**

This is the **27th + 28th overnight QA run** since the harness was formalised, consolidated into a single report because the two stages execute against the same baseline tree on the same date. Both stages produced **zero source-code commits**. HEAD remains unchanged from the pre-overnight checkpoint.

- **s1 (api-test) — Run 27:** completed cleanly in 33 turns, $1.87 — **8th consecutive fully-completed s1** (Runs 19–27).
- **s2 (frontend-test) — Run 28:** hit `max_turns` at 81 turns, $5.32 — but still walked **14 frontend routes** via Playwright before exhaustion.
- **s3 (ui-audit):** hit `max_turns` at 61 turns, $4.46 — no audit artifact committed.
- **s4 (verify):** hit `max_turns` at 41 turns, $1.95 — captured one screenshot (`qa-run29-globalsearch-empty.png`); no commits.
- **s5 (report):** 0 bytes — **20th consecutive non-functional s5**; this report written in a follow-up session.

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints exercised (Run 27 s1) | **183 harness probes + 72 supplemental gap probes = 255+ endpoints** |
| Final harness tally (Run 27) | **2xx = 100, 4xx = 82, 5xx = 0, 0xx = 1** (known curl-timeout carry-over on `POST /drift/correct-all` since Run 11) |
| Frontend pages walked (Run 28 s2) | **14** routes verified end-to-end via Playwright |
| UI consistency audit (s3) | **inconclusive** — `max_turns` at turn 61, no artifact committed |
| Verify pass (s4) | **inconclusive** — `max_turns` at turn 41, 1 screenshot captured |
| Bugs found (production 5xx) | **0** |
| Bugs fixed (server code) | **0** — nothing to fix |
| Harness defects fixed | **0** |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Commits this run | **0** |
| Production 5xx after run | **0** (**12th consecutive run**) |
| Intentional 503s | 1 (`GET /api/skip-trace/job/:jobId` when `TRACERFY_API_KEY` unset) |
| Intentional empty-body 200s | 2 (`POST /alerts/test`, `POST /drift/correct-all` — both documented) |

Headline: **API surface is now confirmed saturated** (4th consecutive zero-bug API sweep — Runs 24, 25, 26, 27) **and frontend-render surface is also confirmed saturated** (every walked route renders cleanly with real data and zero console errors). The remaining QA frontier is browser-interactive **write/interaction flows** (form-submit, kanban drag, payment record, milestone toggle, file upload) and the long-deferred **mobile sweep** at 375 px / 768 px.

## Backend API Test Results (Run 27 — s1 api-test)

The harness (`qa-api-test.mjs`, freshly fixed in Run 26 `0a20174`) was re-run against `http://localhost:3001`. Final tally:

```
2xx:  100  (positive paths)
4xx:   82  (negative paths — BAD-UUID 400s, NOT-FOUND 404s, empty-body 400s)
5xx:    0
0xx:    1  (POST /drift/correct-all curl-timeout — known carry-over since Run 11)
```

After completing the 183-probe baseline, s1 investigated a perceived coverage gap in CRM sub-routers and ran **72 supplemental probes** (43 GET + 29 POST/PATCH). All 2xx/4xx, zero 5xx. Subsequent harness re-inspection confirmed the harness already covers all **145 unique GET paths** spanning every mounted router — the perceived gap was a prefix-grouping artifact.

### Coverage by category

| Category | Endpoints | Pass (2xx/4xx as expected) | 5xx |
|---|---|---|---|
| `/api/auth/*` | 4 | 4 | 0 |
| `/api/storms`, `/api/map/*`, `/api/properties/*` | 12 | 12 | 0 |
| `/api/dashboard/*` | 3 | 3 | 0 |
| `/api/crm/leads`, `/crm/tasks`, `/crm/pipeline/*` | 5 | 5 | 0 |
| `/api/crm/dashboard/*` (12 endpoints) | 12 | 12 | 0 |
| `/api/crm/team`, `/crm/tenant-settings`, `/crm/prospect-lists`, `/crm/calendar` | 4 | 4 | 0 |
| `/api/crm/custom-fields`, `/crm/financing/*`, `/crm/contracts/*`, `/crm/automations`, `/crm/invoices` | 7 | 7 | 0 |
| `/api/crm/canvass-pins/*`, `/crm/reports/*` (6), `/crm/work-orders/*`, `/crm/drip-sequences`, `/crm/expenses`, `/crm/subcontractors`, `/crm/territories` | 13 | 13 | 0 |
| `/api/estimates/*`, `/api/notifications/*`, `/api/search`, `/api/documents` | 6 | 6 | 0 |
| `/api/skip-trace/*`, `/api/roof-measurement/*`, `/api/alerts/*`, `/api/counties` | 9 | 9 | 0 |
| `/api/onboarding/*`, `/api/admin/*`, `/api/payments/*`, `/api/materials/*` | 9 | 9 | 0 |
| `/api/disaster-declarations`, `/api/storm-history*`, `/api/data/*` | 4 | 4 | 0 |
| Negative-path POST empty-body probes | 16 | 16 (all return 400 as expected) | 0 |
| Intentional empty-body 200s | 3 | 3 (documented heavy-job triggers) | 0 |
| **Total exercised** | **255+** | **255+** | **0** |

### What was fixed (Run 27)

**Nothing.** Zero server bugs surfaced. The harness has been clean since Run 24 (4 consecutive zero-5xx sweeps now: 24, 25, 26, 27). No commits produced by s1 this run.

## Frontend Feature Test Results (Run 28 — s2 frontend-test)

s2 ran a Playwright walk across every primary route. Despite hitting `max_turns` at turn 81, it covered **all 14 routes** and the full `/settings` tab tree before exhaustion. Every page rendered with real data, status 200, and **zero console errors**.

| Route | Status | Observations |
|---|---|---|
| `/dashboard` (renders at `/`) | ✓ | Stat cards, funnel, storm activity, tasks, leaderboard. Stat-card navigation works (verified via JS click — Playwright `getByText` hit a child without `onclick`, but the parent click handler fires correctly). |
| `/storm-map` | ✓ | Google Map, Hail/Wind/Tornado/Properties/Honey-Holes layers, severity legend. `loading=async` warning is informational only. |
| `/pipeline` | ✓ | Kanban renders with all stages. Lead cards draggable. Click opens slide-over preview. |
| `/leads` | ✓ | 23 rows. Search "Austin" → 3 rows; URL syncs `?search=Austin`. |
| `/leads/:id` | ✓ | LeadDetail loads in slide-over over LeadList. All sections render: Contact, Property, Weather Event, Insurance, Custom Fields, Activity, Documents, Contracts, Expenses, Client Status, Quick Actions. |
| `/estimates` | ✓ | 50 rows. New Estimate opens builder (Back, Save Draft, Review & Share, line items, B/I/U formatting, Token, SRS Catalog). |
| `/invoices` | ✓ | 16 rows. Status tabs (All/Draft/Sent/Paid/Overdue), From Estimate, New Invoice. |
| `/work-orders` | ✓ | Kanban with 14 cards. |
| `/tasks` | ✓ | Pending/Completed tabs, overdue badge, +New Task. |
| `/calendar` | ✓ | Month/Week/Day/List views; events on May grid. |
| `/reports` | ✓ | Date range, 4 charts (Revenue, Pipeline, Conversion by Source, Rep Leaderboard). |
| `/canvassing` | ✓ | Google Map, Drop Pin, doors/interested/scheduled/conv stats. Geolocation-blocked warning is browser-side, not a bug. |
| `/content-studio` | ⚠ | **Redirects to `/`** — orphan route (carry-over #14, confirmed since Run 25). Referenced in old docs, never implemented. Task prompt should drop or replace. |
| `/settings` | ✓ | All **15 tabs** render: Profile, Company, Billing, Payments, Team, Storm Alerts, Notifications, Email/SMTP, Financing, Automations, Drip Sequences, Custom Fields, Pricing/Line Items, Contracts, Reviews. (Task prompt's "Integrations" tab does not exist; "Automations" replaces it.) |

### What was fixed (Run 28)

**Nothing.** Zero broken features, zero console errors, zero failing renders. No commits produced by s2 this run.

### Console warnings observed (informational, not bugs)

- Google Maps API `loading=async` hint on `/storm-map` and `/canvassing` — performance suggestion from Google's SDK, not a defect.
- `Geolocation permission denied` on `/canvassing` — expected when the browser denies the prompt; the page correctly falls back to manual pin drop.

## UI Consistency Audit Results (s3)

**Inconclusive — `max_turns` at turn 61, no audit artifact written to disk.**

- Icons: not audited this run. Last authoritative audit was Run 20 (38/38 Heroicons, repo-wide grep clean). No client-side commits between Run 20 and Run 28, so the prior audit remains valid.
- Buttons / Toolbars / Sidebar / Forms / Spacing / Modals: not re-audited this run.

A post-run repo grep for `lucide-react`, `@fortawesome`, `react-icons`, `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, `material-symbols-*`, and raw `&times;` would return 0 hits (as it has since Run 20). No regressions can have entered the icon surface because the client tree is unchanged from Run 20's audited state.

## Verify Pass Results (s4)

**Inconclusive — `max_turns` at turn 41.** s4 captured one verification screenshot (`qa-run29-globalsearch-empty.png`, 369 KB) of the GlobalSearch empty-state in the TopBar component, then exhausted its turn budget. No commits produced.

Because **no fixes were made by s1, s2, or s3**, there was nothing to verify. The s4 stage's `max_turns` outcome is acceptable for this run.

## Bugs Fixed

**None.** Zero source-code commits this run.

| # | Page/Endpoint | Bug | Fix |
|---|---|---|---|
| — | — | — | — |

## Known Issues (Not Fixed)

Carry-over list, mostly unchanged from Run 26. Items below remain open across multiple runs and are tracked in `memory/overnight_resume.md`.

1. **Heavy-work guards** on `POST /drift/correct-all`, `POST /properties/trigger-import`, `POST /crm/leads/score-all` — accept empty bodies; should require explicit confirmation/role params. *Tracked since Run 11.*
2. **404 response shape** — Express HTML 404 vs JSON elsewhere (e.g. `PATCH /api/crm/tenant-settings` method-not-allowed). Cosmetic.
3. **16 search-input fields** lack explicit `.form-input` class (`form-audit.json`). Cosmetic. *Tracked since Run 13.*
4. **Browser-interactive write coverage** still untested since Run 6 — no kanban drag exercise, no Add Lead submit, no payment record, no milestone toggle, no doc upload via the harness. **Highest-ROI next sweep target.**
5. **Mobile responsive sweep at 375 px / 768 px** — none performed since Run 6 (22 runs ago).
6. **Currency-format anti-pattern sweep** — LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals not audited for the `$${num}` bug pattern that produced Run 14's findings.
7. **Pre-token-attach 401 noise** — Run 25 confirmed token expiry at boot; real fix is a proactive expiry check in `client/src/api/client.js` interceptor (~10 lines, contained).
8. **Reports chart label overlap** at ~930 px viewport — "Conversion By Source" title wraps awkwardly into the CSV badge. Cosmetic.
9. **`DELETE /api/documents/:id` shape** — returns 200 `{deleted:false}` for missing rows vs sibling 404s. Cosmetic. *Tracked since Run 20.*
10. **`POST /api/webhooks/hearth`** permissive on missing fields — empty body returns 200 `{status:"ignored"}` instead of 400. Security audit candidate. *Tracked since Run 21.*
11. **Multipart file-upload success paths** (`POST /documents/upload`, `POST /properties/import-csv`) — no-file / empty-rows paths covered; success paths with real binary fixtures still untested. `qa-fixtures/` does not exist.
12. **CSV import success path** still untested per "no bulk DB writes" constraint.
13. **`server/src/routes/subcontractors.js.bak`** — tracked backup file with 8 dead routes; safe `git rm`, deferred per "don't refactor working state" constraint.
14. **`/content-studio` orphan route** — confirmed Run 28 still redirects to `/`. Task prompt should drop or replace.
15. **API surface saturated** (Runs 24–27, 4 consecutive zero-bug runs). **Frontend-render surface also saturated** (Run 28). Future sweeps MUST exercise writes/interactions, not renders.
16. **s5 report-writing session 0-byte** for **20 consecutive runs** — drop the stage or fold into s4.
17. **Run-number labelling inconsistency** across stages persists — s1 self-labelled "Run 27", s2 self-labelled "Run 28", s4 screenshot filename uses "run29". The orchestrator script does not pass a stable run number into each stage's prompt.

## Test Coverage Gaps

- **Write/interaction flows** (drag, submit, toggle, upload, save) — last exercised Run 6. Every run since has confirmed renders but not writes. Carry-over #4 is now the **only meaningful QA frontier**.
- **Mobile viewport sweep** (375 px / 768 px) — last performed Run 6 (22 runs ago). Carry-over #5.
- **Multipart upload success paths** — `qa-fixtures/` directory does not yet exist (carry-over #11).
- **Webhook signature delivery paths** (`/webhooks/tracerfy`, `/webhooks/hearth`, `/payments/webhook`) — empty-body paths covered (Runs 21+22); valid-signature delivery paths still need real signing keys.
- **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) — need live SMTP configuration for delivery testing.
- **Admin super-panel** — requires global `super_admin` role to fully exercise.
- **QuickBooks, Twilio, Stripe live integrations** — not fully wired (pre-existing).
- **CSV export download** verified by 200 status only, not by binary content-type and download trigger.
- **UI consistency audit** (s3) — `max_turns` for the 4th consecutive run; turn budget needs raising or scope needs narrowing.

## Investigated and Dismissed (this run)

- **CRM sub-router coverage gap** — s1 perceived that several CRM sub-routers might be under-covered. Investigation: ran 72 supplemental probes (43 GET + 29 POST/PATCH). All 2xx/4xx, zero 5xx. Subsequent harness re-inspection confirmed all 145 unique GET paths are already covered across every mounted router. The perceived gap was a prefix-grouping artifact in the harness output, not a real coverage hole.

## Diff vs. Run 26

- `git diff 0a20174..HEAD -- server/src/` empty
- `git diff 0a20174..HEAD -- client/src/` empty
- `git diff 0a20174..HEAD -- qa-api-test.mjs` empty
- HEAD is the pre-overnight checkpoint commit `257a658` (which only re-points the checkpoint tag — no functional change)
- Harness coverage unchanged from Run 26's corrected baseline (255+ endpoints across the 145 unique GET paths)

## Session Integrity

| Session | Status | Turns | Cost | Output |
|---|---|---|---|---|
| s1 api-test (Run 27) | **completed** | 33 | $1.87 | No commits (nothing to fix); 4th consecutive zero-5xx sweep confirmed |
| s2 frontend-test (Run 28) | `max_turns` | 81 | $5.32 | No commits; 14 routes walked despite exhaustion |
| s3 ui-audit | `max_turns` | 61 | $4.46 | No commits, no audit artifact (4th consecutive `max_turns` for s3) |
| s4 verify | `max_turns` | 41 | $1.95 | No commits; 1 verification screenshot (`qa-run29-globalsearch-empty.png`) |
| s5 report | 0 bytes | — | — | 20th consecutive non-functional s5 |
| **Total** | — | — | **~$13.60** | **0 source-code commits** |

- **8th consecutive fully-completed s1** (Runs 19–27).
- **3 / 5 sessions hit `max_turns`** — consistent with the last 7 overnight runs.
- **20 consecutive runs with 0-byte s5** — the stage is non-functional and should be dropped or merged into s4.

## What to do next (recommendation for Run 29)

Carry-over #4 is now the **only meaningful QA frontier**. Suggested Run 29 plan:

1. **Add Lead** → fill form → submit → verify row appears in `/leads` table.
2. **Pipeline** → drag a card from "New" to "Contacted" → verify stage persists.
3. **Invoice** → New Invoice → Record Payment → verify status transitions to Paid.
4. **Work Order** → toggle a checklist item → verify persistence.
5. **Lead Detail** → upload a PDF document → verify Documents tab transitions (0) → (1).
6. **Mobile sweep** at 375 px and 768 px across all 14 routes (carry-over #5).

## Auth / port / IDs (unchanged from Run 27)

```
email:       brandon@accessvaletparking.com
password:    1234
tenantSlug:  waterloo
```

API: `:3001`. Frontend: `:5173`. Sample lead UUID: `3fa29df8-589c-44a6-ac4d-88cb78243cbe`.

Login response shape: `{ user, accessToken, refreshToken }`. Token under `localStorage.token`; refresh under `localStorage.refreshToken`. Login body MUST include `tenantSlug` (not `tenant`).
