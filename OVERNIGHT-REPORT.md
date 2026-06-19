# StormLeads — Overnight QA Report

**Run 51 · 2026-06-19 · branch `feat/financing`**

> Run-number note: the s3/s4 stage artifacts self-labeled this "Run 52"; the canonical number
> is **Run 51** — the history file's last entry was Run 50 (2026-06-18), and the backend is on its
> **11th consecutive converged run** (Runs 41–51). Server on `:3001`, UI on `:5173`.

---

## QA Test Summary

| Metric | Count |
|---|---|
| Backend API endpoints tested | 245 routes (~1,300+ requests across the full probe suite) |
| Frontend pages/views tested | Tablet-768px sweep of the **final un-swept pages** — Invoices, Reports, Subcontractors, Expenses, Contracts, all 15 Settings tabs, LeadDetail slide-over, Leads list, Storm Archive, Dashboard |
| UI-consistency audit dimensions | 7 (icons, forms, modals, buttons, headers, sidebar, spacing) |
| **Bugs found** | **0** |
| **Bugs fixed** | **0** |
| UI inconsistencies found | 0 |
| UI inconsistencies fixed | 0 |
| **Total commits this run** | **0** |

A full-convergence run. No new bugs were found on any axis and no code changed. The QA charter is
"if it works, leave it alone" — so 0 findings correctly produced 0 commits. The headline outcome:
the **tablet-768px sweep is now 100% complete across the entire app**, joining the backend (11 runs)
and UI-consistency (8 audits) as a converged axis.

---

## Backend API Test Results

s1 re-ran the full standing probe suite against `:3001`. Results are **identical to the Run 50
baseline**.

**Verdict: BACKEND CONVERGED — 11th consecutive run with 0 code fixes. 0 unintentional 5xx.**

| Probe | Requests | Result |
|---|---|---|
| `.qa-sweep-all.mjs` | 245 | 200×91, 400×72, 403×6, 404×75, 503×1 — 0 unintentional 5xx |
| `.qa-type-fuzz.mjs` | 1026 | 0 5xx / 0 err |
| `.qa-api-tenant-isolation-probe` | 22 | 22/22 OK (injection ignored, non-admin → 403) |
| `.qa-happy-write-probe.mjs` | 3 | 3/3 OK (PATCH lead/invoice → 200, estimate skip) |
| `.qa-gaps-probe.mjs` | many | 0 5xx; bad-uuid → 400, zero-id → 404 correct |
| `.qa-api-edge-probe.mjs` | many | 0 5xx; sql-inj-search → empty, wrong-method → 404, clamped limits → 200 |

**By category — all passed, 0 failed, 0 fixed:**
- **Auth** — login/refresh validate correctly. Only non-200 is the HTTP login rate limiter (429 ~10/15min).
- **CRM (leads/tasks/activities/invoices)** — full CRUD surface clean. Happy-path `PATCH /crm/leads/:id {priority:"warm"}` → 200; `PATCH /crm/invoices/:id {status:"sent"}` → 200.
- **Estimates / documents / financing / payments** — clean. Financing (the active `feat/financing` dev area) returns its plan data without error.
- **Skip-trace** — `GET /skip-trace/job/:jobId` → 503 "Skip trace service not configured" (no `TRACERFY_API_KEY`; intentional per the zero-paid-API constraint).
- **Admin** — 6× 403 on `/api/admin/*` (the test user is tenant admin, not platform-admin — correct authz).

**Tenant isolation (22/22):** `tenant_id` injected via query string, POST body, and `X-Tenant-Id`
header are all ignored (returns own-tenant Waterloo data only); foreign/zero UUIDs → 404, never
cross-tenant leakage; `/api/admin/tenants` as non-platform-admin → 403.

**Code changes this category: NONE.** Fix yield has been 0 for 11 runs — the backend is converged
and should not be re-tested.

### Tooling finding — token mint (not a server bug)
s1 surfaced one real **tooling** issue (not a code defect): the DB-direct mint script
`.qa-mint-token.mjs` produced tokens the running server rejected with 401 (a "phantom mass-401" —
233×401 on the first sweep). Investigation ruled out expiry (token `exp` epoch is after `now`; the
ISO display is skewed by the sandbox's mocked date) and ruled out a secret-parse bug (`.env`
dotenv-parse is byte-identical to the mint parse; `server/.env` does not exist, so the server reads
repo-root `.env`). Root cause: the **running server process holds a different in-memory `JWT_SECRET`
than the current `.env` file** (booted with an older secret, or `.env` edited after boot) — an
operational/env-state issue, left untouched per charter. **Workaround used and recommended for next
run:** mint via HTTP login (uses the server's own in-memory secret) and write the token to both
`/tmp/qa-token.txt` and `.qa-token.txt`; HTTP token lifetime is 15 min, so run probes back-to-back.

---

## Frontend Feature Test Results

s2 (frontend) logged into the app with Playwright (server `:3001`, UI `:5173`) and completed the
**final un-swept portion of the tablet-768px sweep**. The sweep is now 100% complete across the whole
app. Probe method per page: `scrollWidth − clientWidth` overflow check + a per-element
`right > viewport` offender scan (filtering intentionally-scrollable containers) + a console-error
check.

**Result: 0 bugs found, 0 fixes, 0 commits. Every page clean at 768px.**

| Page (@768px) | Overflow | Console | Notes |
|---|---|---|---|
| Invoices | 0 | 0 err | clean |
| Reports | 0 | 0 err | clean |
| Subcontractors | 0 | 0 err | clean |
| Expenses | 0 | 0 err | clean |
| Contracts | 0 | 0 err | clean |
| Settings — all 15 tabs | 0 | 0 err | Profile → Reviews, including the Financing APR table (5 plans, renders cleanly) |
| LeadDetail slide-over | 0 | 0 err | full render: contact / property / weather / insurance / activity / tasks / docs / expenses / profit / quick-actions |
| Leads list | 0 | 0 err | clean |
| Storm Archive (`/storm-catalog`) | 0 | 0 err | clean |
| Dashboard | 0 | 0 err | real data |

**Route note (working as intended, not a bug):** `/content-studio` is **not a route** — it is a
future feature; the `*` wildcard correctly redirects unknown routes to `/`. Real routes are defined
in `App.jsx:93–131`.

**Standing fix re-verified (s4):** the most recent standing code fix `aab6753` (estimate-builder
"Roof Components" toolbar `flex-wrap` @768px, from Run 50) was re-verified at runtime — From-preset /
Add-All / Blank-Row on line 1, "Add from SRS Catalog" wraps to line 2 (x=329, right=501, fully in the
768 viewport), 0 overflow; @1280 desktop all 4 buttons single line. This is the 3rd consecutive verify
confirming it.

---

## UI Consistency Audit Results

s3 ran a definitive code-level grep over **all** of `client/src` (authoritative for icons / forms /
modal-animation) plus a Playwright runtime spot-check of Dashboard, Estimates (recently changed), and
Settings (forms-heavy).

**Result: CONVERGED — 8th consecutive 0-fix UI-consistency audit. No code changes.**

| Dimension | Finding | Fixed? |
|---|---|---|
| **Icons** | 100% `@heroicons/react/24/outline`. 0 solid / lucide / react-icons / fontawesome / material. RT: Dashboard 70/70, Estimates 38/38, Settings 31 — all heroicon `viewBox 0 0 24 24`, 0 foreign. | n/a — clean |
| **Buttons** | Radii group into design tokens; the "14/12px" & "10/8px" pairs are CSS `border-radius` clamping on short elements (documented prior), not one-off inconsistencies. | n/a — clean |
| **Toolbars / Headers** | Consistent across pages; no drift. | n/a — clean |
| **Sidebar / Nav** | Uniform; no issues. | n/a — clean |
| **Forms** | 0 native `<select>`, 0 native `<input type="date"/"time">` in the entire src tree. CustomSelect + DatePicker enforced. | n/a — clean |
| **Spacing** | No alignment/overflow issues found at runtime. | n/a — clean |
| **Modals** | Only inline `animation:` is LeadDetail 1806/1933, both *exactly* byte-equal to the canonical `.modal-backdrop > .glass` rule (`modal-scale-in 200ms ease-apple`). | n/a — clean |

Only 3 `client/src` files changed since the last audit, all previously audited: **LeadDetail.jsx**
(the `b689994` checkpoint committed the Esc-to-close handler — keyboard-nav, not visual drift; its
modal animations remain canonical), **EstimatesView.jsx** (`aab6753`), and **ImportLeadsModal.jsx**
(`e3b548b`). None introduced icon/form/animation drift.

**Non-bugs confirmed (do not "fix"):** button radii `14/12px` & `10/8px` (CSS clamp artifacts); the
single un-classed Settings input is the global TopBar Cmd-K search (`.topbar__search`), present
app-wide and consistent — not a page form field.

---

## Bugs Fixed

None this run. No bug was found on any axis (backend, frontend tablet-768px sweep, or UI-consistency),
so no code changed. The standing fix `aab6753` from Run 50 remains the most recent code change and was
re-verified working.

---

## Known Issues (Not Fixed)

1. **EstimateBuilder does not collapse at phone width (375px)** *(pre-existing; out of scope this run).*
   The builder body is a flex-row with a fixed **280px** sidebar (`flexShrink:0`, holds the section
   enable/disable toggles — functional, not just nav) + a `flex:1` editor inside an `overflow:hidden`
   container (`EstimatesView.jsx:1838`). At 375px the sidebar eats 280px and the form content is pushed
   off the right edge and clipped/unreachable. Screenshot: `qa-375-estimate-builder.jpeg`. **Works
   correctly at 768px+** (the supported tablet/desktop widths). Mobile is paused (web-app-only focus),
   so this is deferred; a proper fix is a responsive sidebar collapse/stack — a design-sized change.
2. **Esc-to-close missing on most modals (app-wide keyboard-nav gap).** Of 17 components with
   modals/overlays, only a few (SubcontractorsView, Pipeline slide-overs, TopBar/AddressSearch
   dropdowns, PhotoAnnotator, RoofDrawingTool) handle Escape; most close only via X / backdrop. Adding
   Esc-to-close where it never existed is a **new feature**, which the QA charter forbids — it is
   tracked as a developer feature decision, not a QA bug. If pursued, the fix must be a shared hook
   applied to all modals at once (a per-component patch would increase inconsistency).
3. **Heavy-work guards** on `/drift/correct-all`, `/properties/trigger-import`, `/crm/leads/score-all`
   — no rate-limit/concurrency guard. Exercising these does bulk work → needs staging, not prod-tier
   Neon. Untouched.
4. **`DELETE /api/crm/tasks/:id` handler missing** (frontend only exports `updateTask`/PATCH). Adding
   endpoints is forbidden by the QA charter. Untouched.
5. **`TopBar` ImportProgress poller** logs a graceful 401 on `/api/properties/import-progress` when the
   JWT is expired — handled silently, touches FEMA-import territory → DO NOT TOUCH. Not a regression.

---

## Test Coverage Gaps

- **Keyboard nav** — Esc-to-close app-wide, Tab order, focus rings, Enter-submit are untested. This is
  the highest-value remaining area, but it is an **enhancement** (the app never had it), so it sits
  outside the QA charter and is a developer feature decision rather than a bug to fix in a QA run.
- **Phone-375px sweep** — EstimateBuilder sidebar collapse (Known Issue #1) is the one identified
  375px finding; the rest of the phone-width sweep is untouched. Mobile is paused, so this is low
  priority.
- **Converged axes — do not re-test:** backend (11 runs, 0 fixes), UI-consistency (8 audits, 0 fixes),
  and now the **tablet-768px sweep (100% complete, 0 bugs)**. Fix yield on all three is 0.

**Net:** within the QA charter, the app is converged on every axis tested and there is genuinely
nothing left to fix. The next run should only re-test if the developer has added **new pages or
component files** since this run (the recurring drift vector is a new modal with a non-canonical
inline animation — fast check: grep `components/*.jsx` for inline `animation:…scale`).

---

## Session Integrity

| Stage | Outcome | Turns | Cost |
|---|---|---|---|
| s1 api-test | ✅ success — backend re-verified converged (11th run), 0 fixes; surfaced the token-mint tooling finding | 24 | $2.32 |
| s2 frontend-test | ✅ success — completed the tablet-768px sweep to 100%, 0 bugs, 0 fixes | 56 | $4.62 |
| s3 ui-audit | ✅ success — converged (8th 0-fix audit), 0 changes | 22 | $1.76 |
| s4 verify | ✅ success — re-verified `aab6753` @768/@1280, build clean 8.68s, edge cases pass, 0 fixes | 31 | $3.60 |
| s5 report | this report | — | — |

**0 commits stand for this run** — every axis converged with 0 findings. s1–s4 spend ≈ **$12.30**.
All 4 working stages exited cleanly (no max-turns stage this run).

---

## Deliverables

- `C:\tmp\api-test-results.txt` (s1) · `C:\tmp\ui-audit-results.txt` (s3) · `C:\tmp\verify-results.txt` (s4)
- Screenshots from the standing `aab6753` verification: `qa-375-estimate-builder.jpeg`, `qa-768-estimate-builder.jpeg`, `qa-768-estimate-builder-fixed.jpeg`, `qa-estimates-after-back.jpeg`
- Final `npx vite build`: clean (verified at report close).
