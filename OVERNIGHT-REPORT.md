# Overnight QA Report — 2026-06-14 (Run 46)

Branch: `feat/financing`  ·  Baseline: `b652433` (`checkpoint: pre-overnight-run 2026-06-14`)  ·  Final HEAD: `7339032`

> **Run type: mostly-converged, with one real fix.** Backend API and the UI-consistency design system are both converged (0 findings, as in the prior five runs). The verification stage (s4) found and fixed **one genuine bug**: the tablet-768px dashboard layout. s4 ran out of turns before committing it, leaving a partial fix in the working tree that also introduced a desktop regression; this report stage (s5) corrected it, verified it via Playwright, and committed it as `7339032`.

---

## QA Test Summary

| Metric | Count |
|--------|-------|
| Frontend pages exercised at runtime | 6 (Dashboard, Invoices, Settings, Tasks, Estimates list + builder; Dashboard re-checked at 1280px + 768px) |
| API endpoints / probes tested | 272 routes inventoried · full standing probe suite re-run (63 GET sweep + 71 negative-case gaps + edge/type-fuzz/patch-delete + 2 happy-path writes + tenant-isolation checks) |
| Bugs found | **1** (tablet 768px dashboard layout) |
| Bugs fixed | **1** (commit `7339032`) |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |

**Net code change this run:** 2 commits — `8d12947` (read-only API probe snapshot refresh, not a fix) and `7339032` (the tablet-768px fix).

---

## Backend API Test Results

Source: `C:\tmp\api-test-results.txt` (s1, ✅ completed). Server `http://localhost:3001`, JWT auth as `waterlooconstruction1@gmail.com` / `tenantSlug=waterloo`. **0 unintentional 5xx, 0 broken endpoints, 0 fixes needed — 6th consecutive converged backend run.**

| Probe / Check | Endpoints | Result | Failed | Fixed |
|---------------|-----------|--------|--------|-------|
| `.qa-uncovered-get-probe.mjs` | 63 GET routes | 62 `<500`, 1 intentional 503 | 0 unintentional 5xx | — |
| `.qa-gaps-probe.mjs` (negative cases) | 71 probes | 46×400, 19×404, 3×200, 1×401 (bad refresh), 2×429 (auth RL) | 0 5xx | — |
| `.qa-api-edge-probe.mjs` | edge inputs | bad-uuid→400, no-auth→401, SQL-inj→empty result | 0 5xx | — |
| `.qa-api-probe.mjs` | main suite | clean except intentional skip-trace 503 | 0 5xx | — |
| `.qa-uncovered-probe.mjs` | list endpoints | 200; missing-params→400 | 0 ERR | — |
| `.qa-patch-delete-probe.mjs` | PATCH/DELETE | empty/no-op → 400/404 (no crash) | 0 5xx | — |
| `.qa-type-fuzz.mjs` / `-2` | type-mismatch payloads | → 400 | 0 5xx | — |
| Happy-path `PATCH /crm/leads/:id` | 1 (write) | **200** (no-op priority write) | 0 | — |
| Happy-path `PATCH /crm/invoices/:id` | 1 (write) | **200** (no-op status write) | 0 | — |
| Tenant isolation — foreign estimate | GET/PATCH/PDF | **404** (no cross-tenant access) | 0 | — |
| Tenant isolation — `tenant_id` injection | query/body/header | all ignored; returns own-tenant data only | 0 | — |

By category: **auth** — login/refresh return correct 200/401, brute-force rate-limiter fires 429 (correct); **CRM** (leads/invoices/tasks/activities/pipeline) — list 200, happy-path writes 200, negative cases 400/404; **estimates** — list/get 200, foreign-tenant 404; **storm/geo data** (storm-history, disaster-declarations, map/swaths, fema-housing) — 400 guards on missing lat/lng/bbox/zip (intentional, Neon free-tier cost guard); **financing** — public token apply validates planId first (400 field hint, never 5xx); **skip-trace** — 503 env-gate (no `TRACERFY_API_KEY`).

**Endpoints fixed:** 0 — nothing was broken.

**Intentional non-2xx (by design, not bugs):** skip-trace 503 (no paid API key, per zero-paid-API charter); auth 429 (rate-limiter); geo-param 400 guards (cost protection).

---

## Frontend Feature Test Results

Sources: s3 UI-audit Playwright walk (✅), s4 verify (⚠️ hit max-turns; produced the tablet fix), s5 Playwright re-verification.

| Page | Tested | Passed | Broken → Fix | Needs attention |
|------|--------|--------|--------------|-----------------|
| Dashboard (desktop) | Render, stat cards, storm map, activity feed | ✅ all render | — | — |
| Dashboard (tablet 768px) | Layout at 768px breakpoint | ❌ content squished into narrow right column; bottom tab bar missing | **FIXED** — `.content-area { grid-column: 1 }` + bottom-tab-bar cascade fix (`7339032`) | — |
| Invoices | List render, glass cards, toolbar | ✅ | — | Not re-walked at 768px (see gaps) |
| Settings | Tabs, form elements | ✅ | — | `/settings/*` sub-tabs not all walked |
| Tasks | Filter tabs, list | ✅ | — | — |
| Estimates (list + builder) | List, builder modal, live preview, 9 form fields | ✅ all `.form-input` | — | — |

**The one bug (tablet 768px dashboard):** at the `≤768px` breakpoint, `.content-area` inherited the desktop grid's column 2, squeezing the entire dashboard into a narrow right-hand strip with empty space on the left. Separately, a global `.bottom-tab-bar { display: none }` rule was declared *after* the `@media (max-width:768px)` block, so by source-order cascade (equal specificity) it overrode the mobile `display:flex` and hid the bottom tab bar at **every** width — so the tablet/mobile nav never appeared. s4 caught this (before/after screenshots `qa-tablet-768-dashboard.jpeg` / `-fixed.jpeg`) and applied a fix, but ran out of turns before committing — and its fix removed the global hide entirely, which made the tab bar render on **desktop** (a `<nav>` defaults to `display:block`). s5 corrected this by moving the desktop `display:none` to *before* the media query so the mobile `display:flex` wins on small screens while desktop stays hidden.

Verified via Playwright (s5):
- Desktop 1280px → `.bottom-tab-bar` computed `display:none`, height 0 (hidden ✅)
- Tablet 768px → `.bottom-tab-bar` `display:flex`, visible; `.content-area` grid-column 1, content left 8px / width 746px of 768 (full-bleed ✅)
- `vite build` clean (7.92s)

**Still needs attention (carried):** page-list visual walk incomplete (`/leads`, `/leads/:id`, `/work-orders`, `/calendar`, `/reports`, `/canvassing`, `/content-studio`, remaining `/settings/*` tabs) — s2 frontend stage hit max-turns with no output; tablet 768px sweep of pages *other than* Dashboard.

---

## UI Consistency Audit Results

Source: `C:\tmp\ui-audit-results.txt` (s3, ✅ completed). Code-level grep across `client/src` + runtime Playwright walk. **Verdict: converged — 0 inconsistencies requiring a fix, 0 code changes.**

| Category | Finding | Fixed? |
|----------|---------|--------|
| **Icons** | 100% `@heroicons/react/24/outline` — 38 imports / 37 files. 0 solid, 0 foreign (no lucide/FontAwesome/MUI). Only inline SVGs are decorative map markers in CanvassingMode/StormMap (allowed). Runtime: 70/70 SVGs on Dashboard are hero-outline. | No fix needed |
| **Buttons** | Shared class system — `.auth-btn` (primary 36px / accent-blue / r14·12 / 700), `.quick-action-btn` (secondary glass), tab buttons (r8px). Consistent on every page. | No fix needed |
| **Toolbars / Headers** | `.topbar.glass` is 56px on every page (shared component, rendered outside the route). | No fix needed |
| **Sidebar / Nav** | `.nav-link` / `is-active` / `--child` states uniform. | No fix needed |
| **Forms** | 0 native `<select>` and 0 native `<input type="date">` in the entire `src` tree — `CustomSelect` + `DatePicker` enforced. Estimate builder: 9/9 real fields use `.form-input`. | No fix needed |
| **Spacing** | `--space-*` tokens used throughout. | No fix needed |
| **Modals** | Two intentional patterns, each internally consistent — `.modal-backdrop` centered (13 files) and `.slide-over` right-drawer (6 files). | No fix needed |

**Observations (NOT bugs — render correctly, out of scope per "do not refactor working features"):** Dashboard uses Tailwind arbitrary classes (`rounded-[12px]`, `text-[11px]`) vs. semantic CSS elsewhere; page titles are inline-styled (no shared `.page-header`, list pages lack a semantic `<h1>` — an a11y/refactor item); SubcontractorsView slide-over has redundant inline styles that exactly duplicate the `.slide-over` class.

---

## Bugs Fixed

1. **[Dashboard — tablet 768px]** — At the `≤768px` breakpoint the dashboard content was squished into a narrow right-hand column (it inherited the desktop grid's column 2), and the bottom tab bar was hidden at all widths because a global `.bottom-tab-bar { display: none }` declared *after* the mobile media query overrode it by source order. — **Fixed** (`7339032`): added `.content-area { grid-column: 1 }` inside the `≤768px` block, and moved the desktop `.bottom-tab-bar { display: none }` to *before* the media query so the mobile `display:flex` wins on small screens while the bar stays hidden on desktop. Verified at 1280px (hidden) and 768px (shown, full-bleed content); `vite build` clean.

---

## Known Issues (Not Fixed)

These are unchanged from prior runs — each is either a missing feature (charter forbids adding endpoints), an environment/cost constraint, or a cosmetic pre-existing item not worth a refactor:

- **#6 Heavy-work guards** — `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all` have no rate-limit/concurrency guard. Testing them does bulk work → needs staging, not prod Neon. Untouched.
- **#9 `DELETE /api/crm/tasks/:id`** — handler missing. A missing feature, not a broken endpoint; charter forbids adding endpoints.
- **(cosmetic)** `/alerts` has 2 raw `<input type="text">` without `.form-input` glass styling.
- **(cosmetic)** `/reports` and `/settings` `.glass` cards use 16px corner radius vs. the app-standard 20px.
- **(cosmetic)** Reports chart label overlap at ~930px viewport.
- **(observation)** `POST /api/crm/financing/public/:token/apply` validates `planId` before token (400 leaks a field hint to unauthenticated callers); never 5xx.
- **(observation)** `POST /api/payments/webhook` echoes the Stripe SDK signature-failure string on empty payload; still 400, not 500.

---

## Test Coverage Gaps

- **Frontend page-list visual walk incomplete** — s2 (frontend test) hit max-turns (81/80) and produced no output or commit. Not exercised at runtime this run: `/leads`, `/leads/:id`, `/work-orders`, `/calendar`, `/reports`, `/canvassing`, `/content-studio`, and most `/settings/*` tabs. Backend coverage for these routes remains clean.
- **Tablet 768px sweep** — only Dashboard was checked at 768px this run (and fixed). The other pages have not been swept at tablet width; this is the stalest visual gap and the highest-value next target now that the breakpoint mechanism is known-good.
- **a11y / axe-core** — never attempted.
- **Keyboard navigation** (Tab order, Esc-to-close, Enter-to-submit, focus rings) — never attempted.

### Session integrity
- **s1 api-test** — ✅ completed (48 turns, $3.32). Landed `8d12947` (probe snapshot refresh). Also root-caused the recurring "mass 401" red herring: a Bash↔Node `/tmp` path mismatch on the token file (Node reads `C:\tmp`), not an app bug — corrected mint command now in `overnight_resume.md`.
- **s2 frontend-test** — ⚠️ error_max_turns (81/80, $6.21). No summary, no commit, no results file.
- **s3 ui-audit** — ✅ completed (52 turns, $2.92). 0 fixes; wrote `C:\tmp\ui-audit-results.txt` + `qa-ui-audit-estimate-builder.jpeg`.
- **s4 verify** — ⚠️ error_max_turns (41/40, $3.74). Found the tablet-768px bug and applied a (partial) fix to `index.css`, with before/after screenshots, but ran out of turns before committing or catching the desktop side-effect.
- **s5 report** — this stage. Completed + corrected s4's tablet fix, verified it via Playwright at both breakpoints, committed `7339032`, and wrote this report. Approx. s1–s4 spend ~$16.20.
