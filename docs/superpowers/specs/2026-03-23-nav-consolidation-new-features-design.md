# Navigation Consolidation + New Features

## Overview

Consolidate the sidebar from 14 flat items into grouped navigation, and add 4 new features: Contracts, Expense Tracking, Client Progress Page, and Work Order Milestones.

---

## 1. Sidebar Restructure

### Top-level (always visible)
- Dashboard
- Storm Map
- Pipeline
- Leads

### Collapsible groups (collapsed by default)
- **Jobs** → Estimates, Contracts, Work Orders, Materials
- **Finance** → Invoices, Expenses
- **Operations** → Tasks, Calendar, Canvassing, Reports

### Bottom (always visible)
- Settings
- Admin (super_admin only)

### Behavior
- Click group header to expand/collapse. Chevron icon rotates on expand.
- Collapsed state persisted in `localStorage` so it remembers across sessions.
- When a child route is active, its parent group auto-expands.
- Group headers are not navigable — they only toggle expand/collapse.
- Children are indented with the same L-bracket visual pattern used in the storm map layer panel.
- Materials, Canvassing, Reports, and other existing flat nav items move into their respective groups (removed from the flat list).

---

## 2. Contracts

### Flow
Estimate → customer accepts (or manual trigger) → generate contract → customer signs.

### Contract Generation
- Auto-populate from estimate: customer info (name, email, phone, address), scope of work (line items), total, financing terms if applicable.
- All fields editable before sending.
- Contract stored as JSONB content for flexibility.

### Built-in Templates
1. **Standard Roofing** — scope, payment terms, warranty, start date, completion estimate
2. **Insurance Restoration** — insurance company, claim number, ACV/RCV fields, supplement language, assignment of benefits
3. **Financing** — lender name, payment plan terms, interest rate, monthly payment, financing disclosure
4. **Supplement Agreement** — reference to original contract, additional scope, revised total

### Template Structure
Each template defines sections (array of `{ title, body }` blocks). Body supports merge fields: `{{customer_name}}`, `{{address}}`, `{{scope_of_work}}`, `{{total}}`, `{{date}}`, etc. Merge fields resolve from the linked estimate and lead data.

Built-in templates are seeded via migration with `tenant_id = NULL, is_default = TRUE`. The list endpoint returns templates where `tenant_id IS NULL OR tenant_id = $tenantId`.

### Customer-Facing Page
- Public URL: `/contract/:token`
- Displays contract content, company branding, scope details
- E-signature canvas (reuse existing `SignatureCanvas` from `PublicEstimate.jsx`)
- After signing: signature + timestamp stored, status → `signed`

### Statuses
`draft` → `sent` → `viewed` → `signed` → `voided`

### Access Points
- Contracts page (under Jobs group) — list all contracts with status filter
- Lead detail page — contracts tab showing contracts for that lead, "Generate Contract" button
- Estimate detail — "Create Contract" action after estimate is accepted

### Custom Templates
- Created from Settings > Contracts tab
- Clone a built-in template or start from scratch
- Define sections, merge fields, default terms

### API

**Public routes (declared before authenticate/tenantScope middleware in router):**
- `GET /api/crm/contracts/public/:token` — public view (no auth)
- `POST /api/crm/contracts/public/:token/sign` — submit signature (no auth)

**Authenticated routes:**
- `GET /api/crm/contracts` — list (with status/lead filters)
- `GET /api/crm/contracts/:id` — single contract
- `POST /api/crm/contracts` — create (from estimate or standalone)
- `PATCH /api/crm/contracts/:id` — update draft
- `POST /api/crm/contracts/:id/send` — mark as sent, generate token
- `POST /api/crm/contracts/:id/void` — void a contract
- `GET /api/crm/contract-templates` — list templates
- `POST /api/crm/contract-templates` — create custom template
- `PATCH /api/crm/contract-templates/:id` — update template
- `DELETE /api/crm/contract-templates/:id` — delete custom template

Note: Public routes must be registered before `router.use(authenticate)` call, mirroring the pattern in `estimates.js`.

---

## 3. Expense Tracking

### Purpose
Simple job costing: track expenses per lead/job, show profit/loss.

### Expense Fields
- `lead_id` — which job (optional, can be unassigned)
- `category` — enum: materials, labor, subcontractor, permit, dumpster, other
- `amount` — decimal
- `date` — date of expense
- `notes` — free text
- `created_by` — user who logged it

### Expenses Page (under Finance group)
- Table view with all expenses
- Filters: category, date range, lead/job
- Summary row: total expenses for current filter
- "Add Expense" button opens modal

### Lead Detail Integration
- Expenses tab on lead detail page
- Shows expenses for that lead
- Profit summary card: Estimate Total − Total Expenses = Profit (with percentage)
- Quick "Add Expense" from lead detail

### API
- `GET /api/crm/expenses` — list (with category/lead/date filters)
- `POST /api/crm/expenses` — create
- `PATCH /api/crm/expenses/:id` — update
- `DELETE /api/crm/expenses/:id` — delete

---

## 4. Client Progress Page

### Purpose
Customer-facing status page showing their job progress. Auto-updates as stages and milestones change.

### Public Page
- URL: `/status/:token`
- No login required (token-based, like public estimate)
- Displays:
  - Company name and logo
  - Customer name and property address
  - Current pipeline stage (human-readable label)
  - Visual timeline of stages the job has passed through, with dates
  - Upcoming scheduled dates (from work orders)
  - Milestone checklist (from work order milestones) with completion status
  - Photos from completed milestones (if uploaded)

### Stage-to-Timeline Mapping
Pipeline stages map to customer-friendly labels:
- `new` → "Lead Received"
- `contacted` → "Initial Contact"
- `appt_set` → "Inspection Scheduled"
- `inspected` → "Inspection Complete"
- `estimate_sent` → "Estimate Sent"
- `negotiating` → "In Review"
- `sold` → "Contract Signed"
- `in_production` → "In Production"
- `completed` → "Job Complete"

Stages not in this map (e.g. `lost`, `on_hold`) are excluded from the customer-facing timeline.

### Generation
- From lead detail page: "Share Status Page" button generates a token and displays the URL
- Token is one-per-lead, regenerated only on demand

### API

**Public route (on leads router, before authenticate middleware):**
- `GET /api/crm/leads/status/public/:token` — public status data (lead stage, timeline, milestones, scheduled dates)

**Authenticated route (on leads router):**
- `POST /api/crm/leads/:id/status-token` — generate/get status token

Note: The public status route lives on the leads router (not a separate router) to avoid unnecessary new mount points. It must be declared before `router.use(authenticate)`.

---

## 5. Work Order Milestones

### Fixed Milestones
Every work order gets these milestones in order:
1. Permit Pulled
2. Materials Delivered
3. Tear-off
4. Install
5. Cleanup
6. Final Inspection
7. Complete

### Milestone Fields
- `name` — milestone name
- `sort_order` — position in sequence
- `completed` — boolean
- `completed_at` — timestamp when checked
- `photo_url` — optional photo URL

### Photo Upload
Milestone photos use the existing `POST /api/documents` endpoint with `entity_type = 'milestone'` and `entity_id = milestone UUID`. The returned URL is then stored in the milestone's `photo_url` field via `PATCH /api/crm/work-orders/:id/milestones/:milestoneId`. The documents table already supports arbitrary entity references.

### Behavior
- Milestones auto-created when work order is created (in `workOrderService.createWorkOrder`)
- Check milestone → sets `completed_at` to now
- Uncheck → clears `completed_at`
- Optional photo upload per milestone (camera icon next to checkbox)
- Completing all milestones auto-updates work order status to "completed"
- Milestone completions update the client progress page in real-time

### UI
- Work order detail page shows milestone checklist with progress bar
- Progress bar on work order cards in the kanban view (e.g., "4/7")
- Each milestone row: checkbox, name, completion date (if done), photo thumbnail (if uploaded)

### API
- `GET /api/crm/work-orders/:id/milestones` — list milestones for work order
- `PATCH /api/crm/work-orders/:id/milestones/:milestoneId` — toggle complete, set photo_url

---

## 6. Database Schema

### New Tables

```sql
-- Contracts
CREATE TABLE contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  estimate_id   UUID REFERENCES estimates(id),
  template_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  content       JSONB NOT NULL DEFAULT '{}',
  signer_name   VARCHAR(255),
  signature_data TEXT,
  signed_at     TIMESTAMPTZ,
  token         VARCHAR(64) UNIQUE,
  sent_at       TIMESTAMPTZ,
  viewed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contract Templates (tenant_id NULL = built-in, is_default TRUE = built-in)
CREATE TABLE contract_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id),
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL,
  content    JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  lead_id    UUID REFERENCES leads(id) ON DELETE CASCADE,
  category   VARCHAR(50) NOT NULL,
  amount     NUMERIC(12,2) NOT NULL,
  date       DATE NOT NULL,
  notes      TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work Order Milestones
CREATE TABLE work_order_milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  sort_order    INTEGER NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client Status Tokens
CREATE TABLE client_status_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  token      VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Seed Built-in Contract Templates
```sql
INSERT INTO contract_templates (tenant_id, name, type, content, is_default) VALUES
  (NULL, 'Standard Roofing Contract', 'standard', '{"sections":[...]}', TRUE),
  (NULL, 'Insurance Restoration Contract', 'insurance', '{"sections":[...]}', TRUE),
  (NULL, 'Financing Contract', 'financing', '{"sections":[...]}', TRUE),
  (NULL, 'Supplement Agreement', 'supplement', '{"sections":[...]}', TRUE);
```

### Indexes
```sql
CREATE INDEX idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX idx_contracts_lead ON contracts(lead_id);
CREATE INDEX idx_contracts_token ON contracts(token);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX idx_expenses_lead ON expenses(lead_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_wo_milestones_wo ON work_order_milestones(work_order_id);
CREATE INDEX idx_status_tokens_token ON client_status_tokens(token);
```

---

## 7. File Structure (new files)

### Backend
- `server/src/routes/contracts.js` — public routes before auth, then authenticated CRUD
- `server/src/routes/expenses.js` — authenticated CRUD
- `server/src/services/contractService.js` — contract + template business logic
- `server/src/services/expenseService.js` — expense CRUD + job costing queries
- `server/src/db/migrations/add-contracts-expenses-milestones.sql` — all new tables + indexes + seed data

### Frontend
- `client/src/components/ContractsView.jsx` — list + builder
- `client/src/components/PublicContract.jsx` — customer-facing signing page
- `client/src/components/ExpensesView.jsx` — expense list + add modal
- `client/src/components/ClientStatusPage.jsx` — public progress page
- `client/src/api/contracts.js` — API client functions
- `client/src/api/expenses.js` — API client functions

### Modified Files
- `client/src/components/Sidebar.jsx` — grouped navigation with collapsible sections
- `client/src/App.jsx` — new routes for contracts, expenses, public contract, public status
- `client/src/components/LeadDetail.jsx` — contracts tab, expenses tab, status page link
- `client/src/components/WorkOrdersView.jsx` — milestone checklist UI, progress bar
- `client/src/components/EstimatesView.jsx` — "Create Contract" action on accepted estimates
- `server/src/routes/index.js` — mount contracts and expenses routers
- `server/src/routes/leads.js` — add public status route + status token generation
- `server/src/services/workOrderService.js` — auto-create milestones on work order creation
