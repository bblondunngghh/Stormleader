import pool from '../db/pool.js';
import crypto from 'crypto';

// ============================================================
// CONTRACTS CRUD
// ============================================================

export async function listContracts(tenantId, filters = {}) {
  const { status, leadId, limit = 50, offset = 0 } = filters;
  const params = [tenantId];
  const conditions = ['c.tenant_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (leadId) {
    params.push(leadId);
    conditions.push(`c.lead_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT c.*, l.contact_name, l.address
     FROM contracts c
     LEFT JOIN leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
     WHERE ${where}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM contracts c WHERE ${where}`,
    params.slice(0, params.length - 2)
  );

  return { contracts: rows, total: parseInt(countRows[0].total, 10) };
}

export async function getContract(tenantId, id) {
  const { rows } = await pool.query(
    `SELECT c.*, l.contact_name, l.address, l.contact_phone, l.contact_email,
            e.estimate_number, e.total AS estimate_total,
            t.name AS company_name
     FROM contracts c
     LEFT JOIN leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
     LEFT JOIN estimates e ON e.id = c.estimate_id
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [id, tenantId]
  );
  return rows[0] || null;
}

export async function getContractByToken(token) {
  const { rows } = await pool.query(
    `SELECT c.*, l.contact_name, l.address, l.contact_phone, l.contact_email,
            t.name AS company_name
     FROM contracts c
     LEFT JOIN leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.token = $1`,
    [token]
  );
  return rows[0] || null;
}

export async function createContract(tenantId, { leadId, estimateId, templateType, content }) {
  let finalContent = content || {};

  // If estimateId provided, fetch estimate + lead data to auto-populate merge fields
  if (estimateId) {
    const { rows: estRows } = await pool.query(
      `SELECT e.*, l.contact_name, l.address, l.contact_phone, l.contact_email
       FROM estimates e
       LEFT JOIN leads l ON l.id = e.lead_id AND l.tenant_id = e.tenant_id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [estimateId, tenantId]
    );
    if (estRows[0]) {
      const est = estRows[0];
      finalContent = {
        ...finalContent,
        customer_name: est.contact_name || est.customer_name,
        address: est.address || est.customer_address,
        scope_of_work: est.scope_of_work,
        total: est.total,
        line_items: est.line_items,
      };
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO contracts (tenant_id, lead_id, estimate_id, template_type, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, leadId || null, estimateId || null, templateType || 'standard', JSON.stringify(finalContent)]
  );

  return rows[0];
}

export async function updateContract(tenantId, id, data) {
  const allowedFields = ['lead_id', 'estimate_id', 'template_type', 'content'];
  const setClauses = [];
  const params = [tenantId, id];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      const val = field === 'content' ? JSON.stringify(data[field]) : data[field];
      params.push(val);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE contracts SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1 AND status = 'draft'
     RETURNING *`,
    params
  );

  return rows[0] || null;
}

export async function sendContract(tenantId, id) {
  const token = crypto.randomBytes(32).toString('hex');

  const { rows } = await pool.query(
    `UPDATE contracts SET status = 'sent', sent_at = NOW(), token = $3, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
     RETURNING *`,
    [id, tenantId, token]
  );

  return rows[0] || null;
}

export async function signContract(token, { signerName, signatureData }) {
  const { rows } = await pool.query(
    `UPDATE contracts
     SET signer_name = $2, signature_data = $3, signed_at = NOW(), status = 'signed', updated_at = NOW()
     WHERE token = $1 AND status IN ('sent', 'viewed')
     RETURNING *`,
    [token, signerName, signatureData]
  );
  return rows[0] || null;
}

export async function markViewed(token) {
  const { rows } = await pool.query(
    `UPDATE contracts
     SET viewed_at = COALESCE(viewed_at, NOW()),
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
         updated_at = NOW()
     WHERE token = $1
     RETURNING *`,
    [token]
  );
  return rows[0] || null;
}

export async function voidContract(tenantId, id) {
  const { rows } = await pool.query(
    `UPDATE contracts SET status = 'voided', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('signed', 'voided')
     RETURNING *`,
    [id, tenantId]
  );
  return rows[0] || null;
}

// ============================================================
// TEMPLATES
// ============================================================

export async function listTemplates(tenantId) {
  const { rows } = await pool.query(
    `SELECT * FROM contract_templates
     WHERE tenant_id IS NULL OR tenant_id = $1
     ORDER BY is_default DESC, name ASC`,
    [tenantId]
  );
  return rows;
}

export async function createTemplate(tenantId, { name, type, content }) {
  const { rows } = await pool.query(
    `INSERT INTO contract_templates (tenant_id, name, type, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, name, type, JSON.stringify(content || {})]
  );
  return rows[0];
}

export async function updateTemplate(tenantId, id, data) {
  const allowedFields = ['name', 'type', 'content'];
  const setClauses = [];
  const params = [tenantId, id];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      const val = field === 'content' ? JSON.stringify(data[field]) : data[field];
      params.push(val);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');

  const { rows } = await pool.query(
    `UPDATE contract_templates SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  return rows[0] || null;
}

export async function deleteTemplate(tenantId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM contract_templates
     WHERE id = $1 AND tenant_id = $2 AND is_default = FALSE`,
    [id, tenantId]
  );
  return rowCount > 0;
}
