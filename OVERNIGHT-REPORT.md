# QA Test Report — 2026-04-24

## QA Test Summary

| Metric | Count |
|---|---|
| Overnight sessions launched | 5 (s1 api, s2 frontend, s3 ui-audit, s4 verify, s5 report) |
| Sessions that completed normally | 0 — every session terminated on `error_max_turns` |
| Screenshots produced (new + touched) | 21 (15 new, 6 updated) |
| New commits on `feat/financing` | 1 (`18f337a`) |
| Bugs found this run | 2 |
| Bugs fixed & committed | 1 |
| Bugs fixed but uncommitted (in working tree) | 1 |
| New QA infrastructure | 1 (`server/scripts/api-test.sh`, ~340 lines) |
| UI inconsistencies found | 2 (both star-rating SVGs) |
| UI inconsistencies fixed | 2 |

**Honesty note:** All five overnight child sessions hit their turn caps. The s5 "write the report" session output (`claude-overnight-20260424-s5-report.json`) is zero bytes — the report you are reading was written in a follow-up session. No `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, or `/tmp/ui-audit-results.txt` from tonight are present; evidence for this run is the git diff, the committed change, the working-tree diff, and the screenshot set on disk.

## Backend API Test Results

No completed fresh endpoint matrix was captured. The s1 api-test session (51 turns, $2.89) was spent building test infrastructure rather than running and logging results.

### Produced: `server/scripts/api-test.sh` (uncommitted, new file)
A reusable ~340-line bash harness that hits every major route family with a single `bash server/scripts/api-test.sh > /tmp/api-test-results.txt` invocation. Coverage:
- auth, storms, map, dashboard, properties, leads, skip-trace, alerts, drift, counties
- CRM (leads, tasks, pipeline, dashboard family, team, tenant-settings, ~20 endpoints)
- estimates, contracts, financing, automations, invoices, canvassing, reports
- work-orders, drip, expenses, subcontractors, territories, materials
- notifications, search, documents, roof-measurement, admin, payments, onboarding
- disaster-declarations, storm-history, data (fema-housing, directions)
- POST/PATCH/DELETE with empty `{}` body — verifies 400 vs 500 boundary

Each call is wrapped with a `CRASH` marker for HTTP 500/502/504, `NO-CONN` for 000, and `OK` otherwise, making the resulting log skimmable for regressions.

### Bug identified & patched in working tree (uncommitted): Admin tenant UUID 500s
`GET /api/admin/tenants/:id` and `PUT /api/admin/tenants/:id` did not validate the `:id` param. A non-UUID value reached the pg driver and produced a raw 500 (`invalid input syntax for type uuid`). Patched in `server/src/routes/admin.js` by adding the shared `validateId()` middleware (same pattern used across CRM routes after Run 3). Fix is in the working tree, not yet committed — see "Follow-ups" below.

### Regression check on prior fixes
No regressions reported against the fixes committed on 04-09 through 04-22 (public lead status, drip service `company_name`→`name`, test-email body fallback, CRM/canvassing UUID validation, skip-trace enable payload, task `completed` boolean mapping, `/leads/:id` route, numbered-list icon). The star-icon commit from this run (`18f337a`) built cleanly.

## Frontend Feature Test Results

The s2 frontend session (81 turns, $5.40) produced 15 new page screenshots plus 6 updated existing ones. All screenshots are in the repo root at `qa-*.png`.

### New screenshots captured tonight
- `qa-admin.png`, `qa-admin-view.png` — admin super-panel views (role-gated; captured from tenant perspective as expected-403 empty states)
- `qa-calendar.png` — calendar view
- `qa-canvassing.png` — canvassing pins / door-to-door view
- `qa-contracts.png` — contracts list
- `qa-expenses.png` — expenses view
- `qa-materials.png` — materials orders / products catalog
- `qa-reports.png` — reports hub
- `qa-settings-reviews.png` — settings reviews tab
- `qa-subcontractors.png` — subcontractors view
- `qa-tasks.png` — tasks view
- `qa-mobile-dashboard.png` — dashboard at narrow viewport (first mobile-viewport capture in several runs)
- `qa-dashboard-stars.png`, `qa-storm-catalog-stars.png` — focused captures of the star-rating regions used as the visual evidence for the s3 UI fix
- `qa-leads-invalid-uuid.png` — leads page behaviour on `/leads/bad-uuid` path (expected "not found" state)

### Updated screenshots (drift captures, behavior unchanged)
`qa-estimates.png`, `qa-invoices.png`, `qa-lead-detail.png`, `qa-pipeline.png`, `qa-storm-map.png`, `qa-work-orders.png`

### Per-page findings
- **Dashboard** — render clean; stat cards retain glass styling; star-rating spans were rendering via raw `<svg>` (fixed in s3)
- **StormCatalog** — render clean; severity-rating star row used raw `<svg>` (fixed in s3)
- **Leads / LeadDetail** — deep-link (`/leads/:id`) still works after last run's route fix; invalid UUID path reaches a non-crashing state
- **Pipeline** — no visual regression vs. last run
- **Admin / Admin View** — route mounts and the page renders, but all calls return 403 for the tenant user (no super_admin role on the seeded account); not functionally exercised this run
- **Mobile dashboard (single viewport test)** — dashboard layout holds at narrow width; sidebar behaviour at 375px still not systematically measured (covered under gaps below)
- **Calendar, Canvassing, Contracts, Expenses, Materials, Reports, Settings/Reviews, Subcontractors, Tasks** — all routes mount and render; none produced a crash or missing-element screenshot

### What still needs attention
- Admin super-panel is essentially a "gated, role-required" smoke — needs a super_admin session to actually exercise
- Interactive flows (drag between pipeline stages, signing an estimate, uploading a document, sending an email) were not driven this run; Playwright was not invoked
- Mobile viewport captures are a single screenshot, not a systematic 375px/768px sweep

## UI Consistency Audit Results

The s3 ui-audit session (61 turns, $3.77) produced one committed fix and no other flagged issues.

### Icons
- **Found:** two inline `<svg>` star-rating elements — one in `Dashboard.jsx` (`StarRating` component used by the Storm Activity feed) and one in `StormCatalog.jsx` (severity stars on catalog cards). Both rendered by hand-rolled paths rather than the app's Heroicon standard.
- **Fixed:** both replaced with `StarIcon` from `@heroicons/react/24/outline`, preserving the filled/unfilled visual via a `fill` style prop (so a zero-severity star still renders as an outline, and a full-severity star still renders solid amber / storm-severity colour). Committed as `18f337a`.
- Remaining raw `<svg>` elements in the app belong to map overlays, photo-annotator tools, and chart axis ticks — all intentional and out of scope for Heroicon substitution.

### Buttons
- No new outliers. Primary, secondary, icon-only, and danger variants continue to share the established `auth-btn` / `quick-action-btn` token set (no `btn-primary`/`btn-secondary` classes reintroduced since Run 2).

### Toolbars / Headers
- Consistent across all pages captured tonight. Title-left / actions-right layout holds; row heights match.

### Sidebar / Nav
- No reported issues; collapse/expand behaviour unchanged.

### Forms
- No new native `<select>` or native `<input type="date">` elements reintroduced. `CustomSelect` and `DatePicker` remain universal.
- No new `.form-input` class deviations detected in the files touched this run.

### Spacing
- No new alignment issues surfaced in the screenshot set.

### Modals
- Modal backdrop and glass styling stable; no new modal components were added this run.

## Bugs Fixed (numbered)

1. **Dashboard.jsx `StarRating` — inline `<svg>` star paths** — replaced with `StarIcon` from `@heroicons/react/24/outline` using `fill` style to preserve filled/unfilled appearance (committed as `18f337a`).
2. **StormCatalog.jsx severity-row stars — inline `<svg>` star paths** — same replacement, same commit (`18f337a`).

## Follow-ups / Uncommitted Work Produced This Session

The following are code changes produced by the overnight sessions that are in the working tree but were **not** committed by the task harness (the s5 report session died before committing). The follow-up session that wrote this report intentionally did not auto-commit them; they should be reviewed before landing.

1. **`server/src/routes/admin.js`** — added `validateId()` middleware to `GET /api/admin/tenants/:id` and `PUT /api/admin/tenants/:id`. Consistent with the UUID-validation pattern applied to CRM routes in Run 3 (`3577c4a`, `005a6eb`). Prevents a 500 on a malformed path param; returns 400 instead.
2. **`server/scripts/api-test.sh`** — new file, executable bash harness for smoke-testing ~160+ endpoints in one pass. Intended as recurring QA infrastructure.

## Known Issues (Not Fixed)

- Admin panel deep testing requires a user with the `super_admin` role — no such seeded account available
- Pipeline drag-and-drop not exercised end-to-end in a real browser (HTML5 drag API path)
- CSV export binary download not verified (only endpoint 200 checked)
- Email send requires SMTP configuration — `/crm/test-email` and `/invoices/:id/send-email` untested against a live sender
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature-verification keys to test
- QuickBooks, Twilio, Stripe integrations not implemented — endpoints stubbed
- Mobile responsive sweep (375px / 768px) still a one-off rather than a systematic viewport matrix
- File upload on lead detail (multipart path) still not exercised

## Test Coverage Gaps

- **All five sessions hit their turn cap.** Per-session caps were s1=50, s2=80, s3=60, s4=40, s5=40. None of the stages walked their plan to completion.
- **No completed API run log.** `/tmp/api-test-results.txt` was not produced on this run. The new `server/scripts/api-test.sh` script provides the infrastructure, but the pre-flight step that writes the JWT token, tenant ID, and user ID to `/tmp/` so the script can authenticate did not complete.
- **No completed frontend run log.** `/tmp/frontend-test-results.txt` absent; evidence for this run is the screenshot set.
- **No completed UI audit log.** `/tmp/ui-audit-results.txt` absent; evidence for this run is the committed diff for `18f337a`.
- **Playwright not invoked.** Zero interactive click/fill/drag steps executed this run.
- **Super-admin flows un-exercised** (role not held by the test account).

## Session cost (2026-04-24)

| Session | Turns | Wall time | API time | Cost |
|---|---|---|---|---|
| s1 api-test | 51 | 344s | 272s | $2.89 |
| s2 frontend-test | 81 | 445s | 382s | $5.40 |
| s3 ui-audit | 61 | 449s | 389s | $3.77 |
| s4 verify | 41 | 269s | 250s | $2.42 |
| s5 report | 0 (0B output) | — | — | $0.00 |
| **Total** | **234** | **~25 min** | **~22 min** | **$14.48** |
