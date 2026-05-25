# Overnight QA Report — 2026-05-25 (Runs 31 + 32)

Branch: `feat/financing`  ·  Baseline: `00f507f` (`pre-overnight-20260525`)  ·  Final HEAD: `01e9ec4`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages walked (UI consistency audit) | 19 |
| API endpoints exercised | 41 (regression) + 3 CRUD round-trips + targeted edge-case probes |
| Bugs found | 5 |
| Bugs fixed | 5 (4 backend, 1 UI) |
| UI inconsistencies found | 1 |
| UI inconsistencies fixed | 1 |
| Commits landed | 2 (`76fc4f9`, `01e9ec4`) |
| Files modified | 5 |
| Production 5xx during sweep | 0 (14th consecutive zero-5xx run) |

## Backend API Test Results

Single API session (s1). 41-endpoint regression sweep + 3 CRUD round-trips (leads, tasks, documents) + targeted edge-case probes on the 4 named carry-overs from 2026-05-24.

| Category | Tested | Passed | Failed | Fix |
|---|---|---|---|---|
| Auth | 3 | 3 | 0 | — |
| CRM leads | 8 | 8 | 0 | — |
| CRM tasks | 4 | 4 | 0 | — (new finding: no DELETE handler — see Known Issues) |
| Estimates / financing | 6 | 6 | 0 | Public-token routes now 404 (`76fc4f9`) |
| Documents | 4 | 4 | 0 | DELETE now 404 on missing rows (`76fc4f9`) |
| Storms / properties | 6 | 6 | 0 | Postgres 22P02 sanitized (`76fc4f9`) |
| Notifications / search / settings | 5 | 5 | 0 | — |
| Catch-all / 404 shape | 5 | 5 | 0 | Unmatched `/api/*` now JSON (`76fc4f9`) |

All 4 fixes shipped in one commit. End-to-end re-tested with curl after each edit (positive and negative cases). Final 41-endpoint regression sweep: 0 5xx, 0 transport errors.

## Frontend Feature Test Results

s2 (frontend-test) and s4 (verify) both hit `max_turns` and produced no commits, but generated 8 screenshots and exercised the read paths below.

| Page | Tested | Result | Notes |
|---|---|---|---|
| Dashboard `/` | Render + stat cards + activity feed | PASS | Screenshot `qa-run32-01-dashboard.png` |
| Pipeline `/pipeline` | Render + stage column counts | PASS | Screenshot `qa-run32-02-pipeline.png`; kanban drag-to-persist still unverified |
| Leads `/leads` | List render + filter chips + page-size pills | PASS | Screenshot `qa-run32-03-leads.png` |
| Estimates `/estimates` | List + status pills | PASS | Screenshot `qa-run32-estimates-list.png` |
| Expenses `/expenses` | Page header + glass panel | PASS | Screenshot `qa-run32-expenses-header.png` |
| Subcontractors `/subcontractors` | List + compact pagination | PASS | Screenshot `qa-run32-subcontractors.png` |
| Add Lead modal | Open + backdrop blur | PASS | Screenshot `qa-run32-modal-addlead.png` |
| Task modal | Open + form fields | PASS | Screenshot `qa-run32-modal-task.png` |

**Still needs attention:** Browser-driven *write* flows (Add Lead submit, kanban drag persist, Invoice → Record Payment, Work Order checklist toggle, document upload, mobile 375/768 px sweep) — open carry-over from Run 29.

## UI Consistency Audit Results

Audit ran as s3 over all 19 authenticated routes; metrics dumped to `btn-audit.txt`, `primary-btns.txt`, `header-audit.txt`, `form-audit.txt`, `spacing-audit.txt`.

| Audit | Result | Action |
|---|---|---|
| Icons | All Heroicons outline. The 9 SVGs on `/reports` are Recharts library chart elements (not UI icons). | PASS — no fixes needed |
| Primary buttons | `auth-btn`: 36 px / 14 px-12 px radius / oklch(0.72 0.19 250). Consistent across every page. | PASS |
| Secondary buttons | `quick-action-btn`: 36 px / 14 px-12 px radius / oklch(0.18 0.03 265 / 0.5). Consistent. | PASS |
| Compact button variants | Pagination pills h=21 (`/leads`), Prev/Next h=25 (`/subcontractors`) — intentional compact variants. | PASS |
| Headers / toolbars | `topbar.glass` measured **exactly 56 px** on all 19 pages, identical bg / border tokens. | PASS |
| Sidebar / nav | Nav links 42 px, 12 px-16 px padding, 13.5 px font, weight 500 (active 600). All carry a Heroicon. | **1 fix** — Admin link had an inline color override; now uses standard `.nav-link.is-active` (`01e9ec4`) |
| Forms | 0 native `<select>`, 0 native `<input type="date">` in JSX. All standard inputs use `.form-input`. Topbar search and stepper sub-controls intentionally custom. | PASS |
| Spacing | H1 18 px / weight 700 across every page. Glass radius `20px / 18px` everywhere. Glass padding varies by content density (kanban 14 px, list cards 24 px, report panels 20 px) — intentional. | PASS |
| Modals | 14/16 modal-backdrops correct; the other 2 (ImportLeadsModal, DripSequences delete-confirm) were fixed in the prior run (`87d7230`). | PASS |

## Bugs Fixed

1. **DELETE /api/documents/:id** — returned `200 {"deleted":false}` for missing rows, conflating "deleted" with "never existed". → Now returns `404 {"error":"Document not found"}` when the row doesn't exist; `200 {"deleted":true}` on real delete. (`76fc4f9` — `server/src/routes/documents.js:77-86`)
2. **GET /api/crm/financing/public/:token/{plans,applications}** — returned `200 []` for any bogus token. → Added `assertEstimateByToken()` helper that throws `{status:404,"Estimate not found"}` if the token doesn't match an estimate row. (`76fc4f9` — `server/src/services/financing/index.js:282-298`)
3. **Postgres 22P02 enum errors leaking DB internals** — e.g. `?source=bogus` returned `400 "invalid input value for enum storm_source: \"bogus\""`. → `errorHandler` collapses any 22P02 to `400 {"error":"Invalid value provided for one or more fields"}`. (`76fc4f9` — `server/src/middleware/errorHandler.js:15-32`)
4. **Unmatched /api/\* returned Express HTML 404** — inconsistent with every other JSON error response. → Catch-all JSON 404 at the bottom of routes/index.js: `404 {"error":"Not found","path":"/api/foo"}`. SPA fallback in app.js untouched. (`76fc4f9` — `server/src/routes/index.js:79-83`)
5. **Admin sidebar nav link** had an inline color override (blue active, darker muted inactive) that diverged from every other nav entry. → Removed the inline override so Admin uses the standard `.nav-link.is-active` treatment (white text, weight 600, accent rail via `::before`). (`01e9ec4` — `client/src/components/Sidebar.jsx`)

## Known Issues (Not Fixed)

- **DELETE /api/crm/tasks/:id handler missing** — surfaced by the new catch-all 404; previously hid behind Express HTML 404. Client never calls DELETE on tasks, so no UI impact. Rule "don't add new endpoints autonomously" — deferred. *(new this run — Finding A)*
- **POST /api/crm/tasks malformed-JSON error echoes the request body** — Express 5 default JSON parser includes a snippet of the offending body in the 400. Low impact (client-supplied content, no server-secret leak) but same anti-pattern as defect 3. 2-line fix in `app.js`. *(new this run — Finding B)*
- **Heavy-work guards** on `POST /drift/correct-all`, `POST /properties/trigger-import`, `POST /crm/leads/score-all` — no `?confirm=true` gate. Contract change; needs deliberate decision, not autonomous.
- **Hearth webhook permissive on missing fields** — security-audit candidate.
- **Currency-format anti-pattern sweep** (LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals) — not yet audited for `$${num}` cases.
- **Pre-token-attach 401 noise** in `client/src/api/client.js` — ~10-line interceptor fix.
- **Reports chart label overlap** at ~930 px viewport — cosmetic.
- **`.modal-backdrop` CSS class** only carries animation; each of 16 sites repeats ~6 lines of inline position/background/blur. Refactor opportunity, deliberately skipped per "don't refactor working features".
- **`/subcontractors`** has both H1 and H2 reading "Subcontractors" — content choice, not a consistency defect.
- **`subcontractors.js.bak`** cleanup — safe `git rm`, deferred.

## Test Coverage Gaps

- **Browser write flows** — Add Lead submit, kanban drag persist, Invoice → Record Payment, Work Order checklist toggle, document upload. s2 hit `max_turns` before writes ran. Highest-yield frontier for next run.
- **Mobile responsive 375 px / 768 px sweep** — last full sweep was Run 6 (24 runs ago).
- **Multipart file-upload success path** — `qa-fixtures/` does not exist; would need real binary fixtures.
- **CSV import success path** — paused per "no bulk DB writes" rule (Neon free tier).
- **CSV export download** — verified by HTTP 200, not by binary content-type or download trigger.
- **Admin panel** requires global `super_admin` role to fully exercise.
- **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) — need SMTP configuration for live delivery testing.
- **Webhook valid-signature paths** — need real signing keys.
- **QuickBooks / Twilio / Stripe live flows** — not wired (pre-existing).
- **s5 report-writing session** ran out of turns at 0 bytes for the 23rd consecutive run. This report was written in a follow-up session.

## Session Integrity

| Session | Turns | Outcome | Cost |
|---|---|---|---|
| s1 api-test | 51 / 50 | `max_turns` — but produced commit `76fc4f9` (4 fixes) before timeout | $4.48 |
| s2 frontend-test | 81 / 80 | `max_turns` — page walks executed, no writes, no commits | $4.13 |
| s3 ui-audit | 61 / 60 | `max_turns` — produced commit `01e9ec4` and 5 audit dumps before timeout | $5.05 |
| s4 verify | 41 / 40 | `max_turns` — 8 screenshots captured, no commits | $2.41 |
| s5 report | n/a | 0 bytes (23rd consecutive non-functional s5) | — |

Total measured spend: ~$16.07. 4 / 5 sessions still produced useful work in spite of `max_turns`; **2 commits, 5 defects fixed**.
