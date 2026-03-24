# Navigation Consolidation + New Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the sidebar into grouped navigation and add Contracts, Expenses, Work Order Milestones, and Client Progress Page features.

**Architecture:** Backend follows existing Express + PostgreSQL pattern (authenticate/tenantScope middleware, pool.query, service layer). Frontend follows existing React + Vite pattern (lazy-loaded components, axios API client, glass morphism CSS). Public routes use token-based access before auth middleware.

**Tech Stack:** React 18, Express, PostgreSQL (UUID PKs), Vite, Axios, oklch CSS

**Spec:** `docs/superpowers/specs/2026-03-23-nav-consolidation-new-features-design.md`

---

## Task 1: Sidebar Restructure

**Files:**
- Modify: `client/src/components/Sidebar.jsx`
- Modify: `client/src/index.css` (sidebar nav group styles)

### Implementation Notes
- Current sidebar: 13 flat `navItems` + settings + admin at bottom
- New structure: 4 top-level items, 3 collapsible groups, settings/admin at bottom
- Groups store expand/collapse state in localStorage key `sidebar-groups`
- When `activeView` matches a child in a group, that group auto-expands
- Collapsed sidebar (icon-only mode) hides groups entirely — shows only top-level icons
- New nav items (`contracts`, `expenses`) added to groups but their routes/components come in later tasks — clicking them will navigate but the components are stubs until built

- [ ] **Step 1: Replace navItems with grouped structure**

Replace the flat `navItems` array and nav rendering in `client/src/components/Sidebar.jsx` with:

```jsx
import { useState, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

// Top-level items (always visible, no grouping)
const topItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: ChartBarSquareIcon },
  { id: 'storm-map', label: 'Storm Map', Icon: CloudIcon },
  { id: 'pipeline', label: 'Pipeline', Icon: UserCircleIcon },
  { id: 'leads', label: 'Leads', Icon: HomeModernIcon },
];

// Collapsible groups
const navGroups = [
  {
    id: 'jobs',
    label: 'Jobs',
    children: [
      { id: 'estimates', label: 'Estimates', Icon: DocumentTextIcon },
      { id: 'contracts', label: 'Contracts', Icon: DocumentTextIcon },
      { id: 'work-orders', label: 'Work Orders', Icon: WrenchScrewdriverIcon },
      { id: 'materials', label: 'Materials', Icon: WrenchIcon },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    children: [
      { id: 'invoices', label: 'Invoices', Icon: BanknotesIcon },
      { id: 'expenses', label: 'Expenses', Icon: BanknotesIcon },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    children: [
      { id: 'tasks', label: 'Tasks', Icon: ClipboardDocumentCheckIcon },
      { id: 'calendar', label: 'Calendar', Icon: CalendarDaysIcon },
      { id: 'canvassing', label: 'Canvassing', Icon: MapPinIcon },
      { id: 'reports', label: 'Reports', Icon: PresentationChartBarIcon },
    ],
  },
];
```

Add `ChevronDownIcon` to the heroicons import. Add `contracts` and `expenses` icons — reuse `DocumentTextIcon` for contracts, `BanknotesIcon` for expenses (differentiated by label). Remove `SparklesIcon` / AI Studio entry.

- [ ] **Step 2: Add group expand/collapse state with localStorage persistence**

Inside the `Sidebar` component, add:

```jsx
// Load saved group state from localStorage, auto-expand groups with active child
const getInitialGroups = () => {
  const saved = localStorage.getItem('sidebar-groups');
  const parsed = saved ? JSON.parse(saved) : {};
  // Auto-expand group containing active view
  for (const group of navGroups) {
    if (group.children.some(c => c.id === activeView)) {
      parsed[group.id] = true;
    }
  }
  return parsed;
};

const [expandedGroups, setExpandedGroups] = useState(getInitialGroups);

// Persist to localStorage on change
useEffect(() => {
  localStorage.setItem('sidebar-groups', JSON.stringify(expandedGroups));
}, [expandedGroups]);

// Auto-expand when activeView changes to a grouped child
useEffect(() => {
  for (const group of navGroups) {
    if (group.children.some(c => c.id === activeView)) {
      setExpandedGroups(prev => ({ ...prev, [group.id]: true }));
    }
  }
}, [activeView]);

const toggleGroup = (groupId) => {
  setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
};
```

- [ ] **Step 3: Render the new nav structure in JSX**

Replace the `<nav>` section with:

```jsx
<nav>
  {/* Top-level items */}
  {topItems.map((item) => (
    <button
      key={item.id}
      className={`nav-link${activeView === item.id ? ' is-active' : ''}`}
      onClick={() => onNavigate(item.id)}
      title={collapsed ? item.label : undefined}
    >
      <item.Icon width={20} height={20} className="nav-link__icon" />
      {!collapsed && item.label}
    </button>
  ))}

  {/* Collapsible groups */}
  {!collapsed && navGroups.map((group) => (
    <div key={group.id} className="nav-group">
      <button
        className="nav-group__header"
        onClick={() => toggleGroup(group.id)}
      >
        <span className="nav-group__label">{group.label}</span>
        <ChevronDownIcon
          width={14}
          height={14}
          className={`nav-group__chevron${expandedGroups[group.id] ? ' is-open' : ''}`}
        />
      </button>
      {expandedGroups[group.id] && (
        <div className="nav-group__children">
          {group.children.map((item) => (
            <button
              key={item.id}
              className={`nav-link nav-link--child${activeView === item.id ? ' is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <item.Icon width={16} height={16} className="nav-link__icon" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  ))}

  {/* When collapsed, show group children as flat icons */}
  {collapsed && navGroups.flatMap(g => g.children).map((item) => (
    <button
      key={item.id}
      className={`nav-link${activeView === item.id ? ' is-active' : ''}`}
      onClick={() => onNavigate(item.id)}
      title={item.label}
    >
      <item.Icon width={20} height={20} className="nav-link__icon" />
    </button>
  ))}
</nav>
```

- [ ] **Step 4: Add CSS for nav groups**

Add to `client/src/index.css` after the existing `.nav-link` styles:

```css
/* Nav groups */
.nav-group {
  margin-top: var(--space-sm);
}

.nav-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-xs) var(--space-lg);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  cursor: pointer;
}

.nav-group__header:hover {
  color: var(--text-secondary);
}

.nav-group__chevron {
  transition: transform 0.2s var(--ease-out);
  opacity: 0.5;
}

.nav-group__chevron.is-open {
  transform: rotate(180deg);
}

.nav-group__children {
  display: flex;
  flex-direction: column;
}

.nav-link--child {
  padding-left: calc(var(--space-lg) + var(--space-md));
  font-size: 13px;
}
```

- [ ] **Step 5: Add new routes to App.jsx**

Add to `client/src/App.jsx`:

```jsx
// Add lazy imports
const ContractsView = lazy(() => import('./components/ContractsView'));
const ExpensesView = lazy(() => import('./components/ExpensesView'));
const PublicContract = lazy(() => import('./components/PublicContract'));
const ClientStatusPage = lazy(() => import('./components/ClientStatusPage'));

// Add to viewRoutes object
contracts: '/contracts',
expenses: '/expenses',

// Add to routeToView object
'/contracts': 'contracts',
'/expenses': 'expenses',

// Add protected routes
<Route path="/contracts" element={<ContractsView />} />
<Route path="/expenses" element={<ExpensesView />} />

// Add public routes (outside ProtectedRoute)
<Route path="/contract/:token" element={<PublicContract />} />
<Route path="/status/:token" element={<ClientStatusPage />} />
```

- [ ] **Step 6: Create stub components for new pages**

Create minimal placeholder components so navigation doesn't break:

`client/src/components/ContractsView.jsx`:
```jsx
export default function ContractsView() {
  return <div className="main-content"><h2>Contracts</h2><p>Coming soon</p></div>;
}
```

`client/src/components/ExpensesView.jsx`:
```jsx
export default function ExpensesView() {
  return <div className="main-content"><h2>Expenses</h2><p>Coming soon</p></div>;
}
```

`client/src/components/PublicContract.jsx`:
```jsx
export default function PublicContract() {
  return <div><h2>Contract</h2></div>;
}
```

`client/src/components/ClientStatusPage.jsx`:
```jsx
export default function ClientStatusPage() {
  return <div><h2>Job Status</h2></div>;
}
```

- [ ] **Step 7: Verify build passes**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/Sidebar.jsx client/src/App.jsx client/src/index.css \
  client/src/components/ContractsView.jsx client/src/components/ExpensesView.jsx \
  client/src/components/PublicContract.jsx client/src/components/ClientStatusPage.jsx
git commit -m "feat: consolidate sidebar into grouped navigation with collapsible sections"
```

---

## Task 2: Database Migration

**Files:**
- Create: `server/src/db/migrations/037_contracts_expenses_milestones.sql`

- [ ] **Step 1: Write the migration file**

Create `server/src/db/migrations/037_contracts_expenses_milestones.sql`:

```sql
-- 037: Contracts, Expenses, Work Order Milestones, Client Status Tokens

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
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

-- Contract Templates (tenant_id NULL = built-in global template)
CREATE TABLE IF NOT EXISTS contract_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id),
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL,
  content    JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expenses (simple job costing)
CREATE TABLE IF NOT EXISTS expenses (
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
CREATE TABLE IF NOT EXISTS work_order_milestones (
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
CREATE TABLE IF NOT EXISTS client_status_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  token      VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_lead ON contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_token ON contracts(token);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_lead ON expenses(lead_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_wo_milestones_wo ON work_order_milestones(work_order_id);
CREATE INDEX IF NOT EXISTS idx_status_tokens_token ON client_status_tokens(token);

-- Seed built-in contract templates
INSERT INTO contract_templates (tenant_id, name, type, content, is_default) VALUES
(NULL, 'Standard Roofing Contract', 'standard', '{
  "sections": [
    {"title": "Scope of Work", "body": "Contractor agrees to perform the following roofing work at {{address}} for {{customer_name}}:\n\n{{scope_of_work}}"},
    {"title": "Contract Price", "body": "The total contract price for the work described above is ${{total}}."},
    {"title": "Payment Terms", "body": "Payment is due as follows:\n- 50% deposit upon signing\n- 50% upon completion\n\nAccepted payment methods: check, credit card, ACH transfer."},
    {"title": "Warranty", "body": "Contractor provides a 5-year workmanship warranty on all labor performed. Manufacturer warranties on materials apply as specified by the manufacturer."},
    {"title": "Timeline", "body": "Work is estimated to begin on or about {{date}} and be completed within 5-10 business days, weather permitting."},
    {"title": "General Provisions", "body": "Contractor shall obtain all necessary permits. Contractor maintains liability insurance and workers compensation coverage. Any changes to the scope of work must be agreed to in writing by both parties."}
  ]
}', TRUE),
(NULL, 'Insurance Restoration Contract', 'insurance', '{
  "sections": [
    {"title": "Scope of Work", "body": "Contractor agrees to perform storm damage restoration work at {{address}} for {{customer_name}}:\n\n{{scope_of_work}}"},
    {"title": "Insurance Information", "body": "Insurance Company: {{insurance_company}}\nClaim Number: {{claim_number}}\nDate of Loss: {{date_of_loss}}"},
    {"title": "Contract Price", "body": "The contract price is based on the insurance approved scope and pricing.\n\nACV (Actual Cash Value): ${{acv}}\nDeductible: ${{deductible}}\nHomeowner Responsibility: ${{deductible}}\n\nAny supplements approved by the insurance company will be included in the final price."},
    {"title": "Assignment of Benefits", "body": "Homeowner hereby assigns insurance proceeds for the covered repairs to the Contractor. Contractor is authorized to communicate directly with the insurance company regarding the claim."},
    {"title": "Supplement Agreement", "body": "If additional damage is discovered during the repair process, Contractor will document and submit a supplement to the insurance company. Homeowner agrees to sign any supplement approvals required."},
    {"title": "Warranty", "body": "Contractor provides a 5-year workmanship warranty. Manufacturer warranties apply per manufacturer terms."}
  ]
}', TRUE),
(NULL, 'Financing Contract', 'financing', '{
  "sections": [
    {"title": "Scope of Work", "body": "Contractor agrees to perform the following roofing work at {{address}} for {{customer_name}}:\n\n{{scope_of_work}}"},
    {"title": "Contract Price", "body": "The total contract price is ${{total}}."},
    {"title": "Financing Terms", "body": "This contract is financed through {{lender_name}}.\n\nFinanced Amount: ${{financed_amount}}\nMonthly Payment: ${{monthly_payment}}\nTerm: {{term_months}} months\nAPR: {{apr}}%\n\nThe homeowner is responsible for all payments to the lender per the financing agreement."},
    {"title": "Financing Disclosure", "body": "Financing is subject to credit approval. The contractor is not the lender and makes no representations regarding financing terms. All financing terms are between the homeowner and the lender."},
    {"title": "Warranty", "body": "Contractor provides a 5-year workmanship warranty. Manufacturer warranties apply per manufacturer terms."},
    {"title": "Timeline", "body": "Work is estimated to begin on or about {{date}} and be completed within 5-10 business days, weather permitting."}
  ]
}', TRUE),
(NULL, 'Supplement Agreement', 'supplement', '{
  "sections": [
    {"title": "Reference", "body": "This supplement agreement is in addition to the original contract dated {{original_contract_date}} for work at {{address}}."},
    {"title": "Additional Scope", "body": "The following additional work has been identified:\n\n{{additional_scope}}"},
    {"title": "Revised Price", "body": "Original Contract: ${{original_total}}\nSupplement Amount: ${{supplement_amount}}\nRevised Total: ${{revised_total}}"},
    {"title": "Agreement", "body": "Both parties agree to the additional scope and revised pricing described above. All other terms of the original contract remain in effect."}
  ]
}', TRUE);
```

- [ ] **Step 2: Run the migration**

Run: `cd /c/Projects/stormleads/server && node -e "import('dotenv/config').then(() => import('./src/db/pool.js').then(m => { const fs = require('fs'); const sql = fs.readFileSync('./src/db/migrations/037_contracts_expenses_milestones.sql', 'utf8'); m.default.query(sql).then(() => { console.log('Migration complete'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); }); }))"`

Expected: "Migration complete"

- [ ] **Step 3: Verify tables exist**

Run: `cd /c/Projects/stormleads/server && node -e "import('dotenv/config').then(() => import('./src/db/pool.js').then(m => { m.default.query(\"SELECT table_name FROM information_schema.tables WHERE table_name IN ('contracts','contract_templates','expenses','work_order_milestones','client_status_tokens') ORDER BY table_name\").then(r => { console.log(r.rows.map(r => r.table_name)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); }); }))"`

Expected: All 5 tables listed.

- [ ] **Step 4: Verify seed templates**

Run: `cd /c/Projects/stormleads/server && node -e "import('dotenv/config').then(() => import('./src/db/pool.js').then(m => { m.default.query('SELECT name, type FROM contract_templates WHERE is_default = true').then(r => { console.log(r.rows); process.exit(0); }).catch(e => { console.error(e); process.exit(1); }); }))"`

Expected: 4 rows (Standard, Insurance, Financing, Supplement).

- [ ] **Step 5: Commit**

```bash
git add server/src/db/migrations/037_contracts_expenses_milestones.sql
git commit -m "feat: add database tables for contracts, expenses, milestones, status tokens"
```

---

## Task 3: Contracts Backend (Service + Routes)

**Files:**
- Create: `server/src/services/contractService.js`
- Create: `server/src/routes/contracts.js`
- Modify: `server/src/routes/index.js` — mount contracts router

- [ ] **Step 1: Create contractService.js**

Create `server/src/services/contractService.js` with these functions:
- `listContracts(tenantId, { status, leadId, limit, offset })` — SELECT with filters, JOIN leads for contact_name/address
- `getContract(tenantId, id)` — single contract by id
- `getContractByToken(token)` — public lookup by token (no tenant filter), also fetch tenant company name for branding
- `createContract(tenantId, data)` — INSERT, if `estimateId` provided, auto-populate content from estimate + lead
- `updateContract(tenantId, id, data)` — UPDATE draft only (status check)
- `sendContract(tenantId, id)` — generate token (crypto.randomBytes(32).toString('hex')), set status='sent', sent_at=now
- `signContract(token, { signerName, signatureData })` — update signature fields, status='signed', signed_at=now
- `markViewed(token)` — set viewed_at if not already set, status='viewed' if status='sent'
- `voidContract(tenantId, id)` — set status='voided'
- `listTemplates(tenantId)` — WHERE tenant_id IS NULL OR tenant_id = $tenantId
- `createTemplate(tenantId, data)` — INSERT with tenant_id
- `updateTemplate(tenantId, id, data)` — UPDATE (only tenant-owned, not is_default)
- `deleteTemplate(tenantId, id)` — DELETE (only tenant-owned, not is_default)

Follow existing service patterns: use `pool.query()`, parameterized queries, return `{ contracts, total }` for list.

- [ ] **Step 2: Create contracts.js router**

Create `server/src/routes/contracts.js` following the estimates.js pattern:

```javascript
import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as contractService from '../services/contractService.js';

const router = Router();

// PUBLIC routes (before auth middleware)
router.get('/public/:token', async (req, res, next) => {
  // Fetch contract by token, then call markViewed(token) as side effect
});
router.post('/public/:token/sign', async (req, res, next) => { ... });

// Auth middleware
router.use(authenticate);
router.use(tenantScope);

// Authenticated routes
router.get('/', ...);           // list
router.get('/templates', ...);   // list templates (BEFORE /:id to avoid conflict)
router.post('/templates', ...);  // create template
router.patch('/templates/:id', ...); // update template
router.delete('/templates/:id', ...); // delete template
router.get('/:id', ...);        // single contract
router.post('/', ...);          // create
router.patch('/:id', ...);      // update
router.post('/:id/send', ...);  // send
router.post('/:id/void', ...);  // void

export default router;
```

Note: `/templates` routes MUST be before `/:id` to avoid Express treating "templates" as an id.

- [ ] **Step 3: Mount in index.js**

Add to `server/src/routes/index.js`:
```javascript
import contractsRouter from './contracts.js';
router.use('/crm/contracts', contractsRouter);
```

- [ ] **Step 4: Create API client functions**

Create `client/src/api/contracts.js`:
```javascript
import client from './client';

export const getContracts = (params) => client.get('/crm/contracts', { params });
export const getContract = (id) => client.get(`/crm/contracts/${id}`);
export const createContract = (data) => client.post('/crm/contracts', data);
export const updateContract = (id, data) => client.patch(`/crm/contracts/${id}`, data);
export const sendContract = (id) => client.post(`/crm/contracts/${id}/send`);
export const voidContract = (id) => client.post(`/crm/contracts/${id}/void`);
export const getContractTemplates = () => client.get('/crm/contracts/templates');
export const createContractTemplate = (data) => client.post('/crm/contracts/templates', data);
export const updateContractTemplate = (id, data) => client.patch(`/crm/contracts/templates/${id}`, data);
export const deleteContractTemplate = (id) => client.delete(`/crm/contracts/templates/${id}`);

// Public (no auth)
export const getPublicContract = (token) => client.get(`/crm/contracts/public/${token}`);
export const signContract = (token, data) => client.post(`/crm/contracts/public/${token}/sign`, data);
```

- [ ] **Step 5: Verify build and commit**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds.

```bash
git add server/src/services/contractService.js server/src/routes/contracts.js \
  server/src/routes/index.js client/src/api/contracts.js
git commit -m "feat: add contracts backend service, routes, and API client"
```

---

## Task 4: Contracts Frontend (List + Builder)

**Files:**
- Modify: `client/src/components/ContractsView.jsx` — replace stub with full implementation

- [ ] **Step 1: Build ContractsView with list and builder**

Model after `EstimatesView.jsx` structure:
- List view: table with columns (Contract #, Customer, Status, Template, Created, Actions)
- Status filter tabs (All, Draft, Sent, Signed, Voided)
- "Create Contract" button → builder view
- Builder view:
  - Template selector dropdown (fetches from API)
  - Lead/Estimate selector (optional — for auto-populate)
  - Editable sections rendered from template content
  - Merge field resolution from selected lead/estimate
  - Preview panel showing rendered contract
  - Save as Draft / Send buttons

- [ ] **Step 2: Build PublicContract page**

Model after `PublicEstimate.jsx`:
- **IMPORTANT:** Use raw `axios` (not the authenticated `client` instance) for public endpoints, matching how `PublicEstimate.jsx` handles public calls. The auth interceptor will fail on pages with no JWT.
- Fetch contract by token via raw `axios.get('/api/crm/contracts/public/${token}')`
- The `GET /public/:token` handler calls `markViewed(token)` as a side effect after fetching the contract — no separate viewed endpoint needed
- Display contract sections with company branding
- Signature canvas at bottom (reuse existing canvas pattern from PublicEstimate)
- "Sign Contract" button submits signature via raw `axios.post('/api/crm/contracts/public/${token}/sign', data)`
- Success state after signing

- [ ] **Step 3: Add "Create Contract" action to EstimatesView**

In `EstimatesView.jsx`, for estimates with status `accepted`:
- Add a "Create Contract" button in the actions column
- Clicking navigates to `/contracts?fromEstimate={estimateId}`
- ContractsView reads this param and auto-opens the builder with estimate data pre-filled

- [ ] **Step 4: Add contracts tab to LeadDetail**

In `LeadDetail.jsx`:
- Add a "Contracts" tab
- Fetch contracts for the lead via `getContracts({ lead_id: leadId })`
- Display list of contracts with status badges
- "Generate Contract" button opens builder pre-filled with lead data

- [ ] **Step 5: Add Contracts tab to SettingsView**

In `client/src/components/SettingsView.jsx`:
- Add a "Contracts" tab to the existing tabbed settings interface
- Tab contents:
  - List all contract templates (built-in + custom) via `getContractTemplates()`
  - Built-in templates shown as read-only with a "Clone" button
  - Custom templates shown with Edit and Delete buttons
  - "Create Template" button opens a modal/form with: name, type, editable sections
  - Clone action: copies a built-in template as a new custom template (tenant-owned)
- Follow the existing SettingsView tab pattern (tabbed interface with tab state)

- [ ] **Step 6: Verify build and commit**

Run: `cd /c/Projects/stormleads/client && npx vite build`

```bash
git add client/src/components/ContractsView.jsx client/src/components/PublicContract.jsx \
  client/src/components/EstimatesView.jsx client/src/components/LeadDetail.jsx \
  client/src/components/SettingsView.jsx
git commit -m "feat: add contracts list, builder, public signing page, settings tab, and lead detail integration"
```

---

## Task 5: Expenses Backend + Frontend

**Files:**
- Create: `server/src/services/expenseService.js`
- Create: `server/src/routes/expenses.js`
- Modify: `server/src/routes/index.js` — mount expenses router
- Create: `client/src/api/expenses.js`
- Modify: `client/src/components/ExpensesView.jsx` — replace stub

- [ ] **Step 1: Create expenseService.js**

Functions:
- `listExpenses(tenantId, { leadId, category, startDate, endDate, limit, offset })` — SELECT with filters, JOIN leads for address
- `createExpense(tenantId, data)` — INSERT
- `updateExpense(tenantId, id, data)` — UPDATE
- `deleteExpense(tenantId, id)` — DELETE
- `getJobCostSummary(tenantId, leadId)` — returns `{ totalExpenses, estimateTotal, profit, profitPercent }` by joining expenses + estimates for a lead

- [ ] **Step 2: Create expenses.js router**

Standard authenticated CRUD router (all routes behind authenticate + tenantScope):
- `GET /` — list with filters
- `GET /summary/:leadId` — job cost summary for a lead
- `POST /` — create
- `PATCH /:id` — update
- `DELETE /:id` — delete

Mount in index.js: `router.use('/crm/expenses', expensesRouter);`

- [ ] **Step 3: Create API client and build ExpensesView**

`client/src/api/expenses.js`:
```javascript
import client from './client';
export const getExpenses = (params) => client.get('/crm/expenses', { params });
export const getJobCostSummary = (leadId) => client.get(`/crm/expenses/summary/${leadId}`);
export const createExpense = (data) => client.post('/crm/expenses', data);
export const updateExpense = (id, data) => client.patch(`/crm/expenses/${id}`, data);
export const deleteExpense = (id) => client.delete(`/crm/expenses/${id}`);
```

`ExpensesView.jsx`:
- Table with columns: Date, Category, Job (lead address), Amount, Notes, Actions
- Filter bar: category dropdown, date range, lead search
- Summary row at top showing total
- "Add Expense" button → modal with fields: lead (searchable dropdown), category, amount, date, notes
- Edit/delete actions per row

- [ ] **Step 4: Add expenses tab to LeadDetail**

In `LeadDetail.jsx`:
- Add "Expenses" tab
- Show expenses for the lead + profit summary card (Estimate Total − Expenses = Profit)
- Quick "Add Expense" button in the tab

- [ ] **Step 5: Verify build and commit**

```bash
git add server/src/services/expenseService.js server/src/routes/expenses.js \
  server/src/routes/index.js client/src/api/expenses.js \
  client/src/components/ExpensesView.jsx client/src/components/LeadDetail.jsx
git commit -m "feat: add expense tracking with job costing and lead detail integration"
```

---

## Task 6: Work Order Milestones

**Files:**
- Modify: `server/src/services/workOrderService.js` — add milestone functions + auto-create on WO creation
- Modify: `server/src/routes/workOrders.js` — add milestone endpoints
- Modify: `client/src/components/WorkOrdersView.jsx` — milestone checklist UI

- [ ] **Step 1: Add milestone functions to workOrderService.js**

Add to existing service:
```javascript
const DEFAULT_MILESTONES = [
  'Permit Pulled',
  'Materials Delivered',
  'Tear-off',
  'Install',
  'Cleanup',
  'Final Inspection',
  'Complete',
];

export async function createMilestones(workOrderId) {
  for (let i = 0; i < DEFAULT_MILESTONES.length; i++) {
    await pool.query(
      'INSERT INTO work_order_milestones (work_order_id, name, sort_order) VALUES ($1, $2, $3)',
      [workOrderId, DEFAULT_MILESTONES[i], i + 1]
    );
  }
}

export async function getMilestones(workOrderId) { ... }
export async function updateMilestone(workOrderId, milestoneId, { completed, photoUrl }) { ... }
```

Modify the existing `createWorkOrder` function to call `createMilestones(newWorkOrder.id)` after INSERT.

- [ ] **Step 2: Add milestone routes to workOrders.js**

Add to existing router:
```javascript
router.get('/:id/milestones', async (req, res, next) => { ... });
router.patch('/:id/milestones/:milestoneId', async (req, res, next) => { ... });
```

- [ ] **Step 3: Add milestone UI to WorkOrdersView**

In the work order detail/expand view:
- Render milestone checklist: each row has checkbox, name, completed_at date, photo thumbnail
- Progress bar showing "N/7 complete"
- Clicking checkbox calls `PATCH /work-orders/:id/milestones/:mid` with `{ completed: true/false }`
- Camera icon opens file picker, uploads via existing documents API, then patches milestone with photo_url

Add progress indicator to kanban cards: small "3/7" badge.

- [ ] **Step 4: Verify build and commit**

```bash
git add server/src/services/workOrderService.js server/src/routes/workOrders.js \
  client/src/components/WorkOrdersView.jsx
git commit -m "feat: add work order milestones with progress tracking"
```

---

## Task 7: Client Progress Page

**Files:**
- Modify: `server/src/routes/leads.js` — add public status route (before auth) + token generation (after auth)
- Modify: `client/src/components/ClientStatusPage.jsx` — replace stub
- Modify: `client/src/components/LeadDetail.jsx` — add "Share Status Page" button

- [ ] **Step 1: Add status token generation to leads router**

**IMPORTANT:** The leads router is mounted at `/api/leads` (not `/api/crm/leads`). All routes and frontend calls must use this path.

Restructure `server/src/routes/leads.js` to match the estimates.js pattern — public routes first, then auth middleware:

```javascript
// PUBLIC route (before auth middleware)
router.get('/status/public/:token', async (req, res, next) => {
  // Fetch lead stage, contact_name, address, tenant company name
  // Fetch work order milestones if any work orders exist
  // Fetch stage history from activities table (stage_changed events)
  // Return all data for the public page
});

// Auth middleware
router.use(authenticate);
router.use(tenantScope);

// ... all existing authenticated routes ...

// New authenticated route
router.post('/:id/status-token', async (req, res, next) => {
  // INSERT INTO client_status_tokens ON CONFLICT (lead_id) DO UPDATE SET updated_at = NOW()
  // Return { token, url: `/status/${token}` }
});
```

- [ ] **Step 2: Build ClientStatusPage component**

`client/src/components/ClientStatusPage.jsx`:
- **IMPORTANT:** Use raw `axios` (not the authenticated `client` instance) for the public endpoint
- Fetch data from `/api/leads/status/public/:token` (note: `/api/leads/`, NOT `/api/crm/leads/`)
- Display:
  - Company name header
  - Customer name + address
  - Visual timeline: vertical stepper showing stages passed through with dates
  - Current stage highlighted
  - Milestone checklist (if work order exists) with completion status
  - Scheduled dates
- Glass morphism styling matching the app theme
- Mobile responsive

- [ ] **Step 3: Add "Share Status Page" to LeadDetail**

In `LeadDetail.jsx`:
- Add a "Share Status" button (link icon)
- On click: POST to `/api/crm/leads/:id/status-token`
- Display the URL in a copy-to-clipboard popover
- If token already exists, show existing URL

- [ ] **Step 4: Verify build and commit**

```bash
git add server/src/routes/leads.js client/src/components/ClientStatusPage.jsx \
  client/src/components/LeadDetail.jsx
git commit -m "feat: add client progress page with public status URL"
```

---

## Task 8: Final Integration & Visual Review

- [ ] **Step 1: Run full build check**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Clean build, no errors.

- [ ] **Step 2: Visual review of sidebar**

Navigate through all pages in browser. Verify:
- Groups expand/collapse correctly
- Active view auto-expands its group
- Collapsed sidebar shows all items as icons
- localStorage persistence works across page reloads
- New routes (contracts, expenses) navigate correctly

- [ ] **Step 3: Test contracts flow**

- Create a contract from the contracts page
- Send it (generates token)
- Open public URL, verify contract displays
- Sign it, verify status updates

- [ ] **Step 4: Test expenses**

- Add an expense tied to a lead
- Verify it shows in the expenses list and lead detail
- Verify job cost summary calculates correctly

- [ ] **Step 5: Test milestones**

- Create a work order
- Verify 7 milestones auto-created
- Toggle milestones, verify progress bar updates
- Verify completing all milestones updates WO status

- [ ] **Step 6: Test client status page**

- Generate status token from lead detail
- Open public URL
- Verify timeline shows correct stages
- Verify milestones show if work order exists

- [ ] **Step 7: Final commit**

```bash
git commit -m "feat: complete navigation consolidation and new features integration"
```
