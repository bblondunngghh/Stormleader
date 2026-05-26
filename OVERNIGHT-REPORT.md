# Overnight QA Report — 2026-05-26 (Run 33)

Branch: `feat/financing`  ·  Baseline: `ce8bb85` (`pre-overnight-20260526`)  ·  Final HEAD: `bdd1d10`

## QA Test Summary

| Metric | Count |
|---|---|
| Pages spot-checked (UI consistency audit) | 3 (Dashboard, Invoices, Expenses) — full 19-route surface deemed redundant after Run 32 PASS baseline |
| API endpoints exercised | 3 targeted negative-case probes (carry-over findings) + implicit regression on touched services |
| Bugs found | 5 |
| Bugs fixed | 5 (3 backend, 2 UI) |
| UI inconsistencies / anti-patterns found | 1 (currency rendering, 13 call sites) |
| UI inconsistencies / anti-patterns fixed | 1 (full migration to shared `formatCurrency` util) |
| Commits landed | 5 (`911c319`, `de162f7`, `abfe6a8`, `4c53e0f`, `bdd1d10`) |
| Files modified | 9 |
| Production 5xx during sweep | 0 (**15th consecutive zero-5xx run**) |

## Backend API Test Results

s1 (api-test) hit `max_turns` at 51 turns ($4.31) but landed **3 commits before timeout**. The session deliberately targeted unfixed negative-case findings carried over from Run 32 rather than re-running the 41-endpoint regression sweep (14 prior runs at 0 prod-5xx — exhausted as a signal).

| Category | Tested | Passed | Failed | Fix |
|---|---|---|---|---|
| JSON body parser hardening | 1 | 0 | 1 | `app.js` wrapper now returns generic `400 {"error":"Invalid JSON body"}` instead of echoing the request body (`911c319`) |
| Drip sequence enroll (negative) | 1 | 0 | 1 | Tenant-scoped existence check added; bogus/cross-tenant id now returns `404 {"error":"Sequence not found"}` instead of `500` (`de162f7`) |
| Storm-sourced lead creation (negative) | 1 | 0 | 1 | `leadService` now stamps `err.status = 404`; bogus `stormEventId` returns `404` instead of `500` (`abfe6a8`) |

All three fixes were re-tested with curl after each commit (positive and negative cases). The drip-enroll fix also closes a latent cross-tenant steps-lookup leak (the pre-fix code ran a non-tenant-scoped steps query before throwing).

### What was fixed (with commit hashes)

- `911c319` — `server/src/app.js` (+8 / −1) — wraps `express.json()` parser error in a generic 400; clears Finding B from Run 32.
- `de162f7` — `server/src/services/dripService.js` (+16 / −2) — tenant-scoped pre-check + status code on legitimate "sequence has no steps" edge becomes 400 not 500.
- `abfe6a8` — `server/src/services/leadService.js` (+3 / −1) — adds `err.status = 404` to the missing-storm-event throw site.

## Frontend Feature Test Results

s2 (frontend-test) hit `max_turns` at 81 turns ($4.76) with **0 commits**. s4 (verify) hit `max_turns` at 41 turns ($2.09) with 0 commits.

Browser-driven *write* flows (the highest-yield carry-over since Run 29) remain unverified end-to-end. s2 has hit `max_turns` in 6 consecutive runs on this scope; the orchestrator prompt needs tighter per-session focus (one flow per session, not the full matrix).

| Page | Tested | Result | Notes |
|---|---|---|---|
| Dashboard `/` | Render (regression spot-check) | PASS | Run 32 baseline holds |
| Invoices `/invoices` | Render + currency formatting | PASS | Verified `$1,234.56` 2-decimal form after `4c53e0f` |
| Expenses `/expenses` | Render + currency formatting | PASS | Verified `$920.00`, `$750.00`, `$150.00` 2-decimal form after `bdd1d10`; 0 console errors |

**Still needs attention:** Add Lead submit, kanban drag persist, Invoice → Record Payment, Work-order checklist toggle, document upload, mobile 375 / 768 px sweep. Open carry-over since Run 29.

## UI Consistency Audit Results

s3 (ui-audit) **completed cleanly** at 97 turns ($4.30) — the only session of the run that did not time out. Produced 2 commits and a full audit-findings table in `.qa-ui-audit-results.txt`.

| Audit | Result | Action |
|---|---|---|
| Icons | All UI `<svg>` elements still Heroicons outline (`data-slot="icon"`, `stroke-width="1.5"`). | PASS — no fixes needed |
| Buttons | Run 32 PASS baseline still holds (auth-btn 36 px, quick-action-btn 36 px, pagination pills h=21/25 intentional compact variants). | PASS |
| Toolbars / headers | `topbar.glass` measured **exactly 56 px** on every spot-checked page; identical bg/border tokens. | PASS |
| Sidebar / nav | Run 32 fix (`01e9ec4`) still holds — Admin link uses standard `.nav-link.is-active` styling. | PASS |
| Forms | 0 native `<select>`, 0 native `<input type="date">`. All standard inputs use `.form-input`, all dropdowns use `CustomSelect`, all date pickers use `DatePicker`. | PASS |
| Spacing | H1 18 px / weight 700 consistent. Glass radii (`20px / 18px`) consistent. | PASS |
| Modals | 16 `.modal-backdrop` sites intact post Run-30 fix. | PASS |
| **Currency formatting (anti-pattern)** | **13 inline call sites** across `LeadDetail`, `InvoicesView`, `EstimatesView`, `ExpensesView`, `MaterialsView` used `Number(x).toLocaleString(..., { minimumFractionDigits: 2 })` **without** matching `maximumFractionDigits`, allowing float math (tax %, discount %, profit = estimate − sum(expenses)) to render 3+ decimals (`$1,234.567`). LeadDetail Profit also rendered negatives as `$-450.25` instead of `-$450.25`. MaterialsView crashed to `$NaN.00` on null prices. | **FIXED** — new `client/src/utils/currency.js#formatCurrency` (2-decimal enforced, negative-aware, NaN-safe), 20+ inline sites migrated, 2 duplicate per-file helpers consolidated (`4c53e0f`, `bdd1d10`) |

### What was fixed (with commit hashes)

- `4c53e0f` — `client/src/utils/currency.js` (+22 / −0, new file), `LeadDetail.jsx`, `InvoicesView.jsx`, `EstimatesView.jsx` — introduces shared util + migrates 20+ call sites.
- `bdd1d10` — `ExpensesView.jsx`, `MaterialsView.jsx` (+2 / −8) — kills 2 duplicate helpers; fixes latent `$NaN.00` bug on `MaterialsView` for null prices.

### Helpers intentionally left intact

| File | Helper | Why kept |
|---|---|---|
| `utils/financing.js` | `formatMoney(cents)` | Different input shape (cents not dollars) |
| `AdminDashboard.jsx` | `formatMoney(cents)` | Different input shape (cents not dollars) |
| `Dashboard.jsx` | `formatCurrency(dollars)` | Intentional K/M abbreviation for stat cards |
| `Pipeline.jsx` | `formatCurrency(dollars)` | Intentional K/M abbreviation + null-for-zero |
| `StormProperties.jsx` | `formatCurrency(dollars)` | Intentional no-decimals for assessed values |

## Bugs Fixed

1. **POST /api/crm/tasks malformed JSON 400 echoed request body** — `express.json()` rejected bad payloads with a `SyntaxError` whose message embedded a snippet of the offending body. The default error path forwarded that string verbatim. → Wrapper catches the parse failure and returns generic `400 {"error":"Invalid JSON body"}`. Clears Finding B from Run 32. (`911c319` — `server/src/app.js`)
2. **POST /api/crm/drip-sequences/:id/enroll returned 500 on bogus or cross-tenant UUID** — Service skipped existence check, ran a non-tenant-scoped steps lookup, then threw a status-less Error. → Tenant-scoped sequence lookup runs first; returns `404 {"error":"Sequence not found"}` for non-existent or cross-tenant rows. The legitimate "exists but has zero steps" case (data-only edge) now returns 400 not 500. Closes the cross-tenant steps-lookup leak too. (`de162f7` — `server/src/services/dripService.js`)
3. **POST /api/leads/from-storm returned 500 on bogus stormEventId** — `leadService` threw plain `Error("Storm event not found")` with no status. → Added `err.status = 404` so `errorHandler` surfaces it as a proper 404. (`abfe6a8` — `server/src/services/leadService.js`)
4. **Currency anti-pattern (`minimumFractionDigits` without max) across 11 UI sites** — Allowed `$1,234.567` to render any time float math hit `toLocaleString`. Also broke the `LeadDetail` Profit Summary negative sign (`$-450.25` vs standard `-$450.25`). → New shared `formatCurrency` util in `client/src/utils/currency.js`. 20+ inline call sites migrated. (`4c53e0f` — `client/src/utils/currency.js`, `LeadDetail.jsx`, `InvoicesView.jsx`, `EstimatesView.jsx`)
5. **`MaterialsView` rendered `$NaN.00` for null prices** + **`ExpensesView` duplicated the per-file helper** — Both files defined their own `formatCurrency`; MaterialsView's version returned `Number(undefined) → NaN` formatted with `toLocaleString`. → Both removed; both now import the shared util. (`bdd1d10` — `ExpensesView.jsx`, `MaterialsView.jsx`)

## Known Issues (Not Fixed)

- **DELETE /api/crm/tasks/:id handler missing** — surfaced by Run 32's catch-all 404 fix; client never calls DELETE on tasks. Deferred per "don't add new endpoints autonomously" rule. (Finding A from Run 32)
- **Heavy-work guards on `POST /drift/correct-all`, `POST /properties/trigger-import`, `POST /crm/leads/score-all`** — no `?confirm=true` gate. Contract change; needs deliberate product decision.
- **Hearth webhook permissive on missing fields** — security-audit candidate; deliberate decision needed.
- **Pre-token-attach 401 noise** in `client/src/api/client.js` (`/notifications/unread-count`, `/properties/import-progress`, `/crm/tenant-settings` fire before token attaches at boot). ~10-line interceptor fix; deliberately deferred to avoid touching shared client at QA hours.
- **Reports chart label overlap** at ~930 px viewport — cosmetic.
- **Multipart file-upload SUCCESS path** still untested (no `qa-fixtures/` binary fixtures).
- **CSV import success path** still untested per "no bulk DB writes" rule (Neon free tier).
- **`subcontractors.js.bak`** cleanup — safe `git rm`, deferred.
- **`.modal-backdrop` CSS class** still requires 6-line inline overlay at each of 16 sites — refactor opportunity, deliberately skipped per "don't refactor working features".
- **`/subcontractors`** has both H1 and H2 reading "Subcontractors" — content choice, not a consistency defect.

## Test Coverage Gaps

- **Browser-driven write flows** — Add Lead submit, kanban drag persist, Invoice → Record Payment, Work-order checklist toggle, document upload. s2 has hit `max_turns` 6 runs in a row on this scope. **Highest-yield frontier** — orchestrator prompt needs tighter per-session focus (one flow per session, not the full matrix).
- **Mobile responsive 375 / 768 px sweep** — last full sweep was Run 6 (25 runs ago).
- **Multipart file-upload success path** — `qa-fixtures/` does not exist.
- **CSV import success path** — paused per "no bulk DB writes" rule (Neon free tier).
- **CSV export download** — verified by HTTP 200, not by binary content-type or download trigger.
- **Admin panel** requires global `super_admin` role to fully exercise.
- **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration for live delivery testing.
- **Webhook valid-signature paths** — need real signing keys.
- **QuickBooks / Twilio / Stripe live flows** — not wired (pre-existing).

## Session Integrity

| Session | Outcome | Turns | Cost (USD) | Commits | Artifact |
|---|---|---|---|---|---|
| s1 api-test | `error_max_turns` | 51 / 50 | $4.31 | 3 (`911c319`, `de162f7`, `abfe6a8`) | — |
| s2 frontend-test | `error_max_turns` | 81 / 80 | $4.76 | 0 | — |
| s3 ui-audit | **completed** | 97 | $4.30 | 2 (`4c53e0f`, `bdd1d10`) | `.qa-ui-audit-results.txt` |
| s4 verify | `error_max_turns` | 41 / 40 | $2.09 | 0 | — |
| s5 report | 0 bytes | — | — | 0 | **24th consecutive non-functional s5** — drop the stage or fold into s4 |
| **Total** |  |  | **~$15.46** | **5** |  |

- 3 / 5 sessions hit `max_turns`. s3 (ui-audit) completed cleanly — best session of the run, cleared the currency carry-over open across 4+ prior runs.
- s1 still landed 3 commits before timing out — the carry-over Run-32 findings were concrete enough to act on inside 50 turns.
- 5 / 5 sessions produced no `permission_denials` and no `errors` other than max-turns.

## Artifacts

- `claude-overnight-20260526-s{1,2,3,4,5}-*.json` (5 session metadata files; s5 0 bytes)
- `.qa-ui-audit-results.txt` (Run 33 audit findings table — currency anti-pattern detail)
- `client/src/utils/currency.js` (new shared util, 22 lines)
- `OVERNIGHT-REPORT.md` (this report)
- `docs/overnight-history.md` (appended)
