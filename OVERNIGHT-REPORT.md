# StormLeads QA Run 11 — Overnight Report

**Date:** 2026-04-26
**Branch:** feat/financing
**Checkpoint:** `overnight-checkpoint-20260426` (commit `ac40195`)

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (frontend screenshots) | 14 (qa11) + 7 focused (qa12) |
| API endpoints tested | 159 (harness) + ~120 (uncovered probe) + ~25 (positive-path) |
| Bugs found | 0 |
| Bugs fixed (committed) | 0 |
| UI inconsistencies found | 3 |
| UI inconsistencies fixed (uncommitted in working tree) | 3 |
| Commits made this run | 0 |

This is the second consecutive overnight run with **zero API bugs** and the first run since QA Run 6 to systematically capture full-page screenshots of every CRM page.

## Backend API Test Results

Session 1 (`s1-api-test`) ran to completion — only session of the night that did. It hit the full API surface in three passes.

### Pass 1 — Existing harness (`server/scripts/api-test.sh`)
- Endpoints: 159
- 89 × 200 OK, 60 × 400 validation error, 10 × 404 not-found
- 5xx crashes: **0**

### Pass 2 — Uncovered-route probe (~120 routes harness misses)
- All PATCH/DELETE on individual resources with bad-uuid + nil-uuid
- All nested-`:id` POST routes (`/contracts/:id/send`, `/estimates/:id/duplicate`, `/work-orders/:id/complete`, etc.)
- All public-token routes (`/contracts/public/:token/sign`, `/estimates/public/:token/accept`, `/financing/public/:token/apply`)
- All onboarding/payments/skip-trace mutating routes with empty body
- 5xx crashes: **0** — every route returns proper 400/404 JSON

### Pass 3 — Full positive-path E2E flow (~25 calls)
Lead → score → activity → task → status-token → estimate → duplicate → tier-generate → PDF → invoice → work-order → milestone → WO PDF → WO complete → cleanup. All return correct 200/201 with valid response bodies. PDFs are valid binary.

### Per-category results
| Category | Endpoints | Pass | Fail |
|---|---|---|---|
| Auth | 5 | 5 | 0 |
| CRM (leads/tasks/activities/team) | 32 | 32 | 0 |
| Estimates | 15 | 15 | 0 |
| Contracts | 8 | 8 | 0 |
| Financing | 6 | 6 | 0 |
| Invoices | 6 | 6 | 0 |
| Work Orders | 12 | 12 | 0 |
| Canvassing | 3 | 3 | 0 |
| Reports | 6 | 6 | 0 |
| Dashboard widgets | 14 | 14 | 0 |
| Materials (SRS) | 5 | 5 | 0 |
| Skip-trace | 6 | 6 | 0 |
| Roof measurement | 5 | 5 | 0 |
| Notifications | 4 | 4 | 0 |
| Search | 2 | 2 | 0 |
| Documents | 1 | 1 | 0 |
| Properties / Storms / Drift / Counties | 18 | 18 | 0 |
| Admin | 5 | 5 (403/200 as expected) | 0 |
| Payments / Onboarding | 5 | 5 | 0 |

### Endpoints fixed
**None.** The API surface has been clean for two consecutive overnight runs.

## Frontend Feature Test Results

Session 2 (`s2-frontend-test`) hit `error_max_turns` after 81 turns. It captured a full-page screenshot of every CRM page (qa11-*.png, 14 files, ~5MB total). No textual report was saved; the table below is reconstructed from screenshot evidence and working-tree diffs.

### Pages screenshotted (qa11 set)

| Page | Screenshot | Observation |
|---|---|---|
| Dashboard | qa11-dashboard.png | Renders. Stat cards, funnel, activity feed, leaderboard all populated. |
| Storm Map | qa11-stormmap.png | Renders. FEMA layer + storm pins visible. |
| Leads | qa11-leads.png | Table renders with all spec columns. |
| Pipeline | qa11-pipeline.png | All stage columns render with cards. |
| Lead Detail | qa11-lead-detail.png, qa11-lead-detail-2.png | Editable fields, financing section, activity feed render. |
| Tasks | qa11-tasks.png | Filter tabs + task list render. |
| Estimates | qa11-estimates.png | List view renders. |
| Invoices | qa11-invoices.png | List view renders. |
| Work Orders | qa11-workorders.png | Toolbar + work-order list render. |
| Canvassing | qa11-canvassing.png | Map + pin tools render. |
| Calendar | qa11-calendar.png | Renders (per-spec stub view). |
| Reports | qa11-reports.png | Report widgets render. |
| Settings | qa11-settings.png | All four tabs render. |

### Pages with fixes applied in working tree (uncommitted)

- **Work Orders toolbar (`WorkOrdersView.jsx`)** — toolbar horizontal padding reduced from `var(--space-2xl)` to `var(--space-xl)` to match the toolbar padding used by Leads/Pipeline/Estimates. Button border-radius standardized from `10px` to `12px` to match the rest of the app.
- **Dashboard `RevenueGoalBar` buttons (`Dashboard.jsx`)** — Tailwind `rounded-lg` (8px) replaced with `rounded-[12px]` so the goal-bar buttons match the 12px radius used everywhere else.

### Pages still needing attention

- **Pipeline drag-and-drop** — not exercised end-to-end in a browser this run (still uses HTML5 drag API; React Query / @dnd-kit migration listed in CRMLead.md backlog).
- **CSV export** — file-download path was not verified as binary (only the `200` status was checked).
- **File upload on Lead Detail** — multipart path was not exercised.
- **Mobile responsive sweep at 375px / 768px** — not measured this run.
- **Email send** — `/crm/test-email` and `/invoices/:id/send-email` need SMTP configured to be exercised.

## UI Consistency Audit Results

Session 3 (`s3-ui-audit`) hit `error_max_turns` after 61 turns. It produced 7 focused screenshots (qa12-*.png) of the Activity modal, the DatePicker popup, the Dashboard, and the Leads page. Two uncommitted UI fixes survived in the working tree.

### Audit categories

| Category | Findings | Fixed |
|---|---|---|
| **Icons** | 0 non-Heroicon icons remain. Codebase has zero `material-symbols-*` spans and zero inline-SVG icon paths after Run 9's cleanup. | n/a (already clean) |
| **Buttons** | RevenueGoalBar buttons (Dashboard) used `rounded-lg` (8px); WorkOrdersView toolbar buttons used `borderRadius: 10`. Rest of app uses 12px. | 2 (uncommitted) |
| **Toolbars / Headers** | WorkOrdersView toolbar used `padding: var(--space-md) var(--space-2xl)` while Leads/Pipeline/Estimates use `var(--space-xl)`. | 1 (uncommitted) |
| **Sidebar / Nav** | No issues. | — |
| **Forms** | `ActivityModal.jsx` follow-up section used native `<input type="time">` instead of the `TimePicker.jsx` component (analogous to the DatePicker mandate). | 1 (uncommitted) |
| **Spacing** | Toolbar padding inconsistency on WorkOrders captured above. No other spacing issues found in the qa11/qa12 sweep. | — |
| **Modals** | Activity modal renders correctly per qa12-activity-modal.png and qa12-activity-modal-2.png. DatePicker portal popup renders correctly per qa12-datepicker-open.png and qa12-datepicker-popup.png. | — |

### Uncommitted UI fixes in working tree

```
M client/src/components/ActivityModal.jsx   — replace native <input type="time"> with TimePicker component
M client/src/components/Dashboard.jsx        — RevenueGoalBar buttons rounded-lg → rounded-[12px]
M client/src/components/WorkOrdersView.jsx   — toolbar padding 2xl → xl, btnStyle borderRadius 10 → 12
```

These three diffs are correct per existing project conventions but were not committed before the session running them hit `max_turns`. They are left in the working tree for review and a follow-up commit, since this report-writing session has not run the dev server to visually re-verify them.

## Bugs Fixed

None this run. The only diffs in the working tree are UI consistency fixes (above), not bug fixes — every API endpoint behaves correctly and every page renders without error.

## Known Issues (Not Fixed)

- **Admin panel** — full coverage requires `super_admin` global role; some flows can only be tested by the platform owner.
- **Stripe billing** — integration not implemented (per CRMLead.md backlog).
- **QuickBooks / Twilio** — integrations not implemented (per CRMLead.md backlog).
- **Webhook signature validation** — `/webhooks/tracerfy` and `/webhooks/hearth` accept unsigned webhooks; production should require HMAC verification.
- **`POST /drift/correct-all`** — accepts an empty body and mutates all rows. Not a crash, but should require an explicit confirmation parameter.
- **`POST /properties/trigger-import`** — accepts an empty body and kicks off a background import. Should likely require admin role.
- **`PATCH /admin/tenants/:id`** — not defined (only `PUT` is). Express returns its default 404 HTML, which is correct behavior; flagged as a contract observation rather than a bug.
- **Email sending** — needs SMTP credentials wired up before `/crm/test-email` and `/invoices/:id/send-email` can be functionally tested.
- **Mobile responsive bottom-tab bar** — listed in CRMLead.md backlog, not started.

## Test Coverage Gaps

- **Browser-interactive testing** — Playwright was invoked only for screenshot capture, not for click/fill/drag interaction. Forms were not submitted through the UI (only API endpoints were exercised directly with curl). Last full Playwright interactive sweep was QA Run 6.
- **Drag-and-drop kanban persistence** — the Pipeline page renders cards in stages, but cards were not dragged across stages and the resulting `PATCH /crm/leads/:id` was not verified through the UI path.
- **Estimate builder live preview** — the builder route exists and `GET /estimates/templates` returns templates, but the live-preview interaction (line item add → totals recalc) was not exercised.
- **CSV export binary** — list endpoints with `format=csv` were not parsed/validated as binary.
- **PDF rendering visual diff** — estimate and work-order PDFs were verified as valid binary streams but were not opened and inspected.
- **Mobile viewport (375px / 768px)** — not exercised this run.
- **Email body rendering** — drip merge fields are tested at the SQL level (Run 6 fix in commit `e30be36`) but no rendered HTML email was captured.

## Session Integrity

| Session | Result | Turns | Output Tokens | Cost USD |
|---|---|---|---|---|
| s1 api-test | success | 31 | 26 836 | $2.44 |
| s2 frontend-test | error_max_turns (80) | 81 | 18 089 | $4.72 |
| s3 ui-audit | error_max_turns (60) | 61 | 34 239 | $4.55 |
| s4 verify | error_max_turns (40) | 41 | 13 092 | $2.57 |
| s5 report | 0 bytes — did not run | — | — | — |
| **Total** | | | **92 256** | **~$14.28** |

This report was written in a follow-up session, matching the pattern of Runs 8, 9, and 10.
