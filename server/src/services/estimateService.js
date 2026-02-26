import pool from '../db/pool.js';
import crypto from 'crypto';

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
  } = data;

  const { subtotal, tax_amount, total } = calculateTotals(line_items, tax_rate, discount_type, discount_value);

  const { rows } = await pool.query(
    `INSERT INTO estimates (
      tenant_id, created_by, lead_id, estimate_number, public_token,
      customer_name, customer_address, customer_phone, customer_email,
      line_items, subtotal, tax_rate, tax_amount, discount_type, discount_value, total,
      scope_of_work, terms, warranty_info, notes, valid_until
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    RETURNING *`,
    [
      tenantId, userId, lead_id || null, estimate_number, public_token,
      customer_name || null, customer_address || null, customer_phone || null, customer_email || null,
      JSON.stringify(line_items), subtotal, tax_rate, tax_amount, discount_type, discount_value, total,
      scope_of_work || null, terms || null, warranty_info || null, notes || null, valid_until || null,
    ]
  );

  return rows[0];
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
            l.contact_phone AS lead_phone, l.contact_email AS lead_email
     FROM estimates e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN leads l ON l.id = e.lead_id
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
  ];

  const setClauses = [];
  const params = [tenantId, estimateId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      const val = field === 'line_items' ? JSON.stringify(updates[field]) : updates[field];
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

  return rows[0] || null;
}

export async function sendEstimate(tenantId, estimateId) {
  const { rows } = await pool.query(
    `UPDATE estimates SET status = 'sent', sent_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
     RETURNING *`,
    [estimateId, tenantId]
  );
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

// ============================================================
// PUBLIC (customer-facing)
// ============================================================

export async function getEstimateByToken(token) {
  const { rows } = await pool.query(
    `SELECT e.*, t.name AS company_name
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
  return rows[0] || null;
}

export async function declineEstimate(token) {
  const { rows } = await pool.query(
    `UPDATE estimates SET status = 'declined'
     WHERE public_token = $1 AND status IN ('sent', 'viewed')
     RETURNING *`,
    [token]
  );
  return rows[0] || null;
}

// ============================================================
// TEMPLATES
// ============================================================

export async function getTemplates(tenantId) {
  const { rows } = await pool.query(
    `SELECT * FROM estimate_templates WHERE tenant_id = $1 ORDER BY position, name`,
    [tenantId]
  );
  return rows;
}

// ============================================================
// HELPERS
// ============================================================

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
