import pool from '../../db/pool.js';
import { encrypt, decrypt } from './encryption.js';
import * as hearthAdapter from './adapters/hearth.js';
import * as mockAdapter from './adapters/mock.js';

const adapters = { hearth: hearthAdapter, mock: mockAdapter };

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
  if (!lender) {
    const err = new Error('Lender not found');
    err.status = 404;
    throw err;
  }

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
  if (!plan) {
    const err = new Error('Plan not found or inactive');
    err.status = 404;
    throw err;
  }

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

async function assertEstimateByToken(estimateToken) {
  const { rows } = await pool.query(
    'SELECT id FROM estimates WHERE public_token = $1',
    [estimateToken]
  );
  if (!rows[0]) {
    const err = new Error('Estimate not found');
    err.status = 404;
    throw err;
  }
}

export async function getPublicPlans(estimateToken) {
  await assertEstimateByToken(estimateToken);
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
  await assertEstimateByToken(estimateToken);
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
