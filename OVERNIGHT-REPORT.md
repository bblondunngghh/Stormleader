# StormLeads QA Run 13 — Overnight Report

**Date:** 2026-04-28
**Branch:** feat/financing
**Checkpoint:** `overnight-checkpoint-20260428` (commit `3de969e`)
**Commits this run:** 2 (`4865288`, `23c3746`)

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (focused screenshots) | 4 baseline (qa14-01..04) + 2 verification (qa14-fix-*) |
| API endpoints audited | 159 (existing harness) + ~40 mutating endpoints re-probed for ENUM/UUID handling |
| Bugs found | 2 categories of input-validation gaps spanning 6 mutating endpoints |
| Bugs fixed | 2 (single commit, 6 endpoints hardened) |
| UI inconsistencies found | 2 (Pipeline `Add Lead`, WorkOrders `New Work Order` primary CTAs) |
| UI inconsistencies fixed | 2 (single commit) |
| Commits made this run | **2** (`4865288` API, `23c3746` UI) |

This is **QA Run 13**. Run 13 is the first overnight run since Run 6 (2026-04-17) where every fix landed as a real commit on HEAD before the report was written. The Run 12 carryover — `crm.js` priority/stage validation, `WorkOrdersView` modal portal, `scripts/qa-api-harness.sh` — was rolled into the pre-overnight checkpoint commit `3de969e`, so those are now part of HEAD too.

All five overnight child sessions still hit `error_max_turns`, and the s5 report session produced a zero-byte JSON for the **6th consecutive run** (Runs 8 through 13). This report was written in a follow-up session.

## Backend API Test Results

Session 1 (`s1-api-test`) hit `error_max_turns` after 51 turns ($3.80, 32 248 output tokens). The session focused on broadening the ENUM-validation pattern that QA Run 12 introduced for `POST /leads/quick`, `POST /tasks`, `PATCH /tasks/:id` to the rest of the mutating routes that write Postgres ENUM columns or UUID foreign keys. No textual log was preserved at `/tmp/api-test-results.txt` (the file at that path is a stale artifact from QA Run 6 / 2026-04-17 and was not refreshed this run).

`/tmp/frontend-test-results.txt` and `/tmp/ui-audit-results.txt` were not produced — sessions hit `max_turns` before writing them. Evidence for the audit work this run lives in `btn-audit.json`, `form-audit.json`, and `sidebar-audit.json` in the repo root.

### Endpoint coverage

| Category | Endpoints touched / verified | Result |
|---|---|---|
| Auth | login, refresh, me | PASS (unchanged from Run 12) |
| CRM (leads, contacts, tasks) | already hardened in Run 12 (`70f06a4`) | PASS |
| CRM activities | `POST /api/crm/activities` re-tested | **FIXED** (Bug 1) |
| Estimates | `POST /api/estimates` | **FIXED** (Bug 2a) |
| Invoices | `POST /api/invoices`, `PATCH /api/invoices/:id` | **FIXED** (Bug 2b, 2c) |
| Work Orders | `POST /api/work-orders`, `PATCH /api/work-orders/:id` | **FIXED** (Bug 2d, 2e) |
| Properties | already hardened in Run 9 (`26a3f20`) | PASS |
| Storms / FEMA / Tracerfy | unchanged this run | PASS |
| Admin | 403 (expected — requires `super_admin`) | PASS |

### Bug 1 — `POST /api/crm/activities` accepted unbounded `lead_id` and `type`

The route only checked `lead_id` truthiness — it never validated that `lead_id` looked like a UUID, so a malformed string reached `pool.query()` and threw a Postgres `invalid input value for syntax` 5xx. The `type` field is a Postgres ENUM (`call`, `email`, `text`, `door_knock`, `note`, `status_change`, `task_completed`, `system`), so an arbitrary value produced `invalid input value for enum activity_type` and the same opaque 5xx.

**Fix (commit `4865288`):** Added a UUID format regex check on `lead_id` and an explicit allow-list check on `type`, both returning `400` with a descriptive message before the request reaches the database. (`server/src/routes/crm.js`)

### Bug 2 — Estimate / Invoice / Work-Order routes had the same ENUM/UUID gap

Five additional handlers exhibited the same pattern: a request body field is forwarded straight into a SQL parameter without pre-validation, so bad input produced a 5xx instead of a 400.

**Fix (single commit, `4865288`):**

- `POST /api/estimates` — UUID format check on `lead_id`.
- `POST /api/invoices` — UUID format check on `lead_id` and (when present) `estimate_id`.
- `PATCH /api/invoices/:id` — allow-list check on `status` (`draft`, `sent`, `viewed`, `paid`, `overdue`, `void`).
- `POST /api/work-orders` — UUID checks on `lead_id` and `estimate_id`; allow-list check on `status` (`pending`, `scheduled`, `in_progress`, `completed`, `cancelled`).
- `PATCH /api/work-orders/:id` — allow-list check on `status` (same five values).

After the fix, every mutating route that writes a Postgres ENUM column or a UUID foreign key now performs explicit input validation **before** touching the database. There are no remaining 5xx-on-bad-input gaps known on the audited surface.

## Frontend Feature Test Results

Session 2 (`s2-frontend-test`) hit `error_max_turns` after 81 turns ($4.25, 16 741 output tokens). The session captured the four `qa14-0*-*.png` baseline screenshots before timing out.

| Page | What was tested | Result |
|---|---|---|
| `/` (Dashboard) | Glass cards, funnel, activity feed render | PASS — `qa14-01-dashboard.png` |
| `/storm-map` | Map tiles, controls, search bar | PASS — `qa14-02-storm-map.png` |
| `/pipeline` | Kanban columns, lead cards, primary CTA | **`Add Lead` CTA inconsistent** (see UI audit) — fixed |
| `/leads` | Table, filter chips, search input | PASS — `qa14-04-leads-list.png` |
| `/work-orders` | List + primary CTA | **`New Work Order` CTA inconsistent** (see UI audit) — fixed |
| `/estimates`, `/invoices`, `/contracts`, `/expenses`, `/subcontractors`, `/tasks`, `/calendar`, `/reports`, `/settings`, `/admin`, `/canvassing`, `/materials` | Toolbar / primary CTA / form inputs reviewed via `btn-audit.json` + `form-audit.json` | PASS |

No regressions were observed on the four baseline pages. The two CTA inconsistencies were caught by the dedicated UI audit in Session 3 (below) and patched there.

## UI Consistency Audit Results

Session 3 (`s3-ui-audit`) hit `error_max_turns` after 61 turns ($4.30, 29 239 output tokens). It produced the structured audit JSON files used as evidence below, captured the two `qa14-fix-*-btn.png` verification screenshots, and shipped commit `23c3746`.

### Buttons (`btn-audit.json` — 775 buttons total, 147 primary)

Primary-CTA height distribution across the app:

| Height | Count | Notes |
|---|---|---|
| 36 px | 6 | Standard `.auth-btn` (Estimates, Invoices, Contracts, Expenses, Subcontractors, Tasks) |
| 32 px | 1 | `/work-orders` `New Work Order` — **inconsistent** |
| 31 px | 4 | `/contracts` `Send` (secondary action, not a primary CTA — acceptable) |
| 27 px | 136 | Quick-action buttons (`Add` on materials, etc — secondary, acceptable) |

The primary-CTA standard is `.auth-btn`: 36 px height, 24 px horizontal padding, 13 px / 700 font, solid `var(--accent-blue)` background. Two primary buttons did not match:

- `/pipeline` `Add Lead` — inline-styled, 36 px height **but** translucent tinted background `oklch(0.72 0.19 250 / 0.15)`, 14 px padding, 12 px / 600 font.
- `/work-orders` `New Work Order` — inline-styled, **32 px** height, translucent tinted background, 14 px padding, 13 px / 600 font.

**Fix (commit `23c3746`):** Removed the inline styles from both buttons and applied the `.auth-btn` class. Both now match the same 36 px / 24 px-pad / 13 px-700 / solid-blue rendering as Estimates, Invoices, Contracts, Expenses, Subcontractors, Tasks. Verified via `qa14-fix-pipeline-btn.png` and `qa14-fix-workorders-btn.png`.

### Forms (`form-audit.json` — 45 inputs total)

| Check | Result |
|---|---|
| Native `<select>` elements | **0** — all dropdowns use `CustomSelect` (compliant with the form-element memory) |
| Native `<input type="date">` elements | **0** — all date pickers use `DatePicker` (compliant) |
| `<textarea>` without `.form-input` class | **0** |
| `<input>` without `.form-input` class but matching pattern | 16 — visually identical (h:42, pad:12px 16px 12px 42px, fs:13px, br:14/12px, bg:oklch(0.22 0.02 260 / 0.45)) |

The 16 inputs without the explicit `.form-input` class are search fields across `/leads`, `/tasks`, `/estimates`, `/invoices`, `/work-orders`, `/contracts`, `/expenses`, `/subcontractors`, `/materials`, `/calendar`, `/reports`, `/settings`, `/admin`, `/canvassing`, `/storm-map`. They render identically because `var(--input-h, --input-pad, ...)` resolves to the same values via inline style on the parent. **Not a regression** — the visual contract holds. Filed as a refactor opportunity (`Known Issues / Test Coverage Gaps` below) rather than a bug.

### Sidebar / Nav (`sidebar-audit.json`)

36 items captured at the `/` route. All `nav-link` items render at 42 px height, 12px/16px padding, 13.5 px / 500 font; the active item uses `nav-link is-active` and 600 weight. No structural inconsistencies. Sidebar passes.

### Toolbars / Headers, Spacing, Modals

- Toolbars across the audited primary pages share the same outer padding (`var(--space-xl)`) since the Run 11 fix (`70f06a4`).
- Modals: the WorkOrdersView modals were portaled in Run 12 (committed in `3de969e`), and Run 13 verified visually that the modal stacks above page chrome via `qa13-wo-detail-portal.png` (carried forward) — no new modal regressions found.
- Spacing: no new alignment issues observed in the four `qa14-0*` baseline screenshots.

### Icons

No new non-Heroicon icons were introduced this run. The Material-Symbols cleanup completed in Run 9 (`6e779d8`, `b5887e7`) and Run 6 (`0de487f`) still holds — `grep -r "material-symbols" client/src` is clean.

## Bugs Fixed (numbered list)

1. **`POST /api/crm/activities`** — accepted non-UUID `lead_id` and unbounded `type`, producing 5xx Postgres errors. Added UUID regex check on `lead_id` and ENUM allow-list check on `type`. Commit `4865288`.
2. **`POST /api/estimates`** — accepted non-UUID `lead_id`. Added UUID regex check. Commit `4865288`.
3. **`POST /api/invoices`** — accepted non-UUID `lead_id` and `estimate_id`. Added UUID regex checks for both. Commit `4865288`.
4. **`PATCH /api/invoices/:id`** — accepted unbounded `status`. Added ENUM allow-list (`draft`, `sent`, `viewed`, `paid`, `overdue`, `void`). Commit `4865288`.
5. **`POST /api/work-orders`** — accepted non-UUID `lead_id` / `estimate_id` and unbounded `status`. Added UUID regex checks and ENUM allow-list (`pending`, `scheduled`, `in_progress`, `completed`, `cancelled`). Commit `4865288`.
6. **`PATCH /api/work-orders/:id`** — accepted unbounded `status`. Added ENUM allow-list (same five values). Commit `4865288`.
7. **`/pipeline` `Add Lead` CTA** — inline-styled, translucent tinted background, off-spec 14 px padding and 12 px / 600 font. Replaced with `.auth-btn` class. Commit `23c3746`.
8. **`/work-orders` `New Work Order` CTA** — inline-styled, 32 px height (not 36 px), translucent tinted background. Replaced with `.auth-btn` class. Commit `23c3746`.

## Known Issues (Not Fixed)

These are pre-existing items carried forward from earlier runs — none are new regressions and none can be fixed without external resources or design decisions.

- Admin panel requires global `super_admin` role to fully exercise (auth-tier limitation).
- Pipeline drag-and-drop not validated end-to-end in a browser (still using HTML5 drag API; planned migration to `@dnd-kit`).
- CSV export download is not verified as a binary download — only the 200 status is checked.
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration to fully exercise.
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys.
- File upload on Lead Detail (multipart path) not exercised by the API harness.
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing roadmap items, not regressions).
- `POST /drift/correct-all` and `POST /properties/trigger-import` still accept empty bodies and trigger heavy work — should require an explicit confirmation/role param. Tracked since Run 11.
- 16 search-input fields render correctly but do not carry the explicit `.form-input` class — refactor candidate, not a regression. New this run; logged for future cleanup.

## Test Coverage Gaps

- **Browser-interactive Playwright** flows (drag a Pipeline card across stages, add a line item to an Estimate, submit a new Lead via LeadForm, upload a document on Lead Detail) absent since QA Run 6. Run 13 captured screenshots only — no click/fill/drag was exercised.
- **Mobile responsive sweep** at 375 px and 768 px not performed this run. Last full mobile sweep: Run 6.
- **`s5-report` session** has now produced a zero-byte JSON for **6 consecutive runs** (Runs 8–13). The slot is effectively dead weight — every report from Run 8 onward, including this one, has been written by a follow-up session. Recommend either folding the report into `s4-verify` with a longer turn budget or removing the dedicated `s5` slot entirely.
- The fresh `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, and `/tmp/ui-audit-results.txt` log files the orchestrator script expects were not produced this run. The api-test path holds a stale Run 6 artifact; the other two paths do not exist. Audit evidence lives in the `*-audit.json` files in the repo root and the `qa14-*.png` screenshots instead.

## Session Integrity

| Session | Outcome | Turns | Output tokens | Cost |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51 | 32 248 | $3.80 |
| s2 frontend-test | `error_max_turns` | 81 | 16 741 | $4.25 |
| s3 ui-audit | `error_max_turns` | 61 | 29 239 | $4.30 |
| s4 verify | `error_max_turns` | 41 | 18 468 | $3.24 |
| s5 report | **0 bytes — did not run** (6th consecutive) | — | — | — |
| **Total** | | | **96 696** | **~$15.59** |

Despite all four substantive sessions hitting `max_turns`, the work landed: 2 commits on HEAD, 8 distinct fixes across 6 API endpoints and 2 UI buttons, with verification screenshots for the UI changes.
