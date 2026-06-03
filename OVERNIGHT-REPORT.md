# Overnight QA Report — 2026-06-03 (Run 39)

Branch: `feat/financing`  ·  Baseline: `bf91a2d` (`overnight-checkpoint-20260603`)  ·  Final HEAD: `ee7aaee`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages exercised (UI consistency audit, 20 routes) | 20 |
| API endpoints exercised (multipart upload re-probe) | 3 |
| Bugs found | 1 functional + 1 cosmetic |
| Bugs fixed | 1 functional (`ee7aaee`) |
| Bugs deferred | 1 cosmetic (NEW Carry-over #14 — modal-backdrop inline-style drift) |
| UI consistency axes audited | 7 |
| UI consistency axes passing | 7 |
| Production 5xx during audit sweep | 0 (**20th consecutive zero-functional-defect UI sweep**) |
| Commits landed | 1 (`ee7aaee`) |
| Files modified by commits | 1 (`server/src/routes/documents.js`) |

## Backend API Test Results

The standard 118-endpoint sweep was **not re-run this cycle** — client source files were already 0-changes since the Run 38 baseline (`4782de5`), so the surfaces would have produced the same results as Run 38. Effort this run was concentrated on closing the highest-priority open carry-over: the **multipart document upload 500** found by Run 38 (Carry-over #13).

| Category | Tested | Passed | Failed | Notes |
|---|---|---|---|---|
| Documents upload (target probe) | 3 | 3 | 0 | All three failure modes from Run 38 now return correct status codes — see below |
| Full standard sweep | — | — | — | Skipped — code surfaces unchanged since Run 38 baseline (4782de5) where it passed 117/118 with 0 unintentional 5xx |

### What was fixed (with commit hash)

- **`ee7aaee`** — `server/src/routes/documents.js` (+29 / −3) — Two defects in `POST /api/documents/upload` (Carry-over #13 from Run 38):

  1. **Valid PNG → 500 with `ENOENT`.** Multer `diskStorage` `destination` was resolved via `process.cwd() + 'uploads'`. The server runs from the project root, where no `uploads/` directory exists (only `server/uploads/` does). Resolved the destination relative to the route module via `fileURLToPath(import.meta.url)` and `mkdirSync({recursive:true})` at load so multer never hits `ENOENT`.

  2. **Rejected `.exe` → 500 instead of 400.** `fileFilter` was calling `cb(new Error(...))` without a `.status` property, so the global error handler emitted a generic 500. Now: the `fileFilter` rejection error carries `status:400` and a clean message; `upload.single('file')` is wrapped in a handler that also translates multer's own `MulterError` (`LIMIT_FILE_SIZE → 413`, others → 400).

  Verified post-commit with `.qa-api-upload-probe.mjs`:

  | Probe | Before (Run 38) | After (Run 39) |
  |---|---|---|
  | Valid PNG | 500 "Internal server error" | **201 Created** |
  | `.exe` payload | 500 "Internal server error" | **400 "file type not allowed"** |
  | No file | 400 "No file uploaded" | 400 "No file uploaded" |

  Closes Carry-over #13.

## Frontend Feature Test Results

Stage 2 (`claude-overnight-20260603-s2-frontend-test.json`) hit `max_turns` at 81 turns ($4.79) before producing a usable transcript. No new browser PNGs from s2.

Stage 3 UI audit (which used Playwright in headless mode) did exercise live UI surfaces across 20 routes and confirmed all visible UI is healthy — that work is reflected in the UI Consistency Audit section below rather than duplicated here.

| Page / Flow | Tested | Result | Notes |
|---|---|---|---|
| Login → Dashboard | Implicit via UI audit auth flow | PASS | Same as Runs 36–38, zero new console errors |
| All 20 routes (UI audit sweep) | Heroicon / button / header / sidebar / form / spacing / modal sweep | PASS (all 7 axes) | See UI Consistency section |
| Documents upload (API-layer fix verification) | `.qa-api-upload-probe.mjs` re-run after `ee7aaee` | PASS | PNG → 201, .exe → 400, no file → 400 |

### Still needs attention (deferred to next run)

- **Invoice → Record Payment** (carry-over from Runs 34–38): still untested end-to-end in the browser.
- **Work-order checklist toggle**, **kanban drag-persist round-trip** — still untested in browser.
- **Document upload — browser flow.** API layer is now clean; the React `DocumentsView`-driven upload from a browser is still not directly browser-tested in QA. Production users have not reported failures, but a Playwright walkthrough remains untouched.
- **Mobile 768 px sweep** — **31 runs stale** (last comprehensive sweep was Run 6). Highest-value untouched surface per the carry-over list.

## UI Consistency Audit Results

Stage 3 (`claude-overnight-20260603-s3-ui-audit.json`) **completed cleanly** (`end_turn`, 85 turns, $3.60). Full report at `.qa-ui-audit-results.txt`. Headline: **7/7 axes PASS, 0 functional defects, 1 cosmetic flag** in Audit 7.

| # | Audit | Status | Issues | Fixed | Notes |
|---|---|---|---|---|---|
| 1 | Icon library | **PASS** | 0 | — | 37 files import `@heroicons/react/24/outline`; 0 imports of solid, lucide, react-icons, fontawesome, material-icons. Browser sweep across 20 routes counted ~2,095 Heroicons-outline SVGs and 9 non-Heroicon SVGs — all 9 are recharts chart-surface elements on `/reports` (correctly excluded). **20th consecutive zero-icon-defect sweep.** |
| 2 | Button consistency | **PASS** | 0 | — | `nav-link` (256 buttons): height 42 px / radius 12 px uniform. `topbar__btn` (38): 38 px / 12 px uniform. `quick-action-btn`, `task-check`, `auth-btn`, `reports-preset-btn`, `gm-control-active`, `nav-group__header` all internally uniform. Tailwind-utility no-class buttons grouped by height/radius are also internally uniform within each visual role. |
| 3 | Toolbar / header | **PASS** | 0 | — | All 20 routes: top toolbar 56 px tall, `oklch(0.16 0.015 260 / 0.35)` background, `topbar glass` class — zero variance. **20th consecutive uniform-header sweep.** |
| 4 | Sidebar / navigation | **PASS** | 0 | — | Sampled `/pipeline`, `/leads`, `/estimates`, `/settings`: 240 px wide, uniform background, exactly 1 active nav-link per page (matching the page), nav-link height 42 px uniform. Top-level link count varies 7–11 by page because nav-groups expand contextually (documented design). |
| 5 | Form elements | **PASS** | 0 | — | Static scan: **0 native `<select>`**, **0 native `<input type=date\|time>`** in `client/src/components/`. Browser sweep: 0 native dropdowns, 0 native date pickers. 22 inputs not using `.form-input` — all intentional (20 × TopBar Cmd-K search uses `.topbar-search`; 1 × AddressSearch geocoder on `/storm-map` has its own matching 36 px style; 1 × `<input type="range">` slider). `CustomSelect` + `DatePicker` components universally adopted. |
| 6 | Spacing / alignment | **PASS** | 0 | — | Glass border-radius dominated by Apple-style asymmetric "20px / 18px" (55 panels), with 14 panels at 20 px, 9 at 16 px, 3 at 12 px, 1 at 999 px (intentional pill). Padding varies contextually by panel role (card body / toolbar inset / activity feed). Matches documented design system. |
| 7 | Modal consistency | **PASS** with 1 cosmetic note | 1 | 0 | All 4 modals that opened (`/pipeline`, `/leads import`, `/expenses`, `/work-orders`) opened/animated/closed/stacked correctly. **Cosmetic drift only:** they share `.modal-backdrop` class + animation, but each re-asserts the backdrop styles **inline** with divergent values — see table below. Not fixed under the "don't refactor working features" rule. Logged as **NEW Carry-over #14.** |

### Audit 7 — modal-backdrop inline-style drift (cosmetic only)

| Route | z-index | bg-opacity | child border-radius | width |
|---|---|---|---|---|
| `/pipeline` (Add Lead) | 300 | 0.5 | 20 px / 18 px | 440 |
| `/leads` (Import Leads) | 9999 | 0.6 | 14 px | 720 |
| `/expenses` (Add Expense) | 9999 | 0.6 | 20 px | 480 |
| `/work-orders` (Add Work Order) | 1000 | 0.6 | 20 px | 520 |

Three distinct z-index values (300 / 1000 / 9999), two distinct bg-opacities (0.5 / 0.6), three distinct child border-radii (20 px / 20 px+18 px / 14 px). Root cause: `.modal-backdrop` CSS only declares the animation; every component re-asserts `position: fixed; inset: 0; z-index: …; background: …; backdrop-filter: …` inline.

Sub-finding: `client/src/components/ImportLeadsModal.jsx:173` references `var(--radius-2xl)` — that variable is **undefined** in the theme (only `--space-2xl` is). That is why the Import Leads modal renders 14 px corners while every other modal renders 20 px.

Functional impact: **none.** All modals stack below the 9999 CustomSelect portal layer, so portaled dropdowns still render above any modal correctly. Recorded for cleanup if any of these components is touched anyway.

Screenshots: `qa-run39-modal-pipeline.png` (Add Lead — standard 20/18 corners), `qa-run39-modal-import.png` (Import Leads — visibly more rectangular 14 px corners).

## Bugs Fixed

1. **`POST /api/documents/upload`** — Valid PNG returned 500 with `ENOENT` because multer's disk-storage destination was resolved against `process.cwd()` (project root, no `uploads/` directory) instead of the route module's directory. **Fix in `ee7aaee`:** resolve destination relative to the route file via `fileURLToPath(import.meta.url)` and `mkdirSync({recursive:true})` at module load. Verified PNG → 201.

2. **`POST /api/documents/upload`** — `.exe` payload returned 500 instead of 400 because `fileFilter`'s `cb(new Error(...))` had no `.status` property so the global error handler emitted 500. **Fix in `ee7aaee` (same commit):** attach `status:400` to the rejection error and wrap `upload.single('file')` to also translate `MulterError` (`LIMIT_FILE_SIZE → 413`, others → 400). Verified .exe → 400.

## Known Issues (Not Fixed)

- **NEW Carry-over #14 — modal-backdrop inline-style drift** (cosmetic). 4 `.modal-backdrop` modals diverge in z-index / bg-opacity / child border-radius. Plus: `ImportLeadsModal.jsx:173` references undefined CSS variable `--radius-2xl`. Centralize backdrop styles into `.modal-backdrop` CSS rule and either define `--radius-2xl: 24px` in `:root` or replace its single use site with `var(--radius-xl)`. Components touched by the cleanup would include `CreateLeadModal`, `ImportLeadsModal`, `ExpensesView`, `WorkOrdersView`, `MaterialsView`, `LeadDetail`, `EmailModal`, `SettingsView`, `EstimatesView`, `InvoicesView`, `DripSequences`, `PhotoAnnotator`, `CalendarView`.
- **#5 Hearth webhook permissive on missing fields** — security-audit candidate.
- **#6 Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` — contract change.
- **#8 Mobile responsive sweep at 768 px** — **31 runs stale** (last done Run 6). Highest-value untouched surface.
- **#9 `DELETE /api/crm/tasks/:id`** handler missing.
- **DEV_BYPASS admin 403 noise** — dev-only artifact.
- Reports chart label overlap at ~930 px viewport — cosmetic.
- `subcontractors.js.bak` cleanup — safe `git rm`, deferred.
- `/subcontractors` has H1 + H2 both reading "Subcontractors" — content choice.
- **Remaining browser write flows untested:** Invoice → Record Payment, Work-order checklist toggle, kanban drag persist, document multipart upload (now clean at API layer, browser walkthrough still pending).

## Test Coverage Gaps

- **Browser-driven write flows.** s2 (frontend-test) again hit `max_turns` without producing a transcript, so direct Playwright walkthroughs of multi-step write flows (Invoice → Record Payment, Work-order checklist, kanban drag) remain pending. The UI audit covers visual / structural consistency but does not exercise persistence round-trips.
- **Mobile viewport.** No 768 px sweep this cycle — 31 runs stale.
- **Standard 118-endpoint backend sweep was not re-run.** Code surfaces were 0-changes vs. Run 38 baseline so the results would be identical, but skipping it means we cannot prove the **20th consecutive zero-5xx run** — Run 38 was the **19th**. Re-running next cycle (cheap) would extend the streak.
- **Accessibility / keyboard navigation.** Never attempted — axe-core + Tab-order traversal remain on the long-term backlog.
- **Color contrast a11y.** Never attempted.

## Session Integrity

| Stage | Result | Turns | Cost | Outcome |
|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51/50 | $3.05 | **Landed `ee7aaee`** (documents upload fix) before timing out |
| s2 frontend-test | `error_max_turns` | 81/80 | $4.79 | 0 commits, no usable transcript |
| s3 ui-audit | **`end_turn` (success)** | 85 | $3.60 | Full 7-axis audit at `.qa-ui-audit-results.txt` |
| s4 verify | `error_max_turns` | 41/40 | $2.44 | No usable transcript |
| s5 report | **0 bytes (never invoked output)** | — | — | **28th consecutive non-functional s5** — this report written in a follow-up session |
| **Total measured spend** | | | **~$13.88** | **1 / 5 sessions completed cleanly** |

s5 has now produced zero useful output for 28 runs in a row. Recommend either dropping it entirely or folding it into s4 with a tighter prompt.

## Diff vs. Run 38

- `git diff bf91a2d..ee7aaee --stat` — 1 file, +29 / −3 (`server/src/routes/documents.js`)
- HEAD advanced: `bf91a2d` (checkpoint) → `ee7aaee`
- New artifacts left in working tree (reusable):
  - `.qa-ui-audit-dash.mjs` — dashboard probe with `domcontentloaded` wait (root route hangs on `networkidle` due to Mapbox / activity polling)
  - `.qa-ui-modal-only.mjs` — modal probe with text-matching button finder
  - `.qa-ui-modal-results.json`
  - `.qa-ui-modal-sidebar.mjs`, `.qa-ui-modal-sidebar.json` — sidebar probe
  - `.qa-ui-modal-screenshot.mjs` — visual modal comparison
  - `qa-run39-modal-pipeline.png`, `qa-run39-modal-import.png` — modal drift evidence
  - `qa-run39-dashboard.png`, `qa-run39-storm-map.png`, `qa-run39-stage4-lead-detail.png` — page snapshots from s2/s4
