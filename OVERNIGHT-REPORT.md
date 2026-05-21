# Overnight QA Report — 2026-05-21 (QA Run 26)

Branch: `feat/financing` · Pre-run checkpoint: `55552c4` (`pre-overnight-20260521`) · Head: `0a20174` · Commits this run: **1** (test-harness fix only)

This is the **26th overnight QA run** since the harness was formalised. It is an **API-only run** — s1 (api-test) ran to completion and produced the only source-code commit on HEAD; s2 (frontend-test), s3 (ui-audit), and s4 (verify) all hit max_turns without producing commits; s5 (report) was 0 bytes for the 18th consecutive run.

## QA Test Summary

| Metric | Count |
|---|---|
| API endpoints exercised | **265+ GET** + **34 PATCH/PUT empty-body probes** + 36 empty-body POST probes + 27 BAD-UUID probes |
| Final harness tally | **2xx = 101, 4xx = 82, 5xx = 0** |
| Pages walked (frontend) | **0** — s2 hit max_turns at turn 81 before completing the walk |
| UI consistency audit | **inconclusive** — s3 hit max_turns at turn 61, no artifact committed |
| Bugs found (production 5xx) | **0** |
| Bugs fixed (server code) | **0** — nothing to fix |
| Harness defects fixed | **11** (10 wrong param names + 1 wrong path in `qa-api-test.mjs`) |
| UI inconsistencies found | **0** |
| UI inconsistencies fixed | **0** |
| Commits this run | **1** (`0a20174` — harness fix only) |
| Production 5xx after run | **0** (**11th consecutive run**) |
| Intentional 503s | 1 (`GET /api/skip-trace/job/:jobId` when `TRACERFY_API_KEY` unset) |
| Intentional empty-body 200s | 2 (`POST /alerts/test`, `POST /drift/correct-all` — both documented) |

The headline finding is that **11 of the unexpected 400s reported in past runs were harness defects, not server bugs.** The test script was sending `lon=` where the handler wants `lng=`, sending a request to `/dataApis/optimize-route` when the route is actually mounted on `/data`, and omitting required `bbox` / `start` / `end` / `state` / `county` / `zip` params on 6 GETs. After commit `0a20174`, the harness reports cleanly: the positive-GET section is fully 2xx and the negative section is unchanged.

## Backend API Test Results

The harness (`scripts/qa-api-harness.sh` + `qa-api-test.mjs`) was re-run against `http://localhost:3001` after the harness fix. Final tally:

```
2xx: 101  (positive paths)
4xx:  82  (negative paths — BAD-UUID 400s, NOT-FOUND 404s, empty-body 400s)
5xx:   0
```

No production 5xx anywhere across the 265+ GET surface or the 34 PATCH/PUT empty-body probes. Every BAD-UUID probe returns 400. Every empty-body POST returns 400 except two documented intentional exceptions.

### Harness defects fixed this run (commit `0a20174`)

| Endpoint | Defect | Fix |
|---|---|---|
| `GET /map/properties`, `/map/affected-properties`, `/map/swaths` | Missing required `bbox` | Added `?bbox=-100,30,-95,35` |
| `GET /properties` | Missing required `bbox` | Added `?bbox=$BBOX` |
| `GET /properties/reverse-geocode` | Sent `lon=`, handler wants `lng=` | Renamed to `lng=` |
| `GET /crm/calendar` | Missing required `start` and `end` | Added `?start=2026-05-01&end=2026-05-31` |
| `GET /disaster-declarations` | Missing required `state` and `county` | Added `?state=TX&county=Dallas` |
| `GET /storm-history` | Missing required `lat`/`lng` | Added `?lat=32.7&lng=-96.8` |
| `GET /storm-history/heatmap` | Missing required `bbox` | Added `?bbox=$BBOX` |
| `GET /data/fema-housing` | Sent `lat`/`lon`, handler wants `zip=` | Replaced with `?zip=75201` |
| `GET /data/directions` | Sent `fromLon`/`toLon`, handler wants `fromLng`/`toLng` | Renamed |
| `POST /dataApis/optimize-route` | Wrong path (route mounted on `/data`, not `/dataApis`) | Renamed to `/data/optimize-route` |

These are not server bugs — the server was correctly rejecting malformed requests. The harness was misreporting them as application 400s. Past reports that included these endpoints in "unexpected 400" counts overstated the noise level.

### Two endpoints that legitimately accept empty bodies (NOT bugs)

1. **`POST /alerts/test`** — sends a hardcoded test alert email to the tenant's configured address. No params needed by design.
2. **`POST /drift/correct-all`** — carry-over #1 (heavy-work guard). Runs `correctAllPending()` over every pending hail event. Tracked since Run 11 (~15 runs). The server does not crash; the work is gated by auth. Adding a confirmation token is a behavioural change to working code and is deferred per task constraints.

### Coverage by route category (all clean)

Auth, Storms, Properties, CRM core, Leads/Activities/Contacts, Estimates/Invoices/Work-orders, Tasks/Documents/Drip/Custom-fields, Subcontractors/Materials/Expenses/Contracts, Drift/Counties/Parcels, Skip-trace (1 intentional 503), Webhooks (Tracerfy/Hearth/Stripe — Hearth carry-over open), Notifications/Search/Reports, Team/Profile/Tenant settings, Public estimate/Onboarding, Payments (Stripe-touching), Financing (public-token endpoints return `200 []` for invalid tokens by design — JOIN-based filter avoids leaking token existence).

## Frontend Feature Test Results

**Not completed this run.** Session s2 (frontend-test) hit `error_max_turns` at turn 81 ($4.08, ~5.5 min wall time) before producing a route-walk report or committing screenshots. No regression against the working tree — the last full Playwright walk was Run 25 (2026-05-11) which confirmed all 13 implemented routes + 14 `/settings` tabs render cleanly.

Since no source-code commits affected `client/src/**` between Run 25 checkpoint (`e5994c7`) and Run 26 head (`0a20174`), the Run 25 walk remains valid for this report's purposes.

| Route | Last confirmed render | Status this run |
|---|---|---|
| `/` Dashboard | Run 25 (2026-05-11) | not re-tested — no client diff |
| `/storm-map` | Run 25 | not re-tested — no client diff |
| `/pipeline` | Run 25 | not re-tested — no client diff |
| `/leads`, `/leads/:id` | Run 25 | not re-tested — no client diff |
| `/estimates`, `/invoices`, `/work-orders`, `/tasks` | Run 25 | not re-tested |
| `/calendar`, `/reports`, `/canvassing` | Run 25 | not re-tested |
| `/settings` (14 tabs) | Run 25 | not re-tested |
| `/content-studio` | not in `App.jsx` route table | unchanged (carry-over #15) |

**Carry-over #4** ("browser-interactive write flows untested for 14+ runs") is not advanced this run. Sub-gap from Run 25 still open: pages render; submit paths still un-exercised.

## UI Consistency Audit Results

**Not completed this run.** Session s3 (ui-audit) hit `error_max_turns` at turn 61 ($4.17). No audit artifact was committed.

The Run 20 sweep (2026-05-06) is still the latest authoritative audit:
- **37 / 37** source files clean for Heroicons compliance
- **38 / 38** icon imports from `@heroicons/react/24/outline`
- Decorative inline SVGs in `CanvassingMode` legend pin and `StormMap` popup star rating are intentional map markers (not bugs)

Since no source-code commits affected `client/src/**/*.jsx` between Run 20 and Run 26 head, the Run 20 audit remains valid.

| Audit category | Latest authoritative finding | Status this run |
|---|---|---|
| Icons (Heroicons) | 37/37 clean, 38/38 imports (Run 20) | unchanged |
| Buttons (sizing/styling) | Mixed heights intentional (inline filter vs. CTA) (Run 25 spot-inspection) | unchanged |
| Toolbars / Headers | Standard `flex items-end justify-between gap-6 flex-wrap py-1` + `h1 28 px / weight 820` (Run 25) | unchanged |
| Sidebar / Nav | Collapsible Sidebar renders, 13/13 routes navigate (Run 25) | unchanged |
| Forms | 16 search-input fields lack `.form-input` class (Run 13, cosmetic) | unchanged carry-over #3 |
| Spacing | Token-based grid usage, no off-grid offsets (Run 25) | unchanged |
| Modals | LeadDetail slide-over matches existing pattern (Run 25) | unchanged |

**Net UI audit result this run:** inconclusive (s3 max_turns); no regressions detectable from client-side diff (empty between Run 25 and Run 26).

## Bugs Fixed

**None in production code.** The single commit this run (`0a20174`) fixes the QA harness script itself — see "Harness defects fixed this run" above. No server-side files were modified.

## Known Issues (Not Fixed)

All carry-overs unchanged from Run 25 except where noted.

1. **Heavy-work guards** on `POST /drift/correct-all`, `POST /properties/trigger-import`, and `POST /crm/leads/score-all` — accept empty bodies; should require explicit confirmation/role params. Tracked since Run 11.
2. **404 response shape** — Express HTML 404 vs JSON elsewhere for unmatched-method routes. Cosmetic.
3. **`form-audit.json` cleanup** — 16 search-input fields render correctly but do not carry `.form-input` class. Cosmetic.
4. **Browser-interactive write flows** — Run 25 walked all pages but did NOT exercise submit/drag/upload paths; not advanced this run (s2 max_turns before walking).
5. **Mobile sweep at 375 px / 768 px** — still not performed since Run 6 (20 runs ago).
6. **Currency-format anti-pattern sweep** — LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals still un-audited.
7. **Pre-token-attach 401 noise** — confirmed Run 25 as token-expiry-at-boot. Real fix is proactive expiry check in `client/src/api/client.js` request interceptor (~10 lines). Behavioural change, deferred.
8. **Reports chart label overlap** at ~930 px viewport. Cosmetic.
9. **`DELETE /api/documents/:id` shape** — 200 `{deleted:false}` for missing rows vs sibling 404s. Cosmetic.
10. **Hearth webhook permissive-on-missing-fields** — empty-body returns 200 instead of 400. Security audit candidate.
11. **~~Pages not walked Run 24~~** — closed Run 25.
12. **Multipart file-upload success path** — still untested (no `qa-fixtures/` directory).
13. **CSV import success path** — still untested per "no bulk DB writes" constraint.
14. **`subcontractors.js.bak` cleanup** — 8 dead routes in a `.bak` file. Safe `git rm`; deferred.
15. **`/content-studio` orphan reference** — referenced in old docs but never implemented. Catch-all `*` redirects to `/`. Build or scrub.

## Test Coverage Gaps

- **Frontend route walk this run** — s2 max_turns at turn 81; no routes walked this run (relying on Run 25's full walk; client diff is empty).
- **UI consistency audit this run** — s3 max_turns at turn 61; no artifact committed (relying on Run 20's full audit; client diff is empty since then).
- **Verify session** — s4 max_turns at turn 41; no verification commit (acceptable — only fix to verify was harness change, which was visible directly in the harness re-run tally).
- **Admin super-panel** — requires global `super_admin` role; not exercised.
- **Email-send endpoints** (`/crm/test-email`, `/invoices/:id/send-email`) — need SMTP credentials for live delivery testing.
- **Webhook signature paths** — valid-signature delivery paths still need real signing keys.
- **File-upload SUCCESS paths** — see carry-over #12.
- **CSV export download** — verified by 200 status only, not binary content-type or download trigger.
- **Mobile responsive viewports** — see carry-over #5.
- **QuickBooks / Twilio / Stripe live flows** — integrations not fully wired (pre-existing).
- **Form submit write paths** — see carry-over #4.

## Session Integrity

- **s1 api-test:** completed (55 turns, 19 489 output tokens, $2.45). **1 commit produced** (`0a20174`). 7th consecutive fully-completed s1 (Runs 19–26).
- **s2 frontend-test:** `error_max_turns` (81 turns, 13 576 output tokens, $4.08). No commits. Regression vs Run 25's 102-turn completion — s2 appears to have spent more turns on inventory/discovery this run than on Playwright walking.
- **s3 ui-audit:** `error_max_turns` (61 turns, 27 539 output tokens, $4.17). No commits.
- **s4 verify:** `error_max_turns` (41 turns, 7 375 output tokens, $1.82). No verification commit. Acceptable — only fix was a self-evident harness change visible in the immediate re-run tally.
- **s5 report:** 0 bytes — did not run (**18th consecutive 0-byte s5** since Run 8). This report was written in a follow-up session, as has been the established pattern.
- **Total cost across the 4 sessions that produced work:** ~$12.52 (vs. Run 25's ~$12.77).
- **3 / 5 sessions hit max_turns** (s2, s3, s4). Pattern is consistent with the last 6 overnight runs — s5 is non-functional and s2–s4 are turn-budget-constrained.

## Next-Run Priorities

In order of value-to-effort ratio:

1. **Exercise form submit paths** (carry-over #4): kanban drag, Add Lead submit, payment record, milestone toggle, doc upload, settings save. The pages render — exercise the writes.
2. **Mobile sweep at 375 px / 768 px** across all 14 routes (none since Run 6, 20 runs ago).
3. **Pre-auth 401 proactive expiry fix** (carry-over #7): one file (`client/src/api/client.js`), ~10 lines.
4. **`/content-studio` decision** (carry-over #15): build it or scrub doc references.
5. **Heavy-job body guards** (carry-over #1): `trigger-import`, `correct-all`, `score-all`.
6. **Hearth-webhook security audit** (carry-over #10).
7. **`subcontractors.js.bak` cleanup** (carry-over #14) — safe `git rm`.
8. **Drop s5 or fold into s4** — 18 consecutive 0-byte runs is sufficient evidence that the stage is non-functional in its current configuration.
9. **Raise s2 turn budget or split route list** — s2 hit max_turns this run after completing Run 25 in 102 turns. Budget appears to be at the edge.
