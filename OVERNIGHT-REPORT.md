# Overnight QA Report — 2026-06-15 (Run 47)

Branch: `feat/financing`  ·  Baseline: `d0432b8` (`checkpoint: pre-overnight-run 2026-06-15`)  ·  Final HEAD: `db43990`

> **Run type: converged backend + UI design system, with two real frontend fixes.** The backend API (7th consecutive converged run) and the UI-consistency design system (0 findings) are both stable. The high-value work this run was the **tablet-768px responsive sweep**, which surfaced and fixed **two genuine bugs** on the Leads and Materials pages. The verification stage (s4) confirmed both fixes work at 768px and 375px with a clean build. This report stage (s5) is documentation only — no further code changes.

---

## QA Test Summary

| Metric | Count |
|--------|-------|
| Frontend pages exercised at runtime | 8 — Dashboard, Leads, Materials, Invoices, Settings, Tasks, Estimates (list + builder); Leads & Materials checked at 1280 / 768 / 375px |
| API endpoints / probes tested | 272 routes inventoried across 38 route files · ~1,180 probe requests (standing probe suite) |
| Bugs found | **2** (Leads Address column hidden @768px; Materials category tabs clipped @768px) |
| Bugs fixed | **2** (commits `55d5df6`, `db43990`) |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |

**Net code change this run:** 2 commits — both genuine responsive fixes (`55d5df6`, `db43990`). No backend changes, no UI-consistency changes.

---

## Backend API Test Results

Source: `C:\tmp\api-test-results.txt` (s1, ✅ completed). Server `http://localhost:3001`, JWT auth as `waterlooconstruction1@gmail.com` / `tenantSlug=waterloo` (`791bb51d`). Method: ran the standing probe suite (`.qa-*.mjs`) covering the full route surface across all 38 `server/src/routes/*.js` files — more exhaustive and reproducible than ad-hoc curl. **0 unintentional 5xx, 0 broken endpoints, 0 fixes needed — 7th consecutive converged backend run.**

| Probe / Check | Coverage | Result | Failed | Fixed |
|---------------|----------|--------|--------|-------|
| `.qa-uncovered-get-probe.mjs` | 63 uncovered GET routes | 62 `<500`, 1 intentional 503 | 0 unintentional 5xx | — |
| `.qa-gaps-probe.mjs` | onboarding / payments / props / work-orders / trace | all 400/404 (validation) | 0 5xx | — |
| `.qa-api-edge-probe.mjs` | malformed json, bad uuid, no-auth, sql-inj, huge/neg limits | clean | 0 5xx | — |
| `.qa-api-write-probe.mjs` | 36 empty-body POSTs | 3×200, 33×400 | 0 5xx | — |
| `.qa-api-tenant-isolation-probe.mjs` | 22 cross-tenant injection attempts | 22/22 OK (injection ignored) | 0 | — |
| `.qa-type-fuzz.mjs` | 1026 type-fuzz payloads | clean | 0 5xx | — |
| `.qa-patch-delete-probe.mjs` | 10 DELETE on nonexistent ids | all 404 | 0 5xx | — |
| `.qa-happy-write-probe.mjs` | valid PATCH lead / estimate / invoice | 3 writes, 3×200 | 0 | — |

**TOTAL: ~1,180 probe requests · 0 unintentional 5xx · 0 broken endpoints · 0 code fixes.**

By category:
- **Auth** — login/refresh respond correctly; repeated logins → 429 (rate limiter, intentional). No 5xx.
- **CRM** (leads, estimates, invoices, tasks, documents, search, notifications) — happy-path PATCH writes → 200; bad input → 400/404. No 5xx.
- **Skip-trace** — `503` on `GET /api/skip-trace/job/:jobId` (no `TRACERFY_API_KEY` configured — expected, not a bug).
- **Payments / financing** — empty/no-signature webhook → 400 (verified), never 500.
- **Tenant isolation** — `tenant_id` injected via query, body, and `X-Tenant-Id` header all ignored; foreign-id GET/PATCH/DELETE → 404; non-platform-admin → 403 on `/api/admin/tenants`.

**Fixed this run: none** (nothing to fix). Per the QA charter ("if it works, leave it alone"), no backend commits.

---

## Frontend Feature Test Results

Source: s2 (frontend-test) and s4 (verify). s2 ran the tablet-768px sweep that found both bugs; s4 verified the fixes via Playwright at 768px and 375px.

### Leads (`/leads`, LeadList)
- **Tested:** Table layout at 1280 / 768 / 375px; column visibility rules; empty state.
- **Passed:** Desktop unchanged; at 768px columns 1–5 (incl. Address) visible, 6+ hidden, page overflow 0, table fits 712px; degrades cleanly at 375px; empty state (`/leads?search=zzz…`) shows "No leads found" + helper text with no overflow.
- **Broken → fixed:** At ≤768px the rule `nth-child(n+5)` hid the **Address** column, leaving only checkbox / Stage / Priority / Score — a strip of indistinguishable badges, with Address (the lead's primary identifier, since contact is often blank) gone. **Fixed `55d5df6`:** changed to `nth-child(n+6)` so the Address column stays visible at tablet width.
- **Needs attention:** None.

### Materials (`/materials`)
- **Tested:** Category tab filter row (All … Delivery) at 1280 / 768 / 375px; search field position.
- **Passed:** Desktop unchanged; at 768px the row is `overflow-x:auto` (scrollWidth 1673 > client 712), scrolls to reveal the last category (Delivery), search stays pinned right, page overflow 0; still scrollable at 375px.
- **Broken → fixed:** At ≤768px the category row overflowed its `overflow:hidden` `.glass` container, clipping every category past ~Ventilation with **no way to reach them**. **Fixed `db43990`:** added `overflowX:auto` + `.no-scrollbar` so the tab row scrolls horizontally at narrow widths.
- **Needs attention:** None.

### Dashboard, Invoices, Settings, Tasks, Estimates (list + builder)
- **Tested:** Runtime walk during the UI audit (s3); Dashboard bottom tab bar re-verified at 768/375px (Run 46 fix `7339032` still holding).
- **Passed:** All render correctly; no overflow; bottom tab bar still rendering at tablet/mobile widths. No new bugs.
- **Needs attention:** Tablet-768px sweep of these pages' deeper interactions is the carried-forward next target (see Coverage Gaps).

**Console:** Only transient mount-race 401s on initial load (data loads fine afterward); Materials page logged 0 console errors.

---

## UI Consistency Audit Results

Source: `C:\tmp\ui-audit-results.txt` (s3). Method: code-level grep across `client/src` + runtime Playwright walk of Dashboard, Invoices, Settings, Tasks, and Estimates list + builder. **Verdict: converged — 0 inconsistencies requiring a fix, 0 code changes.**

- **Icons:** CLEAN. 38 icon imports across 37 files, 100% `@heroicons/react/24/outline`; 0 solid or foreign icons. Runtime: 70/70 SVGs on Dashboard are Heroicons outline. Inline `<svg>` on CanvassingMode / StormMap are decorative map markers (allowed).
- **Buttons:** CLEAN. `.auth-btn` (primary, 36px, accent-blue, r14/12, weight 700) and `.quick-action-btn` (secondary glass) consistent everywhere; tab buttons (Settings/Tasks) uniform 8px style.
- **Toolbars / Headers:** CLEAN. `.topbar.glass` is 56px on every page (shared component, rendered outside the route).
- **Sidebar / Nav:** CLEAN. `.nav-link` / `--child` and active state uniform across all pages.
- **Forms:** CLEAN. **0 native `<select>`** and **0 native `<input type="date">`** in the entire `src` (CustomSelect / DatePicker enforcement holds). Estimate builder: 9/9 real fields use `.form-input`. GlobalSearch box and the estimate range slider are legitimately exempt.
- **Spacing:** CLEAN. `--space-*` tokens used throughout.
- **Modals:** CLEAN. 13 components use the canonical `.modal-backdrop` + `.glass` + scale-in pattern; 6 use the shared `.slide-over` drawer classes.

**Observations (NOT bugs — render correctly, out of scope per charter "do not refactor working features"):**
- O1. Dashboard widgets use Tailwind arbitrary classes (`rounded-[12px]`, `text-[11px]`) while the rest of the app uses semantic CSS classes. Computes correctly; stylistic divergence only.
- O2. Page titles are inline-styled `<div>`/`<h2>` with minor weight variance (700 vs 800), no single shared `.page-header` class, and list pages lack a semantic top `<h1>`. An a11y/refactor item, not a visual inconsistency.
- O3. SubcontractorsView slide-over restates position/width/radius/padding via inline styles that exactly duplicate the `.slide-over` class values. Redundant but renders identically.

**Fixed this run: none** (nothing to fix).

---

## Bugs Fixed (numbered list)

1. **Leads (`/leads`)** — At ≤768px the lead table hid the Address column (`nth-child(n+5)`), leaving only badge columns and no human-readable lead identifier. — **Fixed `55d5df6`:** changed the hide rule to `nth-child(n+6)` so Address stays visible at tablet width.
2. **Materials (`/materials`)** — At ≤768px the category tab row overflowed its `overflow:hidden` `.glass` container, clipping categories past ~Ventilation with no way to reach them. — **Fixed `db43990`:** added `overflowX:auto` + `.no-scrollbar` to make the tab row horizontally scrollable.

---

## Known Issues (Not Fixed)

These are carried from prior runs and remain out of scope per the QA charter (need staging, a missing feature decision, or a design decision — not a prod-safe overnight fix):

- **#6 Heavy-work guards** — `/api/drift/correct-all`, `/api/properties/trigger-import`, `/api/crm/leads/score-all` have no rate-limit/concurrency guard. Needs staging, not prod Neon. Untouched.
- **#9 `DELETE /api/crm/tasks/:id`** — handler missing (a missing feature; charter forbids adding endpoints overnight).
- **(cosmetic)** `/alerts` has 2 raw `<input type="text">` without `.form-input` glass styling.
- **(cosmetic)** `/reports` and `/settings` `.glass` cards use 16px radius vs. the app-standard 20px.
- **(cosmetic)** Reports chart label overlap at ~930px viewport.
- **(observation, not a bug)** `POST /api/crm/financing/public/:token/apply` validates planId before token (a 400 leaks a field hint to unauthenticated callers); never 5xx.
- **(observation, not a bug)** `POST /api/payments/webhook` echoes the Stripe SDK sig-failure string on an empty payload; still 400, not 500.

---

## Test Coverage Gaps

- **Tablet-768px sweep — incomplete.** Done & clean so far: Dashboard (`7339032`), Leads (`55d5df6`), Materials (`db43990`). Still un-swept at 768px: Invoices, Tasks, Calendar, Reports, Estimates list + builder, Pipeline, LeadDetail, Subcontractors, Expenses, Work Orders, Contracts, Settings tabs. **This is the highest-value next target** — the breakpoint mechanism is confirmed good and the pattern (resize 768, check `body.scrollWidth - body.clientWidth`, look for clipped content in `overflow:hidden` containers) keeps finding real bugs.
- **a11y / axe-core** — never attempted.
- **Keyboard navigation** (Tab / Esc / Enter / focus rings) — never attempted.
- **Backend** — CONVERGED (Runs 41–47, 0 fixes). Intentionally not re-tested further; do not keep re-probing it.
- **Bulk/heavy endpoints** not probed by design: county import, `leads/score-all`, `drift/correct-all`, `properties/trigger-import`, CSV import, FEMA live lookups (DO NOT TOUCH), Stripe webhook with valid signature.

### Session Integrity
- **s1 api-test:** ✅ end_turn (17 turns, $1.09) — backend re-verified converged, 0 fixes.
- **s2 frontend-test:** ⚠️ error_max_turns (81/80, $5.45) — no end summary, but landed both responsive fixes (`55d5df6`, `db43990`) before turns ran out.
- **s3 ui-audit:** ⚠️ error_max_turns (61/60, $3.73) — UI audit results written to `C:\tmp\ui-audit-results.txt`; converged, 0 changes.
- **s4 verify:** ✅ end_turn (30 turns, $1.64) — both fixes verified @768px & @375px, empty state + bottom tab bar confirmed, `vite build` clean.
- **s5 report:** this report. Total s1–s4 spend ~$11.91. 2/4 working stages exited cleanly; both that hit max-turns still produced their deliverables (fixes / audit file).
