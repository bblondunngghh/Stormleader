# Financing Feature — Design Spec

## Overview

Enable roofing contractors to offer third-party financing to homeowners directly from estimates in StormLeads. Contractors connect their own lender account(s), select which financing plans to present on each estimate, and customers apply through a guided handoff to the lender's portal. Application status flows back into StormLeads via webhooks.

**Primary lender:** Hearth (contractor-focused, modern REST API)
**Integration pattern:** Lender-agnostic adapter — Hearth is the first implementation, but the schema and service layer support adding other lenders later.
**Integration depth:** Guided handoff — StormLeads generates a pre-filled application link; the lender handles the application, underwriting, and compliance.

---

## Data Model

### New Tables

#### `financing_lenders`

Stores each tenant's connected lender account(s).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid v7 | PK |
| `tenant_id` | uuid | FK → tenants, NOT NULL |
| `provider` | text | enum: `hearth` (extensible) |
| `api_key_encrypted` | bytea | Encrypted at rest |
| `merchant_id` | text | Lender's merchant/dealer ID |
| `is_active` | boolean | Default true |
| `config` | jsonb | Lender-specific settings |
| `created_at` | timestamptz | Default now() |
| `updated_at` | timestamptz | Trigger-maintained |

Unique constraint: `(tenant_id, provider)` — one connection per lender per tenant.

#### `financing_plans`

Available financing plans pulled from the lender.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid v7 | PK |
| `tenant_id` | uuid | FK → tenants, NOT NULL |
| `lender_id` | uuid | FK → financing_lenders, NOT NULL |
| `external_plan_id` | text | Lender's plan identifier |
| `name` | text | e.g. "12mo 0% APR" |
| `term_months` | integer | Loan term in months |
| `apr` | numeric(5,2) | Annual percentage rate |
| `dealer_fee_pct` | numeric(5,2) | Fee charged to contractor |
| `min_amount` | integer | Minimum loan amount (cents) |
| `max_amount` | integer | Maximum loan amount (cents) |
| `is_active` | boolean | Contractor toggle |
| `is_default` | boolean | Pre-selected on new estimates |
| `created_at` | timestamptz | Default now() |
| `updated_at` | timestamptz | Trigger-maintained |

#### `financing_applications`

Tracks each customer's financing journey.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid v7 | PK |
| `tenant_id` | uuid | FK → tenants, NOT NULL |
| `estimate_id` | uuid | FK → estimates, NOT NULL |
| `lead_id` | uuid | FK → leads, NOT NULL |
| `lender_id` | uuid | FK → financing_lenders, NOT NULL |
| `plan_id` | uuid | FK → financing_plans, ON DELETE RESTRICT |
| `external_application_id` | text | Lender's application ID |
| `status` | text | enum: `pending`, `redirected`, `applied`, `approved`, `funded`, `declined`, `expired` |
| `amount` | integer | Requested amount (cents) |
| `approved_amount` | integer | Lender-approved amount (cents), nullable |
| `monthly_payment` | integer | Approved monthly payment (cents), nullable |
| `redirect_url` | text | Generated application URL |
| `customer_name` | text | Snapshot from estimate |
| `customer_email` | text | Snapshot from estimate |
| `applied_at` | timestamptz | When customer submitted application |
| `decided_at` | timestamptz | When lender made a decision |
| `funded_at` | timestamptz | When loan was funded |
| `created_at` | timestamptz | Default now() |
| `updated_at` | timestamptz | Trigger-maintained |

### Modifications to Existing Tables

#### `estimates`

Add columns:
- `financing_enabled` — boolean, default false
- `financing_plan_ids` — jsonb array of selected financing_plans IDs to offer on this estimate. Note: no FK constraint since JSONB arrays can't enforce referential integrity. The public plans endpoint filters for currently active plans at render time, gracefully ignoring stale IDs.

---

## API Routes

All under `/api/crm/financing/`, tenant-scoped.

### Lender Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/lenders` | List tenant's connected lenders |
| `POST` | `/lenders` | Connect a new lender (validate credentials against Hearth API) |
| `PATCH` | `/lenders/:id` | Update lender config, toggle active |
| `DELETE` | `/lenders/:id` | Deactivate lender (sets `is_active = false`, no row deletion) |

### Plan Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/plans` | List tenant's financing plans (optionally filter by lender) |
| `POST` | `/plans/sync` | Upsert plans from lender API (match on `external_plan_id`, never delete existing plans) |
| `PATCH` | `/plans/:id` | Toggle is_active, is_default |

### Applications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/applications` | List applications (filter by lead, estimate, status) |
| `GET` | `/applications/:id` | Get application detail |
| `POST` | `/applications` | Create application + generate redirect URL via Hearth API |

### Public (no auth, token-based)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/public/:estimateToken/plans` | Get financing plans for a public estimate |
| `GET` | `/public/:estimateToken/applications` | Get financing application status for polling after redirect |
| `POST` | `/public/:estimateToken/apply` | Create application and get redirect URL. Returns existing application if one already exists for this estimate+plan (prevents duplicate lender applications). |

### Webhook (mounted separately — NOT under CRM auth middleware)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks/hearth` | Receive application status updates from Hearth |

**Important:** This route must be mounted in `server/routes/index.js` as a standalone router at `/api/webhooks/hearth`, NOT under the `/api/crm/` router. The CRM router applies `authenticate` and `tenantScope` middleware globally — Hearth webhook calls arrive with no JWT and would receive 401. Additionally, `app.js` must exempt this path from `express.json()` so the raw body is available for signature verification (same pattern as the existing Stripe webhook exemption).

---

## Hearth Adapter

Service layer abstraction so lender-specific logic is isolated.

```
server/services/financing/
  index.js            — Public API (connectLender, syncPlans, createApplication, handleWebhook)
  adapters/
    hearth.js         — Hearth API client (validate creds, fetch plans, generate app link, parse webhook)
    base.js           — Adapter interface definition
```

Each adapter implements:
- `validateCredentials(apiKey, merchantId)` → boolean
- `fetchPlans(apiKey, merchantId)` → plan[]
- `createApplicationLink(apiKey, merchantId, { amount, customerName, customerEmail, planId, callbackUrl })` → { externalId, redirectUrl }
- `parseWebhook(payload, signature)` → { externalApplicationId, status, approvedAmount, monthlyPayment }

Adding a new lender = writing a new adapter file. No changes to routes, database, or frontend.

---

## Frontend Touchpoints

### 1. Settings — Financing Tab

Location: `SettingsView.jsx`, new tab.

- **Connect Hearth** — Form: API key + merchant ID. Submit validates via API, shows success/error. Green/red connection status indicator.
- **Plan list** — Table of plans fetched from Hearth. Columns: name, term, APR, dealer fee %, min/max amount. Toggle switches for active and default.
- **Sync button** — Refresh plans from Hearth if they change.

### 2. Estimate Builder — Financing Section

Location: `EstimatesView.jsx`, below line items/totals.

- **Financing toggle** — Only visible when tenant has a connected lender. Toggle: "Include financing options."
- **Plan selector** — When toggled on, checkboxes for each active plan. Defaults pre-checked.
- **Live preview** — Estimate preview shows "Financing Available" section with monthly payment for each selected plan. Calculation: standard amortization formula client-side.

Monthly payment formula:
```
M = P * [r(1+r)^n] / [(1+r)^n - 1]

P = principal (estimate total)
r = monthly rate (APR / 12 / 100)
n = term in months

Special case: 0% APR → M = P / n
```

### 3. Public Estimate — Customer View

Location: `PublicEstimate.jsx`.

- **"As low as" callout** — Beneath the total price, show lowest monthly payment from offered plans.
- **Financing Options card** — Each plan displayed with term, APR, monthly payment, and "Apply for Financing" button.
- **Apply flow:**
  1. Customer clicks "Apply for Financing" on a plan
  2. POST to `/api/crm/financing/public/:token/apply` with plan ID
  3. Backend creates `financing_applications` record (status: `redirected`), calls Hearth API for pre-filled application link
  4. Customer redirected to Hearth portal
  5. Hearth callback URL returns customer to public estimate page with `?financing=applied` query param. Callback URL pattern: `${APP_URL}/estimates/public/${token}?financing=applied`
  6. On mount, if `?financing=applied` is present, page polls `GET /api/crm/financing/public/:token/applications` every 3 seconds (max 30 seconds) for updated status, showing a loading indicator. Falls back to "Application submitted — we'll notify you" if webhook hasn't arrived yet.
- **Status display** — After applying: "Application submitted" / "Approved — $X/mo" / "Not approved"
- **Pay in full preserved** — Card/ACH payment option remains alongside financing.

### 4. Pipeline — Financing Badge

Location: `Pipeline.jsx`, lead cards.

- Small dollar-sign icon with color:
  - Yellow: `pending` / `redirected` / `applied`
  - Green: `approved` / `funded`
  - Red: `declined`
- Only shown on leads with a financing application.

### 5. Lead Detail — Financing Section

Location: `LeadDetail.jsx`.

- **Collapsible "Financing" section** showing:
  - Status with colored badge
  - Timeline: applied → approved → funded (with dates)
  - Plan details: lender, term, APR, approved amount, monthly payment
  - Link to associated estimate
- **Activity timeline integration** — Webhook-triggered events appear as activities: "Customer applied for financing," "Financing approved — $462/mo for 36 months," "Loan funded."

---

## Webhook Handling

Hearth sends POST requests to `/api/webhooks/hearth`.

Processing:
1. Verify webhook signature using Hearth's signing secret (stored in lender config)
2. Look up `financing_applications` by `external_application_id`
3. Read current status — if it matches the incoming status, return 200 (idempotency guard)
4. Update application status, approved_amount, monthly_payment, timestamps
5. Create activity record on the associated lead (only if status actually changed)
6. Return 200

Status mapping (Hearth → StormLeads):
- `submitted` → `applied`
- `approved` → `approved`
- `funded` → `funded`
- `declined` → `declined`
- `expired` → `expired`

---

## Security

- **API key encryption** — Lender API keys encrypted at rest using AES-256-GCM via `crypto.createCipheriv`. A random 16-byte IV is generated per encryption. The stored `bytea` value is formatted as `[16-byte IV][16-byte auth tag][ciphertext]`. The encryption key is a 32-byte hex string from the `ENCRYPTION_KEY` environment variable. Decrypted only when making API calls.
- **Webhook verification** — Hearth webhook signatures verified before processing.
- **Tenant isolation** — All queries scoped to `tenant_id` via existing `tenantScope` middleware.
- **Public endpoints** — Token-based access only (same pattern as existing public estimate endpoints). No PII exposed beyond what Hearth needs for the application link.
- **No credit data stored** — StormLeads never sees or stores credit scores, SSNs, or financial details. That stays with Hearth.

---

## Migration

Single migration file: `030_financing.sql`

Creates:
- `financing_lenders` table with unique constraint and updated_at trigger
- `financing_plans` table with FK to financing_lenders and updated_at trigger
- `financing_applications` table with FKs and updated_at trigger
- Status enum check constraints
- Adds `financing_enabled` and `financing_plan_ids` columns to `estimates`
- Unique constraint on `financing_applications(estimate_id, plan_id)` — prevents duplicate applications
- Unique constraint on `financing_plans(lender_id, external_plan_id)` — enables upsert on sync
- Indexes on `tenant_id`, `estimate_id`, `lead_id`, `external_application_id`

---

## Out of Scope (v1)

- In-house financing / StormLeads as lender
- Multiple simultaneous lender connections per tenant (schema supports it, UI shows one for v1)
- Financing analytics/reports on dashboard
- Automated follow-up when financing is declined
- Partial financing (finance portion, pay rest upfront)
- Additional lender adapters beyond Hearth
