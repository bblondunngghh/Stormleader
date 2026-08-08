import pool from '../db/pool.js';

// ============================================================
// INVOICES CRUD
// ============================================================

export async function getInvoices(tenantId, { status, limit = 50, offset = 0 } = {}) {
  const params = [tenantId];
  const conditions = ['i.tenant_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT i.*, l.contact_name, l.address AS lead_address
     FROM invoices i
     LEFT JOIN leads l ON l.id = i.lead_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM invoices i WHERE ${conditions.join(' AND ')}`,
    params.slice(0, params.length - 2)
  );

  return { invoices: rows, total: parseInt(countRows[0].total, 10) };
}

export async function getInvoice(tenantId, id) {
  const { rows } = await pool.query(
    `SELECT i.*, l.contact_name, l.address AS lead_address,
            l.contact_phone AS lead_phone, l.contact_email AS lead_email
     FROM invoices i
     LEFT JOIN leads l ON l.id = i.lead_id
     WHERE i.id = $1 AND i.tenant_id = $2`,
    [id, tenantId]
  );
  return rows[0] || null;
}

export async function createInvoice(tenantId, data) {
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM invoices WHERE tenant_id = $1`,
    [tenantId]
  );
  const num = parseInt(countRows[0].cnt, 10) + 1;
  const invoice_number = `INV-${String(num).padStart(4, '0')}`;

  const {
    lead_id, line_items = [], subtotal = 0, tax_rate = 0,
    tax_amount = 0, total = 0, due_date, notes, estimate_id,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO invoices (
      tenant_id, lead_id, estimate_id, invoice_number,
      line_items, subtotal, tax_rate, tax_amount, total,
      due_date, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [
      tenantId, lead_id || null, estimate_id || null, invoice_number,
      JSON.stringify(line_items), subtotal, tax_rate, tax_amount, total,
      due_date || null, notes || null,
    ]
  );

  return rows[0];
}

export async function createFromEstimate(tenantId, estimateId) {
  // Fetch the estimate
  const { rows: estRows } = await pool.query(
    `SELECT * FROM estimates WHERE id = $1 AND tenant_id = $2`,
    [estimateId, tenantId]
  );
  if (!estRows[0]) return null;

  const est = estRows[0];

  return createInvoice(tenantId, {
    lead_id: est.lead_id,
    estimate_id: est.id,
    line_items: est.line_items,
    subtotal: parseFloat(est.subtotal),
    tax_rate: parseFloat(est.tax_rate),
    tax_amount: parseFloat(est.tax_amount),
    total: parseFloat(est.total),
    notes: est.notes,
  });
}

export async function updateInvoice(tenantId, id, data) {
  const allowedFields = [
    'line_items', 'subtotal', 'tax_rate', 'tax_amount', 'total',
    'due_date', 'notes', 'status', 'lead_id',
  ];

  const setClauses = ['updated_at = now()'];
  const params = [tenantId, id];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      const val = field === 'line_items' ? JSON.stringify(data[field]) : data[field];
      params.push(val);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 1) return getInvoice(tenantId, id);

  const { rows } = await pool.query(
    `UPDATE invoices SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  return rows[0] || null;
}

export const PAYMENT_METHODS = ['check', 'cash', 'card', 'ach', 'insurance', 'financing', 'other'];

export async function recordPayment(tenantId, id, amount, paymentMethod = null, reference = null) {
  const { rows } = await pool.query(
    `UPDATE invoices
     SET amount_paid = COALESCE(amount_paid, 0) + $3,
         status = CASE WHEN COALESCE(amount_paid, 0) + $3 >= total THEN 'paid' ELSE status END,
         paid_at = CASE WHEN COALESCE(amount_paid, 0) + $3 >= total THEN now() ELSE paid_at END,
         payment_method = COALESCE($4, payment_method),
         payment_reference = COALESCE($5, payment_reference),
         updated_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, amount, paymentMethod, reference]
  );

  return rows[0] || null;
}

export async function sendInvoice(tenantId, id) {
  const { rows } = await pool.query(
    `UPDATE invoices SET status = 'sent', sent_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId]
  );

  return rows[0] || null;
}
