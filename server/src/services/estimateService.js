import pool from '../db/pool.js';
import crypto from 'crypto';
import { sendEstimateEmail } from './emailService.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

// ============================================================
// ESTIMATES CRUD
// ============================================================

export async function createEstimate(tenantId, userId, data) {
  // Generate next estimate number for tenant
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM estimates WHERE tenant_id = $1`,
    [tenantId]
  );
  const num = parseInt(countRows[0].cnt, 10) + 1;
  const estimate_number = `EST-${String(num).padStart(3, '0')}`;
  const public_token = crypto.randomBytes(32).toString('hex');

  const {
    lead_id, customer_name, customer_address, customer_phone, customer_email,
    line_items = [], tax_rate = 0, discount_type = 'flat', discount_value = 0,
    scope_of_work, terms, warranty_info, notes, valid_until,
    financing_enabled = false, financing_plan_ids = [],
  } = data;

  const { subtotal, tax_amount, total } = calculateTotals(line_items, tax_rate, discount_type, discount_value);

  const { rows } = await pool.query(
    `INSERT INTO estimates (
      tenant_id, created_by, lead_id, estimate_number, public_token,
      customer_name, customer_address, customer_phone, customer_email,
      line_items, subtotal, tax_rate, tax_amount, discount_type, discount_value, total,
      scope_of_work, terms, warranty_info, notes, valid_until,
      financing_enabled, financing_plan_ids
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    RETURNING *`,
    [
      tenantId, userId, lead_id || null, estimate_number, public_token,
      customer_name || null, customer_address || null, customer_phone || null, customer_email || null,
      JSON.stringify(line_items), subtotal, tax_rate, tax_amount, discount_type, discount_value, total,
      scope_of_work || null, terms || null, warranty_info || null, notes || null, valid_until || null,
      financing_enabled, JSON.stringify(financing_plan_ids),
    ]
  );

  // Sync estimate total to lead's estimated_value
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, tenantId);
  }

  return estimate;
}

export async function getEstimates(tenantId, filters = {}) {
  const { status, lead_id, limit = 50, offset = 0 } = filters;
  const params = [tenantId];
  const conditions = ['e.tenant_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  if (lead_id) {
    params.push(lead_id);
    conditions.push(`e.lead_id = $${params.length}`);
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT e.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name,
            l.contact_name AS lead_name, l.address AS lead_address
     FROM estimates e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN leads l ON l.id = e.lead_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM estimates e WHERE ${conditions.join(' AND ')}`,
    params.slice(0, params.length - 2)
  );

  return { estimates: rows, total: parseInt(countRows[0].total, 10) };
}

export async function getEstimateDetail(tenantId, estimateId) {
  const { rows } = await pool.query(
    `SELECT e.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name,
            l.contact_name AS lead_name, l.address AS lead_address, l.city AS lead_city,
            l.contact_phone AS lead_phone, l.contact_email AS lead_email,
            t.name AS company_name
     FROM estimates e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN leads l ON l.id = e.lead_id
     LEFT JOIN tenants t ON t.id = e.tenant_id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [estimateId, tenantId]
  );
  return rows[0] || null;
}

export async function updateEstimate(tenantId, estimateId, updates) {
  const allowedFields = [
    'lead_id', 'customer_name', 'customer_address', 'customer_phone', 'customer_email',
    'line_items', 'tax_rate', 'discount_type', 'discount_value',
    'scope_of_work', 'terms', 'warranty_info', 'notes', 'valid_until', 'status',
    'financing_enabled', 'financing_plan_ids',
  ];

  const setClauses = [];
  const params = [tenantId, estimateId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      const val = (field === 'line_items' || field === 'financing_plan_ids') ? JSON.stringify(updates[field]) : updates[field];
      params.push(val);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  // Recalculate totals if line items or pricing fields changed
  if (updates.line_items || updates.tax_rate !== undefined || updates.discount_type || updates.discount_value !== undefined) {
    const current = await getEstimateDetail(tenantId, estimateId);
    if (!current) return null;

    const lineItems = updates.line_items || current.line_items;
    const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : current.tax_rate;
    const discType = updates.discount_type || current.discount_type;
    const discValue = updates.discount_value !== undefined ? updates.discount_value : current.discount_value;

    const { subtotal, tax_amount, total } = calculateTotals(lineItems, taxRate, discType, discValue);
    params.push(subtotal, tax_amount, total);
    setClauses.push(`subtotal = $${params.length - 2}`, `tax_amount = $${params.length - 1}`, `total = $${params.length}`);
  }

  if (setClauses.length === 0) return getEstimateDetail(tenantId, estimateId);

  const { rows } = await pool.query(
    `UPDATE estimates SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  // Sync estimate total to lead's estimated_value
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, tenantId);
  }

  return estimate || null;
}

export async function deleteEstimate(tenantId, estimateId) {
  // Fetch lead_id before deleting so we can sync the lead's estimated_value
  const { rows: estRows } = await pool.query(
    `SELECT lead_id FROM estimates WHERE id = $1 AND tenant_id = $2`,
    [estimateId, tenantId]
  );
  const leadId = estRows[0]?.lead_id;

  const { rowCount } = await pool.query(
    `DELETE FROM estimates WHERE id = $1 AND tenant_id = $2`,
    [estimateId, tenantId]
  );

  if (rowCount > 0 && leadId) {
    await syncLeadEstimatedValue(leadId, tenantId);
  }

  return rowCount > 0;
}

export async function sendEstimate(tenantId, estimateId) {
  // Get full estimate with company name for email
  const { rows: detailRows } = await pool.query(
    `SELECT e.*, t.name AS company_name
     FROM estimates e
     JOIN tenants t ON t.id = e.tenant_id
     WHERE e.id = $1 AND e.tenant_id = $2 AND e.status = 'draft'`,
    [estimateId, tenantId]
  );
  if (!detailRows[0]) return null;

  const estimate = detailRows[0];

  // Update status
  const { rows } = await pool.query(
    `UPDATE estimates SET status = 'sent', sent_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [estimateId, tenantId]
  );

  // Send email if customer has an email address
  if (estimate.customer_email) {
    try {
      await sendEstimateEmail(estimate.customer_email, estimate, config.APP_URL);
    } catch (err) {
      logger.error({ err, estimateId, to: estimate.customer_email }, 'Failed to send estimate email');
    }
  }

  return rows[0] || null;
}

export async function duplicateEstimate(tenantId, userId, estimateId) {
  const original = await getEstimateDetail(tenantId, estimateId);
  if (!original) return null;

  return createEstimate(tenantId, userId, {
    lead_id: original.lead_id,
    customer_name: original.customer_name,
    customer_address: original.customer_address,
    customer_phone: original.customer_phone,
    customer_email: original.customer_email,
    line_items: original.line_items,
    tax_rate: parseFloat(original.tax_rate),
    discount_type: original.discount_type,
    discount_value: parseFloat(original.discount_value),
    scope_of_work: original.scope_of_work,
    terms: original.terms,
    warranty_info: original.warranty_info,
    notes: original.notes,
    valid_until: original.valid_until,
  });
}

/**
 * Generate Good/Better/Best tiered estimates from a single estimate.
 * Good = 85% of original price (basic materials)
 * Better = original price (standard — the source estimate)
 * Best = 120% of original price (premium materials/warranty)
 */
export async function generateTiers(tenantId, userId, estimateId) {
  const original = await getEstimateDetail(tenantId, estimateId);
  if (!original) return null;

  const tiers = [
    { label: 'Good', factor: 0.85, desc: 'Standard materials, manufacturer warranty' },
    { label: 'Better', factor: 1.0, desc: 'Upgraded materials, extended warranty' },
    { label: 'Best', factor: 1.20, desc: 'Premium materials, lifetime warranty, priority scheduling' },
  ];

  const results = [];
  for (const tier of tiers) {
    const adjustedItems = (original.line_items || []).map(item => ({
      ...item,
      unit_price: Math.round((parseFloat(item.unit_price) || 0) * tier.factor * 100) / 100,
    }));

    const estimate = await createEstimate(tenantId, userId, {
      lead_id: original.lead_id,
      customer_name: original.customer_name,
      customer_address: original.customer_address,
      customer_phone: original.customer_phone,
      customer_email: original.customer_email,
      line_items: adjustedItems,
      tax_rate: parseFloat(original.tax_rate),
      discount_type: original.discount_type,
      discount_value: parseFloat(original.discount_value),
      scope_of_work: original.scope_of_work,
      terms: original.terms,
      warranty_info: original.warranty_info,
      notes: `[${tier.label} Tier] ${tier.desc}\n\n${original.notes || ''}`.trim(),
      valid_until: original.valid_until,
    });

    results.push({ ...estimate, tier_label: tier.label });
  }

  return results;
}

// ============================================================
// PUBLIC (customer-facing)
// ============================================================

export async function getEstimateByToken(token) {
  const { rows } = await pool.query(
    `SELECT e.*, t.name AS company_name,
            (t.stripe_account_id IS NOT NULL AND t.stripe_onboarding_complete = true) AS stripe_connected
     FROM estimates e
     JOIN tenants t ON t.id = e.tenant_id
     WHERE e.public_token = $1`,
    [token]
  );
  if (rows.length === 0) return null;

  // Mark as viewed if first time
  if (!rows[0].viewed_at) {
    await pool.query(
      `UPDATE estimates SET viewed_at = now(), status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
       WHERE id = $1`,
      [rows[0].id]
    );
  }
  return rows[0];
}

export async function acceptEstimate(token, signerName, signatureData) {
  const { rows } = await pool.query(
    `UPDATE estimates
     SET status = 'accepted', signed_at = now(), signer_name = $2, signature_data = $3
     WHERE public_token = $1 AND status IN ('sent', 'viewed')
     RETURNING *`,
    [token, signerName, signatureData]
  );
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, estimate.tenant_id);
  }
  return estimate || null;
}

export async function declineEstimate(token) {
  const { rows } = await pool.query(
    `UPDATE estimates SET status = 'declined'
     WHERE public_token = $1 AND status IN ('sent', 'viewed')
     RETURNING *`,
    [token]
  );
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, estimate.tenant_id);
  }
  return estimate || null;
}

// ============================================================
// TEMPLATES
// ============================================================

export async function getTemplates(tenantId) {
  let { rows } = await pool.query(
    `SELECT * FROM estimate_templates WHERE tenant_id = $1 ORDER BY position, name`,
    [tenantId]
  );
  // Auto-seed default templates if none exist for this tenant
  if (rows.length === 0) {
    const defaults = [
      ['Tear Off & Replace', 'Remove existing shingles and install new', 'sq', 350.00, 'Roof', 0],
      ['Architectural Shingles', 'GAF Timberline HDZ or equivalent', 'sq', 125.00, 'Roof', 1],
      ['Underlayment', 'Synthetic underlayment', 'sq', 45.00, 'Roof', 2],
      ['Ridge Cap', 'Hip and ridge cap shingles', 'lf', 6.50, 'Roof', 3],
      ['Drip Edge', 'Aluminum drip edge', 'lf', 4.00, 'Roof', 4],
      ['Ice & Water Shield', 'Self-adhering membrane at eaves/valleys', 'sq', 95.00, 'Roof', 5],
      ['Pipe Boot', 'Replace pipe boot flashing', 'each', 45.00, 'Roof', 6],
      ['Flashing', 'Step/counter flashing replacement', 'lf', 12.00, 'Roof', 7],
      ['Ventilation', 'Ridge vent or box vent', 'each', 65.00, 'Roof', 8],
      ['Skylights', 'Re-flash existing skylight', 'each', 250.00, 'Roof', 9],
      ['Gutter Replacement', 'Seamless aluminum gutters', 'lf', 8.50, 'Gutters', 10],
      ['Downspout', 'Aluminum downspout', 'lf', 6.00, 'Gutters', 11],
      ['Fascia Board', 'Replace damaged fascia', 'lf', 10.00, 'Misc', 12],
      ['Soffit Repair', 'Repair or replace soffit panels', 'lf', 12.00, 'Misc', 13],
      ['Dumpster / Haul Off', 'Debris removal', 'each', 450.00, 'Misc', 14],
    ];
    for (const [name, desc, unit, price, section, pos] of defaults) {
      await pool.query(
        `INSERT INTO estimate_templates (tenant_id, name, description, unit, default_unit_price, section, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, name, desc, unit, price, section, pos]
      );
    }
    ({ rows } = await pool.query(
      `SELECT * FROM estimate_templates WHERE tenant_id = $1 ORDER BY position, name`,
      [tenantId]
    ));
  }
  return rows;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Sync the sum of non-declined estimate totals to the lead's estimated_value.
 */
async function syncLeadEstimatedValue(leadId, tenantId) {
  const { rows: [totals] } = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS sum FROM estimates
     WHERE lead_id = $1 AND tenant_id = $2 AND status != 'declined'`,
    [leadId, tenantId]
  );
  await pool.query(
    'UPDATE leads SET estimated_value = $1 WHERE id = $2 AND tenant_id = $3',
    [totals.sum, leadId, tenantId]
  );
}

function calculateTotals(lineItems, taxRate, discountType, discountValue) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const subtotal = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);

  let discount = 0;
  if (discountType === 'percent') {
    discount = subtotal * (Number(discountValue) || 0) / 100;
  } else {
    discount = Number(discountValue) || 0;
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax_amount = taxable * (Number(taxRate) || 0);
  const total = taxable + tax_amount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(tax_amount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
