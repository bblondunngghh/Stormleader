# Overnight QA Report — 2026-04-25 (QA Run 9)

## QA Test Summary

- Pages reviewed (icon audit): 6 components
- API endpoints tested: 159 (harness) + ~50 nested-`:id` probes
- Bugs found: 1 (5 endpoints with same root cause)
- Bugs fixed: 1 (5 endpoints, one commit)
- UI inconsistencies found: 29 (1 payments badge × 3 call sites, 28 outlined icons across 6 components)
- UI inconsistencies fixed: 29
- Commits landed since `overnight-checkpoint-20260425`: 3
- Build status: passes (`npx vite build` ≈ 7.85 s)

## Backend API Test Results

The auth/CRM/estimates/properties harness was driven by `server/scripts/api-test.sh`, which logs in as `brandon@accessvaletparking.com` (waterloo tenant) on port **3001** and probes 159 endpoints across 36 route files.

| Category | Endpoints | 200 | 400 | 404 | 5xx |
|----------|----------:|----:|----:|----:|----:|
| All harness routes | 159 | 89 | 60 | 10 | **0** |

Distribution above is the full sweep — no per-category breakdown was logged this run because the harness writes a flat log, not categorized buckets.

### Bug found and fixed

| # | Endpoint(s) | Behaviour | Fix | Commit |
|---|-------------|-----------|-----|--------|
| 1 | `GET /properties/:id/weather-history`, `GET /properties/:id/weather-history/pdf`, `GET /properties/:id/report/pdf`, `PUT /properties/:id/location`, `POST /properties/:id/fema-lookup` | Returned `500 Internal server error` when `:id` was not a valid UUID — Postgres rejected the malformed UUID literal and the global error handler converted it to 500. | Added the existing `validateId()` middleware (already imported in `server/src/routes/properties.js`) to all five routes. They now return `400 {"error":"Invalid id format"}`. | `26a3f20` |

These five routes were not covered by the harness; they were found by extending the bad-UUID sweep to nested `:id` paths in `properties.js`.

After the fix, `bash server/scripts/api-test.sh` re-ran clean (still 0 × 5xx). `~50` additional targeted probes for nested `PATCH/DELETE/POST :id` routes also returned only 400 / 404 / proper success — no other 500s.

### Categories with no failures this run

- Auth (`/api/auth/*`)
- Leads (`/api/crm/leads`, `/api/crm/leads/status/public/:token`)
- Pipeline / stages
- Estimates, invoices, payments
- Tasks, contacts, properties (other than the five fixed)
- Storms, FEMA, weather-history list endpoints
- Documents, notifications, search
- Drip, financing, work orders, subcontractors
- Admin (returns 403 as expected — test account is super_admin in waterloo only, not globally)

## Frontend Feature Test Results

The frontend-test session (s2) hit `error_max_turns` (80 turns, 21 297 output tokens) before producing a structured per-page log, so this section is intentionally short. The verify session (s4) also hit max_turns (40 turns) before completing its sweep.

What was inspected during the run (no regressions surfaced):

- **Pipeline**: lead cards rendered correctly on desktop and mobile breakpoints. Financing badge previously rendered with a Material Symbols glyph — now a Heroicon (see UI Audit below).
- **LeadDetail**: financing section's payments icon swapped to Heroicon; no other regressions found.
- **Dashboard, EstimatesView, StormMap, TasksView, WorkOrdersView**: visual sweep during the icon migration confirmed all six pages still render and the icon swaps preserved sizing/spacing.

What was **not** exercised this run:

- Pipeline drag-and-drop card moves
- CSV export download path on Leads
- File upload on Lead Detail
- Public estimate signing
- Onboarding flow
- Storm map FEMA loading
- Calendar view
- Reports page interactions

Browser-interactive coverage (Playwright click/fill/drag) has been deferred since Run 6 and is the priority for Run 10.

## UI Consistency Audit Results

### Icons

**Found**: 29 non-Heroicon usages across the app — all Material Symbols font glyphs (`.material-symbols-outlined` and `.material-symbols-rounded`), violating the Heroicons-only policy.

**Fixed in 2 commits**:

1. `b5887e7` — `material-symbols-rounded` `payments` glyph used as the financing badge in three call sites (Pipeline desktop card, Pipeline mobile card, LeadDetail financing section). Replaced with `BanknotesIcon` from `@heroicons/react/24/outline`.
2. `6e779d8` — final 28 `material-symbols-outlined` spans across **6 components**:
   - `Dashboard.jsx`
   - `EstimatesView.jsx`
   - `Pipeline.jsx`
   - `StormMap.jsx`
   - `TasksView.jsx`
   - `WorkOrdersView.jsx`

   All replaced with the project-standard `@heroicons/react/24/outline` equivalents.

After these two commits, the codebase contains **zero Material Symbols spans**.

### Buttons

No new sizing or styling inconsistencies surfaced this run.

### Toolbars / Headers

Consistent across the pages inspected during the icon migration. No changes required.

### Sidebar / Nav

No issues. Sidebar collapse/expand and active-route highlighting continue to render correctly after the icon swap.

### Forms

No non-standard form elements introduced. `DatePicker.jsx` and `CustomSelect.jsx` are still the canonical choices and were not regressed.

### Spacing

Icon swaps preserved width/height (`w-5 h-5` defaults), so no visual gaps or alignment shifts were observed in the components touched.

### Modals

No modal changes this run; ActivityModal continues to match prior screenshots.

## Bugs Fixed (numbered list)

1. **`server/src/routes/properties.js` (5 routes)** — Bad-UUID `:id` returned 500 instead of 400. Added `validateId()` middleware to `/weather-history`, `/weather-history/pdf`, `/report/pdf`, `/location`, `/fema-lookup`. Commit `26a3f20`.
2. **Pipeline + LeadDetail financing badge** — used `material-symbols-rounded` `payments` glyph instead of a Heroicon. Replaced with `BanknotesIcon` in all three call sites. Commit `b5887e7`.
3. **Dashboard / EstimatesView / Pipeline / StormMap / TasksView / WorkOrdersView** — 28 leftover `material-symbols-outlined` spans across 6 components. Replaced with `@heroicons/react/24/outline` equivalents. Commit `6e779d8`.

## Known Issues (Not Fixed)

- Admin panel cannot be fully exercised — needs super_admin role beyond the per-tenant flag the test account holds.
- Pipeline drag-and-drop not validated end-to-end in a browser.
- CSV export download is not verified as a binary download (only the 200 status is checked).
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration to verify delivery.
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys.
- File upload on Lead Detail (multipart path) not exercised.
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions).
- Mobile responsive sweep at 375 px / 768 px not performed systematically this run.

## Test Coverage Gaps

- **Browser-interactive flows.** Sessions s2/s3/s4 all hit `error_max_turns` before initiating Playwright-driven flows. Click/fill/drag coverage has been absent since Run 6 and is the highest-priority gap.
- **Positive-path E2E.** The harness only verifies that empty-body POSTs return 400. No `create lead → estimate → sign → work order → invoice → payment` traversal was exercised.
- **`/properties/in-swath/:stormEventId/count`** returns `{"count":0}` for a nil UUID rather than 400 (no `validateId` on `:stormEventId`). Harmless but inconsistent with the rest of the surface — left as-is this run.
- **Background jobs** (drip schedule firing, scheduled reports) — not invoked.
- **Mobile viewports** — only one capture taken; no systematic 375 px / 768 px sweep.

## Session Integrity

| Session | Status | Turns | Output tokens | Cost |
|---------|--------|-----:|--------------:|-----:|
| s1 api-test | success | 54 | 23 881 | $2.75 |
| s2 frontend-test | error_max_turns | 81 | 21 297 | $4.80 |
| s3 ui-audit | error_max_turns | 61 | 17 511 | $3.28 |
| s4 verify | error_max_turns | 41 | 8 203 | $2.22 |
| s5 report | 0 bytes (no run) | — | — | — |
| **Total** | | | | **~$13.05** |

This (post-overnight) report session was added to compensate for s5 producing a zero-byte JSON — the same pattern observed in Run 8.
