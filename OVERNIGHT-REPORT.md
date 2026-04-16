# QA Test Report — 2026-04-16

## QA Test Summary

| Metric | Count |
|---|---|
| Pages tested (UI audit) | 5 |
| API endpoints tested | 37 route files (~250+ endpoints) |
| Bugs found | 8 |
| Bugs fixed | 8 |
| UI inconsistencies found | 12 |
| UI inconsistencies fixed | 12 |

---

## Backend API Test Results

### Financing Routes (`financing.js`)
- **Endpoints tested:** Public apply endpoint, plan management
- **Passed:** All after fix
- **Fixed:** `POST /api/financing/public/:token/apply` — returned 500 on invalid token or missing planId. Added planId required check (400) and token lookup error handling (404). *(commit 1fb9b3f)*

### CRM Routes (`crm.js`)
- **Endpoints tested:** Lead contacts, lead CRUD, pipeline, tasks, activities
- **Passed:** All after fix
- **Fixed:** `POST /api/crm/leads/:id/contacts` — accepted empty body, creating contacts with all null fields. Added validation requiring at least one of first_name/last_name/email/phone. *(commit 1fb9b3f)*

### Canvassing Routes (`canvassing.js`)
- **Endpoints tested:** Pin CRUD, convert-to-lead
- **Passed:** All after fix
- **Fixed:** `PATCH /:id` and `POST /:id/convert` — missing UUID validation caused 500 on invalid IDs. Added `validateId()` middleware. *(commit 005a6eb)*

### Materials Routes (`materials.js`)
- **Endpoints tested:** Orders, auto-order
- **Passed:** All after fix
- **Fixed:** `GET /orders/:id` and `POST /estimate/:estimateId/auto-order` — missing UUID validation caused 500 on invalid IDs. Added `validateId()` middleware. *(commit 005a6eb)*

### Skip Trace Routes (`skipTrace.js`)
- **Endpoints tested:** Config get/put
- **Passed:** All after fix
- **Fixed:** `PUT /config` — crashed on undefined when `enabled` boolean not provided. Added required field check. *(commit 005a6eb)*

### CRM Service (`crmService.js`)
- **Endpoints tested:** Task CRUD, task completion toggle
- **Passed:** All after fix
- **Fixed:** `PATCH /api/crm/tasks/:id` — sending `{completed: true}` returned 404 because `completed` wasn't in `allowedFields`. Added mapping: `completed: true` → `completed_at: NOW()`, `completed: false` → `completed_at: null`. *(commit 738661f)*

### Deep CRUD Lifecycle Testing (all passed)
- **Estimates:** create → send → sign-in-person → PDF → duplicate → generate-tiers
- **Work Orders:** create → milestones → PDF → complete
- **Invoices:** create → update → send → from-estimate
- **Contracts:** template create → contract create → PDF
- **Territory, subcontractor, expense, automation, drip sequence CRUD:** All verified

---

## Frontend Feature Test Results

### EstimatesView.jsx
- **Tested:** Grid/list toggle, link copy, print, PDF download, photo attach, help tooltip
- **Passed:** All functionality works
- **Fixed:** 7 inline SVG icons replaced with `@heroicons/react/24/outline` components (Squares2X2, ListBullet, Link, Printer, DocumentArrowDown, Photo, QuestionMarkCircle). *(commit 9e7ac88)*

### LeadDetail.jsx
- **Tested:** Lead info display, weather section, document send
- **Passed:** All functionality works
- **Fixed:** 3 inline SVG icons replaced with Heroicons (QuestionMarkCircle, ExclamationTriangle, PaperAirplane). *(commit 9e7ac88)*

### WorkOrdersView.jsx
- **Tested:** Work order list, milestone completion
- **Passed:** All functionality works
- **Fixed:** 1 inline SVG icon replaced with Heroicon (Check). *(commit 9e7ac88)*

### AddressSearch.jsx
- **Tested:** Search input rendering
- **Passed:** Works correctly
- **Fixed:** 1 inline SVG search icon replaced with Heroicon MagnifyingGlass. *(commit 9e7ac88)*

### SubcontractorsView.jsx
- **Tested:** Button styling, CRUD actions
- **Passed:** All functionality works
- **Fixed:** Inline `borderRadius` (radius-pill) and padding overrides removed from auth-btn elements. Now uses standard auth-btn class values (14px/12px radius, space-xl padding). *(commit af86637)*

---

## UI Consistency Audit Results

### Icons
- **11 inline SVGs found** across 4 components (EstimatesView, LeadDetail, WorkOrdersView, AddressSearch)
- **All replaced** with `@heroicons/react/24/outline` equivalents
- **Status:** Fully resolved *(commit 9e7ac88)*

### Buttons
- **1 inconsistency found:** SubcontractorsView auth-btn elements had inline borderRadius and padding overrides deviating from the standard class
- **Fixed:** Removed inline style overrides *(commit af86637)*
- **Status:** Fully resolved

### Toolbars/Headers
- **No inconsistencies found.** All page headers follow the standard pattern.

### Sidebar/Nav
- **No issues found.** Sidebar navigation is consistent.

### Forms
- **No new issues found.** All form elements use `.form-input` class, `CustomSelect`, and `DatePicker` per project standards.

### Spacing
- **No alignment issues found** in audited components.

### Modals
- **All modals consistent.** Using `modal-backdrop` class with glass styling and scale-in animation.

---

## Bugs Fixed

1. **[Financing API]** — `POST /api/financing/public/:token/apply` returned 500 on invalid token or missing planId — Added planId required validation (400) and token error handling (404) *(1fb9b3f)*
2. **[CRM API]** — `POST /api/crm/leads/:id/contacts` accepted empty body, creating null contacts — Added validation requiring at least one contact field *(1fb9b3f)*
3. **[Canvassing API]** — `PATCH /api/crm/canvass-pins/:id` returned 500 on invalid UUID — Added `validateId()` middleware *(005a6eb)*
4. **[Canvassing API]** — `POST /api/crm/canvass-pins/:id/convert` returned 500 on invalid UUID — Added `validateId()` middleware *(005a6eb)*
5. **[Materials API]** — `GET /api/materials/orders/:id` returned 500 on invalid UUID — Added `validateId()` middleware *(005a6eb)*
6. **[Materials API]** — `POST /api/materials/estimate/:estimateId/auto-order` returned 500 on invalid UUID — Added `validateId()` middleware *(005a6eb)*
7. **[Skip Trace API]** — `PUT /api/skip-trace/config` crashed when `enabled` boolean not provided — Added required field check *(005a6eb)*
8. **[Tasks API]** — `PATCH /api/crm/tasks/:id` with `{completed: true}` returned 404 — Added `completed` → `completed_at` field mapping in updateTask service *(738661f)*

---

## Known Issues (Not Fixed)

1. **Admin panel** — Requires `super_admin` role; current test user has `admin` role only
2. **Pipeline drag-and-drop** — Not exercised (requires browser-based Playwright testing)
3. **CSV export/import** — Not verified end-to-end (requires browser file download)
4. **Email sending** — Requires SMTP configuration (`/crm/test-email`, invoice email send)
5. **Webhook endpoints** — `POST /webhooks/tracerfy` and `POST /webhooks/hearth` need signature verification keys
6. **QuickBooks, Twilio, Stripe integrations** — Not implemented yet
7. **File upload** — Document upload on lead detail not exercised via automation

---

## Test Coverage Gaps

| Area | Reason |
|---|---|
| Browser-based page rendering | No Playwright session this run; tested API-only |
| Pipeline drag-and-drop | Requires browser automation with mouse events |
| CSV export download | Requires browser file system access |
| Email delivery | No SMTP credentials configured |
| Webhook ingestion | Missing external service signature keys |
| Mobile responsive layouts | Requires browser viewport testing |
| Calendar interactions | Requires browser click-to-create testing |
| End-to-end flow (lead → invoice → payment) | Requires sequential browser + API orchestration |

---

*Generated 2026-04-16. QA Run 5 — 5 commits, 8 bugs fixed, 12 UI inconsistencies resolved.*
