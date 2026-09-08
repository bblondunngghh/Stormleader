import pool from '../db/pool.js';
import assertOwned from '../utils/assertOwned.js';

export async function listExpenses(tenantId, { leadId, category, startDate, endDate, limit = 50, offset = 0 } = {}) {
  const params = [tenantId];
  const conditions = ['e.tenant_id = $1'];

  if (leadId) {
    params.push(leadId);
    conditions.push(`e.lead_id = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`e.category = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`e.date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`e.date <= $${params.length}`);
  }

  const where = conditions.join(' AND ');

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT e.*, l.contact_name, l.address AS lead_address
     FROM expenses e
     LEFT JOIN leads l ON l.id = e.lead_id AND l.tenant_id = e.tenant_id
     WHERE ${where}
     ORDER BY e.date DESC, e.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM expenses e WHERE ${where}`,
    params.slice(0, params.length - 2)
  );

  return { expenses: rows, total: parseInt(countRows[0].total, 10) };
}

export async function createExpense(tenantId, { leadId, category, amount, date, notes, createdBy }) {

  // Reject a client-supplied foreign key owned by another tenant. Same write-boundary
  // rule as createTask/logActivity: these ids come straight from the request body and the
  // read paths join on them, so an unchecked id stored another tenant's row as a dangling
  // reference and rendered its PII back to the caller.
  await assertOwned(tenantId, 'leads', leadId, 'lead_id');
  const { rows } = await pool.query(
    `INSERT INTO expenses (tenant_id, lead_id, category, amount, date, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, leadId || null, category, amount, date, notes || null, createdBy || null]
  );
  return rows[0];
}

export async function updateExpense(tenantId, id, data) {

  // createExpense guards lead_id (96f7ad2); update whitelists it too and did not.
  await assertOwned(tenantId, 'leads', data.lead_id, 'lead_id');

  const allowedFields = ['lead_id', 'category', 'amount', 'date', 'notes'];
  const setClauses = ['updated_at = now()'];
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
    `UPDATE expenses SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  return rows[0] || null;
}

export async function deleteExpense(tenantId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM expenses WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return rowCount > 0;
}

export async function getJobCostSummary(tenantId, leadId) {
  // Total expenses for this lead
  const { rows: expRows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_expenses
     FROM expenses
     WHERE tenant_id = $1 AND lead_id = $2`,
    [tenantId, leadId]
  );

  // Estimate total — use the accepted estimate, or the latest one
  const { rows: estRows } = await pool.query(
    `SELECT total FROM estimates
     WHERE tenant_id = $1 AND lead_id = $2
     ORDER BY CASE WHEN status = 'accepted' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [tenantId, leadId]
  );

  const totalExpenses = parseFloat(expRows[0].total_expenses);
  const estimateTotal = estRows[0] ? parseFloat(estRows[0].total) : 0;
  const profit = estimateTotal - totalExpenses;
  const profitPercent = estimateTotal > 0 ? (profit / estimateTotal) * 100 : 0;

  return { totalExpenses, estimateTotal, profit, profitPercent };
}
