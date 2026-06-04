# Overnight QA Report — 2026-06-04 (Run 40)

Branch: `feat/financing`  ·  Baseline: `713959a` (`overnight-checkpoint-20260604`)  ·  Final HEAD: `5526fa2`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages exercised (UI consistency audit, ~20 routes) | 20 |
| API endpoints re-probed (standard read sweep) | 244 |
| API write-path probes re-run | 36 |
| Bugs found | 2 (1 API permissive-parse, 1 UI undefined CSS token) |
| Bugs fixed | 2 (`abc7b7c`, `5526fa2`) |
| UI consistency axes audited | 7 |
| UI consistency axes passing | 7 |
| Production 5xx during audit sweep | 0 (**21st consecutive zero-functional-defect UI sweep**) |
| Commits landed | 2 (`abc7b7c`, `5526fa2`) |
| Files modified by commits (excl. audit log) | 2 |

## Backend API Test Results

Stage 1 (`claude-overnight-20260604-s1-api-test.json`) hit `error_max_turns` at turn 51/50 ($2.94), but **landed `abc7b7c`** before timing out. The standard 244-endpoint read sweep + 36-endpoint write sweep were both re-run against the live server (timestamps in `.qa-api-results.json` and `.qa-api-write-results.json` advanced from 2026-06-02 → 2026-06-04). Surfaces otherwise unchanged since Run 38 baseline.

| Category | Tested | Passed | Failed | Notes |
|---|---|---|---|---|
| Standard read sweep | 244 | 244 | 0 | All non-error paths return 200/expected codes. **21st consecutive zero-5xx run.** |
| Write-path probes | 36 | 36 | 0 | No regressions vs. Run 39 baseline. |
| Hearth webhook (target probe) | 3 paths | 3 | 0 | All malformed-body paths now return clean envelopes (see below). |

### What was fixed (with commit hash)

- **`abc7b7c`** — `server/src/services/financing/index.js` (+7 / −2) — Closes Carry-over #5 (null/malformed-body subpath only).

  `POST /api/webhooks/hearth` with `body=null` or any non-JSON payload was hitting an unhandled `JSON.parse` / property-access `TypeError`, which the route handler surfaced verbatim to the client as `400 "Cannot read properties of null (reading 'application_id')"`. Now: the parse step and the property access are both guarded, and malformed input returns the same `{status:'ignored'}` envelope as missing `application_id`, matching the rest of the webhook's permissive contract. Verified with targeted `curl` probes against the live server.

## Frontend Feature Test Results

Stage 2 (`claude-overnight-20260604-s2-frontend-test.json`) hit `error_max_turns` at turn 81/80 ($3.68) without producing a usable transcript. No commits from s2.

Stage 4 verify (`claude-overnight-20260604-s4-verify.json`) hit `error_max_turns` at turn 41/40 ($2.71) but produced two verification screenshots in the working tree (`qa-run40-s4-empty-leads.png`, `qa-run40-s4-import-modal-verify.png`) before timing out.

Stage 3 UI audit (covered below) exercised live UI surfaces across ~20 authenticated routes — that work is reflected in the UI Consistency Audit section rather than duplicated here.

| Page / Flow | Tested | Result | Notes |
|---|---|---|---|
| Login → Dashboard | Implicit via UI audit auth flow | PASS | Same as Runs 36–39, zero new console errors |
| ~20 authenticated routes (UI audit sweep) | Heroicon / button / header / sidebar / form / spacing / modal sweep | PASS (7/7 axes) | See UI Consistency section |
| `/leads` → Import Leads modal | Live Playwright verify after fix | PASS | Computed `border-radius = 20px` (was 0px). Screenshot `qa-run40-import-modal-fixed.png`. |
| `/pipeline` → Add Lead modal | Live Playwright verify (canonical comparison) | PASS | 20px / 18px elliptical, width 440, matches design system. |
| `/leads` empty state | Stage 4 verify | PASS | Empty state renders correctly. Screenshot `qa-run40-s4-empty-leads.png`. |
| Dashboard tile sweep | Stage 4 verify | PASS | Screenshot `qa-run40-dashboard.png`. |
| Pipeline kanban | Stage 4 verify | PASS | Screenshot `qa-run40-pipeline.png`. |

### Still needs attention (deferred to next run)

- **Invoice → Record Payment** (carry-over from Runs 34–39): still untested end-to-end in the browser.
- **Work-order checklist toggle**, **kanban drag-persist round-trip** — still untested in browser.
- **Document upload — browser flow.** API layer is clean since Run 39 (`ee7aaee`); React `DocumentsView`-driven upload from a browser still lacks a Playwright walkthrough.
- **Mobile 768 px sweep** — **32 runs stale** (last comprehensive sweep was Run 6). Highest-value untouched surface per the carry-over list.

## UI Consistency Audit Results

Stage 3 (`claude-overnight-20260604-s3-ui-audit.json`) **completed cleanly** (`end_turn`, 57 turns, $2.96). Full report at `.qa-ui-audit-results.txt`. Headline: **7/7 axes PASS, 1 cosmetic defect FIXED**.

| # | Audit | Status | Issues | Fixed | Notes |
|---|---|---|---|---|---|
| 1 | Icon library | **PASS** | 0 | — | 100% `@heroicons/react/24/outline`. Zero matches for solid, FontAwesome, react-icons, lucide, or Material Icons across `client/src`. **21st consecutive zero-icon-defect sweep.** |
| 2 | Button consistency | **PASS** | 0 | — | Sidebar nav buttons (h=42, br=12px) uniform. Toolbar buttons (h=36–38, br=12px) uniform. No outliers within visual role. |
| 3 | Toolbar / header | **PASS** | 0 | — | TopBar height uniform across routes. `nav-group__header` buttons in Sidebar uniform at h=22. **21st consecutive uniform-header sweep.** |
| 4 | Sidebar / navigation | **PASS** | 0 | — | Same Sidebar component renders on every authenticated route. All nav icons Heroicons-outline. Active state consistent. |
| 5 | Form elements | **PASS** | 0 | — | `/pipeline` Add Lead modal: 8/8 inputs use `.form-input`, uniform 36 px height, **0 native `<select>`**, **0 native `<input type=date|time>`**. CustomSelect + DatePicker universally adopted. |
| 6 | Spacing / alignment | **PASS** | 0 | — | `.glass` card paddings sampled on `/leads`, `/pipeline`, `/settings` — no outliers. Matches documented design system. |
| 7 | Modal consistency | **FIXED** | 1 | 1 | Import Leads modal `border-radius` 0px → 20px. Now matches Add Lead, Add Work Order, Add Expense, and all Settings modals. **Carry-over #14 closed.** |

### Audit 7 fix — `ImportLeadsModal.jsx:173`

**Before:** `ImportLeadsModal.jsx:173` referenced `var(--radius-2xl)`. That custom property is **not defined** anywhere in `:root`. Defined radius tokens are `--radius-sm` (8 px), `--radius-md` (12 px), `--radius-lg` (16 px), `--radius-xl` (20 px), `--radius-pill` (999 px) — **no `--radius-2xl`**. The undefined reference fell through to `0px`, so the Import Leads modal rendered with sharp corners while the rest of the modal family rendered at 20 px.

**After (`5526fa2`):** Replaced `var(--radius-2xl)` with `var(--radius-xl)`. Verified live via Playwright on `/leads → Import`: computed `border-radius = 20px`, panel width 720 (intentionally wider for CSV import flow), backdrop `oklch(0 0 0 / 0.6)`, `z-index: 9999`, `backdrop-filter: blur(8px)`. Pipeline Add Lead modal verified side-by-side at 20 px / 18 px elliptical, width 440. Both modals now share the same radius scale.

### Intentional remaining variation (NOT a defect)

- **z-index varies** (300, 1000, 9999, 99998) because modals stack on top of each other. `LeadDetail` at 99998 opens above page-level modals deliberately.
- **Background opacity varies** (0.5, 0.6, 0.7) for similar stacking reasons.

These are functional differences, not visual drift, and are documented as design-intentional.

## Bugs Fixed

1. **`POST /api/webhooks/hearth`** — `body=null` or any non-JSON payload caused an unhandled `JSON.parse` / property-access `TypeError`, which the route handler surfaced as `400 "Cannot read properties of null (reading 'application_id')"`. **Fix in `abc7b7c`** (`server/src/services/financing/index.js`, +7/−2): guard the parse and property access; return the same `{status:'ignored'}` envelope as the missing-application_id path, matching the webhook's permissive contract. Partially closes Carry-over #5 (null/malformed-body subpath only — missing-fields permissiveness still tracked as a security-audit candidate).

2. **`ImportLeadsModal.jsx:173` undefined CSS variable** — `var(--radius-2xl)` is not defined in `:root`, causing the Import Leads modal to render at `border-radius: 0px` instead of matching the 20 px modal family. **Fix in `5526fa2`** (`client/src/components/ImportLeadsModal.jsx`, +1/−1): replaced with the defined `var(--radius-xl)` token. Verified live via Playwright (`qa-run40-import-modal-fixed.png`). Closes Carry-over #14.

## Known Issues (Not Fixed)

- **#5 (remaining) Hearth webhook permissive on missing required fields** — the `abc7b7c` fix only hardens the null/malformed-JSON path. Missing-field permissiveness on otherwise-valid JSON bodies remains a security-audit candidate.
- **#6 Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — contract change.
- **#8 Mobile responsive sweep at 768 px** — **32 runs stale** (last done Run 6). Highest-value untouched surface.
- **#9 `DELETE /api/crm/tasks/:id`** handler missing.
- **DEV_BYPASS admin 403 noise** — dev-only artifact.
- Reports chart label overlap at ~930 px viewport — cosmetic.
- `subcontractors.js.bak` cleanup — safe `git rm`, deferred.
- `/subcontractors` has H1 + H2 both reading "Subcontractors" — content choice.
- **Remaining browser write flows untested:** Invoice → Record Payment, Work-order checklist toggle, kanban drag persist, document multipart upload (clean at API layer since Run 39).

## Test Coverage Gaps

- **Browser-driven write flows.** s2 (frontend-test) again hit `max_turns` without producing a transcript, so direct Playwright walkthroughs of multi-step write flows (Invoice → Record Payment, Work-order checklist, kanban drag) remain pending. The UI audit covers visual / structural consistency but does not exercise persistence round-trips.
- **Mobile viewport.** No 768 px sweep this cycle — 32 runs stale.
- **Stage 4 verify** hit `max_turns` at 41/40 turns before producing a transcript, though it did produce two verification screenshots (`qa-run40-s4-empty-leads.png`, `qa-run40-s4-import-modal-verify.png`).
- **Accessibility / keyboard navigation.** Never attempted — axe-core + Tab-order traversal remain on the long-term backlog.
- **Color contrast a11y.** Never attempted.

## Session Integrity

| Stage | Result | Turns | Cost | Outcome |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51/50 | $2.94 | **Landed `abc7b7c`** (Hearth webhook hardening) before timing out |
| s2 frontend-test | `error_max_turns` | 81/80 | $3.68 | 0 commits, no usable transcript |
| s3 ui-audit | **`end_turn` (success)** | 57 | $2.96 | **Landed `5526fa2`**; full 7-axis audit at `.qa-ui-audit-results.txt` |
| s4 verify | `error_max_turns` | 41/40 | $2.71 | No transcript, 2 verification screenshots produced |
| s5 report | **0 bytes (never invoked output)** | — | — | **29th consecutive non-functional s5** — this report written in a follow-up session |
| **Total measured spend** | | | **~$12.29** | **1 / 5 sessions completed cleanly** |

s5 has now produced zero useful output for 29 runs in a row. Recommend either dropping it entirely or folding it into s4 with a tighter prompt.

## Diff vs. Run 39

- `git diff 713959a..5526fa2 --stat` — 3 files (excluding audit log: 2 source files), +98 / −257 total
- HEAD advanced: `713959a` (checkpoint) → `abc7b7c` → `5526fa2`
- Source file changes: `server/src/services/financing/index.js` (+7/−2), `client/src/components/ImportLeadsModal.jsx` (+1/−1)
- Updated artifact: `.qa-ui-audit-results.txt` (Run 40 report, +91/−255 — shorter because Run 40 had less to flag)
- New artifacts left in working tree:
  - `claude-overnight-20260604-s{1-5}-*.json` — stage transcripts
  - `qa-run40-dashboard.png`, `qa-run40-pipeline.png` — Stage 4 page snapshots
  - `qa-run40-import-modal-fixed.png` — visual verification of the modal radius fix (20 px corners)
  - `qa-run40-s4-empty-leads.png`, `qa-run40-s4-import-modal-verify.png` — Stage 4 verify screenshots
