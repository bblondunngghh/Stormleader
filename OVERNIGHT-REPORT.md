# StormLeads QA Run 14 — Overnight Report

**Date:** 2026-04-30
**Branch:** feat/financing
**Checkpoint:** `overnight-checkpoint-20260430` (commit `4d4056c`)
**Commits this run:** 2 (`485a522`, `b3c1fe9`) + 1 uncommitted improvement on disk (`server/src/middleware/errorHandler.js`)

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (focused screenshots) | 9 baseline (qa14-01..09) + 2 verification (qa14r-01, qa14r-02) |
| API endpoints audited | 159 (existing harness) — no new endpoint regressions surfaced |
| Bugs found | 3 (2 UI currency-formatting, 1 backend 5xx-leak class) |
| Bugs fixed | 2 committed + 1 patch left in the working tree (uncommitted) |
| UI inconsistencies found | 0 new — Run 13 primary-CTA fix verified to still hold |
| UI inconsistencies fixed | 0 (none required) |
| Commits made this run | **2** (`485a522` Dashboard, `b3c1fe9` InvoicesView) |

This is **QA Run 14**, the 8th consecutive run since the orchestration was reshaped around the api-test / frontend-test / ui-audit / verify / report pattern. Both committed fixes are the same shape — negative-currency display — applied at two distinct surfaces (Dashboard `formatCurrency` and InvoicesView balance cell). The third finding (`errorHandler.js`) is a defense-in-depth improvement that lives in the working tree only; it was identified and patched during the session but not committed before the agent hit `max_turns`.

All four substantive sessions hit `error_max_turns`. The `s5-report` session produced a zero-byte JSON for the **7th consecutive run** (Runs 8 through 14). This report was written in a follow-up session.

## Backend API Test Results

Session 1 (`s1-api-test`) hit `error_max_turns` after 51 turns ($3.32, 24 413 output tokens). The session re-ran the existing API harness against the post-Run-13 surface and probed for any 5xx-on-bad-input gaps remaining beyond the explicit ENUM/UUID checks added in Runs 11–13.

`/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, `/tmp/ui-audit-results.txt` were not produced this run. The path `/tmp/api-test-results.txt` still holds the stale Run 6 (2026-04-17) artifact; the other two paths do not exist. Audit evidence lives in the `btns-*.json` files in the repo root and the `qa14-*.png` / `qa14r-*.png` screenshots.

### Endpoint coverage

| Category | Endpoints touched / verified | Result |
|---|---|---|
| Auth | login, refresh, me | PASS (unchanged) |
| CRM (leads, contacts, tasks, activities) | already hardened in Runs 12–13 | PASS |
| Estimates | already hardened in Run 13 (`4865288`) | PASS |
| Invoices | already hardened in Run 13 (`4865288`) | PASS — but balance display had a bug (Bug 2) |
| Work Orders | already hardened in Run 13 (`4865288`) | PASS |
| Properties | already hardened in Run 9 (`26a3f20`) | PASS |
| Storms / FEMA / Tracerfy | unchanged this run | PASS |
| Admin | 403 (expected — requires `super_admin`) | PASS |

### Bug 3 (uncommitted) — Postgres SQLSTATE error-code leakage

The session noticed that even with route-level UUID/ENUM checks in place, callers can still hit a Postgres-raised 5xx if a code path reaches the DB with a malformed value (e.g. a JOIN on a free-form text field, or a route the harness has not exercised). To make the error envelope robust regardless of which routes are hardened, `server/src/middleware/errorHandler.js` was patched to translate five Postgres SQLSTATE codes from 500 to 400:

- `22P02` — invalid_text_representation (e.g. `"not-a-uuid"` cast to uuid)
- `22008` — datetime_field_overflow
- `22003` — numeric_value_out_of_range
- `22007` — invalid_datetime_format
- `23503` — foreign_key_violation (mapped to "Referenced resource does not exist or is not accessible")

The patch is in the working tree only — the agent did not commit it before hitting `max_turns`. The file shows the diff cleanly; nothing else was modified in that file. Recommend reviewing and committing in a follow-up session under a separate `fix(api):` commit.

No new 5xx endpoints were observed against the existing harness this run.

## Frontend Feature Test Results

Session 2 (`s2-frontend-test`) hit `error_max_turns` after 81 turns ($5.35, 21 917 output tokens). The session captured nine fresh `qa14-0*` screenshots before timing out and surfaced the negative-currency display issue on Dashboard while reviewing Invoices.

| Page | What was tested | Result |
|---|---|---|
| `/` (Dashboard) | Glass cards, funnel, activity feed, AR/currency formatting | **Bug 1 found** — fixed (`485a522`), retested (`qa14r-01`) |
| `/pipeline` (Billing column) | Kanban Billing column rendering, lead cards | PASS — `qa14-02-pipeline-billing.png` |
| `/leads` | Table, filter chips, search input | PASS — `qa14-03-leads.png` |
| `/leads/:id` (Lead Detail) | Detail panel, fields, activity log | PASS — `qa14-04-lead-detail.png` |
| `/storm-map` | Map tiles, controls, search bar | PASS — `qa14-05-storm-map.png` |
| `/estimates` | Estimate list, primary CTA | PASS — `qa14-06-estimates.png` |
| Estimate Builder | Line-item editor, live preview | PASS — `qa14-07-estimate-builder.png` |
| `/invoices` | Invoice list, AR/balance column | **Bug 2 found** — fixed (`b3c1fe9`), retested (`qa14r-02`) |
| Invoice Modal | Invoice detail/edit modal | PASS — `qa14-09-invoice-modal.png` |

No regressions were observed on the seven pages that passed. The two currency-display issues both root-cause to the same anti-pattern and are documented under "Bugs Fixed" below.

## UI Consistency Audit Results

Session 3 (`s3-ui-audit`) hit `error_max_turns` after 61 turns ($3.52, 19 812 output tokens). It produced the five `btns-*.json` audit files and verified that Run 13's primary-CTA standardization still holds.

### Buttons (`btns-*.json` — 5 page-level captures + `dashboard-btns.json` full enumeration)

Primary-CTA spot checks (`authBtns` array on each page):

| Page | Primary CTA text | Height | Padding | Font | Weight | Border Radius | Status |
|---|---|---|---|---|---|---|---|
| `/pipeline` | `Add Lead` | 36 px | 0 24px | 13 px | 700 | 14/12 | ✓ matches `.auth-btn` (Run 13 fix held) |
| `/estimates` | `New Estimate` | 36 px | 0 24px | 13 px | 700 | 14/12 | ✓ |
| `/invoices` | `New Invoice` | 36 px | 0 24px | 13 px | 700 | 14/12 | ✓ |
| `/leads` | (no primary auth-btn rendered on this view; use is bulk-selection-driven) | — | — | — | — | — | n/a |

The Run 13 fix (commit `23c3746`, which moved Pipeline `Add Lead` and WorkOrders `New Work Order` onto `.auth-btn`) is confirmed intact on HEAD. Pipeline's `btns-pipeline.json` shows `Add Lead` rendering at 36 px / 0 24 px / 13 px / 700 with class `auth-btn shrink-0`. No new primary-CTA inconsistencies were surfaced.

### Dashboard buttons (`dashboard-btns.json` — 42 buttons enumerated)

The full enumeration of the 42 `<button>` elements on `/` shows the expected mix: 2 topbar icon buttons (38 px), 5 timeframe pills (`All Time`/`7 Days`/`30 Days`/`90 Days`/`YTD` — 23 px), 2 filter dropdowns (`All Reps`/`All Sources` — 36 px), 1 `Set Goal` accent (26 px), several navigation links (`View All`, `View Leads`, etc — 13 px text-only), 7 task-row checkboxes (14 px), 10 `Contact` chips (21 px), and a `Mapbox` attribution button. No outlier sizes, no inline-styled CTAs masquerading as primary buttons, no Material Symbols icons.

### Forms

Form audit was not re-run this session (no `form-audit.json` produced). The 16 search-input refactor candidate from Run 13 still applies: those inputs render visually identically to `.form-input` but do not carry the class. Not a regression.

### Sidebar / Nav

Sidebar audit was not re-run this session. The Run 13 capture (`sidebar-audit.json`, 36 items, 42 px height, 13.5 px / 500 font, active state `nav-link is-active` at 600 weight) remains the latest evidence and there are no commits on HEAD that would have altered it.

### Toolbars / Headers, Spacing, Modals

- Topbar: every page captured shows `header.topbar.glass` at 56 px height — consistent across `/`, `/pipeline`, `/leads`, `/estimates`, `/invoices`.
- Modals: no new modal regressions observed in `qa14-09-invoice-modal.png`. The Run 12 portal fix for WorkOrdersView modals continues to hold.
- Spacing: no new alignment issues observed in the nine `qa14-0*` baseline screenshots.

### Icons

No new non-Heroicon icons were introduced this run. `grep -r "material-symbols" client/src` is clean. The Material Symbols cleanup completed in Run 9 (`6e779d8`, `b5887e7`) and Run 6 (`0de487f`) holds.

## Bugs Fixed (numbered list)

1. **Dashboard `formatCurrency` — negative values rendered `$-1,000` instead of `-$1,000`.** (`client/src/components/Dashboard.jsx`) Negative AR/overpayment values were producing strings like `$-1,000` because the `$` was hardcoded as a prefix and `Number.toLocaleString()` placed the sign in front of the digits. Refactored to split sign from absolute value: `${sign}$${abs.toLocaleString()}`. Verified at `/`. Commit `485a522`. Screenshot: `qa14r-01-dashboard-ar-currency.png`.

2. **InvoicesView balance column — same display bug as Bug 1.** (`client/src/components/InvoicesView.jsx`) The overpaid invoice `INV-0013` displayed its negative balance as `$-1,000.00`. Same fix shape: `${balance < 0 ? '-' : ''}$${Math.abs(balance).toLocaleString(...)}`. Commit `b3c1fe9`. Screenshot: `qa14r-02-invoices-negative-balance.png`.

3. **(Uncommitted)** **`server/src/middleware/errorHandler.js` — 5xx leakage on Postgres input/FK errors.** Patch translates five Postgres SQLSTATE codes (`22P02`, `22008`, `22003`, `22007`, `23503`) from 500 to 400 with a sensible message, so even un-validated routes return a client error rather than an opaque 5xx for bad input. The diff is clean and isolated to that file. **Not committed** — the agent ran out of turns before committing. Recommended action: review and commit in the next session under a `fix(api): translate Postgres input errors to 400 in errorHandler` commit message.

## Known Issues (Not Fixed)

These are pre-existing items carried forward from earlier runs — none are new regressions.

- Admin panel requires global `super_admin` role to fully exercise (auth-tier limitation).
- Pipeline drag-and-drop not validated end-to-end in a browser (still using HTML5 drag API; planned migration to `@dnd-kit`).
- CSV export download is not verified as a binary download — only the 200 status is checked.
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration to fully exercise.
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys.
- File upload on Lead Detail (multipart path) not exercised by the API harness.
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing roadmap items, not regressions).
- `POST /drift/correct-all` and `POST /properties/trigger-import` still accept empty bodies and trigger heavy work — should require an explicit confirmation/role param. Tracked since Run 11.
- 16 search-input fields render correctly but do not carry the explicit `.form-input` class — refactor candidate, not a regression. Tracked since Run 13.
- **`server/src/middleware/errorHandler.js` patch (Bug 3 above) sits uncommitted in the working tree.** Carry-forward to next run.

## Test Coverage Gaps

- **Browser-interactive Playwright** flows (drag a Pipeline card across stages, add a line item to an Estimate, submit a new Lead via LeadForm, upload a document on Lead Detail) absent since QA Run 6. Run 14 captured screenshots only — no click/fill/drag was exercised.
- **Mobile responsive sweep** at 375 px and 768 px not performed this run. Last full mobile sweep: Run 6.
- **Negative-currency surfaces beyond Dashboard and Invoices.** Bug 1 + Bug 2 both root-cause to the same `$${num}` anti-pattern. Other surfaces that may also format currency (LeadDetail Profit / Expenses block, Reports, Estimates, ContractsView, ExpensesView) were not exhaustively audited for the same issue this run. Recommended next-run task.
- **`s5-report` session** has now produced a zero-byte JSON for **7 consecutive runs** (Runs 8–14). Recommend either folding the report into `s4-verify` with a longer turn budget, or removing the dedicated `s5` slot entirely. The follow-up session pattern is now the de facto contract.
- The fresh `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, `/tmp/ui-audit-results.txt` log files the orchestrator script expects were not produced this run. Audit evidence lives in `btns-*.json`, `dashboard-btns.json`, and `qa14*-png` instead.
- **Form audit + sidebar audit not re-run this session.** Last evidence is from Run 13. No commits since Run 13 would change those audits, but a fresh capture would be cheap to confirm.

## Session Integrity

| Session | Outcome | Turns | Output tokens | Cost |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51 | 24 413 | $3.32 |
| s2 frontend-test | `error_max_turns` | 81 | 21 917 | $5.35 |
| s3 ui-audit | `error_max_turns` | 61 | 19 812 | $3.52 |
| s4 verify | `error_max_turns` | 41 | 15 225 | $2.60 |
| s5 report | **0 bytes — did not run** (7th consecutive) | — | — | — |
| **Total** | | | **81 367** | **~$14.79** |

Despite all four substantive sessions hitting `max_turns`, the work landed: 2 commits on HEAD (Dashboard + InvoicesView currency formatting), plus 1 ready-to-commit improvement to the global error handler waiting in the working tree. Eleven fresh screenshots and five new button-audit JSONs were captured.
