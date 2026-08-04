import pool from '../db/pool.js';

export async function listSubcontractors(tenantId, { specialty, status, search, limit = 50, offset = 0 } = {}) {
  const params = [tenantId];
  const conditions = ['tenant_id = $1'];

  if (specialty) {
    params.push(specialty);
    conditions.push(`specialty = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR company ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT * FROM subcontractors
     WHERE ${where}
     ORDER BY name ASC, id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM subcontractors WHERE ${where}`,
    params.slice(0, params.length - 2)
  );

  return { subcontractors: rows, total: parseInt(countRows[0].total, 10) };
}

export async function getSubcontractor(tenantId, id) {
  const { rows } = await pool.query(
    'SELECT * FROM subcontractors WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return rows[0] || null;
}

export async function createSubcontractor(tenantId, data) {
  const { name, company, phone, email, specialty, hourly_rate, notes } = data;
  if (!name) throw new Error('name is required');

  const { rows } = await pool.query(
    `INSERT INTO subcontractors (tenant_id, name, company, phone, email, specialty, hourly_rate, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, name, company || null, phone || null, email || null, specialty || 'general', hourly_rate || null, notes || null]
  );
  return rows[0];
}

export async function updateSubcontractor(tenantId, id, data) {
  const allowedFields = ['name', 'company', 'phone', 'email', 'specialty', 'hourly_rate', 'notes', 'status'];
  const setClauses = ['updated_at = NOW()'];
  const params = [tenantId, id];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 1) {
    const err = new Error(`No valid fields to update. Allowed: ${allowedFields.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE subcontractors SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function deleteSubcontractor(tenantId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM subcontractors WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return rowCount > 0;
}

export async function assignToWorkOrder(tenantId, workOrderId, subcontractorId, { role, agreed_rate, notes } = {}) {
  // Verify work order belongs to tenant
  const { rows: woRows } = await pool.query(
    'SELECT id FROM work_orders WHERE id = $1 AND tenant_id = $2',
    [workOrderId, tenantId]
  );
  if (!woRows.length) return null;

  const { rows } = await pool.query(
    `INSERT INTO work_order_subcontractors (work_order_id, subcontractor_id, role, agreed_rate, notes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (work_order_id, subcontractor_id) DO UPDATE SET role = $3, agreed_rate = $4, notes = $5
     RETURNING *`,
    [workOrderId, subcontractorId, role || null, agreed_rate || null, notes || null]
  );
  return rows[0];
}

export async function getWorkOrderSubcontractors(tenantId, workOrderId) {
  const { rows } = await pool.query(
    `SELECT wos.*, s.name, s.company, s.phone, s.email, s.specialty
     FROM work_order_subcontractors wos
     JOIN subcontractors s ON s.id = wos.subcontractor_id
     JOIN work_orders wo ON wo.id = wos.work_order_id
     WHERE wos.work_order_id = $1 AND wo.tenant_id = $2
     ORDER BY s.name`,
    [workOrderId, tenantId]
  );
  return rows;
}

export async function removeFromWorkOrder(tenantId, workOrderId, subcontractorId) {
  const { rowCount } = await pool.query(
    `DELETE FROM work_order_subcontractors wos
     USING work_orders wo
     WHERE wos.work_order_id = $1 AND wos.subcontractor_id = $2
       AND wo.id = wos.work_order_id AND wo.tenant_id = $3`,
    [workOrderId, subcontractorId, tenantId]
  );
  return rowCount > 0;
}
