# Financing Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable contractors to offer Hearth-powered third-party financing on estimates, with customer-facing apply flow and status tracking across the CRM.

**Architecture:** Lender-agnostic adapter pattern in the service layer (Hearth first). New financing routes under `/api/crm/financing/` for authenticated endpoints, standalone webhook route at `/api/webhooks/hearth`. Frontend changes touch Settings, EstimateBuilder, PublicEstimate, Pipeline, and LeadDetail.

**Tech Stack:** Node/Express, PostgreSQL, AES-256-GCM encryption, React, Hearth REST API

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `server/src/db/migrations/030_financing.sql` | Schema: 3 tables, estimate columns, constraints, indexes |
| `server/src/services/financing/encryption.js` | AES-256-GCM encrypt/decrypt helpers |
| `server/src/services/financing/adapters/base.js` | Adapter interface definition |
| `server/src/services/financing/adapters/hearth.js` | Hearth API client |
| `server/src/services/financing/index.js` | Public financing service API |
| `server/src/routes/financing.js` | Authenticated + public financing routes |
| `server/src/routes/hearthWebhook.js` | Standalone webhook route (no auth) |
| `client/src/utils/financing.js` | Monthly payment calculation helper |

### Modified Files

| File | Change |
|------|--------|
| `server/src/app.js` | Add raw-body exemption for `/api/webhooks/hearth` |
| `server/src/routes/index.js` | Mount financing routes + webhook route |
| `client/src/components/SettingsView.jsx` | Add "Financing" tab |
| `client/src/components/EstimatesView.jsx` | Add financing toggle + plan selector in builder, financing preview |
| `client/src/components/PublicEstimate.jsx` | Add financing options card + apply flow + status polling |
| `client/src/components/Pipeline.jsx` | Add financing status badge on lead cards |
| `client/src/components/LeadDetail.jsx` | Add financing section |
| `server/src/services/estimateService.js` | Add `financing_enabled` and `financing_plan_ids` to create/update queries |

---

## Task 1: Database Migration

**Files:**
- Create: `server/src/db/migrations/030_financing.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Financing Integration (Hearth)

-- financing_lenders: tenant's connected lender accounts
CREATE TABLE IF NOT EXISTS financing_lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('hearth')),
  api_key_encrypted BYTEA,
  merchant_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider)
);

CREATE TRIGGER set_financing_lenders_updated_at
  BEFORE UPDATE ON financing_lenders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_financing_lenders_tenant ON financing_lenders(tenant_id);

-- financing_plans: available plans from lender
CREATE TABLE IF NOT EXISTS financing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES financing_lenders(id) ON DELETE CASCADE,
  external_plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  term_months INTEGER NOT NULL,
  apr NUMERIC(5,2) NOT NULL,
  dealer_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_amount INTEGER NOT NULL DEFAULT 0,
  max_amount INTEGER NOT NULL DEFAULT 50000000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lender_id, external_plan_id)
);

CREATE TRIGGER set_financing_plans_updated_at
  BEFORE UPDATE ON financing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_financing_plans_tenant ON financing_plans(tenant_id);
CREATE INDEX idx_financing_plans_lender ON financing_plans(lender_id);

-- financing_applications: customer financing journey
CREATE TABLE IF NOT EXISTS financing_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES financing_lenders(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES financing_plans(id) ON DELETE RESTRICT,
  external_application_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','redirected','applied','approved','funded','declined','expired')),
  amount INTEGER NOT NULL,
  approved_amount INTEGER,
  monthly_payment INTEGER,
  redirect_url TEXT,
  customer_name TEXT,
  customer_email TEXT,
  applied_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (estimate_id, plan_id)
);

CREATE TRIGGER set_financing_applications_updated_at
  BEFORE UPDATE ON financing_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_financing_apps_tenant ON financing_applications(tenant_id);
CREATE INDEX idx_financing_apps_estimate ON financing_applications(estimate_id);
CREATE INDEX idx_financing_apps_lead ON financing_applications(lead_id);
CREATE INDEX idx_financing_apps_external ON financing_applications(external_application_id);

-- Add financing columns to estimates
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS financing_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financing_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: Run the migration**

Run: `cd /c/Projects/stormleads && node server/src/db/migrate.js`
Expected: Migration 030 applies successfully.

- [ ] **Step 3: Commit**

```bash
git add server/src/db/migrations/030_financing.sql
git commit -m "feat(financing): add database schema for financing lenders, plans, and applications"
```

---

## Task 2: Encryption Helpers

**Files:**
- Create: `server/src/services/financing/encryption.js`

- [ ] **Step 1: Write encryption module**

```javascript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: [IV (16)] [Auth Tag (16)] [Ciphertext]
  return Buffer.concat([iv, tag, encrypted]);
}

export function decrypt(buffer) {
  const key = getKey();
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/financing/encryption.js
git commit -m "feat(financing): add AES-256-GCM encryption helpers for API key storage"
```

---

## Task 3: Hearth Adapter

**Files:**
- Create: `server/src/services/financing/adapters/base.js`
- Create: `server/src/services/financing/adapters/hearth.js`

- [ ] **Step 1: Write the base adapter interface**

```javascript
// Base adapter interface — each lender adapter must implement these methods.
// This file serves as documentation; JavaScript doesn't enforce interfaces.

export const ADAPTER_METHODS = [
  'validateCredentials',  // (apiKey, merchantId) → boolean
  'fetchPlans',           // (apiKey, merchantId) → plan[]
  'createApplicationLink', // (apiKey, merchantId, opts) → { externalId, redirectUrl }
  'parseWebhook',         // (payload, signature, secret) → { externalApplicationId, status, approvedAmount, monthlyPayment }
];
```

- [ ] **Step 2: Write the Hearth adapter**

```javascript
import crypto from 'crypto';

const HEARTH_BASE_URL = process.env.HEARTH_API_URL || 'https://api.gethearth.com/v1';

async function hearthFetch(path, apiKey, options = {}) {
  const res = await fetch(`${HEARTH_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hearth API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function validateCredentials(apiKey, merchantId) {
  try {
    await hearthFetch(`/merchants/${merchantId}`, apiKey);
    return true;
  } catch {
    return false;
  }
}

export async function fetchPlans(apiKey, merchantId) {
  const data = await hearthFetch(`/merchants/${merchantId}/plans`, apiKey);
  return (data.plans || []).map(p => ({
    externalPlanId: p.id,
    name: p.name,
    termMonths: p.term_months,
    apr: p.apr,
    dealerFeePct: p.dealer_fee_percent || 0,
    minAmount: Math.round((p.min_amount || 0) * 100),
    maxAmount: Math.round((p.max_amount || 500000) * 100),
  }));
}

export async function createApplicationLink(apiKey, merchantId, { amount, customerName, customerEmail, planId, callbackUrl }) {
  const data = await hearthFetch(`/merchants/${merchantId}/applications`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      loan_amount: amount / 100,
      borrower: {
        name: customerName,
        email: customerEmail,
      },
      callback_url: callbackUrl,
    }),
  });
  return {
    externalId: data.id,
    redirectUrl: data.application_url,
  };
}

export function parseWebhook(payload, signature, secret) {
  // Verify HMAC signature (length check first — timingSafeEqual throws on mismatched lengths)
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid webhook signature');
  }
  const event = JSON.parse(payload);
  const statusMap = {
    submitted: 'applied',
    approved: 'approved',
    funded: 'funded',
    declined: 'declined',
    expired: 'expired',
  };
  return {
    externalApplicationId: event.application_id,
    status: statusMap[event.status] || event.status,
    approvedAmount: event.approved_amount ? Math.round(event.approved_amount * 100) : null,
    monthlyPayment: event.monthly_payment ? Math.round(event.monthly_payment * 100) : null,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/financing/adapters/
git commit -m "feat(financing): add lender adapter interface and Hearth implementation"
```

---

## Task 4: Financing Service

**Files:**
- Create: `server/src/services/financing/index.js`

- [ ] **Step 1: Write the financing service**

```javascript
import pool from '../../db/pool.js';
import { encrypt, decrypt } from './encryption.js';
import * as hearthAdapter from './adapters/hearth.js';

const adapters = { hearth: hearthAdapter };

function getAdapter(provider) {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unknown financing provider: ${provider}`);
  return adapter;
}

// --- Lender Management ---

export async function getLenders(tenantId) {
  const { rows } = await pool.query(
    'SELECT id, provider, merchant_id, is_active, config, created_at, updated_at FROM financing_lenders WHERE tenant_id = $1 ORDER BY created_at',
    [tenantId]
  );
  return rows;
}

export async function connectLender(tenantId, { provider, apiKey, merchantId, config = {} }) {
  const adapter = getAdapter(provider);
  const valid = await adapter.validateCredentials(apiKey, merchantId);
  if (!valid) throw new Error('Invalid lender credentials');

  const encrypted = encrypt(apiKey);
  const { rows } = await pool.query(
    `INSERT INTO financing_lenders (tenant_id, provider, api_key_encrypted, merchant_id, config)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, provider) DO UPDATE
       SET api_key_encrypted = $3, merchant_id = $4, config = $5, is_active = true
     RETURNING id, provider, merchant_id, is_active, config, created_at, updated_at`,
    [tenantId, provider, encrypted, merchantId, JSON.stringify(config)]
  );
  return rows[0];
}

export async function updateLender(tenantId, lenderId, updates) {
  const fields = [];
  const params = [tenantId, lenderId];
  let idx = 3;

  if (updates.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    params.push(updates.isActive);
  }
  if (updates.config !== undefined) {
    fields.push(`config = $${idx++}`);
    params.push(JSON.stringify(updates.config));
  }
  if (updates.apiKey) {
    fields.push(`api_key_encrypted = $${idx++}`);
    params.push(encrypt(updates.apiKey));
  }
  if (updates.merchantId) {
    fields.push(`merchant_id = $${idx++}`);
    params.push(updates.merchantId);
  }

  if (!fields.length) return null;

  const { rows } = await pool.query(
    `UPDATE financing_lenders SET ${fields.join(', ')}
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, provider, merchant_id, is_active, config, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

export async function deactivateLender(tenantId, lenderId) {
  const { rows } = await pool.query(
    `UPDATE financing_lenders SET is_active = false WHERE tenant_id = $1 AND id = $2 RETURNING id`,
    [tenantId, lenderId]
  );
  return rows[0] || null;
}

// --- Plan Management ---

export async function getPlans(tenantId, { lenderId } = {}) {
  const conditions = ['fp.tenant_id = $1'];
  const params = [tenantId];
  if (lenderId) {
    params.push(lenderId);
    conditions.push(`fp.lender_id = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT fp.*, fl.provider
     FROM financing_plans fp
     JOIN financing_lenders fl ON fl.id = fp.lender_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY fp.term_months, fp.apr`,
    params
  );
  return rows;
}

export async function syncPlans(tenantId, lenderId) {
  const { rows: [lender] } = await pool.query(
    'SELECT * FROM financing_lenders WHERE tenant_id = $1 AND id = $2',
    [tenantId, lenderId]
  );
  if (!lender) throw new Error('Lender not found');

  const adapter = getAdapter(lender.provider);
  const apiKey = decrypt(lender.api_key_encrypted);
  const plans = await adapter.fetchPlans(apiKey, lender.merchant_id);

  const results = [];
  for (const p of plans) {
    const { rows } = await pool.query(
      `INSERT INTO financing_plans (tenant_id, lender_id, external_plan_id, name, term_months, apr, dealer_fee_pct, min_amount, max_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (lender_id, external_plan_id) DO UPDATE
         SET name = $4, term_months = $5, apr = $6, dealer_fee_pct = $7, min_amount = $8, max_amount = $9
       RETURNING *`,
      [tenantId, lenderId, p.externalPlanId, p.name, p.termMonths, p.apr, p.dealerFeePct, p.minAmount, p.maxAmount]
    );
    results.push(rows[0]);
  }
  return results;
}

export async function updatePlan(tenantId, planId, { isActive, isDefault }) {
  const fields = [];
  const params = [tenantId, planId];
  let idx = 3;

  if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); params.push(isActive); }
  if (isDefault !== undefined) { fields.push(`is_default = $${idx++}`); params.push(isDefault); }
  if (!fields.length) return null;

  const { rows } = await pool.query(
    `UPDATE financing_plans SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

// --- Applications ---

export async function getApplications(tenantId, { estimateId, leadId, status } = {}) {
  const conditions = ['fa.tenant_id = $1'];
  const params = [tenantId];
  if (estimateId) { params.push(estimateId); conditions.push(`fa.estimate_id = $${params.length}`); }
  if (leadId) { params.push(leadId); conditions.push(`fa.lead_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`fa.status = $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT fa.*, fp.name as plan_name, fp.term_months, fp.apr, fl.provider
     FROM financing_applications fa
     JOIN financing_plans fp ON fp.id = fa.plan_id
     JOIN financing_lenders fl ON fl.id = fa.lender_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY fa.created_at DESC`,
    params
  );
  return rows;
}

export async function getApplication(tenantId, applicationId) {
  const { rows } = await pool.query(
    `SELECT fa.*, fp.name as plan_name, fp.term_months, fp.apr, fl.provider
     FROM financing_applications fa
     JOIN financing_plans fp ON fp.id = fa.plan_id
     JOIN financing_lenders fl ON fl.id = fa.lender_id
     WHERE fa.tenant_id = $1 AND fa.id = $2`,
    [tenantId, applicationId]
  );
  return rows[0] || null;
}

export async function createApplication(tenantId, { estimateId, leadId, planId, amount, customerName, customerEmail, callbackUrl }) {
  // Check for existing non-terminal application on this estimate+plan
  const { rows: existing } = await pool.query(
    `SELECT * FROM financing_applications
     WHERE tenant_id = $1 AND estimate_id = $2 AND plan_id = $3 AND status NOT IN ('declined', 'expired')`,
    [tenantId, estimateId, planId]
  );
  if (existing.length > 0) return existing[0];

  // Get plan + lender
  const { rows: [plan] } = await pool.query(
    `SELECT fp.*, fl.api_key_encrypted, fl.merchant_id, fl.provider, fl.id as lender_id
     FROM financing_plans fp JOIN financing_lenders fl ON fl.id = fp.lender_id
     WHERE fp.tenant_id = $1 AND fp.id = $2 AND fp.is_active = true AND fl.is_active = true`,
    [tenantId, planId]
  );
  if (!plan) throw new Error('Plan not found or inactive');

  const adapter = getAdapter(plan.provider);
  const apiKey = decrypt(plan.api_key_encrypted);
  const { externalId, redirectUrl } = await adapter.createApplicationLink(
    apiKey, plan.merchant_id,
    { amount, customerName, customerEmail, planId: plan.external_plan_id, callbackUrl }
  );

  const { rows } = await pool.query(
    `INSERT INTO financing_applications
       (tenant_id, estimate_id, lead_id, lender_id, plan_id, external_application_id, status, amount, redirect_url, customer_name, customer_email)
     VALUES ($1, $2, $3, $4, $5, $6, 'redirected', $7, $8, $9, $10)
     RETURNING *`,
    [tenantId, estimateId, leadId, plan.lender_id, planId, externalId, amount, redirectUrl, customerName, customerEmail]
  );
  return rows[0];
}

// --- Webhook ---

export async function handleWebhook(provider, rawBody, signature) {
  // Find the lender config to get the webhook secret
  // Since webhooks don't carry tenant_id, we look up by external_application_id after parsing
  const adapter = getAdapter(provider);

  // Tradeoff: We parse the body before signature verification because we need the application_id
  // to look up the lender's webhook secret. This means an attacker can trigger a DB read with a
  // forged payload, but no mutations occur until after signature verification. This is acceptable
  // because: (1) the lookup is a simple SELECT, (2) no state changes without valid signature,
  // (3) the alternative (global webhook secret) would prevent per-tenant lender isolation.
  const parsed = JSON.parse(rawBody);
  const appId = parsed.application_id;
  if (!appId) return { status: 'ignored', reason: 'no application_id' };

  const { rows: [app] } = await pool.query(
    `SELECT fa.*, fl.config FROM financing_applications fa
     JOIN financing_lenders fl ON fl.id = fa.lender_id
     WHERE fa.external_application_id = $1`,
    [appId]
  );
  if (!app) return { status: 'ignored', reason: 'unknown application' };

  const webhookSecret = app.config?.webhook_secret;
  if (!webhookSecret) throw new Error('No webhook secret configured');

  // Now verify signature
  const event = adapter.parseWebhook(rawBody, signature, webhookSecret);

  // Idempotency: skip if status unchanged
  if (app.status === event.status) return { status: 'skipped', reason: 'duplicate' };

  // Update application
  const timestampField =
    event.status === 'applied' ? 'applied_at' :
    event.status === 'approved' || event.status === 'declined' ? 'decided_at' :
    event.status === 'funded' ? 'funded_at' : null;

  const setClauses = ['status = $2'];
  const params = [app.id, event.status];
  let idx = 3;

  if (event.approvedAmount !== null) { setClauses.push(`approved_amount = $${idx++}`); params.push(event.approvedAmount); }
  if (event.monthlyPayment !== null) { setClauses.push(`monthly_payment = $${idx++}`); params.push(event.monthlyPayment); }
  if (timestampField) { setClauses.push(`${timestampField} = $${idx++}`); params.push(new Date()); }

  await pool.query(
    `UPDATE financing_applications SET ${setClauses.join(', ')} WHERE id = $1`,
    params
  );

  // Create activity on the lead
  const activityMessages = {
    applied: 'Customer applied for financing',
    approved: `Financing approved — $${((event.monthlyPayment || 0) / 100).toFixed(2)}/mo`,
    funded: 'Financing loan funded',
    declined: 'Financing application declined',
    expired: 'Financing application expired',
  };

  await pool.query(
    `INSERT INTO activities (tenant_id, lead_id, type, direction, notes, created_by)
     VALUES ($1, $2, 'financing', 'inbound', $3, NULL)`,
    [app.tenant_id, app.lead_id, activityMessages[event.status] || `Financing status: ${event.status}`]
  );

  return { status: 'processed', newStatus: event.status };
}

// --- Public helpers (for token-based access) ---

export async function getPublicPlans(estimateToken) {
  const { rows } = await pool.query(
    `SELECT fp.id, fp.name, fp.term_months, fp.apr, fp.min_amount, fp.max_amount
     FROM estimates e
     JOIN financing_plans fp ON fp.id = ANY(
       SELECT jsonb_array_elements_text(e.financing_plan_ids)::uuid
     )
     WHERE e.public_token = $1
       AND e.financing_enabled = true
       AND fp.is_active = true
     ORDER BY fp.term_months, fp.apr`,
    [estimateToken]
  );
  return rows;
}

export async function getPublicApplications(estimateToken) {
  const { rows } = await pool.query(
    `SELECT fa.id, fa.status, fa.amount, fa.approved_amount, fa.monthly_payment, fa.plan_id,
            fp.name as plan_name, fp.term_months, fp.apr
     FROM financing_applications fa
     JOIN estimates e ON e.id = fa.estimate_id
     JOIN financing_plans fp ON fp.id = fa.plan_id
     WHERE e.public_token = $1
     ORDER BY fa.created_at DESC`,
    [estimateToken]
  );
  return rows;
}

export async function createPublicApplication(estimateToken, planId) {
  const { rows: [estimate] } = await pool.query(
    'SELECT * FROM estimates WHERE public_token = $1 AND financing_enabled = true',
    [estimateToken]
  );
  if (!estimate) throw new Error('Estimate not found or financing not enabled');

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const callbackUrl = `${appUrl}/estimates/public/${estimateToken}?financing=applied`;

  return createApplication(estimate.tenant_id, {
    estimateId: estimate.id,
    leadId: estimate.lead_id,
    planId,
    amount: estimate.total,
    customerName: estimate.customer_name,
    customerEmail: estimate.customer_email,
    callbackUrl,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/financing/index.js
git commit -m "feat(financing): add financing service with lender, plan, application, and webhook logic"
```

---

## Task 5: API Routes

**Files:**
- Create: `server/src/routes/financing.js`
- Create: `server/src/routes/hearthWebhook.js`
- Modify: `server/src/routes/index.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Write the financing routes**

```javascript
import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as svc from '../services/financing/index.js';

const router = Router();

// --- Public routes (no auth, token-based) ---

router.get('/public/:token/plans', async (req, res, next) => {
  try {
    const plans = await svc.getPublicPlans(req.params.token);
    res.json(plans);
  } catch (err) { next(err); }
});

router.get('/public/:token/applications', async (req, res, next) => {
  try {
    const apps = await svc.getPublicApplications(req.params.token);
    res.json(apps);
  } catch (err) { next(err); }
});

router.post('/public/:token/apply', async (req, res, next) => {
  try {
    const app = await svc.createPublicApplication(req.params.token, req.body.planId);
    res.status(201).json(app);
  } catch (err) { next(err); }
});

// --- Authenticated routes ---

router.use(authenticate);
router.use(tenantScope);

// Lenders
router.get('/lenders', async (req, res, next) => {
  try {
    const lenders = await svc.getLenders(req.tenantId);
    res.json(lenders);
  } catch (err) { next(err); }
});

router.post('/lenders', async (req, res, next) => {
  try {
    const { provider, apiKey, merchantId, config } = req.body;
    if (!provider || !apiKey || !merchantId) return res.status(400).json({ error: 'provider, apiKey, and merchantId are required' });
    const lender = await svc.connectLender(req.tenantId, { provider, apiKey, merchantId, config });
    res.status(201).json(lender);
  } catch (err) {
    if (err.message === 'Invalid lender credentials') return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.patch('/lenders/:id', async (req, res, next) => {
  try {
    const lender = await svc.updateLender(req.tenantId, req.params.id, req.body);
    if (!lender) return res.status(404).json({ error: 'Lender not found' });
    res.json(lender);
  } catch (err) { next(err); }
});

router.delete('/lenders/:id', async (req, res, next) => {
  try {
    const result = await svc.deactivateLender(req.tenantId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Lender not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Plans
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await svc.getPlans(req.tenantId, { lenderId: req.query.lenderId });
    res.json(plans);
  } catch (err) { next(err); }
});

router.post('/plans/sync', async (req, res, next) => {
  try {
    const { lenderId } = req.body;
    if (!lenderId) return res.status(400).json({ error: 'lenderId is required' });
    const plans = await svc.syncPlans(req.tenantId, lenderId);
    res.json(plans);
  } catch (err) { next(err); }
});

router.patch('/plans/:id', async (req, res, next) => {
  try {
    const plan = await svc.updatePlan(req.tenantId, req.params.id, req.body);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) { next(err); }
});

// Applications
router.get('/applications', async (req, res, next) => {
  try {
    const apps = await svc.getApplications(req.tenantId, req.query);
    res.json(apps);
  } catch (err) { next(err); }
});

router.get('/applications/:id', async (req, res, next) => {
  try {
    const app = await svc.getApplication(req.tenantId, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
  } catch (err) { next(err); }
});

router.post('/applications', async (req, res, next) => {
  try {
    const app = await svc.createApplication(req.tenantId, req.body);
    res.status(201).json(app);
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 2: Write the webhook route**

```javascript
import { Router } from 'express';
import { handleWebhook } from '../services/financing/index.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-hearth-signature'] || '';
    const rawBody = req.body.toString('utf8');
    const result = await handleWebhook('hearth', rawBody, signature);
    res.json(result);
  } catch (err) {
    console.error('Hearth webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 3: Mount routes in index.js**

Add to `server/src/routes/index.js`:
```javascript
import financingRouter from './financing.js';
import hearthWebhookRouter from './hearthWebhook.js';

// ... existing mounts ...
router.use('/crm/financing', financingRouter);
router.use('/webhooks/hearth', hearthWebhookRouter);
```

- [ ] **Step 4: Add raw-body exemption in app.js**

Update `server/src/app.js`. **Order matters — both changes go BEFORE `app.use('/api', routes)`:**

First, add the raw body parser for the webhook path (place this BEFORE the JSON body parser):
```javascript
app.use('/api/webhooks/hearth', express.raw({ type: 'application/json' }));
```

Then update the existing JSON body parser exemption to also skip the Hearth webhook:
```javascript
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook' || req.originalUrl === '/api/webhooks/hearth') {
    return next();
  }
  express.json()(req, res, next);
});
```

Both of these must appear before `app.use('/api', routes)` in the middleware chain.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/financing.js server/src/routes/hearthWebhook.js server/src/routes/index.js server/src/app.js
git commit -m "feat(financing): add API routes, webhook handler, and route mounting"
```

---

## Task 6: Monthly Payment Calculator (Client Utility)

**Files:**
- Create: `client/src/utils/financing.js`

- [ ] **Step 1: Write the utility**

```javascript
/**
 * Calculate monthly payment using standard amortization formula.
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 *
 * @param {number} principal - Total amount in cents
 * @param {number} apr - Annual percentage rate (e.g. 6.99)
 * @param {number} termMonths - Loan term in months
 * @returns {number} Monthly payment in cents
 */
export function calcMonthlyPayment(principal, apr, termMonths) {
  if (termMonths <= 0) return 0;
  if (apr === 0) return Math.round(principal / termMonths);

  const r = apr / 100 / 12;
  const n = termMonths;
  const factor = Math.pow(1 + r, n);
  return Math.round(principal * (r * factor) / (factor - 1));
}

/**
 * Format cents as dollar string.
 * @param {number} cents
 * @returns {string} e.g. "$1,250.00"
 */
export function formatMoney(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/utils/financing.js
git commit -m "feat(financing): add client-side monthly payment calculator"
```

---

## Task 7: Settings — Financing Tab

**Files:**
- Modify: `client/src/components/SettingsView.jsx`

- [ ] **Step 1: Add "Financing" to the tabs array**

In the tabs array (near top of component), add:
```javascript
{ id: 'financing', label: 'Financing' }
```

Update the tab validation to include `'financing'` in the allowed list.

- [ ] **Step 2: Write the FinancingTab component**

Add a new `FinancingTab` function component below the existing tab components. It should:

1. State: `lender` (null or object), `plans` (array), `loading`, `form` ({ apiKey, merchantId }), `syncing`
2. On mount: `GET /api/crm/financing/lenders` → if one exists, set `lender` and fetch plans
3. Connect form: API key + merchant ID inputs, "Connect Hearth" button → `POST /api/crm/financing/lenders` with `{ provider: 'hearth', apiKey, merchantId }`
4. After connect: auto-sync plans → `POST /api/crm/financing/plans/sync` with `{ lenderId }`
5. Plan list: table with columns: Name, Term, APR, Dealer Fee, Min, Max, Active toggle, Default toggle
6. Active/Default toggles: `PATCH /api/crm/financing/plans/:id` with `{ isActive }` or `{ isDefault }`
7. Sync button: re-runs `POST /plans/sync`
8. Disconnect button: `DELETE /api/crm/financing/lenders/:id`
9. Connection status: green dot + "Connected" when lender exists and is_active, red dot + "Disconnected" otherwise

Follow existing SettingsView patterns: glass panels, form-group class, flash() for feedback.

- [ ] **Step 3: Add conditional render for the tab**

```jsx
{tab === 'financing' && <FinancingTab />}
```

- [ ] **Step 4: Test manually**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/SettingsView.jsx
git commit -m "feat(financing): add Financing tab to Settings with Hearth connection and plan management"
```

---

## Task 8: Estimate Builder — Financing Section

**Files:**
- Modify: `server/src/services/estimateService.js`
- Modify: `client/src/components/EstimatesView.jsx`

- [ ] **Step 0: Update estimateService.js to persist financing fields**

In `server/src/services/estimateService.js`, update the `createEstimate` and `updateEstimate` functions to include `financing_enabled` (boolean) and `financing_plan_ids` (JSONB array) in their INSERT and UPDATE SQL statements. These fields should be accepted from the request body and persisted alongside existing estimate fields. Follow the existing pattern of adding them to the column list and params array.

- [ ] **Step 1: Add financing state to EstimateBuilder**

In the EstimateBuilder component, add state:
```javascript
const [financingEnabled, setFinancingEnabled] = useState(estimate?.financing_enabled || false);
const [selectedPlanIds, setSelectedPlanIds] = useState(estimate?.financing_plan_ids || []);
const [availablePlans, setAvailablePlans] = useState([]);
const [hasLender, setHasLender] = useState(false);
```

On mount, fetch: `GET /api/crm/financing/lenders` — if any active lender exists, set `hasLender = true` and fetch `GET /api/crm/financing/plans` → set `availablePlans`, pre-check defaults.

- [ ] **Step 2: Add financing toggle + plan selector UI**

Below the totals section in the builder form, add (only if `hasLender`):

1. Toggle: "Include financing options" — controls `financingEnabled`
2. When enabled, show checkboxes for each active plan with name + term + APR
3. Default plans pre-checked
4. Include `financingEnabled` and `selectedPlanIds` in the save payload

- [ ] **Step 3: Add financing preview to estimate preview panel**

In the estimate preview (right side), when `financingEnabled && selectedPlanIds.length > 0`:

Show "Financing Available" section with a card per selected plan:
- Plan name
- Monthly payment (calculated via `calcMonthlyPayment` from `../utils/financing.js`)
- "as low as $X/mo" header using the lowest payment

- [ ] **Step 4: Test build**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/EstimatesView.jsx
git commit -m "feat(financing): add financing toggle and plan selector to estimate builder"
```

---

## Task 9: Public Estimate — Customer Financing

**Files:**
- Modify: `client/src/components/PublicEstimate.jsx`

- [ ] **Step 1: Add financing state and data fetching**

Add state:
```javascript
const [financingPlans, setFinancingPlans] = useState([]);
const [financingApps, setFinancingApps] = useState([]);
const [applyingPlan, setApplyingPlan] = useState(null);
const [financingPolling, setFinancingPolling] = useState(false);
```

On mount (after estimate loads), if `estimate.financing_enabled`:
- `GET /api/crm/financing/public/${token}/plans` → `setFinancingPlans`
- `GET /api/crm/financing/public/${token}/applications` → `setFinancingApps`
- If URL has `?financing=applied`, start polling: every 3s, re-fetch applications, stop after 30s or when status is not `redirected`

- [ ] **Step 2: Add "As low as" callout**

Below the estimate total, if `financingPlans.length > 0`:
```jsx
<p style={{ color: 'oklch(0.75 0.15 145)', fontSize: '1.1rem' }}>
  Or as low as {formatMoney(lowestMonthly)}/mo with financing
</p>
```

Where `lowestMonthly` is the minimum of `calcMonthlyPayment(estimate.total, plan.apr, plan.term_months)` across all plans.

- [ ] **Step 3: Add Financing Options card**

Below the estimate details, a glass card showing each plan:
- Plan name, term, APR
- Monthly payment amount
- "Apply for Financing" button (or status if already applied)
- If an application exists for this plan, show status badge instead of button

Apply handler:
```javascript
async function handleApplyFinancing(planId) {
  setApplyingPlan(planId);
  try {
    const { data } = await client.post(`/crm/financing/public/${token}/apply`, { planId });
    if (data.redirect_url) {
      window.location.href = data.redirect_url;
    }
  } catch (err) {
    // show error
  } finally {
    setApplyingPlan(null);
  }
}
```

Note: the API path uses `/crm/financing/public/...` since the financing router is mounted at `/crm/financing` in routes/index.js, and the axios client already has a `/api` baseURL.

- [ ] **Step 4: Add polling logic for post-redirect status**

```javascript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('financing')) return;

  setFinancingPolling(true);
  let elapsed = 0;
  const interval = setInterval(async () => {
    elapsed += 3000;
    const { data } = await client.get(`/crm/financing/public/${token}/applications`);
    setFinancingApps(data);
    const hasDecision = data.some(a => !['pending', 'redirected'].includes(a.status));
    if (hasDecision || elapsed >= 30000) {
      clearInterval(interval);
      setFinancingPolling(false);
    }
  }, 3000);
  return () => clearInterval(interval);
}, [token]);
```

- [ ] **Step 5: Test build**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/PublicEstimate.jsx
git commit -m "feat(financing): add customer-facing financing options and apply flow to public estimate"
```

---

## Task 10: Pipeline — Financing Badge

**Files:**
- Modify: `client/src/components/Pipeline.jsx`

- [ ] **Step 1: Add financing data to pipeline fetch**

The pipeline loads leads. We need financing status per lead. Add a fetch after leads load:
```javascript
// After leads are loaded, fetch financing applications for visible leads
const leadIds = leads.map(l => l.id);
const { data: financingData } = await client.get('/crm/financing/applications', { params: { leadId: leadIds.join(',') } });
```

Or more practically: modify the pipeline leads query on the backend to include a `financing_status` field via a LEFT JOIN or subquery on `financing_applications`. This avoids N+1. Add to `lead_summary_view` or the pipeline query:

```sql
(SELECT status FROM financing_applications WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as financing_status
```

- [ ] **Step 2: Add financing badge to lead card**

In the lead card rendering section, after the priority badge, if `lead.financing_status`:

```jsx
{lead.financing_status && (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '999px',
    background: ['approved','funded'].includes(lead.financing_status) ? 'oklch(0.45 0.12 145 / 0.3)' :
                ['declined'].includes(lead.financing_status) ? 'oklch(0.45 0.12 25 / 0.3)' :
                'oklch(0.55 0.12 85 / 0.3)',
    color: ['approved','funded'].includes(lead.financing_status) ? 'oklch(0.8 0.15 145)' :
           ['declined'].includes(lead.financing_status) ? 'oklch(0.8 0.15 25)' :
           'oklch(0.8 0.15 85)',
  }}>
    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>payments</span>
    {lead.financing_status}
  </span>
)}
```

- [ ] **Step 3: Test build**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Pipeline.jsx server/src/services/ server/src/routes/
git commit -m "feat(financing): add financing status badge to pipeline lead cards"
```

---

## Task 11: Lead Detail — Financing Section

**Files:**
- Modify: `client/src/components/LeadDetail.jsx`

- [ ] **Step 1: Fetch financing applications for the lead**

Add state and fetch:
```javascript
const [financingApps, setFinancingApps] = useState([]);

// In the lead detail fetch effect:
const { data: apps } = await client.get('/crm/financing/applications', { params: { leadId: lead.id } });
setFinancingApps(apps);
```

- [ ] **Step 2: Add collapsible Financing section**

Below existing sections in the lead detail, add a collapsible "Financing" section (only if `financingApps.length > 0`):

```jsx
{financingApps.length > 0 && (
  <div style={{ marginTop: 'var(--space-lg)' }}>
    <h4 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="material-symbols-rounded">payments</span>
      Financing
    </h4>
    {financingApps.map(app => (
      <div key={app.id} className="glass" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>{app.plan_name}</span>
          <StatusBadge status={app.status} />
        </div>
        <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '4px' }}>
          {app.term_months}mo @ {app.apr}% APR
          {app.approved_amount && ` — Approved: ${formatMoney(app.approved_amount)}`}
          {app.monthly_payment && ` — ${formatMoney(app.monthly_payment)}/mo`}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
          {app.applied_at && `Applied ${new Date(app.applied_at).toLocaleDateString()}`}
          {app.decided_at && ` → Decision ${new Date(app.decided_at).toLocaleDateString()}`}
          {app.funded_at && ` → Funded ${new Date(app.funded_at).toLocaleDateString()}`}
        </div>
      </div>
    ))}
  </div>
)}
```

Where `StatusBadge` is a small inline helper:
```jsx
function StatusBadge({ status }) {
  const colors = {
    pending: { bg: 'oklch(0.55 0.12 85 / 0.3)', fg: 'oklch(0.8 0.15 85)' },
    redirected: { bg: 'oklch(0.55 0.12 85 / 0.3)', fg: 'oklch(0.8 0.15 85)' },
    applied: { bg: 'oklch(0.55 0.12 85 / 0.3)', fg: 'oklch(0.8 0.15 85)' },
    approved: { bg: 'oklch(0.45 0.12 145 / 0.3)', fg: 'oklch(0.8 0.15 145)' },
    funded: { bg: 'oklch(0.45 0.12 145 / 0.3)', fg: 'oklch(0.8 0.15 145)' },
    declined: { bg: 'oklch(0.45 0.12 25 / 0.3)', fg: 'oklch(0.8 0.15 25)' },
    expired: { bg: 'oklch(0.4 0.05 250 / 0.3)', fg: 'oklch(0.7 0.05 250)' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}
```

- [ ] **Step 3: Verify activity timeline handles financing type**

Check the existing activity timeline renderer in `LeadDetail.jsx`. If it filters activities by known types or renders different types with specific icons/labels, add handling for `type: 'financing'`. Ensure activities with `type: 'financing'` and `direction: 'inbound'` render correctly — use a `payments` icon and the notes text from the webhook handler (e.g. "Customer applied for financing", "Financing approved — $462.00/mo").

- [ ] **Step 4: Test build**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/LeadDetail.jsx
git commit -m "feat(financing): add financing section to lead detail with status timeline"
```

---

## Task 12: Final Integration Verification

- [ ] **Step 1: Full build check**

Run: `cd /c/Projects/stormleads/client && npx vite build`
Expected: Clean build, no errors or warnings.

- [ ] **Step 2: Verify all imports resolve**

Check that all new imports are valid — `financing.js` utility, service imports, route imports.

- [ ] **Step 3: Add ENCRYPTION_KEY to .env.example**

Add to the server's `.env.example` (if it exists):
```
# 32-byte hex key for encrypting lender API keys (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(financing): final integration wiring and env config"
```
