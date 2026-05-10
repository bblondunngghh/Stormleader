# Overnight QA Report — 2026-05-10 (Run 23)

Branch: `feat/financing` · Pre-run checkpoint: `c07170b` (`overnight-checkpoint-20260510`) · Head: `c07170b` (no source-code commits this run)

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints tested | **265** (unchanged from Run 22) |
| API handler coverage | 265 / 272 = **97.4 %** |
| Pages walked (frontend) | **0** (s2 captured 1 screenshot — `qa-run24-storm-map.png` — before max_turns; no full walk) |
| Bugs found (production 5xx) | **0** |
| Bugs fixed | **0** |
| New findings (deferred, not fixed) | 0 |
| UI inconsistencies found | **0** (Dashboard SVG audit: 71/71 Heroicons before s3 max_turns) |
| UI inconsistencies fixed | **0** |
| Commits this run (source) | **0** — `git diff overnight-checkpoint-20260510..HEAD` is empty |
| Production 5xx after run | **0** (ninth consecutive run) |
| Intentional 503s | 1 (`GET /api/skip-trace/job/:jobId` when `TRACERFY_API_KEY` unset) |

This is the **ninth consecutive overnight QA run with 0 production-code 5xx**
(Runs 15–23). No fixes were needed this run: zero server-side commits exist
between the Run 22 harness commit (`7169023`) and the Run 23 pre-overnight
checkpoint (`c07170b`), so the harness re-ran against an identical tree and
produced an identical clean tally. s1 fully completed for the **fifth
consecutive run** (Runs 19–23). s2/s3/s4 each hit max_turns and s5 was 0
bytes (**15th consecutive** 0-byte s5).

## Backend API Test Results

The harness (`qa-api-test.mjs`, 265 calls — unchanged from Run 22) was run
end-to-end against `http://localhost:3001`. Final tally from
`qa-api-test-results.json` (re-verified post-run):

```
Total: 265
200: 128
201:   2
400:  84   (input-validation negatives)
404:  50   (not-found negatives)
503:   1   (intentional graceful-degrade — TRACERFY_API_KEY unset)
5xx (production): 0
NETERR: 0
```

| HTTP method | Count | All passed |
|---|---:|---|
| GET | 132 | yes |
| POST | 80 | yes |
| PATCH | 27 | yes |
| PUT | 8 | yes |
| DELETE | 18 | yes |
| **Total** | **265** | **yes** |

### Coverage by route category

| Category | Result | Fixes this run |
|---|---|---|
| Auth (`/api/auth/*`) | clean | 0 |
| Storms (`/api/storms*`) | clean | 0 |
| Properties (`/api/properties/*`) | clean (incl. fema-live, fema-live-polygon, import-csv) | 0 |
| CRM core (`/api/crm/*`) | clean | 0 |
| Leads / activities / contacts | clean | 0 |
| Estimates / Invoices / Work-orders | clean | 0 |
| Tasks / Documents / Drip / Custom-fields | clean | 0 |
| Subcontractors / Materials / Expenses / Contracts | clean | 0 |
| Drift / Counties / Parcels | clean | 0 |
| Skip-trace (Tracerfy) | clean (1 intentional 503) | 0 |
| Webhooks (Tracerfy, Hearth, Stripe) | clean (Run 21 Hearth carry-over open) | 0 |
| Notifications / Search / Reports | clean | 0 |
| Team / Profile / Tenant settings | clean | 0 |
| Public estimate / Onboarding | clean | 0 |
| Payments (Stripe-touching) | clean | 0 |
| Financing (`/api/crm/financing/*`) | clean (public-token endpoints return 200 `[]` for invalid tokens by design — JOIN-based filter avoids leaking token existence) | 0 |

### Diff vs. Run 22

- `git diff 7169023..c07170b -- server/src/routes/` — empty.
- `git diff 7169023..c07170b -- qa-api-test.mjs` — empty.
- Harness coverage unchanged at 265 / 272 (97.4 %).
- No new fixes, no new commits, no new findings.

### Investigated and dismissed

- **"280 routes" raw grep vs. 272 active**: traced to
  `server/src/routes/subcontractors.js.bak`, a tracked backup file with 8
  router-method matches. Not imported anywhere; not a bug; not a regression.
  Logged as carry-over #14 (cleanup candidate, deferred per "don't refactor
  working state" task constraint).
- **`/api/crm/financing/public/:token/{plans,applications}`** returning
  `200 []` for invalid tokens: re-verified handler. Service uses a JOIN on
  `e.public_token = $1`; non-match yields empty rows. Correct-by-design —
  avoids leaking token existence. Not a bug.

### Coverage gaps (7 untested handlers — unchanged from Run 22)

Of the 272 total handlers in `server/src/routes/*.js`, 7 remain untested:

- **2 auth flows** — `POST /auth/{register,login}` (login is exercised
  implicitly by harness preamble; register skipped to avoid creating
  accounts).
- **1 onboarding flow** — `POST /onboarding/create-tenant` (would create a
  real tenant — destructive, one-time per tenant).
- **2 Stripe-touching POSTs** — `POST /payments/connect/{onboard,refresh}`
  (both call `stripe.accountLinks.create` regardless of body — no
  body-validation guard runs first).
- **3 heavy-job triggers without guards** — `POST /properties/trigger-import`,
  `POST /drift/correct-all`, `POST /crm/leads/score-all` (all three accept
  empty bodies and immediately fire the background work).

## Frontend Feature Test Results

Stage 2 (Playwright walk) hit `max_turns` at 81 turns. Unlike Run 22 (which
captured a complete 12-route walk before exhaustion), Run 23's s2 produced
only **1 screenshot** before running out of turn budget:

| Route | Screenshot | Notes |
|---|---|---|
| `/storm-map` | `qa-run24-storm-map.png` (526 KB, captured at 05:06) | Map and layer panel render. (Filename mislabeled "run24" by the s2 agent — actual run is Run 23. File is on disk untracked at the project root.) |

Stage 4 produced no additional verification screenshots (max_turns at 41
turns, lower turn budget than s2/s3 — this is the s4 default).

### Routes not walked Run 23

Every UI page **except** `/storm-map`. None of the standard 12 primary
routes (`/dashboard`, `/pipeline`, `/leads`, `/leads/:id`, `/estimates`,
`/invoices`, `/work-orders`, `/tasks`, `/calendar`, `/reports`,
`/canvassing`, `/storm-catalog`, `/content-studio`) were captured. The 12
`/settings/*` tabs were not walked. Last full primary-route walk was Run 22
(2026-05-09); last full walk including settings tabs was Run 18
(2026-05-04).

### What was tested / what passed / what was broken

- `/storm-map` — **passed** (renders, no console errors visible at capture).
- All other routes — **not tested this run** (s2 max_turns).
- **Nothing was broken.** No commits, no diffs, no findings.

### What still needs attention

Tracked as carry-overs — see "Known Issues" below. No new attention items
surfaced this run because no testing reached the surfaces.

## UI Consistency Audit Results

Stage 3 hit `max_turns` at 61 turns and produced no commits. The partial
`/tmp/ui-audit-results.txt` (12 lines) shows the audit reached only the
Dashboard before exhaustion:

| Audit category | Finding | Fixed? |
|---|---|---|
| **Icons** — Dashboard SVG audit | **71 / 71 Heroicons (24×24), 0 decorative/other** — clean | n/a — clean |
| **Icons** — non-Heroicon imports (full-repo grep) | 0 hits for `lucide-react`, `@fortawesome`, `react-icons`, `feather-icons`, `@heroicons/react/24/solid`, `@heroicons/react/20/`, `material-symbols-*`, raw `&times;` (re-verified post-run) | n/a — clean |
| **Icons** — inline SVGs as icons | 0 (decorative SVGs in map/chart layers only) | n/a — clean |
| **Buttons** — primary CTA height alignment | All toolbar primary CTAs use `.auth-btn` (Run 17 fix `a16ac46` and Run 13 `23c3746` still hold) | n/a — clean |
| **Buttons** — danger / delete styling | Consistent `.btn-danger` (re-verified by code grep — no inline red colors) | n/a — clean |
| **Toolbars / Headers** | TopBar `viewTitles` complete (Run 18 fix `29d4a34` still holds) | n/a — clean |
| **Sidebar / Nav** | Not screenshot-walked this run; no code changes since Run 22 | n/a — assumed clean |
| **Forms** — `.form-input` class | 16 search-input fields still lack the explicit class (cosmetic carry-over from Run 13) | not fixed — cosmetic |
| **Forms** — native `<select>` / `<input type="date">` | 0 found in components — `CustomSelect` and `DatePicker` used everywhere (per CLAUDE.md feedback memories) | n/a — clean |
| **Spacing & Alignment** | Not re-walked beyond Dashboard this run; no CSS changes since Run 22 | n/a — assumed clean |
| **Modals** | Not re-screenshotted this run; no JSX changes since Run 22 | n/a — assumed clean |

Note: the s3 agent labeled its output "Run 24" in the markdown header. The
s1 agent (authoritative) and resume file label this Run 23. The s3 numbering
is a mislabel; this report uses **Run 23** throughout.

## Bugs Fixed (Run 23)

**None.** Zero commits between `7169023` (Run 22 harness expansion) and
`c07170b` (Run 23 pre-overnight checkpoint). The harness ran against an
identical server-side tree and produced an identical clean tally (265
endpoints, 0 unintended 5xx). No bugs surfaced; no fixes were needed.

## Known Issues (Not Fixed)

Carry-overs unchanged from Run 22, plus #14 added this run:

1. **Heavy-work guards** on `POST /drift/correct-all`,
   `POST /properties/trigger-import`, and `POST /crm/leads/score-all` —
   accept empty bodies, immediately trigger full job. `trigger-import` has
   an in-flight guard (`already_running`); the other two run unconditionally.
   `score-all` is capped at 100 leads/call. Tracked since Run 11.
2. **`form-audit.json` cleanup** — 16 search-input fields lack `.form-input`
   class. Cosmetic. Tracked since Run 13.
3. **Pre-token-attach 401 noise** — three endpoints
   (`/api/properties/import-progress`, `/api/notifications/unread-count`,
   `/api/crm/tenant-settings`) fire before axios auth interceptor on every
   fresh page load. Console-only noise. Tracked since Run 16. Fixable by
   setting `axios.defaults.headers.common['Authorization']` synchronously
   from `localStorage` on app boot.
4. **Reports chart label overlap** at ~930 px viewport width — "Conversion
   By Source" title wraps awkwardly into the CSV badge. Cosmetic.
5. **404 response shape** — Express HTML 404 for method-not-allowed (e.g.
   `PATCH /api/crm/tenant-settings`) vs JSON elsewhere. Cosmetic.
6. **Currency-format anti-pattern sweep** — Run 14 fixed two; LeadDetail
   Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView
   totals still un-audited.
7. **`DELETE /api/documents/:id` shape** — returns 200 `{ deleted: false }`
   for missing rows; sibling DELETEs return 404 `{ error }`. Cosmetic.
   Tracked since Run 20.
8. **`GET /api/skip-trace/job/:jobId` returns 503** when `TRACERFY_API_KEY`
   unset — intentional graceful-degrade, not a bug. Working as coded since
   Run 14.
9. **Hearth webhook permissive on missing fields** — `POST /api/webhooks/hearth`
   with empty body returns 200 `{status:"ignored",reason:"no application_id"}`
   instead of 400. Suggests `handleWebhook` may not strictly verify
   signature when body fields are missing. Worth a future security audit;
   out of scope this run. Tracked since Run 21.
10. **Admin super-panel** — requires global `super_admin` role to fully
    exercise; not testable from a tenant account.
11. **Email-send endpoints** — `/crm/test-email`, `/invoices/:id/send-email`
    need SMTP configuration for live delivery testing.
12. **Webhook signature paths** — `/webhooks/tracerfy`, `/webhooks/hearth`,
    `/payments/webhook` empty-body paths covered (Runs 21 + 22);
    valid-signature delivery paths still need real signing keys.
13. **File upload paths** — `POST /documents/upload` no-file path covered
    (Run 22); success path with a real binary fixture still untested.
    `POST /properties/import-csv` empty-rows path covered; success path
    intentionally skipped per "no bulk DB writes" constraint.
14. **`subcontractors.js.bak` cleanup** *(new this run as a carry-over —
    investigated and dismissed)* — tracked backup file with 8 dead routes
    (not imported, not callable). Inflates raw `router.(get|post|...)` grep
    to 280 (vs. 272 active). Easy `git rm`; deferred per "don't refactor
    working code" task constraint.
15. **CSV export download** — verified by 200 status only, not by binary
    content-type and download triggering.
16. **QuickBooks, Twilio, Stripe integrations** — not implemented
    (pre-existing, not regressions).

## Test Coverage Gaps

- **Browser-interactive write flows** absent since Run 6 — drag a kanban
  card, create a lead end-to-end, record an invoice payment, toggle a
  work-order milestone, upload a document. Biggest remaining gap (**17
  runs**).
- **Mobile responsive sweep** at 375 px and 768 px — none performed since
  Run 6.
- **Frontend full-route walk** — last full 12-route walk was Run 22
  (1 day ago); last full walk including settings tabs was Run 18
  (6 days ago). s2 max_turns this run captured only `/storm-map`.
- **Multipart upload SUCCESS path** — `POST /documents/upload` with a real
  PNG/PDF and `POST /properties/import-csv` with a real row would need a
  small `qa-fixtures/` directory and FormData support in the harness
  `call()`. (`qa-fixtures/` does not yet exist.)
- **Stripe / Tracerfy live-call paths** — would require sandbox accounts
  and signing keys.
- **Onboarding `create-tenant`** — destructive (one-time per tenant), not
  safe to add to the regression harness.
- **Heavy-job body guards** — `POST /drift/correct-all`,
  `POST /properties/trigger-import`, `POST /crm/leads/score-all` accept
  empty bodies and fire work. Each is auth-only and tenant-scoped (limited
  blast radius), but a `?confirm=true` body sentinel would prevent
  accidental fires.
- **Pages not walked Run 23** — every UI page except `/storm-map`.

## Session Integrity

| Stage | Outcome | Turns | Output tokens | Cost (USD) | Commits | Artifacts |
|---|---|---:|---:|---:|---|---|
| s1 api-test | **completed** | 44 | 16 438 | 2.20 | 0 | `/tmp/api-test-results.txt` (35 KB), `qa-api-test-results.json` re-written, resume file updated |
| s2 frontend-test | error_max_turns | 81 | 19 013 | 4.51 | 0 | `qa-run24-storm-map.png` (526 KB; mislabeled — Run 23) |
| s3 ui-audit | error_max_turns | 61 | 15 637 | 3.29 | 0 | `/tmp/ui-audit-results.txt` (12 lines, Dashboard only; mislabeled "Run 24") |
| s4 verify | error_max_turns | 41 | 8 829 | 2.08 | 0 | none |
| s5 report | 0 bytes | 0 | 0 | 0.00 | 0 | none (this report written in a follow-up session — **15th consecutive 0-byte s5** since Run 8) |
| **Total** | | | **59 917** | **~12.08** | **0** | |

- **s1 fully completed for the 5th consecutive run** (Runs 19–23). Lowest
  s1 cost since Run 21 ($2.20 vs Run 22 $3.02) — no harness expansion
  needed this run, so s1 simply re-ran the existing 265-call harness and
  reported clean.
- **s2 / s3 / s4 all hit max_turns** for the 4th consecutive run. s2's
  output dropped sharply vs. Run 22 (1 screenshot vs. 12); the s2 plan
  appears to have spent more turns on inventory/discovery before
  screenshotting this run.
- **s5 has been 0 bytes for 15 consecutive runs** (since Run 8) — fold
  into s4 with a longer turn budget, or drop entirely.
- **s2 / s3 numbering mismatch**: both stages labeled themselves "Run 24"
  in their output. The authoritative source (s1 + resume file) calls this
  Run 23. Worth investigating whether the orchestrator is passing run
  numbers inconsistently across stages.
- **Nine consecutive runs** now where every fix landed as a real commit on
  HEAD before the report was written (or, in this run's case, where there
  was nothing to fix and HEAD was already at the pre-overnight checkpoint).

## Final build check

`cd /c/Projects/stormleads/client && npx vite build` — not re-run this run
because no source changes were made between Run 22 (last green build,
7.79 s) and Run 23. The build artifact tree under `client/dist/` is
unchanged.

## Files in this report

- `OVERNIGHT-REPORT.md` (this file — overwritten from Run 22)
- `docs/overnight-history.md` (appended with Run 23 entry)
- `qa-api-test-results.json` (~95 KB, 265 endpoints, full per-endpoint
  payload previews — re-written by s1, identical content shape to Run 22)
- `qa-token.txt` (re-written by s1 with fresh access token)
- `qa-run24-storm-map.png` (526 KB; mislabeled — actual Run 23)
- `claude-overnight-20260510-s{1..5}-*.json` — per-stage orchestrator
  metadata (s5 is 0 bytes)

## Diffs against pre-run state

```
git diff overnight-checkpoint-20260510..HEAD --stat
(empty — zero source-code commits this run)
```

The Run 23 report commit (this report only, plus history append, plus the
untracked artifacts) will follow as the lone commit:

```
(docs: QA report 2026-05-10)              ← this commit (forthcoming)
c07170b checkpoint: pre-overnight-run 2026-05-10   ← pre-run baseline (= HEAD pre-report)
fcae3a7 docs: QA report 2026-05-09 (Run 22) — 0 fixes, harness +12 to 265/272
7169023 test(api): expand QA harness +12 to 265/272 (Run 22)
```
